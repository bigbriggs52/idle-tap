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
    VERSION: "0.11.1",
    // Release time in UTC, set with each release. Shown after the version in the player's local time.
    BUILT: "2026-10-22T04:13Z",
    FLOORS: 30,
    FLOOR_MAX: 800,
    HUB_MAX: 2400,
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

    // Floors that need a funding round before they can be unlocked (prestige walls).
    WALLS: { 6: 0, 11: 1, 19: 2, 26: 3 },
    ROUNDS: [
      { name: "Seed", mult: 2, needFloor: 5 },
      { name: "Series A", mult: 2, needFloor: 10 },
      { name: "Series B", mult: 3, needFloor: 18 },
      { name: "Series C", mult: 3, needFloor: 25 },
      { name: "IPO", mult: 4, needFloor: 30 },
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
    DISCOUNT_SECONDS: 30,
    ABILITIES: {
      floor: [
        { id: "crunch", name: "Crunch Time", kind: "boost" },
        { id: "hackathon", name: "Hackathon", kind: "boost" },
        { id: "budget", name: "Budget Cut", kind: "discount" },
      ],
      freight: [
        { id: "express", name: "Express Lift", kind: "boost" },
        { id: "bulk", name: "Bulk Freight", kind: "boost" },
        { id: "vendor", name: "Vendor Deal", kind: "discount" },
      ],
      commercial: [
        { id: "blitz", name: "Launch Blitz", kind: "boost" },
        { id: "fleet", name: "Fleet Expansion", kind: "boost" },
        { id: "contract", name: "Bulk Contract", kind: "discount" },
      ],
    },
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
  B.levelCost = (kind, n, L) => {
    if (kind === "floor") return B.floorBase(n) * Math.pow(B.FLOOR_GROWTH, L - 1);
    const base = kind === "freight" ? B.freightBase : B.commercialBase;
    return base * Math.pow(B.HUB_GROWTH, L - 1);
  };
  B.growth = (kind) => (kind === "floor" ? B.FLOOR_GROWTH : B.HUB_GROWTH);
  B.maxLevel = (kind) => (kind === "floor" ? B.FLOOR_MAX : B.HUB_MAX);

  // Geometric-series bulk buy. Returns { count, cost } for buying up to `want` levels (Infinity = max affordable).
  B.bulk = (kind, n, L, want, cash, discount) => {
    const r = B.growth(kind);
    const first = B.levelCost(kind, n, L) * (1 - discount);
    const cap = B.maxLevel(kind) - L;
    if (cap <= 0) return { count: 0, cost: 0 };
    let k;
    if (want === Infinity) {
      k = Math.floor(Math.log(1 + (cash * (r - 1)) / first) / Math.log(r));
      k = Math.max(1, Math.min(k, cap));
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

  B.tierOf = (n) => SVT.TIERS.findIndex((t) => n >= t.from && n <= t.to);

  SVT.B = B;
})();
