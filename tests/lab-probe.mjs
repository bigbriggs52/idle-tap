// Time to IPO for one lab (default garage) with the current balance, and when each round lands.
// FLOOR_MAX / HUB_MAX / SCALE env vars override the balance for experiments.
import { loadGame, play } from "./pace.mjs";
const SVT = loadGame(), B = SVT.B;
if (process.env.FLOOR_MAX) B.FLOOR_MAX = +process.env.FLOOR_MAX;
if (process.env.HUB_MAX) B.HUB_MAX = +process.env.HUB_MAX;
if (process.env.FLOOR_GROWTH) B.FLOOR_GROWTH = +process.env.FLOOR_GROWTH;
if (process.env.GROW) for (const id in B.LAB_DIFF) B.LAB_DIFF[id].grow = +process.env.GROW;
const h = (s) => (s / 3600).toFixed(2) + "h";
for (const id of (process.argv[2] || "garage").split(",")) {
  if (process.env.SCALE) B.LAB_DIFF[id].scale = +process.env.SCALE;
  const r = play(SVT, SVT.newLab(id), (lab) => lab.round >= B.ROUNDS.length, +(process.env.MAXH || 100) * 3600);
  const L = r.lab, pr = SVT.labProgress(L);
  console.log(id.padEnd(10), "IPO at", h(r.t), r.log.map(([t, n]) => n + "@" + h(t)).join(" "),
    "| maxed", Math.round(pr.p * 100) + "%", "floors", L.floors.length, "lift", L.freight.lvl, "wh", L.commercial.lvl, "floor lvls", L.floors.map((f) => f.lvl).join(","));
}
