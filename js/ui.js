// Rendering and input. The DOM is rebuilt on structural changes; numbers refresh through binds.
window.SVT = window.SVT || {};

(function () {
  const B = SVT.B, fmt = SVT.fmt;
  let binds = [];
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
  const setText = (e, t) => { if (e.textContent !== t) e.textContent = t; };
  const setDisabled = (e, d) => { if (e.disabled !== d) e.disabled = d; };
  const toggle = (e, c, on) => e.classList.toggle(c, !!on);

  const app = () => document.getElementById("app");
  const lab = () => SVT.lab();
  const def = () => SVT.labDef(SVT.state().activeLab);

  function productName(n) { return def().products[n - 1]; }
  function teamName(n) { return def().teams[B.tierOf(n)]; }
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

  // ---------- toasts ----------
  function toast(msg, kind) {
    const box = document.getElementById("toasts");
    const t = h("div", { class: "toast " + (kind || "") , role: "status" }, msg);
    box.append(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.classList.add("out"), 2600);
    setTimeout(() => t.remove(), 3100);
  }
  SVT.toast = toast;

  // ---------- sheets (modals) ----------
  // opts.nav = { prev, next, pos, dir } adds ‹ › arrows and left/right swipes (the floor detail sheet).
  function sheet(title, body, opts) {
    closeSheet();
    opts = opts || {};
    const nav = opts.nav;
    const box = h("div", { class: "sheet" + (nav && nav.dir ? (nav.dir > 0 ? " from-r" : " from-l") : ""), role: "dialog", "aria-label": title },
      h("div", { class: "sheet-head" },
        nav ? h("button", { class: "icon-btn nav-arrow", "aria-label": "Previous", onclick: nav.prev, text: "‹" }) : null,
        h("div", { class: "sheet-title" }, h("h2", { text: title }), nav && nav.pos ? h("span", { class: "muted small", text: nav.pos }) : null),
        nav ? h("button", { class: "icon-btn nav-arrow", "aria-label": "Next", onclick: nav.next, text: "›" }) : null,
        opts.sticky ? null : h("button", { class: "icon-btn", "aria-label": "Close", onclick: closeSheet, text: "✕" })),
      body);
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
  }
  function closeSheet() {
    const s = document.getElementById("sheet");
    detail = null;
    if (!s) return;
    s.remove();
    binds = binds.filter((b) => !s.contains(b.e));
  }

  // ---------- header ----------
  function header() {
    const d = def();
    const cash = bind(h("b", { class: "cash" }), (e) => setText(e, "$" + fmt(lab().cash)));
    const rate = bind(h("span", { class: "rate" }), (e) => setText(e, "+$" + fmt(lab().rate) + "/s"));
    const roundBadge = bind(h("span", { class: "badge" }), (e) => {
      const r = lab().round;
      setText(e, r === 0 ? "Bootstrapped" : B.ROUNDS[r - 1].name + " ×" + SVT.prestigeMult(lab()));
    });
    return h("header", { class: "top" },
      h("div", { class: "lab-title" }, h("span", { class: "lab-icon", text: d.icon }), h("div", null, h("b", { text: d.name }), roundBadge)),
      h("div", { class: "cash-pill" }, h("span", { class: "coin big", "aria-hidden": "true", text: "$" }), h("div", null, h("span", { class: "cash-label", text: "Cash" }), cash, rate)),
      h("button", { class: "icon-btn refresh", "aria-label": "Check for update", title: "Check for update", onclick: checkUpdate, text: "🔄" }));
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
  function bottomNav() {
    const item = (icon, label, on, attrs) => h("button", Object.assign({ class: "nav-btn", onclick: on }, attrs), h("span", { class: "nav-ic", "aria-hidden": "true", text: icon }), h("span", { text: label }));
    const fund = bind(item("💰", "Funding", openFunding, { class: "nav-btn fund" }), (e) => toggle(e, "ready", SVT.canRaise(lab())));
    return h("nav", { class: "bottom-nav", "aria-label": "Main" },
      item("🗺", "Map", () => setView("map")),
      item("👔", "Managers", () => openManagers("floor", null, 0), { "aria-label": "Owned managers" }),
      fund,
      item("⚙", "Settings", openSettings, { "aria-label": "Settings" }));
  }

  // ---------- managers ----------
  const roleOf = (kind) => kind;
  function effectText(m) {
    const r = SVT.rank(m.rank), ab = SVT.ability(m.role, m.ability);
    return ab.name + ": " + (ab.kind === "boost" ? "×" + r.boost + " for " + B.BOOST_SECONDS + "s" : "−" + Math.round(r.discount * 100) + "% upgrades for " + B.DISCOUNT_SECONDS + "s") + (r.passive ? " · +" + r.passive * 100 + "% always" : "");
  }
  function hireAndOpen(role, kind, n, back) {
    const m = SVT.hire(role);
    if (!m) return;
    toast("Hired " + SVT.rank(m.rank).name + " " + m.name + " · " + SVT.ability(role, m.ability).name, "r-" + m.rank);
    openManagers(role, kind, n, back);
  }

  // The slot on a floor or hub: pick from owned managers, or hire one into the Owned list.
  function managerChip(kind, n, back) {
    const L = lab();
    const role = roleOf(kind);
    const m = SVT.mgrOf(L, kind, n);
    const title = B.ROLE_NAMES[role];
    if (!m) {
      const free = SVT.owned(L, role).filter((x) => !SVT.slotOfMgr(L, x.id)).length;
      const pick = free ? h("button", { class: "btn mgr-pick", onclick: () => openManagers(role, kind, n, back), text: "Choose " + title + " (" + free + " free)" }) : null;
      const hire = bind(h("button", { class: "btn mgr-hire", onclick: () => hireAndOpen(role, kind, n, back) }),
        (e) => { const c = SVT.hireCost(lab(), role); setText(e, "Hire " + title + " · $" + fmt(c)); setDisabled(e, lab().cash < c); });
      return h("div", { class: "mgr none" }, pick, hire);
    }
    const r = SVT.rank(m.rank), ab = SVT.ability(role, m.ability);
    const act = bind(h("button", { class: "btn ability", onclick: () => SVT.activate(kind, n) }), (e) => {
      const mm = SVT.mgrOf(lab(), kind, n); if (!mm) return;
      const t = SVT.now();
      if (mm.activeUntil > t) { setText(e, "Active " + SVT.fmtTime(mm.activeUntil - t)); setDisabled(e, true); toggle(e, "live", true); }
      else if (mm.cdUntil > t) { setText(e, "Ready in " + SVT.fmtTime(mm.cdUntil - t)); setDisabled(e, true); toggle(e, "live", false); }
      else { setText(e, ab.name); setDisabled(e, false); toggle(e, "live", false); }
    });
    const swap = h("button", { class: "btn small ghost", title: "Choose a different manager", onclick: () => openManagers(role, kind, n, back), text: "Swap" });
    return h("div", { class: "mgr r-" + m.rank },
      h("div", { class: "mgr-face" }, avatar(m)),
      h("div", { class: "mgr-info" }, h("b", { text: m.name + " · " + r.name + " " + title }), h("span", { text: effectText(m) })),
      act, swap);
  }

  // Owned managers sheet. With a slot (kind, n) it offers "Use here"; without one it is the general list.
  let sheetCtx = null;
  function openManagers(role, kind, n, back) {
    sheetCtx = { role, kind, n };
    const L = lab();
    const tabs = h("div", { class: "tabs", role: "tablist" }, ["floor", "freight", "commercial"].map((ro) =>
      h("button", { class: "tab" + (ro === role ? " on" : ""), role: "tab", "aria-selected": ro === role ? "true" : "false",
        onclick: () => openManagers(ro, ro === kind ? kind : (ro === "floor" ? null : ro), ro === kind ? n : 0, ro === kind ? back : null),
        text: { floor: "Floor Leads", freight: "Lift", commercial: "Warehouse" }[ro] + " (" + SVT.owned(L, ro).length + ")" })));
    const here = kind ? SVT.slotKey(kind, n) : null;
    // Free managers first (rarest first), then the one working here, then managers busy elsewhere, greyed out.
    const busyRank = (m) => { const sl = SVT.slotOfMgr(L, m.id); return !sl ? 0 : sl === here ? 1 : 2; };
    const list = SVT.owned(L, role).map((m, i) => [m, i]).sort((a, b) => busyRank(a[0]) - busyRank(b[0]) || a[1] - b[1]).map((x) => x[0]);
    const rows = list.length ? list.map((m) => {
      const r = SVT.rank(m.rank);
      const slot = SVT.slotOfMgr(L, m.id);
      const btns = [];
      if (here && !slot) btns.push(h("button", { class: "btn small use", onclick: () => { SVT.assign(m.id, kind, n); if (back) back(); else closeSheet(); toast(m.name + " now runs " + SVT.slotName(here)); }, text: "Use here" }));
      if (slot) btns.push(h("button", { class: "btn small ghost", onclick: () => { SVT.unassign(m.id); openManagers(role, kind, n, back); }, text: "Unassign" }));
      else btns.push(h("button", { class: "btn small ghost", onclick: () => { SVT.sell(m.id); openManagers(role, kind, n, back); }, text: "Sell $" + fmt(m.paid * B.SELL_REFUND) }));
      return h("li", { class: "owned r-" + m.rank + (slot && slot !== here ? " busy" : "") },
        h("div", { class: "mgr-face" }, avatar(m)),
        h("div", { class: "owned-info" },
          h("b", { text: m.name }), h("span", { class: "rarity", text: r.name }),
          h("span", { class: "muted", text: effectText(m) }),
          h("span", { class: "where" + (slot ? " busy" : ""), text: slot ? (slot === here ? "Working here" : "Working on " + SVT.slotName(slot)) : "Not working" })),
        h("div", { class: "owned-btns" }, btns));
    }) : [h("li", { class: "muted empty", text: "No " + B.ROLE_NAMES[role] + "s owned yet. Hire one below." })];
    const hire = bind(h("button", { class: "btn fund-cta big", onclick: () => hireAndOpen(role, kind, n, back) }),
      (e) => { const c = SVT.hireCost(lab(), role); setText(e, "Hire " + B.ROLE_NAMES[role] + " · $" + fmt(c)); setDisabled(e, lab().cash < c); });
    sheet(here ? "Managers for " + SVT.slotName(here) : "Owned managers", h("div", { class: "sheet-body" },
      back ? h("button", { class: "btn small ghost back", onclick: back, text: "‹ Back to " + SVT.slotName(here) }) : null,
      tabs,
      hire,
      h("p", { class: "muted small", text: "Best first. Each hire rolls: Super 0.5%, Legendary 1%, Epic 3%, Rare 10%, Uncommon 30%, Common 55.5%. Floor Leads can work any floor. Funding rounds send every manager away." }),
      h("ul", { class: "owned-list" }, rows)));
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
      ["Team", (L) => teamSize(L) + " " + teamName(n)],
      ["Value per product", () => "$" + fmt(B.floorValue(n) * P())],
      ["Tech unlock bonus", (L) => multText(B.floorMult(L))],
    ];
    if (kind === "freight") return [
      ["Moves", (L) => "$" + fmt(B.freightCap(L, depth()) * P() * M()) + "/s"],
      ["Load per trip", (L) => "$" + fmt(B.freightLoad(L) * P() * M())],
      ["Lift speed", (L) => multText(B.freightSpeed(L))],
      ["Round trip", (L) => B.freightTrip(L, depth()).toFixed(1) + "s"],
      ["Tech unlock bonus", (L) => multText(B.hubMult(L))],
    ];
    return [
      ["Ships", (L) => "$" + fmt(B.commercialCap(L) * P() * M()) + "/s"],
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
    rows.push(["Manager bonus", () => { const m = SVT.nodeMult(lab(), kind, n); return m > 1 ? multText(m) : "None"; }]);
    rows.push(["Prestige bonus", () => multText(SVT.prestigeMult(lab()))]);
    rows.push(["Lab income", () => { const r = SVT.rates(lab()); return "$" + fmt(r.income) + "/s · limited by " + { build: "floors", freight: "lift", commercial: "warehouse" }[r.limit]; }]);
    return rows;
  }
  function openNode(kind, n, dir) {
    const list = nodeList();
    const pos = list.findIndex(([k, m]) => k === kind && m === n) + 1;
    const title = kind === "floor" ? "Floor " + n + ": " + productName(n) : kind === "freight" ? "🛗 Lift" : "🏬 Warehouse";
    const back = () => openNode(kind, n);
    const level = bind(h("div", { class: "node-level" }), (e) => {
      const lv = SVT.levelOf(lab(), kind, n);
      setText(e, "Level " + lv + " / " + B.maxLevel(kind));
    });
    const head = h("tr", null, h("th", { text: "" }), h("th", { class: "n", text: "Now" }),
      bind(h("th", { class: "n next" }), (e) => {
        const lv = SVT.levelOf(lab(), kind, n), q = SVT.quote(lab(), kind, n);
        setText(e, lv >= B.maxLevel(kind) ? "Max" : "Lv " + (lv + q.count));
      }));
    const rows = nodeStats(kind, n).map(([label, f]) => {
      const now = h("td", { class: "n" }), next = h("td", { class: "n next" });
      const tr = h("tr", null, h("td", { text: label }), now, next);
      bind(tr, () => {
        const lv = SVT.levelOf(lab(), kind, n), q = SVT.quote(lab(), kind, n);
        const a = f(lv), b = lv >= B.maxLevel(kind) ? "–" : f(lv + q.count);
        setText(now, a); setText(next, b); toggle(next, "up", b !== a && b !== "–");
      });
      return tr;
    });
    const live = nodeLive(kind, n).map(([label, f]) => {
      const v = bind(h("span", { class: "n" }), (e) => setText(e, f()));
      return h("li", null, h("span", { class: "muted", text: label }), v);
    });
    const chips = h("div", { class: "buy", role: "group", "aria-label": "Buy amount" },
      [1, 10, 50, "max"].map((b) => bind(h("button", { class: "chip", onclick: () => SVT.setBuy(b), text: b === "max" ? "Max" : "×" + b }),
        (e) => toggle(e, "on", SVT.state().buy === b))));
    const sub = kind === "floor" ? SVT.TIERS[B.tierOf(n)].name : kind === "freight" ? "Freight Hub: brings products up from the floors" : "Commercial Hub: sells what the lift brings up";
    sheet(title, h("div", { class: "sheet-body node-sheet" },
      h("p", { class: "muted small", text: sub }),
      h("div", { class: "node-top" }, level, chips),
      unlockBar(kind, n),
      h("div", { class: "tbl" }, h("table", { class: "stats" }, h("thead", null, head), h("tbody", null, rows))),
      h("div", { class: "actions" }, upgradeBtn(kind, n)),
      h("ul", { class: "live" }, live),
      h("h3", { class: "mgr-title", text: "Manager" }),
      managerChip(kind, n, back),
      h("p", { class: "muted small swipe-hint", text: "Swipe left or right, or use ‹ ›, to see the other floors." })),
      { nav: { prev: () => stepNode(-1), next: () => stepNode(1), pos: pos + " of " + list.length, dir } });
    detail = { kind, n };
    update();
  }
  SVT.openNode = openNode;
  document.addEventListener("keydown", (e) => {
    if (!detail) return;
    if (e.key === "ArrowLeft") stepNode(-1);
    if (e.key === "ArrowRight") stepNode(1);
  });


  // ---------- upgrade button ----------
  // Hold to keep buying: one buy on press, then repeats that speed up until you let go or run out of cash.
  function holdToRepeat(el, fn) {
    let timer = null, held = false;
    const stop = () => { clearTimeout(timer); timer = null; held = false; };
    const loop = (gap) => { timer = setTimeout(() => { if (!fn()) return stop(); loop(Math.max(35, gap * 0.75)); }, gap); };
    el.addEventListener("pointerdown", (e) => {
      if (e.button > 0 || el.disabled) return;
      held = true;
      fn();
      loop(320);
    });
    ["pointerup", "pointerleave", "pointercancel", "blur"].forEach((t) => el.addEventListener(t, stop));
    // Keyboard and assistive tech still get a plain click (pointer presses are handled above).
    el.addEventListener("click", (e) => { if (e.detail === 0 && !held) fn(); });
    return el;
  }
  function upgradeBtn(kind, n) {
    return bind(holdToRepeat(h("button", { class: "btn up" }), () => SVT.upgrade(kind, n)), (e) => {
      const L = lab();
      const lv = SVT.levelOf(L, kind, n);
      if (lv >= B.maxLevel(kind)) { setText(e, "Max level"); setDisabled(e, true); return; }
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
      setText(label, lv >= B.maxLevel(kind) ? "All unlocks earned" : "Next unlock Lv " + u.lvl + " · " + multLabel(u.mult) + (u.big ? " milestone" : ""));
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
      if (SVT.mgrOf(L, kind, n)) { box.hidden = false; box.classList.add("auto"); setText(label, "Auto"); fill.style.width = "100%"; return; }
      box.classList.remove("auto");
      const left = SVT.nodeOf(L, kind, n).workUntil - SVT.now();
      box.hidden = !(left > 0);
      if (left > 0) { setText(label, Math.ceil(left) + "s"); fill.style.width = (100 * left / B.TAP_SECONDS) + "%"; }
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
      if (!m) return;
      const t = SVT.now(), live = m.activeUntil > t, cd = !live && m.cdUntil > t;
      setText(el, live ? SVT.fmtTime(m.activeUntil - t) : cd ? SVT.fmtTime(m.cdUntil - t) : "⚡");
      setDisabled(el, live || cd); toggle(el, "live", live); toggle(el, "ready", !live && !cd);
    });
    return el;
  }
  // Big blue Level button: opens the stats and upgrade sheet. A green ▲ shows when you can afford an upgrade.
  function levelBtn(kind, n) {
    const num = h("b");
    const el = h("button", { class: "lvl-btn", onclick: (e) => { e.stopPropagation(); openNode(kind, n); } },
      h("span", { text: "Level" }), num, h("i", { class: "can", "aria-hidden": "true", text: "▲" }));
    bind(el, () => {
      const L = lab(), lv = SVT.levelOf(L, kind, n), max = lv >= B.maxLevel(kind);
      setText(num, max ? "MAX" : String(lv));
      const q = SVT.quote(L, kind, n);
      toggle(el, "afford", !max && q.count > 0 && L.cash >= q.cost);
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

  // ---------- surface: lift tower (left) and warehouse (right) ----------
  function surface() {
    const lift = (h("div", { class: "tower lift-tower lift-scene", onclick: () => SVT.tap("freight", 0) },
      h("div", { class: "roof" }),
      coinTag("over", "Waiting on the floors for the lift", () => totalWaiting(lab())),
      bottleneckPill("freight"),
      h("div", { class: "window" },
        h("div", { class: "dock", "aria-hidden": "true" }), h("div", { class: "lbox in", "aria-hidden": "true" }), h("div", { class: "lbox out", "aria-hidden": "true" }),
        h("div", { class: "lift-shaft", "aria-hidden": "true" }, h("div", { class: "lift-car" }, h("span", { class: "lbox ride" })))),
      workTimer("freight", 0, "Lifting"),
      h("div", { class: "tower-foot" }, h("div", { class: "door" }, seat("freight", 0), boostBtn("freight", 0)), levelBtn("freight", 0)),
      bind(h("div", { class: "tap-hint", text: "Tap" }), (e) => { e.hidden = SVT.running(lab(), "freight", 0) || (lab().lift && lab().lift.phase !== "idle"); })));
    bind(lift, (e) => toggle(e, "run", SVT.running(lab(), "freight", 0) || (lab().lift && lab().lift.phase !== "idle")));
    const wh = runBind(h("div", { class: "tower wh-tower hub-scene", onclick: () => SVT.tap("commercial", 0) },
      h("div", { class: "roof" }),
      coinTag("over", "Ready to ship", () => lab().lobby),
      bottleneckPill("commercial"),
      h("div", { class: "window shelves" },
        h("div", { class: "store", "aria-hidden": "true" }), h("div", { class: "belt", "aria-hidden": "true" }),
        [0, 1, 2].map((i) => h("div", { class: "wbox", style: "--d:" + (-i * 0.6) + "s", "aria-hidden": "true" })),
        h("div", { class: "truck t1", "aria-hidden": "true" }, h("span", { class: "cargo" }))),
      workTimer("commercial", 0, "Shipping"),
      h("div", { class: "tower-foot" }, levelBtn("commercial", 0), h("div", { class: "door" }, seat("commercial", 0), boostBtn("commercial", 0))),
      bind(h("div", { class: "tap-hint", text: "Tap" }), (e) => { e.hidden = SVT.running(lab(), "commercial", 0); })), "commercial", 0);
    // A courier pushes boxes from the lift to the warehouse whenever the warehouse is working.
    const yard = runBind(h("div", { class: "yard", "aria-hidden": "true" }, h("div", { class: "courier" }, h("span", { class: "cart" }))), "commercial", 0);
    return h("section", { class: "surface-scene" },
      h("div", { class: "hills", "aria-hidden": "true" }), h("div", { class: "sun", "aria-hidden": "true" }),
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
      h("button", { class: "fname-tag", onclick: (e) => { e.stopPropagation(); openNode("floor", n); } }, h("b", { text: n }), productName(n), n === 1 ? bottleneckPill("build") : null),
      workTimer("floor", n, "Building"),
      levelBtn("floor", n),
      bind(h("div", { class: "tap-hint", text: "Tap to build" }), (e) => { e.hidden = SVT.running(lab(), "floor", n); })), "floor", n);
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

  function lockedRow() {
    const nf = SVT.nextFloor(lab());
    if (!nf) return h("div", { class: "floor done" }, h("div", { class: "fbody" }, h("b", { text: "All 30 floors unlocked. Raise your IPO in Funding." })));
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
      setText(e, "Unlock Floor " + n + " · $" + fmt(nf.cost)); setDisabled(e, lab().cash < nf.cost);
    });
    return h("div", { class: "floor locked" },
      h("div", { class: "fnum", text: n }),
      h("div", { class: "fbody" },
        h("div", { class: "fname" }, h("b", { text: productName(n) }), h("span", { class: "muted", text: " · " + SVT.TIERS[B.tierOf(n)].name })),
        h("div", { class: "actions" }, btn)));
  }

  function building() {
    const floors = lab().floors.map((_, i) => floorRow(i + 1));
    // The lift car follows the real trip: y = depth in floors, mapped onto the floor rows' centres.
    const carAmt = h("span", { class: "car-amt" });
    const car = h("div", { class: "car", "aria-hidden": "true" }, carAmt);
    const shaft = h("div", { class: "shaft", "aria-hidden": "true" }, car);
    bind(car, () => {
      const L = lab(), lift = L.lift || { y: 0, load: 0, phase: "idle" };
      const rows = list.children, carH = car.offsetHeight || 30;
      const centre = (k) => (k <= 0 ? 0 : rows[k - 1] ? rows[k - 1].offsetTop + rows[k - 1].offsetHeight / 2 - carH / 2 : 0);
      const k = Math.floor(lift.y), f = lift.y - k;
      const y = centre(k) + (centre(k + 1) - centre(k)) * f;
      const v = "translateY(" + y.toFixed(1) + "px)";
      if (car.style.transform !== v) car.style.transform = v;
      toggle(car, "full", lift.load > 0);
      toggle(car, "run", lift.phase !== "idle");
      setText(carAmt, lift.load > 0 ? fmt(lift.load) : "");
    });
    const list = h("div", { class: "floors" }, floors, lockedRow());
    return h("section", { class: "building" }, shaft, list);
  }

  // ---------- views ----------
  function labView() {
    return h("main", { class: "lab-view" },
      header(),
      surface(),
      building(),
      h("footer", { class: "foot", text: "Silicon Valley Tycoon v" + B.VERSION }),
      bottomNav());
  }

  function mapView() {
    const S = SVT.state();
    const pins = SVT.LABS.map((l, i) => {
      const unlocked = !l.soon && SVT.labUnlocked(l.id);
      const state = l.soon ? "soon" : unlocked ? "open" : "locked";
      const active = S.activeLab === l.id;
      return h("button", {
        class: "pin " + state + (active ? " active" : ""), style: "left:" + l.x + "%;top:" + l.y + "%",
        "aria-label": l.name + (l.soon ? ", coming soon" : unlocked ? "" : ", locked"),
        onclick: () => {
          if (l.soon) toast(l.name + ": coming soon");
          else if (!unlocked) toast("🔒 " + l.name + ": " + SVT.labRequirement(l.id));
          else { SVT.switchLab(l.id); setView("lab"); }
        },
      },
        h("span", { class: "pin-dot" }, h("span", { class: "pin-icon", text: l.icon }), l.soon || !unlocked ? h("span", { class: "pin-lock", text: "🔒" }) : null),
        h("span", { class: "pin-label", text: (i + 1) + ". " + l.name }));
    });
    const list = SVT.playableLabs().map((l) => {
      const L = S.labs[l.id];
      const right = L ? bind(h("span", { class: "muted" }), (e) => setText(e, "$" + fmt(L.cash) + " · " + L.floors.length + (L.floors.length === 1 ? " floor" : " floors"))) : h("span", { "aria-hidden": "true", text: "🔒" });
      return h("button", { class: "loc" + (L ? "" : " locked"), onclick: () => { if (L) { SVT.switchLab(l.id); setView("lab"); } else toast("🔒 " + SVT.labRequirement(l.id)); } },
        h("span", { class: "lab-icon", text: l.icon }), h("span", { class: "loc-name" }, h("b", { text: l.name }), h("span", { class: "muted", text: L ? l.theme : l.theme + " · " + SVT.labRequirement(l.id) })), right);
    });
    return h("main", { class: "map-view" },
      h("header", { class: "top" }, h("div", { class: "top-row" },
        h("button", { class: "btn small", onclick: () => setView("lab"), text: "← Back" }),
        h("div", { class: "lab-title" }, h("b", { text: "Silicon Valley Map" })),
        h("span", { class: "muted small", text: "5 of 30 open" }))),
      h("div", { class: "loc-list" }, h("h3", { text: "Your labs" }), list,
        h("p", { class: "muted small", text: "Each lab is its own company with 30 floors and its own cash. Raising Seed funding in a lab opens the next one. Locations 6–30 are coming in a later update." })),
      h("div", { class: "map-wrap" },
        h("div", { class: "map" },
          h("div", { class: "bay", "aria-hidden": "true" }),
          h("div", { class: "road r1", "aria-hidden": "true" }), h("div", { class: "road r2", "aria-hidden": "true" }), h("div", { class: "road r3", "aria-hidden": "true" }),
          pins)),
      h("footer", { class: "foot", text: "Silicon Valley Tycoon v" + B.VERSION }));
  }

  function setView(v) { view = v; render(); window.scrollTo(0, 0); }
  SVT.setView = setView;

  function render() {
    binds = binds.filter((b) => b.e.isConnected && b.e.closest("#sheet")); // an open sheet keeps its live numbers
    const root = app();
    const y = window.scrollY;
    root.innerHTML = "";
    root.append(view === "map" ? mapView() : labView());
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
      h("b", { text: r.name }), h("span", { text: " ×" + r.mult + " income · needs Floor " + r.needFloor + (B.WALLS[r.needFloor + 1] === i ? " · opens Floor " + (r.needFloor + 1) : "") }))));
    let armed = false;
    const btn = h("button", { class: "btn fund-cta big" });
    const can = SVT.canRaise(L);
    if (!next) { btn.textContent = "IPO complete"; btn.disabled = true; }
    else if (!can) { btn.textContent = "Reach Floor " + next.needFloor + " to raise " + next.name; btn.disabled = true; }
    else btn.textContent = "Raise " + next.name;
    btn.addEventListener("click", () => {
      if (!armed) { armed = true; btn.textContent = "Tap again to confirm: this lab resets"; btn.classList.add("armed"); return; }
      if (SVT.raise()) closeSheet();
    });
    sheet("Funding", h("div", { class: "sheet-body" },
      h("p", { text: "Current multiplier: ×" + SVT.prestigeMult(L) }),
      h("p", { class: "muted", text: "Some floors start a new tech era and need funding before you can afford them. Raising a round resets this lab's floors, hubs, cash and managers. You will need to hire new managers, but the whole lab earns more forever." }),
      ladder, btn));
  }

  function openSettings() {
    let armed = false;
    const reset = h("button", { class: "btn danger", text: "Reset all progress" });
    reset.addEventListener("click", () => {
      if (!armed) { armed = true; reset.textContent = "Tap again to erase your save"; return; }
      SVT.reset(); closeSheet(); toast("Progress reset");
    });
    sheet("Settings", h("div", { class: "sheet-body" },
      h("p", null, h("b", { text: "Silicon Valley Tycoon v" + B.VERSION })),
      h("button", { class: "btn", onclick: checkUpdate, text: "🔄 Check for update" }),
      h("p", { class: "muted", text: "Tap floors, the lift and the warehouse to work them. Tap a dashed seat to hire a manager to automate it and keep earning while you're away (up to 2 hours). Income is limited by the slowest of build, freight and commercial, marked Slowest. Tap a blue Level button for stats and upgrades, and hold Upgrade to keep buying." }),
      h("p", { class: "muted", text: "Every 5 levels unlocks new tech (+10% on floors, +2% on hubs). Levels 10, 25, 50, 100 and beyond are big milestones." }),
      h("p", null, h("a", { href: "https://github.com/bigbriggs52/idle-tap/blob/main/CHANGELOG.md", target: "_blank", rel: "noopener", text: "Changelog" })),
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

  // ---------- events ----------
  SVT.on((type, d) => {
    if (type === "unlock") {
      const last = d.crossed[d.crossed.length - 1];
      const where = d.kind === "floor" ? "Floor " + d.n : d.kind === "freight" ? "Freight Hub" : "Commercial Hub";
      const tierList = SVT.TECH_UNLOCKS[d.kind === "floor" ? B.tierOf(d.n) : 0];
      const big = d.crossed.filter((c) => c.big);
      if (big.length) toast("⭐ " + where + " Lv " + big[big.length - 1].lvl + " milestone: " + multLabel(big[big.length - 1].mult) + (d.kind === "floor" ? " output, new team member" : " capacity"), "big");
      else toast("🔓 " + where + " Lv " + last.lvl + ": " + tierList[(last.lvl / 5) % tierList.length] + " " + multLabel(last.mult));
    }
    if (type === "floor") { toast("New floor: " + productName(d.n)); render(); }
    if (type === "assign" || type === "switch") render();
    if (type === "hire") { const y = window.scrollY; render(); window.scrollTo(0, y); }
    if (type === "raise") { toast("💰 Raised " + d.round.name + "! Lab income now ×" + d.mult, "big"); render(); }
    if (type === "labUnlocked") toast("🗺 New location open on the map: " + d.lab.name, "big");
  });

  // Long-press menus and selection (dictionary look-up) get in the way of rapid tapping.
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("selectstart", (e) => e.preventDefault());

  SVT.boot = () => {
    const off = SVT.load();
    render();
    SVT.start();
    let lastUi = 0;
    (function loop(t) {
      if (t - lastUi > 150) { update(); lastUi = t; }
      requestAnimationFrame(loop);
    })(0);
    if (!SVT.state().seenIntro) showIntro();
    else if (off) showOffline(off);
  };
})();
