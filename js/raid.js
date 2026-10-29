// Viking Raid (v0.33 reset): a separate island of 250 generated Viking mines in 5 batches of 50. Same shafts, lift,
// warehouse, managers and abilities as the labs, and every multiplier (Rush, Chip's items, omens) counts. No funding
// rounds. Stage l of a batch has l shafts (one more every stage); each batch raises the max levels and the prices, so
// its first stage is a bit harder than the last stage of the batch before. A stage is cleared by opening every shaft
// and taking every shaft, the lift and the warehouse to the batch's max level. Clears pay Viking tokens, which unlock
// the 50 boats Chip sails on the home screen (js/boats.js).
window.SVT = window.SVT || {};

(function () {
  const PRE = ["Raven", "Frost", "Wolf", "Storm", "Iron", "Bone", "Ember", "Mist", "Thunder", "Serpent", "Bear", "Ash", "Rune", "Skull", "Gold", "Troll", "Elk", "Hammer", "Night", "Dragon", "Salt", "Oak", "Whale", "Flint", "Ice"];
  const SUF = ["fjord", "hold", "barrow", "crag", "delve", "gard", "heim", "vik", "mire", "peak", "deep", "haven", "fell", "maw", "ness", "stad"];
  const LOOT = ["Copper coins", "Amber beads", "Iron nails", "Antler combs", "Wool cloaks",
    "Silver arm rings", "Bronze brooches", "Mead barrels", "Walrus ivory", "Seax knives",
    "Round shields", "Bearded axes", "Iron helmets", "Chainmail", "Longbows", "Ash spears", "Rune stones", "Silver hoards",
    "Gold torcs", "Jeweled sword hilts", "Ulfberht swords", "Drinking horns", "Gilded saddles", "Carved prows", "Longships",
    "Jarl's crowns", "Thor's hammers", "Valkyrie wings", "Dragon eggs", "Odin's ravens",
    "Glass beads", "Whetstones", "Soapstone pots", "Tar barrels", "Sealskin boots", "Bone dice", "Silk from Miklagard", "Frankish wine",
    "Silver dirhams", "Bear pelts", "Gyrfalcons", "Narwhal tusks", "Gold-wire tapestries", "Rune-carved oars", "Dwarf-forged rings",
    "Frost giant teeth", "Fenrir's chains", "Mjölnir shards", "Yggdrasil leaves", "Valhalla keys"];
  const TEAMS = ["Thralls", "Karls", "Shieldmaidens", "Berserkers", "Jarls"];
  const TIERS = ["Topsoil", "Bedrock", "Old Tunnels", "Dwarf Halls", "Dragon Deep"];
  const BATCHES = ["Coastal Raids", "Fjord Campaign", "Deep Barrows", "Giant Caves", "Dragon Hoard"];
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
    PER: 50, // stages per batch
    BATCHES: 5,
    STAGES: 250,
    BATCH_NAMES: BATCHES,
    batchOf: (s) => Math.floor((s - 1) / 50) + 1,
    levelOf: (s) => ((s - 1) % 50) + 1,
    // Stage l of a batch has l shafts: one more every stage (user's rule, v0.33).
    shafts: (s) => R.levelOf(s),
    // Max levels per batch. The last batch matches the labs (floors Lv 100, hubs Lv 400); earlier batches stop lower
    // so their stages stay short.
    CAPS: [
      { floor: 25, freight: 100, commercial: 100 },
      { floor: 40, freight: 160, commercial: 160 },
      { floor: 55, freight: 220, commercial: 220 },
      { floor: 75, freight: 300, commercial: 300 },
      { floor: 100, freight: 400, commercial: 400 },
    ],
    max: (s) => R.CAPS[R.batchOf(s) - 1],
    // Shaft price growth per level: the same as the labs (v0.33, "similar numbers to the main levels"). Hub growth is
    // set per stage by hubPrices (stage.growth).
    GROWTH: { floor: SVT.B.FLOOR_GROWTH },
    // Target clear time for an efficient player (v0.33, user's pacing): batch 1 runs from 5 minutes (stage 1) to
    // 20 minutes (stage 50); every batch starts where the one before ended and climbs 4x again, so batch 2 runs
    // 20 to 80 minutes, batch 3 80 minutes to 5.3 hours, batch 4 5.3 to 21 hours, batch 5 21 to 85 hours.
    time: (s) => 300 * Math.pow(4, R.batchOf(s) - 1) * Math.pow(4, (R.levelOf(s) - 1) / 49),
    // Each deeper shaft costs 1.3x the one above (grow 0.13 x the 10x price step). Income is capped by the lift and
    // warehouse, so the step has to stay small or the deep shafts can never be paid for.
    BASE: { grow: 0.13, step: 1.3 },
    // Shaft n's first-level price before the stage scale (v0.33.3): shaft 1's lab price, 1.3x per shaft. Before, shaft 2
    // was 4x cheaper than shaft 1 because the labs price floor 1 as a special case.
    shaftBase: (n) => SVT.B.floorBase(1) * Math.pow(1.3, n - 1),
    // Viking tokens: a first clear pays the batch number (1 to 5), a replay pays 1. Boat k unlocks at BOAT_COST(k).
    TOKENS: { replay: 1, total: 750 },
    BOATS: 50,
    boatCost: (k) => (k <= 1 ? 0 : Math.round(750 * Math.pow((k - 1) / 49, 1.6))),
    // Price scale per stage, from tests/raid-goals.mjs (the pacing sim fitted to each stage's target time).
    SCALES: [
      3.7, 3.8, 3.6, 2.8, 3.4, 2.8, 3.9, 3.4, 3.2, 3.5, 2.7, 2.9, 5.4, 4.1, 3.5, 3.7, 4.4, 3.9, 3, 2.7, 4.4, 2.7, 4.3, 3.2, 5.3, 3.4, 2.7, 3.5, 2.9, 2.8, 2.3, 4.5, 3.5, 2.4, 3.9, 1.7, 1.7, 1.4, 1.1, 1.1, 1.4, 0.5, 0.45, 0.48, 0.28, 0.63, 0.23, 0.24, 0.17, 0.2,
      18, 13, 15, 8.6, 17, 12, 12, 11, 21, 20, 13, 22, 23, 22, 20, 21, 23, 15, 30, 33, 27, 20, 17, 19, 19, 17, 23, 21, 31, 31, 32, 40, 15, 31, 23, 41, 33, 24, 28, 36, 29, 24, 44, 18, 29, 22, 28, 17, 16, 22,
      37, 67, 48, 99, 91, 55, 40, 83, 53, 43, 44, 99, 54, 63, 49, 64, 120, 94, 140, 79, 100, 150, 54, 99, 120, 140, 120, 160, 88, 100, 140, 150, 96, 180, 110, 120, 120, 210, 170, 200, 220, 230, 120, 120, 150, 90, 130, 170, 100, 170,
      320, 300, 240, 270, 220, 220, 190, 190, 210, 220, 220, 290, 440, 350, 520, 440, 420, 490, 440, 230, 490, 510, 430, 220, 360, 460, 270, 480, 400, 510, 380, 780, 660, 570, 320, 700, 440, 410, 490, 590, 480, 900, 460, 800, 590, 760, 570, 560, 890, 1100,
      700, 890, 1300, 1300, 1100, 860, 1000, 660, 1200, 850, 700, 830, 850, 1300, 1800, 1300, 1100, 1800, 1100, 780, 2400, 2000, 2100, 990, 1300, 1200, 1300, 2000, 2000, 2500, 3100, 1400, 2000, 1800, 1800, 3100, 1900, 3000, 2300, 2800, 1800, 2100, 3700, 3300, 3200, 3000, 3800, 4200, 2100, 3700,
    ],
  };

  // 250 different mine names, drawn once in a fixed order.
  const NAMES = [];
  for (let r = rng(2024); NAMES.length < R.STAGES;) {
    const nm = PRE[Math.floor(r() * PRE.length)] + SUF[Math.floor(r() * SUF.length)];
    if (!NAMES.includes(nm)) NAMES.push(nm);
  }

  // Hub prices (v0.33.2): the lift's and the warehouse's first level cost the same as shaft 1's first level, and their
  // last level costs the same as the deepest shaft's last level; the growth per level in between follows from that
  // (about 1.01 on a one-shaft stage, about 1.15 on a 50-shaft one). Before, a fixed 1.14 growth was anchored on the
  // last level only, which made the first lift level cost a fraction of a cent (the user's bug report).
  function hubPrices(s) {
    const B = SVT.B, M = R.max(s), F = R.shafts(s);
    const start = B.floorBase(1);
    const end = R.shaftBase(F) * Math.pow(R.GROWTH.floor, M.floor - 2);
    return {
      hub: { freight: start / B.freightBase, commercial: start / B.commercialBase },
      growth: { floor: R.GROWTH.floor, freight: Math.pow(end / start, 1 / (M.freight - 2)), commercial: Math.pow(end / start, 1 / (M.commercial - 2)) },
    };
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
    const hp = hubPrices(s);
    const st = {
      n: s, name, omens, growth: hp.growth,
      batch: R.batchOf(s), level: R.levelOf(s), batchName: BATCHES[R.batchOf(s) - 1],
      floors: R.shafts(s),
      max: R.max(s),
      time: R.time(s),
      tokens: R.batchOf(s),
      mult: { floor: mult("floor"), freight: mult("freight"), commercial: mult("commercial") },
      diff: { scale: (R.SCALES[s - 1] || 1) * mult("cost"), grow: R.BASE.grow, hub: hp.hub },
    };
    return (cache[s] = st);
  };
  // What the UI shows for the raid lab, shaped like an entry in SVT.LABS. Shaft tiers run 10 shafts each.
  R.def = (s) => {
    const st = R.stage(s);
    return { id: "raid", name: st.name, stageName: "Stage " + s + ": " + st.name, theme: "Viking Raid", icon: "⚔️", crew: ["Digger", "Lift Thrall", "Trader"], teams: TEAMS, tiers: TIERS, products: LOOT, tierOf: (n) => Math.min(TIERS.length - 1, Math.floor((n - 1) / 10)) };
  };

  SVT.RAID = R;
})();
