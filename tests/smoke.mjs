// Browser smoke test: node tests/smoke.mjs (serves the repo on :8123 first).
import { chromium } from "playwright";
const url = process.env.URL || "http://localhost:8123/";
const out = process.env.OUT || ".";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(url);
await page.waitForTimeout(500);
await page.screenshot({ path: out + "/01-intro.png" });
await page.click("text=Start building");
// tap all three nodes, then let it run
await page.click(".floor-scene");
await page.waitForTimeout(300);
if (await page.locator(".floor-scene .tap-hint").isVisible()) errors.push("Tap to build still visible after tapping");
if (!(await page.locator(".floor-scene .work-timer").isVisible())) errors.push("Work countdown not shown after tapping");
await page.click(".hub-scene");
await page.click(".lift-scene");
const order = await page.evaluate(() => [".lift-tower", ".wh-tower"].map((q) => document.querySelector(q).getBoundingClientRect().left));
console.log("hub x", order.join(" | "));
if (!(order[0] < order[1])) errors.push("Lift is not on the left");
await page.waitForTimeout(2500);
const cash1 = await page.evaluate(() => SVT.lab().cash);
console.log("rack text", await page.locator(".rack").first().innerText(), "| waiting", await page.locator(".lift-tower .coin-tag b").innerText());
console.log("cash after taps", cash1);
await page.screenshot({ path: out + "/02-start.png" });
// give money, buy upgrades, hire, unlock floors up to the Seed wall
await page.evaluate(() => SVT.debug.addCash(1e7));
await page.evaluate(() => SVT.setBuy(10));
await page.click(".floor .lvl-btn >> nth=0");
for (let i = 0; i < 3; i++) await page.click("#sheet .btn.up");
await page.click('#sheet [aria-label="Close"]');
// tap the empty manager seat -> Hire (pinned at the bottom): the new manager is assigned there straight away
for (const q of [".floor-scene .seat >> nth=0", ".lift-tower .seat", ".wh-tower .seat"]) {
  await page.click(q);
  await page.click("#sheet .btn.fund-cta");
  await page.waitForTimeout(100);
  if (!(await page.locator("#sheet .mcard.assigned").count())) errors.push("Hiring from a slot did not auto-assign the manager");
  if (q.startsWith(".lift")) await page.screenshot({ path: out + "/02b-mgr-panel.png" });
  await page.click('#sheet [aria-label="Close"]');
}
// hire a spare Floor Lead from the 👔 sheet; it should sit unassigned in Owned
await page.click('button[aria-label="Owned managers"]');
await page.click("#sheet .btn.fund-cta");
const stillAnim = await page.evaluate(() => { const s = document.querySelector("#sheet .sheet"); return s.classList.contains("still") + "|" + getComputedStyle(s).animationName; });
console.log("rebuilt sheet", stillAnim);
if (stillAnim !== "true|none") errors.push("Rebuilt manager panel replays its spring animation: " + stillAnim);
const owned = await page.evaluate(() => { const L = SVT.lab(); return { total: Object.keys(L.managers).length, assigned: Object.keys(L.assign).length, order: SVT.owned(L, "floor").map((m) => m.rank) }; });
console.log("owned", JSON.stringify(owned));
const rankIdx = await page.evaluate(() => SVT.RANK_ORDER);
if (owned.order.some((r, i) => i && rankIdx[r] < rankIdx[owned.order[i - 1]])) errors.push("Owned list not sorted by rarity");
const grouped = await page.evaluate(() => {
  const L = SVT.lab(); L.cash = 1e12;
  for (let i = 0; i < 12; i++) SVT.hire("floor");
  SVT.openManagers("floor", null, 0);
  const rows = [...document.querySelectorAll("#sheet .mlist > li")].map((li) => li.classList.contains("mgroup") ? "#" + li.textContent : li.querySelector(".minfo b") ? li.dataset.kind || "card" : "?");
  const kinds = [...document.querySelectorAll("#sheet .mlist > li.mgroup")].map((li) => li.textContent);
  return { headers: kinds, first: rows[0] };
});
console.log("manager groups", JSON.stringify(grouped));
await page.screenshot({ path: out + "/04b-manager-groups.png" });
const typed = await page.evaluate(async () => {
  document.querySelector('#sheet .filter.type[data-type="discount"]').click();
  await new Promise((r) => setTimeout(r, 150));
  const kinds = [...document.querySelectorAll("#sheet .mlist .mcard")].map((c) => c.textContent.includes("Budget Cut") ? "discount" : "other");
  const headers = document.querySelectorAll("#sheet .mlist .mgroup").length;
  document.querySelector('#sheet .filter.type[data-type="all"]').click();
  await new Promise((r) => setTimeout(r, 150));
  return { n: kinds.length, allDiscount: kinds.every((k) => k === "discount"), headers, back: document.querySelectorAll("#sheet .mlist .mgroup").length };
});
console.log("type filter", JSON.stringify(typed));
if (!typed.n || !typed.allDiscount || typed.headers !== 0 || !typed.back) errors.push("Manager type filter is wrong: " + JSON.stringify(typed));
if (!grouped.first.startsWith("#") || grouped.headers.length < 2 || !grouped.headers[0].startsWith("⚡ Speed")) errors.push("Managers are not grouped by ability type: " + JSON.stringify(grouped));
if (owned.total !== 4 || owned.assigned !== 3) errors.push("Owned/assigned counts wrong");
await page.click('#sheet [aria-label="Close"]');
// v0.22: the three ability kinds are visible. Speed runs the cycle faster (same output per second) and marks the
// scene; storage makes a bigger cycle; price turns the Level button green with the discount on it.
const kinds = await page.evaluate(async () => {
  const L = SVT.lab(), B = SVT.B, out = {};
  const pick = (kind) => Object.values(L.managers).find((m) => m.role === "floor" && B.ABILITIES.floor.find((a) => a.id === m.ability).kind === kind && !SVT.slotOfMgr(L, m.id));
  const rate = () => SVT.rates(L).floors[0];
  const stock = () => L.floors[0].stock;
  const scene = () => document.querySelector('.floor[data-floor="1"] .scene'); // the lab view may be rebuilt on assign
  for (const kind of ["speed", "storage", "discount"]) {
    const m = pick(kind); if (!m) { out[kind] = "none"; continue; }
    SVT.assign(m.id, "floor", 1);
    L.floors[0].left = B.FLOOR_CYCLE; // a fresh cycle, so the countdown cannot wrap during the measurement
    const r0 = rate(), c0 = SVT.quote(L, "floor", 1).cost, s0 = stock(), left0 = L.floors[0].left;
    SVT.activate("floor", 1);
    const a = SVT.activeAbility(L, "floor", 1), r = SVT.rank(m.rank);
    await new Promise((f) => setTimeout(f, 450));
    out[kind] = { ratio: +(rate() / r0).toFixed(3), boost: r.boost, cls: (scene().className.match(/ab-\w+/) || [])[0], sp: scene().style.getPropertyValue("--sp"), tag: scene().querySelector(".ab-tag").hidden,
      leftDrop: +(left0 - L.floors[0].left).toFixed(2), speedMult: SVT.speedMult(L, "floor", 1), loadMult: +SVT.loadMult(L, "floor", 1).toFixed(3), nodeMult: +SVT.nodeMult(L, "floor", 1).toFixed(3),
      deal: document.querySelector('.floor[data-floor="1"] .lvl-btn').classList.contains("deal"), cost: +(SVT.quote(L, "floor", 1).cost / c0).toFixed(2), discount: r.discount, kindOk: a && a.kind === kind };
    m.activeUntil = 0; m.cdUntil = 0; SVT.unassign(m.id);
  }
  return out;
});
console.log("ability kinds", JSON.stringify(kinds));
await page.screenshot({ path: out + "/04c-ability-kinds.png" });
const sp = kinds.speed, st = kinds.storage, dc = kinds.discount;
if (sp === "none" || !sp.kindOk || sp.cls !== "ab-speed" || sp.sp !== String(sp.boost) || sp.speedMult !== sp.boost || Math.abs(sp.ratio - sp.boost) > 0.05 || sp.leftDrop < 0.4 * sp.boost * 0.8) errors.push("Speed ability not visible or wrong: " + JSON.stringify(sp));
if (st === "none" || !st.kindOk || st.cls !== "ab-storage" || st.speedMult !== 1 || Math.abs(st.loadMult / st.nodeMult - 1) > 1e-6 || Math.abs(st.ratio - st.boost) > 0.05) errors.push("Storage ability wrong: " + JSON.stringify(st));
if (dc === "none" || !dc.kindOk || dc.cls !== "ab-discount" || !dc.deal || Math.abs(dc.cost - (1 - dc.discount)) > 0.02) errors.push("Price ability wrong: " + JSON.stringify(dc));
// rarity odds: 100k rolls should land near the stated odds
const dist = await page.evaluate(() => { const c = {}; for (let i = 0; i < 100000; i++) { const k = SVT.rollRank(); c[k] = (c[k] || 0) + 1; } return c; });
const want = { super: 500, legendary: 1000, epic: 3000, rare: 10000, uncommon: 30000, common: 55500 };
for (const k in want) if (Math.abs((dist[k] || 0) - want[k]) > Math.max(150, want[k] * 0.06)) errors.push("Rarity odds off for " + k);
console.log("rarity rolls", JSON.stringify(dist));
for (let i = 0; i < 4; i++) await page.click("text=/Unlock Floor/");
await page.waitForTimeout(1500);
// floor detail sheet: stats table, arrows, swipe, keyboard, manager round trip
await page.click(".floor .lvl-btn >> nth=0");
const title = () => page.locator("#sheet h2").innerText();
const t1 = await title();
const statRows = await page.locator("#sheet .stat-list:not(.live) .stat-row").count();
if (!t1.startsWith("Floor 1") || statRows < 4) errors.push("Floor detail sheet missing: " + t1 + " rows " + statRows);
await page.screenshot({ path: out + "/03a-detail.png" });
await page.click('#sheet [aria-label="Next"]');
if (!(await title()).startsWith("Floor 2")) errors.push("Next arrow did not go to Floor 2: " + (await title()));
await page.evaluate(() => {
  const el = document.querySelector("#sheet .sheet");
  const tp = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 });
  el.dispatchEvent(new TouchEvent("touchstart", { touches: [tp(300)], changedTouches: [tp(300)], bubbles: true }));
  el.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [tp(150)], bubbles: true }));
});
if (!(await title()).startsWith("Floor 3")) errors.push("Swipe left did not go to Floor 3: " + (await title()));
await page.keyboard.press("ArrowLeft");
await page.keyboard.press("ArrowLeft");
await page.keyboard.press("ArrowLeft");
if (!(await title()).includes("Warehouse")) errors.push("ArrowLeft x3 did not reach Warehouse: " + (await title()));
await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
const lv0 = await page.evaluate(() => SVT.lab().floors[2].lvl);
await page.click("#sheet .btn.up");
const lv1 = await page.evaluate(() => SVT.lab().floors[2].lvl);
if (lv1 <= lv0) errors.push("Upgrade in detail sheet did nothing");
await page.click("#sheet .node-card");
await page.click("#sheet .btn.fund-cta");
await page.click("#sheet .btn.use");
if (!(await title()).startsWith("Floor 3 Manager")) errors.push("Assign did not stay in the manager panel: " + (await title()));
if (!(await page.evaluate(() => SVT.mgrOf(SVT.lab(), "floor", 3)))) errors.push("Floor 3 manager not assigned");
await page.screenshot({ path: out + "/03b-detail-mgr.png" });
await page.click('#sheet [aria-label="Close"]');
// busy managers sit at the bottom of a slot's list and can't be assigned there
await page.click(".floor-scene .seat >> nth=1");
const busy = await page.evaluate(() => [...document.querySelectorAll("#sheet .mcard:not(.assigned):not(.empty-slot)")].map((li) => ({ busy: li.classList.contains("busy"), use: !!li.querySelector(".use") })));
console.log("floor 2 list", JSON.stringify(busy));
if (busy.some((b) => b.busy && b.use)) errors.push("A busy manager can be assigned");
if (busy.findIndex((b) => b.busy) !== -1 && busy.slice(busy.findIndex((b) => b.busy)).some((b) => !b.busy)) errors.push("Busy managers are not at the bottom");
await page.click('#sheet [aria-label="Close"]');
// hold Upgrade to keep buying
await page.evaluate(() => SVT.setBuy(1));
await page.click(".floor .lvl-btn >> nth=1");
await page.waitForTimeout(500); // let the panel finish springing in
const h0 = await page.evaluate(() => SVT.lab().floors[1].lvl);
const ub = await page.locator("#sheet .btn.up").boundingBox();
await page.mouse.move(ub.x + 20, ub.y + 10); await page.mouse.down(); await page.waitForTimeout(1500); await page.mouse.up();
const h1 = await page.evaluate(() => SVT.lab().floors[1].lvl);
console.log("hold-buy levels", h0, "->", h1);
if (h1 - h0 < 5) errors.push("Holding Upgrade did not keep buying");
await page.click('#sheet [aria-label="Close"]');
const s = await page.evaluate(() => ({ floors: SVT.lab().floors.length, wall: !!document.querySelector(".floor.wall"), rates: SVT.rates(SVT.lab()) }));
console.log("state", JSON.stringify(s));
await page.screenshot({ path: out + "/03-floors.png", fullPage: false });
await page.locator(".floor.wall").scrollIntoViewIfNeeded();
await page.screenshot({ path: out + "/04-wall.png" });
// raise seed
await page.click(".nav-btn.fund");
await page.screenshot({ path: out + "/05-funding.png" });
const ladderPos = await page.evaluate(() => getComputedStyle(document.querySelector("#sheet ol.ladder")).position);
if (ladderPos !== "static") errors.push("Funding round list is positioned " + ladderPos + " (style clash)");
await page.click("#sheet .btn.fund-cta");
await page.click("#sheet .btn.fund-cta");
const after = await page.evaluate(() => ({ round: SVT.lab().round, mult: SVT.prestigeMult(SVT.lab()), labs: Object.keys(SVT.state().labs), managers: Object.keys(SVT.lab().managers).length }));
if (after.managers !== 0) errors.push("Managers survived the funding round");
console.log("after raise", JSON.stringify(after));
await page.waitForTimeout(300);
await page.click(".bottom-nav >> text=Map");
await page.waitForTimeout(300);
const pins = await page.evaluate(() => ({ total: document.querySelectorAll(".pin").length, locked: document.querySelectorAll(".pin.locked").length, open: document.querySelectorAll(".pin.open").length }));
console.log("pins", JSON.stringify(pins));
await page.screenshot({ path: out + "/06-map.png", fullPage: true });
await page.click(".pin.open >> nth=1");
await page.waitForTimeout(300);
console.log("active lab", await page.evaluate(() => SVT.state().activeLab));
await page.screenshot({ path: out + "/07-arcade.png" });
// lift: goes down only as far as it has room for, loads, and comes back up
const liftRun = await page.evaluate(() => {
  const L = SVT.lab();
  while (L.floors.length < 3) L.floors.push({ lvl: 1, left: 0, stock: 0 });
  L.assign = {}; L.lift = { phase: "idle", y: 0, load: 0, timer: 0, at: 0 }; L.lobby = 0;
  L.floors.forEach((f) => (f.left = 0));
  L.commercial.left = 0;
  const cap = SVT.liftCapacity(L);
  L.floors[0].stock = cap * 2; L.floors[1].stock = cap; L.floors[2].stock = cap;
  SVT.tap("freight", 0); // one tap, one trip; no new trip starts after
  SVT.tick(0.05);
  let maxY = 0, partial = 0;
  for (let i = 0; i < 200; i++) { SVT.tick(0.05); maxY = Math.max(maxY, L.lift.y); if (L.lift.phase === "load" && L.lift.load > 0 && L.lift.load < cap * 0.9) partial++; }
  return { cap, maxY, partial, f1: L.floors[0].stock / cap, f2: L.floors[1].stock / cap, lobby: L.lobby / cap, phase: L.lift.phase };
});
console.log("lift trip", JSON.stringify(liftRun));
if (liftRun.maxY > 1.001 || Math.abs(liftRun.f1 - 1) > 1e-6 || Math.abs(liftRun.f2 - 1) > 1e-6 || Math.abs(liftRun.lobby - 1) > 1e-6) errors.push("Lift did not stop at the first full floor");
if (liftRun.partial < 3) errors.push("Lift loaded instantly instead of filling up");
// one tap = one cycle: a floor builds once and stops; the warehouse ships one trip and stops
const cyc = await page.evaluate(() => {
  const L = SVT.lab();
  L.assign = {}; L.floors.forEach((f) => { f.left = 0; f.stock = 0; }); L.commercial.left = 0; L.lobby = 100; L.cash = 0;
  L.lift = { phase: "idle", y: 0, load: 0, timer: 0, at: 0 };
  SVT.tap("floor", 1); SVT.tap("floor", 1); SVT.tap("commercial", 0);
  for (let i = 0; i < 200; i++) SVT.tick(0.05);
  const one = SVT.B.floorOutput(1, L.floors[0].lvl) * SVT.prestigeMult(L) * SVT.B.FLOOR_CYCLE;
  return { cycles: L.floors[0].stock / one, floorLeft: L.floors[0].left, shipped: L.cash, trip: SVT.shipLoad(L), whLeft: L.commercial.left, lift: L.lift.phase };
});
console.log("one tap", JSON.stringify(cyc));
if (Math.abs(cyc.cycles - 1) > 1e-6 || cyc.floorLeft > 0) errors.push("Floor tap did not run exactly one cycle");
if (Math.abs(cyc.shipped - Math.min(100, cyc.trip)) > 1e-6 || cyc.whLeft > 0) errors.push("Warehouse tap did not ship exactly one trip");
if (cyc.lift !== "idle") errors.push("Lift moved without a tap");
// upgrade badge: ▲ / ▲▲ / ▲▲▲ for 1 / 10 / 50 affordable levels
const tri = await page.evaluate(async () => {
  const L = SVT.lab(), out = [];
  const lv = L.floors[0].lvl, to = (k) => k - (lv % k);
  const k = SVT.costScale(L, "floor", 1), cost = (n) => SVT.B.bulk("floor", 1, lv, n, 0, 0, k).cost;
  for (const c of [0, cost(1), cost(to(10)), cost(to(50))]) {
    L.cash = c * 1.0001; await new Promise((r) => setTimeout(r, 400));
    out.push(document.querySelector(".floor .lvl-btn").dataset.tri);
  }
  return out.join("");
});
console.log("badge tiers", tri);
if (tri !== "0123") errors.push("Upgrade badge tiers wrong: " + tri);
// ×10 rounds up to the next multiple: Lv 56 ×10 -> 60, Lv 60 ×10 -> 70. Max lands on a multiple of 50 when one is
// affordable (Lv 56 with cash for 140 -> 100; Lv 56 with cash for 60 -> 60), and the max level when the cash reaches it.
const steps = await page.evaluate(() => {
  const L = SVT.lab(), f = L.floors[0], out = [];
  L.cash = 1e30;
  for (const [lv, b] of [[56, 10], [60, 10]]) { f.lvl = lv; SVT.setBuy(b); out.push(lv + SVT.quote(L, "floor", 1).count); }
  SVT.setBuy("max");
  const costTo = (lv, to) => SVT.B.bulk("floor", 1, lv, to - lv, 0, 0, SVT.costScale(L, "floor", 1)).cost;
  f.lvl = 56; L.cash = costTo(56, 140); out.push(56 + SVT.quote(L, "floor", 1).count);
  L.cash = costTo(56, 60); out.push(56 + SVT.quote(L, "floor", 1).count);
  L.cash = 1e300; out.push(56 + SVT.quote(L, "floor", 1).count);
  L.cash = 1e30;
  SVT.setBuy("next");
  for (const lv of [56, 60, 9]) { f.lvl = lv; out.push(lv + SVT.quote(L, "floor", 1).count); }
  SVT.setBuy(1);
  return out.join(",");
});
console.log("step buys", steps);
if (steps !== "60,70,100,60,800,60,65,10") errors.push("x10 or Max rounding is wrong: " + steps);
// back-to-top arrow: hidden at the top, shows when scrolled down, glides back to the top
await page.evaluate(() => { SVT.setView("lab"); const L = SVT.lab(); while (L.floors.length < 12) L.floors.push({ lvl: 1, stock: 0, left: 0 }); SVT.render(); });
await page.waitForTimeout(200);
const topHidden = await page.evaluate(() => document.querySelector(".jump-btn.up").classList.contains("show"));
await page.click(".jump-btn.down.show");
await page.waitForTimeout(1200);
const bottomGap = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight - window.scrollY);
if (bottomGap > 2) errors.push("Down arrow did not reach the bottom: " + bottomGap);
await page.evaluate(() => window.scrollTo(0, 1500));
await page.waitForTimeout(400);
await page.screenshot({ path: out + "/16-top-btn.png" });
await page.click(".jump-btn.up.show");
await page.waitForTimeout(1200);
const topY = await page.evaluate(() => window.scrollY);
console.log("top button", topHidden, topY);
if (topHidden || topY > 2) errors.push("Back-to-top button wrong: shown at top=" + topHidden + ", y after=" + topY);
// beating a lab (IPO) closes it and opens the lab five places on
const beat = await page.evaluate(() => {
  SVT.switchLab("garage");
  const L = SVT.lab();
  L.round = 4; while (L.floors.length < 30) L.floors.push({ lvl: 1, stock: 0, left: 0 });
  const ok = SVT.raise();
  return { ok, beaten: SVT.labBeaten(SVT.state().labs.garage), lab6: !!SVT.state().labs.cinema, active: SVT.state().activeLab, back: SVT.switchLab("garage") };
});
console.log("beat garage", JSON.stringify(beat));
if (!beat.ok || !beat.beaten || !beat.lab6 || beat.active === "garage" || beat.back !== false) errors.push("Beating Garage HQ did not close it and open lab 6");
await page.waitForTimeout(300);
await page.screenshot({ path: out + "/15-map-beaten.png" });
// Viking Raid: island card on the map, stage sheet, a stage with no abilities, clearing opens the next stage
await page.evaluate(() => SVT.setView("map"));
await page.waitForTimeout(200);
await page.click(".loc.island");
await page.waitForTimeout(300);
await page.screenshot({ path: out + "/10-raid-stages.png" });
await page.click(".panel-foot .btn");
await page.waitForTimeout(400);
const raid = await page.evaluate(() => {
  const L = SVT.lab();
  SVT.debug.addCash(1e6); SVT.unlockFloor(); SVT.hire("floor");
  const m = Object.values(L.managers)[0];
  if (m) SVT.assign(m.id, "floor", 1);
  const tags = [...document.querySelectorAll(".ab-tag")].filter((e) => getComputedStyle(e).display !== "none").length; // before any ability runs
  return { id: L.id, stage: L.stage, tags, title: document.querySelector(".lab-title").innerText.replace(/\n/g, " | "), activate: SVT.activate("floor", 1), nav: document.querySelector(".nav-btn.fund").innerText.replace(/\n/g, " ") };
});
await page.waitForTimeout(400);
raid.boost = await page.locator(".floor .boost:not([hidden])").count();
console.log("raid", JSON.stringify(raid));
if (raid.id !== "raid" || raid.stage !== 1) errors.push("Raid stage 1 did not start");
if (raid.activate !== true || raid.boost !== 1) errors.push("Manager abilities not usable in Viking Raid (v0.23): " + JSON.stringify(raid));
if (raid.tags !== 0) errors.push("Ability tags visible with no ability running: " + raid.tags);
await page.screenshot({ path: out + "/11-raid-stage.png" });
await page.evaluate(() => { SVT.debug.addCash(1e15); for (let i = 0; i < 40; i++) SVT.unlockFloor(); });
await page.waitForTimeout(400);
const doneW = await page.evaluate(() => { const b = document.querySelector(".floor.done .fbody"); return b ? b.getBoundingClientRect().width : -1; });
await page.locator(".floor.done").scrollIntoViewIfNeeded();
await page.screenshot({ path: out + "/11b-raid-all-shafts.png" });
if (doneW < 200) errors.push("All-shafts-open box is squeezed (" + doneW + "px wide)");
const capped = await page.evaluate(() => {
  const L = SVT.lab(), max = SVT.raidStage(L).max.freight;
  SVT.state().buy = "max";
  const q = SVT.quote(L, "freight", 0);
  SVT.upgrade("freight", 0); SVT.upgrade("commercial", 0);
  L.floors.forEach((f, i) => SVT.upgrade("floor", i + 1));
  SVT.tick(1);
  return { max, lift: L.freight.lvl, shaft: L.floors[0].lvl, shaftMax: SVT.raidStage(L).max.floor, quoteAtMax: SVT.quote(L, "freight", 0).count, first: q.count, won: L.won, p: SVT.raidProgress(L).p };
});
console.log("raid max", JSON.stringify(capped));
if (capped.lift !== capped.max || capped.shaft !== capped.shaftMax || capped.quoteAtMax !== 0 || !capped.won) errors.push("Raid max level or clear-by-maxing is wrong");
await page.waitForTimeout(400);
await page.screenshot({ path: out + "/12-raid-clear.png" });
const cleared = await page.evaluate(() => SVT.state().raid.cleared);
if (cleared !== 1 || !(await page.locator("h2", { hasText: "Stage 1 cleared!" }).isVisible())) errors.push("Raid stage did not clear");
await page.click("text=Raid stage 2");
await page.waitForTimeout(300);
if ((await page.evaluate(() => SVT.lab().stage)) !== 2) errors.push("Stage 2 did not open after clearing");
await page.evaluate(() => SVT.switchLab("garage"));
// opening a Level panel always starts on Next (up to the next unlock)
const reopenBuy = await page.evaluate(async () => {
  SVT.setBuy(10); document.querySelector(".floor .lvl-btn").click();
  await new Promise((r) => setTimeout(r, 200));
  const on = document.querySelector(".seg .chip.on");
  return SVT.state().buy + "|" + (on && on.textContent);
});
console.log("reopen buy", reopenBuy);
if (reopenBuy !== "next|Next") errors.push("Level panel did not reset to Next: " + reopenBuy);
await page.screenshot({ path: out + "/13-next-chip.png" });
await page.evaluate(() => document.querySelector("#sheet .x-btn").click());
// save + reload restores, and the game reopens on the home screen
await page.evaluate(() => SVT.save());
await page.reload(); await page.waitForTimeout(400);
await page.screenshot({ path: out + "/14-home.png" });
const tiles = await page.locator(".bubble, .play-btn, .gear-btn").count();
console.log("home tiles", tiles);
if (tiles !== 6) errors.push("Home screen missing or wrong tile count: " + tiles);
await page.click(".play-btn", { force: true }); await page.waitForTimeout(200);
if (!(await page.locator(".lab-view").isVisible())) errors.push("Play did not open the lab");
await page.click(".home-btn"); await page.waitForTimeout(200);
if (!(await page.locator(".home-view").isVisible())) errors.push("Home button did not return home");
console.log("reload labs", await page.evaluate(() => Object.keys(SVT.state().labs).join(",") + " garage round=" + SVT.state().labs.garage.round));
// Assembly Line Rush: start screen from the home bubble, a run sorted with the arrow keys, results, and the boost.
await page.click(".bubble.b-rush", { force: true }); await page.waitForTimeout(300);
await page.screenshot({ path: out + "/15-rush-start.png" });
await page.click(".rush-play");
const keyFor = { left: "ArrowLeft", down: "ArrowDown", right: "ArrowRight" };
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(150);
  if (i === 20) await page.screenshot({ path: out + "/16-rush-run.png" });
  const dir = await page.evaluate(() => { const p = document.querySelector(".rush-part.next"); return p && p.dataset.dir; });
  if (dir && i < 36) await page.keyboard.press(keyFor[dir]);
}
const run = await page.evaluate(() => ({ score: SVT.rushGame().score, lives: SVT.rushGame().lives }));
console.log("rush run", JSON.stringify(run));
if (!(run.score >= 3)) errors.push("Rush: sorting with the keys did not score");
await page.evaluate(() => SVT.rushGame().end()); await page.waitForTimeout(700);
await page.screenshot({ path: out + "/17-rush-result.png" });
if (!(await page.locator(".rush-big").isVisible())) errors.push("Rush results screen missing");
const boost = await page.evaluate(() => {
  const S = SVT.state(), L = S.labs.arcade, before = SVT.rates(L).income, raidBefore = S.labs.raid ? SVT.rates(S.labs.raid).income : 0;
  const wait = SVT.rushWait();
  S.rush.next = 0;
  const r = SVT.finishRush(65);
  return { wait, applied: r.applied, mult: SVT.rushMult(), ratio: SVT.rates(L).income / before, raidSame: !S.labs.raid || SVT.rates(S.labs.raid).income === raidBefore, again: SVT.finishRush(20).applied };
});
console.log("rush boost", JSON.stringify(boost));
if (!(boost.wait > 800) || !boost.applied || boost.mult !== 5 || Math.abs(boost.ratio - 5) > 1e-6 || !boost.raidSame || boost.again) errors.push("Rush boost or cooldown is wrong");
await page.click("#rush .btn.fund-cta"); await page.waitForTimeout(200);
if (await page.locator("#rush").count()) errors.push("Rush did not close");
await page.screenshot({ path: out + "/18-home-boosted.png" });
// Tech Vault: beating the garage earlier paid a coin; replay runs in a bonus slot; rolls follow the odds; every
// item is unique in the save; items only go in slots they fit; Chip wears them on the home screen.
const vault = await page.evaluate(() => {
  const S = SVT.state(), V = SVT.B.VAULT, out = {};
  out.coin = SVT.vaultCoins("garage"); out.wild = SVT.vaultWild();
  out.done = SVT.labDone("garage") && SVT.labBeaten(S.labs.garage);
  out.canReplay = SVT.canReplay("garage");
  SVT.replayLab("garage");
  out.replaying = SVT.labReplaying(S.labs.garage) && S.labs.garage.round === 0 && S.vault.replay === "garage" && SVT.labDone("garage");
  out.canReplayAgain = SVT.canReplay("garage");
  // the replay does not use one of the 5 slots: the open-lab count on the map leaves it out
  SVT.setView("map");
  out.mapTitle = document.querySelector(".loc-list h3").textContent;
  out.replayRow = !!document.querySelector(".loc.replaying");
  // beat the replay: another coin, lab closed again, replay cleared
  const L = S.labs.garage; S.activeLab = "garage";
  for (let r = 0; r < SVT.B.ROUNDS.length; r++) { while (L.floors.length < SVT.B.ROUNDS[r].needFloor) L.floors.push({ lvl: 1, stock: 0, left: 0 }); SVT.raise(); }
  out.coin2 = SVT.vaultCoins("garage"); out.beats = S.vault.beats.garage; out.closed = SVT.labBeaten(S.labs.garage) && !S.vault.replay;
  // odds: 1 coin vs 5 coins, and pity
  const sim = (coins, pity, n) => { const c = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < n; i++) c[SVT.vaultRollRarity(coins, pity)]++; return c.map((x) => x / n); };
  out.p1 = sim(1, 0, 50000); out.p5 = sim(10, 0, 50000); out.hard = sim(1, V.PITY.HARD - 1, 2000); out.soft = SVT.vaultOdds(1, V.PITY.SOFT + 2);
  // uniqueness: 400 rolls at one lab, all different looks
  // uniqueness: 400 rolls at one lab, all different looks; lab coins are spent before wild ones
  S.vault.coins.garage = 400; S.vault.wild = 7;
  const keys = new Set(), ids = new Set();
  for (let i = 0; i < 400; i++) { const it = SVT.vaultRoll("garage", 1); keys.add([it.product, it.color, it.finish, it.size, it.mods.slice().sort().join()].join("|")); ids.add(it.dna + it.id); }
  out.unique = keys.size; out.dnas = ids.size; out.items = S.vault.items.length; out.firstRare = S.vault.items[0].rar >= V.FIRST_ROLL_MIN;
  out.coinsLeft = SVT.vaultCoins("garage"); out.wildLeft = SVT.vaultWild(); SVT.vaultRoll("garage", 5); out.wildAfter = SVT.vaultWild();
  // slots: a floor thing cannot go in a hand, a hand thing cannot go on the floor
  const big = S.vault.items.find((x) => SVT.itemCat(x) === "floor"), small = S.vault.items.find((x) => SVT.itemCat(x) === "hand");
  out.fit = big && small ? { bigHand: SVT.vaultFits(big, "hand_l"), bigFloor: SVT.vaultFits(big, "floor_l"), smallHand: SVT.vaultFits(small, "hand_r"), smallFloor: SVT.vaultFits(small, "floor_l") } : null;
  if (big) { SVT.vaultWear("hand_l", big.id); out.bigInHand = SVT.vaultSlotOf(big.id); SVT.vaultWear("floor_r", big.id); out.bigOnFloor = SVT.vaultSlotOf(big.id); }
  out.worn = SVT.vaultWorn().length;
  return out;
});
console.log("vault", JSON.stringify(vault));
if (vault.coin !== 10 || vault.wild !== 150 || !vault.done || !vault.canReplay || !vault.replaying || vault.canReplayAgain) errors.push("Vault: coin on beat or replay start wrong");
if (!vault.mapTitle.includes("of 5 open") || !vault.replayRow) errors.push("Vault: replay row or slot count wrong: " + vault.mapTitle);
if (vault.coin2 !== 20 || vault.beats !== 2 || !vault.closed) errors.push("Vault: beating the replay did not pay a second coin");
if (Math.abs(vault.p1[0] - 0.5) > 0.02 || Math.abs(vault.p1[4] - 0.018) > 0.004 || vault.p5[0] !== 0 || Math.abs(vault.p5[4] - 0.15) > 0.01) errors.push("Vault: odds off " + JSON.stringify([vault.p1, vault.p5]));
if (vault.hard[0] + vault.hard[1] + vault.hard[2] + vault.hard[3] !== 0 || !(vault.soft[4] > 0.018)) errors.push("Vault: pity is not applied");
if (vault.unique !== 400 || vault.dnas !== 400 || vault.items !== 400 || !vault.firstRare || vault.coinsLeft !== 0 || vault.wildLeft !== 7 || vault.wildAfter !== 2) errors.push("Vault: items not unique or coins not spent in the right order " + JSON.stringify([vault.coinsLeft, vault.wildLeft, vault.wildAfter]));
if (!vault.fit || vault.fit.bigHand || !vault.fit.bigFloor || !vault.fit.smallHand || vault.fit.smallFloor || vault.bigInHand || vault.bigOnFloor !== "floor_r") errors.push("Vault: slot fitting wrong " + JSON.stringify(vault.fit));
if (vault.worn < 4) errors.push("Vault: Chip is not wearing the first items");
await page.evaluate(() => SVT.setView("home")); await page.waitForTimeout(300);
const wornEls = await page.locator(".worn").count();
if (wornEls !== vault.worn) errors.push("Vault: worn items not drawn on the home screen: " + wornEls);
// pictures: every product has a real icon, and the drawn items use it as a mask
const icons = await page.evaluate(() => { let n = 0, bad = 0; SVT.LABS.forEach((l) => l.products.forEach((p, i) => { n++; if (!SVT.productSvg(l.id, i).startsWith("url(\"data:image/svg+xml")) bad++; })); return { n, bad, sets: Object.keys(SVT.ICONS).length }; });
if (icons.n !== 900 || icons.bad || icons.sets < 250) errors.push("Vault: product icons missing " + JSON.stringify(icons));
const maskOk = await page.evaluate(() => [...document.querySelectorAll(".worn .vault-art-ic")].every((el) => (getComputedStyle(el).webkitMaskImage || getComputedStyle(el).maskImage || "").includes("svg")));
if (!maskOk) errors.push("Vault: item pictures are not drawn as icon masks");
await page.screenshot({ path: out + "/19-home-worn.png" });
await page.click(".bubble.b-vault", { force: true }); await page.waitForTimeout(300);
await page.screenshot({ path: out + "/20-vault.png" });
if (!(await page.locator(".vault-odds").isVisible())) errors.push("Vault: odds table not shown");
await page.evaluate(() => { SVT.state().vault.coins.garage = 10; SVT.state().vault.wild = 0; SVT.openVault(); });
await page.click(".vault-stake >> nth=3"); await page.click(".vault-roll"); await page.waitForTimeout(1200);
await page.screenshot({ path: out + "/21-vault-roll.png" });
await page.waitForTimeout(4500);
await page.screenshot({ path: out + "/22-vault-reveal.png" });
if (!(await page.locator(".vault-reveal .vault-card").isVisible())) errors.push("Vault: reveal card missing");
await page.evaluate(() => SVT.openGallery()); await page.waitForTimeout(300);
await page.screenshot({ path: out + "/23-vault-gallery.png" });
await page.click(".vault-tab >> nth=3"); await page.waitForTimeout(300);
await page.screenshot({ path: out + "/24-vault-trophies.png" });
if (!(await page.locator(".vault-lab.trophy").count())) errors.push("Vault: trophies tab missing the beaten lab");
// item bonuses: worn boosts add up (capped), apply to labs but not the raid; one-tap equip picks a fitting slot
const bonus = await page.evaluate(() => {
  const S = SVT.state(), v = S.vault, B = SVT.B.VAULT, out = {};
  out.allHaveBoost = v.items.every((x) => x.boost >= 1);
  out.mythicBoost = v.items.filter((x) => x.rar === 5).every((x) => x.boost === B.BONUS[5].mult);
  v.show = {};
  const strong = v.items.filter((x) => x.boost > 1 && SVT.vaultFits(x, "hand_l")).sort((a, b) => b.boost - a.boost);
  SVT.vaultWear("hand_l", strong[0].id); SVT.vaultWear("hand_r", strong[1].id);
  out.sum = Math.round((1 + (strong[0].boost - 1) + (strong[1].boost - 1)) * 100) / 100; out.mult = SVT.vaultMult();
  const L = S.labs.arcade; S.rush.until = 0;
  out.ratio = SVT.rates(L).income / (SVT.B.floorOutput(1, L.floors[0].lvl) * SVT.prestigeMult(L) * 0 + 1); // placeholder
  const base = (() => { const m = SVT.vaultMult(); v.show = {}; SVT.vaultRecalc(); const r = SVT.rates(L).income; SVT.vaultWear("hand_l", strong[0].id); SVT.vaultWear("hand_r", strong[1].id); return r; })();
  out.ratio = SVT.rates(L).income / base;
  out.raidSame = !S.labs.raid || (() => { const R = S.labs.raid, a = SVT.rates(R).income; v.show = {}; SVT.vaultRecalc(); const b = SVT.rates(R).income; SVT.vaultWear("hand_l", strong[0].id); SVT.vaultWear("hand_r", strong[1].id); return a === b; })();
  // cap: six x1.5 items would be x4; the total stops at MAX_BONUS
  const big = v.items.filter((x) => x.rar >= 4).slice(0, 6); big.forEach((x) => { x.boost = 1.5; });
  v.show = {}; SVT.vaultSlots().forEach((sl, i) => { if (big[i]) { const fit = v.items.find((x) => x.boost === 1.5 && !SVT.vaultSlotOf(x.id) && SVT.vaultFits(x, sl.id)); if (fit) SVT.vaultWear(sl.id, fit.id); } });
  out.capped = SVT.vaultMult() <= B.MAX_BONUS;
  // slots by product category: every product on every floor of every lab gets one, and a hand-held thing goes to
  // a hand, a floor thing to the floor; an item already on Chip can't be equipped twice; per-slot lists are rarest first
  v.show = {}; SVT.vaultRecalc();
  const cats = {}; SVT.LABS.forEach((l) => l.products.forEach((p) => { cats[SVT.productCat(p)] = (cats[SVT.productCat(p)] || 0) + 1; }));
  out.cats = cats;
  out.catSamples = { calc: SVT.productCat("Four-function calculator"), watch: SVT.productCat("Smartwatch"), ai: SVT.productCat("AI neural accelerator"), neck: SVT.productCat("LED necklace"), headphones: SVT.productCat("Noise-cancelling headphones"), server: SVT.productCat("Rack server"), shoe: SVT.productCat("Smart running shoe"), jacket: SVT.productCat("Wearable LED jacket") };
  const handItem = v.items.find((x) => SVT.itemCat(x) === "hand"), floorItem = v.items.find((x) => SVT.itemCat(x) === "floor");
  out.handSlot = SVT.vaultEquip(handItem.id).id; out.floorSlot = SVT.vaultEquip(floorItem.id).id;
  out.twice = SVT.vaultEquip(handItem.id); // already on Chip: refused
  out.notListedTwice = !SVT.vaultEligible("hand_r").some((x) => x.id === handItem.id) && SVT.vaultEligible("hand_l").some((x) => x.id === handItem.id);
  const el = SVT.vaultEligible("floor_r");
  out.eligibleOk = el.every((x) => SVT.itemCat(x) === "floor") && el.every((x, i) => !i || el[i - 1].rar >= x.rar);
  out.wristOnlyWrist = v.items.filter((x) => SVT.itemCat(x) === "wrist").every((x) => SVT.vaultFits(x, "wrist") && !SVT.vaultFits(x, "hand_l") && !SVT.vaultFits(x, "neck"));
  // merging: any 3 unequipped items of one rarity become 1 of the next rarity, a random product from one of their labs
  const g = SVT.vaultMerges()[0];
  const before = v.items.length, mergesBefore = SVT.vaultMerges().length;
  const pick = g ? g.items.slice(-3) : [];
  const merged = g ? SVT.vaultMerge(g.rar, pick.map((x) => x.id)) : null;
  out.merge = merged ? { ok: merged.rar === g.rar + 1 && pick.some((x) => x.lab === merged.lab) && merged.merged.length === 3, count: before - v.items.length, listed: mergesBefore > 0, gone: pick.filter((x) => !SVT.vaultItem(x.id)).length === 3, boostOk: merged.boost >= 1, sameRar: new Set(pick.map((x) => x.rar)).size === 1 } : null;
  const w = SVT.vaultMerges()[0]; const weak = w ? SVT.vaultMerge(w.rar) : null;
  out.mergeWeak = !!weak && weak.rar === w.rar + 1;
  out.mergeBad = SVT.vaultMerge(0, [1, 1, 1]) === null;
  return out;
});
console.log("bonus", JSON.stringify(bonus));
if (!bonus.allHaveBoost || !bonus.mythicBoost) errors.push("Vault: item boosts missing");
if (bonus.mult !== bonus.sum || Math.abs(bonus.ratio - bonus.mult) > 1e-6 || !bonus.raidSame || !bonus.capped) errors.push("Vault: bonus multiplier wrong " + JSON.stringify(bonus));
if (Object.values(bonus.cats).reduce((a, b) => a + b, 0) !== 900 || Object.keys(bonus.cats).length !== 7) errors.push("Vault: not every product has a slot category " + JSON.stringify(bonus.cats));
if (JSON.stringify(bonus.catSamples) !== JSON.stringify({ calc: "hand", watch: "wrist", ai: "head", neck: "neck", headphones: "head", server: "floor", shoe: "feet", jacket: "body" })) errors.push("Vault: product categories wrong " + JSON.stringify(bonus.catSamples));
if (!bonus.handSlot.startsWith("hand") || !bonus.floorSlot.startsWith("floor") || bonus.twice !== null || !bonus.notListedTwice || !bonus.eligibleOk || !bonus.wristOnlyWrist) errors.push("Vault: one-tap equip or per-slot inventory wrong " + JSON.stringify(bonus));
if (!bonus.merge || !bonus.merge.ok || bonus.merge.count !== 2 || !bonus.merge.listed || !bonus.merge.gone || !bonus.merge.boostOk || !bonus.merge.sameRar || !bonus.mergeWeak || !bonus.mergeBad) errors.push("Vault: merge wrong " + JSON.stringify([bonus.merge, bonus.mergeWeak, bonus.mergeBad]));
await page.evaluate(() => SVT.openMerge()); await page.waitForTimeout(300);
await page.screenshot({ path: out + "/27-vault-merge.png" });
if (await page.locator(".vault-merge").count()) { await page.locator(".vault-merge .btn.ghost").first().click(); await page.waitForTimeout(200); if (!(await page.locator(".vault-merge-picks .vault-pick").count())) errors.push("Vault: merge pick list empty"); await page.screenshot({ path: out + "/27b-vault-merge-pick.png" }); }
await page.evaluate(() => SVT.openChip("hand_l")); await page.waitForTimeout(300);
await page.screenshot({ path: out + "/25-vault-chip.png" });
if (!(await page.locator(".vault-pick").count())) errors.push("Vault: Chip tab slot inventory empty");
await page.click(".vault-pick >> nth=1"); await page.waitForTimeout(200);
if (!(await page.locator(".vault-pick.on").count())) errors.push("Vault: tapping an item in a slot inventory did not equip it");
// auto-equip: every slot ends up with the best bonus of its kind, and nothing is worn twice
const auto = await page.evaluate(() => {
  const v = SVT.state().vault; v.show = {}; SVT.vaultRecalc();
  const changed = SVT.vaultAutoEquip();
  const worn = SVT.vaultWorn();
  const bestOk = worn.every(({ slot, item }) => !v.items.some((x) => SVT.vaultFits(x, slot.id) && !SVT.vaultSlotOf(x.id) && (x.boost > item.boost || (x.boost === item.boost && x.rar > item.rar))));
  const ids = worn.map((w) => w.item.id);
  return { changed, worn: worn.length, bestOk, unique: new Set(ids).size === ids.length, again: SVT.vaultAutoEquip() };
});
if (auto.changed < 4 || auto.worn < 4 || !auto.bestOk || !auto.unique || auto.again !== 0) errors.push("Vault: auto-equip wrong " + JSON.stringify(auto));
await page.evaluate(() => SVT.openChip()); await page.waitForTimeout(200);
if (!(await page.locator(".vault-auto").count())) errors.push("Vault: auto-equip button missing");
await page.screenshot({ path: out + "/25b-vault-chip-auto.png" });
await page.evaluate(() => SVT.closeVault()); await page.evaluate(() => SVT.setView("home")); await page.waitForTimeout(300);
if (!(await page.locator(".worn-total").count())) errors.push("Vault: bonus pill missing on the home screen");
await page.screenshot({ path: out + "/26-home-bonus.png" });
await page.evaluate(() => SVT.closeVault());
const overscroll = await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY + "|" + getComputedStyle(document.body).overscrollBehaviorY);
console.log("overscroll", overscroll);
if (overscroll !== "none|none") errors.push("Pull-to-refresh not disabled on html/body: " + overscroll);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
console.log("horizontal overflow", overflow);
console.log("errors", JSON.stringify(errors));
await browser.close();
if (errors.length || overflow) process.exit(1);
