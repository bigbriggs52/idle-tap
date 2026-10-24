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
    VERSION: "0.31.2",
    // Release time in UTC, set with each release. Shown after the version in the player's local time.
    BUILT: "2026-10-24T18:55Z",
    FLOORS: 30,
    // v0.26: lower caps, because the IPO needs every floor, the lift and the warehouse at max level. The hubs cap at
    // Lv 400: that is the income every lab ends with, so the deep floors must stay affordable against it, and
    // tests/lab-probe.mjs showed Lv 300 cannot carry floor 30 in the later labs while Lv 600 can never be reached (hub
    // prices outgrow hub capacity). v0.28: floors cap at Lv 100 (was 10); to keep 100 levels of 30 floors payable
    // against Lv 400 hubs, a floor level costs 5% more than the last (was 12%) and each deeper floor 6x the one above.
    FLOOR_MAX: 100,
    HUB_MAX: 400,
    FLOOR_GROWTH: 1.05,
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

    // v0.30: five tiers. Common, Uncommon and Rare managers run one of three regular abilities (speed, storage,
    // price) whose strength, active time and cooldown come from the tier (ABILITY_STATS). Epic and Legendary
    // managers are super managers: each role has one named Epic and one named Legendary (the "special" entries in
    // ABILITIES) with a game-changing active and a permanent passive. The old Super rank folded into Legendary.
    RANKS: [
      // Rarest first. Every hire rolls independently against these odds.
      { id: "legendary", name: "Legendary", odds: 0.015, super: true },
      { id: "epic", name: "Epic", odds: 0.03, super: true },
      { id: "rare", name: "Rare", odds: 0.10 },
      { id: "uncommon", name: "Uncommon", odds: 0.30 },
      { id: "common", name: "Common", odds: 0.555 },
    ],
    // Regular abilities by tier: mult (speed or load), off (price cut), active seconds, cooldown seconds after the run.
    ABILITY_STATS: {
      common: { speed: { mult: 2.5, active: 60, cooldown: 300 }, storage: { mult: 2, active: 60, cooldown: 300 }, discount: { off: 0.30, active: 15, cooldown: 180 } },
      uncommon: { speed: { mult: 4, active: 120, cooldown: 600 }, storage: { mult: 3.5, active: 120, cooldown: 600 }, discount: { off: 0.50, active: 20, cooldown: 300 } },
      rare: { speed: { mult: 6, active: 180, cooldown: 900 }, storage: { mult: 5, active: 180, cooldown: 900 }, discount: { off: 0.70, active: 30, cooldown: 480 } },
    },
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
    // Regular abilities (Common to Rare): "speed" runs the node faster (shorter cycles, a quicker lift and cart),
    // "storage" makes every cycle, lift trip and cart load carry more, "discount" cuts that node's upgrade prices.
    // Super managers (Epic, Legendary) each have one named special with its own active and a passive that is always
    // on while they are assigned. Timers are absolute times in the save, so they survive a reload.
    ABILITIES: {
      floor: [
        { id: "crunch", name: "Crunch Time", kind: "speed" },
        { id: "hackathon", name: "Big Batch", kind: "storage" },
        { id: "budget", name: "Budget Cut", kind: "discount" },
        { id: "siphon", name: "The Dropshipper", kind: "special", rank: "epic", icon: "📦", active: 45, cooldown: 15 * 60, direct: 5,
          passive: { speed: 0.15 }, text: "Products skip the lift and the warehouse and sell straight from the floor at 5× value.", passiveText: "+15% build speed on its floor, always" },
        { id: "midas", name: "The Unicorn", kind: "special", rank: "legendary", icon: "🦄", active: 30, cooldown: 30 * 60, direct: 15,
          passive: { revenue: 0.25 }, text: "Every build cycle sells straight from the floor at 15× value.", passiveText: "+25% to everything this lab earns while assigned anywhere" },
      ],
      freight: [
        { id: "express", name: "Express Lift", kind: "speed" },
        { id: "bulk", name: "Bulk Freight", kind: "storage" },
        { id: "vendor", name: "Vendor Deal", kind: "discount" },
        { id: "turbine", name: "The Hyperloop", kind: "special", rank: "epic", icon: "🌀", active: 45, cooldown: 15 * 60, speed: 8, vacuum: true,
          passive: { discount: 0.10 }, text: "Lift at 8× speed, and it empties every crate it stops at in one go.", passiveText: "−10% on lift upgrades, always" },
        { id: "wormhole", name: "The Quantum Courier", kind: "special", rank: "legendary", icon: "🕳️", active: 30, cooldown: 30 * 60, warp: 5,
          passive: { discount: 0.25, load: 0.20 }, text: "Every 5 s, everything on every floor jumps to the top of the shaft.", passiveText: "−25% on lift upgrades and +20% lift capacity, always" },
      ],
      commercial: [
        { id: "blitz", name: "Launch Blitz", kind: "speed" },
        { id: "fleet", name: "Fleet Expansion", kind: "storage" },
        { id: "contract", name: "Bulk Contract", kind: "discount" },
        { id: "overclock", name: "The Overclocker", kind: "special", rank: "epic", icon: "🔥", active: 45, cooldown: 15 * 60, speed: 8, cash: 3,
          passive: { speed: 0.10 }, text: "Carts at 8× speed and 3× cash on every delivery.", passiveText: "+10% cart speed, always" },
        { id: "baron", name: "The Venture Capitalist", kind: "special", rank: "legendary", icon: "💼", active: 20, cooldown: 20 * 60, allDiscount: 0.90,
          passive: { cooldowns: 0.15 }, text: "−90% on every upgrade in the lab: floors, lift and warehouse.", passiveText: "Every manager's cooldown in this lab is 15% shorter, always" },
      ],
    },
    ABILITY_KINDS: { special: { icon: "🌟", name: "Super" }, speed: { icon: "⚡", name: "Speed" }, storage: { icon: "📦", name: "Storage" }, discount: { icon: "💸", name: "Price" } },
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

  // Per-lab price scaling (see SVT.costScale). v0.28: every lab's floor prices grow 6x per floor (grow 0.6, was 0.72)
  // so 100 levels of floor 30 stay affordable with the hubs capped at Lv 400; the labs differ by scale, fitted with
  // tests/lab-goals.mjs to about 2.2h, 2.9h, 4.3h, 7.6h, 13h to IPO for labs 1-5, then 14h rising 6% per lab to
  // about 57h for lab 30.
  B.LAB_DIFF = {
    garage: { scale: 0.014, grow: 0.55 },
    arcade: { scale: 0.099, grow: 0.6 },
    library: { scale: 0.46, grow: 0.6 },
    maker: { scale: 1.4, grow: 0.6 },
    studio: { scale: 2.8, grow: 0.6 },
  };
  // Labs 6-30: scale from tests/lab-goals.mjs (about 6% more time per lab), grow 0.6 everywhere.
  const SCALE_6_30 = [3.1, 3.4, 3.5, 3.8, 4.1, 4.3, 4.6, 4.9, 5.2, 5.6, 5.9, 6.3, 6.7, 7.2, 7.6, 8.1, 8.6, 9.1, 9.7, 10, 11, 12, 12, 13, 14];
  SVT.LABS.slice(5).forEach((l, i) => { B.LAB_DIFF[l.id] = { scale: SCALE_6_30[i], grow: 0.6 }; });

  B.tierOf = (n) => SVT.TIERS.findIndex((t) => n >= t.from && n <= t.to);

  SVT.B = B;
})();
