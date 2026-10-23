// Fits each lab's price scale (B.LAB_DIFF[id].scale) so an efficient player IPOs in the target time: about 2.2h,
// 2.9h, 4.3h, 7.6h, 13h for labs 1-5, then 14h rising 6% per lab to about 57h for lab 30. Prints a LAB_DIFF
// block to paste into js/balance.js. Usage: node tests/lab-goals.mjs [garage,arcade,...]
import { loadGame, play } from "./pace.mjs";
const SVT = loadGame(), B = SVT.B;
const TARGETS = [2.2, 2.9, 4.3, 7.6, 13];
const target = (i) => (i < 5 ? TARGETS[i] : 14 * Math.pow(1.06, i - 5)) * 3600;
const labs = SVT.playableLabs();
const ids = process.argv[2] ? process.argv[2].split(",") : labs.map((l) => l.id);
const out = {};
for (const id of ids) {
  const i = labs.findIndex((l) => l.id === id), T = target(i), d = B.LAB_DIFF[id];
  let k = d.scale, t = 0;
  for (let pass = 0; pass < 7; pass++) {
    d.scale = k;
    t = play(SVT, SVT.newLab(id), (lab) => lab.round >= B.ROUNDS.length, T * 12).t;
    if (Math.abs(t / T - 1) < 0.03) break;
    k *= Math.pow(T / t, 0.8); // time grows a bit faster than linearly in the scale
  }
  out[id] = { scale: Number(k.toPrecision(2)), grow: d.grow };
  console.error(id.padEnd(10), (T / 3600).toFixed(1) + "h target", (t / 3600).toFixed(2) + "h sim", "scale", out[id].scale);
}
console.log(JSON.stringify(out));
