// Prints the Viking Raid gold goals: the pacing sim (tests/pace.mjs) plays each stage to its target time
// and the gold earned by then becomes the goal. Paste the output into GOALS in js/raid.js.
import { loadGame, play } from "./pace.mjs";

const SVT = loadGame();
const R = SVT.RAID, goals = [];
for (let s = 1; s <= R.STAGES; s++) {
  const lab = SVT.newLab("raid");
  lab.stage = s;
  const T = R.time(s);
  const r = play(SVT, lab, (l, t) => t >= T, T);
  // Two significant figures keep the goals readable.
  const g = r.lab.lifetime, p = Math.pow(10, Math.floor(Math.log10(g)) - 1);
  goals.push(Math.round(g / p) * p);
  console.error("stage", s, R.stage(s).name, (T / 3600).toFixed(2) + "h", "floors", r.lab.floors.length + "/" + R.stage(s).floors, SVT.fmt(goals[s - 1]));
}
console.log("    GOALS: [" + goals.map((g) => Number(g.toPrecision(2)).toExponential(1).replace("e+", "e")).join(", ") + "],");
