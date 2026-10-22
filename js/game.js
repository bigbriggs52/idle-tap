// Game state, simulation tick, player actions, save/load and offline earnings.
window.SVT = window.SVT || {};

(function () {
  const B = SVT.B;
  const SAVE_KEY = "svt-save";
  const listeners = [];

  SVT.on = (fn) => listeners.push(fn);
  const emit = (type, data) => listeners.forEach((fn) => fn(type, data || {}));

  // ---------- number formatting: K, M, B, T, then aa, ab, ac ... ----------
  const SUF = ["", "K", "M", "B", "T"];
  SVT.fmt = function (x) {
    if (!isFinite(x)) return "∞";
    if (x < 0) return "-" + SVT.fmt(-x);
    if (x < 1000) return x < 10 ? (Math.floor(x * 10) / 10).toString() : Math.floor(x).toString();
    const e = Math.floor(Math.log10(x) / 3);
    let s;
    if (e < SUF.length) s = SUF[e];
    else {
      const k = e - SUF.length;
      s = String.fromCharCode(97 + Math.floor(k / 26)) + String.fromCharCode(97 + (k % 26));
    }
    const v = x / Math.pow(1000, e);
    return (v < 10 ? (Math.floor(v * 100) / 100).toFixed(2) : v < 100 ? (Math.floor(v * 10) / 10).toFixed(1) : Math.floor(v)) + s;
  };
  SVT.fmtTime = function (s) {
    s = Math.max(0, Math.ceil(s));
    if (s < 60) return s + "s";
    if (s < 3600) return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h + "h " + m + "m";
  };

  // ---------- state ----------
  const newFloor = () => ({ lvl: 1, stock: 0, left: 0 });
  const newNode = () => ({ lvl: 1, left: 0 });
  function newLab() {
    return {
      cash: B.START_CASH, lifetime: 0, round: 0,
      floors: [newFloor()],
      // Owned managers by id, which slot each one works ("floor:3", "freight", "commercial"), hires this round by role.
      managers: {}, assign: {}, hires: { floor: 0, freight: 0, commercial: 0 }, nextMgr: 1,
      freight: newNode(), commercial: newNode(), lobby: 0, rate: 0, lift: newLift(),
    };
  }
  // The lift's trip: y is its depth in floors (0 = surface). It goes down floor by floor, loads, and turns back when full.
  function newLift() { return { phase: "idle", y: 0, load: 0, timer: 0, at: 0 }; }
  function newState() {
    return { v: 3, activeLab: "garage", buy: 1, labs: { garage: newLab() }, lastSeen: Date.now(), seenIntro: false };
  }

  let S = newState();
  SVT.state = () => S;
  SVT.playableLabs = () => SVT.LABS.filter((l) => !l.soon);
  SVT.labDef = (id) => SVT.LABS.find((l) => l.id === id);
  SVT.lab = (id) => S.labs[id || S.activeLab];

  // A lab opens on the map once the previous lab has raised its Seed round.
  SVT.labUnlocked = (id) => !!S.labs[id];
  SVT.labRequirement = (id) => {
    const list = SVT.playableLabs();
    const i = list.findIndex((l) => l.id === id);
    if (i <= 0) return null;
    return "Raise Seed funding in " + list[i - 1].name;
  };

  // ---------- derived values ----------
  const now = () => Date.now() / 1000;
  SVT.now = now;
  SVT.prestigeMult = (lab) => {
    let m = 1;
    for (let i = 0; i < lab.round; i++) m *= B.ROUNDS[i].mult;
    return m;
  };
  SVT.rank = (id) => B.RANKS.find((r) => r.id === id);
  SVT.ability = (role, id) => B.ABILITIES[role].find((a) => a.id === id);
  const roleOf = (kind) => (kind === "floor" ? "floor" : kind);

  SVT.slotKey = (kind, n) => (kind === "floor" ? "floor:" + n : kind);
  SVT.slotName = (key) => (key.startsWith("floor:") ? "Floor " + key.slice(6) : key === "freight" ? "Lift" : "Warehouse");
  SVT.mgrOf = (lab, kind, n) => {
    const id = lab.assign[SVT.slotKey(kind, n)];
    return id ? lab.managers[id] || null : null;
  };
  SVT.slotOfMgr = (lab, id) => Object.keys(lab.assign).find((k) => lab.assign[k] === id) || null;
  // Owned managers for a role, best rarity first, then newest.
  const RANK_ORDER = {};
  B.RANKS.forEach((r, i) => (RANK_ORDER[r.id] = i));
  SVT.RANK_ORDER = RANK_ORDER;
  SVT.owned = (lab, role) => Object.values(lab.managers).filter((m) => !role || m.role === role)
    .sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank] || b.id - a.id);
  SVT.nodeOf = (lab, kind, n) => (kind === "floor" ? lab.floors[n - 1] : lab[kind]);
  SVT.levelOf = (lab, kind, n) => SVT.nodeOf(lab, kind, n).lvl;

  // Working right now: a manager keeps it going; otherwise one tap runs one cycle (one trip for the lift).
  SVT.running = (lab, kind, n) => {
    if (SVT.mgrOf(lab, kind, n)) return true;
    if (kind === "freight") return !!lab.lift && (lab.lift.phase !== "idle" || !!lab.lift.go);
    return (SVT.nodeOf(lab, kind, n).left || 0) > 0;
  };
  SVT.cycleTime = (kind) => (kind === "floor" ? B.FLOOR_CYCLE : B.WH_TRIP);
  // Throughput multiplier from the node's manager: passive bonus x active boost.
  SVT.nodeMult = (lab, kind, n, t) => {
    const m = SVT.mgrOf(lab, kind, n);
    if (!m) return 1;
    const r = SVT.rank(m.rank);
    let x = 1 + r.passive;
    const ab = SVT.ability(roleOf(kind), m.ability);
    if (ab.kind === "boost" && m.activeUntil > (t || now())) x *= r.boost;
    return x;
  };
  SVT.discount = (lab, kind, n, t) => {
    const m = SVT.mgrOf(lab, kind, n);
    if (!m) return 0;
    const ab = SVT.ability(roleOf(kind), m.ability);
    return ab.kind === "discount" && m.activeUntil > (t || now()) ? SVT.rank(m.rank).discount : 0;
  };

  // Rates in $/s (what each node could move if running).
  SVT.rates = (lab, t) => {
    t = t || now();
    const P = SVT.prestigeMult(lab), depth = lab.floors.length;
    const floors = lab.floors.map((f, i) => B.floorOutput(i + 1, f.lvl) * P * SVT.nodeMult(lab, "floor", i + 1, t));
    const build = floors.reduce((a, b) => a + b, 0);
    const freight = B.freightCap(lab.freight.lvl, depth) * P * SVT.nodeMult(lab, "freight", 0, t);
    const commercial = B.commercialCap(lab.commercial.lvl) * P * SVT.nodeMult(lab, "commercial", 0, t);
    const min = Math.min(build, freight, commercial);
    const limit = min === build ? "build" : min === freight ? "freight" : "commercial";
    return { floors, build, freight, commercial, income: min, limit };
  };

  // ---------- lift ----------
  // Like Idle Miner's elevator: a tap sends it on one trip (a manager keeps sending it), and a trip always finishes.
  // Down one floor every 1/speed s, stop at each floor with stock and pour it in at the loading speed until the floor
  // is empty or the car is full, turn back once full or past the last floor, then empty it over UNLOAD_TIME at the top.
  // Average throughput matches B.freightCap.
  const STOP_TIME = B.LIFT_STOP, UNLOAD_TIME = B.LIFT_UNLOAD;
  SVT.liftCapacity = (lab, t) => B.freightLoad(lab.freight.lvl) * SVT.prestigeMult(lab) * SVT.nodeMult(lab, "freight", 0, t);
  SVT.liftLoadRate = (lab, t) => SVT.liftCapacity(lab, t) / B.liftFillTime(lab.freight.lvl);
  function nextStop(lab, from) {
    for (let k = Math.floor(from + 1e-9) + 1; k <= lab.floors.length; k++) if (lab.floors[k - 1].stock > 0) return k;
    return 0;
  }
  function stepLift(lab, dt, t) {
    const L = lab.lift || (lab.lift = newLift());
    const speed = B.freightSpeed(lab.freight.lvl);
    let guard = 20;
    while (dt > 1e-9 && guard-- > 0) {
      if (L.phase === "idle") {
        if (!SVT.mgrOf(lab, "freight", 0) && !L.go) return;
        if (!nextStop(lab, 0)) { L.go = false; return; }
        L.go = false; L.phase = "down";
      } else if (L.phase === "down") {
        const k = nextStop(lab, L.y);
        if (!k) { L.phase = "up"; continue; }
        const need = (k - L.y) / speed;
        if (need > dt) { L.y += speed * dt; return; }
        dt -= need; L.y = k; L.at = k; L.phase = "load"; L.timer = STOP_TIME;
      } else if (L.phase === "load") {
        if (L.timer > 0) { if (L.timer > dt) { L.timer -= dt; return; } dt -= L.timer; L.timer = 0; }
        const f = lab.floors[L.at - 1], cap = SVT.liftCapacity(lab, t), rate = SVT.liftLoadRate(lab, t);
        const want = Math.min(cap - L.load, f ? f.stock : 0);
        if (want > 1e-9) {
          const used = Math.min(dt, want / rate), take = Math.min(want, rate * used);
          f.stock -= take; L.load += take; dt -= used;
          if (take < want - 1e-9) return;
        }
        L.phase = L.load >= cap - 1e-9 ? "up" : "down";
      } else if (L.phase === "up") {
        const need = L.y / speed;
        if (need > dt) { L.y -= speed * dt; return; }
        dt -= need; L.y = 0; L.phase = "unload"; L.timer = UNLOAD_TIME;
      } else if (L.phase === "unload") {
        if (L.timer > dt) { const out = L.load * dt / L.timer; lab.lobby += out; L.load -= out; L.timer -= dt; return; }
        dt -= L.timer;
        lab.lobby += L.load; L.load = 0; L.phase = "idle";
      }
    }
  }

  // ---------- simulation ----------
  // Floors build in cycles: one cycle adds a cycle's worth of products to the crate when it ends.
  // The warehouse ships in trips: a cart loads up to a trip's worth at the top of the shaft, is paid when it reaches the
  // warehouse halfway through, and rolls back empty.
  // A tap runs one cycle or trip; a manager starts the next one straight away.
  function stepFloor(lab, f, n, dt, t) {
    const mgr = !!SVT.mgrOf(lab, "floor", n), T = B.FLOOR_CYCLE;
    let guard = 50;
    while (dt > 1e-9 && guard-- > 0) {
      if (!(f.left > 0)) { if (!mgr) return; f.left = T; }
      if (f.left > dt) { f.left -= dt; return; }
      dt -= f.left; f.left = 0;
      f.stock += B.floorOutput(n, f.lvl) * SVT.prestigeMult(lab) * SVT.nodeMult(lab, "floor", n, t) * T;
    }
  }
  function stepWarehouse(lab, dt, t) {
    const c = lab.commercial, mgr = !!SVT.mgrOf(lab, "commercial", 0);
    let earned = 0, guard = 50;
    while (dt > 1e-9 && guard-- > 0) {
      if (!(c.left > 0)) {
        if (!mgr || !(lab.lobby > 0)) return earned;
        SVT.startShip(lab, t);
      }
      // The cart reaches the warehouse halfway through the trip and is paid there, then rolls back empty.
      const half = B.WH_TRIP / 2;
      if (c.carry > 0 && c.left > half) {
        if (c.left - half > dt) { c.left -= dt; return earned; }
        dt -= c.left - half; c.left = half;
        earned += c.carry; lab.cash += c.carry; lab.lifetime += c.carry; c.carry = 0;
        continue;
      }
      if (c.left > dt) { c.left -= dt; return earned; }
      dt -= c.left; c.left = 0;
    }
    return earned;
  }
  SVT.shipLoad = (lab, t) => B.commercialCap(lab.commercial.lvl) * SVT.prestigeMult(lab) * SVT.nodeMult(lab, "commercial", 0, t) * B.WH_TRIP;
  SVT.startShip = (lab, t) => {
    const c = lab.commercial, take = Math.min(lab.lobby, SVT.shipLoad(lab, t));
    lab.lobby -= take; c.carry = take; c.left = B.WH_TRIP;
  };
  function tickLab(lab, dt, t) {
    lab.floors.forEach((f, i) => stepFloor(lab, f, i + 1, dt, t));
    stepLift(lab, dt, t);
    const earned = stepWarehouse(lab, dt, t);
    const a = Math.min(1, dt / 8); // income arrives per trip, so smooth over a few trips
    lab.rate = lab.rate * (1 - a) + (earned / dt) * a;
    return earned;
  }
  // Long gaps (app in background) are replayed in 1-second steps so nothing is lost.
  SVT.tick = (dt) => {
    const t = now();
    for (const id in S.labs) {
      for (let s = dt; s > 0; s -= 1) tickLab(S.labs[id], Math.min(1, s), t - s + Math.min(1, s));
    }
    S.lastSeen = Date.now();
  };

  // Offline: only nodes with a manager keep running; capped at OFFLINE_CAP seconds.
  function applyOffline() {
    const away = Math.min((Date.now() - S.lastSeen) / 1000, B.OFFLINE_CAP);
    if (!(away > 30)) return null;
    const result = {};
    const step = 5, t0 = now() - away;
    for (const id in S.labs) {
      const lab = S.labs[id];
      let earned = 0;
      for (let s = 0; s < away; s += step) earned += tickLab(lab, Math.min(step, away - s), t0 + s);
      lab.rate = 0;
      if (earned > 0) result[id] = earned;
    }
    return { seconds: away, earned: result, capped: (Date.now() - S.lastSeen) / 1000 > B.OFFLINE_CAP };
  }

  // ---------- actions ----------
  SVT.tap = (kind, n) => {
    const lab = SVT.lab();
    if (SVT.mgrOf(lab, kind, n)) return;
    // One tap, one cycle: ignored while that cycle (or lift trip) is still going.
    if (SVT.running(lab, kind, n)) return;
    if (kind === "freight") {
      if (!lab.floors.some((f) => f.stock > 0)) { SVT.toast && SVT.toast("Nothing waiting on the floors yet"); return; }
      lab.lift.go = true;
    } else if (kind === "commercial") {
      if (!(lab.lobby > 0)) { SVT.toast && SVT.toast("Nothing at the top of the shaft to ship yet"); return; }
      SVT.startShip(lab);
    } else SVT.nodeOf(lab, kind, n).left = B.FLOOR_CYCLE;
    emit("tap", { kind, n });
  };

  SVT.buyAmount = () => (S.buy === "max" ? Infinity : S.buy);
  SVT.quote = (lab, kind, n) => {
    const L = SVT.levelOf(lab, kind, n);
    return B.bulk(kind, n, L, SVT.buyAmount(), lab.cash, SVT.discount(lab, kind, n));
  };

  SVT.upgrade = (kind, n) => {
    const lab = SVT.lab();
    const q = SVT.quote(lab, kind, n);
    if (q.count <= 0 || lab.cash < q.cost) return false;
    const node = SVT.nodeOf(lab, kind, n);
    const before = node.lvl;
    lab.cash -= q.cost;
    node.lvl += q.count;
    // Report every 5-level unlock crossed (big milestones flagged).
    const ms = kind === "floor" ? B.FLOOR_MILESTONES : B.HUB_MILESTONES;
    const step = kind === "floor" ? B.FLOOR_STEP : B.HUB_STEP;
    let crossed = [];
    for (let l = Math.floor(before / 5) * 5 + 5; l <= node.lvl; l += 5) crossed.push({ lvl: l, mult: ms[l] || step, big: !!ms[l] });
    if (crossed.length) emit("unlock", { kind, n, crossed });
    emit("change");
    return true;
  };

  SVT.nextFloor = (lab) => {
    const n = lab.floors.length + 1;
    if (n > B.FLOORS) return null;
    const wall = B.WALLS[n];
    const blocked = wall !== undefined && lab.round <= wall;
    return { n, cost: B.unlockCost(n), blocked, round: blocked ? B.ROUNDS[wall] : null };
  };

  SVT.unlockFloor = () => {
    const lab = SVT.lab();
    const nf = SVT.nextFloor(lab);
    if (!nf || nf.blocked || lab.cash < nf.cost) return false;
    lab.cash -= nf.cost;
    lab.floors.push(newFloor());
    emit("floor", { n: nf.n });
    emit("change");
    return true;
  };

  // One independent roll per hire against the rarity odds (rarest first).
  SVT.rollRank = (rnd) => {
    let roll = rnd === undefined ? Math.random() : rnd;
    for (const r of B.RANKS) { if (roll < r.odds) return r.id; roll -= r.odds; }
    return "common";
  };
  SVT.hireCost = (lab, role) => B.hireCost(role, lab.hires[role]);
  // Hiring adds a manager to the Owned list; the player chooses where it works.
  SVT.hire = (role) => {
    const lab = SVT.lab();
    const cost = SVT.hireCost(lab, role);
    if (lab.cash < cost) return false;
    lab.cash -= cost;
    const rank = SVT.rollRank();
    const list = B.ABILITIES[role];
    const ability = list[Math.floor(Math.random() * list.length)].id;
    const names = SVT.MANAGER_NAMES;
    const mgr = { id: lab.nextMgr++, role, rank, ability, name: names[Math.floor(Math.random() * names.length)], paid: cost, activeUntil: 0, cdUntil: 0 };
    lab.managers[mgr.id] = mgr;
    lab.hires[role]++;
    emit("hire", { mgr });
    emit("change");
    return mgr;
  };

  // Put an owned manager to work in a slot. Whoever was there goes back to the Owned list.
  SVT.assign = (id, kind, n) => {
    const lab = SVT.lab();
    const m = lab.managers[id];
    if (!m || m.role !== roleOf(kind)) return false;
    const from = SVT.slotOfMgr(lab, id);
    if (from) delete lab.assign[from];
    lab.assign[SVT.slotKey(kind, n)] = id;
    emit("assign", { id });
    emit("change");
    return true;
  };
  SVT.unassign = (id) => {
    const lab = SVT.lab();
    const from = SVT.slotOfMgr(lab, id);
    if (!from) return false;
    delete lab.assign[from];
    emit("assign", { id });
    emit("change");
    return true;
  };
  // Selling refunds half the hire price. Only managers who are not working can be sold.
  SVT.sell = (id) => {
    const lab = SVT.lab();
    const m = lab.managers[id];
    if (!m || SVT.slotOfMgr(lab, id)) return false;
    lab.cash += m.paid * B.SELL_REFUND;
    delete lab.managers[id];
    emit("assign", { id });
    emit("change");
    return true;
  };

  SVT.activate = (kind, n) => {
    const lab = SVT.lab();
    const m = SVT.mgrOf(lab, kind, n);
    const t = now();
    if (!m || m.cdUntil > t) return false;
    const ab = SVT.ability(roleOf(kind), m.ability);
    const dur = ab.kind === "boost" ? B.BOOST_SECONDS : B.DISCOUNT_SECONDS;
    m.activeUntil = t + dur;
    m.cdUntil = m.activeUntil + SVT.rank(m.rank).cooldown;
    emit("ability", { kind, n });
    emit("change");
    return true;
  };

  // Funding rounds: the prestige reset. Each round needs a floor reached and resets the lab, managers included.
  SVT.nextRound = (lab) => (lab.round < B.ROUNDS.length ? B.ROUNDS[lab.round] : null);
  SVT.canRaise = (lab) => {
    const r = SVT.nextRound(lab);
    return !!r && lab.floors.length >= r.needFloor;
  };
  SVT.raise = () => {
    const lab = SVT.lab();
    if (!SVT.canRaise(lab)) return false;
    const r = SVT.nextRound(lab);
    lab.round++;
    lab.cash = B.START_CASH;
    lab.floors = [newFloor()];
    lab.lobby = 0;
    lab.lift = newLift();
    lab.freight.lvl = 1; lab.freight.left = 0;
    lab.commercial.lvl = 1; lab.commercial.left = 0; lab.commercial.carry = 0;
    lab.managers = {}; lab.assign = {}; lab.hires = { floor: 0, freight: 0, commercial: 0 };
    lab.rate = 0;
    emit("raise", { round: r, mult: SVT.prestigeMult(lab) });
    // Seed round in one lab opens the next location on the map.
    if (lab.round === 1) {
      const list = SVT.playableLabs();
      const i = list.findIndex((l) => l.id === S.activeLab);
      const next = list[i + 1];
      if (next && !S.labs[next.id]) {
        S.labs[next.id] = newLab();
        emit("labUnlocked", { lab: next });
      }
    }
    emit("change");
    save();
    return true;
  };

  SVT.switchLab = (id) => {
    if (!S.labs[id]) return false;
    S.activeLab = id;
    emit("switch");
    save();
    return true;
  };
  SVT.setBuy = (b) => { S.buy = b; emit("change"); };

  // ---------- save / load ----------
  function save() {
    try {
      S.lastSeen = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(S));
    } catch (e) { /* storage unavailable: play continues without saving */ }
  }
  SVT.save = save;
  SVT.reset = () => {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    S = newState();
    emit("switch");
  };
  // v0.2-v0.4 saves kept one manager per node; move them into the Owned list, still assigned.
  const OLD_RANKS = { junior: "common", senior: "rare", vp: "epic" };
  function migrateV2(d) {
    for (const id in d.labs) {
      const lab = d.labs[id];
      lab.managers = {}; lab.assign = {}; lab.hires = { floor: 0, freight: 0, commercial: 0 }; lab.nextMgr = 1;
      const add = (m, role, key) => {
        if (!m) return;
        m.rank = OLD_RANKS[m.rank] || m.rank;
        const mm = Object.assign({ id: lab.nextMgr++, role, name: SVT.MANAGER_NAMES[(lab.nextMgr * 7) % SVT.MANAGER_NAMES.length], paid: B.hireCost(role, 0) }, m);
        lab.managers[mm.id] = mm; lab.assign[key] = mm.id; lab.hires[role]++;
      };
      Object.keys(lab.floorMgr || {}).forEach((n) => add(lab.floorMgr[n], "floor", "floor:" + n));
      add(lab.freight && lab.freight.mgr, "freight", "freight");
      add(lab.commercial && lab.commercial.mgr, "commercial", "commercial");
      delete lab.floorMgr; delete lab.floorHires;
      if (lab.freight) { delete lab.freight.mgr; delete lab.freight.hires; }
      if (lab.commercial) { delete lab.commercial.mgr; delete lab.commercial.hires; }
    }
    d.v = 3;
    return d;
  }

  SVT.load = () => {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) {}
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d && d.v === 2 && d.labs && d.labs.garage) S = migrateV2(d);
        else if (d && d.v === 3 && d.labs && d.labs.garage) S = d;
      } catch (e) {}
    }
    if (S.buy === 100) S.buy = 50; // v0.6 buy chips are ×1, ×10, ×50, Max
    return applyOffline();
  };

  // Debug and test hooks (used by the browser test).
  SVT.debug = {
    addCash: (x) => { SVT.lab().cash += x; emit("change"); },
    setState: (d) => { S = d; emit("switch"); },
  };

  SVT.start = () => {
    let last = performance.now();
    setInterval(() => {
      const t = performance.now();
      const dt = Math.min(B.OFFLINE_CAP, (t - last) / 1000);
      last = t;
      SVT.tick(dt);
    }, 100);
    setInterval(save, 10000);
    document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
    window.addEventListener("pagehide", save);
  };
})();
