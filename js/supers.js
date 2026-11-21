// Super managers and Headhunter Slots (v0.53, user's design). A spin of a six-reel slot machine hires one super manager:
// AREA (floor, lift, warehouse or wild) x RARITY x POWER (a superhero-style cheat for 30 s to 3 min, set by the area)
// x PERK (always on while seated) x STARS (1-5, a quality roll inside the rarity) x FACE. Spins cost Hero coins; a
// pricier spin has better rarity odds. Super managers are kept for good (across funding rounds and labs), sit in a
// seat in place of a normal manager, and three of one rarity merge into one random super manager of the next rarity,
// up to Ascended. Settings has the "money" cheat code (+5,000 Hero coins, no limit).
window.SVT = window.SVT || {};

(function () {
  // User (2026-11-20): nothing above Ascended ("too many"), so super managers stop at Ascended (index 10).
  const B = SVT.B, RAR = B.VAULT.RARITIES.slice(0, 11), ROLLED = 6;
  const SUPER = {
    START_COINS: 500, ROUND_COINS: 25, IPO_COINS: 100, RAID_COINS: 10, CHEAT: "money", CHEAT_COINS: 5000,
    // Spins: cost and rarity odds Common..Mythic. User: "500 coins a spin or more for higher rarity".
    SPINS: [
      { id: "basic", name: "Basic", cost: 500, odds: [0.40, 0.30, 0.18, 0.09, 0.027, 0.003] },
      { id: "pro", name: "Pro", cost: 1500, odds: [0.15, 0.30, 0.30, 0.17, 0.07, 0.01] },
      { id: "elite", name: "Elite", cost: 5000, odds: [0, 0.10, 0.35, 0.35, 0.16, 0.04] },
    ],
    PITY: 40, // Legendary or better guaranteed within 40 spins
    HOLD: 0.5, // holding reels costs +50% of the spin
    AREAS: [
      { id: "floor", icon: "🏭", name: "Floor", odds: 0.48 },
      { id: "freight", icon: "🛗", name: "Lift", odds: 0.24 },
      { id: "commercial", icon: "🚚", name: "Warehouse", odds: 0.24 },
      { id: "wild", icon: "🃏", name: "Wild", odds: 0.04 },
    ],
    STARS: [{ odds: 0.35, f: 0.8 }, { odds: 0.30, f: 0.9 }, { odds: 0.20, f: 1 }, { odds: 0.10, f: 1.15 }, { odds: 0.05, f: 1.3 }],
    // Power strength and length by rarity. User: "almost like cheating for 30 seconds or 3 minutes". Merge-only
    // rarities past Mythic keep the 3 minutes and keep getting stronger.
    RARF: [1, 1.3, 1.7, 2.2, 2.8, 3.5, 4.2, 4.9, 5.6, 6.3, 7],
    SECONDS: [30, 45, 60, 90, 120, 180, 180, 180, 180, 180, 180],
    COOLDOWN: 15 * 60,
  };
  // Powers: what happens while it runs. f = rarity x stars strength (Common 1-star 0.8, Mythic 5-star 4.55).
  // Effects use the game's existing hooks: speed, load, direct (sell from the floor at x value), cash (x on deliveries),
  // vacuum (the lift swallows each floor's crate in one go) and warp (every few seconds every floor jumps to the top).
  const x1 = (v) => Math.round(v * 10) / 10;
  const POWERS = {
    floor: [
      { id: "timewarp", icon: "⏩", name: "Time Warp", fx: (f) => ({ speed: x1(1 + 4 * f) }), text: (e) => "engineers build ×" + e.speed + " faster" },
      { id: "clones", icon: "👥", name: "Clone Army", fx: (f) => ({ load: x1(1 + 4 * f) }), text: (e) => "×" + e.load + " products every cycle" },
      { id: "midas", icon: "👑", name: "Midas Touch", fx: (f) => ({ direct: x1(1 + 2 * f) }), text: (e) => "products turn straight into cash at ×" + e.direct + " value, no lift needed" },
      { id: "overdrive", icon: "🚀", name: "Overdrive", fx: (f) => ({ speed: x1(1 + 2 * f), load: x1(1 + 2 * f) }), text: (e) => "×" + e.speed + " speed and ×" + e.load + " products" },
    ],
    freight: [
      { id: "lightning", icon: "⚡", name: "Lightning Lift", fx: (f) => ({ speed: x1(1 + 4 * f) }), text: (e) => "the lift moves ×" + e.speed + " faster" },
      { id: "titan", icon: "💪", name: "Super Strength", fx: (f) => ({ load: x1(1 + 4 * f) }), text: (e) => "the lift carries ×" + e.load + " more" },
      { id: "blackhole", icon: "🕳️", name: "Black Hole", fx: (f) => ({ vacuum: true, speed: x1(1 + 2 * f) }), text: (e) => "swallows each floor's whole pile in one gulp, ×" + e.speed + " speed" },
      { id: "teleport", icon: "🌀", name: "Teleporter", fx: (f) => ({ warp: Math.max(1, x1(8 / f)) }), text: (e) => "every " + e.warp + " s, everything on every floor beams to the top" },
    ],
    commercial: [
      { id: "flash", icon: "🏃", name: "Flash", fx: (f) => ({ speed: x1(1 + 4 * f) }), text: (e) => "carts race ×" + e.speed + " faster" },
      { id: "bottomless", icon: "🎒", name: "Bottomless Cart", fx: (f) => ({ load: x1(1 + 4 * f) }), text: (e) => "carts carry ×" + e.load + " more" },
      { id: "goldrush", icon: "💰", name: "Gold Rush", fx: (f) => ({ cash: x1(1 + 2 * f) }), text: (e) => "every delivery pays ×" + e.cash },
      { id: "magnet", icon: "🧲", name: "Money Magnet", fx: (f) => ({ speed: x1(1 + 2 * f), cash: x1(1 + f) }), text: (e) => "×" + e.speed + " speed and deliveries pay ×" + e.cash },
    ],
    wild: [
      { id: "hyper", icon: "🌪️", name: "Hyper Mode", fx: (f) => ({ speed: x1(1 + 3 * f) }), text: (e) => "whatever seat it sits in runs ×" + e.speed + " faster" },
      { id: "giant", icon: "🦖", name: "Giant Mode", fx: (f) => ({ load: x1(1 + 3 * f) }), text: (e) => "whatever seat it sits in moves ×" + e.load + " more" },
    ],
  };
  // Perks: always on while seated. g = rarity x stars strength. "Best one counts" for the lab-wide ones.
  const pctT = (v) => Math.round(v * 100) + "%";
  const PERKS = [
    { id: "caffeinated", icon: "☕", name: "Caffeinated", p: (g) => ({ speed: 0.1 * g }), text: (p) => "its seat always runs +" + pctT(p.speed) + " faster" },
    { id: "strongman", icon: "🏋️", name: "Strongman", p: (g) => ({ load: 0.1 * g }), text: (p) => "its seat always moves +" + pctT(p.load) + " more" },
    { id: "rainmaker", icon: "🌧️", name: "Rainmaker", p: (g) => ({ revenue: 0.05 * g }), text: (p) => "the whole lab earns +" + pctT(p.revenue) },
    { id: "workaholic", icon: "💼", name: "Workaholic", p: (g) => ({ cooldowns: Math.min(0.5, 0.06 * g) }), text: (p) => "every manager in the lab rests " + pctT(p.cooldowns) + " less" },
    { id: "earlybird", icon: "⏰", name: "Early Bird", p: () => ({ auto: 1 }), text: () => "uses its power by itself the moment it's ready" },
    { id: "chain", icon: "⛓️", name: "Chain Reaction", p: () => ({ chain: 1 }), text: () => "its power also fires every ready manager in the lab" },
    { id: "coffee", icon: "🫖", name: "Coffee Addict", p: (g) => ({ longer: 0.15 * g }), text: (p) => "its power lasts +" + pctT(p.longer) + " longer" },
    { id: "lucky", icon: "🍀", name: "Lucky Break", p: (g) => ({ lucky: Math.min(0.5, 0.06 * g) }), text: (p) => pctT(p.lucky) + " chance of no rest after its power" },
    { id: "viking", icon: "🪓", name: "Viking Blood", p: () => ({ viking: 1 }), text: () => "power twice as strong in Viking Raid" },
    { id: "headhunter", icon: "🕵️", name: "Headhunter", p: (g) => ({ coins: Math.round(5 * g) }), text: (p) => "+" + p.coins + " Hero coins every funding round of its lab" },
    { id: "gamer", icon: "🎮", name: "Gamer", p: (g) => ({ gamer: 0.1 * g }), text: (p) => "Rush and Bug Hunt boosts +" + pctT(p.gamer) + " in its lab" },
    { id: "nightowl", icon: "🌙", name: "Night Owl", p: (g) => ({ offline: 0.1 * g }), text: (p) => "+" + pctT(p.offline) + " offline earnings in its lab" },
  ];
  const FACES = ["🦸", "🦹", "🧙", "🥷", "🤖", "👽", "🧛", "🧜", "🧞", "🦊", "🐯", "🦁", "🐼", "🦉", "🐲", "👑", "😎", "🤠", "🧑‍🚀", "🧑‍🔬"];
  const TITLES = ["Captain", "Doctor", "Mega", "Ultra", "Agent", "Major", "Professor", "Lady", "Sir", "Hyper", "Turbo", "Iron", "Neon", "Shadow", "Cosmic", "Atomic", "Mighty", "Silent", "Golden", "Quantum"];
  const NOUNS = ["Kernel", "Byte", "Volt", "Pixel", "Router", "Cache", "Debug", "Laser", "Circuit", "Firewall", "Overclock", "Silicon", "Nano", "Cyber", "Dynamo", "Photon", "Glitch", "Codex", "Turing", "Bolt"];
  SVT.SUPER = SUPER;
  SVT.SUPER_DATA = { POWERS, PERKS, FACES };

  // ---------- state ----------
  const st = () => {
    const s = SVT.state();
    if (!s.supers) s.supers = { coins: SUPER.START_COINS, list: {}, next: 1, pity: 0, spins: 0, seats: {}, last: null, hold: {} };
    const z = s.supers;
    if (!z.seats) z.seats = {};
    if (!z.hold) z.hold = {};
    return z;
  };
  const pick = (arr, odds) => { let r = Math.random(); for (let i = 0; i < arr.length; i++) { if (r < odds[i]) return i; r -= odds[i]; } return arr.length - 1; };
  const rint = (n) => Math.floor(Math.random() * n);
  SVT.superCoins = () => st().coins;
  SVT.superCoinsAdd = (n) => { st().coins += n; SVT.save(); };
  SVT.superList = () => Object.values(st().list);
  SVT.superCount = () => SVT.superList().length;
  const areaOf = (m) => SUPER.AREAS.find((a) => a.id === m.area);
  const powerOf = (m) => POWERS[m.area].find((p) => p.id === m.power) || POWERS[m.area][0];
  const perkOf = (m) => PERKS.find((p) => p.id === m.perk) || PERKS[0];
  const strength = (m) => SUPER.RARF[m.rar] * SUPER.STARS[m.stars - 1].f;

  // The ability-like description the game's manager code reads (kind "special", see SVT.activeAbility). Cached.
  const cache = new Map();
  SVT.superDef = (m) => {
    const raid = !!(m.at && m.at.lab === "raid");
    const key = m.id + "|" + m.rar + "|" + m.stars + "|" + m.power + "|" + m.perk + "|" + m.area + "|" + raid;
    const hit = cache.get(m.id);
    if (hit && hit.key === key) return hit.def;
    const pw = powerOf(m), pk = perkOf(m), g = strength(m);
    const pas = pk.p(g), f = g * (pas.viking && raid ? 2 : 1);
    const e = pw.fx(f);
    const def = Object.assign({ kind: "special", id: pw.id, icon: pw.icon, name: pw.name, text: pw.text(e), perkIcon: pk.icon, perkName: pk.name, passiveText: pk.text(pas),
      active: Math.round(SUPER.SECONDS[m.rar] * (1 + (pas.longer || 0))), cooldown: SUPER.COOLDOWN, passive: pas }, e);
    cache.set(m.id, { key, def });
    return def;
  };

  // ---------- seats ----------
  // seats[labId][slotKey] = super id; each super also keeps m.at = { lab, key }.
  SVT.superAt = (lab, key) => {
    const z = SVT.state().supers;
    if (!z || !z.seats[lab.id]) return null;
    const id = z.seats[lab.id][key];
    if (!id) return null;
    // v0.53.4: a seat on a floor that isn't open (any more) holds no one, so nothing can reappear there later.
    if (key.startsWith("floor:") && +key.slice(6) > lab.floors.length) return null;
    return z.list[id] || null;
  };
  SVT.supersIn = (lab) => {
    const z = SVT.state().supers, seats = z && z.seats[lab.id];
    return seats ? Object.keys(seats).map((k) => SVT.superAt(lab, k)).filter(Boolean) : [];
  };
  const kindOfKey = (key) => (key.startsWith("floor:") ? ["floor", +key.slice(6)] : [key, 0]);
  SVT.superFits = (m, kind) => m.area === "wild" || m.area === kind;
  SVT.superSeat = (id, kind, n) => {
    const z = st(), m = z.list[id], lab = SVT.lab();
    if (!m || !SVT.superFits(m, kind)) return false;
    SVT.superUnseat(id, true);
    const key = SVT.slotKey(kind, n);
    const old = SVT.superAt(lab, key);
    if (old) SVT.superUnseat(old.id, true);
    // The normal manager there goes back to the bench (its timers stay on it).
    if (lab.assign[key]) delete lab.assign[key];
    (z.seats[lab.id] = z.seats[lab.id] || {})[key] = id;
    m.at = { lab: lab.id, key };
    SVT.save();
    if (SVT.render) SVT.render();
    return true;
  };
  SVT.superUnseat = (id, quiet) => {
    const z = st(), m = z.list[id];
    if (!m || !m.at) return false;
    const seats = z.seats[m.at.lab];
    if (seats && seats[m.at.key] === id) delete seats[m.at.key];
    m.at = null;
    if (!quiet) { SVT.save(); if (SVT.render) SVT.render(); }
    return true;
  };
  SVT.superUnseatLab = (lab) => {
    const z = st(), seats = z.seats[lab.id] || {};
    Object.keys(seats).forEach((k) => { const m = z.list[seats[k]]; if (m) m.at = null; });
    z.seats[lab.id] = {};
  };
  // v0.53.4: clean up old saves: drop seats on floors that are not open, so they can't pop back up.
  SVT.superTidy = () => {
    const z = st();
    for (const id in z.seats) {
      const lab = SVT.state().labs[id], seats = z.seats[id];
      for (const k in seats) {
        const m = z.list[seats[k]], gone = !lab || (k.startsWith("floor:") && +k.slice(6) > lab.floors.length) || !m || !m.at || m.at.lab !== id || m.at.key !== k;
        if (gone) { if (m && m.at && m.at.lab === id && m.at.key === k) m.at = null; delete seats[k]; }
      }
    }
    SVT.superList().forEach((m) => { if (m.at && (!z.seats[m.at.lab] || z.seats[m.at.lab][m.at.key] !== m.id)) m.at = null; });
  };
  SVT.superWhere = (m) => {
    if (!m.at) return null;
    const d = m.at.lab === "raid" ? { name: "Viking Raid" } : SVT.labDef(m.at.lab);
    return (d ? d.name : m.at.lab) + " · " + SVT.slotName(m.at.key);
  };
  // Coins every funding round (and the IPO), plus Headhunter perks seated in that lab.
  SVT.superPay = (lab, round) => {
    let n = SUPER.ROUND_COINS + (round && round.name === "IPO" ? SUPER.IPO_COINS : 0);
    SVT.supersIn(lab).forEach((m) => { n += SVT.superDef(m).passive.coins || 0; });
    st().coins += n;
    return n;
  };
  // Early Bird: fire the power the moment it is ready.
  SVT.superAuto = (lab) => {
    const t = SVT.now();
    SVT.supersIn(lab).forEach((m) => {
      if (!SVT.superDef(m).passive.auto || m.activeUntil > t || m.cdUntil > t) return;
      const [kind, n] = kindOfKey(m.at.key);
      SVT.activate(kind, n, lab);
    });
  };

  // ---------- spins ----------
  const makeName = () => TITLES[rint(TITLES.length)] + " " + NOUNS[rint(NOUNS.length)];
  function newSuper(rar, held) {
    const z = st();
    held = held || {};
    const area = held.area || SUPER.AREAS[pick(SUPER.AREAS, SUPER.AREAS.map((a) => a.odds))].id;
    const pool = POWERS[area];
    const power = held.power && pool.some((p) => p.id === held.power) ? held.power : pool[rint(pool.length)].id;
    const perk = held.perk || PERKS[rint(PERKS.length)].id;
    const stars = 1 + pick(SUPER.STARS, SUPER.STARS.map((s) => s.odds));
    const face = held.face !== undefined ? held.face : rint(FACES.length);
    const id = "s" + z.next++;
    const m = { id, sup: true, rar, rank: RAR[rar].id, area, role: area, power, ability: power, perk, stars, face, name: makeName(), at: null, activeUntil: 0, cdUntil: 0, born: Date.now() };
    z.list[id] = m;
    return m;
  }
  SVT.superSpinCost = (tier) => {
    const z = st(), held = Object.keys(z.hold).filter((k) => z.hold[k] !== undefined && z.hold[k] !== null).length;
    return Math.round(SUPER.SPINS[tier].cost * (held ? 1 + SUPER.HOLD : 1));
  };
  SVT.superCanSpin = () => st().coins >= SUPER.SPINS[0].cost;
  SVT.superPityLeft = () => Math.max(1, SUPER.PITY - st().pity);
  // One spin: returns { m, jackpot, cost } or null.
  SVT.superSpin = (tier) => {
    const z = st(), sp = SUPER.SPINS[tier], cost = SVT.superSpinCost(tier);
    if (!sp || z.coins < cost) return null;
    z.coins -= cost;
    let rar = pick(sp.odds, sp.odds);
    z.pity++;
    if (z.pity >= SUPER.PITY && rar < 4) rar = 4;
    if (rar >= 4) z.pity = 0;
    const m = newSuper(rar, z.hold);
    z.spins++;
    // Jackpot: a 5-star Rare or better refunds the spin.
    const jackpot = m.stars === 5 && rar >= 2;
    if (jackpot) z.coins += cost;
    z.last = m.id;
    SVT.save();
    return { m, jackpot, cost };
  };
  // Hold: keep the last spin's area (with its power), perk or face for the next spin, at +50% a spin.
  SVT.superHold = (what, on) => {
    const z = st(), last = z.list[z.last];
    if (!on || !last) { delete z.hold[what]; if (what === "area") delete z.hold.power; }
    else if (what === "power") { z.hold.area = last.area; z.hold.power = last.power; }
    else z.hold[what] = last[what];
    SVT.save();
  };

  // ---------- merge ----------
  // Three unseated super managers of one rarity become one random super manager of the next rarity.
  SVT.superMergeable = () => {
    const out = [];
    for (let r = 0; r < RAR.length - 1; r++) { const ids = SVT.superList().filter((m) => m.rar === r && !m.at).sort((a, b) => a.stars - b.stars).map((m) => m.id); if (ids.length >= 3) out.push({ rar: r, ids }); }
    return out;
  };
  SVT.superMerge = (rar) => {
    const z = st(), g = SVT.superMergeable().find((x) => x.rar === rar);
    if (!g) return null;
    g.ids.slice(0, 3).forEach((id) => { delete z.list[id]; cache.delete(id); });
    const m = newSuper(rar + 1);
    m.merged = true;
    SVT.save();
    return m;
  };
  SVT.superMergeAll = () => {
    const out = [];
    for (let guard = 0; guard < 500; guard++) { const g = SVT.superMergeable()[0]; if (!g) break; out.push(SVT.superMerge(g.rar)); }
    return out.filter(Boolean);
  };

  // ---------- cheat ----------
  SVT.superCheat = (code) => {
    if (String(code || "").trim().toLowerCase() !== SUPER.CHEAT) return false;
    st().coins += SUPER.CHEAT_COINS;
    SVT.save();
    return true;
  };

  // ---------- UI ----------
  const pct = (x) => (x > 0 && x < 0.01 ? (x * 100).toFixed(1) : Math.round(x * 100)) + "%";
  const starsText = (n) => "★".repeat(n) + "☆".repeat(5 - n);
  SVT.superAvatar = (m) => {
    const { h } = SVT.ui;
    return h("span", { class: "av suph r-" + m.rank, "aria-hidden": "true" }, h("span", { class: "sh-cape" }), h("span", { class: "sh-face", text: FACES[m.face] || "🦸" }));
  };
  const secs = (x) => (x >= 60 && x % 60 === 0 ? x / 60 + " min" : x >= 60 ? Math.floor(x / 60) + " min " + (x % 60) + " s" : x + " s");
  function heroCard(m, buttons) {
    const { h } = SVT.ui, d = SVT.superDef(m), a = areaOf(m);
    return h("div", { class: "sh-card r-" + m.rank },
      h("div", { class: "sh-port" }, SVT.superAvatar(m), h("span", { class: "sh-stars", text: starsText(m.stars) })),
      h("div", { class: "sh-info" },
        h("b", { text: m.name }),
        h("span", { class: "sh-rar", text: RAR[m.rar].name + " · " + a.icon + " " + a.name + (m.merged ? " · merged" : "") }),
        h("span", { class: "sh-power", text: d.icon + " " + d.name + ": " + d.text + " for " + secs(d.active) + " (15 min rest)" }),
        h("span", { class: "sh-perk", text: d.perkIcon + " " + d.perkName + ": " + d.passiveText }),
        m.at ? h("span", { class: "sh-where", text: "🪑 " + SVT.superWhere(m) }) : null,
        buttons && buttons.length ? h("div", { class: "sh-btns" }, buttons) : null));
  }
  SVT.superCard = heroCard;

  let box = null, busy = false, tab = "spin", tier = 0;
  function close() { if (box) box.remove(); box = null; busy = false; document.removeEventListener("keydown", onKey); }
  function onKey(e) { if (e.key === "Escape") close(); }
  function shell(...kids) {
    const { h } = SVT.ui, was = box;
    if (box) box.remove();
    box = h("div", { class: "vault heroes" + (was ? " still" : ""), id: "heroes", role: "dialog", "aria-label": "Headhunter Slots" },
      h("div", { class: "vault-head" },
        h("span", { class: "vault-logo", "aria-hidden": "true", text: "🦸" }),
        h("h2", { text: "Headhunter Slots" }),
        h("span", { class: "vault-coins sh-coins", text: "💠 " + SVT.fmt(st().coins) }),
        h("button", { class: "x-btn", "aria-label": "Close", onclick: close, text: "✕" })),
      h("div", { class: "vault-tabs" },
        h("button", { class: "vault-tab" + (tab === "spin" ? " on" : ""), onclick: () => { tab = "spin"; open(); }, text: "🎰 Spin" }),
        h("button", { class: "vault-tab" + (tab === "team" ? " on" : ""), onclick: () => { tab = "team"; open(); }, text: "🦸 Team (" + SVT.superCount() + ")" })),
      ...kids);
    document.body.append(box);
    document.addEventListener("keydown", onKey);
  }
  const REELS = [
    { key: "area", label: "Area", hold: "area" },
    { key: "rar", label: "Rarity" },
    { key: "power", label: "Power", hold: "power" },
    { key: "perk", label: "Perk", hold: "perk" },
    { key: "stars", label: "Stars" },
    { key: "face", label: "Face", hold: "face" },
  ];
  function reelText(key, m) {
    if (key === "area") { const a = areaOf(m); return a.icon + " " + a.name; }
    if (key === "rar") return RAR[m.rar].name;
    if (key === "power") { const p = powerOf(m); return p.icon + " " + p.name; }
    if (key === "perk") { const p = perkOf(m); return p.icon + " " + p.name; }
    if (key === "stars") return starsText(m.stars);
    return FACES[m.face];
  }
  function randomText(key) {
    if (key === "area") { const a = SUPER.AREAS[rint(4)]; return a.icon + " " + a.name; }
    if (key === "rar") return RAR[rint(ROLLED)].name;
    if (key === "power") { const all = [].concat(...Object.values(POWERS)); const p = all[rint(all.length)]; return p.icon + " " + p.name; }
    if (key === "perk") { const p = PERKS[rint(PERKS.length)]; return p.icon + " " + p.name; }
    if (key === "stars") return starsText(1 + rint(5));
    return FACES[rint(FACES.length)];
  }
  function machine(m, cls) {
    const { h } = SVT.ui, z = st();
    return h("div", { class: "hh-machine" + (cls ? " " + cls : "") },
      h("div", { class: "hh-lights", "aria-hidden": "true" }, Array.from({ length: 9 }, (_, i) => h("i", { style: "--i:" + i }))),
      h("div", { class: "hh-reels" }, REELS.map((r) => {
        const held = r.hold && z.hold[r.hold] !== undefined;
        return h("div", { class: "hh-reel" + (held ? " held" : "") + (m && r.key === "rar" ? " r-" + m.rank : ""), "data-k": r.key },
          h("small", { text: r.label }), h("span", { class: "hh-sym", text: m ? reelText(r.key, m) : "?" }));
      })));
  }
  function spinTab() {
    const { h } = SVT.ui, z = st(), last = z.list[z.last] || null, coins = z.coins;
    const sp = SUPER.SPINS[tier], cost = SVT.superSpinCost(tier);
    const holdBtns = last ? h("div", { class: "hh-holds" }, h("span", { class: "muted small", text: "Hold from your last spin (+50% a spin):" }),
      REELS.filter((r) => r.hold).map((r) => {
        const on = z.hold[r.hold] !== undefined;
        return h("button", { class: "hh-hold" + (on ? " on" : ""), "aria-pressed": on ? "true" : "false", onclick: () => { SVT.superHold(r.hold, !on); open(); }, text: (on ? "🔒 " : "🔓 ") + r.label });
      })) : null;
    shell(h("div", { class: "vault-body" },
      machine(last, last ? "" : "idle"),
      h("p", { class: "vault-lede", text: coins >= SUPER.SPINS[0].cost ? "Pull the lever to hire a super manager. Every reel is random: area, rarity, power, perk, stars and face." : "Not enough 💠 Hero coins. Each funding round pays " + SUPER.ROUND_COINS + ", an IPO " + (SUPER.ROUND_COINS + SUPER.IPO_COINS) + ", a new Viking stage " + SUPER.RAID_COINS + "." }),
      h("div", { class: "vault-stakes hh-tiers" }, SUPER.SPINS.map((s, i) => h("button", { class: "vault-stake" + (i === tier ? " on" : ""), onclick: () => { tier = i; open(); } },
        h("b", { text: s.name }), h("small", { text: "💠 " + SVT.fmt(SVT.superSpinCost(i)) })))),
      h("div", { class: "vault-odds" }, RAR.slice(0, ROLLED).map((r, i) => h("div", { class: "vault-odd r-" + r.id }, h("b", { text: r.name }), h("span", { text: pct(sp.odds[i]) })))),
      holdBtns,
      h("p", { class: "muted small", text: "Legendary or better guaranteed within " + SVT.superPityLeft() + " more spins. 🎰 Jackpot: a 5-star Rare or better gives the spin back. Three of one rarity merge into the next on the Team tab." })),
      h("div", { class: "vault-foot" }, h("button", { class: "btn fund-cta big vault-roll hh-pull", disabled: coins < cost, onclick: () => pull(tier), text: coins < cost ? "Need 💠 " + SVT.fmt(cost) : "🎰 Spin " + sp.name + " · 💠 " + SVT.fmt(cost) })));
  }
  function pull(t) {
    if (busy) return;
    const res = SVT.superSpin(t);
    if (!res) return;
    busy = true;
    const { h } = SVT.ui, m = res.m;
    const mach = machine(null, "spinning");
    shell(h("div", { class: "vault-body vault-rolling" }, mach, h("p", { class: "vault-lede", text: "Headhunting…" })));
    const reels = [...mach.querySelectorAll(".hh-reel")];
    const z = st();
    const spin = setInterval(() => reels.forEach((el, i) => { if (!el.classList.contains("lock")) el.lastChild.textContent = randomText(REELS[i].key); }), 70);
    let i = 0;
    const lock = () => {
      if (!box || !box.contains(mach)) { clearInterval(spin); busy = false; return; }
      const el = reels[i], r = REELS[i];
      el.lastChild.textContent = reelText(r.key, m); el.classList.add("lock");
      if (r.key === "rar") el.classList.add("r-" + m.rank);
      if (r.hold && z.hold[r.hold] !== undefined) el.classList.add("held");
      if (navigator.vibrate) navigator.vibrate(15);
      i++;
      if (i < reels.length) setTimeout(lock, r.key === "area" ? 700 : 450);
      else { clearInterval(spin); setTimeout(() => reveal([m], res.jackpot), 500); }
    };
    setTimeout(lock, 600);
  }
  function reveal(list, jackpot) {
    const { h, toast } = SVT.ui;
    busy = false;
    const best = list.slice().sort((a, b) => b.rar - a.rar)[0];
    shell(h("div", { class: "vault-body vault-reveal r-" + best.rank },
      jackpot ? h("p", { class: "hh-jackpot", text: "🎰 JACKPOT! Spin refunded" }) : null,
      h("p", { class: "vault-got", text: best.rar >= 5 ? "✨ " + RAR[best.rar].name.toUpperCase() + "! ✨" : best.rar >= 4 ? "⭐ Legendary! ⭐" : list.length > 1 ? list.length + " merged" : best.merged ? "Merged into " + RAR[best.rar].name + "!" : "Hired!" }),
      h("div", { class: "sh-list" }, list.map((m) => heroCard(m))),
      h("p", { class: "muted small", text: "Seat it from any manager seat: tap a seat, then pick it under 🦸 Super managers." })),
      h("div", { class: "vault-foot" },
        h("button", { class: "btn fund-cta big", onclick: () => { tab = "spin"; open(); }, text: "Spin again" }),
        h("button", { class: "btn big", onclick: () => { tab = "team"; open(); }, text: "🦸 Team" })));
    if (best.rar >= 4) toast("🦸 " + RAR[best.rar].name + " super manager: " + best.name + "!", "big");
    if (SVT.render) SVT.render();
  }
  // Team tab in the Vault's drop-down style (user: "that is the style I want for all drop downs"): Max merge on top,
  // a folding merge list, then one fold-out per rarity (empty ones too), grouped inside by area, strongest first.
  const rarOpen = new Set();
  let mergeOpen = false;
  function teamTab() {
    const { h, toast } = SVT.ui, groups = SVT.superMergeable(), all = SVT.superList();
    const mergeNow = groups.reduce((n, g) => n + Math.floor(g.ids.length / 3), 0);
    const card = (m) => heroCard(m, m.at ? [h("button", { class: "btn small ghost", onclick: () => { SVT.superUnseat(m.id); open(); }, text: "Unseat" })] : []);
    const shelf = (i) => {
      const mine = all.filter((m) => m.rar === i);
      return h("details", { class: "vault-shelf vault-rarshelf r-" + RAR[i].id, open: rarOpen.has(i) ? "" : null, ontoggle: (e) => { if (e.currentTarget.open) rarOpen.add(i); else rarOpen.delete(i); } },
        h("summary", { class: "r-" + RAR[i].id, text: RAR[i].name + (i >= 4 ? " ★" : "") + " (" + mine.length + ")" }),
        mine.length ? SUPER.AREAS.filter((a) => mine.some((m) => m.area === a.id)).map((a) => h("div", { class: "vault-typegroup" },
          h("h4", { class: "vault-type", text: a.icon + " " + a.name }),
          h("div", { class: "sh-list" }, mine.filter((m) => m.area === a.id).sort((x, y) => y.stars - x.stars || (y.born || 0) - (x.born || 0)).map(card))))
          : h("p", { class: "muted small", text: "None yet." + (i >= ROLLED ? " Merge three " + RAR[i - 1].name + " super managers to make one." : "") }));
    };
    shell(h("div", { class: "vault-body" },
      all.length ? null : h("p", { class: "vault-empty", text: "No super managers yet. Spin on the Spin tab." }),
      mergeNow ? h("button", { class: "btn fund-cta vault-merge-all", onclick: () => { const out = SVT.superMergeAll(); if (out.length) { toast("🧬 " + out.length + (out.length === 1 ? " merge" : " merges"), "big"); reveal(out); } }, text: "🧬 Max merge · " + mergeNow + " now" }) : null,
      all.length ? h("details", { class: "vault-shelf vault-mergebox", open: mergeOpen ? "" : null, ontoggle: (e) => { mergeOpen = e.currentTarget.open; } },
        h("summary", { text: "🧬 Merge (" + groups.length + ")" + (groups.length ? " · tap to pick" : "") }),
        groups.length ? groups.map((g) => h("div", { class: "hoard-merge-row r-" + RAR[g.rar].id },
          h("div", null, h("b", { text: g.ids.length + " " + RAR[g.rar].name }), h("span", { class: "muted small", text: " → 1 random " + RAR[g.rar + 1].name })),
          h("div", { class: "hoard-merge-btns" }, h("button", { class: "btn small fund-cta", onclick: () => { const m = SVT.superMerge(g.rar); if (m) reveal([m]); }, text: "Merge 3" }))))
          : h("p", { class: "muted small", text: "Three super managers of one rarity merge into one random super manager of the next rarity, up to Ascended. Seated ones don't count: unseat them first." })) : null,
      RAR.map((r, i) => i).reverse().map(shelf)));
  }
  function open() { if (tab === "team") teamTab(); else spinTab(); }
  SVT.openSupers = (t) => { if (SVT.closeSheet) SVT.closeSheet(); tab = t || "spin"; open(); };

  // Section in a seat's manager panel: the super managers that fit it.
  SVT.superPicker = (kind, n, reopen) => {
    const { h, toast } = SVT.ui, lab = SVT.lab(), here = SVT.slotKey(kind, n), cur = SVT.superAt(lab, here);
    const fit = SVT.superList().filter((m) => SVT.superFits(m, kind) && m !== cur).sort((a, b) => !!a.at - !!b.at || b.rar - a.rar || b.stars - a.stars);
    const body = fit.length ? h("div", { class: "sh-list" }, fit.slice(0, 30).map((m) => heroCard(m, [h("button", { class: "btn small use", onclick: () => {
      SVT.superSeat(m.id, kind, n); toast("🦸 " + m.name + " now runs " + SVT.slotName(here)); reopen();
    }, text: m.at ? "Move here" : "Seat here" })])))
      : h("p", { class: "muted small", text: SVT.superCount() ? "None of your super managers fit this seat." : "No super managers yet." });
    return h("div", { class: "sh-pick" },
      h("div", { class: "sec-label", text: "🦸 Super managers that fit this seat:" }), body);
  };

  // Settings: the cheat code box.
  SVT.cheatBox = () => {
    const { h, toast } = SVT.ui;
    const input = h("input", { class: "cheat-input", type: "text", placeholder: "Cheat code", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": "Cheat code" });
    const go = () => {
      if (SVT.superCheat(input.value)) { toast("💠 +" + SVT.fmt(SUPER.CHEAT_COINS) + " Hero coins (" + SVT.fmt(st().coins) + ")", "big"); if (SVT.render) SVT.render(); }
      else toast("Unknown code");
      input.value = "";
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    return h("div", { class: "cheat-row" }, input, h("button", { class: "btn small", onclick: go, text: "Apply" }));
  };

  // A super manager's power going off: a banner toast so it reads like a superhero move.
  SVT.on((type, d) => {
    if (type !== "ability" || !d.sup || !SVT.ui) return;
    const def = SVT.superDef(d.sup);
    SVT.ui.toast((d.chained ? "⛓️ " : "🦸 ") + d.sup.name + ": " + def.icon + " " + def.name + "!", "r-" + d.sup.rank);
  });
})();
