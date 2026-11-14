// Browser smoke test: node tests/smoke.mjs (serves the repo on :8123 first).
import { chromium } from "playwright";
const url = process.env.URL || "http://localhost:8123/";
const out = process.env.OUT || ".";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("SVT error in")) errors.push(m.text()); });
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
await page.click(".lift-tower .lvl-btn"); // v0.26: floors cap at Lv 10, so x10 three times needs the lift
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
  const rows = [...document.querySelectorAll("#sheet .mlist > li")].map((li) => li.classList.contains("mgroup") ? "#" + li.textContent : li.querySelector(".minfo b") ? "card" : "?");
  const kinds = [...document.querySelectorAll("#sheet .mlist > li.mgroup")].map((li) => li.textContent);
  const table = [...document.querySelectorAll("#sheet .speed-table li")].map((li) => li.textContent);
  return { headers: kinds, first: rows[0], table, typeFilter: document.querySelectorAll("#sheet .filter.type").length,
    allSpeed: Object.values(L.managers).every((m) => SVT.abilityOf(m).kind === "speed"), boost: (document.querySelector("#sheet .mcard .boost-text") || {}).textContent };
});
console.log("manager groups", JSON.stringify(grouped));
await page.screenshot({ path: out + "/04b-manager-groups.png" });
// v0.42: every manager is Speed; the panel shows speed and length by rarity instead of a type filter
if (!grouped.first.startsWith("#⚡ Speed") || grouped.typeFilter !== 0 || grouped.table.length !== 5 || !/^Common⚡×2 · 30 s/.test(grouped.table[0]) || !/^Legendary⚡×4 · 12 min/.test(grouped.table[4]) || !grouped.allSpeed || !/×[\d.]+ speed \(builds\)/.test(grouped.boost)) errors.push("Speed-only managers panel wrong (v0.42): " + JSON.stringify(grouped));
if (owned.total !== 4 || owned.assigned !== 3) errors.push("Owned/assigned counts wrong");
await page.click('#sheet [aria-label="Close"]');
// v0.42: Speed by rarity. Each tier runs its node faster by its multiplier, for its own time, then rests for its cooldown.
const kinds = await page.evaluate(async () => {
  const L = SVT.lab(), B = SVT.B, out = {};
  const rate = () => SVT.rates(L).floors[0];
  const scene = () => document.querySelector('.floor[data-floor="1"] .scene');
  for (const rank of ["common", "uncommon", "rare", "epic", "legendary"]) {
    const m = SVT.hire("floor"); m.rank = rank;
    SVT.assign(m.id, "floor", 1);
    L.floors[0].left = B.FLOOR_CYCLE;
    const r0 = rate();
    SVT.activate("floor", 1);
    const a = SVT.activeAbility(L, "floor", 1), st = SVT.abilityStats(m);
    await new Promise((f) => setTimeout(f, 300));
    out[rank] = { ratio: +(rate() / r0).toFixed(3), boost: st.mult, cls: (scene().className.match(/ab-\w+/) || [])[0], speedMult: SVT.speedMult(L, "floor", 1), loadMult: SVT.loadMult(L, "floor", 1), off: SVT.discount(L, "floor", 1),
      kindOk: !!a && a.kind === "speed", active: st.active, cooldown: st.cooldown, durOk: Math.abs((m.activeUntil - SVT.now()) - st.active) < 1 && Math.abs((m.cdUntil - m.activeUntil) - st.cooldown) < 1 };
    m.activeUntil = 0; m.cdUntil = 0; SVT.unassign(m.id); delete L.managers[m.id];
  }
  // hires roll every rarity, and every one of them is Speed
  const rnd = Math.random; let i = 0; const seq = [0.001, 0.02, 0.1, 0.5, 0.9, 0.01, 0.03];
  Math.random = () => seq[i++ % seq.length];
  const ranks = new Set(); let bad = 0;
  for (let k = 0; k < 14; k++) { const m = SVT.hire("freight"); ranks.add(m.rank); if (SVT.abilityOf(m).kind !== "speed") bad++; }
  Math.random = rnd;
  out.hires = { ranks: ranks.size, bad };
  out.kinds = Object.keys(B.ABILITY_KINDS).join() + "|" + ["floor", "freight", "commercial"].map((r) => B.ABILITIES[r].length).join();
  // v0.42: one hire price everywhere, $250 then +30% a hire
  out.price = { first: B.hireCost("floor", 0), second: B.hireCost("commercial", 1), lab: SVT.hireCost(L, "freight") === B.hireCost("freight", L.hires.freight), sameRoles: B.hireCost("floor", 3) === B.hireCost("freight", 3) };
  // timers are absolute in the save
  const m = SVT.owned(L, "freight")[0]; SVT.assign(m.id, "freight", 0); m.activeUntil = 0; m.cdUntil = 0; SVT.activate("freight", 0);
  SVT.save(); const saved = JSON.parse(localStorage.getItem("svt-save")); const sm = saved.labs[L.id].managers[m.id];
  out.persist = sm.activeUntil === m.activeUntil && sm.cdUntil === m.cdUntil;
  // v0.31.2: no selling, and a hire from a slot does not replace a manager mid-ability
  SVT.openManagers("freight", "freight", 0); document.querySelector("#sheet .btn.hire").click();
  out.noSwap = SVT.mgrOf(L, "freight", 0) === m; out.noSell = typeof SVT.sell === "undefined" && !document.querySelector("#sheet .btn.sell");
  m.activeUntil = 0; m.cdUntil = 0; document.querySelector('#sheet [aria-label="Close"]').click();
  // v0.42 save migration: old Storage/Price/special managers become Speed managers with their rarity kept
  const S = SVT.state(); const fake = SVT.hire("floor"); fake.ability = "midas"; fake.rank = "legendary"; const fake2 = SVT.hire("floor"); fake2.ability = "budget";
  S.mgr6 = false; SVT.save(); SVT.load(); SVT.render();
  const L2 = SVT.lab(), f1 = L2.managers[fake.id], f2 = L2.managers[fake2.id];
  out.migrate = !!f1 && f1.ability === "crunch" && f1.rank === "legendary" && !!f2 && f2.ability === "crunch" && SVT.state().mgr6 === true;
  delete L2.managers[fake.id]; delete L2.managers[fake2.id];
  return out;
});
console.log("speed tiers", JSON.stringify(kinds));
await page.screenshot({ path: out + "/04c-ability-kinds.png" });
{
  const R = ["common", "uncommon", "rare", "epic", "legendary"], want = { common: [2, 30, 60], uncommon: [2.5, 60, 180], rare: [3, 120, 300], epic: [3.5, 360, 900], legendary: [4, 720, 1800] }; // v0.44
  for (const r of R) {
    const k = kinds[r];
    if (!k.kindOk || k.cls !== "ab-speed" || k.speedMult !== k.boost || k.loadMult !== 1 || k.off !== 0 || Math.abs(k.ratio - k.boost) > 0.05 || !k.durOk || k.boost !== want[r][0] || k.active !== want[r][1] || k.cooldown !== want[r][2]) errors.push("Speed tier " + r + " wrong (v0.42): " + JSON.stringify(k));
  }
  if (kinds.hires.bad || kinds.hires.ranks < 4 || kinds.kinds !== "speed|1,1,1") errors.push("Hires are not all Speed (v0.42): " + JSON.stringify(kinds.hires) + " " + kinds.kinds);
  if (kinds.price.first !== 250 || Math.abs(kinds.price.second - 450) > 1e-9 || !kinds.price.lab || !kinds.price.sameRoles) errors.push("Hire prices not uniform (v0.42): " + JSON.stringify(kinds.price));
  if (!kinds.persist) errors.push("Ability timers are not saved as absolute times");
  if (!kinds.noSwap || !kinds.noSell) errors.push("Hire replaced a mid-ability manager, or selling still exists (v0.31.2)");
  if (!kinds.migrate) errors.push("Old Storage/Price/special managers were not migrated to Speed (v0.42)");
}
// v0.31: Auto-assign puts the rarest floor managers on the deepest floors, best lift and warehouse managers in.
const autoAs = await page.evaluate(() => {
  const L = SVT.lab(), B = SVT.B; L.cash = 1e15; while (L.floors.length < 4) L.floors.push({ lvl: 1, stock: 0, left: 0 });
  const keepM = L.managers, keepA = L.assign; L.managers = {}; L.assign = {}; // restored below
  const mk = (role, rank) => { const m = SVT.hire(role); m.rank = rank; const sp = B.ABILITIES[role].find((a) => a.kind === "special" && a.rank === rank); m.ability = sp ? sp.id : B.ABILITIES[role][0].id; return m; };
  const c = mk("floor", "common"), r = mk("floor", "rare"), l = mk("floor", "legendary"), u = mk("floor", "uncommon"), lc = mk("freight", "common"), le = mk("freight", "epic"), wc = mk("commercial", "rare");
  SVT.assign(c.id, "floor", 4); // a Common sitting on the bottom floor must move up
  SVT.assign(lc.id, "freight", 0); // v0.31.1: the lift and warehouse are left alone (the Epic stays on the bench)
  SVT.openManagers("floor", null, 0);
  const btn = document.querySelector("#sheet .auto-assign"); btn.click();
  const at = (n) => (SVT.mgrOf(L, "floor", n) || {}).rank;
  const out = { ranks: [at(1), at(2), at(3), at(4)], lift: (SVT.mgrOf(L, "freight", 0) || {}).rank, wh: (SVT.mgrOf(L, "commercial", 0) || {}).rank, floorsUsed: Object.keys(L.assign).filter((k) => k.startsWith("floor:")).length, btn: !!btn };
  // A cooling-down manager stays where it is and is skipped: the Legendary on floor 2 cools down, so the Rare takes the bottom.
  Object.keys(L.assign).filter((k) => k.startsWith("floor:")).forEach((k) => delete L.assign[k]);
  SVT.assign(l.id, "floor", 2); l.cdUntil = SVT.now() + 600;
  const r2 = SVT.autoAssign();
  out.cool = { ranks: [at(1), at(2), at(3), at(4)], skipped: r2.skipped }; l.cdUntil = 0;
  SVT.save(); document.querySelector('#sheet [aria-label="Close"]').click();
  L.managers = keepM; L.assign = keepA; while (L.floors.length > 1) L.floors.pop(); SVT.render();
  return out;
});
console.log("auto-assign", JSON.stringify(autoAs));
if (!autoAs.btn || autoAs.ranks.join() !== "common,uncommon,rare,legendary" || autoAs.lift !== "common" || autoAs.wh !== undefined || autoAs.floorsUsed !== 4) errors.push("Auto-assign order wrong: " + JSON.stringify(autoAs));
if (autoAs.cool.ranks.join() !== "common,legendary,uncommon,rare" || autoAs.cool.skipped !== 1) errors.push("Auto-assign moved or seated a cooling-down manager: " + JSON.stringify(autoAs.cool));
// rarity odds: 100k rolls should land near the stated odds
const dist = await page.evaluate(() => { const c = {}; for (let i = 0; i < 100000; i++) { const k = SVT.rollRank(); c[k] = (c[k] || 0) + 1; } return c; });
const want = { legendary: 500, epic: 4500, rare: 15000, uncommon: 40000, common: 40000 }; // v0.44 odds
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
// v0.40.1: Hire max hires while the cash lasts (25 a press), seats or not; the best hires take the seats. v0.40.2: Max all buys the best upgrade for the backlog, repeatedly
const maxes = await page.evaluate(() => {
  const L = SVT.lab(), out = {};
  L.cash = 1e12;
  const seats = SVT.seatsOpen(L, "floor"), owned0 = SVT.owned(L, "floor").length, q = SVT.hireManyQuote(L, "floor");
  const got = SVT.hireMany("floor");
  out.floor = { seats, q, got: got.length, owned: SVT.owned(L, "floor").length - owned0, filled: SVT.seatsOpen(L, "floor"), again: SVT.hireMany("floor", 3).length };
  const lift0 = SVT.mgrOf(L, "freight", 0);
  const lift = SVT.hireMany("freight");
  const liftNow = SVT.mgrOf(L, "freight", 0);
  out.lift = { got: lift.length, assigned: !!liftNow, bestSeated: SVT.owned(L, "freight")[0].rank === liftNow.rank, again: SVT.hireMany("freight").length };
  L.cash = 0; out.noCash = SVT.hireManyQuote(L, "commercial") === 0 && SVT.hireMany("commercial").length === 0;
  L.cash = 1e12; SVT.setBuy(1);
  const before = L.floors.map((f) => f.lvl).concat(L.freight.lvl, L.commercial.lvl), rates0 = SVT.rates(L);
  // v0.40.2: the first buy goes to the backlog (the node SVT.rates reports as the limit), and every buy had to pay off
  const first = SVT.bestUpgrade(L);
  const canQ = SVT.upgradeAllQuote(L), r = SVT.upgradeAll();
  const after = L.floors.map((f) => f.lvl).concat(L.freight.lvl, L.commercial.lvl), rates1 = SVT.rates(L);
  const limitKind = rates0.limit === "build" ? "floor" : rates0.limit;
  out.all = { canQ, levels: r.levels, nodes: r.nodes, sum: after.reduce((a, b) => a + b, 0) - before.reduce((a, b) => a + b, 0), buyKept: SVT.state().buy === 1, again: SVT.upgradeAll().levels,
    limit: rates0.limit, first: first && first.kind, firstGain: first && first.gain, firstIsLimit: !!first && first.kind === limitKind && r.order[0] === first.kind + (first.kind === "floor" ? first.n : ""),
    income0: rates0.income, income1: rates1.income, kinds: r.order.reduce((m, o) => { const k = o.replace(/\d+$/, ""); m[k] = (m[k] || 0) + 1; return m; }, {}) };
  // a lab backed up at the lift: the best buy must be the lift, not a floor
  const L2 = { floors: L.floors.map((f) => ({ ...f, lvl: 200 })), freight: { ...L.freight, lvl: 1 }, commercial: { ...L.commercial, lvl: 1 } };
  const backup = (() => { const keep = { f: L.floors, fr: L.freight, c: L.commercial, cash: L.cash }; L.floors = L2.floors; L.freight = L2.freight; L.commercial = L2.commercial; L.cash = 1e9;
    const lim = SVT.rates(L).limit, b = SVT.bestUpgrade(L); const o = { limit: lim, pick: b && b.kind, gain: b && b.gain };
    L.floors = keep.f; L.freight = keep.fr; L.commercial = keep.c; L.cash = keep.cash; return o; })();
  out.backup = backup;
  return out;
});
console.log("maxes", JSON.stringify(maxes));
// hires are cash-limited (cost climbs 2.5x a hire), so the count is the quote, and it goes past the open seats
// v0.42.1: hires climb 80% each, so the cash runs out before the 25-a-press cap: the count is the quote, past the open seats
if (!(maxes.floor.seats >= 1) || maxes.floor.q !== maxes.floor.got || !(maxes.floor.got > maxes.floor.seats) || !(maxes.floor.got < 25) || maxes.floor.owned !== maxes.floor.got || maxes.floor.filled !== 0 || maxes.floor.again !== 0) errors.push("Hire max (floors) wrong: " + JSON.stringify(maxes.floor));
if (!(maxes.lift.got > 1) || !maxes.lift.assigned || !maxes.lift.bestSeated || maxes.lift.again !== 0 || !maxes.noCash) errors.push("Hire max (lift) wrong: " + JSON.stringify(maxes.lift));
if (!(maxes.all.levels > 0) || maxes.all.sum !== maxes.all.levels || !maxes.all.buyKept || maxes.all.again !== 0 || maxes.all.canQ < 1 || !maxes.all.firstIsLimit || !(maxes.all.firstGain > 0) || !(maxes.all.income1 > maxes.all.income0)) errors.push("Max all wrong (v0.40.2: best upgrade for the backlog): " + JSON.stringify(maxes.all));
if (maxes.backup.limit !== "freight" || maxes.backup.pick !== "freight" || !(maxes.backup.gain > 0)) errors.push("Max all should pick the lift when the floors back up: " + JSON.stringify(maxes.backup));
await page.evaluate(() => SVT.setView("lab")); await page.waitForTimeout(300);
if (!(await page.locator(".jump-btn.max-all").count())) errors.push("Max all button missing");
await page.evaluate(() => { SVT.lab().cash = 0; });
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
// v0.40: Home sits in the middle of the bottom bar, both mini games beside it, no second Home button up top
const navLabels = await page.evaluate(() => ({ labels: [...document.querySelectorAll(".bottom-nav .nav-btn")].map((b) => b.getAttribute("aria-label") || b.innerText.trim()).join("|"), center: document.querySelector(".bottom-nav .nav-btn.center").innerText.replace(/\s+/g, " ").trim(), topHome: document.querySelectorAll(".home-btn").length }));
console.log("nav", JSON.stringify(navLabels));
if (navLabels.labels.split("|").length !== 7 || navLabels.labels.split("|")[3] !== "Home screen" || !/Home$/.test(navLabels.center) || navLabels.topHome !== 0 || !/Bug Hunt/.test(navLabels.labels)) errors.push("Bottom bar layout wrong: " + JSON.stringify(navLabels));
await page.click(".bottom-nav .nav-btn.center"); await page.waitForTimeout(300);
if (!(await page.locator(".home-view").count())) errors.push("Bottom bar Home button did not open the home screen");
await page.evaluate(() => SVT.setView("lab")); await page.waitForTimeout(300);
await page.click(".bottom-nav >> text=Map");
await page.waitForTimeout(300);
const pins = await page.evaluate(() => ({ total: document.querySelectorAll(".pin").length, locked: document.querySelectorAll(".pin.locked").length, open: document.querySelectorAll(".pin.open").length }));
console.log("pins", JSON.stringify(pins));
if (pins.total !== 50 || (await page.locator(".map.frontier .pin").count()) !== 20) errors.push("Map: expected 50 pins with 20 on The Frontier (v0.48) " + JSON.stringify(pins));
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
  for (let i = 0; i < 400; i++) { SVT.tick(0.05); maxY = Math.max(maxY, L.lift.y); if (L.lift.phase === "load" && L.lift.load > 0 && L.lift.load < cap * 0.9) partial++; }
  return { cap, maxY, partial, f1: L.floors[0].stock / cap, f2: L.floors[1].stock / cap, lobby: L.lobby / cap, phase: L.lift.phase };
});
console.log("lift trip", JSON.stringify(liftRun));
// v0.48.1 (user: "Lift is now having the same issues not picking up"): the car takes every pile on the way down (up to
// LIFT_HEAVY loads), so 2 + 1 + 1 loads on floors 1-3 all come up in one trip
if (liftRun.maxY < 2.999 || liftRun.f1 > 1e-6 || liftRun.f2 > 1e-6 || Math.abs(liftRun.lobby - 4) > 1e-6) errors.push("Lift left money on the floors (v0.48.1) " + JSON.stringify(liftRun));
if (liftRun.partial < 3) errors.push("Lift loaded instantly instead of filling up");
// v0.48.1: the car's height adds up in small steps and can sit a hair above a floor (2.9999999999); it must still
// stop there (it used to round past it and turn back empty)
const hair = await page.evaluate(() => {
  const L = SVT.lab();
  L.assign = {}; L.floors.forEach((f) => { f.left = 0; f.stock = 0; }); L.lobby = 0;
  const cap = SVT.liftCapacity(L);
  L.floors[2].stock = cap * 0.5;
  L.lift = { phase: "down", y: 3 - 1e-12, load: 0, timer: 0, at: 2 };
  for (let i = 0; i < 200 && L.lift.phase !== "idle"; i++) SVT.tick(0.05);
  return { left: L.floors[2].stock / cap, lobby: L.lobby / cap };
});
console.log("lift hair", JSON.stringify(hair));
if (hair.left > 1e-9 || Math.abs(hair.lobby - 0.5) > 1e-9) errors.push("Lift skipped a floor it was a hair above (v0.48.1) " + JSON.stringify(hair));
// one tap = one cycle: a floor builds once and stops; the warehouse ships one trip and stops
const cyc = await page.evaluate(() => {
  const L = SVT.lab();
  L.assign = {}; L.floors.forEach((f) => { f.left = 0; f.stock = 0; }); L.commercial.left = 0; L.lobby = 100; L.cash = 0;
  L.lift = { phase: "idle", y: 0, load: 0, timer: 0, at: 0 };
  SVT.tap("floor", 1); SVT.tap("floor", 1); SVT.tap("commercial", 0);
  for (let i = 0; i < 200; i++) SVT.tick(0.05); // v0.46.5: one normal-speed trip carries the whole pile
  const one = SVT.B.floorOutput(1, L.floors[0].lvl) * SVT.prestigeMult(L) * SVT.B.FLOOR_CYCLE;
  return { cycles: L.floors[0].stock / one, floorLeft: L.floors[0].left, shipped: L.cash, trip: SVT.shipLoad(L), whLeft: L.commercial.left, lift: L.lift.phase };
});
console.log("one tap", JSON.stringify(cyc));
const SVT_HEAVY = await page.evaluate(() => SVT.B.WH_HEAVY);
if (Math.abs(cyc.cycles - 1) > 1e-6 || cyc.floorLeft > 0) errors.push("Floor tap did not run exactly one cycle");
if (Math.abs(cyc.shipped - Math.min(100, cyc.trip * SVT_HEAVY)) > 1e-6 || cyc.whLeft > 0) errors.push("Warehouse tap did not ship the whole pile in one trip (v0.46.4)");
if (cyc.lift !== "idle") errors.push("Lift moved without a tap");
// v0.47.1 (user: "I don't want it to wait. If there is available money to pick up it should pick it up"): with no
// managers, the cart reaches the top while the lift is still pouring money out; it takes what is there straight away,
// finishes its trip on time, and gets paid (the old cart waited, then could drive off empty).
const nowait = await page.evaluate(() => {
  const L = SVT.lab();
  L.assign = {}; L.floors.forEach((f) => { f.left = 0; f.stock = 0; }); L.lobby = 0; L.cash = 0;
  const cap = SVT.shipLoad(L);
  L.lift = { phase: "unload", y: 0, load: cap * 0.6, timer: 30, at: 0 };
  L.lobby = cap * 0.2; SVT.tap("commercial", 0);
  let ticks = 0;
  for (; ticks < 400 && !(L.cash > 0); ticks++) SVT.tick(0.05);
  return { cash: L.cash, secs: ticks * 0.05, trip: SVT.B.WH_TRIP, lift: L.lift.phase };
});
console.log("cart does not wait", JSON.stringify(nowait));
if (!(nowait.cash > 0) || nowait.secs > nowait.trip + 0.11) errors.push("Warehouse cart waited or came back empty while the lift was unloading");
// upgrade badge: ▲ / ▲▲ / ▲▲▲ for 1 / 10 / 50 affordable levels
const tri = await page.evaluate(async () => {
  const L = SVT.lab(), out = [];
  const lv = L.freight.lvl, to = (k) => k - (lv % k); // v0.26: floors cap at Lv 10, so the lift carries this test
  const k = SVT.costScale(L, "freight", 0), cost = (n) => SVT.B.bulk("freight", 0, lv, n, 0, 0, k).cost;
  for (const c of [0, cost(1), cost(to(10)), cost(to(50))]) {
    L.cash = c * 1.0001; await new Promise((r) => setTimeout(r, 400));
    out.push(document.querySelector(".lift-tower .lvl-btn").dataset.tri);
  }
  return out.join("");
});
console.log("badge tiers", tri);
if (tri !== "0123") errors.push("Upgrade badge tiers wrong: " + tri);
// ×10 rounds up to the next multiple: Lv 56 ×10 -> 60, Lv 60 ×10 -> 70. Max lands on a multiple of 50 when one is
// affordable (Lv 56 with cash for 140 -> 100; Lv 56 with cash for 60 -> 60), and the max level when the cash reaches it.
const steps = await page.evaluate(() => {
  const L = SVT.lab(), f = L.freight, out = []; // the lift: floors cap at Lv 10 since v0.26
  L.cash = 1e30;
  for (const [lv, b] of [[56, 10], [60, 10]]) { f.lvl = lv; SVT.setBuy(b); out.push(lv + SVT.quote(L, "freight", 0).count); }
  SVT.setBuy("max");
  const costTo = (lv, to) => SVT.B.bulk("freight", 0, lv, to - lv, 0, 0, SVT.costScale(L, "freight", 0)).cost;
  f.lvl = 56; L.cash = costTo(56, 140); out.push(56 + SVT.quote(L, "freight", 0).count);
  L.cash = costTo(56, 60); out.push(56 + SVT.quote(L, "freight", 0).count);
  L.cash = 1e300; out.push(56 + SVT.quote(L, "freight", 0).count);
  // v0.36.1: Next jumps to the cap when affordable, else the next multiple of 100, then 50, else the next unlock (5s)
  SVT.setBuy("next");
  L.cash = 1e300; for (const lv of [56, 60, 9]) { f.lvl = lv; out.push(lv + SVT.quote(L, "freight", 0).count); }
  f.lvl = 56; L.cash = costTo(56, 150); out.push(56 + SVT.quote(L, "freight", 0).count);
  L.cash = costTo(56, 80); out.push(56 + SVT.quote(L, "freight", 0).count);
  L.cash = costTo(56, 58); out.push(56 + SVT.quote(L, "freight", 0).count);
  L.cash = 1e30; f.lvl = 1; SVT.setBuy(1);
  return out.join(",");
});
console.log("step buys", steps);
if (steps !== "60,70,100,60,400,400,400,400,100,60,60") errors.push("x10, Max or Next rounding is wrong: " + steps);
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
  L.round = SVT.B.ROUNDS.length - 1; while (L.floors.length < 30) L.floors.push({ lvl: 1, stock: 0, left: 0 });
  const early = SVT.raise(); // v0.26: the IPO needs the whole lab maxed first
  const wild0 = SVT.vaultWild();
  L.floors.forEach((f) => (f.lvl = SVT.B.FLOOR_MAX)); L.freight.lvl = SVT.B.HUB_MAX; L.commercial.lvl = SVT.B.HUB_MAX;
  const ok = SVT.raise();
  return { ok, early, roundCoins: SVT.vaultWild() - wild0, beaten: SVT.labBeaten(SVT.state().labs.garage), lab6: !!SVT.state().labs.cinema, active: SVT.state().activeLab, back: SVT.switchLab("garage") };
});
console.log("beat garage", JSON.stringify(beat));
if (!beat.ok || !beat.beaten || !beat.lab6 || beat.active === "garage" || beat.back !== false) errors.push("Beating Garage HQ did not close it and open lab 6");
if (beat.early !== false || beat.roundCoins !== 5 + 50) errors.push("IPO gate or round coins wrong: " + JSON.stringify(beat)); // 5 for the IPO round + 50 for lab 6 opening
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
  const gatedFirst = SVT.maxLevel(L, "freight"); // v0.46: shafts first, then the hubs can follow
  L.floors.forEach((f, i) => SVT.upgrade("floor", i + 1));
  SVT.upgrade("freight", 0); SVT.upgrade("commercial", 0);
  SVT.tick(1);
  return { max, gatedFirst, lift: L.freight.lvl, shaft: L.floors[0].lvl, shaftMax: SVT.raidStage(L).max.floor, quoteAtMax: SVT.quote(L, "freight", 0).count, first: q.count, won: L.won, p: SVT.raidProgress(L).p };
});
console.log("raid max", JSON.stringify(capped));
if (capped.lift !== capped.max || capped.shaft !== capped.shaftMax || capped.quoteAtMax !== 0 || !capped.won) errors.push("Raid max level or clear-by-maxing is wrong");
await page.waitForTimeout(400);
await page.screenshot({ path: out + "/12-raid-clear.png" });
const cleared = await page.evaluate(() => SVT.state().raid.cleared);
if (cleared !== 1 || !(await page.locator("h2", { hasText: "Stage 1 plundered!" }).isVisible())) errors.push("Raid stage did not clear");
// v0.34.1: the clear popup names the next mine and goes straight into it; it also shows when a panel was open
const nextBtn = await page.locator(".raid-next").textContent();
if (!nextBtn.startsWith("⚔️ Raid stage 2: " + (await page.evaluate(() => SVT.RAID.stage(2).name)))) errors.push("Raid clear popup next button wrong: " + nextBtn);
await page.evaluate(() => SVT.openRaid());
const popupOverPanel = await page.evaluate(() => new Promise((res) => { SVT.showRaidClear(1, { tokens: 1 }); setTimeout(() => res(!!document.querySelector(".raid-clear")), 50); }));
if (!popupOverPanel) errors.push("Raid clear popup does not replace an open panel");
// v0.34.2: the popup has no close button and a tap on the backdrop leaves it up; Home is the only other way out
await page.click("#sheet", { position: { x: 5, y: 5 }, force: true }); await page.waitForTimeout(100);
// v0.34.3: no pinch zoom (viewport meta, touch-action and gesture handlers)
const noZoom = await page.evaluate(() => ({ meta: document.querySelector('meta[name="viewport"]').content, ta: getComputedStyle(document.body).touchAction, js: SVT.noZoom === true }));
if (!noZoom.meta.includes("maximum-scale=1") || !noZoom.meta.includes("user-scalable=no") || noZoom.ta !== "pan-x pan-y" || !noZoom.js) errors.push("Pinch zoom not disabled: " + JSON.stringify(noZoom));
const stickyClear = await page.evaluate(() => ({ up: !!document.querySelector(".raid-clear"), x: !!document.querySelector("#sheet .x-btn"), home: [...document.querySelectorAll(".raid-clear .btn")].some((b) => b.textContent.includes("Home")) }));
if (!stickyClear.up || stickyClear.x || !stickyClear.home) errors.push("Raid clear popup should be sticky with a Home button: " + JSON.stringify(stickyClear));
// v0.33: a first clear pays Viking tokens (batch 1 pays 1), tokens unlock boats, the raid def has 50 shaft names and 5 tiers
const viking = await page.evaluate(() => { const R = SVT.RAID, L = SVT.lab(); return { tokens: SVT.vikingTokens(), boats: SVT.boatsUnlocked(), boat: SVT.boatIndex(), stages: R.STAGES, shafts50: R.shafts(50), shafts51: R.shafts(51), t1: R.time(1), t50: R.time(50), t51: R.time(51), t250: R.time(250), loot: R.def(50).products.length, tier: R.def(1).tierOf(50), cost2: R.boatCost(2), cost50: R.boatCost(50), svg: SVT.boatSvg(50).length, names: new Set(SVT.BOATS.map((b) => b.name)).size, omens: R.stage(1).omens.length }; });
console.log("viking", JSON.stringify(viking));
if (viking.tokens !== 1 || viking.boats !== 2 || viking.boat !== 2) errors.push("Viking tokens or boats wrong after a clear: " + JSON.stringify(viking));
if (viking.stages !== 250 || viking.shafts50 !== 50 || viking.shafts51 !== 1 || viking.t1 !== 1500 || Math.abs(viking.t50 - 6000) > 1e-6 || Math.abs(viking.t51 - 6000) > 1e-6 || Math.abs(viking.t250 - 1536000) > 1e-6) errors.push("Raid batches or pacing wrong (v0.48: HARDER 5): " + JSON.stringify(viking));
if (viking.loot !== 50 || viking.tier !== 4 || viking.cost2 < 1 || viking.cost50 !== 750 || viking.svg < 500 || viking.names !== 50) errors.push("Raid loot, tiers or boats wrong: " + JSON.stringify(viking));
// v0.35: Viking Hoard. 10,000 relics with fixed rarities; spins spend tokens but boats go by tokens earned; Max and merge.
const hoard = await page.evaluate(() => {
  const S = SVT.state(), H = SVT.HOARD, out = {};
  const names = new Set(); const counts = [0, 0, 0, 0, 0, 0];
  for (let id = 0; id < H.N; id++) { names.add(SVT.relic(id).name); counts[SVT.relicRar(id)]++; }
  out.names = names.size; out.counts = counts;
  S.raid.tokens = 40; S.hoard = { owned: {}, spent: 0, pity: 0, serial: 0 };
  out.spendable0 = SVT.hoardTokens(); out.boats0 = SVT.boatsUnlocked();
  const first = SVT.hoardSpin(1); out.firstRar = first && first.rar; out.spendable1 = SVT.hoardTokens(); out.boats1 = SVT.boatsUnlocked();
  out.max3 = SVT.hoardMaxSpins(3);
  const many = SVT.hoardSpinMany(3); out.many = many.length; out.spendable2 = SVT.hoardTokens(); out.owned = SVT.hoardCount();
  out.uniqueOwned = new Set(SVT.hoardOwned()).size;
  // merge: hand over nine commons, forge one, then forge all
  const commons = []; for (let id = 0; id < H.N && commons.length < 9; id++) if (SVT.relicRar(id) === 0 && !SVT.hoardHas(id)) commons.push(id);
  commons.forEach((id) => { S.hoard.owned[id] = { n: ++S.hoard.serial, at: 0, stake: 0, from: "spin" }; });
  const before = SVT.hoardCount(0);
  const forged = SVT.hoardMerge(0); out.forgedRar = forged && forged.rar; out.commonsAfter = SVT.hoardCount(0); out.commonsBefore = before;
  out.mergesLeft = SVT.hoardMerges().find((g) => g.rar === 0).ids.length;
  out.noMythicMerge = SVT.hoardMerges().every((g) => g.rar < 5);
  return out;
});
console.log("hoard", JSON.stringify(hoard));
if (hoard.names !== 10000 || hoard.counts.join() !== "5000,2800,1500,550,130,20") errors.push("Hoard catalogue wrong " + JSON.stringify(hoard));
if (hoard.spendable0 !== 40 || hoard.spendable1 !== 39 || hoard.boats1 !== hoard.boats0 || hoard.firstRar < 2) errors.push("Hoard spin or boats wrong " + JSON.stringify(hoard));
if (hoard.max3 !== 13 || hoard.many !== 13 || hoard.spendable2 !== 0 || hoard.owned !== 14 || hoard.uniqueOwned !== 14) errors.push("Hoard Max spins wrong " + JSON.stringify(hoard));
if (hoard.forgedRar !== 1 || hoard.commonsAfter !== hoard.commonsBefore - 3 || hoard.mergesLeft !== hoard.commonsAfter || !hoard.noMythicMerge) errors.push("Hoard merge wrong " + JSON.stringify(hoard));
await page.evaluate(() => { SVT.state().raid.tokens = 60; SVT.openRaid(); }); await page.waitForTimeout(200);
await page.click(".hoard-btn"); await page.waitForTimeout(300);
if (!(await page.locator("#hoard .vault-odds").isVisible())) errors.push("Hoard panel did not open from the Stages panel");
await page.screenshot({ path: out + "/12b-hoard.png" });
await page.click("#hoard .vault-stake >> nth=3"); await page.click(".hoard-spin"); await page.waitForTimeout(4500);
await page.screenshot({ path: out + "/12c-hoard-reveal.png" });
if (!(await page.locator("#hoard .vault-reveal .hoard-card").isVisible())) errors.push("Hoard reveal card missing");
await page.evaluate(() => SVT.openHoard("hoard")); await page.waitForTimeout(200);
await page.screenshot({ path: out + "/12d-hoard-collection.png" });
if ((await page.locator("#hoard .hoard-card").count()) < 10) errors.push("Hoard collection tab shows too few relics");
if (!(await page.locator("#hoard .hoard-merge-row").count())) errors.push("Forge rows missing from the Relics tab");
// v0.40: token pills explain themselves; the help sheet sums to spend + spent = earned
await page.evaluate(() => { SVT.closeHoard(); SVT.tokenHelp(); }); await page.waitForTimeout(250);
const tokenHelp = await page.evaluate(() => { const c = [...document.querySelectorAll(".token-sum-cell b")].map((b) => parseInt(b.textContent.replace(/\D/g, ""), 10)); return { cells: c, sums: c[0] + c[1] === c[2], steps: document.querySelectorAll(".token-help .hoard-step").length, title: document.querySelector("#sheet h2").textContent }; });
if (!tokenHelp.sums || tokenHelp.steps !== 3 || tokenHelp.title !== "Viking tokens") errors.push("Token help sheet wrong: " + JSON.stringify(tokenHelp));
await page.screenshot({ path: out + "/12f-token-help.png" });
await page.evaluate(() => document.querySelector("#sheet .x-btn").click());
await page.evaluate(() => SVT.openRaid()); await page.waitForTimeout(250);
const pill = await page.evaluate(() => { const p = document.querySelector("#sheet .token-pill"); return p ? p.tagName + "|" + p.textContent : "none"; });
if (!/^BUTTON\|🛡 \d+ to spend · \d+ earned/.test(pill)) errors.push("Raid token pill wrong: " + pill);
await page.evaluate(() => document.querySelector("#sheet .x-btn").click());
// v0.36: relics equip on the longship (5 slots) and add their rarity bonus to Viking mine income; equipped relics never forge
const ship = await page.evaluate(() => {
  const S = SVT.state(), H = SVT.HOARD, out = {}, L = S.labs.raid;
  S.hoard.ship = []; SVT.hoardRecalc();
  const base = SVT.cashMult(L, SVT.now(), true); // v0.36.1: boosts multiply the cash at the warehouse
  const ids = SVT.hoardOwned().sort((a, b) => SVT.relicRar(b) - SVT.relicRar(a));
  out.eq = ids.slice(0, 5).map((id) => SVT.hoardEquip(id)); out.sixth = SVT.hoardEquip(ids[5]);
  const expect = Math.min(H.MAX_BONUS, Math.round((1 + ids.slice(0, 5).reduce((a, id) => a + H.BONUS[SVT.relicRar(id)] - 1, 0)) * 100) / 100);
  out.mult = SVT.hoardMult(); out.expect = expect; out.ratio = +(SVT.cashMult(L, SVT.now(), true) / base).toFixed(3);
  out.labUnchanged = +(SVT.loadMult(S.labs.garage, "floor", 1) / SVT.loadMult(S.labs.garage, "floor", 1)).toFixed(3);
  out.forgeSkipsEquipped = SVT.hoardMerges().every((g) => g.ids.every((id) => !SVT.hoardEquipped(id)));
  SVT.hoardUnequip(ids[0]); out.afterOff = SVT.hoardMult();
  S.hoard.ship = []; out.best = SVT.hoardBest(); out.bestMult = SVT.hoardMult(); out.bestN = SVT.hoardShip().length;
  return out;
});
console.log("ship", JSON.stringify(ship));
if (ship.eq.some((x) => !x) || ship.sixth || ship.mult !== ship.expect || Math.abs(ship.ratio - ship.mult) > 1e-6 || !ship.forgeSkipsEquipped) errors.push("Longship equip or bonus wrong " + JSON.stringify(ship));
if (!(ship.afterOff < ship.mult) || !ship.best || ship.bestMult !== ship.expect || ship.bestN !== 5) errors.push("Longship take-off or Best 5 wrong " + JSON.stringify(ship));
await page.evaluate(() => SVT.openHoard("hoard")); await page.waitForTimeout(200);
const eqBtns = await page.locator("#hoard .hoard-equip").count(), offBtns = await page.locator("#hoard .hoard-equip.off").count();
if (eqBtns < 10 || offBtns !== 5) errors.push("Relic cards missing Equip / Take off buttons: " + eqBtns + "/" + offBtns);
await page.evaluate(() => SVT.openHoard("ship")); await page.waitForTimeout(200);
await page.screenshot({ path: out + "/12e-hoard-ship.png" });
if ((await page.locator("#hoard .hoard-card.onship").count()) !== 5) errors.push("Longship tab does not show the 5 equipped relics");
if (!(await page.locator("#hoard .hoard-steps").isVisible())) errors.push("Hoard steps explainer missing");
await page.evaluate(() => { SVT.closeHoard(); SVT.showRaidClear(1, { tokens: 1 }); });
await page.click("text=Raid stage 2");
await page.waitForTimeout(300);
if ((await page.evaluate(() => SVT.lab().stage)) !== 2) errors.push("Stage 2 did not open after clearing");
// v0.46.1: Max all spends until nothing more is affordable (user: "max as much as it can until I have no money left")
const saveChk = await page.evaluate(() => {
  const L = SVT.lab(); L.floors[0].lvl = 40; L.freight.lvl = 10; L.commercial.lvl = 10;
  L.cash = SVT.nextFloor(L).cost * 0.9;
  const cash = L.cash, r = SVT.upgradeAll();
  return { levels: r.levels, spent: cash - L.cash, left: SVT.bestUpgrade(L) === null };
});
console.log("maxAllSpends", JSON.stringify(saveChk));
if (!(saveChk.levels > 0) || !(saveChk.spent > 0) || !saveChk.left) errors.push("Max all did not spend down to nothing affordable (v0.46.1): " + JSON.stringify(saveChk));
// v0.46.3: an error in one lab's step is caught and shown; the game loop and the other labs keep running
const errChk = await page.evaluate(async () => {
  const S = SVT.state(), L = SVT.lab(), other = Object.keys(S.labs).find((id) => S.labs[id] !== L && !SVT.labBeaten(S.labs[id]));
  const bad = S.labs[other]; const keep = bad.floors; bad.floors = null; // makes that lab's step throw
  const cash0 = L.cash; L.cash += 0; await new Promise((r) => setTimeout(r, 600));
  const shown = [...document.querySelectorAll("#toasts *")].some((e) => /Game error/.test(e.textContent));
  bad.floors = keep;
  const t0 = SVT.lab().lifetime; await new Promise((r) => setTimeout(r, 400));
  return { err: !!SVT.lastError, where: SVT.lastError && SVT.lastError.where, shown, still: SVT.lab().lifetime >= t0 };
});
console.log("errors caught", JSON.stringify(errChk));
if (!errChk.err || !errChk.shown || !errChk.still) errors.push("Lab step errors not caught or shown (v0.46.3): " + JSON.stringify(errChk));
await page.evaluate(() => { SVT.lastError = null; });
// v0.41: Unlock max opens shafts while the cash lasts (stage 2 has one more shaft to open), and stops at the last one
const unlock = await page.evaluate(() => {
  const L = SVT.lab(), btn = !!document.querySelector(".btn.unlock-max");
  L.cash = 1e12;
  const q = SVT.unlockManyQuote(L), f0 = L.floors.length, k = SVT.unlockMany(), nf = SVT.nextFloor(L);
  return { q: q.count, cost: q.cost, k, grew: L.floors.length - f0, stopped: !nf, again: SVT.unlockMany(), btn, floors: L.floors.length };
});
console.log("unlock", JSON.stringify(unlock));
if (!(unlock.q >= 1) || unlock.k !== unlock.q || unlock.grew !== unlock.k || !unlock.stopped || unlock.again !== 0 || !unlock.btn || unlock.floors !== 2 || !(unlock.cost > 0)) errors.push("Unlock max wrong (v0.41): " + JSON.stringify(unlock));
await page.evaluate(() => { SVT.lab().cash = 0; });
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
// v0.36.1: a press that starts and ends on the backdrop closes the panel even when no click follows (iPhone)
const backdrop = await page.evaluate(() => {
  const s = document.getElementById("sheet");
  const ev = (t) => new PointerEvent(t, { isPrimary: true, button: 0, clientX: 4, clientY: 4, bubbles: true });
  s.dispatchEvent(ev("pointerdown")); s.dispatchEvent(ev("pointerup"));
  return !document.getElementById("sheet");
});
if (!backdrop) errors.push("Backdrop pointer tap did not close the Level panel");
// the sticky raid popup must ignore it
await page.evaluate(() => SVT.showRaidClear(1, { tokens: 1 }));
await page.waitForTimeout(100);
const stickyStays = await page.evaluate(() => {
  const s = document.getElementById("sheet");
  const ev = (t) => new PointerEvent(t, { isPrimary: true, button: 0, clientX: 4, clientY: 4, bubbles: true });
  s.dispatchEvent(ev("pointerdown")); s.dispatchEvent(ev("pointerup"));
  return !!document.getElementById("sheet");
});
if (!stickyStays) errors.push("Sticky raid popup closed on a backdrop pointer tap");
await page.click("#sheet button:has-text('Home')"); await page.waitForTimeout(200);
await page.evaluate(() => SVT.setView("lab"));
// save + reload restores, and the game reopens on the home screen
await page.evaluate(() => SVT.save());
await page.reload(); await page.waitForTimeout(400);
await page.screenshot({ path: out + "/14-home.png" });
// v0.37: six bubbles (Map, Viking Raid, Hoard, Rush, Bug Hunt, Vault) plus Play and Settings
const tiles = await page.locator(".bubble, .play-btn, .gear-btn").count();
console.log("home tiles", tiles);
if (tiles !== 8) errors.push("Home screen missing or wrong tile count: " + tiles);
await page.click(".play-btn", { force: true }); await page.waitForTimeout(200);
if (!(await page.locator(".lab-view").isVisible())) errors.push("Play did not open the lab");
await page.click(".bottom-nav .nav-btn.center"); await page.waitForTimeout(200);
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
// v0.36.1: a bin sorts on pointerdown (no click needed), and a falling part never catches the pointer
const binTap = await page.evaluate(() => {
  const g = SVT.rushGame(), p = g.parts.filter((x) => !x.done).sort((a, b) => b.y - a.y)[0];
  if (!p) return "no part";
  const before = g.score, bin = document.querySelector(".rush-bin.b-" + p.p.dir);
  bin.dispatchEvent(new PointerEvent("pointerdown", { isPrimary: true, button: 0, bubbles: true, cancelable: true }));
  const partHit = getComputedStyle(document.querySelector(".rush-part") || bin).pointerEvents;
  return (g.score - before) + "|" + (document.querySelector(".rush-part") ? partHit : "none");
});
console.log("rush bin tap", binTap);
if (binTap !== "1|none") errors.push("Rush bin pointerdown did not sort or parts catch the pointer: " + binTap);
await page.evaluate(() => SVT.rushGame().end()); await page.waitForTimeout(700);
await page.screenshot({ path: out + "/17-rush-result.png" });
if (!(await page.locator(".rush-big").isVisible())) errors.push("Rush results screen missing");
const boost = await page.evaluate(() => {
  const S = SVT.state(), L = S.labs.arcade, before = SVT.rates(L).income, raidBefore = S.labs.raid ? SVT.cashMult(S.labs.raid, SVT.now(), true) : 0;
  const wait = SVT.rushWait();
  S.rush.next = 0;
  const r = SVT.finishRush(65);
  return { wait, applied: r.applied, mult: SVT.rushMult(), ratio: SVT.rates(L).income / before, raidBoost: !S.labs.raid || Math.abs(SVT.cashMult(S.labs.raid, SVT.now(), true) / raidBefore - 5) < 1e-6, loadsStay: SVT.loadMult(L, "floor", 1) === 1, again: SVT.finishRush(20).applied };
});
console.log("rush boost", JSON.stringify(boost));
await page.evaluate(() => SVT.setView("lab")); await page.waitForTimeout(300);
const whBoost = await page.evaluate(() => { const e = document.querySelector(".wh-boost"), m = Math.round(SVT.boostMult(SVT.lab(), SVT.now()) * 100) / 100; return (e && !e.hidden ? e.textContent : "hidden") + "|" + m; });
if (whBoost.split("|")[0] !== "⚡ ×" + whBoost.split("|")[1] || !(+whBoost.split("|")[1] >= 5)) errors.push("Warehouse boost tag wrong: " + whBoost);
if (!(boost.wait > 800) || !boost.applied || boost.mult !== 5 || Math.abs(boost.ratio - 5) > 1e-6 || !boost.raidBoost || !boost.loadsStay || boost.again) errors.push("Rush boost or cooldown is wrong (v0.36.1: cash at the warehouse, loads unchanged)");
await page.click("#rush .btn.fund-cta"); await page.waitForTimeout(200);
if (await page.locator("#rush").count()) errors.push("Rush did not close");
await page.screenshot({ path: out + "/18-home-boosted.png" });
// v0.37: Bug Hunt, the second mini game: home bubble, a run tapped on pointerdown, results, a boost that stacks with Rush
await page.evaluate(() => SVT.setView("home")); await page.waitForTimeout(200);
const homeBubbles = await page.evaluate(() => [...document.querySelectorAll(".bubble")].map((b) => b.getAttribute("aria-label")).join(","));
if (homeBubbles !== "Map,Viking Raid,Hoard,Rush,Bug Hunt,Vault") errors.push("Home bubbles wrong: " + homeBubbles);
await page.click(".bubble.b-bugs", { force: true }); await page.waitForTimeout(300);
await page.screenshot({ path: out + "/21-bugs-start.png" });
await page.click(".bugs-play");
let bugTaps = 0, gemLeft = true;
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(120);
  if (i === 20) await page.screenshot({ path: out + "/22-bugs-run.png" });
  bugTaps += await page.evaluate(() => {
    const t = document.querySelector(".bug-tile.has-bug");
    if (!t) return 0;
    t.dispatchEvent(new PointerEvent("pointerdown", { isPrimary: true, button: 0, bubbles: true, cancelable: true }));
    return 1;
  });
}
const bugRun = await page.evaluate(() => ({ score: SVT.bugsGame().score, lives: SVT.bugsGame().lives }));
console.log("bug run", JSON.stringify(bugRun), "taps", bugTaps);
if (!(bugRun.score >= 3) || bugRun.score !== bugTaps || bugRun.lives !== 3) errors.push("Bug Hunt: tapping bugs on pointerdown did not score cleanly: " + JSON.stringify(bugRun) + " taps " + bugTaps);
await page.evaluate(() => SVT.bugsGame().end()); await page.waitForTimeout(700);
await page.screenshot({ path: out + "/23-bugs-result.png" });
if (!(await page.locator("#bugs .rush-big").isVisible())) errors.push("Bug Hunt results screen missing");
const bugBoost = await page.evaluate(() => {
  const S = SVT.state(), L = S.labs.arcade, before = SVT.boostMult(L, SVT.now()), rush = SVT.rushMult();
  S.bugs.next = 0;
  const r = SVT.finishBugs(36);
  const after = SVT.boostMult(L, SVT.now());
  return { applied: r.applied, mult: SVT.bugsMult(), ratio: after / before, stacks: Math.abs(after - rush * 3 * SVT.vaultMult()) < 1e-9, rush, again: SVT.finishBugs(12).applied, wait: SVT.bugsWait() > 800 };
});
console.log("bug boost", JSON.stringify(bugBoost));
if (!bugBoost.applied || bugBoost.mult !== 3 || Math.abs(bugBoost.ratio - 3) > 1e-6 || !bugBoost.stacks || bugBoost.rush !== 5 || bugBoost.again || !bugBoost.wait) errors.push("Bug Hunt boost does not stack with Rush: " + JSON.stringify(bugBoost));
await page.evaluate(() => SVT.closeBugs());
await page.evaluate(() => SVT.setView("home")); await page.waitForTimeout(300);
const bugLabel = await page.evaluate(() => document.querySelector(".b-bugs .bubble-label").textContent);
if (!bugLabel.startsWith("×3 ")) errors.push("Bug Hunt bubble does not show the boost: " + bugLabel);
await page.screenshot({ path: out + "/24-home-six-bubbles.png" });
await page.evaluate(() => SVT.setView("lab"));
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
  for (let r = 0; r < SVT.B.ROUNDS.length; r++) {
    while (L.floors.length < SVT.B.ROUNDS[r].needFloor) L.floors.push({ lvl: 1, stock: 0, left: 0 });
    if (SVT.B.ROUNDS[r].maxed) { L.floors.forEach((f) => (f.lvl = SVT.B.FLOOR_MAX)); L.freight.lvl = SVT.B.HUB_MAX; L.commercial.lvl = SVT.B.HUB_MAX; }
    SVT.raise();
  }
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
// wild: 50 starter + 2 x 50 for labs 2 and 6 opening + 2 x 5 for the Seed and IPO rounds raised above (v0.26)
if (vault.coin !== 10 || vault.wild !== 160 || !vault.done || !vault.canReplay || !vault.replaying || vault.canReplayAgain) errors.push("Vault: coin on beat or replay start wrong");
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
const icons = await page.evaluate(() => { let n = 0, bad = 0; SVT.LABS.forEach((l) => l.products.forEach((p, i) => { n++; if (!SVT.productSvg(l.id, i).startsWith("url(\"data:image/svg+xml")) bad++; })); const v = Object.values(SVT.PRODUCT_ICON); return { n, bad, sets: Object.keys(SVT.ICONS).length, mapped: v.length, distinct: new Set(v).size }; });
if (icons.n !== 1500 || icons.bad || icons.mapped !== 1500 || icons.distinct !== 1500 || icons.sets !== 1500) errors.push("Vault: every product needs its own icon " + JSON.stringify(icons));
const maskOk = await page.evaluate(() => [...document.querySelectorAll(".worn .vault-art-ic")].every((el) => (getComputedStyle(el).webkitMaskImage || getComputedStyle(el).maskImage || "").includes("svg")));
if (!maskOk) errors.push("Vault: item pictures are not drawn as icon masks");
await page.screenshot({ path: out + "/19-home-worn.png" });
// v0.34.1: the Viking Raid bubble is on top of Chip's boat, so a tap on its icon reaches it (user: it opened the boats)
const raidHit = await page.evaluate(() => { const b = document.querySelector(".bubble.b-raid"), r = b.getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width * 0.8, r.top + r.height / 2); return { hit: !!el && b.contains(el), on: el && (el.className.baseVal || el.className || el.tagName) }; });
if (!raidHit.hit) errors.push("Viking Raid bubble is covered on its right side by " + raidHit.on);
await page.click(".bubble.b-vault", { force: true }); await page.waitForTimeout(300);
await page.screenshot({ path: out + "/20-vault.png" });
if (!(await page.locator(".vault-odds").isVisible())) errors.push("Vault: odds table not shown");
await page.evaluate(() => { SVT.state().vault.coins.garage = 10; SVT.state().vault.wild = 0; SVT.openVault(); });
await page.click(".vault-stake >> nth=3"); await page.click(".vault-roll"); await page.waitForTimeout(1200);
await page.screenshot({ path: out + "/21-vault-roll.png" });
await page.waitForTimeout(4500);
await page.screenshot({ path: out + "/22-vault-reveal.png" });
if (!(await page.locator(".vault-reveal .vault-card").isVisible())) errors.push("Vault: reveal card missing");
// v0.34: bulk Max rolls and a random lab. Garage 7 coins + arcade 4 + 5 wild at stake 3: 2 garage rolls, 1 arcade roll,
// then arcade 1 + 2 wild (most own coins first), then garage 1 + 2 wild = 5 rolls with one wild coin left; the count promised is the count made.
const bulk = await page.evaluate(() => {
  const S = SVT.state(), V = SVT.B.VAULT, out = {};
  S.vault.coins.garage = 7; S.vault.coins.arcade = 4; S.vault.wild = 5;
  out.max3 = SVT.vaultMaxRolls(SVT.VAULT_ANY, 3); out.maxGarage = SVT.vaultMaxRolls("garage", 3); out.maxCap = SVT.vaultMaxRolls(SVT.VAULT_ANY, 1);
  const got = SVT.vaultRollMany(SVT.VAULT_ANY, 3);
  out.rolled = got.length; out.labs = [...new Set(got.map((it) => it.lab))].sort(); out.left = SVT.vaultCoins(); out.wild = SVT.vaultWild();
  S.vault.coins.garage = 150; S.vault.wild = 0;
  out.capped = SVT.vaultRollMany("garage", 1).length; out.capMax = V && SVT.VAULT_BULK_MAX; out.afterCap = SVT.vaultCoins("garage");
  S.vault.coins.garage = 12; S.vault.coins.arcade = 6; S.vault.wild = 0;
  return out;
});
console.log("bulk", JSON.stringify(bulk));
if (bulk.max3 !== 5 || bulk.maxGarage !== 4 || bulk.maxCap !== 16 || bulk.rolled !== 5 || bulk.labs.join() !== "arcade,garage" || bulk.left !== 1 || bulk.wild !== 1) errors.push("Vault: bulk Max count or lab picking wrong " + JSON.stringify(bulk));
if (bulk.capped !== bulk.capMax || bulk.afterCap !== 150 - bulk.capMax) errors.push("Vault: bulk roll cap wrong " + JSON.stringify(bulk));
await page.evaluate(() => SVT.openVault()); await page.waitForTimeout(200);
if (!(await page.locator(".vault-lab.any").isVisible())) errors.push("Vault: random lab option missing");
await page.click(".vault-lab.any"); await page.click(".vault-stake >> nth=1"); await page.click(".vault-bulk"); await page.waitForTimeout(200);
const bulkBtn = await page.locator(".vault-roll").textContent();
if (!bulkBtn.startsWith("Roll Max · 6 × 3 coins")) errors.push("Vault: Max button text wrong: " + bulkBtn);
await page.screenshot({ path: out + "/22b-vault-max.png" });
await page.click(".vault-roll"); await page.waitForTimeout(2200);
const haul = await page.locator(".vault-haul .vault-card").count();
if (haul !== 6 || !(await page.locator(".vault-tally-pill").count())) errors.push("Vault: Max reveal shows " + haul + " cards");
if ((await page.evaluate(() => SVT.vaultCoins())) !== 0) errors.push("Vault: Max roll left coins behind");
await page.screenshot({ path: out + "/22c-vault-haul.png" });
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
  out.raidSame = !S.labs.raid || (() => { const R = S.labs.raid, m = SVT.vaultMult(), a = SVT.cashMult(R, SVT.now(), true); v.show = {}; SVT.vaultRecalc(); const b = SVT.cashMult(R, SVT.now(), true); SVT.vaultWear("hand_l", strong[0].id); SVT.vaultWear("hand_r", strong[1].id); return Math.abs(a / b - m) < 1e-6; })(); // v0.33: worn bonuses count in the raid too
  // v0.45: no cap: every worn x1.5 item adds 0.5 (six make x4, nine make x5.5)
  const big = v.items.filter((x) => x.rar >= 4).slice(0, 6); big.forEach((x) => { x.boost = 1.5; });
  v.show = {}; SVT.vaultSlots().forEach((sl, i) => { if (big[i]) { const fit = v.items.find((x) => x.boost === 1.5 && !SVT.vaultSlotOf(x.id) && SVT.vaultFits(x, sl.id)); if (fit) SVT.vaultWear(sl.id, fit.id); } });
  out.capped = SVT.vaultMult() === Math.round((1 + Object.values(v.show).filter(Boolean).reduce((a, id) => a + SVT.vaultItem(id).boost - 1, 0)) * 100) / 100 && B.MAX_BONUS === Infinity;
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
  // merging (v0.38): any 3 unequipped items of one rarity AND type become 1 of the next rarity, a random product of that type from one of their labs
  const g = SVT.vaultMerges()[0];
  out.groupsTyped = SVT.vaultMerges().every((m) => m.items.every((x) => SVT.itemCat(x) === m.cat && x.rar === m.rar));
  const before = v.items.length, mergesBefore = SVT.vaultMerges().length;
  const pick = g ? g.items.slice(-3) : [];
  const merged = g ? SVT.vaultMerge(g.rar, pick.map((x) => x.id)) : null;
  out.merge = merged ? { ok: merged.rar === g.rar + 1 && pick.some((x) => x.lab === merged.lab) && merged.merged.length === 3 && SVT.itemCat(merged) === g.cat, count: before - v.items.length, listed: mergesBefore > 0, gone: pick.filter((x) => !SVT.vaultItem(x.id)).length === 3, boostOk: merged.boost >= 1, sameRar: new Set(pick.map((x) => x.rar)).size === 1 } : null;
  const w = SVT.vaultMerges()[0]; const weak = w ? SVT.vaultMerge(w.rar, null, w.cat) : null;
  out.mergeWeak = !!weak && weak.rar === w.rar + 1 && SVT.itemCat(weak) === w.cat;
  // mixed types never merge
  const mixed = (() => { const a = v.items.filter((x) => !SVT.vaultSlotOf(x.id) && x.rar === 0); const cats = {}; a.forEach((x) => (cats[SVT.itemCat(x)] = cats[SVT.itemCat(x)] || []).push(x)); const ks = Object.keys(cats).filter((k) => cats[k].length >= 2); if (ks.length < 2) return "skip"; return SVT.vaultMerge(0, [cats[ks[0]][0].id, cats[ks[0]][1].id, cats[ks[1]][0].id]); })();
  out.mixedRefused = mixed === "skip" || mixed === null;
  out.mergeBad = SVT.vaultMerge(0, [1, 1, 1]) === null;
  // an item on Chip never merges: it is not listed, cannot be picked, and is not among the "3 weakest"
  const wornIds = Object.values(v.show).filter(Boolean);
  const wornItem = v.items.find((x) => wornIds.includes(x.id));
  const sameRar = v.items.filter((x) => x.rar === wornItem.rar && !wornIds.includes(x.id)).slice(0, 2);
  const beforeWorn = v.items.length;
  out.wornMerge = {
    worn: wornIds.length,
    notListed: SVT.vaultMerges().every((mm) => mm.items.every((x) => !wornIds.includes(x.id))),
    pickRefused: SVT.vaultMerge(wornItem.rar, [wornItem.id].concat(sameRar.map((x) => x.id))) === null,
    stillThere: !!SVT.vaultItem(wornItem.id) && v.items.length === beforeWorn,
    weakestKeeps: (() => { for (const mm of SVT.vaultMerges()) { const r = SVT.vaultMerge(mm.rar, null, mm.cat); if (!r) return false; } return wornIds.every((id) => SVT.vaultItem(id) && SVT.vaultSlotOf(id)); })(),
  };
  // Max merge cascades until nothing is left to merge, never touching worn items; the needs list names labs per type
  const nBefore = v.items.length, made = SVT.vaultMergeAll();
  out.mergeAll = { made: made.length, left: SVT.vaultMerges().length, items: nBefore - v.items.length === made.length * 2, wornSafe: wornIds.every((id) => SVT.vaultItem(id) && SVT.vaultSlotOf(id)) };
  // v0.46: 10 merge-only rarities above Mythic: 3 Mythic -> 1 Divine, 3 Omega -> 1 Singularity (the top, never merges);
  // rolls still stop at Mythic
  const R16 = B.RARITIES, free = v.items.filter((x) => !SVT.vaultSlotOf(x.id)), cat0 = SVT.itemCat(free.find((x) => free.filter((y) => SVT.itemCat(y) === SVT.itemCat(x)).length >= 6) || free[0]);
  const same = free.filter((x) => SVT.itemCat(x) === cat0).slice(0, 6);
  const setR = (x, r) => { x.rar = r; x.rarity = R16[r].id; };
  same.slice(0, 3).forEach((x) => setR(x, 5)); same.slice(3, 6).forEach((x) => setR(x, 14));
  const div = SVT.vaultMerge(5, same.slice(0, 3).map((x) => x.id)), sing = SVT.vaultMerge(14, same.slice(3, 6).map((x) => x.id));
  out.tiers = { n: R16.length, rolled: B.ROLLED, div: div && div.rarity, divBoost: div && div.boost, sing: sing && sing.rarity, singBoost: sing && sing.boost,
    topStays: !SVT.vaultMerges().some((m) => m.rar === R16.length - 1), same: same.length, rollTop: SVT.vaultOdds(10, 0).length };
  // v0.48: a Singularity item binds to Chip for good (+BIND_ADD each, no limit); nothing lower binds
  const m0 = SVT.vaultMult(), b0 = SVT.vaultBound(), low = v.items.find((x) => x.rar < R16.length - 1);
  const lowRefused = !SVT.vaultBind(low.id) && !!SVT.vaultItem(low.id);
  const top = sing || (() => { const x = v.items.find((y) => !SVT.vaultSlotOf(y.id) && y.rar < R16.length - 1); setR(x, R16.length - 1); return x; })();
  SVT.vaultWear((SVT.vaultSlots().find((sl) => SVT.vaultFits(top, sl.id)) || { id: "x" }).id, top.id);
  const wasWorn = !!SVT.vaultSlotOf(top.id), wornMult = SVT.vaultMult();
  const bound = SVT.vaultBind(top.id);
  const extra = v.items.find((x) => x.rar < R16.length - 1 && !SVT.vaultSlotOf(x.id)); setR(extra, R16.length - 1);
  const again = SVT.vaultBind(extra.id);
  out.bind = { lowRefused, bound, again, gone: !SVT.vaultItem(top.id) && !SVT.vaultItem(extra.id), count: SVT.vaultBound() - b0,
    mult: Math.round((SVT.vaultMult() - (wasWorn ? wornMult - 3 : m0)) * 100) / 100, slotFreed: wasWorn && !SVT.vaultSlotOf(top.id) };
  const needs = SVT.vaultNeeds();
  out.needs = { n: needs.length, allEmptySlots: needs.every((x) => x.slots.every((sl) => !v.show[sl.id])), labsMake: needs.every((x) => x.labs.length && x.labs.every((l) => SVT.vaultLabCats(l.id).includes(x.cat))), feet: SVT.LABS.filter((l) => SVT.vaultLabCats(l.id).includes("feet")).length };
  return out;
});
console.log("bonus", JSON.stringify(bonus));
if (!bonus.allHaveBoost || !bonus.mythicBoost) errors.push("Vault: item boosts missing");
if (JSON.stringify(bonus.tiers) !== JSON.stringify({ n: 16, rolled: 6, div: "divine", divBoost: 1.75, sing: "singularity", singBoost: 4, topStays: true, same: 6, rollTop: 6 })) errors.push("Vault: merge-only rarities wrong (v0.46) " + JSON.stringify(bonus.tiers));
if (!bonus.wornMerge || !bonus.wornMerge.worn || !bonus.wornMerge.notListed || !bonus.wornMerge.pickRefused || !bonus.wornMerge.stillThere || !bonus.wornMerge.weakestKeeps) errors.push("Vault: an equipped item could be merged " + JSON.stringify(bonus.wornMerge));
if (bonus.mult !== bonus.sum || Math.abs(bonus.ratio - bonus.mult) > 1e-6 || !bonus.raidSame || !bonus.capped) errors.push("Vault: bonus multiplier wrong " + JSON.stringify(bonus));
if (JSON.stringify(bonus.bind) !== JSON.stringify({ lowRefused: true, bound: true, again: true, gone: true, count: 2, mult: 6, slotFreed: true })) errors.push("Vault: binding to Chip wrong (v0.48) " + JSON.stringify(bonus.bind));
if (Object.values(bonus.cats).reduce((a, b) => a + b, 0) !== 1500 || Object.keys(bonus.cats).length !== 7) errors.push("Vault: not every product has a slot category " + JSON.stringify(bonus.cats));
if (JSON.stringify(bonus.catSamples) !== JSON.stringify({ calc: "hand", watch: "wrist", ai: "head", neck: "neck", headphones: "head", server: "floor", shoe: "feet", jacket: "body" })) errors.push("Vault: product categories wrong " + JSON.stringify(bonus.catSamples));
if (!bonus.handSlot.startsWith("hand") || !bonus.floorSlot.startsWith("floor") || bonus.twice !== null || !bonus.notListedTwice || !bonus.eligibleOk || !bonus.wristOnlyWrist) errors.push("Vault: one-tap equip or per-slot inventory wrong " + JSON.stringify(bonus));
if (!bonus.merge || !bonus.merge.ok || bonus.merge.count !== 2 || !bonus.merge.listed || !bonus.merge.gone || !bonus.merge.boostOk || !bonus.merge.sameRar || !bonus.mergeWeak || !bonus.mergeBad || !bonus.groupsTyped || !bonus.mixedRefused) errors.push("Vault: merge wrong " + JSON.stringify([bonus.merge, bonus.mergeWeak, bonus.mergeBad, bonus.groupsTyped, bonus.mixedRefused]));
if (!bonus.mergeAll || bonus.mergeAll.left !== 0 || !bonus.mergeAll.items || !bonus.mergeAll.wornSafe) errors.push("Vault: Max merge wrong " + JSON.stringify(bonus.mergeAll));
if (!bonus.needs || !bonus.needs.allEmptySlots || !bonus.needs.labsMake || !(bonus.needs.feet >= 1)) errors.push("Vault: needs list wrong " + JSON.stringify(bonus.needs));
// v0.38: tapping a tab swaps the panel in place (class still, no entry animation) instead of replaying the open animation
await page.evaluate(() => { SVT.closeVault(); SVT.openVault(); }); await page.waitForTimeout(250);
const stillSwap = await page.evaluate(() => { const first = document.getElementById("vault").classList.contains("still"); document.querySelector(".vault-tab:nth-child(2)").click(); const v = document.getElementById("vault"); return { first, still: v.classList.contains("still"), anim: getComputedStyle(v).animationName, needs: !!document.querySelector(".vault-needs, .vault-needs-none") || true }; });
if (stillSwap.first || !stillSwap.still || stillSwap.anim !== "none") errors.push("Vault panel replays its open animation on a tab tap: " + JSON.stringify(stillSwap));
await page.evaluate(() => SVT.openVault()); await page.waitForTimeout(250);
await page.screenshot({ path: out + "/28-vault-needs.png" });
if (!(await page.locator(".vault-needs, .vault-needs-none").count())) errors.push("Vault: Chip's needs block missing from the Roll tab");
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
// v0.42: Reset Viking mine only. Two taps on the Raid panel button; Viking stages, tokens and the Hoard start over,
// the labs and the Vault stay. Viking hires cost the same as lab hires, and every Viking stage is shafts 100, hubs 500.
const vpre = await page.evaluate(() => {
  const S = SVT.state();
  if (!S.raid.cleared) S.raid.cleared = 3;
  S.raid.tokens = Math.max(S.raid.tokens || 0, 5); S.hoard.spent = 1;
  if (!S.labs.raid) SVT.startRaid(1);
  const R = SVT.RAID, caps = [[1, 100], [25, 300], [50, 500], [51, 100], [250, 500]].every(([s, h]) => R.stage(s).max.floor === 100 && R.stage(s).max.freight === h && R.stage(s).max.commercial === h);
  // v0.46: the hubs can only go as far as the shafts have got
  const gl = SVT.newLab("raid"); gl.stage = 25; gl.floors[0].lvl = 1; const g1 = SVT.hubGate(gl);
  for (let i = 1; i < 25; i++) gl.floors.push({ lvl: 100 }); gl.floors[0].lvl = 100; const g2 = SVT.hubGate(gl);
  gl.floors.length = 1; gl.floors[0].lvl = 100; const g3 = SVT.hubGate(gl);
  const gateOk = g1 === 10 && g2 === 300 && g3 === 300 && SVT.maxLevel(gl, "freight") === 300 && (gl.floors[0].lvl = 25, SVT.hubGate(gl)) === 75 && SVT.maxLevel(gl, "floor") === 100;
  const rl = S.labs.raid, hireSame = SVT.hireCost(rl, "floor") === SVT.B.hireCost("floor", rl.hires.floor);
  const step = [R.shaftStep(1), R.shaftStep(250)], bad = [R.stage(51).omens.length, R.stage(250).omens.length];
  // v0.43: Viking Raid managers have Norse names and Viking portraits
  SVT.switchLab("raid"); SVT.setView("lab"); rl.cash = 1e12;
  const vm = SVT.hire("floor"); SVT.assign(vm.id, "floor", 1); SVT.render();
  const vik = { norse: SVT.VIKING_NAMES.includes(vm.name), portraits: document.querySelectorAll(".seat .av.viking").length };
  return { caps: caps && gateOk, gate: [g1, g2, g3], hireSame, step, bad, vik, garage: S.labs.garage.lifetime, vault: S.vault.items.length };
});
if (!vpre.vik.norse || !(vpre.vik.portraits >= 1)) errors.push("Viking managers are not drawn as Vikings (v0.43): " + JSON.stringify(vpre.vik));
await page.evaluate(() => { SVT.closeVault && SVT.closeVault(); SVT.openRaid(); }); await page.waitForTimeout(250);
await page.click("#sheet .raid-reset");
const armedTxt = await page.locator("#sheet .raid-reset").textContent();
await page.click("#sheet .raid-reset"); await page.waitForTimeout(250);
const vpost = await page.evaluate(() => { const S = SVT.state(); return { cleared: S.raid.cleared, tokens: SVT.vikingTokens(), spent: S.hoard.spent, relics: Object.keys(S.hoard.owned).length, raidLab: !!S.labs.raid, active: S.activeLab, garage: S.labs.garage.lifetime, vault: S.vault.items.length, boats: SVT.boatsUnlocked() }; });
const labVikings = await page.evaluate(() => { SVT.setView("lab"); const LL = SVT.lab(); LL.cash = Math.max(LL.cash, 1e9); if (!SVT.mgrOf(LL, "freight", 0)) { const hm = SVT.hire("freight"); SVT.assign(hm.id, "freight", 0); } SVT.render(); const id = SVT.lab().id, look = SVT.MANAGER_LOOKS[id];
  return { id, av: document.querySelectorAll(".av").length, vik: document.querySelectorAll(".av.viking").length, themed: document.querySelectorAll(".av.themed.h-" + (look && look[0])).length }; });
