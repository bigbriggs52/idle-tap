// Balance model. Every tuning number lives here; see the GDD (v0.2) for the reasoning.
window.SVT = window.SVT || {};

(function () {
  const FLOOR_MILESTONES = { 10: 2, 25: 2, 50: 2, 100: 3, 150: 2, 200: 3, 300: 2, 400: 2, 500: 3, 600: 2, 800: 3 };
  const HUB_MILESTONES = { 10: 1.5, 25: 1.5, 50: 2, 100: 2, 150: 1.5, 200: 2, 300: 2, 400: 2, 500: 2, 600: 2, 800: 2 };
  for (let l = 1000; l <= 2400; l += 200) HUB_MILESTONES[l] = 2;

  // Product of every unlock reached: a big milestone where defined, otherwise the small 5-level step.
  function stepMultiplier(milestones, step) {
    const cache = [1];
    return function (L) {
      if (L < 0) return 1;
      for (let l = cache.length; l <= L; l++) {
        cache[l] = cache[l - 1] * (l % 5 === 0 ? (milestones[l] || step) : 1);
      }
      return cache[L];
    };
  }

  const B = {
    VERSION: "0.26.0",
    // Release time in UTC, set with each release. Shown after the version in the player's local time.
    BUILT: "2026-10-23T22:01Z",
    FLOORS: 30,
    // v0.26: lower caps, because the IPO now needs every floor, the lift and the warehouse at max level. Floors stop
    // at their first big milestone (Lv 10). The hubs cap at Lv 400: that is the income every lab ends with, so the
    // deep floors must stay affordable against it (grow <= 0.72), and tests/lab-probe.mjs showed Lv 300 cannot carry
    // floor 30 in the later labs while Lv 600 can never be reached (hub prices outgrow hub capacity).
    FLOOR_MAX: 10,
    HUB_MAX: 400,
    FLOOR_GROWTH: 1.12,
    HUB_GROWTH: 1.14,
    FLOOR_STEP: 1.10, // small unlock every 5 levels on floors
    HUB_STEP: 1.02,   // small unlock every 5 levels on hubs
    FLOOR_MILESTONES,
    HUB_MILESTONES,
    FLOOR_CYCLE: 3, // seconds per build cycle; a tap runs one, a manager keeps them going
    WH_TRIP: 4,     // seconds per warehouse trip: cart to the warehouse and back
    OFFLINE_CAP: 2 * 3600,
    START_CASH: 10,

    floorValue: (n) => 0.5 * Math.pow(6, n - 1),
    unlockCost: (n) => (n === 1 ? 0 : 60 * Math.pow(10, n - 2)),
    floorBase: (n) => (n === 1 ? 4 : 0.12 * B.unlockCost(n)),
    freightBase: 10,
    commercialBase: 12,

    // Floors that need a funding round before they can be unlocked (prestige walls). v0.26: a round every 5 floors.
    WALLS: { 6: 0, 11: 1, 16: 2, 21: 3, 26: 4 },
    // The last round (IPO) also needs every floor, the lift and the warehouse at max level (SVT.canRaise).
    ROUNDS: [
      { name: "Seed", mult: 2, needFloor: 5 },
      { name: "Series A", mult: 2, needFloor: 10 },
      { name: "Series B", mult: 2, needFloor: 15 },
      { name: "Series C", mult: 3, needFloor: 20 },
      { name: "Series D", mult: 3, needFloor: 25 },
      { name: "IPO", mult: 4, needFloor: 30, maxed: true },
    ],

    RANKS: [
      // Rarest first. Every hire rolls independently against these odds.
      { id: "super", name: "Super", odds: 0.005, boost: 10, discount: 0.90, cooldown: 6 * 60, passive: 1.00 },
      { id: "legendary", name: "Legendary", odds: 0.01, boost: 7, discount: 0.80, cooldown: 8 * 60, passive: 0.50 },
      { id: "epic", name: "Epic", odds: 0.03, boost: 5, discount: 0.70, cooldown: 10 * 60, passive: 0.25 },
      { id: "rare", name: "Rare", odds: 0.10, boost: 4, discount: 0.60, cooldown: 12 * 60, passive: 0.10 },
      { id: "uncommon", name: "Uncommon", odds: 0.30, boost: 3, discount: 0.50, cooldown: 14 * 60, passive: 0.05 },
      { id: "common", name: "Common", odds: 0.555, boost: 2, discount: 0.40, cooldown: 15 * 60, passive: 0 },
    ],
    BOOST_SECONDS: 60,
    // Assembly Line Rush (mini game): a 45-second sorting run with 3 lives. The score picks a timed income boost
    // for every lab (not Viking Raid). One run per cooldown; a new boost replaces the old one only if it is bigger.
    RUSH: {
      SECONDS: 45,
      LIVES: 3,
      COOLDOWN: 15 * 60,
      TIERS: [
        { score: 20, mult: 2, minutes: 10 },
        { score: 35, mult: 3, minutes: 15 },
        { score: 50, mult: 4, minutes: 20 },
        { score: 65, mult: 5, minutes: 30 },
      ],
    },
    DISCOUNT_SECONDS: 30,
    // Tech Vault (collectible roll): a new player starts with START_COINS wild coins (good at any open lab), and
    // beating a lab (IPO), first time or replay, pays COIN_PER_BEAT coins stamped with that lab. Coins roll one of
    // the lab's 30 products with a rarity, color, finish, size and mods. More coins in one roll lift the whole odds
    // table: ODDS[stake] lists Common..Mythic shares. PITY counts coins spent since the last Legendary or better:
    // from SOFT each extra coin adds SOFT_STEP to the Legendary share, HARD guarantees it.
    VAULT: {
      START_COINS: 50,
      OPEN_COINS: 50, // wild coins each time a new lab opens on the map
      COIN_PER_BEAT: 10,
      ROUND_COINS: 5, // wild coins every time a lab raises a funding round or its IPO (v0.26)
      RARITIES: [
        { id: "common", name: "Common", mods: 0 },
        { id: "uncommon", name: "Uncommon", mods: 1 },
        { id: "rare", name: "Rare", mods: 1 },
        { id: "epic", name: "Epic", mods: 2 },
        { id: "legendary", name: "Legendary", mods: 3 },
        { id: "mythic", name: "Mythic", mods: 3 },
      ],
      STAKES: [1, 3, 5, 10],
      ODDS: {
        1: [0.50, 0.28, 0.14, 0.06, 0.018, 0.002],
        3: [0.30, 0.32, 0.22, 0.11, 0.042, 0.008],
        5: [0.12, 0.30, 0.30, 0.19, 0.075, 0.015],
        10: [0, 0.15, 0.35, 0.32, 0.15, 0.03],
      },
      PITY: { SOFT: 50, SOFT_STEP: 0.012, HARD: 75 },
      FIRST_ROLL_MIN: 2, // index into RARITIES: the first roll ever is at least Rare
      // Some items boost lab income while Chip wears them. BONUS[rarity index] = { chance the item has one, its
      // multiplier }. Worn bonuses add up (x1.2 and x1.5 make x1.7), capped at MAX_BONUS. Labs only, not Viking Raid.
      BONUS: [{ chance: 0.2, mult: 1.05 }, { chance: 0.35, mult: 1.1 }, { chance: 0.5, mult: 1.15 }, { chance: 0.7, mult: 1.25 }, { chance: 1, mult: 1.35 }, { chance: 1, mult: 1.5 }],
      MAX_BONUS: 3,
    },
    // v0.21: three ability kinds. "speed" runs the node faster (shorter cycles, a quicker lift and cart), "storage"
    // makes every cycle, lift trip and cart load carry more, "discount" cuts upgrade prices. Speed and storage both
    // multiply throughput by the rank's boost; you see the difference in how the lab moves.
    ABILITIES: {
      floor: [
        { id: "crunch", name: "Crunch Time", kind: "speed" },
        { id: "hackathon", name: "Big Batch", kind: "storage" },
        { id: "budget", name: "Budget Cut", kind: "discount" },
      ],
      freight: [
        { id: "express", name: "Express Lift", kind: "speed" },
        { id: "bulk", name: "Bulk Freight", kind: "storage" },
        { id: "vendor", name: "Vendor Deal", kind: "discount" },
      ],
      commercial: [
        { id: "blitz", name: "Launch Blitz", kind: "speed" },
        { id: "fleet", name: "Fleet Expansion", kind: "storage" },
        { id: "contract", name: "Bulk Contract", kind: "discount" },
      ],
    },
    ABILITY_KINDS: { speed: { icon: "⚡", name: "Speed" }, storage: { icon: "📦", name: "Storage" }, discount: { icon: "💸", name: "Price" } },
    ROLE_NAMES: { floor: "Floor Lead", freight: "Logistics Lead", commercial: "Commercial Director" },
  };

  B.floorMult = stepMultiplier(FLOOR_MILESTONES, B.FLOOR_STEP);
  B.hubMult = stepMultiplier(HUB_MILESTONES, B.HUB_STEP);

  B.floorOutput = (n, L) => (L > 0 ? B.floorValue(n) * L * B.floorMult(L) : 0);
  B.freightLoad = (L) => 8 * Math.pow(1.11, L - 1) * B.hubMult(L);
  B.freightSpeed = (L) => 1 + 0.02 * (L - 1);
  // The car stops briefly at each floor and pours money in at the loading speed: a full car fills in liftFillTime.
  B.LIFT_STOP = 0.15;
  B.LIFT_UNLOAD = 1;
  B.liftFillTime = (L) => 1.5 / B.freightSpeed(L);
  B.freightTrip = (L, depth) => (2 * depth) / B.freightSpeed(L) + B.LIFT_STOP * depth + B.liftFillTime(L) + B.LIFT_UNLOAD;
  B.freightCap = (L, depth) => B.freightLoad(L) / B.freightTrip(L, depth);
  B.commercialCap = (L) => 2 * Math.pow(1.11, L - 1) * B.hubMult(L);

  // Cost of one level from L to L+1.
  B.levelCost = (kind, n, L, growth) => {
    if (kind === "floor") return B.floorBase(n) * Math.pow(growth || B.FLOOR_GROWTH, L - 1);
    const base = kind === "freight" ? B.freightBase : B.commercialBase;
    return base * Math.pow(growth || B.HUB_GROWTH, L - 1);
  };
  B.growth = (kind) => (kind === "floor" ? B.FLOOR_GROWTH : B.HUB_GROWTH);
  B.maxLevel = (kind) => (kind === "floor" ? B.FLOOR_MAX : B.HUB_MAX);

  // Geometric-series bulk buy. Returns { count, cost } for buying up to `want` levels. Infinity = the most levels the
  // cash affords, rounded down so the new level is a multiple of 50 (Lv 56 with cash for 140 goes to 100); when no
  // multiple of 50 is affordable (or the cap gets in the way) it buys everything affordable.
  B.ROUND_TO = 50;
  B.bulk = (kind, n, L, want, cash, discount, scale, max, growth) => {
    const r = growth || B.growth(kind);
    const first = B.levelCost(kind, n, L, growth) * (1 - discount) * (scale || 1);
    const cap = (max || B.maxLevel(kind)) - L;
    if (cap <= 0) return { count: 0, cost: 0 };
    let k;
    if (want === Infinity) {
      k = Math.floor(Math.log(1 + (cash * (r - 1)) / first) / Math.log(r));
      k = Math.max(1, Math.min(k, cap));
      const round = k - ((L + k) % B.ROUND_TO);
      if (round >= 1 && k < cap) k = round;
    } else {
      k = Math.min(want, cap);
    }
    const cost = (first * (Math.pow(r, k) - 1)) / (r - 1);
    return { count: k, cost };
  };

  // Manager hire cost: H0 x 2.5^k, k = managers of that role hired since the last funding round.
  B.hireCost = (role, k) => {
    const h0 = role === "floor" ? 40 : role === "freight" ? 200 : 250;
    return h0 * Math.pow(2.5, k);
  };
  B.SELL_REFUND = 0.5;

  // Per-lab price scaling (see SVT.costScale). v0.26: every lab's floor prices grow at most 7.2x per floor (grow 0.72)
  // so floor 30 stays affordable with the hubs capped at Lv 400; the labs differ by scale, fitted with
  // tests/lab-goals.mjs to about 2.2h, 2.9h, 4.3h, 7.6h, 13h to IPO for labs 1-5, then 14h rising 6% per lab to
  // about 57h for lab 30.
  B.LAB_DIFF = {
    garage: { scale: 0.024, grow: 0.55 },
    arcade: { scale: 0.099, grow: 0.72 },
    library: { scale: 0.34, grow: 0.72 },
    maker: { scale: 0.99, grow: 0.72 },
    studio: { scale: 2, grow: 0.72 },
  };
  // Labs 6-30: scale from tests/lab-goals.mjs (about 6% more time per lab), grow 0.72 everywhere.
  const SCALE_6_30 = [2.2, 2.4, 2.6, 2.7, 2.9, 3.1, 3.3, 3.5, 3.7, 4, 4.2, 4.5, 4.8, 5.1, 5.4, 5.8, 6.1, 6.5, 6.9, 7.3, 7.8, 8.2, 8.7, 9.3, 9.8];
  SVT.LABS.slice(5).forEach((l, i) => { B.LAB_DIFF[l.id] = { scale: SCALE_6_30[i], grow: 0.72 }; });

  B.tierOf = (n) => SVT.TIERS.findIndex((t) => n >= t.from && n <= t.to);

  SVT.B = B;
})();
