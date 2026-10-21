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
// tap the empty manager seat -> hire (top of the list) -> Use here, for each role
for (const q of [".floor-scene .seat >> nth=0", ".lift-tower .seat", ".wh-tower .seat"]) {
  await page.click(q);
  await page.click("#sheet .btn.fund-cta");
  await page.click("#sheet .btn.use");
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
const statRows = await page.locator("#sheet table.stats tbody tr").count();
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
await page.click("#sheet .mgr-hire");
await page.click("#sheet .btn.use");
if (!(await title()).startsWith("Floor 3")) errors.push("Use here did not return to the floor sheet: " + (await title()));
await page.screenshot({ path: out + "/03b-detail-mgr.png" });
await page.click('#sheet [aria-label="Close"]');
// busy managers sit at the bottom of a slot's list and can't be assigned there
await page.click(".floor-scene .seat >> nth=1");
const busy = await page.evaluate(() => [...document.querySelectorAll("#sheet .owned")].map((li) => ({ busy: li.classList.contains("busy"), use: !!li.querySelector(".use") })));
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
const pins = await page.evaluate(() => ({ total: document.querySelectorAll(".pin").length, soon: document.querySelectorAll(".pin.soon").length, open: document.querySelectorAll(".pin.open").length }));
console.log("pins", JSON.stringify(pins));
await page.screenshot({ path: out + "/06-map.png", fullPage: true });
await page.click(".pin.open >> nth=1");
await page.waitForTimeout(300);
console.log("active lab", await page.evaluate(() => SVT.state().activeLab));
await page.screenshot({ path: out + "/07-arcade.png" });
// save + reload restores
await page.evaluate(() => SVT.save());
await page.reload(); await page.waitForTimeout(400);
console.log("reload labs", await page.evaluate(() => Object.keys(SVT.state().labs).join(",") + " garage round=" + SVT.state().labs.garage.round));
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
console.log("horizontal overflow", overflow);
console.log("errors", JSON.stringify(errors));
await browser.close();
if (errors.length || overflow) process.exit(1);