if (labVikings.vik !== 0) errors.push("Lab managers are drawn as Vikings: " + JSON.stringify(labVikings));
if (!(labVikings.av > 0) || labVikings.themed !== labVikings.av) errors.push("Lab managers do not wear their lab's theme (v0.44): " + JSON.stringify(labVikings));
// v0.44: every lab has its own look (hat style + colours + badge), and a raid manager is a Viking, not themed
const looks = await page.evaluate(() => {
  const L = SVT.MANAGER_LOOKS, ids = SVT.LABS.map((l) => l.id), m = { name: "Test", rank: "rare" };
  const sig = ids.map((id) => (L[id] || []).join("|")), raid = SVT.avatarEl(m, "raid");
  return { missing: ids.filter((id) => !L[id]), unique: new Set(sig).size === ids.length, styles: new Set(ids.map((id) => L[id] && L[id][0])).size,
    cls: SVT.avatarEl(m, "space").className, raid: raid.className };
});
if (looks.missing.length || !looks.unique || looks.styles < 10 || !/themed h-bubble/.test(looks.cls) || !/viking/.test(looks.raid) || /themed/.test(looks.raid)) errors.push("Themed manager looks wrong (v0.44): " + JSON.stringify(looks));
await page.evaluate(() => SVT.openSettings && SVT.openSettings()); await page.waitForTimeout(200);
const settingsBtn = await page.locator("#sheet .raid-reset").count();
console.log("viking reset", JSON.stringify({ vpre, armedTxt, vpost, settingsBtn }));
if (!vpre.caps || !vpre.hireSame || !(vpre.step[0] === 1.3 && Math.abs(vpre.step[1] - 1.5) < 1e-9) || vpre.bad[0] < 3 || vpre.bad[1] !== 4) errors.push("Viking caps, hire price, shaft step or omens wrong (v0.42): " + JSON.stringify(vpre));
if (!/Tap again/.test(armedTxt) || vpost.cleared !== 0 || vpost.tokens !== 0 || vpost.spent !== 0 || vpost.relics !== 0 || vpost.raidLab || vpost.active === "raid" || vpost.garage !== vpre.garage || vpost.vault !== vpre.vault || vpost.boats !== 1) errors.push("Reset Viking mine only wrong (v0.42): " + JSON.stringify(vpost));
if (typeof settingsBtn === "number" && settingsBtn !== 1) errors.push("Settings has no Reset Viking mine only button");
// v0.42.2: with a panel open, a toast never covers the cash pill
await page.evaluate(() => { SVT.closeSheet && SVT.closeSheet(); SVT.setView("lab"); }); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector(".lvl-btn").click()); await page.waitForTimeout(300);
const toastBox = await page.evaluate(async () => {
  SVT.toast("Unlocked: +10% build speed"); await new Promise((r) => setTimeout(r, 250));
  const a = document.querySelector(".cash-pill").getBoundingClientRect(), t = document.querySelector("#toasts .toast:last-child").getBoundingClientRect();
  return { sheet: !!document.querySelector("#sheet"), overlap: !(t.bottom <= a.top || t.top >= a.bottom || t.right <= a.left || t.left >= a.right), toastTop: Math.round(t.top), cashBottom: Math.round(a.bottom) };
});
console.log("toast vs cash", JSON.stringify(toastBox));
if (!toastBox.sheet || toastBox.overlap) errors.push("Toast covers the cash pill with a panel open (v0.42.2): " + JSON.stringify(toastBox));
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
console.log("horizontal overflow", overflow);
console.log("errors", JSON.stringify(errors));
await browser.close();
if (errors.length || overflow) process.exit(1);
