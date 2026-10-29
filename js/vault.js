// Tech Vault: the collectible roll. Beating a lab pays a coin stamped with that lab; coins from one lab roll one of
// its 30 products as a one-of-a-kind collectible: PRODUCT * RARITY * COLOR+FINISH * SIZE * MODS * SERIAL. More
// coins in one roll lift the odds (B.VAULT.ODDS), pity guarantees a Legendary within B.VAULT.PITY.HARD coins, and no
// two items in a save ever share a look. Items are trophies: Chip can hold one on the home screen.
window.SVT = window.SVT || {};

(function () {
  const B = SVT.B, V = B.VAULT;
  const RAR = V.RARITIES;
  const COLORS = [
    ["Crimson", "#d7263d"], ["Coral", "#ff6f59"], ["Tangerine", "#ff8c1a"], ["Amber", "#ffb300"], ["Lemon", "#ffe600"], ["Lime", "#9ccc1c"],
    ["Mint", "#2ecc71"], ["Forest", "#1b7f4c"], ["Teal", "#17a2a8"], ["Cyan", "#22d3ee"], ["Sky", "#4fa3ff"], ["Cobalt", "#2457d6"],
    ["Navy", "#1e2a78"], ["Indigo", "#5b3fd6"], ["Violet", "#8e44ad"], ["Magenta", "#e0249a"], ["Rose", "#ff6fae"], ["Blush", "#f4b6c2"],
    ["Ivory", "#f3ecd8"], ["Sand", "#d9b382"], ["Walnut", "#7a4a2a"], ["Slate", "#5d6d7e"], ["Graphite", "#2f3640"], ["Onyx", "#111318"],
  ];
  // tier: the rarity from which a finish is common; below it the finish is a lucky roll.
  const FINISHES = [
    { name: "Matte", tier: 0 }, { name: "Gloss", tier: 0 }, { name: "Translucent", tier: 1 }, { name: "Brushed", tier: 2 },
    { name: "Chrome", tier: 3 }, { name: "Neon", tier: 3 }, { name: "Holographic", tier: 4 }, { name: "Gold-plated", tier: 5 },
  ];
  const SIZES = [["Keychain", 1], ["Pocket", 3], ["Standard", 10], ["Jumbo", 3], ["Desk", 2], ["Giant", 1]];
  const MODS = ["Overclocked", "Solar", "Waterproof", "Glitched", "RGB", "Dev-signed", "Prototype", "Silent", "Turbo", "Modded",
    "Hand-soldered", "Limited run", "Cooled", "Encrypted", "Retro-fit", "Boosted", "Shielded", "Clear case", "Hotrod", "Lucky"];
  const SIGNATURE = ["Founder's Edition", "One of One", "Keynote Unit", "Vault Original", "Engineering Sample"];
  // The product picture: a real icon per product from js/icons.js (built by tools/build-icons.mjs), used as a CSS mask so
  // the item's color and finish paint the icon itself.
  const svgCache = {};
  SVT.productSvg = (labId, product) => {
    const id = (SVT.PRODUCT_ICON || {})[labId + ":" + product], ic = id && SVT.ICONS[id];
    if (!ic) return "";
    if (!svgCache[id]) svgCache[id] = "url(\"data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + ic.w + ' ' + ic.h + '">' + ic.body + "</svg>") + "\")";
    return svgCache[id];
  };

  const S = () => SVT.state().vault;
  const rnd = () => Math.random();
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const weighted = (items, w) => { let t = w.reduce((a, b) => a + b, 0), r = rnd() * t; for (let i = 0; i < items.length; i++) { if (r < w[i]) return items[i]; r -= w[i]; } return items[items.length - 1]; };
  // 6 characters from the browser's secure random generator (about a billion tags).
  function dna() {
    const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", a = new Uint8Array(6);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for (let i = 0; i < 6; i++) a[i] = Math.floor(rnd() * 256);
    let s = ""; for (let i = 0; i < 6; i++) s += A[a[i] % A.length];
    return s.slice(0, 3) + "-" + s.slice(3);
  }

  // The odds table a roll uses: the stake's table, lifted by pity. Returns shares for RAR in order.
  SVT.vaultOdds = (coins, pity) => {
    pity = pity === undefined ? S().pity : pity;
    const base = V.ODDS[coins]; if (!base) return null;
    let p = base.slice();
    const top = p[4] + p[5];
    if (pity + coins >= V.PITY.HARD) { // hard pity: Legendary or better
      p = [0, 0, 0, 0, p[4] / top, p[5] / top];
    } else if (pity >= V.PITY.SOFT) { // soft pity: more Legendary, taken from the lower tiers
      const add = Math.min(1 - top, (pity - V.PITY.SOFT + 1) * V.PITY.SOFT_STEP);
      const low = p[0] + p[1] + p[2] + p[3];
      for (let i = 0; i < 4; i++) p[i] *= (low - add) / low;
      p[4] += add;
    }
    return p;
  };
  SVT.vaultRollRarity = (coins, pity, r) => {
    const p = SVT.vaultOdds(coins, pity);
    let x = r === undefined ? rnd() : r;
    for (let i = 0; i < p.length; i++) { if (x < p[i]) return i; x -= p[i]; }
    return p.length - 1;
  };

  const lookKey = (it) => [it.lab, it.product, it.color, it.finish, it.size, it.mods.slice().sort().join("+")].join("|");
  function rollLook(rar, product) {
    const color = Math.floor(rnd() * COLORS.length);
    const finish = FINISHES.indexOf(weighted(FINISHES, FINISHES.map((f) => (f.tier <= rar ? 4 : f.tier - rar === 1 ? 1 : 0.15))));
    const size = SIZES.indexOf(weighted(SIZES, SIZES.map((s) => s[1])));
    const n = RAR[rar].mods, pool = MODS.slice(), mods = [];
    while (mods.length < n && pool.length) mods.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    if (rar === RAR.length - 1) mods.push(pick(SIGNATURE));
    return { color, finish, size, mods };
  }
  // Spends `coins` of one lab and rolls an item. Returns the item (null if the coins are not there).
  SVT.vaultRoll = (labId, coins) => {
    const v = S();
    const def = SVT.LABS.find((l) => l.id === labId);
    if (!V.ODDS[coins] || !def || !SVT.vaultSpend(labId, coins)) return null;
    let rar = SVT.vaultRollRarity(coins, v.pity);
    if (v.serial === 0) rar = Math.max(rar, V.FIRST_ROLL_MIN);
    v.pity = rar >= 4 ? 0 : v.pity + coins;
    v.spent += coins;
    const product = Math.floor(rnd() * def.products.length);
    const taken = new Set(v.items.map(lookKey));
    let item = null;
    for (let tries = 0; tries < 200; tries++) { // no two items in a save share a look
      item = Object.assign({ lab: labId, product, rarity: RAR[rar].id, rar }, rollLook(rar, product));
      if (!taken.has(lookKey(item))) break;
    }
    item.id = ++v.serial;
    item.dna = dna();
    item.at = Date.now();
    item.stake = coins;
    const bonus = V.BONUS[rar];
    item.boost = rnd() < bonus.chance ? bonus.mult : 1;
    v.items.push(item);
    // The first items go straight onto Chip, into the first free slot.
    const free = SLOTS.find((sl) => !v.show[sl.id] && SVT.vaultFits(item, sl.id));
    if (free) v.show[free.id] = item.id;
    SVT.vaultRecalc();
    SVT.save();
    return item;
  };
  SVT.vaultItem = (id) => S().items.find((x) => x.id === id) || null;
  // Bulk rolls (v0.34, user's ask: "buy bulk Max in the vault"). ANY = a random lab per roll. Labs with their own coins
  // go first (any of them, at random); once none can pay on its own, the lab with the most coins left rolls on wild
  // coins, so the count the button promises is the count the player gets.
  SVT.VAULT_ANY = "any";
  SVT.VAULT_BULK_MAX = 100; // rolls per press
  SVT.vaultRollable = (stake) => SVT.LABS.filter((l) => SVT.vaultSpendable(l.id) >= stake);
  function pickLab(labId, stake, coins, wild, r) {
    if (labId !== SVT.VAULT_ANY) return (coins[labId] || 0) + (SVT.state().labs[labId] ? wild : 0) >= stake ? labId : null;
    const own = SVT.LABS.filter((l) => (coins[l.id] || 0) >= stake);
    if (own.length) return own[Math.floor(r() * own.length)].id;
    const open = SVT.LABS.filter((l) => SVT.state().labs[l.id] && (coins[l.id] || 0) + wild >= stake).sort((a, b) => (coins[b.id] || 0) - (coins[a.id] || 0));
    return open.length ? open[0].id : null;
  }
  // How many rolls a Max press makes at this stake (a dry run of the same picking rule).
  SVT.vaultMaxRolls = (labId, stake, limit) => {
    const v = S(), coins = Object.assign({}, v.coins); let wild = v.wild || 0, n = 0;
    limit = limit || SVT.VAULT_BULK_MAX;
    while (n < limit) {
      const id = pickLab(labId, stake, coins, wild, () => 0);
      if (!id) break;
      const own = Math.min(stake, coins[id] || 0); coins[id] = (coins[id] || 0) - own; wild -= stake - own; n++;
    }
    return n;
  };
  SVT.vaultRollMany = (labId, stake, limit) => {
    const out = []; limit = limit || SVT.VAULT_BULK_MAX;
    while (out.length < limit) {
      const v = S(), id = pickLab(labId, stake, v.coins, v.wild || 0, rnd);
      const it = id && SVT.vaultRoll(id, stake);
      if (!it) break;
      out.push(it);
    }
    return out;
  };
  // ---------- Chip's slots ----------
  // Paper-doll style: each slot is an anchor point on Chip (x, y in his 200x270 SVG box, size in px, z in front of
  // or behind him). Held things go in a hand, wearables on the wrist, head, neck, body or feet, and anything he can't
  // wear stands on the floor beside him. An item sits in at most one slot.
  const SLOTS = [
    { id: "hand_l", name: "Left hand", icon: "🤚", cat: "hand", x: 34, y: 32, size: 56, z: 3 },
    { id: "hand_r", name: "Right hand", icon: "✋", cat: "hand", x: 166, y: 32, size: 56, z: 3 },
    { id: "wrist", name: "Wrist", icon: "⌚", cat: "wrist", x: 22, y: 104, size: 34, z: 3 },
    { id: "head", name: "Head", icon: "🧢", cat: "head", x: 100, y: 46, size: 44, z: 3 },
    { id: "neck", name: "Neck", icon: "📿", cat: "neck", x: 100, y: 132, size: 36, z: 3 },
    { id: "body", name: "Body", icon: "🧥", cat: "body", x: 100, y: 176, size: 46, z: 2 },
    { id: "feet", name: "Feet", icon: "👟", cat: "feet", x: 100, y: 248, size: 38, z: 3 },
    { id: "floor_l", name: "Floor left", icon: "⬅️", cat: "floor", x: -34, y: 232, size: 62, z: 1 },
    { id: "floor_r", name: "Floor right", icon: "➡️", cat: "floor", x: 234, y: 232, size: 62, z: 1 },
  ];
  SVT.VAULT_SLOTS = SLOTS;
  const CATS = { hand: "Held in a hand", wrist: "Worn on the wrist", head: "Worn on the head", neck: "Worn round the neck", body: "Worn on the body", feet: "Worn on the feet", floor: "Stands on the floor beside Chip" };
  // Every product on every floor of every lab gets a category from its name. First matching rule wins: big things
  // first (so "server rack" never ends up in a hand), then the wearables, then small hand-held things; whatever is
  // left stands on the floor.
  const CAT_RULES = [
    ["floor", /station\b|server|array|network|cluster|city|plant\b|press\b|cabinet|catalog terminal|trading terminal|mainframe terminal|comms terminal|engraver|laser cutter|laser show|\bwall\b|\bweb\b|tower|rack\b|turnstile|walker|antenna|cable|cytometer|dna synthesizer|incubator|cell counter|pipette|distributor|exchange|tabletop|hab ring|hunter drone|fiber patch|home battery|grid-scale|tube segment|lava-tube|fuel plant|brick press|weed laser|crop map|ethernet switch|optical switch|photonic server|planetary|continental|global|biofab|direct-to-phone|magic lantern|laptop cart|ct scanner|mri scanner|seed vault|space solar/],
    ["feet", /sneaker|shoe|sock|tights|\bboots?\b/],
    ["wrist", /wristwatch|watch\b|fitness band|bracelet|glove|\bring\b|cuff|pedometer|dive computer|stopwatch|oximeter|key fob/],
    ["head", /^ai |headset|headphones|goggles|glasses|beanie|helmet|\bhat\b|visor|crown|headband|earbuds|earpiece|hearing aid|cochlear|neural|brain|contact lens|contact jewelry|retinal|view-master|stereoscope|dream recorder|robo-advisor|protein folder/],
    ["neck", /necklace|lanyard|pendant|(?<!key)chain\b|stethoscope|(?<!laser )\btag\b|badge|scarf|collar|whistle|point-and-shoot camera|snorkel camera|8mm home camera|camcorder|gimbal camera|light meter/],
    ["body", /jacket|vest\b|suit\b|hoodie|shirt|backpack|belt\b|dress|gown|cloak|fabric|textile|tote|brace\b|exoskeleton|exo-|heart patch|pacemaker|artificial heart|insulin pump|heart rate strap|apron|harness|radiation shield|handbag/],
    ["hand", /calculator|keychain|handheld|game\b|console|controller|joystick|mouse|keyboard|remote|phone|tablet|reader|player|pager|organizer|wand|pen\b|meter|gauge|thermometer|flashlight|pocket|portable|transistor radio|crystal radio|weather radio|marine radio|ham radio|recorder|pointer|multimeter|soldering|breadboard|memory card|capture card|graphics card|floppy|disk|usb|fob|token|lock\b|keypad|fingerprint|wallet|puzzle|cube|yo-yo|spinning top|doll|plush|toy|figure|\bball\b|light gun|chip\b|probe\b|sensor|battery|charger|bulb|plug|fuse|cell\b|vacuum tube|laser pointer|detector|beacon|candle|filter|brick|shovel|sample box|poster|globe|map\b|model\b|kit\b|card\b|tracker|monitor\b|synthesizer|sampler|pedal|metronome|tuner|mic\b|speaker|flip|slider|clapperboard|splicer|coin|adding machine|barometer|hygrometer|vane|anemometer|rain gauge|radiosonde|petri|microscope|ion trap|laser|photon|qubit chip|processor|doorbell|intercom|smoke detector|thermostat|robot pet|robot dinosaur|tin robot|robot arm toy|coding robot|companion bot|hobby robot|building-block|virtual pet|quadcopter|toy drone|balsa|rubber-band|rc airplane|rc helicopter|remote-control|slot car|train set|racetrack|blocks|lever|punch|retroreflector|moon map|wheel|whale tracker|fish finder|depth sounder|regulator|buoy beacon|sat messenger|gps receiver|transponder|hologram figure|heads-up|laptop|modem|router|boombox|drum machine|interface|\bbox\b|\bapp\b|seed\b|\bleaf\b|wire\b|nano satellite|receiver|quiz board|gesture-control car|adapter|stabilizer|iris scanner|face-id|dictionary|translator|walkie|smart card|security token|id kiosk|dust filter|oxygen candle|key\b|heart\b|lens|scanner\b/],
  ];
  const catCache = {};
  SVT.productCat = (name) => {
    if (catCache[name]) return catCache[name];
    const n = name.toLowerCase();
    let cat = "floor";
    for (const [c, re] of CAT_RULES) if (re.test(n)) { cat = c; break; }
    return (catCache[name] = cat);
  };
  SVT.itemCat = (it) => SVT.productCat(SVT.itemProduct(it));
  SVT.catName = (cat) => CATS[cat];
  SVT.vaultFits = (it, slot) => { const sl = SLOTS.find((x) => x.id === slot); return !!sl && sl.cat === SVT.itemCat(it); };
  SVT.vaultWear = (slot, id) => {
    const v = S();
    for (const k in v.show) if (v.show[k] === id) delete v.show[k];
    if (id && SVT.vaultFits(SVT.vaultItem(id), slot)) v.show[slot] = id;
    SVT.vaultRecalc();
    SVT.save();
  };
  SVT.vaultSlots = () => SLOTS;
  // What a slot can take: items of its category that are not already on Chip somewhere else, rarest first.
  SVT.vaultEligible = (slot) => S().items.filter((it) => SVT.vaultFits(it, slot) && (!SVT.vaultSlotOf(it.id) || SVT.vaultSlotOf(it.id) === slot))
    .sort((a, b) => b.rar - a.rar || b.boost - a.boost || b.id - a.id);
  // One-tap equip: the first free slot the item fits; if none is free, the fitting slot holding the weakest item.
  SVT.vaultEquip = (id) => {
    const it = SVT.vaultItem(id), v = S();
    if (!it || SVT.vaultSlotOf(id)) return null; // already on Chip
    const fits = SLOTS.filter((sl) => SVT.vaultFits(it, sl.id));
    let slot = fits.find((sl) => !v.show[sl.id]);
    if (!slot) slot = fits.slice().sort((a, b) => { const A = SVT.vaultItem(v.show[a.id]), Bb = SVT.vaultItem(v.show[b.id]); return (A ? A.rar : 0) - (Bb ? Bb.rar : 0) || (A ? A.boost : 0) - (Bb ? Bb.boost : 0); })[0];
    if (!slot) return null;
    SVT.vaultWear(slot.id, id);
    return slot;
  };
  const boostText = (it) => (it.boost > 1 ? "⚡ ×" + it.boost + " income" : "no bonus");
  // Auto-equip: every slot gets the best item of its kind (biggest bonus, then rarest). Returns how many slots changed.
  SVT.vaultAutoEquip = () => {
    const v = S(), before = JSON.stringify(v.show), used = new Set();
    const best = (a, b) => b.boost - a.boost || b.rar - a.rar || b.id - a.id;
    const show = {};
    SLOTS.forEach((sl) => {
      const it = v.items.filter((x) => !used.has(x.id) && SVT.vaultFits(x, sl.id)).sort(best)[0];
      if (it) { show[sl.id] = it.id; used.add(it.id); }
    });
    v.show = show;
    SVT.vaultRecalc();
    SVT.save();
    return SLOTS.filter((sl) => (JSON.parse(before)[sl.id] || null) !== (show[sl.id] || null)).length;
  };
  SVT.vaultSlotOf = (id) => Object.keys(S().show).find((k) => S().show[k] === id) || null;
  SVT.vaultWorn = () => SLOTS.map((sl) => ({ slot: sl, item: S().show[sl.id] ? SVT.vaultItem(S().show[sl.id]) : null })).filter((x) => x.item);
  // Saves from before v0.20 used size-based slots: move what still fits, drop the rest from Chip.
  SVT.vaultFixSlots = () => {
    const v = S();
    if (v.show.hat && !v.show.head) { v.show.head = v.show.hat; } delete v.show.hat;
    for (const k in v.show) { const it = SVT.vaultItem(v.show[k]); if (!it || !SVT.vaultFits(it, k)) delete v.show[k]; }
    SVT.vaultRecalc();
  };

  // ---------- merging ----------
  // Any three items of the same rarity (any product, any lab) merge into one item of the next rarity: a random
  // product from one of the merged items' labs, with a new look and a new bonus chance. Items on Chip don't merge,
  // and Mythic is the top.
  const mergeable = (it) => it.rar < RAR.length - 1 && !SVT.vaultSlotOf(it.id);
  const weakestFirst = (a, b) => a.boost - b.boost || a.id - b.id;
  SVT.vaultMerges = () => {
    const groups = {};
    S().items.forEach((it) => { if (mergeable(it)) (groups[it.rar] = groups[it.rar] || []).push(it); });
    return Object.keys(groups).map((r) => ({ rar: +r, items: groups[r].sort(weakestFirst), count: groups[r].length }))
      .filter((g) => g.count >= 3).sort((a, b) => b.rar - a.rar);
  };
  // ids: the three to merge; left out, the three weakest of that rarity go.
  SVT.vaultMerge = (rar, ids) => {
    const v = S();
    const g = SVT.vaultMerges().find((m) => m.rar === rar);
    if (!g) return null;
    const used = ids ? ids.map((id) => g.items.find((it) => it.id === id)) : g.items.slice(0, 3);
    if (used.length !== 3 || used.some((it) => !it) || new Set(used).size !== 3) return null;
    v.items = v.items.filter((it) => !used.includes(it));
    const nr = rar + 1, taken = new Set(v.items.map(lookKey));
    const lab = used[Math.floor(rnd() * 3)].lab, def = SVT.LABS.find((l) => l.id === lab);
    let item = null;
    for (let tries = 0; tries < 200; tries++) {
      const product = Math.floor(rnd() * def.products.length);
      item = Object.assign({ lab, product, rarity: RAR[nr].id, rar: nr }, rollLook(nr, product));
      if (!taken.has(lookKey(item))) break;
    }
    item.id = ++v.serial; item.dna = dna(); item.at = Date.now(); item.stake = 0; item.merged = used.map((x) => x.id);
    item.boost = rnd() < V.BONUS[nr].chance ? V.BONUS[nr].mult : 1;
    v.items.push(item);
    SVT.vaultRecalc();
    SVT.save();
    return item;
  };

  // ---------- names and pictures ----------
  SVT.itemName = (it) => {
    const def = SVT.LABS.find((l) => l.id === it.lab);
    return SIZES[it.size][0] + " " + FINISHES[it.finish].name + " " + COLORS[it.color][0] + " " + def.products[it.product];
  };
  SVT.itemProduct = (it) => SVT.LABS.find((l) => l.id === it.lab).products[it.product];
  SVT.itemCode = (it) => [SVT.itemProduct(it), RAR[it.rar].name, COLORS[it.color][0] + " " + FINISHES[it.finish].name, SIZES[it.size][0], it.mods.length ? it.mods.join(" + ") : "No mods", "#" + String(it.id).padStart(4, "0") + " " + it.dna];
  // The item picture: a device tile in the item's color and finish, framed in the rarity's hue.
  SVT.itemArt = (it, cls) => {
    const { h } = SVT.ui;
    const fin = FINISHES[it.finish].name.toLowerCase().replace(/[^a-z]/g, "");
    return h("div", { class: "vault-art r-" + it.rarity + " f-" + fin + " s-" + SIZES[it.size][0].toLowerCase() + (cls ? " " + cls : ""), style: "--vc:" + COLORS[it.color][1] },
      h("span", { class: "vault-art-dev" }, h("span", { class: "vault-art-ic", style: "--ic:" + SVT.productSvg(it.lab, it.product), role: "img", "aria-label": SVT.itemProduct(it) })),
      h("span", { class: "vault-art-rar", text: RAR[it.rar].name }));
  };

  // ---------- UI ----------
  let box = null, busy = false, labPick = null, stake = 1, bulk = false, tab = "roll", slotPick = null;
  function close() { if (box) box.remove(); box = null; busy = false; document.removeEventListener("keydown", onKey); }
  function onKey(e) { if (e.key === "Escape") close(); }
  function shell(...kids) {
    const { h } = SVT.ui;
    if (box) box.remove();
    box = h("div", { class: "vault", id: "vault", role: "dialog", "aria-label": "Tech Vault" },
      h("div", { class: "vault-head" },
        h("span", { class: "vault-logo", "aria-hidden": "true", text: "🎁" }),
        h("h2", { text: "Tech Vault" }),
        h("span", { class: "vault-coins", text: "🪙 " + SVT.vaultCoins() }),
        h("button", { class: "x-btn", "aria-label": "Close", onclick: close, text: "✕" })),
      h("div", { class: "vault-tabs" },
        h("button", { class: "vault-tab" + (tab === "roll" ? " on" : ""), onclick: () => { tab = "roll"; openVault(); }, text: "Roll" }),
        h("button", { class: "vault-tab" + (tab === "gallery" ? " on" : ""), onclick: () => { tab = "gallery"; openVault(); }, text: "Items (" + S().items.length + ")" }),
        h("button", { class: "vault-tab" + (tab === "chip" ? " on" : ""), onclick: () => { tab = "chip"; slotPick = null; openVault(); }, text: "Chip ⚡×" + SVT.vaultMult() }),
        h("button", { class: "vault-tab" + (tab === "trophies" ? " on" : ""), onclick: () => { tab = "trophies"; openVault(); }, text: "Trophies" })),
      ...kids);
    document.body.append(box);
    document.addEventListener("keydown", onKey);
  }
  const pct = (x) => (x * 100 < 1 && x > 0 ? (x * 100).toFixed(1) : Math.round(x * 100)) + "%";
  function oddsTable(coins) {
    const { h } = SVT.ui;
    const p = SVT.vaultOdds(coins);
    return h("div", { class: "vault-odds" }, RAR.map((r, i) => h("div", { class: "vault-odd r-" + r.id }, h("b", { text: r.name }), h("span", { text: pct(p[i]) }))));
  }

  function openVault() {
    const { h } = SVT.ui;
    close();
    const v = S();
    if (tab === "gallery") return gallery();
    if (tab === "trophies") return trophies();
    if (tab === "chip") return chipTab();
    // Labs you can roll at: ones with their own coins, plus any open lab while you have wild coins.
    const labs = SVT.LABS.filter((l) => SVT.vaultSpendable(l.id) > 0);
    const ANY = SVT.VAULT_ANY;
    if (labPick !== ANY && !labs.find((l) => l.id === labPick)) labPick = labs.length ? labs[0].id : null;
    if (labPick === ANY && !labs.length) labPick = null;
    const have = !labPick ? 0 : labPick === ANY ? Math.max(0, ...labs.map((l) => SVT.vaultSpendable(l.id))) : SVT.vaultSpendable(labPick);
    if (!V.STAKES.includes(stake) || stake > have) stake = V.STAKES.filter((s) => s <= have).pop() || 1;
    const many = labPick ? SVT.vaultMaxRolls(labPick, stake) : 0;
    const pityLeft = Math.max(0, V.PITY.HARD - v.pity);
    const body = h("div", { class: "vault-body" },
      h("p", { class: "vault-lede", text: "Pick a lab, pick a stake, roll. Every roll is a one-of-a-kind collectible from that lab. More coins in one roll means better odds." }),
      SVT.vaultWild() ? h("p", { class: "muted small", text: "🪙 " + SVT.vaultWild() + " wild " + (SVT.vaultWild() === 1 ? "coin rolls" : "coins roll") + " at any open lab (a lab's own coins go first)." }) : null,
      labs.length
        ? h("div", { class: "vault-labs" },
          h("button", { class: "vault-lab any" + (labPick === ANY ? " on" : ""), onclick: () => { labPick = ANY; openVault(); } },
            h("span", { text: "🎲 Random lab" }), h("b", { text: "🪙 " + SVT.vaultCoins() + " · every roll picks a lab" })),
          labs.map((l) => h("button", { class: "vault-lab" + (l.id === labPick ? " on" : ""), onclick: () => { labPick = l.id; openVault(); } },
          h("span", { text: l.icon + " " + l.name }), h("b", { text: "🪙 " + (v.coins[l.id] || 0) + (SVT.vaultWild() ? " +" + SVT.vaultWild() + " wild" : "") }))))
        : h("p", { class: "vault-empty", text: "No coins yet. Raise a lab's IPO to earn " + V.COIN_PER_BEAT + " coins, then replay a beaten lab from the map for " + V.COIN_PER_BEAT + " more." }),
      labPick ? h("div", { class: "vault-stakes" }, V.STAKES.map((s) => h("button", { class: "vault-stake" + (s === stake ? " on" : ""), disabled: s > have, onclick: () => { stake = s; openVault(); } }, h("b", { text: "🪙 " + s }), h("small", { text: s === 1 ? "1 coin" : s + " coins" })))) : null,
      labPick ? h("button", { class: "vault-bulk" + (bulk ? " on" : ""), "aria-pressed": bulk ? "true" : "false", onclick: () => { bulk = !bulk; openVault(); } },
        h("b", { text: bulk ? "🔁 Max: on" : "🔁 Max" }), h("span", { text: bulk ? "Rolls " + many + "× " + stake + (stake === 1 ? " coin" : " coins") + " in one go" + (many >= SVT.VAULT_BULK_MAX ? " (" + SVT.VAULT_BULK_MAX + " per press)" : "") : "Roll until the coins run out" })) : null,
      labPick ? oddsTable(stake) : oddsTable(1),
      h("p", { class: "muted small", text: (v.pity >= V.PITY.SOFT ? "🔥 " : "") + "Legendary or better guaranteed within " + pityLeft + " more " + (pityLeft === 1 ? "coin" : "coins") + "." + (v.serial === 0 ? " Your first roll is at least Rare." : "") }));
    const roll = h("button", { class: "btn fund-cta big vault-roll", disabled: !labPick || have < stake, onclick: () => (bulk ? doRollMany(labPick, stake) : doRoll(labPick, stake)),
      text: !labPick ? "No coins to roll" : bulk ? "Roll Max · " + many + " × " + stake + (stake === 1 ? " coin" : " coins") : "Roll " + stake + (stake === 1 ? " coin" : " coins") + (labPick === ANY ? " at a random lab" : "") });
    shell(body, h("div", { class: "vault-foot" }, roll));
  }

  // The roll: six segments spin like a slot machine and lock in one by one, then the item card.
  function doRoll(labId, coins) {
    const { h } = SVT.ui;
    if (busy) return;
    const it = labId === SVT.VAULT_ANY ? SVT.vaultRollMany(labId, coins, 1)[0] : SVT.vaultRoll(labId, coins);
    if (!it) return;
    busy = true;
    const def = SVT.LABS.find((l) => l.id === it.lab);
    const finals = SVT.itemCode(it);
    const pools = [def.products, RAR.map((r) => r.name), COLORS.map((c) => c[0]), SIZES.map((s) => s[0]), MODS, ["#????", "DNA ???"]];
    const segs = finals.map((t, i) => h("div", { class: "vault-seg", "data-i": i }, h("span", { text: pools[i][0] })));
    const stage = h("div", { class: "vault-spin" }, segs.flatMap((s, i) => (i ? [h("span", { class: "vault-star", text: "✱" }), s] : [s])));
    shell(h("div", { class: "vault-body vault-rolling" }, h("p", { class: "vault-lede", text: "Rolling " + coins + (coins === 1 ? " coin" : " coins") + " at " + def.name + "…" }), stage));
    let locked = 0;
    const spin = setInterval(() => {
      segs.forEach((s, i) => { if (i >= locked) s.firstChild.textContent = pick(pools[i]); });
    }, 70);
    const lock = () => {
      if (!box || !box.contains(stage)) { clearInterval(spin); busy = false; return; }
      const s = segs[locked];
      s.firstChild.textContent = finals[locked];
      s.classList.add("lock");
      if (locked === 1) { s.classList.add("r-" + it.rarity); stage.classList.add("r-" + it.rarity); }
      if (navigator.vibrate) navigator.vibrate(20);
      locked++;
      if (locked < segs.length) setTimeout(lock, locked === 1 ? 900 : 550);
      else { clearInterval(spin); setTimeout(() => reveal(it), 600); }
    };
    setTimeout(lock, 700);
  }

  // Max: every roll at once, a short spin, then the haul sorted best first with a tally per rarity.
  function doRollMany(labId, coins) {
    const { h } = SVT.ui;
    if (busy) return;
    const items = SVT.vaultRollMany(labId, coins);
    if (!items.length) return;
    busy = true;
    const pools = [RAR.map((r) => r.name), COLORS.map((c) => c[0]), MODS];
    const segs = pools.map((p, i) => h("div", { class: "vault-seg", "data-i": i + 1 }, h("span", { text: p[0] })));
    const stage = h("div", { class: "vault-spin" }, segs);
    shell(h("div", { class: "vault-body vault-rolling" }, h("p", { class: "vault-lede", text: "Rolling " + items.length + " × " + coins + (coins === 1 ? " coin" : " coins") + (labId === SVT.VAULT_ANY ? " across your labs…" : " at " + SVT.LABS.find((l) => l.id === labId).name + "…") }), stage));
    const spin = setInterval(() => segs.forEach((s, i) => { s.firstChild.textContent = pick(pools[i]); }), 70);
    setTimeout(() => { clearInterval(spin); if (box && box.contains(stage)) revealMany(items); else busy = false; }, 1400);
  }
  function revealMany(items) {
    const { h, toast } = SVT.ui;
    busy = false;
    const sorted = items.slice().sort((a, b) => b.rar - a.rar || b.id - a.id);
    const tally = RAR.map((r, i) => items.filter((it) => it.rar === i).length);
    const best = sorted[0];
    shell(h("div", { class: "vault-body vault-reveal vault-many r-" + best.rarity },
      h("p", { class: "vault-got", text: tally[5] ? "✨ " + tally[5] + " MYTHIC! ✨" : tally[4] ? "⭐ " + tally[4] + " Legendary! ⭐" : items.length + " new items" }),
      h("div", { class: "vault-tally" }, RAR.map((r, i) => tally[i] ? h("span", { class: "vault-tally-pill r-" + r.id, text: tally[i] + " " + r.name }) : null)),
      h("div", { class: "vault-haul" }, sorted.map((it) => itemCard(it, false))),
      h("p", { class: "muted small", text: "Every one is one of a kind. Your best new items went straight onto Chip's free slots." })),
      h("div", { class: "vault-foot" }, h("button", { class: "btn fund-cta big", onclick: () => { tab = "roll"; openVault(); }, text: SVT.vaultCoins() ? "Roll again" : "Back to the Vault" })));
    if (tally[4] + tally[5]) toast((tally[5] ? "✨ " + tally[5] + " Mythic" : "") + (tally[5] && tally[4] ? ", " : "") + (tally[4] ? "⭐ " + tally[4] + " Legendary" : "") + "!", "big");
    if (SVT.render) SVT.render();
  }
  const refresh = () => { if (SVT.render) SVT.render(); openVault(); };
  // An item card: picture, name, rarity and bonus, where it goes on Chip, and one Equip / Take off button. The full
  // six-part code sits behind "Details".
  function itemCard(it, big) {
    const { h } = SVT.ui;
    const code = SVT.itemCode(it);
    const worn = SVT.vaultSlotOf(it.id);
    const fitsAny = SLOTS.some((sl) => SVT.vaultFits(it, sl.id));
    const slotOf = (id) => SLOTS.find((x) => x.id === id);
    const details = h("div", { class: "vault-details", hidden: !big },
      h("div", { class: "vault-code" }, code.map((t, i) => h("span", { class: "vault-code-seg c" + i, text: t }))),
      h("p", { class: "muted small vault-cat", text: CATS[SVT.itemCat(it)] + (SVT.itemCat(it) === "hand" || SVT.itemCat(it) === "floor" ? " (either side; pick the side on the Chip tab)" : "") }));
    const equip = h("button", { class: "btn small vault-equip" + (worn ? " off" : " fund-cta"), disabled: !worn && !fitsAny,
      onclick: () => { if (worn) SVT.vaultWear(null, it.id); else { const sl = SVT.vaultEquip(it.id); if (sl) SVT.ui.toast("🤖 Chip: " + sl.name + " → " + SVT.itemProduct(it)); } refresh(); },
      text: worn ? "Take off" : "Equip" });
    const more = big ? null : h("button", { class: "btn small ghost vault-choose", onclick: () => { details.hidden = !details.hidden; more.textContent = details.hidden ? "Details ▾" : "Details ▴"; }, text: "Details ▾" });
    return h("div", { class: "vault-card r-" + it.rarity + (big ? " big" : "") + (worn ? " wearing" : "") },
      SVT.itemArt(it),
      h("div", { class: "vault-card-body" },
        h("b", { class: "vault-card-name", text: SVT.itemName(it) }),
        h("span", { class: "vault-card-rar r-" + it.rarity, text: RAR[it.rar].name + (it.rar >= 4 ? " ★" : "") + " · " + boostText(it) }),
        h("span", { class: "vault-card-where", text: worn ? "🤖 On Chip: " + slotOf(worn).name.toLowerCase() : "Goes " + (SVT.itemCat(it) === "floor" ? "on the floor beside Chip" : SVT.itemCat(it) === "hand" ? "in a hand" : "on the " + SVT.itemCat(it)) }),
        h("div", { class: "vault-equip-row" }, equip, more),
        details));
  }

  // Chip tab: his six slots, each with its own inventory of the items that fit it. Tap a slot to see them, tap an item
  // to put it there. The total income bonus from everything he wears is shown at the top.
  function chipTab() {
    const { h } = SVT.ui;
    const v = S();
    const worn = SVT.vaultWorn();
    const total = SVT.vaultMult();
    const slotCard = (sl) => {
      const it = v.show[sl.id] ? SVT.vaultItem(v.show[sl.id]) : null, n = SVT.vaultEligible(sl.id).length;
      return h("button", { class: "vault-slotcard" + (slotPick === sl.id ? " on" : "") + (it ? " r-" + it.rarity : ""), "aria-label": sl.name, onclick: () => { slotPick = slotPick === sl.id ? null : sl.id; openVault(); } },
        it ? SVT.itemArt(it, "mini") : h("span", { class: "vault-slotcard-empty", text: sl.icon }),
        h("b", { text: sl.name }),
        h("small", { text: it ? boostText(it) : n + " fit" }));
    };
    let list = null;
    if (slotPick) {
      const sl = SLOTS.find((x) => x.id === slotPick), items = SVT.vaultEligible(slotPick), cur = v.show[slotPick];
      list = h("div", { class: "vault-shelf" },
        h("h3", { text: sl.icon + " " + sl.name + ": " + items.length + (items.length === 1 ? " item fits" : " items fit") }),
        cur ? h("button", { class: "btn small", onclick: () => { SVT.vaultWear(slotPick, null); refresh(); }, text: "Empty this slot" }) : null,
        items.length ? h("p", { class: "muted small", text: "Tap an item to put it here (rarest first)." }) : h("p", { class: "vault-empty", text: "Nothing you own goes here yet. " + fitHint(slotPick) }),
        items.map((it) => { const where = SVT.vaultSlotOf(it.id);
          return h("button", { class: "vault-pick r-" + it.rarity + (it.id === cur ? " on" : where ? " elsewhere" : ""), onclick: () => { if (it.id !== cur) { SVT.vaultWear(slotPick, it.id); refresh(); } } },
            SVT.itemArt(it, "mini"),
            h("span", { class: "vault-pick-body" }, h("b", { text: SVT.itemName(it) }), h("small", { class: "r-" + it.rarity, text: RAR[it.rar].name + " · " + boostText(it) + (it.id === cur ? " · here" : where ? " · on " + SLOTS.find((x) => x.id === where).name.toLowerCase() : "") })));
        }));
    }
    shell(h("div", { class: "vault-body" },
      h("div", { class: "vault-total" }, h("b", { text: "⚡ ×" + total + " lab income" }), h("small", { text: worn.length + " of " + SLOTS.length + " slots worn · bonuses add up, max ×" + V.MAX_BONUS + " · counts in Viking Raid too" })),
      h("button", { class: "btn boats-link", onclick: () => SVT.openBoats(), text: "⛵ Viking tokens 🛡 " + SVT.vikingTokens() + " · sailing " + SVT.BOATS[SVT.boatIndex() - 1].name + " ›" }),
      h("button", { class: "btn fund-cta vault-auto", disabled: !v.items.length, onclick: () => { const n = SVT.vaultAutoEquip(); SVT.ui.toast(n ? "🤖 Chip changed " + n + (n === 1 ? " slot" : " slots") + ": best bonus in every slot." : "🤖 Chip already wears the best of everything."); refresh(); }, text: "⚡ Auto-equip best" }),
      h("div", { class: "vault-slotgrid" }, SLOTS.map(slotCard)),
      list || h("p", { class: "muted small", text: "Tap a slot to see what fits it, rarest first. Items only go where they belong: hand-helds in a hand, watches on the wrist, headsets and AI on the head, neckwear round the neck, clothing on the body, shoes on the feet, and big things on the floor beside him." })));
  }
  const fitHint = (slot) => { const sl = SLOTS.find((x) => x.id === slot); return CATS[sl.cat] + ": roll more at a lab that makes that kind of thing."; };
  function reveal(it) {
    const { h, toast } = SVT.ui;
    busy = false;
    shell(h("div", { class: "vault-body vault-reveal r-" + it.rarity },
      h("p", { class: "vault-got", text: it.rar >= 5 ? "✨ MYTHIC! ✨" : it.rar === 4 ? "⭐ Legendary! ⭐" : it.rar === 3 ? "Epic!" : "You got…" }),
      itemCard(it, true),
      h("p", { class: "muted small", text: "One of a kind: nothing else in your Vault will ever share this look." })),
      h("div", { class: "vault-foot" }, h("button", { class: "btn fund-cta big", onclick: () => { tab = "roll"; openVault(); }, text: SVT.vaultCoins() ? "Roll again" : "Back to the Vault" })));
    if (it.rar >= 4) toast((it.rar >= 5 ? "✨ Mythic " : "⭐ Legendary ") + SVT.itemProduct(it) + "!", "big");
    if (SVT.render) SVT.render();
  }
  let mergePick = null; // { rar, ids } while the player is choosing three items to merge
  function mergeRow(m) {
    const { h, toast } = SVT.ui;
    const picking = mergePick && mergePick.rar === m.rar, ids = picking ? mergePick.ids : [];
    const done = (it) => { if (it) { toast("🔀 Merged into a " + RAR[it.rar].name + " " + SVT.itemProduct(it) + "!", "big"); mergePick = null; reveal(it); } };
    const chosen = ids.map((id) => m.items.find((it) => it.id === id)).filter(Boolean);
    // items of this rarity that are on Chip: shown locked so it is clear they never merge
    const onChip = S().items.filter((it) => it.rar === m.rar && SVT.vaultSlotOf(it.id)).sort((a, b) => b.boost - a.boost || b.id - a.id);
    return h("div", { class: "vault-merge r-" + RAR[m.rar].id },
      h("div", { class: "vault-merge-items" }, (picking ? chosen : m.items.slice(0, 3)).map((it) => SVT.itemArt(it, "mini"))),
      h("div", { class: "vault-merge-body" },
        h("b", { text: RAR[m.rar].name + " × " + m.count }),
        h("small", { text: (picking ? ids.length + " of 3 picked" : "Any 3") + " → 1 " + RAR[m.rar + 1].name + ", random item with a new look and bonus roll" + (onChip.length ? " · " + onChip.length + " on Chip stay safe" : "") })),
      h("div", { class: "vault-merge-btns" },
        picking
          ? h("button", { class: "btn small fund-cta", disabled: ids.length !== 3, onclick: () => done(SVT.vaultMerge(m.rar, ids)), text: "Merge these" })
          : h("button", { class: "btn small fund-cta", onclick: () => done(SVT.vaultMerge(m.rar)), text: "Merge 3 weakest" }),
        h("button", { class: "btn small ghost", onclick: () => { mergePick = picking ? null : { rar: m.rar, ids: [] }; gallery(); }, text: picking ? "Cancel" : "Pick 3" })),
      picking ? h("div", { class: "vault-merge-picks" }, m.items.slice().sort((a, b) => b.boost - a.boost || b.id - a.id).map((it) => {
        const on = ids.includes(it.id);
        return h("button", { class: "vault-pick r-" + it.rarity + (on ? " on" : ""), onclick: () => { if (on) mergePick.ids = ids.filter((x) => x !== it.id); else if (ids.length < 3) mergePick.ids = ids.concat(it.id); else return; gallery(); } },
          SVT.itemArt(it, "mini"),
          h("span", { class: "vault-pick-body" }, h("b", { text: SVT.itemName(it) }), h("small", { class: "r-" + it.rarity, text: boostText(it) + (on ? " · picked" : "") })));
      }).concat(onChip.map((it) => h("div", { class: "vault-pick onchip r-" + it.rarity, "aria-disabled": "true" },
        SVT.itemArt(it, "mini"),
        h("span", { class: "vault-pick-body" }, h("b", { text: SVT.itemName(it) }), h("small", { class: "r-" + it.rarity, text: "🔒 On Chip · take it off to merge" })))))) : null);
  }
  function gallery() {
    const { h } = SVT.ui;
    const v = S();
    const byLab = SVT.LABS.filter((l) => v.items.some((x) => x.lab === l.id));
    const merges = SVT.vaultMerges();
    shell(h("div", { class: "vault-body" },
      v.items.length ? null : h("p", { class: "vault-empty", text: "Nothing on the shelves yet. Roll a coin to get your first collectible." }),
      v.items.length ? h("div", { class: "vault-shelf" },
        h("h3", { text: "🔀 Merge (" + merges.length + ")" }),
        merges.length ? merges.map(mergeRow) : h("p", { class: "muted small", text: "Any three items of the same rarity merge into one of the next rarity: a random item from one of their labs. Items on Chip don't count: take them off first." })) : null,
      byLab.map((l) => h("div", { class: "vault-shelf" },
        h("h3", { text: l.icon + " " + l.name }),
        v.items.filter((x) => x.lab === l.id).sort((a, b) => b.rar - a.rar || b.id - a.id).map((x) => itemCard(x))))));
  }

  // Trophies: every lab beaten (with how often and its coins), the inventory totals by rarity, and Chip's slots.
  function trophies() {
    const { h } = SVT.ui;
    const v = S(), beaten = SVT.LABS.filter((l) => SVT.labDone(l.id));
    const counts = RAR.map((r) => v.items.filter((x) => x.rarity === r.id).length);
    shell(h("div", { class: "vault-body" },
      h("h3", { class: "vault-h", text: "🏆 Trophies (" + beaten.length + " of " + SVT.LABS.length + " labs)" }),
      beaten.length
        ? h("div", { class: "vault-labs" }, beaten.map((l) => h("div", { class: "vault-lab trophy" },
          h("span", { text: l.icon + " " + l.name }),
          h("b", { text: "🏆 ×" + v.beats[l.id] + " · 🪙 " + (v.coins[l.id] || 0) + " · " + v.items.filter((x) => x.lab === l.id).length + " items" }))))
        : h("p", { class: "vault-empty", text: "No trophies yet. Raise a lab's IPO to beat it." }),
      h("h3", { class: "vault-h", text: "📦 Inventory (" + v.items.length + " items)" }),
      h("div", { class: "vault-odds" }, RAR.map((r, i) => h("div", { class: "vault-odd r-" + r.id }, h("b", { text: r.name }), h("span", { text: String(counts[i]) })))),
      h("p", { class: "muted small", text: v.spent + " coins spent so far · " + v.pity + " since your last Legendary." }),
      h("button", { class: "btn", onclick: () => { tab = "chip"; slotPick = null; openVault(); }, text: "🤖 Chip's slots · ⚡ ×" + SVT.vaultMult() })));
  }

  SVT.openVault = () => { tab = "roll"; openVault(); };
  SVT.openGallery = () => { tab = "gallery"; openVault(); };
  SVT.openChip = (slot) => { tab = "chip"; slotPick = slot || null; openVault(); };
  SVT.openMerge = () => { tab = "gallery"; openVault(); };
  SVT.closeVault = close;
  SVT.VAULT_DATA = { COLORS, FINISHES, SIZES, MODS, SIGNATURE };
})();
