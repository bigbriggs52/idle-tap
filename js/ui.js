// Rendering and input. The DOM is rebuilt on structural changes; numbers refresh through binds.
window.SVT = window.SVT || {};

(function () {
  const B = SVT.B, fmt = SVT.fmt;
  let binds = [], frames = [];
  let view = "lab";

  // ---------- tiny DOM helpers ----------
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    kids.flat().forEach((c) => { if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  }
  // bind(el, fn): fn(el) runs every UI frame; keep it cheap.
  const bind = (e, fn) => { binds.push({ e, fn }); return e; };
  // onFrame(el, fn): fn(el) runs every animation frame, for things that move (lift car, cart, progress bars).
  // Only write transforms here so the browser can move them without re-laying out the page.
  const onFrame = (e, fn) => { frames.push({ e, fn }); return e; };
  const setText = (e, t) => { if (e.textContent !== t) e.textContent = t; };
  // popText: like setText, but a changed value gives a quick pop so you see it change (skipped on first fill).
  const popText = (e, t) => {
    if (e.textContent === t) return;
    const had = e.textContent !== "";
    e.textContent = t;
    if (had && e.animate) e.animate([{ transform: "scale(1.3)" }, { transform: "scale(1)" }], { duration: 220, easing: "cubic-bezier(.2,.8,.3,1.2)" });
  };
  const setDisabled = (e, d) => { if (e.disabled !== d) e.disabled = d; };
  const toggle = (e, c, on) => e.classList.toggle(c, !!on);

  const app = () => document.getElementById("app");
  const lab = () => SVT.lab();
  const def = () => SVT.labDef(SVT.state().activeLab);

  function productName(n) { return def().products[n - 1]; }
  function teamName(n) { return def().teams[B.tierOf(n)]; }
  function tierName(n) { const d = def(); return d.tiers ? d.tiers[B.tierOf(n)] : SVT.TIERS[B.tierOf(n)].name; }
  const inRaid = () => SVT.isRaid(lab());
  function teamSize(L) {
    let c = 1;
    for (const k in B.FLOOR_MILESTONES) if (L >= +k) c++;
    return Math.min(c, 6);
  }
  function nextUnlock(kind, L) {
    const ms = kind === "floor" ? B.FLOOR_MILESTONES : B.HUB_MILESTONES;
    const step = kind === "floor" ? B.FLOOR_STEP : B.HUB_STEP;
    const next = Math.floor(L / 5) * 5 + 5;
    return { lvl: next, mult: ms[next] || step, big: !!ms[next], from: next - 5 };
  }
  function multLabel(m) { return m >= 1.5 ? "×" + m : "+" + Math.round((m - 1) * 100) + "%"; }

  // Version plus release date and time, e.g. V0.10.2.10.21.26.18:05 (MM.DD.YY.HH:MM, local time).
  function buildTag() {
    const d = new Date(B.BUILT), p = (n) => String(n).padStart(2, "0");
    if (isNaN(d)) return "V" + B.VERSION;
    return "V" + B.VERSION + "." + p(d.getMonth() + 1) + "." + p(d.getDate()) + "." + p(d.getFullYear() % 100) + "." + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  SVT.buildTag = buildTag;

  // ---------- toasts ----------
  function toast(msg, kind) {
    const box = document.getElementById("toasts");
    const t = h("div", { class: "toast " + (kind || "") , role: "status" }, msg);
    box.append(t);
    while (box.children.length > 2) box.firstChild.remove();
    setTimeout(() => t.classList.add("out"), 2200);
    setTimeout(() => t.remove(), 2600);
  }
  SVT.toast = toast;
  SVT.ui = { h, toast };

  // ---------- sheets (modals) ----------
  // Idle Miner-style panel. opts: nav { prev, next, pos, dir } adds side arrows, swipes and arrow keys;
  // icon goes before the title; tools sit top right by the close button; foot stays pinned under the scrolling body; sticky hides the close button.
  let curNav = null;
  function sheet(title, body, opts) {
    // Rebuilding a panel that is already open (hire, assign, sell, buy) swaps it in place with no spring, so the
    // screen does not jump on every tap. Only a panel opened fresh, or swiped to, animates in.
    const wasOpen = !!document.getElementById("sheet");
    closeSheet();
    opts = opts || {};
    const nav = opts.nav;
    const label = typeof title === "string" ? title : opts.label || "";
    const box = h("div", { class: "sheet" + (nav && nav.dir ? (nav.dir > 0 ? " from-r" : " from-l") : wasOpen ? " still" : ""), role: "dialog", "aria-label": label },
      h("div", { class: "sheet-head" },
        opts.icon ? h("span", { class: "sheet-icon", "aria-hidden": "true", text: opts.icon }) : null,
        h("div", { class: "sheet-title" }, h("h2", null, title), nav && nav.pos ? h("span", { class: "muted small", text: nav.pos }) : null),
        opts.tools || null,
        opts.sticky ? null : h("button", { class: "x-btn", "aria-label": "Close", onclick: closeSheet, text: "✕" })),
      body,
      opts.foot || null,
      nav ? h("button", { class: "side-arrow prev", "aria-label": "Previous", onclick: nav.prev, text: "‹" }) : null,
      nav ? h("button", { class: "side-arrow next", "aria-label": "Next", onclick: nav.next, text: "›" }) : null);
    if (nav) {
      let x0 = null, y0 = 0;
      box.addEventListener("touchstart", (e) => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
      box.addEventListener("touchend", (e) => {
        if (x0 == null) return;
        const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) (dx < 0 ? nav.next : nav.prev)();
      });
    }
    const wrap = h("div", { class: "sheet-wrap", id: "sheet", onclick: (e) => { if (e.target.id === "sheet" && !opts.sticky) closeSheet(); } }, box);
    document.body.append(wrap);
    curNav = nav || null;
  }
  function closeSheet() {
    const s = document.getElementById("sheet");
    detail = null; curNav = null;
    if (!s) return;
    s.remove();
    binds = binds.filter((b) => !s.contains(b.e));
  }
  document.addEventListener("keydown", (e) => {
    if (!curNav) return;
    if (e.key === "ArrowLeft") curNav.prev();
    if (e.key === "ArrowRight") curNav.next();
  });

  // ---------- header ----------
  function header() {
    const d = def();
    const cash = bind(h("b", { class: "cash" }), (e) => setText(e, "$" + fmt(lab().cash)));
    const rate = bind(h("span", { class: "rate" }), (e) => setText(e, "+$" + fmt(lab().rate) + "/s"));
    const roundBadge = bind(h("span", { class: "badge" }), (e) => {
      const L = lab(), r = L.round;
      if (SVT.isRaid(L)) {
        setText(e, "Stage " + L.stage + " of " + SVT.RAID.STAGES);
        return;
      }
      setText(e, r === 0 ? "Bootstrapped" : B.ROUNDS[r - 1].name + " ×" + SVT.prestigeMult(L));
    });
    return h("header", { class: "top" },
      h("div", { class: "lab-title" }, h("span", { class: "lab-icon", text: d.icon }), h("div", null, h("b", { text: d.name }), roundBadge)),
      h("div", { class: "cash-pill" }, h("span", { class: "coin big", "aria-hidden": "true", text: "$" }), h("div", null, h("span", { class: "cash-label", text: "Cash" }), cash, rate)),
      h("button", { class: "home-btn", "aria-label": "Home screen", onclick: () => setView("home"), text: "🏠" }),
      inRaid() ? goalBar() : null);
  }
  // Viking Raid: upgrades bought this stage against everything needed to max the mine.
  function goalBar() {
    const fill = h("i", { class: "goal-fill" }), txt = h("span");
    return bind(h("div", { class: "goal-bar" }, fill, txt), (e) => {
      const L = lab(), pr = SVT.raidProgress(L), p = Math.min(1, pr.p);
      toggle(e, "won", L.won);
      setText(txt, L.won ? "🎯 Stage cleared! Open Stages for the next raid" : "🎯 Shafts to Lv " + SVT.raidStage(L).max.floor + ", lift and warehouse to Lv " + SVT.raidStage(L).max.freight + " · " + Math.floor(p * 100) + "%");
      const v = "scaleX(" + p.toFixed(4) + ")";
      if (fill.style.transform !== v) fill.style.transform = v;
    });
  }

  // Saves, asks for a new service worker, then reloads. If a new version is installing, index.html reloads when it takes over.
  async function checkUpdate() {
    toast("Checking for updates…");
    SVT.save();
    let waiting = false;
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg) { await reg.update(); waiting = !!(reg.installing || reg.waiting); }
    } catch (e) {}
    setTimeout(() => location.reload(), waiting ? 3000 : 300);
  }
  SVT.checkUpdate = checkUpdate;

  // Bottom bar, like Idle Miner Tycoon's: the screens you jump to most.
  // Assembly Line Rush button: shows the boost countdown while one is running, and glows when a run is ready.
  function rushNav(item) {
    const b = item("🏭", "Rush", SVT.openRush, { class: "nav-btn rush-nav", "aria-label": "Assembly Line Rush mini game" });
    const label = b.lastChild;
    return bind(b, (e) => {
      const left = SVT.rushLeft();
      setText(label, left > 0 ? "×" + SVT.state().rush.mult + " " + SVT.rushClock(left) : "Rush");
      toggle(e, "ready", !SVT.rushWait() && !left);
      toggle(e, "boosted", left > 0);
    });
  }
  function bottomNav() {
    const item = (icon, label, on, attrs) => h("button", Object.assign({ class: "nav-btn", onclick: on }, attrs), h("span", { class: "nav-ic", "aria-hidden": "true", text: icon }), h("span", { text: label }));
    // In Viking Raid there is no funding: the first button opens the stage list instead.
    const fund = inRaid()
      ? bind(item("🛡", "Stages", openRaid, { class: "nav-btn fund" }), (e) => toggle(e, "ready", !!lab().won))
      : bind(item("💰", "Funding", openFunding, { class: "nav-btn fund" }), (e) => toggle(e, "ready", SVT.canRaise(lab())));
    // Map sits in the middle as the big green button.
    return h("nav", { class: "bottom-nav", "aria-label": "Main" },
      fund,
      item("👔", "Managers", () => openManagers("floor", null, 0), { "aria-label": "Owned managers" }),
      item("🗺", "Map", () => setView("map"), { class: "nav-btn center" }),
      rushNav(item),
      item("⚙", "Settings", openSettings, { "aria-label": "Settings" }));
  }

  // ---------- managers ----------
  const roleOf = (kind) => kind;
  // Job title from the lab's theme (v0.30): a floor manager in the Arcade District is a Cabinet Builder.
  const CREW_IDX = { floor: 0, freight: 1, commercial: 2 };
  const crewTitle = (role) => ((def().crew || [])[CREW_IDX[role]]) || B.ROLE_NAMES[role];
  const secs = (x) => (x >= 60 && x % 60 === 0 ? x / 60 + " min" : x + " s");
  function effectText(m) {
    const ab = SVT.ability(m.role, m.ability), st = SVT.abilityStats(m);
    if (ab.kind === "special") return ab.icon + " " + secs(st.active) + " · " + secs(st.cooldown) + " cooldown. " + ab.text + " Passive: " + ab.passiveText + ".";
    const K = B.ABILITY_KINDS[ab.kind];
    const what = ab.kind === "speed" ? "×" + st.mult + " speed" : ab.kind === "storage" ? "×" + st.mult + " load" : "−" + Math.round(st.off * 100) + "% upgrades";
    return K.icon + " " + ab.name + ": " + what + " for " + secs(st.active) + " · " + secs(st.cooldown) + " cooldown";
  }

  // Manager card: portrait, name, rarity, boost, timer and buttons (Idle Miner's manager list).
  function abilityTimer(m) {
    return bind(h("span", { class: "cd" }), (e) => {
      const t = SVT.now();
      setText(e, m.activeUntil > t ? "⚡ Active " + SVT.fmtTime(m.activeUntil - t) : m.cdUntil > t ? "⏱ " + SVT.fmtTime(m.cdUntil - t) : "⚡ Ready");
    });
  }
  function mgrCard(m, o) {
    const r = SVT.rank(m.rank);
    return h("li", { class: "mcard r-" + m.rank + (o.busy ? " busy" : "") + (o.assigned ? " assigned" : "") },
      h("div", { class: "portrait" }, avatar(m), o.assigned ? h("span", { class: "tagline", text: "Assigned" }) : null),
      h("div", { class: "minfo" },
        h("b", { text: m.name }), h("span", { class: "rarity", text: r.name + " · " + (SVT.isSuper(m) ? SVT.abilityOf(m).name : crewTitle(m.role)) }),
        h("span", { class: "boost-text", text: effectText(m) }), abilityTimer(m),
        o.where ? h("span", { class: "where", text: o.where }) : null),
      h("div", { class: "mbtns" }, o.buttons));
  }

  // The managers panel. With a slot (kind, n) it is that slot's panel: assigned manager on top, owned cards with
  // Assign below, ‹ › to the next slot. Without one it is the roster for a role. Hire is pinned at the bottom.
  let mgrType = "all"; // ability-type filter on the manager panels: "all", "speed", "storage" or "discount" (price)
  const MGR_TYPES = [["all", "✨", "All"]].concat(Object.keys(B.ABILITY_KINDS).map((k) => [k, B.ABILITY_KINDS[k].icon, B.ABILITY_KINDS[k].name]));
  function openManagers(role, kind, n, _back, dir) {
    sheetCtx = { role, kind, n };
    const L = lab();
    const here = kind ? SVT.slotKey(kind, n) : null;
    const reopen = () => openManagers(role, kind, n);
    const current = kind ? SVT.mgrOf(L, kind, n) : null;
    // Free managers first, then managers busy elsewhere (greyed out at the bottom). Within each, grouped by ability
    // type (speed, storage, then price) with the best rarity at the top of each group. SVT.owned is already in
    // rarity order, so the index keeps that inside a group.
    const busy = (m) => !!SVT.slotOfMgr(L, m.id);
    const KIND = { special: 0, speed: 1, storage: 2, discount: 3 }, kindOf = (m) => SVT.ability(m.role, m.ability).kind;
    const list = SVT.owned(L, role).filter((m) => m !== current && (mgrType === "all" || kindOf(m) === mgrType)).map((m, i) => [m, i])
      .sort((a, b) => busy(a[0]) - busy(b[0]) || KIND[kindOf(a[0])] - KIND[kindOf(b[0])] || a[1] - b[1]).map((x) => x[0]);
    const GROUP = { special: "🌟 Super managers: game changers", speed: "⚡ Speed: runs faster", storage: "📦 Storage: bigger loads", discount: "💸 Price: cheaper upgrades" };
    let lastGroup = null;
    const cards = list.flatMap((m) => {
      const key = (busy(m) ? "busy-" : "free-") + kindOf(m);
      const head = mgrType === "all" && key !== lastGroup ? h("li", { class: "mgroup", text: GROUP[kindOf(m)] + (busy(m) ? " (in use)" : "") }) : null;
      lastGroup = key;
      return [head, mgrRow(m)].filter(Boolean);
    });
    function mgrRow(m) {
      const slot = SVT.slotOfMgr(L, m.id), btns = [];
      if (here && !slot) btns.push(h("button", { class: "btn use", onclick: () => { SVT.assign(m.id, kind, n); toast(m.name + " now runs " + SVT.slotName(here)); reopen(); }, text: "Assign" }));
      if (slot) btns.push(h("button", { class: "btn small ghost", onclick: () => { SVT.unassign(m.id); reopen(); }, text: "Unassign" }));
      else btns.push(h("button", { class: "btn small ghost sell", onclick: () => { SVT.sell(m.id); reopen(); }, text: "Sell $" + fmt(m.paid * B.SELL_REFUND) }));
      return mgrCard(m, { busy: !!slot, where: slot ? "In use on " + SVT.slotName(slot) : null, buttons: btns });
    }
    const parts = [];
    if (here) {
      let top;
      if (current) {
        const use = bind(h("button", { class: "btn ability", onclick: () => SVT.activate(kind, n) }), (e) => {
          const t = SVT.now(), ready = !(current.activeUntil > t) && !(current.cdUntil > t);
          setText(e, ready ? "⚡ Use" : "⚡"); setDisabled(e, !ready);
        });
        top = mgrCard(current, { assigned: true, buttons: [h("button", { class: "btn unassign", onclick: () => { SVT.unassign(current.id); reopen(); }, text: "Unassign" }), use] });
      } else top = h("li", { class: "mcard empty-slot" }, h("div", { class: "portrait" }, h("span", { class: "plus", text: "+" })), h("div", { class: "minfo" }, h("b", { text: "Nobody yet" }), h("span", { class: "muted", text: "Assign one below or hire a new one." })));
      parts.push(h("div", { class: "sec-label", text: "Assigned manager:" }), h("ul", { class: "mlist" }, top));
    } else {
      parts.push(h("div", { class: "filters", role: "tablist" }, ["floor", "freight", "commercial"].map((ro) =>
        h("button", { class: "filter" + (ro === role ? " on" : ""), role: "tab", "aria-selected": ro === role ? "true" : "false", onclick: () => openManagers(ro, null, 0),
          title: B.ROLE_NAMES[ro] }, h("span", { "aria-hidden": "true", text: { floor: "🏭", freight: "🛗", commercial: "🏬" }[ro] }), h("small", { text: { floor: "Floors", freight: "Lift", commercial: "Warehouse" }[ro] + " " + SVT.owned(L, ro).length })))));
    }
    // v0.31: Auto-assign puts the rarest managers on the deepest floors and the best lift and warehouse managers in.
    const auto = bind(h("button", { class: "btn auto-assign", onclick: () => {
      const r = SVT.autoAssign(); const n = r.floor + r.freight + r.commercial;
      toast(n ? "Auto-assigned " + n + " manager" + (n === 1 ? "" : "s") + ": rarest at the bottom" : "Everyone is already where their rarity puts them");
      reopen();
    } }, h("span", { "aria-hidden": "true", text: "🪄" }), h("span", { text: " Auto-assign: best managers at the bottom" })),
      (e) => setDisabled(e, !Object.keys(L.managers).length));
    parts.push(auto);
    // Ability-type filter: Speed, Storage or Price.
    parts.push(h("div", { class: "filters types", role: "tablist", "aria-label": "Manager type" }, MGR_TYPES.map(([t, ic, label]) =>
      h("button", { class: "filter type" + (t === mgrType ? " on" : ""), role: "tab", "aria-selected": t === mgrType ? "true" : "false", "data-type": t,
        onclick: () => { mgrType = t; openManagers(role, kind, n); } }, h("span", { "aria-hidden": "true", text: ic }), h("small", { text: label + (t === "all" ? "" : " " + SVT.owned(L, role).filter((m) => kindOf(m) === t).length) })))));
    const emptyText = here && current ? "No other " + B.ROLE_NAMES[role] + "s yet." : mgrType !== "all" ? "No " + B.ABILITY_KINDS[mgrType].name.toLowerCase() + " managers here yet." : "None yet. Hire one below.";
    parts.push(h("div", { class: "sec-label", text: here ? "Your " + B.ROLE_NAMES[role] + "s:" : B.ROLE_NAMES[role] + "s:" }),
      h("ul", { class: "mlist" }, cards.length ? cards : h("li", { class: "muted empty", text: emptyText })),
      h("p", { class: "muted small odds", text: "Each hire rolls Legendary 1.5%, Epic 3%, Rare 10%, Uncommon 30% or Common 55.5%. Epic and Legendary hires are super managers with a game-changing ability and a permanent passive. Funding rounds send every manager away." }));
    // Children stay put (only their text changes), so a finger on the button never loses its target mid-tap.
    const hireCost = h("b");
    const hire = bind(h("button", { class: "btn fund-cta big hire", onclick: () => {
      const m = SVT.hire(role);
      if (!m) return;
      // Hiring from a slot's panel puts the new manager straight to work there, unless a rarer one already works it.
      const cur = here ? SVT.mgrOf(lab(), kind, n) : null;
      const put = here && (!cur || SVT.RANK_ORDER[m.rank] <= SVT.RANK_ORDER[cur.rank]);
      if (put) SVT.assign(m.id, kind, n);
      toast("Hired " + SVT.rank(m.rank).name + " " + (SVT.isSuper(m) ? SVT.abilityOf(m).name + " (" + m.name + ")" : crewTitle(role) + " " + m.name) + (put ? " · now runs " + SVT.slotName(here) : ""), "r-" + m.rank);
      reopen();
    } },
      h("span", { text: "Hire manager" }), hireCost),
      (e) => { const c = SVT.hireCost(lab(), role); setText(hireCost, "$" + fmt(c)); setDisabled(e, lab().cash < c); });
    let nav = null;
    if (here) {
      const slots = nodeList(), i = Math.max(0, slots.findIndex(([k, m]) => k === kind && m === n));
      const go = (d) => { const [k, m] = slots[(i + d + slots.length) % slots.length]; openManagers(k, k, m, null, d); };
      nav = { prev: () => go(-1), next: () => go(1), pos: (i + 1) + " of " + slots.length, dir };
    }
    sheet(here ? SVT.slotName(here) + " Manager" : "Managers", h("div", { class: "sheet-body mgr-panel" }, parts),
      { icon: "👔", nav, foot: h("div", { class: "panel-foot" }, hire) });
    update();
  }
  SVT.openManagers = openManagers;

  // ---------- detail sheet (Idle Miner Tycoon's upgrade panel) ----------
  // Same order as the screen: lift, warehouse, then floors top to bottom. Swipe or ‹ › moves through it.
  let detail = null;
  function nodeList() {
    return [["freight", 0], ["commercial", 0]].concat(lab().floors.map((_, i) => ["floor", i + 1]));
  }
  function stepNode(d) {
    if (!detail) return;
    const list = nodeList();
    const i = Math.max(0, list.findIndex(([k, m]) => k === detail.kind && m === detail.n));
    const [k, m] = list[(i + d + list.length) % list.length];
    openNode(k, m, d);
  }
  const multText = (m) => "×" + (m < 1000 ? String(+m.toFixed(2)) : fmt(m));
  // [label, fn(level)] rows, shown at the current level and at the level the upgrade button would reach.
  function nodeStats(kind, n) {
    const P = () => SVT.prestigeMult(lab()), M = () => SVT.nodeMult(lab(), kind, n), depth = () => lab().floors.length;
    if (kind === "floor") return [
      ["Output", (L) => "$" + fmt(B.floorOutput(n, L) * P() * M()) + "/s"],
      ["Per cycle", (L) => { const sp = SVT.speedMult(lab(), kind, n); return "$" + fmt(B.floorOutput(n, L) * P() * M() / sp * B.FLOOR_CYCLE) + " / " + +(B.FLOOR_CYCLE / sp).toFixed(1) + "s"; }],
      ["Team", (L) => teamSize(L) + " " + teamName(n)],
      ["Value per product", () => "$" + fmt(B.floorValue(n) * P())],
      ["Tech unlock bonus", (L) => multText(B.floorMult(L))],
    ];
    if (kind === "freight") return [
      ["Moves", (L) => "$" + fmt(B.freightCap(L, depth()) * P() * M()) + "/s"],
      ["Load per trip", (L) => "$" + fmt(B.freightLoad(L) * P() * M())],
      ["Lift speed", (L) => multText(B.freightSpeed(L))],
      ["Loading speed", (L) => "$" + fmt(B.freightLoad(L) / B.liftFillTime(L) * P() * M()) + "/s"],
      ["Round trip", (L) => (B.freightTrip(L, depth()) / SVT.speedMult(lab(), kind, n)).toFixed(1) + "s"],
      ["Tech unlock bonus", (L) => multText(B.hubMult(L))],
    ];
    return [
      ["Ships", (L) => "$" + fmt(B.commercialCap(L) * P() * M()) + "/s"],
      ["Load per trip", (L) => { const sp = SVT.speedMult(lab(), kind, n); return "$" + fmt(B.commercialCap(L) * P() * M() / sp * B.WH_TRIP) + " / " + +(B.WH_TRIP / sp).toFixed(1) + "s"; }],
      ["Tech unlock bonus", (L) => multText(B.hubMult(L))],
    ];
  }
  // Live numbers that don't depend on level.
  function nodeLive(kind, n) {
    const rows = [];
    if (kind === "floor") {
      rows.push(["Waiting for the lift", () => "$" + fmt(lab().floors[n - 1].stock)]);
      rows.push(["Share of lab output", () => { const r = SVT.rates(lab()); return r.build > 0 ? Math.round(100 * r.floors[n - 1] / r.build) + "%" : "0%"; }]);
    }
    if (kind === "freight") rows.push(["Waiting on floors", () => "$" + fmt(totalWaiting(lab()))]);
    if (kind === "commercial") rows.push(["Waiting to ship", () => "$" + fmt(lab().lobby)]);
    rows.push(["Manager bonus", () => { const m = SVT.nodeMult(lab(), kind, n), a = SVT.activeAbility(lab(), kind, n); return (m > 1 ? multText(m) : "None") + (a && a.kind !== "discount" ? " (" + a.icon + " " + a.name + ")" : ""); }]);
    rows.push(["Prestige bonus", () => multText(SVT.prestigeMult(lab()))]);
    rows.push(["Lab income", () => { const r = SVT.rates(lab()); return "$" + fmt(r.income) + "/s · limited by " + { build: "floors", freight: "lift", commercial: "warehouse" }[r.limit]; }]);
    return rows;
  }
  const STAT_ICON = { "Output": "⚙️", "Per cycle": "🔁", "Team": "👷", "Value per product": "💲", "Tech unlock bonus": "🔬", "Moves": "🛗", "Load per trip": "📦",
    "Lift speed": "⏩", "Loading speed": "⬇️", "Round trip": "⏱️", "Ships": "🚚", "Waiting for the lift": "📦", "Share of lab output": "📊", "Waiting on floors": "📦",
    "Waiting to ship": "🏬", "Manager bonus": "👔", "Prestige bonus": "💰", "Lab income": "💵" };
  function statRow(label, ...val) {
    return h("li", { class: "stat-row" }, h("span", { class: "stat-ic", "aria-hidden": "true", text: STAT_ICON[label] || "•" }),
      h("span", { class: "stat-label", text: label }), h("span", { class: "stat-pill" }, val));
  }
  const nodeName = (kind, n) => (kind === "floor" ? "Floor " + n : kind === "freight" ? "Lift" : "Warehouse");
  function buySeg() {
    return h("div", { class: "seg", role: "group", "aria-label": "Buy amount" },
      [1, 10, "max", "next"].map((b) => bind(h("button", { class: "chip" + (b === "next" ? " next" : ""), onclick: () => SVT.setBuy(b), text: b === "max" ? "Max" : b === "next" ? "Next" : "x" + b,
        "aria-label": b === "next" ? "Buy up to the next unlock" : null }),
        (e) => toggle(e, "on", SVT.state().buy === b))));
  }
  // Big green Level Up button (hold to keep buying).
  function levelUpBtn(kind, n) {
    const top = h("span"), cost = h("b");
    let lastBurst = 0;
    const up = () => {
      const ok = SVT.upgrade(kind, n);
      if (ok && performance.now() - lastBurst > 180) { lastBurst = performance.now(); burst(btn); }
      return ok;
    };
    const btn = h("button", { class: "btn up lvlup" }, top, cost);
    return bind(holdToRepeat(btn, up), (e) => {
      const L = lab(), lv = SVT.levelOf(L, kind, n);
      if (lv >= SVT.maxLevel(lab(), kind)) { setText(top, "Level Up x0"); setText(cost, "MAX"); setDisabled(e, true); return; }
      const q = SVT.quote(L, kind, n);
      setText(top, "Level Up x" + q.count); setText(cost, "$" + fmt(q.cost));
      setDisabled(e, L.cash < q.cost);
      toggle(e, "sale", SVT.discount(L, kind, n) > 0);
    });
  }

  // The Level panel (Idle Miner's upgrade panel): manager card and unlock arrow on top, stat rows with value pills,
  // buy amount and Level Up pinned at the bottom. ‹ ›, swipes and arrow keys move through the lift, warehouse and floors.
  function openNode(kind, n, dir) {
    // Opening the Level panel fresh always starts on Next (up to the next unlock); swiping between nodes keeps the choice.
    if (!dir) SVT.state().buy = "next";
    const list = nodeList();
    const pos = list.findIndex(([k, m]) => k === kind && m === n) + 1;
    const lvNum = h("span", { class: "pop-num" });
    const title = bind(h("span", null, nodeName(kind, n) + " Level ", lvNum), () => popText(lvNum, String(SVT.levelOf(lab(), kind, n))));
    const card = h("button", { class: "node-card", "aria-label": "Manager", onclick: () => openManagers(kind, kind, n) });
    let cardKey = null;
    bind(card, () => {
      const m = SVT.mgrOf(lab(), kind, n), key = m ? m.id + m.rank : "none";
      if (key === cardKey) return;
      cardKey = key;
      card.className = "node-card" + (m ? " r-" + m.rank : " empty");
      card.replaceChildren(m ? avatar(m) : h("span", { class: "plus", text: "+" }), h("span", { class: "node-card-label", text: m ? SVT.rank(m.rank).name : "Manager" }));
    });
    const fill = h("span", { class: "fill" }), prog = h("span", { class: "prog-label" });
    bind(prog, () => {
      const lv = SVT.levelOf(lab(), kind, n), u = nextUnlock(kind, lv), max = lv >= SVT.maxLevel(lab(), kind);
      fill.style.width = (max ? 100 : Math.max(4, Math.min(100, ((lv - u.from) / 5) * 100))) + "%";
      setText(prog, max ? "Max level reached." : "Next at Lv " + u.lvl + ": " + multLabel(u.mult) + (u.big ? " milestone" : ""));
    });
    const stats = nodeStats(kind, n).map(([label, f]) => {
      const now = h("b"), up = h("small", { class: "up" });
      bind(now, () => {
        const lv = SVT.levelOf(lab(), kind, n), q = SVT.quote(lab(), kind, n);
        const a = f(lv), b = lv >= SVT.maxLevel(lab(), kind) || !q.count ? a : f(lv + q.count);
        popText(now, a); setText(up, b !== a ? "→ " + b : ""); up.hidden = b === a;
      });
      return statRow(label, now, up);
    });
    const live = nodeLive(kind, n).map(([label, f]) => statRow(label, bind(h("b"), (e) => setText(e, f()))));
    const sub = kind === "floor" ? productName(n) + " · " + tierName(n) : kind === "freight" ? "Freight Hub: brings products up from the floors" : "Commercial Hub: sells what the lift brings up";
    sheet(title, h("div", { class: "sheet-body node-sheet" },
      h("div", { class: "node-top" }, card, h("div", { class: "prog" }, h("span", { class: "prog-bar" }, h("span", { class: "prog-arrow", "aria-hidden": "true" }), fill), prog, h("span", { class: "muted small", text: sub }))),
      h("ul", { class: "stat-list" }, stats),
      h("ul", { class: "stat-list live" }, live)),
      { label: nodeName(kind, n) + " level", icon: kind === "floor" ? "🏭" : kind === "freight" ? "🛗" : "🏬",
        nav: { prev: () => stepNode(-1), next: () => stepNode(1), pos: pos + " of " + list.length, dir },
        foot: h("div", { class: "panel-foot" }, buySeg(), levelUpBtn(kind, n)) });
    detail = { kind, n };
    update();
  }
  SVT.openNode = openNode;


  // ---------- upgrade button ----------
  // Hold to keep buying: one buy on press, then repeats that speed up until you let go or run out of cash.
  function holdToRepeat(el, fn) {
    let timer = null, held = false;
    const stop = () => { clearTimeout(timer); timer = null; held = false; };
    const loop = (gap) => { timer = setTimeout(() => { if (!fn()) return stop(); loop(Math.max(35, gap * 0.75)); }, gap); };
    el.dataset.hold = "1"; // handles its own presses; the tap helper below leaves it alone
    // The browser must never turn the press into a scroll (that fired pointercancel and dropped the first touch),
    // and the pointer is captured so a finger that drifts a little keeps the hold going until it lifts.
    el.style.touchAction = "none";
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("pointerdown", (e) => {
      if (e.button > 0 || el.disabled) return;
      if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (_) {} }
      held = true;
      fn();
      dirty = true;
      loop(320);
    });
    ["pointerup", "pointercancel", "lostpointercapture", "blur"].forEach((t) => el.addEventListener(t, stop));
    // Keyboard and assistive tech still get a plain click (pointer presses are handled above).
    el.addEventListener("click", (e) => { if (e.detail === 0 && !held) fn(); });
    return el;
  }
  function upgradeBtn(kind, n) {
    return bind(holdToRepeat(h("button", { class: "btn up" }), () => SVT.upgrade(kind, n)), (e) => {
      const L = lab();
      const lv = SVT.levelOf(L, kind, n);
      if (lv >= SVT.maxLevel(lab(), kind)) { setText(e, "Max level"); setDisabled(e, true); return; }
      const q = SVT.quote(L, kind, n);
      const disc = SVT.discount(L, kind, n);
      setText(e, "Upgrade ×" + q.count + " · $" + fmt(q.cost));
      setDisabled(e, L.cash < q.cost);
      toggle(e, "sale", disc > 0);
    });
  }

  function unlockBar(kind, n) {
    const bar = h("span", { class: "fill" });
    const label = h("span", { class: "ul-label" });
    bind(label, () => {
      const lv = SVT.levelOf(lab(), kind, n);
      const u = nextUnlock(kind, lv);
      setText(label, lv >= SVT.maxLevel(lab(), kind) ? "All unlocks earned" : "Next unlock Lv " + u.lvl + " · " + multLabel(u.mult) + (u.big ? " milestone" : ""));
      bar.style.width = Math.min(100, ((lv - u.from) / 5) * 100) + "%";
      toggle(label, "big", u.big);
    });
    return h("div", { class: "unlock" }, h("span", { class: "ul-track" }, bar), label);
  }

  function bottleneckPill(which) {
    return bind(h("span", { class: "pill warn", text: "Slowest" }), (e) => {
      const r = SVT.rates(lab());
      e.hidden = !(r.limit === which && lab().floors.length > 0);
    });
  }

  // Countdown shown while a tapped node works; managers show "Auto" instead.
  function workTimer(kind, n, verb) {
    const fill = h("span", { class: "fill" });
    const label = h("span", { class: "wt-label" });
    const box = h("div", { class: "work-timer", "aria-live": "off" }, label, h("span", { class: "wt-track" }, fill));
    bind(box, () => {
      const L = lab();
      // Progress of the one cycle (or trip) that is running; "Auto" when a manager keeps them coming.
      const auto = !!SVT.mgrOf(L, kind, n), left = SVT.nodeOf(L, kind, n).left || 0, T = SVT.cycleTime(kind);
      toggle(box, "auto", auto);
      box.hidden = !auto && !(left > 0);
      setText(label, auto ? "Auto" : Math.ceil(left / SVT.speedMult(L, kind, n)) + "s");
    });
    onFrame(fill, () => {
      const L = lab(), left = SVT.nodeOf(L, kind, n).left || 0, T = SVT.cycleTime(kind);
      const v = "scaleX(" + (left > 0 ? 1 - left / T : SVT.mgrOf(L, kind, n) ? 0 : 1).toFixed(3) + ")";
      if (fill.style.transform !== v) fill.style.transform = v;
    });
    return box;
  }
  function totalWaiting(L) { return L.floors.reduce((a, f) => a + f.stock, 0); }

  // ---------- manager avatars ----------
  // A little character whose outfit and effects get fancier with rarity (see .av.r-* in style.css).
  // Hair and skin vary by name so two managers of the same rarity still look different.
  const HAIR = ["#3b2a20", "#6b4226", "#c98b3c", "#1c1c1c", "#a0522d", "#d8b25a", "#7a3b2e", "#4a4a4a"];
  const SKIN = ["#f3d2b3", "#e8b98f", "#c98e63", "#9c6b45", "#f0c9a4", "#7a5134"];
  function avatar(m) {
    let hsh = 0;
    for (const ch of m.name) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
    return h("span", { class: "av r-" + m.rank, style: "--hair:" + HAIR[hsh % HAIR.length] + ";--skin:" + SKIN[(hsh >> 3) % SKIN.length], "aria-hidden": "true" },
      h("span", { class: "fx" }), h("span", { class: "body" }), h("span", { class: "tie" }), h("span", { class: "head" }), h("span", { class: "hat" }));
  }

  // ---------- shared Idle Miner-style pieces ----------
  // Manager seat: the manager's face (rarity ring) or an empty dashed seat. Tap to hire, pick or swap.
  function seat(kind, n) {
    const el = h("button", { class: "seat empty", onclick: (e) => { e.stopPropagation(); openManagers(kind, kind, n); } });
    let shown = null;
    bind(el, () => {
      const m = SVT.mgrOf(lab(), kind, n);
      const key = m ? m.id : "none";
      if (key === shown) return;
      shown = key;
      el.className = "seat" + (m ? " r-" + m.rank : " empty");
      el.setAttribute("aria-label", m ? m.name + ", " + SVT.rank(m.rank).name + " " + B.ROLE_NAMES[kind] : "Manager: hire or choose a " + B.ROLE_NAMES[kind]);
      el.replaceChildren(m ? avatar(m) : h("span", { class: "plus", text: "+" }));
    });
    return el;
  }
  // Ability button beside the seat: ⚡ when ready, a countdown while active or cooling down.
  function boostBtn(kind, n) {
    const el = h("button", { class: "boost", "aria-label": "Use manager ability", onclick: (e) => { e.stopPropagation(); SVT.activate(kind, n); } });
    bind(el, () => {
      const m = SVT.mgrOf(lab(), kind, n);
      el.hidden = !m;
      if (el.hidden) return;
      const t = SVT.now(), live = m.activeUntil > t, cd = !live && m.cdUntil > t, ab = SVT.ability(kind, m.ability);
      setText(el, live ? SVT.fmtTime(m.activeUntil - t) : cd ? SVT.fmtTime(m.cdUntil - t) : ab.icon || B.ABILITY_KINDS[ab.kind].icon);
      setDisabled(el, live || cd); toggle(el, "live", live); toggle(el, "ready", !live && !cd);
    });
    return el;
  }
  // Big blue Level button: opens the stats and upgrade sheet. A green ▲ shows when you can afford an upgrade.
  function levelBtn(kind, n) {
    const num = h("b"), badge = h("i", { class: "can", "aria-hidden": "true", text: "▲" }), deal = h("i", { class: "deal-tag", "aria-hidden": "true" });
    const el = h("button", { class: "lvl-btn", onclick: (e) => { e.stopPropagation(); openNode(kind, n); } },
      h("span", { text: "Level" }), num, badge, deal);
    bind(el, () => {
      const L = lab(), lv = SVT.levelOf(L, kind, n), max = lv >= SVT.maxLevel(lab(), kind);
      const d = SVT.discount(L, kind, n);
      toggle(el, "deal", d > 0);
      if (d > 0) setText(deal, "−" + Math.round(d * 100) + "%");
      popText(num, max ? "MAX" : String(lv));
      // ▲ affords 1 level, ▲▲ affords up to the next ×10 level, ▲▲▲ up to the next multiple of 50 (where Max lands).
      const m = max ? null : B.bulk(kind, n, lv, Infinity, L.cash, SVT.discount(L, kind, n), SVT.costScale(L, kind, n), SVT.maxLevel(L, kind), SVT.growthOf(L, kind));
      const can = m && L.cash >= m.cost ? m.count : 0, room = SVT.maxLevel(lab(), kind) - lv;
      const tri = can >= Math.min(room, SVT.stepTo(lv, 50)) ? 3 : can >= Math.min(room, SVT.stepTo(lv, 10)) ? 2 : can >= 1 ? 1 : 0;
      toggle(el, "afford", tri > 0);
      setText(badge, "▲".repeat(tri || 1));
      el.dataset.tri = tri;
      el.setAttribute("aria-label", "Level " + lv + ": stats and upgrades");
    });
    return el;
  }
  // Coin tag with a live amount, like the numbers over Idle Miner's buildings and crates.
  function coinTag(cls, label, get) {
    const amt = h("b");
    const el = h("div", { class: "coin-tag " + cls, title: label }, h("span", { class: "coin", "aria-hidden": "true", text: "$" }), amt);
    bind(el, () => setText(amt, fmt(get())));
    return el;
  }
  const runBind = (el, kind, n) => bind(el, (e) => toggle(e, "run", SVT.running(lab(), kind, n)));
  // Shows the running ability on a scene: .ab-speed with --sp (CSS animations run that much faster), .ab-storage
  // (bigger crates, car and cart) or .ab-discount, plus a floating tag naming it.
  function abilityBind(el, kind, n) {
    const tag = h("span", { class: "ab-tag", "aria-hidden": "true" });
    tag.hidden = true; // v0.23 fix: it stayed visible as an empty pill until the first ability ran
    el.append(tag);
    let shown = "";
    return bind(el, (e) => {
      const a = SVT.activeAbility(lab(), kind, n);
      const key = a ? a.id + a.mult : "";
      if (key === shown) return;
      shown = key;
      e.className = e.className.replace(/\s*\bab-[\w-]+/g, "");
      // Speed-type effects (incl. the Hyperloop and the Overclocker) speed every animation up through --sp.
      if (a) { e.classList.add("ab-" + a.kind); if (a.speed > 1) e.classList.add("ab-speed"); if (a.load > 1) e.classList.add("ab-storage"); if (a.off > 0) e.classList.add("ab-discount"); if (a.kind === "special") e.classList.add("ab-" + a.id); }
      e.style.setProperty("--sp", a && a.speed > 1 ? String(a.speed) : "1");
      tag.hidden = !a;
      if (a) setText(tag, a.icon + " " + (a.direct ? "×" + a.direct + " cash" : a.cash > 1 ? "×" + a.speed + " · ×" + a.cash + " cash" : a.warp ? "warp" : a.off ? "−" + Math.round(a.off * 100) + "%" : "×" + a.mult));
    });
  }

  // ---------- surface: lift tower (left) and warehouse (right) ----------
  function surface() {
    const lift = (h("div", { class: "tower lift-tower lift-scene", onclick: () => SVT.tap("freight", 0) },
      h("div", { class: "roof" }),
      // What the lift has brought up and stored at the top of the shaft, waiting for the warehouse.
      coinTag("over", "Stored at the top of the shaft", () => lab().lobby),
      bottleneckPill("freight"),
      h("div", { class: "window" },
        h("div", { class: "dock", "aria-hidden": "true" }), h("div", { class: "lbox in", "aria-hidden": "true" }), h("div", { class: "lbox out", "aria-hidden": "true" }),
        h("div", { class: "lift-shaft", "aria-hidden": "true" }, h("div", { class: "lift-car" }, h("span", { class: "lbox ride" })))),
      h("div", { class: "tower-foot" }, h("div", { class: "door" }, seat("freight", 0), boostBtn("freight", 0)), levelBtn("freight", 0)),
      bind(h("div", { class: "tap-hint", text: "Tap" }), (e) => { e.hidden = SVT.running(lab(), "freight", 0) || (lab().lift && lab().lift.phase !== "idle"); })));
    bind(lift, (e) => toggle(e, "run", SVT.running(lab(), "freight", 0) || (lab().lift && lab().lift.phase !== "idle")));
    abilityBind(lift, "freight", 0);
    const wh = runBind(h("div", { class: "tower wh-tower hub-scene", onclick: () => SVT.tap("commercial", 0) },
      h("div", { class: "roof" }),
      bottleneckPill("commercial"),
      h("div", { class: "window shelves" },
        h("div", { class: "store", "aria-hidden": "true" }), h("div", { class: "belt", "aria-hidden": "true" }),
        [0, 1, 2].map((i) => h("div", { class: "wbox", style: "--d:" + (-i * 0.6) + "s", "aria-hidden": "true" })),
        h("div", { class: "truck t1", "aria-hidden": "true" }, h("span", { class: "cargo" }))),
      workTimer("commercial", 0, "Shipping"),
      h("div", { class: "tower-foot" }, levelBtn("commercial", 0), h("div", { class: "door" }, seat("commercial", 0), boostBtn("commercial", 0))),
      bind(h("div", { class: "tap-hint", text: "Tap" }), (e) => { e.hidden = SVT.running(lab(), "commercial", 0); })), "commercial", 0);
    // The warehouse trip on the road: a worker pushes the empty cart from the warehouse to the lift, loads the money
    // there, and pushes it back to the warehouse to unload. Its position follows the real trip.
    const cartAmt = h("b"), cartTag = h("span", { class: "coin-tag cart-tag" }, h("span", { class: "coin", text: "$" }), cartAmt);
    const pusher = h("div", { class: "pusher" }, cartTag, h("span", { class: "cart" }, h("span", { class: "money" })), h("span", { class: "worker" }));
    const yard = h("div", { class: "yard cart-lane", "aria-hidden": "true" }, pusher);
    abilityBind(wh, "commercial", 0);
    abilityBind(yard, "commercial", 0);
    let laneW = 0, laneAt = 0;
    onFrame(yard, () => {
      const c = lab().commercial, T = B.WH_TRIP, left = c.left || 0, p = left > 0 ? 1 - left / T : 0;
      const raw = p < 0.45 ? p / 0.45 : p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45;
      const x = 1 - raw * raw * (3 - 2 * raw); // ease in and out at each end; 1 = warehouse (right), 0 = lift (left)
      const now = performance.now();
      if (now - laneAt > 1000 || !laneW) { laneW = yard.clientWidth - 64; laneAt = now; } // measure rarely, not every frame
      const back = left > 0 && p < 0.5; // faces left on the way out to the lift
      const v = "translate3d(" + (x * laneW).toFixed(1) + "px,0,0)" + (back ? " scaleX(-1)" : "");
      if (pusher.style.transform !== v) pusher.style.transform = v;
    });
    bind(yard, () => {
      const c = lab().commercial, T = B.WH_TRIP, left = c.left || 0, p = left > 0 ? 1 - left / T : 0;
      toggle(pusher, "back", left > 0 && p < 0.5);
      toggle(pusher, "loaded", c.carry > 0);
      toggle(pusher, "moving", left > 0 && (p < 0.45 || p >= 0.55));
      if (c.carry > 0) setText(cartAmt, fmt(c.carry));
    });
    return h("section", { class: "surface-scene" },
      h("div", { class: "hills", "aria-hidden": "true" }), h("div", { class: "sun", "aria-hidden": "true" }),
      h("span", { class: "cloud c1", "aria-hidden": "true" }), h("span", { class: "cloud c2", "aria-hidden": "true" }),
      yard, lift, wh, h("div", { class: "grass", "aria-hidden": "true" }));
  }

  // ---------- floors ----------
  function workers(n) {
    const box = h("div", { class: "workers", "aria-hidden": "true" });
    let shown = -1;
    bind(box, () => {
      const c = teamSize(SVT.levelOf(lab(), "floor", n));
      if (c !== shown) {
        shown = c; box.innerHTML = "";
        for (let i = 0; i < c; i++) box.append(h("span", { class: "worker w" + i, style: "--i:" + i }));
      }
    });
    return box;
  }

  // The floor's production line: build at the bench (sparks), wrap at the packer, ride the belt to the crate.
  // It is drawn left-to-right and mirrored so products flow toward the crate on the left, like Idle Miner's shafts.
  // The tool and sparks change by tech era (see .tier* in style.css). Everything pauses when nobody is working.
  function productionLine(n) {
    const sparks = h("div", { class: "sparks" }, [0, 1, 2, 3, 4, 5, 6, 7].map((k) => h("span", { style: "--k:" + k })));
    const items = [0, 1].map((i) => h("div", { class: "item", style: "--d:" + (-1.6 * i) + "s" }, h("span", { class: "pcb" }), h("span", { class: "box" })));
    return h("div", { class: "line", "aria-hidden": "true" },
      h("div", { class: "bench" }), h("div", { class: "tool" }), h("div", { class: "flash" }), sparks,
      h("div", { class: "conveyor" }), h("div", { class: "packer" }, h("span", { class: "roll" }), h("span", { class: "film" })),
      items, workers(n));
  }

  // Crate with the money waiting on this floor for the lift.
  function rack(n) {
    const amount = h("b", { class: "rack-amt" });
    const box = h("div", { class: "rack", title: "Waiting for the lift" }, h("span", { class: "coin", "aria-hidden": "true", text: "$" }), amount, h("span", { class: "crate", "aria-hidden": "true" }));
    bind(box, () => {
      const f = lab().floors[n - 1]; if (!f) return;
      setText(amount, fmt(f.stock));
      toggle(box, "full", f.stock > 0 && f.stock > SVT.rates(lab()).floors[n - 1] * 20);

    });
    return box;
  }

  function floorRow(n) {
    const tier = B.tierOf(n);
    const scene = runBind(h("div", { class: "scene floor-scene", onclick: () => SVT.tap("floor", n) },
      h("div", { class: "rock", "aria-hidden": "true" }),
      productionLine(n),
      rack(n),
      h("div", { class: "seat-wrap" }, seat("floor", n), boostBtn("floor", n)),
      h("button", { class: "fname-tag", onclick: (e) => { e.stopPropagation(); openNode("floor", n); } }, productName(n), n === 1 ? bottleneckPill("build") : null),
      workTimer("floor", n, "Building"),
      levelBtn("floor", n),
      bind(h("div", { class: "tap-hint", text: "Tap to build" }), (e) => { e.hidden = SVT.running(lab(), "floor", n); })), "floor", n);
    abilityBind(scene, "floor", n);
    // While the lift loads here, coins fly from the crate across into the shaft.
    const fly = h("span", { class: "fly", "aria-hidden": "true" }, [0, 1, 2].map((i) => h("span", { class: "coin", style: "--i:" + i, text: "$" })));
    const row = h("div", { class: "floor tier" + tier, "data-floor": n }, scene, fly);
    let seen = 0; // keep the coins flying a moment after a short stop so it stays visible
    bind(row, () => {
      const lift = lab().lift, t = performance.now();
      if (lift && lift.phase === "load" && lift.at === n) seen = t;
      toggle(row, "loading", t - seen < 700);
    });
    return row;
  }

  // The IPO's gate (v0.26): every floor at FLOOR_MAX and both hubs at HUB_MAX.
  function maxedText(L) {
    const pr = SVT.labProgress(L);
    return pr.p >= 1 ? "Lab fully maxed. Raise your IPO in Funding!" : "All 30 floors unlocked. Max every floor to Lv " + B.FLOOR_MAX + " and the lift and warehouse to Lv " + B.HUB_MAX + " to raise the IPO · " + Math.floor(pr.p * 100) + "%";
  }
  function lockedRow() {
    const nf = SVT.nextFloor(lab());
    if (!nf) return h("div", { class: "floor done" }, h("div", { class: "fbody" }, h("b", { text: inRaid() ? "All " + lab().floors.length + " shafts open. Take every shaft to Lv " + SVT.raidStage(lab()).max.floor + " and the lift and warehouse to Lv " + SVT.raidStage(lab()).max.freight + " to clear the raid." : maxedText(lab()) })));
    const n = nf.n;
    if (nf.blocked) {
      return h("div", { class: "floor locked wall" },
        h("div", { class: "fnum", text: n }),
        h("div", { class: "fbody" },
          h("div", { class: "fname" }, h("b", { text: "🔒 " + productName(n) })),
          h("p", { class: "muted", text: "New tech era: raise " + nf.round.name + " to open it. The lab restarts, but earns ×" + nf.round.mult + " forever." }),
          h("div", { class: "actions" }, h("button", { class: "btn fund-cta", onclick: openFunding, text: "Raise " + nf.round.name + " in Funding" }))));
    }
    const btn = bind(h("button", { class: "btn up", onclick: () => SVT.unlockFloor() }), (e) => {
      setText(e, (inRaid() ? "Unlock Shaft " : "Unlock Floor ") + n + " · $" + fmt(nf.cost)); setDisabled(e, lab().cash < nf.cost);
    });
    return h("div", { class: "floor locked" },
      h("div", { class: "fnum", text: n }),
      h("div", { class: "fbody" },
        h("div", { class: "fname" }, h("b", { text: productName(n) }), h("span", { class: "muted", text: " · " + tierName(n) })),
        h("div", { class: "actions" }, btn)));
  }

  function building() {
    const floors = lab().floors.map((_, i) => floorRow(i + 1));
    // The lift car follows the real trip: y = depth in floors, mapped onto the floor rows' centres.
    // The car is a bin that fills with money: amount, fill level and % of its capacity, like Idle Miner's elevator.
    const carAmt = h("span", { class: "car-amt" }), carPct = h("span", { class: "car-pct" }), carFill = h("span", { class: "car-fill" });
    const car = h("div", { class: "car", "aria-hidden": "true" }, carFill, carAmt, carPct);
    // Numbered tags on the shaft, one beside each floor, like Idle Miner's mine shafts.
    const tags = floors.map((_, i) => h("span", { class: "shaft-num", text: i + 1 }));
    const shaft = h("div", { class: "shaft", "aria-hidden": "true" }, tags, car);
    abilityBind(shaft, "freight", 0);
    // Floor row centres are measured once a second (not every frame); the car glides between them every frame.
    let centres = [0], carH = 64, measuredAt = 0;
    const measure = () => {
      const rows = list.children;
      carH = car.offsetHeight || carH;
      centres = [0];
      for (let k = 1; k <= floors.length; k++) centres.push(rows[k - 1] ? rows[k - 1].offsetTop + rows[k - 1].offsetHeight / 2 - carH / 2 : 0);
      tags.forEach((tg, i) => { const top = Math.round(centres[i + 1] + carH / 2) + "px"; if (tg.style.top !== top) tg.style.top = top; });
    };
    onFrame(car, () => {
      const now = performance.now();
      if (now - measuredAt > 1000) { measure(); measuredAt = now; }
      const lift = lab().lift || { y: 0, load: 0 };
      const k = Math.floor(lift.y), f = lift.y - k, c0 = centres[k] || 0, c1 = centres[k + 1] != null ? centres[k + 1] : c0;
      const v = "translate3d(0," + (c0 + (c1 - c0) * f).toFixed(1) + "px,0)";
      if (car.style.transform !== v) car.style.transform = v;
      const cap = SVT.liftCapacity(lab()), fv = "scaleY(" + (cap > 0 ? Math.min(1, lift.load / cap) : 0).toFixed(3) + ")";
      if (carFill.style.transform !== fv) carFill.style.transform = fv;
    });
    bind(car, () => {
      const L = lab(), lift = L.lift || { y: 0, load: 0, phase: "idle" };
      toggle(car, "full", lift.load > 0);
      toggle(car, "run", lift.phase !== "idle");
      const cap = SVT.liftCapacity(L), pct = cap > 0 ? Math.min(100, Math.round(100 * lift.load / cap)) : 0;
      setText(carAmt, fmt(lift.load));
      setText(carPct, pct + "%");
    });
    const list = h("div", { class: "floors" }, floors, lockedRow());
    // How full the car is against what it can hold.
    const capLoad = h("b"), capRest = h("span");
    const capTag = bind(h("div", { class: "cap-tag" }, "🛗 Lift ", capLoad, capRest), () => {
      const L = lab(), load = L.lift ? L.lift.load : 0, cap = SVT.liftCapacity(L);
      setText(capLoad, "$" + fmt(load)); setText(capRest, " / $" + fmt(cap) + " · " + (cap > 0 ? Math.min(100, Math.round(100 * load / cap)) : 0) + "% full");
    });
    return h("section", { class: "building" }, capTag, shaft, list);
  }

  // Idle Miner's jump arrows, bottom left: ⬆ glides back to the top of the mine, ⬇ down to the deepest floor.
  // Each shows only when there is somewhere to go, and you see the page scroll.
  let scrollAnim = 0;
  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
  function glideTo(target) {
    cancelAnimationFrame(scrollAnim);
    const y0 = window.scrollY, d = target - y0, t0 = performance.now(), dur = Math.min(900, 300 + Math.abs(d) / 4);
    const stop = () => cancelAnimationFrame(scrollAnim);
    window.addEventListener("touchstart", stop, { once: true, passive: true });
    window.addEventListener("wheel", stop, { once: true, passive: true });
    (function step(t) {
      const k = Math.min(1, (t - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      window.scrollTo(0, y0 + d * e);
      if (k < 1) scrollAnim = requestAnimationFrame(step);
    })(t0);
  }
  function jumpBtns() {
    const up = bind(h("button", { class: "jump-btn up", "aria-label": "Back to the top", onclick: () => glideTo(0), text: "⬆" }),
      (e) => toggle(e, "show", window.scrollY > 240));
    const down = bind(h("button", { class: "jump-btn down", "aria-label": "Down to the bottom of the mine", onclick: () => glideTo(maxScroll()), text: "⬇" }),
      (e) => toggle(e, "show", maxScroll() - window.scrollY > 240));
    return h("div", { class: "jump-btns" }, up, down);
  }

  // ---------- views ----------
  function labView() {
    return h("main", { class: "lab-view" + (inRaid() ? " raid" : "") },
      header(),
      surface(),
      building(),
      h("footer", { class: "foot", text: "Silicon Valley Tycoon " + buildTag() }),
      bottomNav(),
      jumpBtns());
  }

  function mapView() {
    const S = SVT.state();
    const pins = SVT.LABS.map((l, i) => {
      const unlocked = SVT.labUnlocked(l.id), beaten = SVT.labBeaten(S.labs[l.id]), replaying = SVT.labReplaying(S.labs[l.id]);
      const state = beaten ? "open done" : unlocked ? "open" : "locked";
      const active = S.activeLab === l.id;
      return h("button", {
        class: "pin " + state + (active ? " active" : "") + (replaying ? " replaying" : ""), style: "left:" + l.x + "%;top:" + l.y + "%",
        "aria-label": l.name + (beaten ? ", beaten" : replaying ? ", replaying" : unlocked ? "" : ", locked"),
        onclick: () => {
          if (beaten) openReplay(l);
          else if (!unlocked) toast("🔒 " + l.name + ": " + SVT.labRequirement(l.id));
          else { SVT.switchLab(l.id); setView("lab"); }
        },
      },
        h("span", { class: "pin-dot" }, h("span", { class: "pin-icon", text: l.icon }), !unlocked ? h("span", { class: "pin-lock", text: "🔒" }) : beaten ? h("span", { class: "pin-lock", text: "🏆" }) : replaying ? h("span", { class: "pin-lock", text: "🔁" }) : null),
        h("span", { class: "pin-label", text: (i + 1) + ". " + l.name }));
    });
    // Your open labs first, then the labs you have beaten, then the next ones you can open.
    const nextUp = (l) => { const g = SVT.labGate(l.id); return !S.labs[l.id] && g && S.labs[g.from.id]; };
    const rows = (pick) => SVT.LABS.filter(pick).map((l) => {
      const L = S.labs[l.id];
      const coins = SVT.vaultCoins(l.id);
      const right = L && SVT.labBeaten(L) ? h("span", { class: "muted", text: "🏆 ×" + (S.vault.beats[l.id] || 1) + (coins ? " · 🪙 " + coins : "") + " · Replay ›" }) : L ? bind(h("span", { class: "muted" }), (e) => setText(e, "$" + fmt(L.cash) + " · " + L.floors.length + (L.floors.length === 1 ? " floor" : " floors"))) : h("span", { "aria-hidden": "true", text: "🔒" });
      return h("button", { class: "loc" + (L ? "" : " locked") + (SVT.labBeaten(L) ? " beaten" : "") + (SVT.labReplaying(L) ? " replaying" : ""), onclick: () => { if (SVT.labBeaten(L)) openReplay(l); else if (L) { SVT.switchLab(l.id); setView("lab"); } else toast("🔒 " + SVT.labRequirement(l.id)); } },
        h("span", { class: "lab-icon", text: l.icon }), h("span", { class: "loc-name" }, h("b", { text: l.name + (SVT.labReplaying(L) ? " 🔁" : "") }), h("span", { class: "muted", text: L ? (SVT.labReplaying(L) ? "Replay for another coin · " : "") + l.theme : l.theme + " · " + SVT.labRequirement(l.id) })), right);
    });
    const active = rows((l) => S.labs[l.id] && !SVT.labBeaten(S.labs[l.id]) && !SVT.labReplaying(S.labs[l.id])), replayRows = rows((l) => SVT.labReplaying(S.labs[l.id])), beatenRows = rows((l) => SVT.labBeaten(S.labs[l.id])), upcoming = rows(nextUp);
    return h("main", { class: "map-view" },
      h("header", { class: "top" }, h("div", { class: "top-row" },
        h("button", { class: "btn small", onclick: () => setView("home"), text: "🏠 Home" }),
        h("div", { class: "lab-title" }, h("b", { text: "Silicon Valley Map" })),
        h("button", { class: "btn small vault-btn", onclick: SVT.openVault, text: "🎁 Vault · 🪙 " + SVT.vaultCoins() }))),
      h("div", { class: "loc-list" }, h("h3", { text: "Your labs (" + active.length + " of " + SVT.OPEN_LABS + " open)" }), active,
        replayRows.length ? [h("h3", { text: "Replaying (bonus slot)" }), ...replayRows] : null,
        upcoming.length ? [h("h3", { text: "Next to open" }), ...upcoming] : null,
        beatenRows.length ? [h("h3", { text: "Beaten · tap to replay for another 🪙" }), ...beatenRows] : null,
        h("h3", { text: "Islands" }), raidCard(),
        h("p", { class: "muted small", text: "Each lab is its own company with 30 floors and its own cash. Up to 5 labs are open at a time: Seed funding opens labs 2 to 5, and beating a lab (raising its IPO) opens a new one, all the way to lab 30." })),
      h("div", { class: "map-wrap" },
        h("div", { class: "map" },
          h("div", { class: "bay", "aria-hidden": "true" }),
          h("div", { class: "road r1", "aria-hidden": "true" }), h("div", { class: "road r2", "aria-hidden": "true" }), h("div", { class: "road r3", "aria-hidden": "true" }),
          pins)),
      h("footer", { class: "foot", text: "Silicon Valley Tycoon " + buildTag() }));
  }

  // ---------- lab replay (Tech Vault coins) ----------
  // A beaten lab keeps its trophy. Replaying starts it over from scratch in a bonus slot (one replay at a time),
  // and raising its IPO again pays another coin for the Vault.
  function openReplay(l) {
    const S = SVT.state(), busy = S.vault.replay && SVT.labReplaying(S.labs[S.vault.replay]) ? SVT.labDef(S.vault.replay) : null;
    const go = h("button", { class: "btn fund-cta big", disabled: !!busy, onclick: () => { if (SVT.replayLab(l.id)) { closeSheet(); setView("lab"); toast("🔁 " + l.name + " starts over. Raise its IPO for another 🪙 coin.", "big"); } }, text: busy ? "Finish " + busy.name + " first" : "Replay " + l.name });
    sheet(l.name, h("div", { class: "sheet-body" },
      h("p", { text: "🏆 Beaten " + (S.vault.beats[l.id] || 1) + (S.vault.beats[l.id] === 1 ? " time" : " times") + ". You have 🪙 " + SVT.vaultCoins(l.id) + " " + l.name + (SVT.vaultCoins(l.id) === 1 ? " coin" : " coins") + " to roll in the Vault." }),
      h("p", { class: "muted", text: "Replay it for another coin: the lab starts over from floor 1 with $0, no managers and no funding rounds, in its own bonus slot beside your 5 open labs. Raising its IPO again pays 1 more coin. One replay runs at a time." }),
      busy ? h("p", { class: "muted small", text: "🔁 " + busy.name + " is being replayed right now." }) : null,
      SVT.vaultCoins(l.id) ? h("button", { class: "btn", onclick: () => { closeSheet(); SVT.openVault(); }, text: "🎁 Open the Vault" }) : null),
      { icon: l.icon, foot: h("div", { class: "panel-foot" }, go) });
  }

  // ---------- Viking Raid ----------
  // The island card on the map: a separate place with 50 generated mines.
  function raidCard() {
    const S = SVT.state(), R = SVT.RAID;
    const right = h("span", { class: "muted", text: S.raid.cleared >= R.STAGES ? "All 50 cleared" : "Stage " + SVT.raidNext() + " of " + R.STAGES });
    return h("button", { class: "loc island", onclick: openRaid },
      h("span", { class: "lab-icon", text: "⚔️" }),
      h("span", { class: "loc-name" }, h("b", { text: "Viking Raid" }), h("span", { class: "muted", text: "50 mines · managers and abilities work" })), right);
  }
  function stageTime(s) { const t = SVT.RAID.time(s); return t < 3600 ? "~" + Math.round(t / 60) + " min" : "~" + (Math.round(t / 360) / 10) + " h"; }
  // Stage list: cleared stages, the next one to raid, and the locked ones after it.
  function openRaid() {
    const S = SVT.state(), R = SVT.RAID, next = SVT.raidNext(), cur = S.labs.raid;
    let pick = cur && !cur.won ? cur.stage : next;
    const info = h("div", { class: "raid-info" });
    const go = h("button", { class: "btn fund-cta big" });
    const live = () => !!cur && cur.stage === pick && !cur.won;
    const stages = h("div", { class: "stages" }, Array.from({ length: R.STAGES }, (_, i) => {
      const s = i + 1, done = s <= S.raid.cleared, open = s <= next;
      return h("button", {
        class: "stage" + (done ? " done" : open ? " open" : " locked"), "data-s": s, "aria-label": "Stage " + s + (done ? ", cleared" : open ? "" : ", locked"),
        onclick: () => { if (!open) { toast("🔒 Clear stage " + (s - 1) + " first"); return; } pick = s; show(); },
      }, done ? "✓" : open ? String(s) : "🔒");
    }));
    const show = () => {
      const st = R.stage(pick);
      info.replaceChildren(
        h("div", { class: "raid-title" }, h("b", { text: "Stage " + pick + ": " + st.name }), h("span", { class: "muted", text: stageTime(pick) })),
        h("p", { class: "muted small", text: "Goal: open all " + st.floors + " shafts, take every shaft to Lv " + st.max.floor + " and the lift and warehouse to Lv " + st.max.freight }),
        st.omens.length ? h("ul", { class: "omens" }, st.omens.map((o) => h("li", { class: o.mult > 1 === (o.stat !== "cost") ? "good" : "bad" }, h("b", { text: o.name }), " " + o.text))) : h("p", { class: "muted small", text: "No omens on this mine." }));
      go.textContent = live() ? "Continue stage " + pick : pick <= S.raid.cleared ? "Raid stage " + pick + " again" : "Raid stage " + pick;
      stages.querySelectorAll(".stage").forEach((b) => toggle(b, "sel", +b.dataset.s === pick));
    };
    let armed = 0;
    go.addEventListener("click", () => {
      // Starting another stage drops an unfinished one, so that takes a second tap.
      if (!live() && cur && !cur.won && armed !== pick) { armed = pick; go.textContent = "Tap again: stage " + cur.stage + " progress is lost"; return; }
      if (live()) SVT.switchLab("raid"); else SVT.startRaid(pick);
      closeSheet(); setView("lab");
    });
    show();
    sheet("Viking Raid", h("div", { class: "sheet-body raid-panel" },
      h("p", { class: "muted", text: "A separate island of Viking mines. Dig the shafts, lift the loot and ship it like in your labs, with managers and their abilities but no funding rounds. Max out the mine to clear a stage and open the next: open every shaft, take every shaft to Lv 25 and the lift and warehouse to Lv 100. Each stage adds a shaft and costs more." }),
      info, stages), { icon: "⚔️", foot: h("div", { class: "panel-foot" }, go) });
  }
  SVT.openRaid = openRaid;
  function showRaidClear(s) {
    const R = SVT.RAID, last = s >= R.STAGES;
    sheet("Stage " + s + " cleared!", h("div", { class: "sheet-body" },
      h("p", { text: last ? "You raided all 50 mines on the island. Skål!" : R.stage(s).name + " is yours. Stage " + (s + 1) + ", " + R.stage(s + 1).name + ", is open." }),
      last ? null : h("button", { class: "btn fund-cta big", onclick: () => { closeSheet(); SVT.startRaid(s + 1); setView("lab"); }, text: "Raid stage " + (s + 1) }),
      h("button", { class: "btn", onclick: closeSheet, text: "Keep playing here" })), { icon: "⚔️" });
  }

  // ---------- home screen ----------
  // The title screen the game opens on: jump back into your lab, or pick the map, Viking Raid or Settings.
  // Cartoon title screen, in the style of casual mobile games: a garden in front of the lab, Chip the robot holding
  // up your floor count, round bubbles down the sides, and one big glossy Play button.
  function homeView() {
    const S = SVT.state(), d = def(), L = lab(), raid = SVT.isRaid(L);
    const bubble = (cls, icon, label, on, badge) => h("button", { class: "bubble " + cls, onclick: on, "aria-label": label },
      h("span", { class: "bubble-ic", "aria-hidden": "true", text: icon }), h("span", { class: "bubble-label", text: label }),
      badge ? h("span", { class: "bubble-badge", "aria-hidden": "true", text: "!" }) : null);
    const beaten = SVT.labsDone();
    const raidReady = !S.labs.raid || S.labs.raid.won; // a new stage is waiting
    // Progress toward beating this lab: funding rounds raised, or the raid stage goal.
    const prog = raid ? Math.min(1, SVT.raidProgress(L).p) : L.round / B.ROUNDS.length;
    const progText = raid ? "Stage " + L.stage + " goal " + Math.floor(prog * 100) + "%" : L.round + " / " + B.ROUNDS.length + " rounds";
    const nextName = raid ? d.name : SVT.nextRound(L) ? "Next: " + SVT.nextRound(L).name : "IPO raised";
    const cash = bind(h("b"), (e) => setText(e, fmt(lab().cash)));
    const floors = bind(h("b", { class: "sign-num" }), (e) => popText(e, String(lab().floors.length)));
    const sign = h("div", { class: "sign" }, h("span", { class: "sign-label", text: raid ? "SHAFTS" : "FLOORS" }), floors);
    return h("main", { class: "home-view" },
      h("div", { class: "home-bg", "aria-hidden": "true" },
        h("span", { class: "cloud c1" }), h("span", { class: "cloud c2" }), h("span", { class: "cloud c3" }),
        h("span", { class: "hill h1" }), h("span", { class: "hill h2" }),
        h("span", { class: "hq" }, h("span", { class: "hq-roof" }), h("span", { class: "hq-win" }), h("span", { class: "hq-door" })),
        h("span", { class: "lawn" }), h("span", { class: "bush b1" }), h("span", { class: "bush b2" }),
        h("span", { class: "mine-hole" }, h("span", { class: "mine-ladder" }))),
      h("div", { class: "home-top" },
        h("button", { class: "avatar-badge", "aria-label": "Chip says hi", onclick: () => toast("🤖 Chip: Let's build something big!"), html: SVT.mascot("head") }),
        h("div", { class: "cur-pill" }, h("span", { class: "cur-ic coin3d", "aria-hidden": "true", text: "$" }), cash),
        h("div", { class: "cur-pill" }, h("span", { class: "cur-ic", "aria-hidden": "true", text: "🏆" }), h("b", { text: String(beaten) })),
        h("button", { class: "gear-btn", "aria-label": "Settings", onclick: openSettings, text: "⚙" })),
      h("div", { class: "goal-track" },
        h("span", { class: "goal-ic", "aria-hidden": "true", text: d.icon }),
        h("div", { class: "goal-rail" }, h("i", { class: "goal-rail-fill", style: "transform:scaleX(" + prog.toFixed(3) + ")" }), h("b", { text: progText })),
        h("span", { class: "goal-sub", text: nextName })),
      h("div", { class: "home-stage" },
        h("div", { class: "side left" },
          bubble("b-map", "🗺", "Map", () => setView("map")),
          bubble("b-raid", "⚔️", "Viking Raid", openRaid, raidReady)),
        h("div", { class: "hero" }, sign, h("div", { class: "hero-bot", html: SVT.mascot("hold") }), wornItems(),
          SVT.vaultMult() > 1 ? h("button", { class: "worn-total", "aria-label": "Item bonus", onclick: () => SVT.openChip(), text: "⚡ ×" + SVT.vaultMult() }) : null),
        h("div", { class: "side right" },
          rushBubble(bubble("b-rush", "🏭", "Rush", SVT.openRush, true)),
          bubble("b-vault", "🎁", "Vault", SVT.openVault, SVT.vaultCoins() > 0))),
      h("button", { class: "play-btn", onclick: () => setView("lab") },
        h("span", { class: "play-tab", text: raid ? "Viking Raid" : d.name }), h("span", { class: "play-word", text: "Play" })),
      h("footer", { class: "home-foot", text: buildTag() }));
  }

  // Chip's collectibles from the Tech Vault, pinned to his slots (hands, hat, neck, and the floor beside him).
  // The layer sits exactly over Chip's 200x270 box, so each slot's anchor (in his SVG coordinates) lands on his
  // hand, wrist, head, neck, chest or feet, and the floor slots land on the grass beside him.
  function wornItems() {
    return h("div", { class: "worn-layer", "aria-hidden": "false" }, SVT.vaultWorn().map(({ slot, item }) =>
      h("button", { class: "worn worn-" + slot.id, style: "left:" + (slot.x / 2) + "%;top:" + (slot.y / 2.7) + "%;--ws:" + slot.size + "px;z-index:" + slot.z, "aria-label": slot.name + ": " + SVT.itemName(item),
        onclick: () => { toast(SVT.itemName(item) + " · " + item.rarity + (item.boost > 1 ? " · ⚡ ×" + item.boost : ""), "big"); SVT.openChip(slot.id); } }, SVT.itemArt(item, "mini"))));
  }

  // The Rush bubble shows the boost countdown, and its "!" badge only while a run is ready.
  function rushBubble(b) {
    const label = b.querySelector(".bubble-label"), badge = b.querySelector(".bubble-badge");
    return bind(b, () => {
      const left = SVT.rushLeft();
      setText(label, left > 0 ? "×" + SVT.state().rush.mult + " " + SVT.rushClock(left) : "Rush");
      badge.hidden = SVT.rushWait() > 0 || left > 0;
    });
  }

  function setView(v) { view = v; render(); window.scrollTo(0, 0); }
  SVT.setView = setView;

  function render() {
    binds = binds.filter((b) => b.e.isConnected && b.e.closest("#sheet")); // an open sheet keeps its live numbers
    frames = [];
    const root = app();
    const y = window.scrollY;
    root.innerHTML = "";
    root.append(view === "map" ? mapView() : view === "home" ? homeView() : labView());
    update();
    window.scrollTo(0, y);
  }
  SVT.render = render;

  function update() {
    for (let i = 0; i < binds.length; i++) {
      const b = binds[i];
      if (b.e.isConnected) b.fn(b.e);
    }
  }

  // ---------- sheets ----------
  function openFunding() {
    const L = lab();
    const next = SVT.nextRound(L);
    const ladder = h("ol", { class: "ladder" }, B.ROUNDS.map((r, i) => h("li", { class: i < L.round ? "done" : i === L.round ? "next" : "" },
      h("b", { text: r.name }), h("span", { text: " ×" + r.mult + " income · needs Floor " + r.needFloor + (r.maxed ? " and every floor at Lv " + B.FLOOR_MAX + ", lift and warehouse at Lv " + B.HUB_MAX : "") + (B.WALLS[r.needFloor + 1] === i ? " · opens Floor " + (r.needFloor + 1) : "") + " · +" + B.VAULT.ROUND_COINS + " 🪙" }))));
    let armed = false;
    const btn = h("button", { class: "btn fund-cta big" });
    const can = SVT.canRaise(L);
    if (!next) { btn.textContent = "IPO complete"; btn.disabled = true; }
    else if (!can) { btn.textContent = L.floors.length < next.needFloor ? "Reach Floor " + next.needFloor + " to raise " + next.name : "Max the whole lab to raise " + next.name + " · " + Math.floor(SVT.labProgress(L).p * 100) + "%"; btn.disabled = true; }
    else btn.textContent = "Raise " + next.name;
    btn.addEventListener("click", () => {
      const ipo = next === B.ROUNDS[B.ROUNDS.length - 1];
      if (!armed) { armed = true; btn.textContent = ipo ? "Tap again: beat this lab and close it" : "Tap again to confirm: this lab resets"; btn.classList.add("armed"); return; }
      if (SVT.raise()) closeSheet();
    });
    sheet("Funding", h("div", { class: "sheet-body" },
      h("p", { text: "Current multiplier: ×" + SVT.prestigeMult(L) }),
      h("p", { class: "muted", text: "Every 5 floors start a new tech era and need funding before you can open them. Raising a round resets this lab's floors, hubs, cash and managers. You will need to hire new managers, but the whole lab earns more forever, and every round pays " + B.VAULT.ROUND_COINS + " Vault coins. The IPO needs the whole lab maxed out first." }),
      ladder,
      h("p", { class: "muted small", text: "Raising the IPO beats this lab: it closes for good with a 🏆" + (opensOnIpo(L) ? " and " + opensOnIpo(L).name + " opens on the map." : ".") }),
      btn));
  }
  // The lab that beating this one opens (five places further on the map), if any.
  function opensOnIpo(L) {
    const i = SVT.labIndex(L.id) + SVT.OPEN_LABS;
    return i < SVT.LABS.length ? SVT.LABS[i] : null;
  }

  function openSettings() {
    let armed = false;
    const reset = h("button", { class: "btn danger", text: "Reset all progress" });
    reset.addEventListener("click", () => {
      if (!armed) { armed = true; reset.textContent = "Tap again to erase your save"; return; }
      SVT.reset(); closeSheet(); toast("Progress reset");
    });
    sheet("Settings", h("div", { class: "sheet-body" },
      h("p", null, h("b", { text: "Silicon Valley Tycoon " + buildTag() })),
      h("button", { class: "btn", onclick: checkUpdate, text: "🔄 Check for update" }),
      h("p", { class: "muted", text: "Tap floors, the lift and the warehouse to work them. Tap a dashed seat to hire a manager to automate it and keep earning while you're away (up to 2 hours). Income is limited by the slowest of build, freight and commercial, marked Slowest. Tap a blue Level button for stats and upgrades, and hold Upgrade to keep buying." }),
      h("p", { class: "muted", text: "Every 5 levels unlocks new tech (+10% on floors, +2% on hubs). Levels 10, 25, 50, 100 and beyond are big milestones." }),
      h("p", null, h("a", { href: "https://github.com/bigbriggs52/idle-tap/blob/main/CHANGELOG.md", target: "_blank", rel: "noopener", text: "Changelog" })),
      h("p", { class: "muted small" }, "Vault item pictures: ", h("a", { href: "https://pictogrammers.com/library/mdi/", target: "_blank", rel: "noopener", text: "Material Design Icons" }), " (Apache 2.0), ",
        h("a", { href: "https://game-icons.net", target: "_blank", rel: "noopener", text: "Game-icons.net" }), " (CC BY 3.0), ", h("a", { href: "https://tabler.io/icons", target: "_blank", rel: "noopener", text: "Tabler Icons" }), " (MIT), ",
        h("a", { href: "https://iconpark.oceanengine.com/", target: "_blank", rel: "noopener", text: "IconPark" }), " (Apache 2.0), ", h("a", { href: "https://phosphoricons.com", target: "_blank", rel: "noopener", text: "Phosphor" }), " (MIT)."),
      reset));
  }

  function showIntro() {
    sheet("Welcome to the lab", h("div", { class: "sheet-body" },
      h("p", { text: "You run a tiny electronics company in a garage. Your engineers build products on R&D floors, the freight lift brings them up, and the commercial hub ships them for cash." }),
      h("ol", null, h("li", { text: "Tap Floor 1 to build calculators." }), h("li", { text: "Tap the lift and the trucks to move and sell them." }), h("li", { text: "Hire managers so you never have to tap again." })),
      h("button", { class: "btn fund-cta big", onclick: () => { SVT.state().seenIntro = true; SVT.save(); closeSheet(); }, text: "Start building" })), { sticky: true });
  }

  function showOffline(off) {
    const rows = Object.keys(off.earned).map((id) => h("li", null, h("b", { text: SVT.labDef(id).name }), " +$" + fmt(off.earned[id])));
    if (!rows.length) return;
    sheet("While you were away", h("div", { class: "sheet-body" },
      h("p", { class: "muted", text: "Your managers kept working for " + SVT.fmtTime(off.seconds) + (off.capped ? " (2 hour limit)" : "") + "." }),
      h("ul", { class: "earned" }, rows),
      h("button", { class: "btn fund-cta big", onclick: closeSheet, text: "Collect" })));
  }

  // A little shower of stars from an element (level ups).
  function burst(el) {
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.5, d = 46 + Math.random() * 26;
      const s = h("span", { class: "burst", "aria-hidden": "true", text: i % 2 ? "⭐" : "✨",
        style: "left:" + (x - 9) + "px;top:" + (y - 9) + "px;--dx:" + (Math.cos(a) * d).toFixed(0) + "px;--dy:" + (Math.sin(a) * d).toFixed(0) + "px;--r:" + ((Math.random() - 0.5) * 120).toFixed(0) + "deg" });
      document.body.append(s);
      setTimeout(() => s.remove(), 750);
    }
  }
  // Squash and stretch on whatever you tapped.
  function squish(el) {
    if (!el) return;
    el.classList.remove("squish"); void el.offsetWidth; el.classList.add("squish");
  }

  // ---------- events ----------
  // Any change refreshes the screen on the very next frame instead of waiting for the regular refresh.
  let dirty = false;
  SVT.on(() => { dirty = true; });
  document.addEventListener("pointerup", () => { dirty = true; }, true);
  document.addEventListener("click", () => { dirty = true; }, true);
  // iOS only shows :active press styles when a touch listener exists.
  document.addEventListener("touchstart", () => {}, { passive: true });
  // No pull-to-refresh: a downward drag that starts with nothing scrolled up (the page and every scrollable panel
  // under the finger at the top) is cancelled before the browser can turn it into a reload. Ordinary scrolling
  // keeps working because any scrolled container lets the drag through.
  let dragY = null;
  const scrolledParent = (el) => {
    for (; el && el !== document.body; el = el.parentElement) {
      if (el.scrollTop > 0 && /auto|scroll/.test(getComputedStyle(el).overflowY)) return true;
    }
    return false;
  };
  document.addEventListener("touchstart", (e) => { dragY = e.touches.length === 1 ? e.touches[0].clientY : null; }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (dragY == null || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - dragY;
    if (dy > 0 && window.scrollY <= 0 && !scrolledParent(e.target) && e.cancelable) e.preventDefault();
  }, { passive: false });

  SVT.on((type, d) => {
    if (type === "unlock") {
      const last = d.crossed[d.crossed.length - 1];
      const where = d.kind === "floor" ? "Floor " + d.n : d.kind === "freight" ? "Freight Hub" : "Commercial Hub";
      const tierList = SVT.TECH_UNLOCKS[d.kind === "floor" ? B.tierOf(d.n) : 0];
      const big = d.crossed.filter((c) => c.big);
      if (big.length) toast("⭐ " + where + " Lv " + big[big.length - 1].lvl + " milestone: " + multLabel(big[big.length - 1].mult) + (d.kind === "floor" ? " output, new team member" : " capacity"), "big");
      else toast("🔓 " + where + " Lv " + last.lvl + ": " + tierList[(last.lvl / 5) % tierList.length] + " " + multLabel(last.mult));
    }
    if (type === "floor") { toast((inRaid() ? "New shaft: " : "New floor: ") + productName(d.n)); render(); }
    if (type === "assign" || type === "switch") render();
    if (type === "hire") { const y = window.scrollY; render(); window.scrollTo(0, y); }
    if (type === "raise") { toast("💰 Raised " + d.round.name + "! Lab income now ×" + d.mult + (d.coins ? " · +" + d.coins + " 🪙" : ""), "big"); render(); }
    if (type === "tap") squish(document.querySelector(d.kind === "floor" ? '.floor[data-floor="' + d.n + '"] .scene' : d.kind === "freight" ? ".lift-tower" : ".wh-tower"));
    if (type === "labUnlocked") toast("🗺 New location open on the map: " + d.lab.name, "big");
    if (type === "labBeaten") { toast("🏆 You beat " + d.lab.name + "! +1 🪙 " + d.lab.name + " coin for the Vault" + (d.replay ? "." : ", and a new lab opens."), "big"); setView("map"); }
    if (type === "raidClear") {
      toast("⚔️ Viking Raid stage " + d.stage + " cleared!", "big");
      if (inRaid() && !document.getElementById("sheet")) showRaidClear(d.stage);
    }
  });

  // Reliable taps on phones. A press that lifts within 14px of where it started, within 700ms, counts as a tap on
  // that control even if the browser would have dropped the click (a tiny drag inside a scrolling panel, or the
  // contents changing under the finger). The browser's own click that may follow is swallowed so nothing fires twice.
  const TAPPABLE = "button, .scene, .tower";
  let press = null, swallowUntil = 0;
  document.addEventListener("pointerdown", (e) => {
    const el = e.isPrimary && e.button <= 0 && e.target.closest ? e.target.closest(TAPPABLE) : null;
    press = el && !el.disabled && !el.dataset.hold ? { el, x: e.clientX, y: e.clientY, t: performance.now() } : null;
  }, true);
  document.addEventListener("pointercancel", () => { press = null; }, true);
  document.addEventListener("pointerup", (e) => {
    const p = press;
    press = null;
    if (!p || !p.el.isConnected || p.el.disabled) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 14 || performance.now() - p.t > 700) return;
    swallowUntil = performance.now() + 500;
    p.el.click();
  }, true);
  document.addEventListener("click", (e) => {
    if (e.isTrusted && e.detail > 0 && performance.now() < swallowUntil) { swallowUntil = 0; e.stopPropagation(); e.preventDefault(); }
  }, true);

  // Long-press menus and selection (dictionary look-up) get in the way of rapid tapping.
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("selectstart", (e) => e.preventDefault());

  SVT.boot = () => {
    const off = SVT.load();
    // The game opens on the home screen; a brand-new player goes straight into the garage for the intro.
    if (SVT.state().seenIntro) view = "home";
    render();
    SVT.start();
    // One loop: the game steps every animation frame so movement is smooth, moving parts redraw every frame,
    // and numbers and buttons refresh about 7 times a second.
    let lastUi = 0;
    (function loop(t) {
      SVT.step();
      for (let i = 0; i < frames.length; i++) { const f = frames[i]; if (f.e.isConnected) f.fn(f.e); }
      if (dirty || t - lastUi > 150) { dirty = false; update(); lastUi = t; }
      requestAnimationFrame(loop);
    })(0);
    if (!SVT.state().seenIntro) showIntro();
    else if (off) showOffline(off);
  };
})();
