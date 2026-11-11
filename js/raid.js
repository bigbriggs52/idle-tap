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
  // Omens: each stage from 3 on gets one, from 20 on two, plus one bad omen per batch after the first (v0.42). They
  // tilt the mine; the goal is tuned with them included.
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

  const OMEN_STATS = 4; // floor, freight, commercial, cost
  const badOmen = (o) => (o.stat === "cost" ? o.mult > 1 : o.mult < 1);
  const OMEN_WHAT = { floor: "Shafts dig", freight: "Lift carries", commercial: "Warehouse ships", cost: "Prices" };
  function harsher(o, batch) {
    if (batch <= 1) return o;
    const mult = Math.pow(o.mult, 1 + 0.25 * (batch - 1)), pct = Math.round((mult - 1) * 100);
    return Object.assign({}, o, { mult, text: OMEN_WHAT[o.stat] + " " + (pct > 0 ? "+" : "−") + Math.abs(pct) + "%" });
  }

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
    // Max levels. v0.33 to v0.41 raised them per batch (shafts 25 to 100, hubs 100 to 400). v0.42 (user: "Viking
    // mine should be mines to 100 and then lift and warehouse to 500"): every stage is shafts Lv 100, lift and
    // warehouse Lv 500. The batches differ by prices, omens and target time instead.
    CAPS: [
      { floor: 100, freight: 500, commercial: 500 },
      { floor: 100, freight: 500, commercial: 500 },
      { floor: 100, freight: 500, commercial: 500 },
      { floor: 100, freight: 500, commercial: 500 },
      { floor: 100, freight: 500, commercial: 500 },
    ],
    // v0.46 (user: "Viking mine needs to have lift and warehouse levels better associated with each level in the
    // mine"): the lift and warehouse go to 100 on a one-shaft stage, rising evenly to 500 on a 50-shaft stage (in
    // steps of 10), and while you play they can only go as far as the shafts have got (see SVT.hubGate).
    hubMax: (s) => 10 * Math.round((100 + (400 * (R.shafts(s) - 1)) / 49) / 10),
    max: (s) => { const c = R.CAPS[R.batchOf(s) - 1], h = R.hubMax(s); return { floor: c.floor, freight: Math.min(c.freight, h), commercial: Math.min(c.commercial, h) }; },
    // Shaft price growth per level: the same as the labs (v0.33, "similar numbers to the main levels"). Hub growth is
    // set per stage by hubPrices (stage.growth).
    GROWTH: { floor: SVT.B.FLOOR_GROWTH },
    // Target clear time for an efficient player. v0.33 (user's pacing): batch 1 ran from 5 minutes (stage 1) to
    // 20 minutes (stage 50), every batch starting where the one before ended and climbing 4x again.
    // v0.41 (user, 2026-11-05: "Viking mine is too easy", the third time): every target is tripled. The pacing sim
    // plays with no abilities, Rush, Bug Hunt, relics or items, and since v0.39 managers fire every 1 to 5 minutes,
    // so a real player clears a mine far faster than the sim. Batch 1 now runs 15 minutes to 1 hour, batch 2 1 to 4
    // hours, batch 3 4 to 16 hours, batch 4 16 to 64 hours, batch 5 64 to 256 hours.
    // v0.45 (user, 2026-11-11: "Viking mine also is too easy still", the fourth time): 3 -> 10. Batch 1 is now 50 min
    // to 3.3 h, batch 2 3.3 to 13 h, batch 3 13 to 53 h, batch 4 53 to 213 h, batch 5 213 to 853 h.
    HARDER: 10,
    // v0.46 (user, 2026-11-11, after v0.45: "still giving Viking mine issues"; their screenshot had 5x the cash a stage-1
    // clear costs): the pacing sim used to play with no boosts, but Rush x5, Bug Hunt x3, Chip's items (up to x5.5+) and
    // relics all count in the raid and stack (x82.5 in the screenshot). The sim now assumes a steady x40 cash boost, so
    // the target times hold for a player who keeps boosts running; with none, a stage takes about 40x longer.
    SIM_BOOST: 40,
    time: (s) => R.HARDER * 300 * Math.pow(4, R.batchOf(s) - 1) * Math.pow(4, (R.levelOf(s) - 1) / 49),
    // Each deeper shaft costs 1.3x the one above (grow 0.13 x the 10x price step). Income is capped by the lift and
    // warehouse, so the step has to stay small or the deep shafts can never be paid for.
    BASE: { grow: 0.13, step: 1.3 },
    // Shaft n's first-level price before the stage scale (v0.33.3): shaft 1's lab price, then a step per shaft. Before,
    // shaft 2 was 4x cheaper than shaft 1 because the labs price floor 1 as a special case.
    // v0.42 (user: "mineshaft costs differ based on the level of the mine and how far down the map"): the step grows
    // from 1.3x per shaft on stage 1 to 1.5x on stage 250, so deep shafts on far stages cost much more.
    shaftStep: (s) => 1.3 + 0.2 * ((s || 1) - 1) / 249,
    shaftBase: (n, s) => SVT.B.floorBase(1) * Math.pow(R.shaftStep(s), n - 1),
    // Viking tokens: a first clear pays the batch number (1 to 5), a replay pays 1. Boat k unlocks at BOAT_COST(k).
    TOKENS: { replay: 1, total: 750 },
    BOATS: 50,
    boatCost: (k) => (k <= 1 ? 0 : Math.round(750 * Math.pow((k - 1) / 49, 1.6))),
    // Price scale per stage, from tests/raid-goals.mjs (the pacing sim fitted to each stage's target time).
    SCALES: [
      1200, 890, 570, 270, 220, 150, 130, 88, 100, 66, 66, 62, 100, 79, 54, 67, 73, 51, 46, 36, 53, 32, 71, 44, 82, 46, 31, 53, 48, 43, 41, 88, 57, 50, 100, 52, 52, 53, 56, 64, 110, 44, 52, 62, 55, 130, 65, 82, 74, 120,
      5300, 2400, 920, 470, 810, 270, 370, 190, 300, 320, 230, 230, 220, 280, 260, 190, 270, 170, 280, 250, 200, 180, 120, 180, 170, 160, 140, 100, 230, 350, 170, 270, 110, 280, 190, 360, 250, 190, 120, 400, 210, 120, 330, 130, 220, 230, 140, 130, 140, 170,
      7200, 5600, 2800, 3900, 2800, 820, 710, 1500, 570, 480, 480, 470, 460, 420, 370, 370, 930, 910, 930, 400, 850, 860, 350, 410, 720, 380, 810, 830, 350, 350, 710, 340, 350, 880, 370, 450, 370, 940, 840, 970, 1000, 990, 420, 430, 440, 450, 460, 440, 450, 470,
      78000, 22000, 11000, 5400, 4200, 2800, 2400, 2100, 1900, 1600, 1600, 1600, 4200, 1400, 3400, 1400, 3400, 3400, 3400, 1200, 1300, 1300, 1200, 1200, 1100, 1100, 1100, 1100, 1100, 1200, 1100, 3000, 1400, 3200, 1200, 1200, 1200, 1500, 1300, 1600, 1300, 3600, 1700, 3800, 1400, 4000, 1500, 1400, 4000, 4100,
      71000, 59000, 100000, 19000, 30000, 9400, 8100, 7000, 19000, 5300, 5200, 5200, 4900, 14000, 13000, 4200, 4200, 4600, 4200, 4000, 11000, 4400, 3900, 3900, 3600, 4200, 3600, 3700, 3800, 3800, 11000, 3700, 3800, 4600, 4700, 12000, 4000, 5000, 5100, 11000, 5300, 4400, 13000, 14000, 12000, 15000, 6100, 14000, 4900, 15000,
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
    const end = R.shaftBase(F, s) * Math.pow(R.GROWTH.floor, M.floor - 2);
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
    const count = s < 3 ? 0 : R.levelOf(s) < 20 && s < 20 ? 1 : 2;
    while (omens.length < count) {
      const o = OMENS[Math.floor(r() * OMENS.length)];
      if (!omens.some((x) => x.stat === o.stat)) omens.push(o);
    }
    // v0.42 (user: "more disadvantages the farther down you go"): every batch after the first adds a bad omen (up to
    // one per stat), and bad omens bite harder deeper: their effect is raised to the power 1 + 0.25 per batch, so
    // Thin veins is −30% in batch 1 and −51% in batch 5.
    for (const o of OMENS.filter(badOmen)) {
      if (omens.length >= Math.min(OMEN_STATS, count + R.batchOf(s) - 1)) break;
      if (r() < 0.5 && !omens.some((x) => x.stat === o.stat)) omens.push(o);
    }
    for (const o of OMENS.filter(badOmen)) {
      if (omens.length >= Math.min(OMEN_STATS, count + R.batchOf(s) - 1)) break;
      if (!omens.some((x) => x.stat === o.stat)) omens.push(o);
    }
    for (let i = 0; i < omens.length; i++) if (badOmen(omens[i])) omens[i] = harsher(omens[i], R.batchOf(s));
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
