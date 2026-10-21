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
const order = await page.evaluate(() => [...document.querySelectorAll(".surface .hub")].map((h) => h.className));
console.log("hub order", order.join(" | "));
if (!order[0].includes("freight")) errors.push("Lift is not on the left");
await page.waitForTimeout(2500);
const cash1 = await page.evaluate(() => SVT.lab().cash);
console.log("rack text", await page.locator(".rack").first().innerText(), "| waiting", await page.locator(".freight .waiting b").innerText());
console.log("cash after taps", cash1);
await page.screenshot({ path: out + "/02-start.png" });
// give money, buy upgrades, hire, unlock floors up to the Seed wall
await page.evaluate(() => SVT.debug.addCash(1e7));
await page.click(".chip >> text=×10");
for (let i = 0; i < 3; i++) await page.click(".floor .btn.up >> nth=0");
// hire -> Owned sheet -> Use here, for each role
for (const role of ["Floor Lead", "Logistics Lead", "Commercial Director"]) {
  await page.click(`.mgr-hire >> text=/Hire ${role}/`);
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
await page.click("#sheet .icon-btn");
// rarity odds: 100k rolls should land near the stated odds
const dist = await page.evaluate(() => { const c = {}; for (let i = 0; i < 100000; i++) { const k = SVT.rollRank(); c[k] = (c[k] || 0) + 1; } return c; });
const want = { super: 500, legendary: 1000, epic: 3000, rare: 10000, uncommon: 30000, common: 55500 };
for (const k in want) if (Math.abs((dist[k] || 0) - want[k]) > Math.max(150, want[k] * 0.06)) errors.push("Rarity odds off for " + k);
console.log("rarity rolls", JSON.stringify(dist));
for (let i = 0; i < 4; i++) await page.click("text=/Unlock Floor/");
await page.waitForTimeout(1500);
const s = await page.evaluate(() => ({ floors: SVT.lab().floors.length, wall: !!document.querySelector(".floor.wall"), rates: SVT.rates(SVT.lab()) }));
console.log("state", JSON.stringify(s));
await page.screenshot({ path: out + "/03-floors.png", fullPage: false });
await page.locator(".floor.wall").scrollIntoViewIfNeeded();
await page.screenshot({ path: out + "/04-wall.png" });
// raise seed
await page.click(".btn.fund");
await page.screenshot({ path: out + "/05-funding.png" });
await page.click("#sheet .btn.fund-cta");
await page.click("#sheet .btn.fund-cta");
const after = await page.evaluate(() => ({ round: SVT.lab().round, mult: SVT.prestigeMult(SVT.lab()), labs: Object.keys(SVT.state().labs), managers: Object.keys(SVT.lab().managers).length }));
if (after.managers !== 0) errors.push("Managers survived the funding round");
console.log("after raise", JSON.stringify(after));
await page.waitForTimeout(300);
await page.click("text=🗺 Map");
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
