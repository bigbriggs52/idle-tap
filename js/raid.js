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
    // Price growth per level: the same as the labs (v0.33, "similar numbers to the main levels").
    GROWTH: { floor: SVT.B.FLOOR_GROWTH, freight: SVT.B.HUB_GROWTH, commercial: SVT.B.HUB_GROWTH },
    // Target clear time for an efficient player (v0.33, user's pacing): batch 1 runs from 5 minutes (stage 1) to
    // 20 minutes (stage 50); every batch starts where the one before ended and climbs 4x again, so batch 2 runs
    // 20 to 80 minutes, batch 3 80 minutes to 5.3 hours, batch 4 5.3 to 21 hours, batch 5 21 to 85 hours.
    time: (s) => 300 * Math.pow(4, R.batchOf(s) - 1) * Math.pow(4, (R.levelOf(s) - 1) / 49),
    // Each deeper shaft costs 1.3x the one above (grow 0.13 x the 10x price step). Income is capped by the lift and
    // warehouse, so the step has to stay small or the deep shafts can never be paid for.
    BASE: { grow: 0.13 },
    // Viking tokens: a first clear pays the batch number (1 to 5), a replay pays 1. Boat k unlocks at BOAT_COST(k).
    TOKENS: { replay: 1, total: 750 },
    BOATS: 50,
    boatCost: (k) => (k <= 1 ? 0 : Math.round(750 * Math.pow((k - 1) / 49, 1.6))),
    // Price scale per stage, from tests/raid-goals.mjs (the pacing sim fitted to each stage's target time).
    SCALES: [
      9.4, 19, 17, 8.2, 6.2, 4.3, 2.6, 1.4, 1.2, 0.61, 0.57, 0.41, 0.39, 0.29, 0.15, 0.11, 0.11, 0.048, 0.031, 0.024, 0.038, 0.011, 0.021, 0.0078, 0.012, 0.0064, 0.0029, 0.0043, 0.0026, 0.0018, 0.0014, 0.0021, 0.0017, 0.00086, 0.0015, 0.00058, 0.00045, 0.00035, 0.00032, 0.00029, 0.00031, 0.00013, 0.00011, 0.00012, 7.8e-05, 0.00016, 7e-05, 7.6e-05, 6.5e-05, 7e-05,
      43, 71, 72, 48, 96, 69, 44, 40, 85, 71, 26, 46, 35, 21, 15, 8.9, 8.3, 4.1, 6.5, 3.9, 3.1, 2, 1.5, 1, 0.9, 0.84, 0.77, 0.57, 0.56, 0.67, 0.44, 0.53, 0.28, 0.42, 0.26, 0.34, 0.31, 0.2, 0.2, 0.26, 0.22, 0.17, 0.24, 0.12, 0.2, 0.18, 0.16, 0.15, 0.12, 0.19,
      83, 420, 210, 620, 420, 320, 220, 440, 230, 220, 220, 510, 220, 340, 230, 250, 480, 340, 740, 260, 360, 790, 190, 400, 420, 640, 410, 590, 320, 330, 470, 730, 500, 690, 360, 370, 380, 1100, 590, 800, 1200, 1200, 650, 470, 690, 340, 730, 1100, 530, 810,
      910, 1700, 1200, 1800, 880, 1300, 890, 920, 990, 1000, 1000, 1500, 2100, 2400, 3200, 2500, 2200, 2300, 2400, 1200, 2800, 2900, 2900, 950, 1500, 3200, 1500, 3400, 1600, 3600, 2500, 5100, 3900, 2500, 1800, 4200, 2900, 2000, 3100, 3200, 3300, 4500, 2300, 4700, 2600, 3500, 3900, 2800, 5500, 5600,
      1700, 4500, 6300, 7400, 5000, 3600, 5300, 3700, 5300, 4000, 4000, 4100, 4200, 6000, 8800, 6800, 4800, 11000, 5200, 3600, 16000, 12000, 12000, 5700, 6100, 6000, 6500, 14000, 15000, 15000, 20000, 7100, 11000, 7900, 8100, 16000, 12000, 19000, 13000, 13000, 9100, 9800, 19000, 20000, 15000, 15000, 24000, 22000, 11000, 23000,
    ],
  };

  // 250 different mine names, drawn once in a fixed order.
  const NAMES = [];
  for (let r = rng(2024); NAMES.length < R.STAGES;) {
    const nm = PRE[Math.floor(r() * PRE.length)] + SUF[Math.floor(r() * SUF.length)];
    if (!NAMES.includes(nm)) NAMES.push(nm);
  }

  // Hub price multipliers so that the lift's and the warehouse's last level and the deepest shaft's last level cost
  // the same: a player who upgrades evenly finishes all three around the same time.
  function hubScale(s) {
    const B = SVT.B, G = R.GROWTH, M = R.max(s), F = R.shafts(s);
    const last = B.floorBase(F) * Math.pow(R.BASE.grow, F - 1) * Math.pow(G.floor, M.floor - 2);
    return {
      freight: last / (B.freightBase * Math.pow(G.freight, M.freight - 2)),
      commercial: last / (B.commercialBase * Math.pow(G.commercial, M.commercial - 2)),
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
    const st = {
      n: s, name, omens,
      batch: R.batchOf(s), level: R.levelOf(s), batchName: BATCHES[R.batchOf(s) - 1],
      floors: R.shafts(s),
      max: R.max(s),
      time: R.time(s),
      tokens: R.batchOf(s),
      mult: { floor: mult("floor"), freight: mult("freight"), commercial: mult("commercial") },
      diff: { scale: (R.SCALES[s - 1] || 1) * mult("cost"), grow: R.BASE.grow, hub: hubScale(s) },
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
