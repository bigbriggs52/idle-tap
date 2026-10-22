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
  function newLab(id) {
    return {
      id, cash: B.START_CASH, lifetime: 0, round: 0,
      floors: [newFloor()],
      // Owned managers by id, which slot each one works ("floor:3", "freight", "commercial"), hires this round by role.
      managers: {}, assign: {}, hires: { floor: 0, freight: 0, commercial: 0 }, nextMgr: 1,
      freight: newNode(), commercial: newNode(), lobby: 0, rate: 0, lift: newLift(),
    };
  }
  // The lift's trip: y is its depth in floors (0 = surface). It goes down floor by floor, loads, and turns back when full.
  function newLift() { return { phase: "idle", y: 0, load: 0, timer: 0, at: 0 }; }
  function newRush() { return { mult: 1, until: 0, next: 0, best: 0, runs: 0 }; }
  // Tech Vault: coins per lab (earned by beating it), how many times each lab was beaten, the items rolled so far,
  // the pity counter (coins spent since the last Legendary or better), the lab being replayed, and the items Chip
  // wears on the home screen (slot -> item id).
  function newVault() { return { coins: {}, beats: {}, items: [], pity: 0, spent: 0, serial: 0, replay: null, show: {} }; }
  function newState() {
    return { v: 3, activeLab: "garage", buy: "next", labs: { garage: newLab("garage") }, raid: { cleared: 0 }, rush: newRush(), vault: newVault(), lastSeen: Date.now(), seenIntro: false };
  }

  let S = newState();
  SVT.state = () => S;
  SVT.playableLabs = () => SVT.LABS.filter((l) => !l.soon);
  SVT.labDef = (id) => (id === "raid" ? SVT.RAID.def(S.labs.raid ? S.labs.raid.stage : 1) : SVT.LABS.find((l) => l.id === id));
  SVT.lab = (id) => S.labs[id || S.activeLab];

  // Five labs are open at a time. Labs 2-5 open when the lab before raises Seed; from lab 6 on, beating a lab
  // (raising its IPO) opens the lab five places after it, so a finished lab hands its slot on.
  SVT.OPEN_LABS = 5;
  SVT.labUnlocked = (id) => !!S.labs[id];
  SVT.labIndex = (id) => SVT.LABS.findIndex((l) => l.id === id);
  SVT.labBeaten = (lab) => !!lab && !SVT.isRaid(lab) && lab.round >= B.ROUNDS.length;
  // Ever beaten (a replay in progress still counts); labBeaten means closed right now.
  SVT.labDone = (id) => (S.vault.beats[id] || 0) > 0;
  SVT.labReplaying = (lab) => !!lab && !!lab.replay && !SVT.labBeaten(lab);
  SVT.labsDone = () => SVT.LABS.filter((l) => SVT.labDone(l.id)).length;
  SVT.labGate = (id) => {
    const i = SVT.labIndex(id);
    if (i <= 0) return null;
    return i < SVT.OPEN_LABS ? { from: SVT.LABS[i - 1], round: 1 } : { from: SVT.LABS[i - SVT.OPEN_LABS], round: B.ROUNDS.length };
  };
  SVT.labRequirement = (id) => {
    const g = SVT.labGate(id);
    if (!g) return null;
    return g.round === 1 ? "Raise Seed funding in " + g.from.name : "Beat " + g.from.name + " (raise its IPO)";
  };
  // Opens every lab whose gate is met. Returns the labs it opened.
  function openLabs() {
    const opened = [];
    SVT.LABS.forEach((l) => {
      const g = SVT.labGate(l.id), from = g && S.labs[g.from.id];
      // A lab being replayed has started over, but it already met the gate once.
      if (g && !S.labs[l.id] && from && (from.round >= g.round || (g.round > 1 && SVT.labDone(from.id)))) { S.labs[l.id] = newLab(l.id); opened.push(l); }
    });
    return opened;
  }

  // ---------- difficulty ----------
  // Each lab multiplies its prices: floor n costs scale x grow^(n-1), hubs and managers cost scale x.
  SVT.labDiff = (lab) => (SVT.isRaid(lab) ? SVT.RAID.stage(lab.stage).diff : B.LAB_DIFF[lab && lab.id] || B.LAB_DIFF.garage);
  SVT.costScale = (lab, kind, n) => {
    const d = SVT.labDiff(lab);
    return kind === "floor" ? d.scale * Math.pow(d.grow, n - 1) : d.scale;
  };
  SVT.newLab = newLab;

  // ---------- Assembly Line Rush ----------
  // The mini game's reward: a timed multiplier on every part of every lab (Viking Raid is left out).
  SVT.rushMult = (t) => (S.rush && S.rush.until > (t || now()) ? S.rush.mult : 1);
  SVT.rushLeft = () => Math.max(0, (S.rush.until || 0) - now());
  SVT.rushWait = () => Math.max(0, (S.rush.next || 0) - now());
  SVT.rushTier = (score) => B.RUSH.TIERS.filter((x) => score >= x.score).pop() || null;
  // Ends a run: starts the cooldown and gives the boost the score earned. Returns { tier, applied }.
  SVT.finishRush = (score) => {
    const R = S.rush, t = now(), tier = SVT.rushTier(score);
    R.next = t + B.RUSH.COOLDOWN;
    R.best = Math.max(R.best || 0, score);
    R.runs = (R.runs || 0) + 1;
    let applied = false;
    if (tier && (SVT.rushMult(t) < tier.mult || (SVT.rushMult(t) === tier.mult && R.until < t + tier.minutes * 60))) {
      R.mult = tier.mult; R.until = t + tier.minutes * 60; applied = true;
    }
    emit("rush", { score, tier, applied });
    save();
    return { tier, applied };
  };

  // ---------- Tech Vault coins and lab replay ----------
  SVT.vaultCoins = (id) => (id ? S.vault.coins[id] || 0 : Object.values(S.vault.coins).reduce((a, b) => a + b, 0));
  // Beating a lab pays one coin stamped with that lab. Labs beaten before the Vault existed pay theirs on load.
  function payCoin(id) {
    S.vault.coins[id] = (S.vault.coins[id] || 0) + 1;
    S.vault.beats[id] = (S.vault.beats[id] || 0) + 1;
  }
  // Replay: a beaten lab starts over from scratch in its own bonus slot (one replay at a time) and pays another
  // coin when its IPO is raised again. The trophy stays: the lab counts as done the whole time.
  SVT.canReplay = (id) => SVT.labBeaten(S.labs[id]) && (!S.vault.replay || !SVT.labReplaying(S.labs[S.vault.replay]));
  SVT.replayLab = (id) => {
    if (!SVT.canReplay(id)) return false;
    const lab = newLab(id);
    lab.replay = true;
    S.labs[id] = lab;
    S.vault.replay = id;
    S.activeLab = id;
    emit("switch");
    save();
    return true;
  };

  // ---------- Viking Raid ----------
  SVT.isRaid = (lab) => !!lab && lab.id === "raid";
  SVT.raidStage = (lab) => SVT.RAID.stage(lab.stage);
  SVT.raidNext = () => Math.min(SVT.RAID.STAGES, S.raid.cleared + 1);
  // Raid shafts, lift and warehouse stop at the stage's max level; labs use the normal caps.
  SVT.maxLevel = (lab, kind) => (SVT.isRaid(lab) ? SVT.raidStage(lab).max : B.maxLevel(kind));
  // A stage is cleared by opening every shaft and taking every shaft, the lift and the warehouse to max level.
  SVT.raidProgress = (lab) => {
    const st = SVT.raidStage(lab), max = st.max, total = (st.floors + 2) * (max - 1) + (st.floors - 1);
    let done = lab.floors.length - 1 + Math.min(max, lab.freight.lvl) - 1 + Math.min(max, lab.commercial.lvl) - 1;
    lab.floors.forEach((f) => (done += Math.min(max, f.lvl) - 1));
    return { done, total, p: done / total };
  };
  // Starts a stage from scratch. Only cleared stages and the next one can be raided.
  SVT.startRaid = (s) => {
    if (!(s >= 1 && s <= SVT.raidNext())) return false;
    const lab = newLab("raid");
    lab.stage = s; lab.won = false;
    S.labs.raid = lab;
    S.activeLab = "raid";
    emit("switch");
    save();
    return true;
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
    // Viking Raid omens tilt each part of the mine; managers there only automate (no abilities).
    const omen = SVT.isRaid(lab) ? SVT.raidStage(lab).mult[kind] : SVT.rushMult(t);
    if (!m) return omen;
    const r = SVT.rank(m.rank);
    let x = (1 + r.passive) * omen;
    if (SVT.isRaid(lab)) return x;
    const ab = SVT.ability(roleOf(kind), m.ability);
    if (ab.kind === "boost" && m.activeUntil > (t || now())) x *= r.boost;
    return x;
  };
  SVT.discount = (lab, kind, n, t) => {
    const m = SVT.mgrOf(lab, kind, n);
    if (!m || SVT.isRaid(lab)) return 0;
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
      // The empty cart reaches the lift halfway through the trip and loads there, then is paid back at the warehouse.
      const half = B.WH_TRIP / 2;
      if (!c.loaded && c.left > half) {
        if (c.left - half > dt) { c.left -= dt; return earned; }
        dt -= c.left - half; c.left = half;
        const take = Math.min(lab.lobby, SVT.shipLoad(lab, t));
        lab.lobby -= take; c.carry = take; c.loaded = true;
        continue;
      }
      if (c.left > dt) { c.left -= dt; return earned; }
      dt -= c.left; c.left = 0;
      earned += c.carry || 0; lab.cash += c.carry || 0; lab.lifetime += c.carry || 0; c.carry = 0;
    }
    return earned;
  }
  SVT.shipLoad = (lab, t) => B.commercialCap(lab.commercial.lvl) * SVT.prestigeMult(lab) * SVT.nodeMult(lab, "commercial", 0, t) * B.WH_TRIP;
  // A trip starts at the warehouse: the worker pushes the empty cart to the lift, loads up, and pushes it back.
  SVT.startShip = (lab) => {
    const c = lab.commercial;
    c.carry = 0; c.loaded = false; c.left = B.WH_TRIP;
  };
  function tickLab(lab, dt, t) {
    lab.floors.forEach((f, i) => stepFloor(lab, f, i + 1, dt, t));
    stepLift(lab, dt, t);
    const earned = stepWarehouse(lab, dt, t);
    const a = Math.min(1, dt / 8); // income arrives per trip, so smooth over a few trips
    lab.rate = lab.rate * (1 - a) + (earned / dt) * a;
    if (SVT.isRaid(lab) && !lab.won && SVT.raidProgress(lab).p >= 1) {
      lab.won = true;
      S.raid.cleared = Math.max(S.raid.cleared, lab.stage);
      emit("raidClear", { stage: lab.stage });
    }
    return earned;
  }
  // Long gaps (app in background) are replayed in 1-second steps so nothing is lost.
  SVT.tick = (dt) => {
    const t = now();
    for (const id in S.labs) {
      if (SVT.labBeaten(S.labs[id])) continue; // beaten labs are closed
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
      if (SVT.labBeaten(lab)) continue;
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

  // ×10 and ×50 round up to the next multiple, like Idle Miner: Lv 56 ×10 buys 4 (to 60), Lv 60 ×10 buys 10 (to 70).
  SVT.stepTo = (lv, step) => step - (lv % step);
  // "next" buys up to the next unlock: unlocks come every 5 levels (and the big milestones 10, 25, 50... are on them).
  SVT.buyAmount = (lv) => (S.buy === "max" ? Infinity : S.buy === "next" ? SVT.stepTo(lv || 0, 5) : S.buy === 1 ? 1 : SVT.stepTo(lv || 0, S.buy));
  SVT.quote = (lab, kind, n) => {
    const L = SVT.levelOf(lab, kind, n);
    return B.bulk(kind, n, L, SVT.buyAmount(L), lab.cash, SVT.discount(lab, kind, n), SVT.costScale(lab, kind, n), SVT.maxLevel(lab, kind));
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
    if (n > (SVT.isRaid(lab) ? SVT.raidStage(lab).floors : B.FLOORS)) return null;
    const wall = SVT.isRaid(lab) ? undefined : B.WALLS[n];
    const blocked = wall !== undefined && lab.round <= wall;
    return { n, cost: B.unlockCost(n) * SVT.costScale(lab, "floor", n), blocked, round: blocked ? B.ROUNDS[wall] : null };
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
  SVT.hireCost = (lab, role) => B.hireCost(role, lab.hires[role]) * SVT.costScale(lab, role, 1);
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
    if (!m || m.cdUntil > t || SVT.isRaid(lab)) return false;
    const ab = SVT.ability(roleOf(kind), m.ability);
    const dur = ab.kind === "boost" ? B.BOOST_SECONDS : B.DISCOUNT_SECONDS;
    m.activeUntil = t + dur;
    m.cdUntil = m.activeUntil + SVT.rank(m.rank).cooldown;
    emit("ability", { kind, n });
    emit("change");
    return true;
  };

  // Funding rounds: the prestige reset. Each round needs a floor reached and resets the lab, managers included.
  SVT.nextRound = (lab) => (!SVT.isRaid(lab) && lab.round < B.ROUNDS.length ? B.ROUNDS[lab.round] : null);
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
    lab.commercial.lvl = 1; lab.commercial.left = 0; lab.commercial.carry = 0; lab.commercial.loaded = false;
    lab.managers = {}; lab.assign = {}; lab.hires = { floor: 0, freight: 0, commercial: 0 };
    lab.rate = 0;
    emit("raise", { round: r, mult: SVT.prestigeMult(lab) });
    // Seed (labs 1-4) or IPO (any lab) can open a new location on the map.
    openLabs().forEach((l) => emit("labUnlocked", { lab: l }));
    // Raising the IPO beats the lab: it closes for good (🏆 on the map) and play moves to another open lab.
    if (SVT.labBeaten(lab)) {
      const replay = !!lab.replay;
      delete lab.replay;
      if (S.vault.replay === lab.id) S.vault.replay = null;
      payCoin(lab.id);
      const next = SVT.LABS.find((l) => S.labs[l.id] && !SVT.labBeaten(S.labs[l.id]));
      if (next) S.activeLab = next.id;
      emit("labBeaten", { lab: SVT.labDef(lab.id), replay, coins: SVT.vaultCoins(lab.id) });
    }
    emit("change");
    save();
    return true;
  };

  SVT.switchLab = (id) => {
    if (!S.labs[id] || SVT.labBeaten(S.labs[id])) return false;
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
    if (!S.raid) S.raid = { cleared: 0 }; // v0.12 adds the Viking Raid island
    if (!S.rush) S.rush = newRush(); // v0.16 adds Assembly Line Rush
    if (!S.vault) S.vault = newVault(); // v0.17 adds the Tech Vault
    if (!S.vault.show || typeof S.vault.show !== "object") S.vault.show = {};
    for (const id in S.labs) {
      const lab = S.labs[id];
      lab.id = id;
      if (lab.commercial.carry > 0 && lab.commercial.loaded === undefined) lab.commercial.loaded = true; // pre-v0.12.1 trip in flight
    }
    if (!S.labs[S.activeLab]) S.activeLab = "garage";
    // Labs beaten before v0.17 pay their coin now.
    for (const id in S.labs) if (SVT.labBeaten(S.labs[id]) && !SVT.labDone(id)) payCoin(id);
    if (S.vault.replay && !SVT.labReplaying(S.labs[S.vault.replay])) S.vault.replay = null;
    openLabs();
    if (SVT.labBeaten(S.labs[S.activeLab])) { const l = SVT.LABS.find((x) => S.labs[x.id] && !SVT.labBeaten(S.labs[x.id])); if (l) S.activeLab = l.id; }
    return applyOffline();
  };

  // Debug and test hooks (used by the browser test).
  SVT.debug = {
    addCash: (x) => { SVT.lab().cash += x; emit("change"); },
    setState: (d) => { S = d; emit("switch"); },
  };

  // SVT.step() advances the game by the real time since the last step. The UI calls it every animation frame;
  // a slow timer keeps it going when frames stop (hidden tab).
  let last = 0;
  SVT.step = () => {
    const t = performance.now();
    if (!last) last = t;
    const dt = Math.min(B.OFFLINE_CAP, (t - last) / 1000);
    if (dt <= 0) return;
    last = t;
    SVT.tick(dt);
  };
  SVT.start = () => {
    last = performance.now();
    setInterval(() => { if (performance.now() - last > 400) SVT.step(); }, 500);
    setInterval(save, 10000);
    document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
    window.addEventListener("pagehide", save);
  };
})();
