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
  function sheet(title, body, opts) {
    closeSheet();
    const wrap = h("div", { class: "sheet-wrap", id: "sheet", onclick: (e) => { if (e.target.id === "sheet" && !(opts && opts.sticky)) closeSheet(); } },
      h("div", { class: "sheet", role: "dialog", "aria-label": title },
        h("div", { class: "sheet-head" }, h("h2", { text: title }),
          opts && opts.sticky ? null : h("button", { class: "icon-btn", "aria-label": "Close", onclick: closeSheet, text: "✕" })),
        body));
    document.body.append(wrap);
  }
  function closeSheet() { const s = document.getElementById("sheet"); if (s) s.remove(); }

  // ---------- header ----------
  function header() {
    const L = lab(), d = def();
    const cash = bind(h("div", { class: "cash" }), (e) => setText(e, "$" + fmt(lab().cash)));
    const rate = bind(h("div", { class: "rate" }), (e) => setText(e, "+$" + fmt(lab().rate) + "/s"));
    const roundBadge = bind(h("span", { class: "badge" }), (e) => {
      const r = lab().round;
      setText(e, r === 0 ? "Bootstrapped" : B.ROUNDS[r - 1].name + " · ×" + SVT.prestigeMult(lab()));
    });
    const fundBtn = bind(h("button", { class: "btn small fund", onclick: openFunding, text: "Funding" }), (e) => toggle(e, "ready", SVT.canRaise(lab())));
    const chips = h("div", { class: "buy", role: "group", "aria-label": "Buy amount" },
      [1, 10, 100, "max"].map((b) => bind(h("button", { class: "chip", onclick: () => SVT.setBuy(b), text: b === "max" ? "Max" : "×" + b }),
        (e) => toggle(e, "on", SVT.state().buy === b))));
    return h("header", { class: "top" },
      h("div", { class: "top-row" },
        h("button", { class: "btn small", onclick: () => setView("map"), text: "🗺 Map" }),
        h("div", { class: "lab-title" }, h("span", { class: "lab-icon", text: d.icon }), h("div", null, h("b", { text: d.name }), roundBadge)),
        h("div", { class: "top-btns" }, fundBtn, h("button", { class: "icon-btn", "aria-label": "Settings", onclick: openSettings, text: "⚙" }))),
      h("div", { class: "top-row money" }, h("div", null, cash, rate), chips));
  }

  // ---------- managers ----------
  function managerChip(kind, n) {
    const L = lab();
    const m = SVT.mgrOf(L, kind, n);
    const role = B.ROLE_NAMES[kind];
    if (!m) {
      const btn = bind(h("button", { class: "btn mgr-hire", onclick: () => { if (SVT.hire(kind, n)) { const mm = SVT.mgrOf(lab(), kind, n); const r = SVT.rank(mm.rank); toast("Hired " + r.name + " " + role + " · " + SVT.ability(kind, mm.ability).name, "r-" + mm.rank); } } }),
        (e) => { const c = SVT.hireCost(lab(), kind, n); setText(e, "Hire " + role + " · $" + fmt(c)); setDisabled(e, lab().cash < c); });
      return h("div", { class: "mgr none" }, btn);
    }
    const r = SVT.rank(m.rank), ab = SVT.ability(kind, m.ability);
    const effect = ab.kind === "boost" ? "×" + r.boost + " for " + B.BOOST_SECONDS + "s" : "−" + Math.round(r.discount * 100) + "% upgrades for " + B.DISCOUNT_SECONDS + "s";
    const act = bind(h("button", { class: "btn ability", onclick: () => SVT.activate(kind, n) }), (e) => {
      const mm = SVT.mgrOf(lab(), kind, n); if (!mm) return;
      const t = SVT.now();
      if (mm.activeUntil > t) { setText(e, "Active " + SVT.fmtTime(mm.activeUntil - t)); setDisabled(e, true); toggle(e, "live", true); }
      else if (mm.cdUntil > t) { setText(e, "Ready in " + SVT.fmtTime(mm.cdUntil - t)); setDisabled(e, true); toggle(e, "live", false); }
      else { setText(e, ab.name); setDisabled(e, false); toggle(e, "live", false); }
    });
    const reroll = bind(h("button", { class: "btn small ghost", title: "Hire a different manager", onclick: () => { if (SVT.hire(kind, n)) { const mm = SVT.mgrOf(lab(), kind, n); toast("Hired " + SVT.rank(mm.rank).name + " " + role, "r-" + mm.rank); } } }),
      (e) => { const c = SVT.hireCost(lab(), kind, n); setText(e, "↻ $" + fmt(c)); setDisabled(e, lab().cash < c); });
    return h("div", { class: "mgr r-" + m.rank },
      h("div", { class: "mgr-face", "aria-hidden": "true", text: r.name[0] }),
      h("div", { class: "mgr-info" }, h("b", { text: r.name + " " + role }), h("span", { text: ab.name + ": " + effect + (r.passive ? " · +" + r.passive * 100 + "% always" : "") })),
      act, reroll);
  }

  // ---------- upgrade button ----------
  function upgradeBtn(kind, n) {
    return bind(h("button", { class: "btn up", onclick: () => upgradeAndToast(kind, n) }), (e) => {
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
  function upgradeAndToast(kind, n) {
    SVT.upgrade(kind, n);
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
    return bind(h("span", { class: "pill warn", text: "Bottleneck" }), (e) => {
      const r = SVT.rates(lab());
      e.hidden = !(r.limit === which && lab().floors.length > 0);
    });
  }

  // ---------- hubs ----------
  function commercialCard() {
    const kind = "commercial";
    const scene = h("div", { class: "scene hub-scene", onclick: () => SVT.tap(kind, 0) },
      h("div", { class: "truck t1", "aria-hidden": "true" }), h("div", { class: "truck t2", "aria-hidden": "true" }),
      h("div", { class: "cloud", "aria-hidden": "true", text: "☁" }),
      bind(h("div", { class: "tap-hint", text: "Tap to ship" }), (e) => { e.hidden = SVT.running(lab(), kind, 0); }));
    bind(scene, (e) => toggle(e, "run", SVT.running(lab(), kind, 0)));
    const info = bind(h("div", { class: "stat" }), (e) => {
      const r = SVT.rates(lab());
      setText(e, "Lv " + lab().commercial.lvl + " · ships $" + fmt(r.commercial) + "/s");
    });
    const lobby = bind(h("div", { class: "lobby" }), (e) => setText(e, "Lobby: $" + fmt(lab().lobby) + " waiting to ship"));
    return h("section", { class: "hub commercial" },
      h("div", { class: "hub-head" }, h("h3", { text: "Commercial & Cloud Hub" }), bottleneckPill("commercial")),
      scene, info, unlockBar(kind, 0), h("div", { class: "actions" }, upgradeBtn(kind, 0)), managerChip(kind, 0), lobby);
  }

  function freightCard() {
    const kind = "freight";
    const info = bind(h("div", { class: "stat" }), (e) => {
      const L = lab(), r = SVT.rates(L);
      setText(e, "Lv " + L.freight.lvl + " · moves $" + fmt(r.freight) + "/s · trip " + B.freightTrip(L.freight.lvl, L.floors.length).toFixed(1) + "s");
    });
    const hint = bind(h("button", { class: "btn small ghost", onclick: () => SVT.tap(kind, 0), text: "Tap to run lift" }), (e) => { e.hidden = SVT.running(lab(), kind, 0); });
    return h("section", { class: "hub freight" },
      h("div", { class: "hub-head" }, h("h3", { text: "Freight & Data Hub" }), bottleneckPill("freight")),
      info, unlockBar(kind, 0), h("div", { class: "actions" }, upgradeBtn(kind, 0), hint), managerChip(kind, 0));
  }

  // ---------- floors ----------
  function workers(n) {
    const box = h("div", { class: "workers", "aria-hidden": "true" });
    let shown = -1;
    bind(box, () => {
      const c = teamSize(SVT.levelOf(lab(), "floor", n));
      if (c !== shown) {
        shown = c; box.innerHTML = "";
        for (let i = 0; i < c; i++) box.append(h("span", { class: "worker", style: "--i:" + i }));
      }
    });
    return box;
  }

  function floorRow(n) {
    const tier = B.tierOf(n);
    const scene = h("div", { class: "scene floor-scene", onclick: () => SVT.tap("floor", n) },
      h("div", { class: "bench", "aria-hidden": "true" }),
      workers(n),
      bind(h("div", { class: "rack" }), (e) => {
        const f = lab().floors[n - 1]; if (!f) return;
        setText(e, "$" + fmt(f.stock));
        toggle(e, "full", f.stock > 0 && f.stock > SVT.rates(lab()).floors[n - 1] * 20);
      }),
      bind(h("div", { class: "tap-hint", text: "Tap to build" }), (e) => { e.hidden = SVT.running(lab(), "floor", n); }));
    bind(scene, (e) => toggle(e, "run", SVT.running(lab(), "floor", n)));
    const stat = bind(h("div", { class: "stat" }), (e) => {
      const lv = SVT.levelOf(lab(), "floor", n);
      setText(e, "Lv " + lv + " · " + teamSize(lv) + " × " + teamName(n) + " · $" + fmt(SVT.rates(lab()).floors[n - 1]) + "/s");
    });
    return h("div", { class: "floor tier" + tier, "data-floor": n },
      h("div", { class: "fnum", text: n }),
      h("div", { class: "fbody" },
        h("div", { class: "fname" }, h("b", { text: productName(n) }), n === 1 ? bottleneckPill("build") : null),
        scene, stat, unlockBar("floor", n),
        h("div", { class: "actions" }, upgradeBtn("floor", n)),
        managerChip("floor", n)));
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
          h("p", { class: "muted", text: "Funding wall: a new tech era needs investors. Raise " + nf.round.name + " to open this floor. Raising resets this lab but makes everything earn ×" + nf.round.mult + " more, forever." }),
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
    const car = h("div", { class: "car", "aria-hidden": "true" });
    const shaft = h("div", { class: "shaft", "aria-hidden": "true" }, car);
    bind(car, () => {
      const L = lab();
      const run = SVT.running(L, "freight", 0);
      toggle(car, "run", run);
      const trip = Math.max(1.2, Math.min(30, B.freightTrip(L.freight.lvl, L.floors.length)));
      const v = trip.toFixed(1) + "s";
      if (car.style.getPropertyValue("--trip") !== v) car.style.setProperty("--trip", v);
      const dist = Math.max(0, list.offsetHeight - 160) + "px";
      if (car.style.getPropertyValue("--dist") !== dist) car.style.setProperty("--dist", dist);
    });
    const list = h("div", { class: "floors" }, floors, lockedRow());
    return h("section", { class: "building" }, shaft, list);
  }

  // ---------- views ----------
  function labView() {
    return h("main", { class: "lab-view" },
      header(),
      h("div", { class: "surface" }, commercialCard(), freightCard()),
      h("div", { class: "ground", "aria-hidden": "true" }, h("span", { text: "▼ Underground R&D" })),
      building(),
      h("footer", { class: "foot", text: "Silicon Valley Tycoon v" + B.VERSION }));
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
      h("div", { class: "map-wrap" },
        h("div", { class: "map" },
          h("div", { class: "bay", "aria-hidden": "true" }),
          h("div", { class: "road r1", "aria-hidden": "true" }), h("div", { class: "road r2", "aria-hidden": "true" }), h("div", { class: "road r3", "aria-hidden": "true" }),
          pins)),
      h("div", { class: "loc-list" }, h("h3", { text: "Your labs" }), list,
        h("p", { class: "muted small", text: "Each lab is its own company with 30 floors and its own cash. Raising Seed funding in a lab opens the next one. Locations 6–30 are coming in a later update." })),
      h("footer", { class: "foot", text: "Silicon Valley Tycoon v" + B.VERSION }));
  }

  function setView(v) { view = v; render(); window.scrollTo(0, 0); }
  SVT.setView = setView;

  function render() {
    binds = [];
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
      h("p", { class: "muted", text: "Some floors start a new tech era and need funding before you can afford them. Raising a round resets this lab's floors, hubs and cash. You keep every manager, and the whole lab earns more forever." }),
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
      h("p", { class: "muted", text: "Tap floors and hubs to work them. Hire a manager on each one to automate it and keep earning while you're away (up to 2 hours). Income is limited by the slowest of build, freight and commercial, marked Bottleneck." }),
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
    if (type === "hire" || type === "switch") render();
    if (type === "raise") { toast("💰 Raised " + d.round.name + "! Lab income now ×" + d.mult, "big"); render(); }
    if (type === "labUnlocked") toast("🗺 New location open on the map: " + d.lab.name, "big");
  });

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
