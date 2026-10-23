// Viking Raid: a separate island of 50 generated mines. Same shafts, lift and warehouse, no manager abilities,
// no funding rounds. Each stage is built from its number (same stage, same mine) and is cleared by opening every
// shaft and taking every shaft, the lift and the warehouse to the stage's max level.
window.SVT = window.SVT || {};

(function () {
  const PRE = ["Raven", "Frost", "Wolf", "Storm", "Iron", "Bone", "Ember", "Mist", "Thunder", "Serpent", "Bear", "Ash", "Rune", "Skull", "Gold", "Troll", "Elk", "Hammer", "Night", "Dragon"];
  const SUF = ["fjord", "hold", "barrow", "crag", "delve", "gard", "heim", "vik", "mire", "peak", "deep", "haven", "fell", "maw"];
  const LOOT = ["Copper coins", "Amber beads", "Iron nails", "Antler combs", "Wool cloaks",
    "Silver arm rings", "Bronze brooches", "Mead barrels", "Walrus ivory", "Seax knives",
    "Round shields", "Bearded axes", "Iron helmets", "Chainmail", "Longbows", "Ash spears", "Rune stones", "Silver hoards",
    "Gold torcs", "Jeweled sword hilts", "Ulfberht swords", "Drinking horns", "Gilded saddles", "Carved prows", "Longships",
    "Jarl's crowns", "Thor's hammers", "Valkyrie wings", "Dragon eggs", "Odin's ravens"];
  const TEAMS = ["Thralls", "Karls", "Shieldmaidens", "Berserkers", "Jarls"];
  const TIERS = ["Shallow Mines", "Deep Barrows", "Dwarf Halls", "Giant Caves", "Dragon Hoard"];
  // Omens: each stage from 3 on gets one, from 20 on two. They tilt the mine; the goal is tuned with them included.
  const OMENS = [
    { id: "rich", name: "Rich veins", text: "Shafts dig +50%", stat: "floor", mult: 1.5 },
    { id: "thin", name: "Thin veins", text: "Shafts dig −30%", stat: "floor", mult: 0.7 },
    { id: "ropes", name: "Frozen ropes", text: "Lift carries −25%", stat: "freight", mult: 0.75 },
    { id: "thralls", name: "Strong thralls", text: "Lift carries +40%", stat: "freight", mult: 1.4 },
    { id: "storm", name: "Stormy seas", text: "Warehouse ships −25%", stat: "commercial", mult: 0.75 },
    { id: "winds", name: "Fair winds", text: "Warehouse ships +40%", stat: "commercial", mult: 1.4 },
    { id: "jarl", name: "Greedy jarl", text: "Prices +50%", stat: "cost", mult: 1.5 },
    { id: "trade", name: "Trader's luck", text: "Prices −25%", stat: "cost", mult: 0.75 },
  ];

  // Small seeded random (mulberry32) so a stage is always the same mine.
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const R = {
    STAGES: 50,
    // Stage 1 has 5 shafts, each stage one more, up to 30.
    shafts: (s) => Math.min(30, 4 + s),
    // Max level for every shaft, the lift and the warehouse on that stage (v0.22: 15 on stage 1, up to 60).
    max: (s) => 15 + 5 * Math.floor((s - 1) / 5),
    // Target clear time for an efficient player (v0.22, the first pace of 1.5 to 30 minutes was far too easy):
    // 3 minutes for stage 1, rising to 3 hours for stage 50.
    time: (s) => 180 * Math.pow(60, (s - 1) / 49),
    // Every shaft costs about the same (grow cancels the 10x price step per shaft), so deep stages stay quick.
    BASE: { grow: 0.1 },
    // Price scale per stage, from tests/raid-goals.mjs (the pacing sim fitted to each stage's target time).
SCALES: [0.48, 0.43, 0.42, 0.39, 0.38, 0.3, 0.3, 0.23, 0.29, 0.22, 0.27, 0.28, 0.38, 0.4, 0.29, 0.28, 0.39, 0.22, 0.2, 0.2, 0.4, 0.16, 0.44, 0.22, 0.46, 0.3, 0.18, 0.39, 0.32, 0.31, 0.31, 0.71, 0.74, 0.45, 1.2, 0.55, 0.6, 0.65, 0.85, 1, 1.5, 0.75, 0.83, 1.2, 0.98, 2.8, 1.3, 1.8, 1.9, 2.9],
  };

  // 50 different mine names, drawn once in a fixed order.
  const NAMES = [];
  for (let r = rng(2024); NAMES.length < R.STAGES;) {
    const nm = PRE[Math.floor(r() * PRE.length)] + SUF[Math.floor(r() * SUF.length)];
    if (!NAMES.includes(nm)) NAMES.push(nm);
  }

  const cache = {};
  R.stage = (s) => {
    if (cache[s]) return cache[s];
    const r = rng(s * 7919 + 13);
    r(); r(); // the first two draws are spare; the price scales were tuned with the omens that follow
    const name = NAMES[s - 1];
    const omens = [];
    const count = s < 3 ? 0 : s < 20 ? 1 : 2;
    while (omens.length < count) {
      const o = OMENS[Math.floor(r() * OMENS.length)];
      if (!omens.some((x) => x.stat === o.stat)) omens.push(o);
    }
    const mult = (stat) => omens.reduce((m, o) => (o.stat === stat ? m * o.mult : m), 1);
    const st = {
      n: s, name, omens,
      floors: R.shafts(s),
      max: R.max(s),
      time: R.time(s),
      mult: { floor: mult("floor"), freight: mult("freight"), commercial: mult("commercial") },
      diff: { scale: (R.SCALES[s - 1] || 1) * mult("cost"), grow: R.BASE.grow },
    };
    return (cache[s] = st);
  };
  // What the UI shows for the raid lab, shaped like an entry in SVT.LABS.
  R.def = (s) => {
    const st = R.stage(s);
    return { id: "raid", name: st.name, stageName: "Stage " + s + ": " + st.name, theme: "Viking Raid", icon: "⚔️", teams: TEAMS, tiers: TIERS, products: LOOT };
  };

  SVT.RAID = R;
})();
