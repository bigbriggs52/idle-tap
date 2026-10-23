// Pacing sim: an efficient player with every node managed, buying the best payback upgrade each time.
// Usage: node tests/pace.mjs            -> time to IPO in each lab
// It loads the real game files, so it measures whatever balance.js says.
import fs from "fs";
import vm from "vm";

export function loadGame() {
  const ctx = { window: {}, performance, console, Math, setInterval() {}, document: { addEventListener() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ["data", "balance", "raid", "game"]) vm.runInContext(fs.readFileSync(new URL(`../js/${f}.js`, import.meta.url), "utf8"), ctx);
  return ctx.SVT;
}

// Runs one lab from scratch. stop(lab, t) ends the run; returns { t, lab, log }.
export let SAVE_FOR = 120;
export function play(SVT, lab, stop, maxT = 1e7) {
  const B = SVT.B;
  const S = SVT.state();
  S.labs = { [lab.id]: lab }; S.activeLab = lab.id; S.buy = 1;
  let t = 0;
  const log = [];
  const income = () => SVT.rates(lab).income;
  // Decisions use a soft minimum so ties between the floors and the hubs still show which upgrade helps.
  const soft = () => { const r = SVT.rates(lab); return Math.pow(Math.pow(r.build, -8) + Math.pow(r.freight, -8) + Math.pow(r.commercial, -8), -1 / 8); };
  // Earn until cash reaches `cost`, but never past maxT. Returns false if time ran out first.
  const wait = (cost) => {
    const base = income();
    let dt = (cost - lab.cash) / base, ok = true;
    if (t + dt > maxT) { dt = maxT - t; ok = false; }
    t += dt; lab.cash += base * dt; lab.lifetime += base * dt;
    if (ok) lab.cash = Math.max(lab.cash, cost);
    return ok;
  };
  for (let it = 0; it < 2e6 && t < maxT; it++) {
    if (stop(lab, t)) break;
    // Raise when the next floor is behind a funding wall (or the round's floor is reached and nothing else remains).
    const nf = SVT.nextFloor(lab);
    if (SVT.canRaise && SVT.canRaise(lab) && (!nf || nf.blocked)) {
      const name = SVT.nextRound(lab).name;
      SVT.raise(); log.push([t, name]); continue;
    }
    // New floors come first: players open the next floor as soon as they can pay for it.
    // New floors come first: players save up for the next floor once it is within a couple of minutes of income.
    const base = income(), sbase = soft();
    if (nf && !nf.blocked && nf.cost <= base * SAVE_FOR) {
      if (lab.cash < nf.cost && !wait(nf.cost)) continue;
      lab.cash -= nf.cost; lab.floors.push({ lvl: 1, stock: 0, left: 0 }); continue;
    }
    let best = null, cheapest = null;
    const consider = (cost, gain, act) => {
      if (!(gain > sbase * 1e-9)) { if (!(cheapest && cheapest.cost <= cost)) cheapest = { cost, act, score: 0 }; return; }
      const score = cost / gain + Math.max(0, cost - lab.cash) / Math.max(base, 1e-9);
      if (!best || score < best.score) best = { cost, act, score };
    };
    const tryKind = (kind, n) => {
      const node = SVT.nodeOf(lab, kind, n);
      if (node.lvl >= SVT.maxLevel(lab, kind)) return;
      const q = B.bulk(kind, n, node.lvl, 1, 0, 0, SVT.costScale(lab, kind, n), SVT.maxLevel(lab, kind), SVT.growthOf ? SVT.growthOf(lab, kind) : 0);
      node.lvl++; const g = soft() - sbase; node.lvl--;
      consider(q.cost, g, () => { lab.cash -= q.cost; node.lvl++; });
    };
    lab.floors.forEach((f, i) => tryKind("floor", i + 1));
    tryKind("freight", 0); tryKind("commercial", 0);
    if (nf && !nf.blocked) {
      lab.floors.push({ lvl: 1, stock: 0, left: 0 }); const g = soft() - sbase; lab.floors.pop();
      consider(nf.cost, g, () => { lab.cash -= nf.cost; lab.floors.push({ lvl: 1, stock: 0, left: 0 }); });
    }
    if (!best) best = cheapest;
    if (!best) { wait(lab.cash + base * 60); continue; }
    if (lab.cash < best.cost && !wait(best.cost)) continue;
    best.act();
  }
  return { t, lab, log };
}

const h = (s) => (s / 3600).toFixed(2) + "h";
if (import.meta.url === `file://${process.argv[1]}`) {
  const SVT = loadGame();
  for (const l of SVT.playableLabs()) {
    const r = play(SVT, SVT.newLab(l.id), (lab) => lab.round >= 5);
    console.log(l.name.padEnd(16), "IPO at", h(r.t), " rounds:", r.log.map(([t, n]) => n + "@" + h(t)).join(" "));
  }
}
