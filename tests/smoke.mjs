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
  // At least 12 hires, and keep going (rarely needed) until a Budget Cut manager is on the roster: the type filter and
  // price ability tests below need one, and a 12-roll streak without one happens about 1 time in 100.
  for (let i = 0; i < 60 && (i < 12 || !Object.values(L.managers).some((m) => m.ability === "budget")); i++) SVT.hire("floor");
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
if (!grouped.first.startsWith("#") || grouped.headers.length < 2 || !/^(🌟 Super|⚡ Speed)/.test(grouped.headers[0])) errors.push("Managers are not grouped by ability type: " + JSON.stringify(grouped));
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
    const a = SVT.activeAbility(L, "floor", 1), st = SVT.abilityStats(m); // v0.30: the tier sets strength and timers
    await new Promise((f) => setTimeout(f, 450));
    out[kind] = { ratio: +(rate() / r0).toFixed(3), boost: st.mult, cls: (scene().className.match(/ab-\w+/) || [])[0], sp: scene().style.getPropertyValue("--sp"), tag: scene().querySelector(".ab-tag").hidden,
      leftDrop: +(left0 - L.floors[0].left).toFixed(2), speedMult: SVT.speedMult(L, "floor", 1), loadMult: +SVT.loadMult(L, "floor", 1).toFixed(3), nodeMult: +SVT.nodeMult(L, "floor", 1).toFixed(3),
      deal: document.querySelector('.floor[data-floor="1"] .lvl-btn').classList.contains("deal"), cost: +(SVT.quote(L, "floor", 1).cost / c0).toFixed(2), discount: st.off, kindOk: a && a.kind === kind,
      rank: m.rank, active: st.active, cooldown: st.cooldown, durOk: Math.abs((m.activeUntil - SVT.now()) - st.active) < 1 && Math.abs((m.cdUntil - m.activeUntil) - st.cooldown) < 1 };
    m.activeUntil = 0; m.cdUntil = 0; SVT.unassign(m.id);
  }
  return out;
});
console.log("ability kinds", JSON.stringify(kinds));
await page.screenshot({ path: out + "/04c-ability-kinds.png" });
const sp = kinds.speed, st = kinds.storage, dc = kinds.discount;
for (const k of ["speed", "storage", "discount"]) if (kinds[k] !== "none" && !kinds[k].durOk) errors.push("Ability timers do not follow the tier (v0.30): " + JSON.stringify(kinds[k]));
// v0.30: the tier table itself, and the six super managers.
const tiers = await page.evaluate(() => {
  const B = SVT.B, L = SVT.lab(), out = { stats: B.ABILITY_STATS, supers: {} };
  for (const role of ["floor", "freight", "commercial"]) for (const rank of ["epic", "legendary"]) {
    const sp = B.ABILITIES[role].find((a) => a.kind === "special" && a.rank === rank);
    out.supers[role + ":" + rank] = sp ? { id: sp.id, name: sp.name, active: sp.active, cooldown: sp.cooldown, passive: sp.passive } : null;
  }
  // Hiring Epic or Legendary gives the role's super manager; Common to Rare never do.
  const seen = { super: 0, regular: 0, wrong: 0 };
  const rnd = Math.random; let i = 0; const seq = [0.001, 0.02, 0.1, 0.5, 0.9, 0.01, 0.03];
  Math.random = () => seq[i++ % seq.length];
  L.cash = 1e15;
  for (let k = 0; k < 14; k++) { const m = SVT.hire("freight"); const r = SVT.rank(m.rank), ab = SVT.abilityOf(m); if (!!r.super !== (ab.kind === "special")) seen.wrong++; if (r.super) { seen.super++; if (ab.rank !== m.rank) seen.wrong++; } else seen.regular++; }
  Math.random = rnd;
  out.hires = seen;
  return out;
});
console.log("tiers", JSON.stringify(tiers));
if (tiers.stats.common.speed.mult !== 2.5 || tiers.stats.common.speed.active !== 60 || tiers.stats.common.speed.cooldown !== 300 || tiers.stats.uncommon.storage.mult !== 3.5 || tiers.stats.rare.discount.off !== 0.7 || tiers.stats.rare.discount.active !== 30 || tiers.stats.rare.discount.cooldown !== 480) errors.push("Regular tier table is off: " + JSON.stringify(tiers.stats));
if (Object.values(tiers.supers).some((x) => !x) || tiers.supers["floor:legendary"].id !== "midas" || tiers.supers["commercial:legendary"].active !== 20 || tiers.supers["freight:epic"].cooldown !== 900) errors.push("Super managers missing or wrong: " + JSON.stringify(tiers.supers));
if (tiers.hires.wrong || !tiers.hires.super || !tiers.hires.regular) errors.push("Hiring does not hand out super managers by tier: " + JSON.stringify(tiers.hires));
// Super manager actives and passives in the tick: Dropshipper sells from the floor at x5, Unicorn adds +25% lab-wide,
// Hyperloop empties a crate in one go, Quantum Courier warps floor stock to the surface, Overclocker pays x3,
// Venture Capitalist cuts every price by 90% and shortens cooldowns 15%. Timers are absolute, so they survive a reload.
const supers = await page.evaluate(() => {
  const B = SVT.B, L = SVT.lab(), out = {};
  const give = (role, id) => { const m = SVT.hire(role); m.rank = B.ABILITIES[role].find((a) => a.id === id).rank; m.ability = id; return m; };
  L.cash = 1e15; while (L.floors.length < 3) SVT.unlockFloor();
  const siphon = give("floor", "siphon"), unicorn = give("floor", "midas"), hyper = give("freight", "turbine"), courier = give("freight", "wormhole"), over = give("commercial", "overclock"), vc = give("commercial", "baron");
  SVT.assign(siphon.id, "floor", 1); SVT.assign(unicorn.id, "floor", 2); SVT.assign(hyper.id, "freight", 0); SVT.assign(over.id, "commercial", 0);
  out.passiveSpeed = SVT.speedMult(L, "floor", 1); out.revenue = SVT.revenueMult(L); out.whSpeed = SVT.passives(L, "commercial", 0).speed; out.liftOff = SVT.discount(L, "freight", 0);
  const price0 = SVT.quote(L, "floor", 3).cost;
  const quiet = () => { L.floors.forEach((f) => { f.stock = 0; f.left = 0; }); L.lobby = 0; L.commercial.carry = 0; L.commercial.left = 0; L.lift.load = 0; L.lift.phase = "idle"; L.lift.y = 0; };
  // Dropshipper: one cycle's output on floor 1 is paid x5 (x1.25 Unicorn) straight to cash, nothing lands in the crate.
  quiet(); L.floors[1].left = 10; const c0 = L.cash; L.floors[0].left = 0.01; SVT.activate("floor", 1);
  SVT.tick(0.1);
  const outF = B.floorOutput(1, L.floors[0].lvl) * SVT.prestigeMult(L) * SVT.loadMult(L, "floor", 1) * B.FLOOR_CYCLE;
  out.siphon = { cashGain: +((L.cash - c0) / outF).toFixed(3), stockSame: L.floors[0].stock === 0, active: siphon.activeUntil - SVT.now() };
  // Hyperloop: the lift empties a big crate in one stop.
  quiet(); L.floors[2].stock = 1e9; SVT.activate("freight", 0);
  for (let i = 0; i < 60; i++) SVT.tick(0.5);
  out.hyper = { crate: L.floors[2].stock, speed: SVT.speedMult(L, "freight", 0), lobbyUp: L.lobby + L.lift.load > 1e8 };
  // Quantum Courier: everything on the floors jumps to the surface, then again 5 s later.
  hyper.activeUntil = 0; hyper.cdUntil = 0; SVT.assign(courier.id, "freight", 0); quiet(); L.floors[2].stock = 777; L.lift.warpAt = 0; SVT.activate("freight", 0);
  SVT.tick(0.1); const warped1 = L.lobby, nextIn = L.lift.warpAt - SVT.now();
  out.courier = { warped1, nextIn: Math.round(nextIn), floor3: L.floors[2].stock, liftCap: SVT.passives(L, "freight", 0).load, liftOff: +SVT.discount(L, "freight", 0).toFixed(2) };
  // Overclocker: x3 on deliveries, 8x cart speed. Venture Capitalist: −90% everywhere, −15% cooldowns.
  SVT.activate("commercial", 0); out.over = { cash: SVT.cashMult(L, SVT.now(), true), speed: SVT.speedMult(L, "commercial", 0) };
  over.activeUntil = 0; over.cdUntil = 0; SVT.assign(vc.id, "commercial", 0); out.cdMult = SVT.cooldownMult(L);
  SVT.activate("commercial", 0); out.vc = { floorOff: +SVT.discount(L, "floor", 3).toFixed(2), liftOff: +SVT.discount(L, "freight", 0).toFixed(2), price: +(SVT.quote(L, "floor", 3).cost / price0).toFixed(3), active: Math.round(vc.activeUntil - SVT.now()), cd: Math.round(vc.cdUntil - vc.activeUntil) };
  // Reload: timers are absolute in the save.
  SVT.save(); const saved = JSON.parse(localStorage.getItem("svt-save")); const sm = saved.labs[L.id].managers[vc.id];
  out.persist = sm.activeUntil === vc.activeUntil && sm.cdUntil === vc.cdUntil && saved.labs[L.id].lift.warpAt === L.lift.warpAt;
  SVT.openManagers("floor", "floor", 2); out.card = document.querySelector("#sheet .mcard.assigned .rarity").textContent; document.querySelector('#sheet [aria-label="Close"]').click();
  // v0.31.2: no selling. A hire from a slot does not replace a manager mid-ability.
  SVT.assign(unicorn.id, "floor", 2); unicorn.activeUntil = SVT.now() + 60; unicorn.cdUntil = unicorn.activeUntil + 60;
  SVT.openManagers("floor", "floor", 2); document.querySelector("#sheet .btn.hire").click();
  out.noSwap = SVT.mgrOf(L, "floor", 2) === unicorn; out.noSell = typeof SVT.sell === "undefined" && !document.querySelector("#sheet .btn.sell");
  unicorn.activeUntil = 0; unicorn.cdUntil = 0; document.querySelector('#sheet [aria-label="Close"]').click();
  [siphon, unicorn, hyper, courier, over, vc].forEach((m) => { SVT.unassign(m.id); delete L.managers[m.id]; });
  Object.values(L.managers).filter((m) => m.role === "floor" && m.id > vc.id).forEach((m) => { SVT.unassign(m.id); delete L.managers[m.id]; });
  quiet(); while (L.floors.length > 1) L.floors.pop(); SVT.render(); // back to one floor: the next step unlocks four more
  return out;
});
console.log("supers", JSON.stringify(supers));
if (Math.abs(supers.passiveSpeed - 1.15) > 1e-9 || Math.abs(supers.revenue - 1.25) > 1e-9 || Math.abs(supers.whSpeed - 1.1) > 1e-9 || Math.abs(supers.liftOff - 0.1) > 1e-9) errors.push("Super passives wrong: " + JSON.stringify(supers));
if (Math.abs(supers.siphon.cashGain - 5 * 1.25) > 0.05 || !supers.siphon.stockSame || Math.abs(supers.siphon.active - 45) > 1) errors.push("Dropshipper does not sell from the floor at x5: " + JSON.stringify(supers.siphon));
if (supers.hyper.crate !== 0 || Math.abs(supers.hyper.speed - 8) > 1e-9 || !supers.hyper.lobbyUp) errors.push("Hyperloop did not empty the crate at 8x: " + JSON.stringify(supers.hyper));
if (supers.courier.warped1 !== 777 || supers.courier.nextIn !== 5 || supers.courier.floor3 !== 0 || Math.abs(supers.courier.liftCap - 1.2) > 1e-9 || supers.courier.liftOff !== 0.25) errors.push("Quantum Courier warp wrong: " + JSON.stringify(supers.courier));
if (supers.over.cash !== 3 * 1.25 || Math.abs(supers.over.speed - 8 * 1.1) > 1e-9) errors.push("Overclocker wrong: " + JSON.stringify(supers.over));
if (Math.abs(supers.cdMult - 0.85) > 1e-9 || supers.vc.floorOff !== 0.9 || supers.vc.liftOff !== 0.93 || /* 1 − 0.75 × 0.1: the Courier's passive cut stacks under the VC */ Math.abs(supers.vc.price - 0.1) > 0.01 || supers.vc.active !== 20 || supers.vc.cd !== Math.round(1200 * 0.85)) errors.push("Venture Capitalist wrong: " + JSON.stringify(supers.vc));
if (!supers.persist) errors.push("Ability timers are not saved as absolute times");
if (!supers.noSwap || !supers.noSell) errors.push("Hire replaced a mid-ability manager, or selling still exists (v0.31.2): " + JSON.stringify({ noSwap: supers.noSwap, noSell: supers.noSell }));
if (!/Legendary · The Unicorn/.test(supers.card)) errors.push("Super manager card does not name the special: " + supers.card);
if (sp === "none" || !sp.kindOk || sp.cls !== "ab-speed" || sp.sp !== String(sp.boost) || sp.speedMult !== sp.boost || Math.abs(sp.ratio - sp.boost) > 0.05 || (sp.boost * 0.45 < 2.5 && sp.leftDrop < 0.4 * sp.boost * 0.8)) errors.push("Speed ability not visible or wrong: " + JSON.stringify(sp));
if (st === "none" || !st.kindOk || st.cls !== "ab-storage" || st.speedMult !== 1 || Math.abs(st.loadMult / st.nodeMult - 1) > 1e-6 || Math.abs(st.ratio - st.boost) > 0.05) errors.push("Storage ability wrong: " + JSON.stringify(st));
if (dc === "none" || !dc.kindOk || dc.cls !== "ab-discount" || !dc.deal || Math.abs(dc.cost - (1 - dc.discount)) > 0.02) errors.push("Price ability wrong: " + JSON.stringify(dc));
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
const want = { legendary: 1500, epic: 3000, rare: 10000, uncommon: 30000, common: 55500 }; // v0.30: Super folded into Legendary
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
  L.cash = 1e30;
  SVT.setBuy("next");
  for (const lv of [56, 60, 9]) { f.lvl = lv; out.push(lv + SVT.quote(L, "freight", 0).count); }
  f.lvl = 1; SVT.setBuy(1);
  return out.join(",");
});
console.log("step buys", steps);
if (steps !== "60,70,100,60,400,60,65,10") errors.push("x10 or Max rounding is wrong: " + steps);
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
if (viking.stages !== 250 || viking.shafts50 !== 50 || viking.shafts51 !== 1 || viking.t1 !== 300 || Math.abs(viking.t50 - 1200) > 1e-6 || Math.abs(viking.t51 - 1200) > 1e-6 || Math.abs(viking.t250 - 307200) > 1e-6) errors.push("Raid batches or pacing wrong: " + JSON.stringify(viking));
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
await page.evaluate(() => SVT.openHoard("merge")); await page.waitForTimeout(200);
await page.screenshot({ path: out + "/12e-hoard-merge.png" });
await page.evaluate(() => { SVT.closeHoard(); SVT.showRaidClear(1, { tokens: 1 }); });
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
  const S = SVT.state(), L = S.labs.arcade, before = SVT.rates(L).income, raidBefore = S.labs.raid ? SVT.loadMult(S.labs.raid, "floor", 1) : 0;
  const wait = SVT.rushWait();
  S.rush.next = 0;
  const r = SVT.finishRush(65);
  return { wait, applied: r.applied, mult: SVT.rushMult(), ratio: SVT.rates(L).income / before, raidBoost: !S.labs.raid || Math.abs(SVT.loadMult(S.labs.raid, "floor", 1) / raidBefore - 5) < 1e-6, again: SVT.finishRush(20).applied };
});
console.log("rush boost", JSON.stringify(boost));
if (!(boost.wait > 800) || !boost.applied || boost.mult !== 5 || Math.abs(boost.ratio - 5) > 1e-6 || !boost.raidBoost || boost.again) errors.push("Rush boost or cooldown is wrong (v0.33: the raid is boosted too)");
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
if (icons.n !== 900 || icons.bad || icons.mapped !== 900 || icons.distinct !== 900 || icons.sets !== 900) errors.push("Vault: every product needs its own icon " + JSON.stringify(icons));
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
  out.raidSame = !S.labs.raid || (() => { const R = S.labs.raid, m = SVT.vaultMult(), a = SVT.loadMult(R, "floor", 1); v.show = {}; SVT.vaultRecalc(); const b = SVT.loadMult(R, "floor", 1); SVT.vaultWear("hand_l", strong[0].id); SVT.vaultWear("hand_r", strong[1].id); return Math.abs(a / b - m) < 1e-6; })(); // v0.33: worn bonuses count in the raid too
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
    weakestKeeps: (() => { for (const mm of SVT.vaultMerges()) { const r = SVT.vaultMerge(mm.rar); if (!r) return false; } return wornIds.every((id) => SVT.vaultItem(id) && SVT.vaultSlotOf(id)); })(),
  };
  return out;
});
console.log("bonus", JSON.stringify(bonus));
if (!bonus.allHaveBoost || !bonus.mythicBoost) errors.push("Vault: item boosts missing");
if (!bonus.wornMerge || !bonus.wornMerge.worn || !bonus.wornMerge.notListed || !bonus.wornMerge.pickRefused || !bonus.wornMerge.stillThere || !bonus.wornMerge.weakestKeeps) errors.push("Vault: an equipped item could be merged " + JSON.stringify(bonus.wornMerge));
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
