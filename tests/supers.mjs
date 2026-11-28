// Super managers / Headhunter Slots test (v0.53): node tests/supers.mjs (serves the repo on :8123 first).
import { chromium } from "playwright";
const url = process.env.URL || "http://localhost:8123/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(url);
await page.waitForTimeout(500);
await page.click("text=Start building");
const r = await page.evaluate(() => {
  const out = {};
  out.start = SVT.superCoins();
  out.badCheat = SVT.superCheat("nope");
  out.cheat = SVT.superCheat("money") && SVT.superCheat(" Money ") && SVT.superCoins() === out.start + 10000;
  SVT.superCoinsAdd(1e6);
  const spins = []; for (let i = 0; i < 300; i++) spins.push(SVT.superSpin(0));
  out.allSpun = spins.every(Boolean);
  out.maxRar = Math.max(...spins.map((s) => s.m.rar));
  out.pityOk = SVT.superPityLeft() <= SVT.SUPER.PITY;
  out.areas = [...new Set(spins.map((s) => s.m.area))].sort().join(",");
  // hold the perk
  const last = spins[spins.length - 1].m;
  SVT.superHold("perk", true);
  out.holdCost = SVT.superSpinCost(0) === 750;
  out.held = SVT.superSpin(0).m.perk === last.perk;
  SVT.superHold("perk", false);
  // v0.54.2: multi-spin and the "grand" code
  const c0 = SVT.superCoins(), many = SVT.superSpinMany(0, 10);
  out.many = many.list.length === 10 && c0 - SVT.superCoins() <= 10 * 500 && SVT.superSpinMaxCount(0) <= SVT.SUPER.MULTI_MAX;
  const c1 = SVT.superCoins(); out.grand = SVT.superCheat("grand") === 100000 && SVT.superCoins() === c1 + 100000;
  // merge to the top (Ascended), never past it
  const made = SVT.superMergeAll();
  out.merged = made.length > 0;
  out.topRar = Math.max(...SVT.superList().map((m) => m.rar));
  out.capOk = out.topRar <= 10;
  for (let i = 0; i < 60; i++) SVT.superSpin(0); // fresh ones of every area after the big merge
  // seat + power
  const lab = SVT.lab(), m = SVT.superList().find((x) => x.area === "commercial");
  out.seat = SVT.superSeat(m.id, "commercial", 0) && SVT.mgrOf(lab, "commercial", 0) === m;
  out.wrongSeat = SVT.superSeat(SVT.superList().find((x) => x.area === "freight").id, "commercial", 0) === false;
  out.used = SVT.activate("commercial", 0) && !!SVT.activeAbility(lab, "commercial", 0);
  out.cooldown = m.cdUntil - m.activeUntil;
  out.unseat = SVT.unassign(m.id) && !SVT.mgrOf(lab, "commercial", 0);
  return out;
});
console.log(JSON.stringify(r));
if (r.badCheat || !r.cheat) errors.push("cheat code");
if (!r.allSpun || r.maxRar > 5) errors.push("spins roll Common..Mythic");
if (!r.holdCost || !r.held) errors.push("hold");
if (!r.many || !r.grand) errors.push("multi-spin / grand");
if (!r.merged || !r.capOk) errors.push("merge stops at Ascended");
if (!r.seat || !r.wrongSeat || !r.used || !r.unseat) errors.push("seating / power");
if (r.areas !== "commercial,floor,freight,wild") errors.push("areas " + r.areas);
console.log("errors", errors);
await browser.close();
process.exit(errors.length ? 1 : 0);
