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
  // v0.53.6 (user: "It's running laggy"): floors scrolled out of view stop animating and skip their per-frame and
  // per-tick updates. A 30-floor lab ran ~150 looping animations and 30 progress bars every frame, mostly off screen.
  const offRows = typeof IntersectionObserver === "function" ? new IntersectionObserver((list) => {
    for (const en of list) {
      const row = en.target, off = !en.isIntersecting;
      if (row.classList.contains("off") === off) continue;
      row.classList.toggle("off", off);
      for (const x of frames) if (row.contains(x.e)) x.off = off;
      for (const x of binds) if (row.contains(x.e)) x.off = off;
      if (!off) dirty = true;
    }
  }, { rootMargin: "40px 0px" }) : null;
  const watchRow = (row) => { if (offRows) offRows.observe(row); return row; };
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
  // Viking mines have up to 50 shafts, so the raid def brings its own tier split (10 shafts a tier).
  const tierOf = (n) => (def().tierOf ? def().tierOf(n) : B.tierOf(n));
  function teamName(n) { return def().teams[tierOf(n)]; }
  function tierName(n) { const d = def(); return d.tiers ? d.tiers[tierOf(n)] : SVT.TIERS[tierOf(n)].name; }
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
    // Rebuilding a panel that is already open (hire, assign, buy) swaps it in place with no spring, so the
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
    // v0.36.1: iPhones sometimes drop the click on the dimmed backdrop (a plain div), so a press that starts and
    // ends on the backdrop closes the panel from the pointer events as well; the click that may follow is swallowed.
    let bd = null;
    wrap.addEventListener("pointerdown", (e) => { bd = e.isPrimary && e.target === wrap ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
    wrap.addEventListener("pointercancel", () => { bd = null; });
    wrap.addEventListener("pointerup", (e) => {
      const b = bd; bd = null;
      if (!b || opts.sticky || e.target !== wrap || Math.hypot(e.clientX - b.x, e.clientY - b.y) > 14 || performance.now() - b.t > 700) return;
      swallowNextClick();
      closeSheet();
    });
    document.body.append(wrap);
    document.body.classList.add("sheet-open");
    curNav = nav || null;
  }
  function closeSheet() {
    const s = document.getElementById("sheet");
    detail = null; curNav = null;
    if (!s) return;
    s.remove();
    document.body.classList.remove("sheet-open");
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
      h("div", { class: "top-btns" },
        h("button", { class: "top-gear", "aria-label": "Settings", onclick: openSettings, text: "⚙" })), // v0.40: 🏠 moved to the middle of the bottom bar
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
  // v0.40: one helper for both mini games (Rush and Bug Hunt).
  function gameNav(item, icon, name, open, leftFn, waitFn, multFn, aria) {
    const b = item(icon, name, open, { class: "nav-btn rush-nav", "aria-label": aria });
    const label = b.lastChild;
    return bind(b, (e) => {
      const left = leftFn();
      setText(label, left > 0 ? "×" + multFn() + " " + SVT.boostShort(left) : name);
      toggle(e, "ready", !waitFn() && !left);
      toggle(e, "boosted", left > 0);
    });
  }
  const rushNav = (item) => gameNav(item, "🏭", "Rush", SVT.openRush, SVT.rushLeft, SVT.rushWait, () => SVT.state().rush.mult, "Assembly Line Rush mini game");
  const bugsNav = (item) => gameNav(item, "🐛", "Bugs", SVT.openBugs, SVT.bugsLeft, SVT.bugsWait, () => SVT.state().bugs.mult, "Bug Hunt mini game");
  function bottomNav() {
    const item = (icon, label, on, attrs) => h("button", Object.assign({ class: "nav-btn", onclick: on }, attrs), h("span", { class: "nav-ic", "aria-hidden": "true", text: icon }), h("span", { text: label }));
    // In Viking Raid there is no funding: the first button opens the stage list instead.
    const fund = inRaid()
      ? bind(item("🛡", "Stages", openRaid, { class: "nav-btn fund" }), (e) => toggle(e, "ready", !!lab().won))
      : bind(item("💰", "Funding", openFunding, { class: "nav-btn fund" }), (e) => toggle(e, "ready", SVT.canRaise(lab())));
    // v0.40 (user ask): Home sits in the middle as the big green button, with both mini games beside it.
    return h("nav", { class: "bottom-nav seven", "aria-label": "Main" },
      fund,
      item("👔", "Managers", () => openManagers("floor", null, 0), { "aria-label": "Owned managers" }),
      rushNav(item),
      item("🏠", "Home", () => setView("home"), { class: "nav-btn center", "aria-label": "Home screen" }),
      bugsNav(item),
      item("🗺", "Map", () => setView("map"), { "aria-label": "Map" }),
      item("🤖", "Chip", () => SVT.openChip(), { "aria-label": "Chip upgrades" }));
  }

  // ---------- managers ----------
  const roleOf = (kind) => kind;
  // Job title from the lab's theme (v0.30): a floor manager in the Arcade District is a Cabinet Builder.
  const CREW_IDX = { floor: 0, freight: 1, commercial: 2 };
  const crewTitle = (role) => ((def().crew || [])[CREW_IDX[role]]) || B.ROLE_NAMES[role];
  const secs = (x) => (x >= 60 && x % 60 === 0 ? x / 60 + " min" : x + " s");
  function effectText(m) {
    const ab = SVT.abilityOf(m), st = SVT.abilityStats(m);
    if (m.sup) return ab.icon + " " + ab.name + ": " + ab.text + " for " + secs(st.active) + " · " + secs(Math.round(st.cooldown)) + " rest. " + ab.perkIcon + " " + ab.perkName + ": " + ab.passiveText + ".";
    if (ab.kind === "special") return ab.icon + " " + secs(st.active) + " · " + secs(st.cooldown) + " cooldown. " + ab.text + " Passive: " + ab.passiveText + ".";
    const K = B.ABILITY_KINDS[ab.kind];
    const what = ab.kind === "speed" ? "×" + st.mult + " speed" + (m.role === "floor" ? " (builds)" : m.role === "freight" ? " (travels and loads)" : " (loads and ships)") : ab.kind === "storage" ? "×" + st.mult + " load" : "−" + Math.round(st.off * 100) + "% upgrades";
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
  // v0.53.1 (user: "2 tabs. Regular managers on the right which is auto selected and then you can open up super
  // managers on the left"): every fresh open starts on Regular; rebuilds after an action and ‹ › keep the tab.
  function openManagers(role, kind, n, _back, dir, tab) {
    sheetCtx = { role, kind, n };
    const mgrTab = tab === "super" ? "super" : "regular";
    const L = lab();
    const here = kind ? SVT.slotKey(kind, n) : null;
    const reopen = () => openManagers(role, kind, n, null, null, mgrTab);
    const current = kind ? SVT.mgrOf(L, kind, n) : null;
    // Free managers first, then managers busy elsewhere (greyed out at the bottom). Within each, grouped by ability
    // type (speed, storage, then price) with the best rarity at the top of each group. SVT.owned is already in
    // rarity order, so the index keeps that inside a group.
    const busy = (m) => !!SVT.slotOfMgr(L, m.id);
    const KIND = { special: 0, speed: 1, storage: 2, discount: 3 }, kindOf = (m) => SVT.ability(m.role, m.ability).kind;
    const list = SVT.owned(L, role).filter((m) => m !== current && (mgrType === "all" || kindOf(m) === mgrType)).map((m, i) => [m, i])
      .sort((a, b) => busy(a[0]) - busy(b[0]) || KIND[kindOf(a[0])] - KIND[kindOf(b[0])] || a[1] - b[1]).map((x) => x[0]);
    const GROUP = { special: "🌟 Super managers: game changers", speed: "⚡ Speed managers: rarer runs faster and longer", storage: "📦 Storage: bigger loads", discount: "💸 Price: cheaper upgrades" };
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
      if (slot) btns.push(h("button", { class: "btn small ghost", onclick: () => { SVT.unassign(m.id); reopen(); }, text: "Unassign" })); // v0.31.2: no selling
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
    // v0.31: Auto-assign puts the rarest Floor Leads on the deepest floors (floors only; cooling-down managers stay put).
    const auto = bind(h("button", { class: "btn auto-assign", onclick: () => {
      const r = SVT.autoAssign(), n = r.floor;
      toast((n ? "Auto-assigned " + n + " floor manager" + (n === 1 ? "" : "s") + ": rarest at the bottom" : "Every floor manager is already where their rarity puts them") + (r.skipped ? " · " + r.skipped + " cooling down, left alone" : ""));
      reopen();
    } }, h("span", { "aria-hidden": "true", text: "🪄" }), h("span", { text: " Auto-assign floors: best managers at the bottom" })),
      (e) => setDisabled(e, !SVT.owned(L, "floor").length));
    parts.push(auto);
    // v0.42: every manager is a Speed manager, so the type filter is replaced by the rarity table (speed and length).
    if (MGR_TYPES.length > 2) parts.push(h("div", { class: "filters types", role: "tablist", "aria-label": "Manager type" }, MGR_TYPES.map(([t, ic, label]) =>
      h("button", { class: "filter type" + (t === mgrType ? " on" : ""), role: "tab", "aria-selected": t === mgrType ? "true" : "false", "data-type": t,
        onclick: () => { mgrType = t; openManagers(role, kind, n); } }, h("span", { "aria-hidden": "true", text: ic }), h("small", { text: label + (t === "all" ? "" : " " + SVT.owned(L, role).filter((m) => kindOf(m) === t).length) })))));
    else parts.push(h("ul", { class: "speed-table", "aria-label": "Speed by rarity" }, B.RANKS.slice().reverse().map((r) => {
      const st = B.ABILITY_STATS[r.id].speed;
      return h("li", { class: "r-" + r.id }, h("b", { text: r.name }), h("span", { text: "⚡×" + st.mult + " · " + secs(st.active) }), h("small", { class: "muted", text: secs(st.cooldown) + " rest" }));
    })));
    const emptyText = here && current ? "No other " + B.ROLE_NAMES[role] + "s yet." : mgrType !== "all" ? "No " + B.ABILITY_KINDS[mgrType].name.toLowerCase() + " managers here yet." : "None yet. Hire one below.";
    parts.push(h("div", { class: "sec-label", text: here ? "Your " + B.ROLE_NAMES[role] + "s:" : B.ROLE_NAMES[role] + "s:" }),
      h("ul", { class: "mlist" }, cards.length ? cards : h("li", { class: "muted empty", text: emptyText })),
      h("p", { class: "muted small odds", text: "Each hire rolls Legendary 0.5%, Epic 4.5%, Rare 15%, Uncommon 40% or Common 40%. Every manager is a Speed manager: the rarer, the faster and the longer it runs. Funding rounds send every manager away." }));
    // Children stay put (only their text changes), so a finger on the button never loses its target mid-tap.
    const hireCost = h("b");
    const hire = bind(h("button", { class: "btn fund-cta big hire", onclick: () => {
      const m = SVT.hire(role);
      if (!m) return;
      // Hiring from a slot's panel puts the new manager straight to work there, unless a rarer one already works it
      // or (v0.31.2) the one there is mid-ability: then the new hire waits on the bench.
      const cur = here ? SVT.mgrOf(lab(), kind, n) : null;
      const live = !!cur && SVT.isActive(cur);
      const put = here && !live && (!cur || SVT.RANK_ORDER[m.rank] <= SVT.RANK_ORDER[cur.rank]);
      if (put) SVT.assign(m.id, kind, n);
      toast("Hired " + SVT.rank(m.rank).name + " " + (SVT.isSuper(m) ? SVT.abilityOf(m).name + " (" + m.name + ")" : crewTitle(role) + " " + m.name) + (put ? " · now runs " + SVT.slotName(here) : live ? " · " + cur.name + "'s ability is running, so the new hire waits below" : ""), "r-" + m.rank);
      reopen();
    } },
      h("span", { text: "Hire manager" }), hireCost),
      (e) => { const c = SVT.hireCost(lab(), role); setText(hireCost, "$" + fmt(c)); setDisabled(e, lab().cash < c); });
    // v0.39 (user ask): Hire max fills every empty seat of this role while the cash lasts.
    const hireMaxN = h("b");
    const hireMax = bind(h("button", { class: "btn fund-cta big hire hire-max", onclick: () => {
      const got = SVT.hireMany(role);
      if (!got.length) return;
      const best = got.slice().sort((a, b) => SVT.RANK_ORDER[a.rank] - SVT.RANK_ORDER[b.rank])[0];
      toast("Hired " + got.length + " " + B.ROLE_NAMES[role] + (got.length === 1 ? "" : "s") + " · best: " + SVT.rank(best.rank).name + " " + best.name + (role === "floor" ? " · rarest at the bottom, the rest wait below" : SVT.mgrOf(lab(), role, 0) === best ? " · now runs " + SVT.slotName(SVT.slotKey(role, 0)) : " · waits below"), "r-" + best.rank);
      reopen();
    } }, h("span", { text: "Hire max" }), hireMaxN),
      (e) => { const n = SVT.hireManyQuote(lab(), role); setText(hireMaxN, n ? "×" + n : "no cash"); setDisabled(e, n < 1); });
    let nav = null;
    if (here) {
      const slots = nodeList(), i = Math.max(0, slots.findIndex(([k, m]) => k === kind && m === n));
      const go = (d) => { const [k, m] = slots[(i + d + slots.length) % slots.length]; openManagers(k, k, m, null, d, mgrTab); };
      nav = { prev: () => go(-1), next: () => go(1), pos: (i + 1) + " of " + slots.length, dir };
    }
    // Tabs: 🦸 Super on the left, 👔 Regular on the right (selected on open).
    const supN = SVT.superList ? SVT.superList().filter((m) => SVT.superFits(m, role)).length : 0;
    const tabBtn = (t, ic, label) => h("button", { class: "filter mgr-tab" + (t === mgrTab ? " on" : ""), role: "tab", "aria-selected": t === mgrTab ? "true" : "false",
      onclick: () => openManagers(role, kind, n, null, null, t) }, h("span", { "aria-hidden": "true", text: ic }), h("small", { text: label }));
    const tabs = h("div", { class: "filters mgr-tabs", role: "tablist", "aria-label": "Manager kind" },
      tabBtn("super", "🦸", "Super managers " + supN), tabBtn("regular", "👔", "Regular managers " + SVT.owned(L, role).length));
    let body = [tabs].concat(parts), foot = h("div", { class: "panel-foot hire-row" }, hire, hireMax);
    if (mgrTab === "super") {
      const sup = here ? parts.slice(0, 2).concat(SVT.superPicker(kind, n, reopen, mgrCard))
        : [parts[0], h("div", { class: "sh-list" }, SVT.superList().filter((m) => SVT.superFits(m, role)).sort((a, b) => b.rar - a.rar || b.stars - a.stars).map((m) => SVT.superCard(m))),
          supN ? h("p", { class: "muted small", text: "Tap a seat on the lab screen to seat one." }) : h("p", { class: "muted small", text: "No super managers for this role yet." })];
      body = [tabs].concat(sup);
      foot = h("div", { class: "panel-foot hire-row" }, h("button", { class: "btn fund-cta big hire", onclick: () => SVT.openSupers(), text: "🎰 Headhunter Slots · 💠 " + fmt(SVT.superCoins()) }));
    }
    sheet(here ? SVT.slotName(here) + " Manager" : "Managers", h("div", { class: "sheet-body mgr-panel" }, body), { icon: "👔", nav, foot });
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
      ["Value per product", () => "$" + fmt(B.floorValue(n) * SVT.shaftValue(lab(), n) * P())],
      ["Tech unlock bonus", (L) => multText(B.floorMult(L))],
    ];
    if (kind === "freight") return [
      ["Moves", (L) => "$" + fmt(B.freightCap(L, depth(), SVT.hubRaid(lab())) * P() * M()) + "/s"],
      ["Load per trip", (L) => "$" + fmt(B.freightLoad(L, SVT.hubRaid(lab())) * P() * M())],
      ["Lift speed", (L) => multText(B.freightSpeed(L))],
      ["Loading speed", (L) => "$" + fmt(B.freightLoad(L, SVT.hubRaid(lab())) / B.liftFillTime(L) * P() * M()) + "/s"],
      ["Round trip", (L) => (B.freightTrip(L, depth()) / SVT.speedMult(lab(), kind, n)).toFixed(1) + "s"],
      ["Tech unlock bonus", (L) => multText(B.hubMult(L))],
    ];
    return [
      ["Ships", (L) => "$" + fmt(B.commercialCap(L, SVT.hubRaid(lab())) * P() * M()) + "/s"],
      ["Load per trip", (L) => { const sp = SVT.speedMult(lab(), kind, n); return "$" + fmt(B.commercialCap(L, SVT.hubRaid(lab())) * P() * M() / sp * B.WH_TRIP) + " / " + +(B.WH_TRIP / sp).toFixed(1) + "s"; }],
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
      if (lv >= SVT.maxLevel(lab(), kind)) { setText(top, "Level Up x0"); setText(cost, SVT.gated(L, kind) ? "Level up shafts first" : "MAX"); setDisabled(e, true); return; }
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
      if (lv >= SVT.maxLevel(lab(), kind)) { setText(e, SVT.gated(L, kind) ? "Level up shafts first (Lv " + SVT.maxLevel(L, kind) + " for now)" : "Max level"); setDisabled(e, true); return; }
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
  const VHAIR = ["#d8b25a", "#c0602b", "#e6c97a", "#8a4b22", "#b33a1e", "#f0dc9a", "#6b4226", "#cfcfcf"]; // blond, red, white beards
  const SKIN = ["#f3d2b3", "#e8b98f", "#c98e63", "#9c6b45", "#f0c9a4", "#7a5134"];
  // v0.44 (user: "I want the managers in each mine to reflect the theme of that mine"): every lab dresses its managers
  // in its own theme: a hat style (h-*, drawn in style.css), the hat and outfit colours and a badge on the chest.
  // Rarity still shows as stripes in the rarity colour down the sides, and Legendary hats glow gold.
  const LOOKS = {
    garage: ["cap", "#2f86d6", "#dfe7ec", "🔧"], arcade: ["phones", "#9a5ae0", "#2b1f3a", "🕹️"], library: ["grad", "#222", "#8a5a3c", "📚"],
    maker: ["beanie", "#ef7d2d", "#3d6a9e", "🛠️"], studio: ["phones", "#222", "#3a3a3a", "🎧"], cinema: ["beret", "#d23a3a", "#1d1d1d", "🎬"],
    robotics: ["goggles", "#607d8b", "#90a4ae", "🤖"], auto: ["cap", "#e53935", "#2c3e66", "🔋"], space: ["bubble", "#cfd8dc", "#f2f2f2", "🚀"],
    medtech: ["scrub", "#3bb3a6", "#3bb3a6", "🩺"], agri: ["straw", "#e6c46a", "#5a8f3a", "🌾"], ocean: ["goggles", "#1e88e5", "#1d3557", "🌊"],
    arctic: ["beanie", "#6fa8dc", "#e8f1fa", "❄️"], geo: ["hardhat", "#ff8c1a", "#ff8c1a", "🌋"], stadium: ["cap", "#d63a3a", "#f5f5f5", "🏆"],
    fashion: ["beret", "#f06292", "#fce4ec", "👗"], toys: ["santa", "#d32f2f", "#2e8b57", "🧸"], home: ["cap", "#43a047", "#c5e1a5", "🏠"],
    drone: ["phones", "#6d4c41", "#556b2f", "🛸"], cyber: ["hood", "#1b1b2f", "#26264a", "🔐"], fintech: ["tophat", "#c9a227", "#263238", "💰"],
    weather: ["hood", "#f2c230", "#f2c230", "⛅"], rail: ["conductor", "#1f3a5f", "#1f3a5f", "🚄"], biotech: ["goggles", "#43a047", "#f7f7f7", "🧬"],
    quantum: ["goggles", "#7e57c2", "#ece6ff", "⚛️"], satellite: ["phones", "#455a64", "#78909c", "📡"], energy: ["hardhat", "#fdd835", "#c6e03a", "⚡"],
    holo: ["visor", "#26c6da", "#222244", "🥽"], mars: ["bubble", "#ff8a65", "#e2733b", "🪐"], moon: ["bubble", "#b0bec5", "#dfe3e8", "🌙"],
    // v0.48: The Frontier (labs 31-50)
    deepsea: ["bubble", "#00897b", "#0d3b4f", "🐙"], nano: ["goggles", "#90caf9", "#f5f9ff", "🔬"], cloudcity: ["beret", "#81d4fa", "#ffffff", "☁️"],
    asteroid: ["hardhat", "#8d6e63", "#4e4e5a", "☄️"], neural: ["visor", "#ec407a", "#2a1f3d", "🧠"], chrono: ["tophat", "#8d6e63", "#5d4037", "⏳"],
    jupiter: ["bubble", "#ffab91", "#b65c3a", "🌀"], dino: ["straw", "#c5a15a", "#556b2f", "🦖"], orbithotel: ["conductor", "#b71c1c", "#f5f0e6", "🏨"],
    desert: ["hood", "#e0b46c", "#d9a35a", "🏜️"], subway: ["conductor", "#37474f", "#455a64", "🚇"], rainforest: ["straw", "#7cb342", "#2e7d32", "🌳"],
    magma: ["hardhat", "#ff5722", "#3e2723", "🔥"], antimatter: ["goggles", "#ab47bc", "#ede7f6", "✴️"], elevator: ["cap", "#5c6bc0", "#c5cae9", "🛗"],
    dyson: ["visor", "#ffca28", "#5d4000", "☀️"], venus: ["bubble", "#ffd54f", "#c8a24a", "🌫️"], titan: ["beanie", "#4dd0e1", "#26425a", "🧊"],
    wormhole: ["visor", "#7c4dff", "#120a2a", "🌌"], galactic: ["tophat", "#ffd700", "#1a237e", "🏛️"],
    // v0.52: Legends (labs 51-70)
    candy: ["beret", "#ff80ab", "#fce4ec", "🍭"], kitchen: ["tophat", "#ffffff", "#eceff1", "🍳"], pirate: ["tophat", "#212121", "#b71c1c", "🏴‍☠️"],
    pyramid: ["hood", "#f9a825", "#fff3c4", "🔺"], atlantis: ["bubble", "#26a69a", "#004d61", "🔱"], castle: ["hardhat", "#9e9e9e", "#5d4037", "🏰"],
    dragon: ["hardhat", "#c62828", "#3e2723", "🐉"], wizard: ["tophat", "#5e35b1", "#311b92", "🧙"], circus: ["tophat", "#e53935", "#ffeb3b", "🎪"],
    museum: ["cap", "#6d4c41", "#d7ccc8", "🏺"], mall: ["cap", "#ec407a", "#ffffff", "🛍️"], airport: ["conductor", "#1565c0", "#e3f2fd", "✈️"],
    harbor: ["beanie", "#0d47a1", "#ff7043", "🚢"], safari: ["straw", "#a1887f", "#c5b358", "🦁"], polar: ["beanie", "#e53935", "#e3f2fd", "🐧"],
    crystal: ["hardhat", "#4dd0e1", "#4a148c", "💎"], racing: ["visor", "#d50000", "#212121", "🏎️"], olympus: ["hood", "#ffd700", "#fafafa", "🏔️"],
    dreams: ["beanie", "#9575cd", "#1a237e", "💤"], multiverse: ["visor", "#00e5ff", "#1b0033", "🌐"],
    // v0.54: Wonderworld (labs 71-90)
    ninja: ["hood", "#212121", "#37474f", "🥷"], western: ["straw", "#8d6e63", "#c19a6b", "🤠"], haunted: ["tophat", "#4a148c", "#9e9e9e", "👻"],
    steam: ["goggles", "#b8860b", "#5d4037", "⚙️"], observatory: ["beret", "#283593", "#0d1440", "🔭"], beehive: ["hood", "#fbc02d", "#212121", "🐝"],
    pets: ["cap", "#ff7043", "#ffe0b2", "🐶"], fireworks: ["hardhat", "#ff1744", "#ffd600", "🎆"], coffee: ["beret", "#6d4c41", "#d7ccc8", "☕"],
    beach: ["straw", "#ffca28", "#4fc3f7", "🏖️"], ski: ["beanie", "#1e88e5", "#ffffff", "⛷️"], opera: ["tophat", "#880e4f", "#212121", "🎭"],
    academy: ["cap", "#1a237e", "#ffd700", "🎓"], arena: ["visor", "#ff6d00", "#263238", "🥊"], mech: ["visor", "#78909c", "#263238", "🦾"],
    fairy: ["beret", "#f48fb1", "#b2ff59", "🧚"], aliens: ["bubble", "#76ff03", "#1b5e20", "👽"], skyisles: ["conductor", "#4fc3f7", "#ffffff", "☁️"],
    giant: ["hardhat", "#795548", "#9e9e9e", "🗿"], infinity: ["visor", "#ffd700", "#120024", "♾️"],
  };
  SVT.MANAGER_LOOKS = LOOKS;
  // v0.48.1: the lift car can carry several loads at once; past one load it shows how many (×2.6).
  function fullText(load, cap) { if (!(cap > 0)) return "0%"; const r = load / cap; return r > 1.005 ? "×" + (Math.round(r * 10) / 10) : Math.round(100 * r) + "%"; }
  function avatar(m, labId) {
    if (m.sup && SVT.superAvatar) return SVT.superAvatar(m); // v0.53: super managers have hero faces
    let hsh = 0;
    for (const ch of m.name) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
    const id = labId || lab().id;
    // v0.43 (user ask): in Viking Raid every manager is drawn as a Viking: horned helmet, braided beard, fur cloak.
    const viking = id === "raid", look = !viking && LOOKS[id];
    const cls = "av r-" + m.rank + (viking ? " viking" : look ? " themed h-" + look[0] : "");
    const style = "--hair:" + (viking ? VHAIR : HAIR)[hsh % (viking ? VHAIR : HAIR).length] + ";--skin:" + SKIN[(hsh >> 3) % SKIN.length] + (look ? ";--hatc:" + look[1] + ";--outfit:" + look[2] : "");
    return h("span", { class: cls, style, "aria-hidden": "true", "data-lab": id },
      h("span", { class: "fx", text: look ? look[3] : "" }), h("span", { class: "body" }), h("span", { class: "tie" }), h("span", { class: "head" }), h("span", { class: "hat" }));
  }
  SVT.avatarEl = (m, labId) => avatar(m, labId);

  // ---------- shared Idle Miner-style pieces ----------
  // Manager seat: the manager's face (rarity ring) or an empty dashed seat. Tap to hire, pick or swap.
  function seat(kind, n) {
    const el = h("button", { class: "seat empty", onclick: (e) => { e.stopPropagation(); openManagers(kind, kind, n); } });
    let shown = null;
    bind(el, () => {
      const m = SVT.mgrOf(lab(), kind, n);
      const key = m ? m.id : "none";
      if (m && m.sup) toggle(el, "live", m.activeUntil > SVT.now()); // v0.53: a super's seat flares while its power runs
      if (key === shown) return;
      shown = key;
      el.className = "seat" + (m ? " r-" + m.rank + (m.sup ? " sup" : "") : " empty");
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
      const t = SVT.now(), live = m.activeUntil > t, cd = !live && m.cdUntil > t, ab = SVT.abilityOf(m);
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
      // v0.49.1 (user: "the triangles after it's maxed out should go away ... They should just say max"): a node at its
      // level cap shows MAX and no badge (the old test gave a maxed node ▲▲▲, since 0 levels "afforded" all 0 left).
      const L = lab(), lv = SVT.levelOf(L, kind, n), max = lv >= SVT.maxLevel(L, kind);
      const d = SVT.discount(L, kind, n);
      toggle(el, "deal", d > 0);
      if (d > 0) setText(deal, "−" + Math.round(d * 100) + "%");
      popText(num, max ? "MAX" : String(lv));
      // ▲ affords 1 level, ▲▲ affords up to the next ×10 level, ▲▲▲ up to the next multiple of 50 (where Max lands).
      const m = max ? null : B.bulk(kind, n, lv, Infinity, L.cash, SVT.discount(L, kind, n), SVT.costScale(L, kind, n), SVT.maxLevel(L, kind), SVT.growthOf(L, kind));
      const can = m && L.cash >= m.cost ? m.count : 0, room = SVT.maxLevel(lab(), kind) - lv;
      const tri = max || room <= 0 || can < 1 ? 0 : can >= Math.min(room, SVT.stepTo(lv, 50)) ? 3 : can >= Math.min(room, SVT.stepTo(lv, 10)) ? 2 : 1;
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
      // v0.36.1: boosts pay out here, so the warehouse wears the current multiplier
      bind(h("div", { class: "cap-tag wh-boost", title: "Boosts multiply every delivery" }), (e) => { const m = SVT.boostMult(lab(), SVT.now()); e.hidden = !(m > 1); if (m > 1) setText(e, "⚡ ×" + (Math.round(m * 100) / 100)); }),
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

  // v0.52.3 (user ask): a themed scene on every floor's back wall that matches the lab: cars on a lift in the car
  // plants, a grill in the kitchens, notes in the studio and so on. Each sprite is "emoji anim x% y(px from the
  // floor line)"; the anims are the .fx-* keyframes in style.css. Even floors mirror the layout so rows differ.
  const FX = {
    garage: "🔧 swing 10 6|📱 hop 42 4|🔋 blink 74 4",
    arcade: "🕹️ wiggle 12 4|👾 hop 44 6|⭐ rise 46 22|👾 hop 76 6",
    library: "📚 none 8 2|📖 flip 40 6|✏️ wiggle 72 4",
    maker: "🔨 swing 12 8|🪵 none 30 2|🪚 saw 62 6",
    studio: "🎸 wiggle 10 4|🎵 rise 34 12|🎶 rise 56 12|🥁 hop 76 2",
    cinema: "🎬 snap 10 6|🎞️ spin 42 6|🍿 hop 74 2",
    robotics: "⚙️ spin 6 18|🤖 walk 40 2|⚙️ spinr 78 14",
    auto: "🚗 lift 14 2|🛞 spin 46 2|🔧 swing 64 8|💨 rise 4 6",
    space: "⭐ blink 10 26|🚀 launch 40 2|🛰️ orbit 74 16",
    medtech: "🩺 none 8 4|❤️ pulse 40 10|💉 wiggle 72 4",
    agri: "🌱 grow 8 2|💧 fall 10 26|🌱 grow 30 2|🚜 drive 0 2",
    ocean: "🐟 swim 0 12|🫧 rise 40 6|🐙 bob 72 2",
    arctic: "❄️ fall 12 30|💾 blink 40 4|🐧 walk 70 2",
    geo: "🌋 none 10 2|🔥 flicker 44 2|💨 rise 46 18|⛏️ swing 74 6",
    stadium: "⚽ hop 12 2|📣 wiggle 44 6|🏀 hop 74 2",
    fashion: "🧵 bob 10 4|🪡 stitch 40 8|👗 sway 72 2",
    toys: "🧸 bob 10 2|🪀 yoyo 44 22|🎈 rise 74 4",
    home: "💡 blink 10 24|🤖 walk 40 2|🛋️ none 74 2",
    drone: "🚁 hover 12 16|📦 hover 14 4|🛩️ drive 0 22",
    cyber: "🔒 pulse 12 6|🔑 spin 44 8|🛡️ none 74 4",
    fintech: "💰 hop 10 2|🪙 flip 42 8|📈 pulse 74 8",
    weather: "☁️ bob 12 24|💧 fall 14 18|⚡ blink 46 18|☁️ bob 72 24|💧 fall 74 18",
    rail: "🚦 blink 8 6|🚄 zoom 0 2",
    biotech: "🧪 wiggle 10 4|🫧 rise 12 18|🌿 pulse 44 2|🧬 spin 74 8",
    quantum: "⚛️ spin 12 8|✨ blink 44 14|🌀 spin 74 6",
    satellite: "📡 wiggle 10 4|🛰️ orbit 44 16|📶 blink 74 10",
    energy: "⚡ blink 10 14|🔋 pulse 42 4|🔌 wiggle 74 6",
    holo: "🕶️ bob 10 6|🌈 blink 42 12|✨ rise 74 8",
    mars: "🪨 none 6 2|👨‍🚀 walk 40 2|🚀 launch 76 2",
    moon: "🌙 bob 10 18|👨‍🚀 moonhop 42 2|⭐ blink 76 24",
    deepsea: "🐠 swim 0 14|🫧 rise 40 4|🦑 bob 74 2",
    nano: "🔬 none 10 2|⚛️ spin 44 10|✨ blink 74 12",
    cloudcity: "☁️ drift 0 24|🎈 rise 30 2|🛩️ drive 0 8",
    asteroid: "☄️ zoom 0 24|⛏️ swing 30 6|🪨 hop 60 2",
    neural: "🧠 pulse 12 6|⚡ blink 44 14|💭 rise 72 6",
    chrono: "⏰ wiggle 10 4|⌛ flip 42 6|🕰️ none 74 2",
    jupiter: "🪐 spinslow 12 8|🛰️ orbit 46 16|⭐ blink 76 24",
    dino: "🥚 wiggle 10 2|🦖 walk 40 2|🦕 bob 76 2",
    orbithotel: "🛎️ hop 10 2|🧳 drive 0 2|🌍 spinslow 74 14",
    desert: "☀️ pulse 10 22|🐪 walk 40 2|🌵 none 76 2",
    subway: "🚦 blink 8 6|🚇 zoom 0 2|💨 rise 70 4",
    rainforest: "🦜 hover 12 18|🌿 sway 44 2|💧 fall 74 26",
    magma: "🔥 flicker 10 2|⚒️ swing 40 6|💨 rise 42 20|🔥 flicker 74 2",
    antimatter: "⚛️ spin 12 8|💥 pulse 44 8|✨ blink 74 14",
    elevator: "⭐ blink 8 26|🛗 lift 40 2|🚀 launch 74 2",
    dyson: "☀️ spinslow 12 8|🛰️ orbit 46 16|⚡ blink 74 10",
    venus: "🎈 bob 12 12|☁️ drift 0 24|🌋 none 74 2",
    titan: "🧊 none 8 2|🪐 spinslow 42 12|🚀 launch 76 2",
    wormhole: "🌀 spin 12 8|✨ rise 44 6|🚀 zoom 0 18",
    galactic: "⭐ blink 8 24|🛸 hover 40 12|🌌 none 74 6",
    candy: "🍭 spin 10 6|🥣 wiggle 40 2|🍬 hop 44 18|🧁 bob 74 2",
    kitchen: "🔥 flicker 14 0|🍳 wiggle 12 8|🥩 flipup 14 14|♨️ rise 40 10|🍔 flipup 72 6",
    pirate: "🏴‍☠️ sway 10 10|⛵ rock 42 2|💰 hop 74 2",
    pyramid: "☀️ pulse 10 24|🔺 none 40 2|🐪 walk 72 2",
    atlantis: "🔱 swing 10 6|🐚 bob 42 2|🫧 rise 74 6",
    castle: "⚔️ swing 12 8|🛡️ none 42 4|🏰 none 74 2",
    dragon: "🐉 bob 8 6|🔥 breath 30 10|⚒️ swing 72 6",
    wizard: "🪄 swing 12 8|✨ rise 14 18|🔮 pulse 44 4|📜 sway 74 4",
    circus: "🤹 bob 12 2|🎪 none 42 2|🎈 rise 74 4",
    museum: "🏺 none 10 2|🦴 wiggle 42 6|🔦 swing 74 8",
    mall: "🛍️ bob 10 4|🛒 drive 0 2|💳 flip 74 8",
    airport: "🧳 drive 0 2|✈️ takeoff 30 6|🛄 none 76 2",
    harbor: "⚓ swing 10 8|🚢 drift 0 2|📦 bob 76 2",
    safari: "🦒 bob 8 2|🦁 walk 42 2|📷 blink 76 14",
    polar: "❄️ fall 10 30|🐧 walk 40 2|🧊 none 76 2",
    crystal: "💎 pulse 12 6|✨ blink 30 18|⛏️ swing 44 6|💎 pulse 76 4",
    racing: "🏎️ zoom 0 2|🛞 spin 30 16|🔧 swing 56 10|🏁 sway 80 8",
    olympus: "⚡ blink 10 18|🏛️ none 42 2|🦅 hover 74 16",
    dreams: "🛏️ none 8 2|💤 rise 12 14|🌙 bob 44 16|⭐ blink 74 22",
    multiverse: "🌀 spin 10 8|🪐 orbit 44 14|🌌 none 74 6",
    ninja: "🥷 hop 12 2|✴️ spin 44 14|🏮 sway 76 14",
    western: "🤠 bob 10 4|🐎 walk 40 2|🌵 none 76 2",
    haunted: "👻 hover 12 16|🦇 hover 44 22|🕯️ flicker 76 2",
    steam: "⚙️ spin 8 16|💨 rise 40 12|⚙️ spinr 74 12",
    observatory: "🔭 none 10 2|⭐ blink 42 22|☄️ zoom 0 26",
    beehive: "🐝 hover 12 14|🌻 sway 42 2|🍯 bob 76 2",
    pets: "🐕 walk 40 2|🐈 bob 10 2|🦴 hop 76 4",
    fireworks: "🎆 pulse 12 18|🚀 launch 44 2|🎇 blink 76 20",
    coffee: "☕ bob 10 2|♨️ rise 12 12|🫘 hop 44 4|🥐 none 76 2",
    beach: "☀️ pulse 10 22|🏄 rock 42 4|🦀 walk 72 2",
    ski: "⛷️ zoom 0 2|❄️ fall 30 30|🏔️ none 76 2",
    opera: "🎭 sway 10 10|🎻 wiggle 42 4|🎵 rise 74 10",
    academy: "📐 wiggle 10 6|🧪 bob 42 4|🎓 flip 74 10",
    arena: "🤖 hop 12 2|💥 pulse 44 10|🏆 bob 76 4",
    mech: "🦾 swing 12 8|⚡ blink 44 16|🤖 walk 70 2",
    fairy: "🧚 hover 12 16|✨ blink 44 20|🍄 bob 76 2",
    aliens: "🛸 hover 12 18|👽 hop 44 2|✨ blink 76 22",
    skyisles: "☁️ drift 0 24|🪁 sway 40 14|🎈 rise 74 4",
    giant: "🗿 none 8 2|🪨 hop 42 2|🔨 swing 74 8",
    infinity: "♾️ pulse 12 10|✨ blink 44 18|🌀 spin 76 8",
    raid: "⛏️ swing 12 6|🪓 swing 44 6|🛡️ none 76 4"
  };
  const FX_RUN = { drive: 1, zoom: 1, swim: 1, drift: 1 }; // these cross the whole wall, so their x is ignored
  function themeFx(n) {
    const spec = FX[lab().id] || FX.garage, flip = n % 2 === 0;
    return h("div", { class: "fx", "aria-hidden": "true" }, spec.split("|").map((s, i) => {
      const [e, a, x, y] = s.split(" "), run = FX_RUN[a];
      const left = run ? 0 : flip ? 84 - +x : +x;
      return h("span", { class: "fxs fx-" + a + (run ? " run-across" : ""), style: "left:" + left + "%;bottom:" + y + "px;--d:" + (-(n * 0.37 + i * 0.6)).toFixed(2) + "s" }, h("i", { text: e }));
    }));
  }

  // The floor's production line: build at the bench (sparks), wrap at the packer, ride the belt to the crate.
  // It is drawn left-to-right and mirrored so products flow toward the crate on the left, like Idle Miner's shafts.
  // The tool and sparks change by tech era (see .tier* in style.css). Everything pauses when nobody is working.
  function productionLine(n) {
    const sparks = h("div", { class: "sparks" }, [0, 1, 2, 3, 4].map((k) => h("span", { style: "--k:" + k })));
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
    const tier = tierOf(n);
    const scene = runBind(h("div", { class: "scene floor-scene", onclick: () => SVT.tap("floor", n) },
      h("div", { class: "rock", "aria-hidden": "true" }),
      themeFx(n),
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
    const row = watchRow(h("div", { class: "floor tier" + tier, "data-floor": n }, scene, fly));
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
    if (!nf) return h("div", { class: "floor done" }, h("div", { class: "fbody" }, h("b", { text: inRaid() ? (lab().floors.length === 1 ? "The shaft is open. Take it" : "All " + lab().floors.length + " shafts open. Take every shaft") + " to Lv " + SVT.raidStage(lab()).max.floor + " and the lift and warehouse to Lv " + SVT.raidStage(lab()).max.freight + " to clear the raid." : maxedText(lab()) })));
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
    // v0.41 (user ask): Unlock max opens as many shafts (or floors) as the cash allows, shown once it would open 2+.
    const many = bind(h("button", { class: "btn up unlock-max", onclick: () => { const k = SVT.unlockMany(); if (k) toast((inRaid() ? "⛏ Opened " + k + " shafts" : "⬆ Unlocked " + k + " floors")); } }), (e) => {
      const q = SVT.unlockManyQuote(lab());
      toggle(e, "show", q.count >= 2);
      if (q.count >= 2) setText(e, "Unlock max ×" + q.count + " · $" + fmt(q.cost));
    });
    return h("div", { class: "floor locked" },
      h("div", { class: "fnum", text: n }),
      h("div", { class: "fbody" },
        h("div", { class: "fname" }, h("b", { text: productName(n) }), h("span", { class: "muted", text: " · " + tierName(n) })),
        h("div", { class: "actions" }, btn, many)));
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
      setText(carAmt, fmt(lift.load));
      setText(carPct, fullText(lift.load, SVT.liftCapacity(L)));
    });
    const list = h("div", { class: "floors" }, floors, lockedRow());
    // How full the car is against what it can hold.
    const capLoad = h("b"), capRest = h("span");
    const capTag = bind(h("div", { class: "cap-tag" }, "🛗 Lift ", capLoad, capRest), () => {
      const L = lab(), load = L.lift ? L.lift.load : 0, cap = SVT.liftCapacity(L);
      setText(capLoad, "$" + fmt(load)); setText(capRest, " / $" + fmt(cap) + " · " + fullText(load, cap) + (load > cap ? "" : " full"));
    });
    return h("section", { class: "building" }, capTag, shaft, list);
  }

  // Idle Miner's jump arrows, bottom left: ⬆ glides back to the top of the mine, ⬇ down to the deepest floor.
  // Each shows only when there is somewhere to go, and you see the page scroll.
  let scrollAnim = 0;
  // v0.53.6: the page height is read at most once a second; reading it after the numbers change forced a full layout.
  let pageH = 0, pageAt = 0, scrollTop = window.scrollY;
  window.addEventListener("scroll", () => { scrollTop = window.scrollY; }, { passive: true });
  const maxScroll = (fresh) => { const t = performance.now(); if (fresh || t - pageAt > 1000) { pageH = document.documentElement.scrollHeight; pageAt = t; } return pageH - window.innerHeight; };
  // v0.53.7: the jump-down button only needs to know whether the bottom of the page is in view; an observer on the
  // footer tells it without measuring the page (that forced a full layout of every floor once a second).
  let nearBottom = false;
  const bottomSeen = typeof IntersectionObserver === "function" ? new IntersectionObserver((l) => { for (const en of l) nearBottom = en.isIntersecting; }, { rootMargin: "240px 0px" }) : null;
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
      (e) => toggle(e, "show", scrollTop > 240));
    const down = bind(h("button", { class: "jump-btn down", "aria-label": "Down to the bottom of the mine", onclick: () => glideTo(maxScroll(true)), text: "⬇" }),
      (e) => toggle(e, "show", bottomSeen ? !nearBottom : maxScroll() - scrollTop > 240));
    // v0.39 (user ask): Max all. v0.40.2: each buy goes to whatever is backing up (see SVT.upgradeAll); the toast
    // says where most of the money went.
    const maxAll = bind(h("button", { class: "jump-btn max-all", "aria-label": "Max all upgrades", onclick: () => {
      const r = SVT.upgradeAll();
      const by = {}; r.order.forEach((o) => { const k = o.replace(/\d+$/, ""); by[k] = (by[k] || 0) + 1; });
      const top = Object.keys(by).sort((a, b) => by[b] - by[a])[0];
      const where = top === "freight" ? ", mostly the lift" : top === "commercial" ? ", mostly the warehouse" : top ? ", mostly the mines" : "";
      // v0.53.5: Max all can open new floors too
      const opened = r.order.filter((o) => /^(open|unlock)/.test(o)).length, what = inRaid() ? (opened === 1 ? " shaft" : " shafts") : opened === 1 ? " floor" : " floors";
      toast(r.levels || opened ? "⬆ Max all: " + (opened ? "opened " + opened + what + (r.levels ? ", " : "") : "") + (r.levels ? "+" + r.levels + " levels" : "") + " for $" + fmt(r.spent) + (opened ? "" : where) : "Nothing affordable to upgrade right now");
    }, text: "⬆" }), (e) => { const can = SVT.upgradeAllQuote(lab()); toggle(e, "show", can > 0); e.title = can ? "Max all: +" + can + " levels" : ""; });
    return h("div", { class: "jump-btns" }, maxAll, up, down);
  }

  // ---------- views ----------
  function labView() {
    return h("main", { class: "lab-view" + (inRaid() ? " raid" : "") },
      header(),
      surface(),
      building(),
      (() => { const f = h("footer", { class: "foot", text: "Silicon Valley Tycoon " + buildTag() }); nearBottom = false; if (bottomSeen) { bottomSeen.disconnect(); bottomSeen.observe(f); } return f; })(),
      bottomNav(),
      jumpBtns());
  }

  let beatenOpen = false;
  // v0.52.3 (user: "Islands on the map should also have a drop down", in the rarity drop-down style): each map region
  // and the Islands list fold. Until you choose, only the region with your current lab is open.
  let mapOpen = null;
  function mapView() {
    const S = SVT.state();
    // v0.48: labs carry a map number (no number = the first map); The Frontier (labs 31-50) is the second.
    const pinsOn = (m) => SVT.LABS.map((l, i) => ((l.map || 1) === m ? pin(l, i) : null)).filter(Boolean);
    const pin = (l, i) => {
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
    };
    if (!mapOpen) { const cur = SVT.labDef(S.activeLab); mapOpen = new Set([cur && cur.map ? cur.map : S.activeLab === "raid" ? "isles" : 1]); }
    const region = (key, title, body) => h("details", { class: "fold map-fold", "data-region": key, open: mapOpen.has(key) ? "" : null, ontoggle: (e) => { if (e.currentTarget.open) mapOpen.add(key); else mapOpen.delete(key); } },
      h("summary", { text: title }), body);
    const regionTitle = (m, name) => { const ls = SVT.LABS.map((l, i) => [l, i]).filter(([l]) => (l.map || 1) === m), first = ls[0][1] + 1, last = ls[ls.length - 1][1] + 1;
      return name + " · labs " + first + "–" + last + " (" + ls.filter(([l]) => SVT.labBeaten(S.labs[l.id])).length + " of " + ls.length + " beaten)"; };
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
        // v0.52.1 (user: "beaten labs can be hidden under a drop down menu so when I go to pick a lab I don't have to scroll"):
        // folded away by default; the open/closed choice is kept while you stay in the game.
        beatenRows.length ? h("details", { class: "fold loc-beaten", open: beatenOpen ? "" : null, ontoggle: (e) => { beatenOpen = e.currentTarget.open; } },
          h("summary", { text: "🏆 Beaten labs (" + beatenRows.length + ")" }), h("p", { class: "muted small", text: "Tap one to replay it for another 🪙." }), ...beatenRows) : null,
        region("isles", "🏝️ Islands (1)", raidCard()),
        h("p", { class: "muted small", text: "Each lab is its own company with 30 floors and its own cash. Up to 5 labs are open at a time: Seed funding opens labs 2 to 5, and beating a lab (raising its IPO) opens a new one, all the way to lab " + SVT.LABS.length + " in Wonderworld." })),
      h("div", { class: "map-wrap" },
        region(1, regionTitle(1, "🌉 Silicon Valley"), h("div", { class: "map" },
          h("div", { class: "bay", "aria-hidden": "true" }),
          h("div", { class: "road r1", "aria-hidden": "true" }), h("div", { class: "road r2", "aria-hidden": "true" }), h("div", { class: "road r3", "aria-hidden": "true" }),
          pinsOn(1))),
        region(2, regionTitle(2, "🚀 The Frontier"), h("div", { class: "map frontier" },
          h("div", { class: "nebula", "aria-hidden": "true" }),
          h("div", { class: "road r1", "aria-hidden": "true" }), h("div", { class: "road r2", "aria-hidden": "true" }),
          pinsOn(2))),
        // v0.52: Legends, the third map (labs 51-70)
        region(3, regionTitle(3, "🏰 Legends"), h("div", { class: "map legends" },
          h("div", { class: "sea", "aria-hidden": "true" }),
          h("div", { class: "road r1", "aria-hidden": "true" }), h("div", { class: "road r2", "aria-hidden": "true" }),
          pinsOn(3))),
        // v0.54: Wonderworld, the fourth map (labs 71-90)
        region(4, regionTitle(4, "🌈 Wonderworld"), h("div", { class: "map wonder" },
          h("div", { class: "rainbow", "aria-hidden": "true" }),
          h("div", { class: "road r1", "aria-hidden": "true" }), h("div", { class: "road r2", "aria-hidden": "true" }),
          pinsOn(4)))),
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
    const right = h("span", { class: "muted", text: S.raid.cleared >= R.STAGES ? "All " + R.STAGES + " cleared" : "Stage " + SVT.raidNext() + " of " + R.STAGES });
    return h("button", { class: "loc island", onclick: openRaid },
      h("span", { class: "lab-icon", text: "⚔️" }),
      h("span", { class: "loc-name" }, h("b", { text: "Viking Raid" }), h("span", { class: "muted", text: R.BATCHES + " batches of " + R.PER + " mines · 🛡 " + SVT.vikingTokens() + " tokens · ⛵ " + SVT.boatsUnlocked() + " of " + R.BOATS + " boats" })), right);
  }
  function stageTime(s) { const t = SVT.RAID.time(s); return t < 3600 ? "~" + Math.round(t / 60) + " min" : "~" + (Math.round(t / 360) / 10) + " h"; }
  // Stage list: a tab per batch of 50, then the batch's stages: cleared, the next one to raid, and the locked ones.
  function openRaid(batchPick) {
    const S = SVT.state(), R = SVT.RAID, next = SVT.raidNext(), cur = S.labs.raid;
    let pick = cur && !cur.won ? cur.stage : next;
    let batch = batchPick || R.batchOf(pick);
    const info = h("div", { class: "raid-info" });
    const go = h("button", { class: "btn fund-cta big" });
    const live = () => !!cur && cur.stage === pick && !cur.won;
    const tabs = h("div", { class: "batch-tabs" }, Array.from({ length: R.BATCHES }, (_, i) => {
      const b = i + 1, from = i * R.PER, done = Math.max(0, Math.min(R.PER, S.raid.cleared - from)), open = S.raid.cleared >= from;
      return h("button", { class: "batch-tab" + (open ? "" : " locked"), "data-b": b, "aria-label": "Batch " + b + ": " + R.BATCH_NAMES[i],
        onclick: () => { if (!open) { toast("🔒 Clear batch " + i + " first"); return; } batch = b; show(); } },
        h("b", { text: "Batch " + b }), h("span", { text: done + " / " + R.PER }));
    }));
    const stages = h("div", { class: "stages" });
    const show = () => {
      tabs.querySelectorAll(".batch-tab").forEach((b) => toggle(b, "sel", +b.dataset.b === batch));
      stages.replaceChildren(...Array.from({ length: R.PER }, (_, i) => {
        const s = (batch - 1) * R.PER + i + 1, done = s <= S.raid.cleared, open = s <= next;
        return h("button", {
          class: "stage" + (done ? " done" : open ? " open" : " locked") + (s === pick ? " sel" : ""), "data-s": s, "aria-label": "Stage " + s + (done ? ", cleared" : open ? "" : ", locked"),
          onclick: () => { if (!open) { toast("🔒 Clear stage " + (s - 1) + " first"); return; } pick = s; show(); },
        }, h("span", { text: String(i + 1) }));
      }));
      const st = R.stage(pick);
      info.replaceChildren(
        h("div", { class: "raid-title" }, h("b", { text: "Stage " + pick + ": " + st.name }), h("span", { class: "muted", text: stageTime(pick) })),
        h("div", { class: "muted small", text: st.batchName + " " + st.level + " of " + R.PER + " · " + st.floors + (st.floors === 1 ? " shaft" : " shafts") + " to Lv " + st.max.floor + ", lift and warehouse to Lv " + st.max.freight + " · 🛡 " + (pick <= S.raid.cleared ? R.TOKENS.replay + " token (replay)" : st.tokens + (st.tokens === 1 ? " token" : " tokens")) }),
        st.omens.length ? h("ul", { class: "omens" }, st.omens.map((o) => h("li", null, h("b", { text: o.name }), h("span", { class: "muted", text: " · " + o.text })))) : h("p", { class: "muted small", text: "No omens on this mine." }));
      go.textContent = live() ? "Continue stage " + pick : pick <= S.raid.cleared ? "Raid stage " + pick + " again" : "Raid stage " + pick;
    };
    let armed = null;
    go.addEventListener("click", () => {
      // Starting another stage drops an unfinished one, so that takes a second tap.
      if (!live() && cur && !cur.won && armed !== pick) { armed = pick; go.textContent = "Tap again: stage " + cur.stage + " progress is lost"; return; }
      if (live()) SVT.switchLab("raid"); else SVT.startRaid(pick);
      closeSheet(); setView("lab");
    });
    show();
    // v0.42 (user ask): start the Viking journey over without touching the labs. Two taps, like Reset all progress.
    let resetArmed = false;
    const resetRaid = h("button", { class: "btn danger small raid-reset", text: "↺ Reset Viking mine only" });
    resetRaid.addEventListener("click", () => {
      if (!resetArmed) { resetArmed = true; resetRaid.textContent = "Tap again: back to stage 1, tokens, boats and relics wiped"; return; }
      SVT.resetRaid(); closeSheet(); setView("home"); toast("⚔️ Viking journey reset: stage 1 awaits");
    });
    sheet("Viking Raid", h("div", { class: "sheet-body raid-panel" },
      h("div", { class: "token-row" }, tokenPill(),
        h("div", { class: "token-btns" }, h("button", { class: "btn small hoard-btn", onclick: () => SVT.openHoard(), text: "🎰 Hoard" + (SVT.hoardMult() > 1 ? " ⚡×" + SVT.hoardMult() : "") }), h("button", { class: "btn small", onclick: openBoats, text: "⛵ Boats " + SVT.boatsUnlocked() + "/" + R.BOATS }))),
      h("p", { class: "muted small", text: "Five batches of 50 Viking mines. Stage 1 has one shaft and every stage adds one. Clear a stage by opening every shaft, taking every shaft to Lv 100 and the lift and warehouse to their max: Lv 100 with one shaft, rising to Lv 500 with 50. The lift and warehouse can only go as far as your shafts have got. The further down the map, the pricier the deep shafts and the more bad omens; each batch starts a little harder than the last stage before it. Managers, abilities, Rush boosts and Chip's items all count. Clears pay Viking tokens, which unlock boats for Chip." }),
      tabs, info, stages, resetRaid), { icon: "⚔️", foot: h("div", { class: "panel-foot" }, go) });
  }
  SVT.openRaid = openRaid;
  // v0.40 (user: "Viking tokens still feel confusing"): one plain explainer, reachable from every token pill.
  function tokenHelp() {
    const R = SVT.RAID, earned = SVT.vikingTokens(), left = SVT.hoardTokens(), spent = earned - left;
    const row = (icon, title, text) => h("div", { class: "hoard-step" }, h("span", { class: "hoard-step-n", text: icon }), h("div", null, h("b", { text: title }), h("span", { text: text })));
    sheet("Viking tokens", h("div", { class: "sheet-body token-help" },
      h("div", { class: "token-sum" },
        h("div", { class: "token-sum-cell" }, h("b", { text: "🛡 " + left }), h("small", { text: "to spend" })),
        h("div", { class: "token-sum-cell" }, h("b", { text: String(spent) }), h("small", { text: "spent on spins" })),
        h("div", { class: "token-sum-cell" }, h("b", { text: String(earned) }), h("small", { text: "earned in all" }))),
      h("div", { class: "hoard-steps" },
        row("⚔️", "Earn", "Clear a Viking mine (max every shaft, the lift and the warehouse). Stage 1 pays 1 token; later stages pay up to 5, a replay pays 1."),
        row("🎰", "Spend", "The Hoard spins tokens for relics. Relics on your longship boost Viking mine income."),
        row("⛵", "Boats", "Boats unlock by tokens earned in all (" + earned + " so far), so spending never costs you a boat. Next boat at 🛡 " + (SVT.boatsUnlocked() < R.BOATS ? R.boatCost(SVT.boatsUnlocked() + 1) : "—") + ".")),
      h("p", { class: "muted small", text: "Viking tokens are not Vault coins: coins come from the labs (IPO +" + B.VAULT.COIN_PER_BEAT + ", each funding round +" + B.VAULT.ROUND_COINS + ", a new lab +" + B.VAULT.OPEN_COINS + " wild) and roll Chip's items in the Tech Vault." })),
      { icon: "🛡", foot: h("div", { class: "panel-foot token-help-foot" },
        h("button", { class: "btn fund-cta", onclick: () => { closeSheet(); SVT.openHoard(); }, text: "🎰 Spin tokens" }),
        h("button", { class: "btn", onclick: openBoats, text: "⛵ Boats" })) });
  }
  SVT.tokenHelp = tokenHelp;
  const tokenPill = () => h("button", { class: "token-pill", "aria-label": "How Viking tokens work", onclick: tokenHelp, text: "🛡 " + SVT.hoardTokens() + " to spend · " + SVT.vikingTokens() + " earned ⓘ" });
  // Boats: the 50 boats Chip can sail, unlocked with Viking tokens. Tap an unlocked boat to sail it.
  function openBoats() {
    const R = SVT.RAID, have = SVT.vikingTokens(), top = SVT.boatsUnlocked(), cur = SVT.boatIndex();
    const cards = SVT.BOATS.map((b) => {
      const cost = R.boatCost(b.k), open = b.k <= top, on = b.k === cur;
      return h("button", { class: "boat-card" + (open ? "" : " locked") + (on ? " on" : ""), "aria-label": b.name + (open ? "" : ", locked"),
        onclick: () => { if (!open) { toast("🔒 " + b.name + " needs 🛡 " + cost + " Viking tokens (you have " + have + ")"); return; } SVT.pickBoat(b.k); openBoats(); render(); } },
        h("div", { class: "boat-pic", html: SVT.boatSvg(b.k) }),
        h("b", { text: b.k + ". " + b.name }),
        h("small", { text: open ? (on ? "⛵ Sailing now" : "Tap to sail") : "🔒 " + cost + " tokens" }));
    });
    sheet("Chip's boats", h("div", { class: "sheet-body boats-panel" },
      h("div", { class: "token-row" }, tokenPill(), h("span", { class: "muted small", text: top + " of " + R.BOATS + " boats unlocked" })),
      h("p", { class: "muted small", text: "Clearing a Viking mine pays tokens (1 to 5 a stage, more in later batches; a replay pays 1). Boats go by tokens ever earned, so spending tokens on Hoard spins never costs you a boat. Chip sails the boat you pick on the home screen." }),
      h("button", { class: "btn small", onclick: () => SVT.openHoard(), text: "🎰 Viking Hoard: spin tokens for relics ›" }),
      h("div", { class: "boat-grid" }, cards)), { icon: "⛵" });
  }
  SVT.openBoats = openBoats;
  // The clear popup (v0.34.1, user's ask): Viking speak, a big button straight into the next mine. Shown every time a
  // mine is cleared, whatever screen or panel is open (before, an open panel or the home screen swallowed it). The only
  // ways out are the next mine and Home (v0.34.2): it cannot be tapped away.
  const SKALD = ["Skål, jarl! The halls ring with your name.", "Odin's ravens saw it all: the hoard is ours!", "Thor's own thunder could not have dug faster.", "The skalds will sing of this raid for a hundred winters.", "Valhalla's gates creak open a little wider.", "By Fenrir's teeth, what a haul!", "Raise the mead horns! The mine is plundered.", "The jarl's hall grows richer. Onward, to the next fjord!"];
  function showRaidClear(s, d) {
    const R = SVT.RAID, last = s >= R.STAGES, boat = SVT.boatIndex(), next = last ? null : R.stage(s + 1);
    sheet("SKÅL! Stage " + s + " plundered!", h("div", { class: "sheet-body raid-clear" },
      h("div", { class: "raid-clear-horns", "aria-hidden": "true", text: "🍻⚔️🍻" }),
      h("p", { class: "raid-clear-say", text: SKALD[s % SKALD.length] }),
      h("p", { text: last ? "Every one of the " + R.STAGES + " mines on the island is yours. The saga is complete, jarl!" : R.stage(s).name + " is stripped to the bedrock. The longships are ready for " + next.name + "." }),
      h("p", { class: "muted", text: "🛡 +" + (d && d.tokens || 0) + (d && d.tokens === 1 ? " Viking token" : " Viking tokens") + " · " + SVT.vikingTokens() + " in all · ⛵ sailing " + SVT.BOATS[boat - 1].name + (boat < R.BOATS ? " · next boat at 🛡 " + R.boatCost(boat + 1) : "") }),
      last ? null : h("button", { class: "btn fund-cta big raid-next", onclick: () => { closeSheet(); SVT.startRaid(s + 1); setView("lab"); }, text: "⚔️ Raid stage " + (s + 1) + ": " + next.name }),
      h("button", { class: "btn", onclick: () => { closeSheet(); setView("home"); }, text: "🏠 Home" })), { icon: "⚔️", sticky: true }); // v0.34.2: no ✕ and no tap-outside close (the user kept dismissing it by accident)
  }
  SVT.showRaidClear = showRaidClear;

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
        h("span", { class: "mine-hole" }, h("span", { class: "mine-ladder" })),
        h("span", { class: "sea" }, h("span", { class: "wave w1" }), h("span", { class: "wave w2" }), h("span", { class: "wave w3" }))),
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
          bubble("b-raid", "⚔️", "Viking Raid", openRaid, raidReady),
          bubble("b-hoard", "🎰", "Hoard", () => SVT.openHoard(), SVT.hoardTokens() > 0),
          bubble("b-heroes", "🦸", "Heroes", () => SVT.openSupers(), SVT.superCanSpin && SVT.superCanSpin())),
        h("div", { class: "hero" }, sign,
          h("button", { class: "hero-boat", "aria-label": "Chip's boat: " + SVT.BOATS[SVT.boatIndex() - 1].name, html: SVT.boatSvg(SVT.boatIndex()), onclick: openBoats }),
          h("div", { class: "hero-bot", html: SVT.mascot("hold") }), wornItems(),
          SVT.vaultMult() > 1 ? h("button", { class: "worn-total", "aria-label": "Item bonus", onclick: () => SVT.openChip(), text: "⚡ ×" + SVT.vaultMult() }) : null),
        h("div", { class: "side right" },
          boostBubble(bubble("b-rush", "🏭", "Rush", SVT.openRush, true), "Rush", SVT.rushLeft, SVT.rushWait, () => SVT.state().rush.mult),
          boostBubble(bubble("b-bugs", "🐛", "Bug Hunt", SVT.openBugs, true), "Bug Hunt", SVT.bugsLeft, SVT.bugsWait, () => SVT.state().bugs.mult),
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

  // A mini game bubble (Rush, Bug Hunt) shows its boost countdown, and its "!" badge only while a run is ready.
  function boostBubble(b, name, leftFn, waitFn, multFn) {
    const label = b.querySelector(".bubble-label"), badge = b.querySelector(".bubble-badge");
    return bind(b, () => {
      const left = leftFn();
      setText(label, left > 0 ? "×" + multFn() + " " + SVT.boostShort(left) : name);
      badge.hidden = waitFn() > 0 || left > 0;
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
  SVT.closeSheet = closeSheet;

  function update() {
    for (let i = 0; i < binds.length; i++) {
      const b = binds[i];
      if (!b.off && b.e.isConnected) b.fn(b.e);
    }
  }

  // ---------- sheets ----------
  function openFunding() {
    const L = lab();
    const next = SVT.nextRound(L);
    const ladder = h("ol", { class: "ladder" }, B.ROUNDS.map((r, i) => h("li", { class: i < L.round ? "done" : i === L.round ? "next" : "" },
      h("b", { text: r.name }), h("span", { text: " ×" + r.mult + " · Floor " + r.needFloor + (r.maxed ? " + lab maxed" : "") + (B.WALLS[r.needFloor + 1] === i ? " · opens " + (r.needFloor + 1) : "") }))));
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
    // v0.32: the Raise button is pinned under the list, so the round you can raise is never below the fold.
    sheet("Funding", h("div", { class: "sheet-body funding" },
      h("p", { class: "muted", text: "Current multiplier ×" + SVT.prestigeMult(L) + ". Every 5 floors need a round. Raising one resets this lab's floors, hubs, cash and managers, but the lab earns more forever and pays " + B.VAULT.ROUND_COINS + " 🪙." }),
      ladder,
      h("p", { class: "muted small", text: "The IPO needs the whole lab maxed, beats this lab and closes it with a 🏆" + (opensOnIpo(L) ? ". " + opensOnIpo(L).name + " opens on the map." : ".") })),
      { icon: "💰", foot: h("div", { class: "panel-foot" }, btn) });
  }
  // The lab that beating this one opens (five places further on the map), if any.
  function opensOnIpo(L) {
    const i = SVT.labIndex(L.id) + SVT.OPEN_LABS;
    return i < SVT.LABS.length ? SVT.LABS[i] : null;
  }

  // v0.33.1: some phones (iPhone Duo) draw a status pill down the right edge. The layout follows the phone's safe
  // area when it reports one; this switch forces a 60px right gutter for phones that do not. Saved per device.
  const duoOn = () => { try { return localStorage.getItem("svt-duo") === "1"; } catch (e) { return false; } };
  function applyDuo() { document.body.classList.toggle("duo", duoOn()); }
  function duoBtn() {
    const b = h("button", { class: "btn" });
    const label = () => { b.textContent = "📱 Keep the right edge clear (iPhone Duo status pill): " + (duoOn() ? "On" : "Off"); };
    b.addEventListener("click", () => { try { localStorage.setItem("svt-duo", duoOn() ? "0" : "1"); } catch (e) {} applyDuo(); label(); toast(duoOn() ? "Right edge kept clear of the status pill" : "Full-width layout"); });
    label();
    return b;
  }
  SVT.duoOn = duoOn;
  SVT.openSettings = () => openSettings();
  // v0.42: the Viking-only reset is also in Settings, next to Reset all progress.
  function viking() {
    let armed = false;
    const b = h("button", { class: "btn danger raid-reset", text: "↺ Reset Viking mine only" });
    b.addEventListener("click", () => {
      if (!armed) { armed = true; b.textContent = "Tap again: Viking stages, tokens, boats and relics start over (labs stay)"; return; }
      SVT.resetRaid(); closeSheet(); toast("⚔️ Viking journey reset: stage 1 awaits");
    });
    return b;
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
      duoBtn(),
      SVT.cheatBox ? SVT.cheatBox() : null,
      viking(),
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
      const tierList = SVT.TECH_UNLOCKS[d.kind === "floor" ? tierOf(d.n) : 0];
      const big = d.crossed.filter((c) => c.big);
      if (big.length) toast("⭐ " + where + " Lv " + big[big.length - 1].lvl + " milestone: " + multLabel(big[big.length - 1].mult) + (d.kind === "floor" ? " output, new team member" : " capacity"), "big");
      else toast("🔓 " + where + " Lv " + last.lvl + ": " + tierList[(last.lvl / 5) % tierList.length] + " " + multLabel(last.mult));
    }
    if (type === "floor") { toast((inRaid() ? "New shaft: " : "New floor: ") + productName(d.n)); render(); }
    if (type === "assign" || type === "switch") render();
    if (type === "error") toast("⚠️ Game error (" + d.where + "): " + d.msg + ". A screenshot of this helps fix it.", "big");
    if (type === "hire") { const y = window.scrollY; render(); window.scrollTo(0, y); }
    if (type === "raise") { toast("💰 Raised " + d.round.name + "! Lab income now ×" + d.mult + (d.coins ? " · +" + d.coins + " 🪙" : ""), "big"); render(); }
    if (type === "tap") squish(document.querySelector(d.kind === "floor" ? '.floor[data-floor="' + d.n + '"] .scene' : d.kind === "freight" ? ".lift-tower" : ".wh-tower"));
    if (type === "labUnlocked") toast("🗺 New location open on the map: " + d.lab.name, "big");
    if (type === "labBeaten") { toast("🏆 You beat " + d.lab.name + "! +1 🪙 " + d.lab.name + " coin for the Vault" + (d.replay ? "." : ", and a new lab opens."), "big"); setView("map"); }
    if (type === "raidClear") {
      toast("⚔️ Viking Raid stage " + d.stage + " cleared!", "big");
      if (d.tokens) toast("🛡 +" + d.tokens + " Viking " + (d.tokens === 1 ? "token" : "tokens"));
      setTimeout(() => showRaidClear(d.stage, d), 350); // after the toast lands; replaces whatever panel is open
    }
  });

  // No pinch zoom (v0.34.3). A pinch-zoomed page pins the bottom bar to the layout viewport, so on the user's phone it
  // floated mid-screen with the floors scrolling behind it. Safari ignores user-scalable=no, so the gesture events
  // are cancelled here as well as by touch-action in the CSS.
  ["gesturestart", "gesturechange", "gestureend"].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
  document.addEventListener("touchmove", (e) => { if (e.touches.length > 1 || (e.scale !== undefined && e.scale !== 1)) e.preventDefault(); }, { passive: false });
  SVT.noZoom = true;
  // Reliable taps on phones. A press that lifts within 14px of where it started, within 700ms, counts as a tap on
  // that control even if the browser would have dropped the click (a tiny drag inside a scrolling panel, or the
  // contents changing under the finger). The browser's own click that may follow is swallowed so nothing fires twice.
  const TAPPABLE = "button, .scene, .tower";
  let press = null, swallowUntil = 0;
  function swallowNextClick() { swallowUntil = performance.now() + 500; }
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
    applyDuo();
    render();
    SVT.start();
    // One loop: the game steps every animation frame so movement is smooth, moving parts redraw every frame,
    // and numbers and buttons refresh about 7 times a second.
    let lastUi = 0;
    // v0.46.2 (user: "game gets glitchy on rush"): while a full-screen mini game (Rush, Bug Hunt) covers the lab, the
    // lab keeps earning but stops redrawing, so the phone spends every frame on the mini game.
    let cover = null, coverAt = 0;
    (function loop(t) {
      requestAnimationFrame(loop); // v0.46.3: queued first, so an error below can never stop the game loop
      try { SVT.step(); } catch (e) { SVT.reportError(e, "step"); }
      if (cover ? !cover.isConnected : ++coverAt % 15 === 0) cover = document.querySelector("#rush, #bugs"); // looked up 4x a second, not every frame
      if (!cover) {
        try {
          for (let i = 0; i < frames.length; i++) { const f = frames[i]; if (!f.off && f.e.isConnected) f.fn(f.e); }
          if (dirty || t - lastUi > 150) { dirty = false; update(); lastUi = t; }
        } catch (e) { SVT.reportError(e, "screen"); }
      } else dirty = true;
    })(0);
    if (!SVT.state().seenIntro) showIntro();
    else if (off) showOffline(off);
  };
})();
