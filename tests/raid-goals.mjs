// Prints the Viking Raid price scale per stage: the pacing sim (tests/pace.mjs) plays each stage until every
// shaft, the lift and the warehouse are at max level, and the scale is fitted so that takes the stage's target
// time. Clear time is close to proportional to the scale, so a few rescaling passes converge. Paste the output
// into SCALES in js/raid.js.
import { loadGame, play } from "./pace.mjs";

const SVT = loadGame();
const R = SVT.RAID, scales = [];
const clear = (s) => {
  const lab = SVT.newLab("raid");
  lab.stage = s;
  return play(SVT, lab, (l) => SVT.raidProgress(l).p >= 1, R.time(s) * 20).t;
};
for (let s = 1; s <= R.STAGES; s++) {
  const st = R.stage(s), T = R.time(s), omen = st.diff.scale / (R.SCALES[s - 1] || 1);
  let k = 0.05, t = 0;
  for (let pass = 0; pass < 10; pass++) {
    st.diff.scale = k * omen;
    t = clear(s);
    if (Math.abs(t / T - 1) < 0.03) break;
    k *= T / t;
  }
  scales.push(Number(k.toPrecision(2)));
  console.error("stage", s, st.name, st.floors + " shafts", "shafts Lv " + st.max.floor + " hubs Lv " + st.max.freight, (T / 60).toFixed(1) + " min target", (t / 60).toFixed(1) + " min sim");
}
console.log("    SCALES: [" + scales.join(", ") + "],");
