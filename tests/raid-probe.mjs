// Prints, for a few raid stages, when the lift, the warehouse and the deepest shaft reach max in the pacing sim.
import { loadGame, play } from "./pace.mjs";
const SVT = loadGame(), R = SVT.RAID;
for (const s of (process.argv[2] || "1,10,25,40,50").split(",").map(Number)) {
  const lab = SVT.newLab("raid"); lab.stage = s;
  const st = R.stage(s), at = {};
  const r = play(SVT, lab, (l, t) => {
    const m = st.max;
    if (!at.lift && l.freight.lvl >= m.freight) at.lift = t;
    if (!at.wh && l.commercial.lvl >= m.commercial) at.wh = t;
    if (!at.open && l.floors.length >= st.floors) at.open = t;
    if (!at.last && l.floors.length >= st.floors && l.floors[st.floors - 1].lvl >= m.floor) at.last = t;
    if (!at.first && l.floors[0].lvl >= m.floor) at.first = t;
    return SVT.raidProgress(l).p >= 1;
  }, R.time(s) * 20);
  const pct = (x) => (x ? Math.round(100 * x / r.t) + "%" : "-");
  console.log("stage", s, (r.t / 60).toFixed(1) + " min", "lift", pct(at.lift), "warehouse", pct(at.wh), "shaft1", pct(at.first), "allOpen", pct(at.open), "lastShaft", pct(at.last));
}
