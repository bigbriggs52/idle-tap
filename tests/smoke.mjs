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
const owned = await page.evaluate(() => { const L = SVT.lab(); return { total: Object.keys(L.managers).length, assigned: Object.keys(L.assign).length, order: SVT.owned(L, "floor").map((m) => m.rank) }; });
console.log("owned", JSON.stringify(owned));
const rankIdx = await page.evaluate(() => SVT.RANK_ORDER);
if (owned.order.some((r, i) => i && rankIdx[r] < rankIdx[owned.order[i - 1]])) errors.push("Owned list not sorted by rarity");
if (owned.total !== 4 || owned.assigned !== 3) errors.push("Owned/assigned counts wrong");
await page.click('#sheet [aria-label="Close"]');
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
// ×10 / ×50 round up to the next multiple: Lv 56 ×10 -> 60, Lv 60 ×10 -> 70, Lv 56 ×50 -> 100
const steps = await page.evaluate(() => {
  const L = SVT.lab(), f = L.floors[0], out = [];
  L.cash = 1e30;
  for (const [lv, b] of [[56, 10], [60, 10], [56, 50], [100, 50]]) { f.lvl = lv; SVT.setBuy(b); out.push(lv + SVT.quote(L, "floor", 1).count); }
  SVT.setBuy("next");
  for (const lv of [56, 60, 9]) { f.lvl = lv; out.push(lv + SVT.quote(L, "floor", 1).count); }
  SVT.setBuy(1);
  return out.join(",");
});
console.log("step buys", steps);
if (steps !== "60,70,100,150,60,65,10") errors.push("x10/x50 do not round to the next multiple: " + steps);
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
  return { id: L.id, stage: L.stage, title: document.querySelector(".lab-title").innerText.replace(/\n/g, " | "), activate: SVT.activate("floor", 1), nav: document.querySelector(".nav-btn.fund").innerText.replace(/\n/g, " ") };
});
await page.waitForTimeout(400);
raid.boost = await page.locator(".floor .boost:not([hidden])").count();
console.log("raid", JSON.stringify(raid));
if (raid.id !== "raid" || raid.stage !== 1) errors.push("Raid stage 1 did not start");
if (raid.activate !== false || raid.boost !== 0) errors.push("Manager abilities still usable in Viking Raid");
await page.screenshot({ path: out + "/11-raid-stage.png" });
await page.evaluate(() => { const L = SVT.lab(); L.lifetime = SVT.raidStage(L).goal; L.lobby = 10; L.commercial.left = 0; SVT.tap("commercial", 0); SVT.tick(3); });
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
  SVT.setBuy(50); document.querySelector(".floor .lvl-btn").click();
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
const tiles = await page.locator(".home-tile").count();
console.log("home tiles", tiles);
if (tiles !== 5) errors.push("Home screen missing or wrong tile count: " + tiles);
await page.click(".home-tile.t-play"); await page.waitForTimeout(200);
if (!(await page.locator(".lab-view").isVisible())) errors.push("Play did not open the lab");
await page.click(".home-btn"); await page.waitForTimeout(200);
if (!(await page.locator(".home-view").isVisible())) errors.push("Home button did not return home");
console.log("reload labs", await page.evaluate(() => Object.keys(SVT.state().labs).join(",") + " garage round=" + SVT.state().labs.garage.round));
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
console.log("horizontal overflow", overflow);
console.log("errors", JSON.stringify(errors));
await browser.close();
if (errors.length || overflow) process.exit(1);
