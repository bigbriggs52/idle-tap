// Viking Raid: a separate island of 50 generated mines. Same shafts, lift and warehouse, no manager abilities,
// no funding rounds. Each stage is built from its number (same stage, same mine) and is cleared by earning its gold goal.
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
    // Target clear time for an efficient player: 3 minutes for stage 1, rising to 12 hours for stage 50.
    time: (s) => 180 * Math.pow(240, (s - 1) / 49),
    BASE: { scale: 0.05, grow: 0.6 },
    // Gold goal per stage, from tests/raid-goals.mjs (the pacing sim run to each stage's target time).
    GOALS: [3.9e2, 4.6e2, 7.9e2, 1.3e3, 2.0e3, 2.6e3, 5.4e3, 6.5e3, 1.6e4, 1.8e4, 8.5e4, 2.4e5, 8.7e5, 3.3e6, 4.6e6, 2.3e7, 2.0e8, 2.8e8, 1.2e9, 4.7e9, 3.2e12, 9.5e10, 4.0e15, 6.6e13, 1.8e17, 2.6e16, 3.9e15, 6.1e17, 6.0e17, 2.4e18, 8.1e18, 1.4e22, 9.6e21, 1.6e21, 9.6e23, 7.5e21, 3.7e22, 8.0e22, 4.6e23, 2.6e24, 3.9e26, 5.8e23, 6.8e24, 1.8e26, 6.5e25, 8.8e28, 1.3e27, 1.7e28, 1.9e28, 7.8e29],
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
    r(); r(); // the first two draws are spare; the goals below were tuned with the omens that follow
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
      floors: Math.min(30, 5 + Math.round(((s - 1) * 25) / 49)),
      goal: R.GOALS[s - 1] || Infinity,
      time: R.time(s),
      mult: { floor: mult("floor"), freight: mult("freight"), commercial: mult("commercial") },
      diff: { scale: R.BASE.scale * mult("cost"), grow: R.BASE.grow },
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
