// Viking Hoard (v0.35, user's ask): spend Viking tokens on a spin for one of 10,000 relics, each with its own rarity.
// A relic is one of the raid's 50 loot types in one of 10 materials with one of 20 epithets (50 x 10 x 20 = 10,000);
// a seeded shuffle hands every relic a fixed rarity (5,000 Common ... 20 Mythic). More tokens in one spin means better
// odds, Max spins until the tokens run out, and three relics of one rarity merge into one of the next. Tokens spent
// here still count for Chip's boats (boats go by tokens ever earned).
window.SVT = window.SVT || {};

(function () {
  const B = SVT.B, V = B.VAULT, RAR = V.RARITIES;
  const MATERIALS = [["Iron", "#6b7a8a"], ["Bronze", "#b5713a"], ["Oak", "#8a5a2b"], ["Bone", "#e8dcc2"], ["Amber", "#ff9f1c"],
    ["Silver", "#c9d3dc"], ["Jet", "#2b2b33"], ["Walrus ivory", "#f3ead6"], ["Gold", "#f2c230"], ["Dwarf-steel", "#4fa3ff"]];
  const EPITHETS = ["of the Fjord", "of the Storm", "of the Raven", "of the Wolf", "of the Long Winter", "of the Jarl", "of the Shield-wall",
    "of the Deep", "of the Mead Hall", "of the Northern Lights", "of the Whale Road", "of Frost", "of Embers", "of the Rune-smith",
    "of the Serpent", "of the Berserker", "of Thor", "of Freya", "of Odin", "of Valhalla"];
  const EMOJI = ["🪙", "📿", "🔩", "🪮", "🧥", "💍", "🧷", "🛢️", "🦷", "🔪", "🛡️", "🪓", "⛑️", "🧶", "🏹", "🗡️", "🪨", "💰", "📿", "⚔️",
    "🗡️", "🍺", "🐎", "🚢", "⛵", "👑", "🔨", "🪽", "🥚", "🐦‍⬛", "🔮", "🪨", "🫖", "🛢️", "🥾", "🎲", "🧵", "🍷", "🪙", "🐻",
    "🦅", "🦄", "🧵", "🚣", "💍", "🦷", "⛓️", "⚡", "🍃", "🗝️"];
  // Relics equipped on the longship (v0.36) boost Viking mine income by their rarity; the boosts add up, capped.
  const H = { N: 10000, PER_LOOT: 200, COUNTS: [5000, 2800, 1500, 550, 130, 20], STAKES: V.STAKES, ODDS: V.ODDS, PITY: V.PITY, FIRST_MIN: V.FIRST_ROLL_MIN, BULK_MAX: 100,
    SLOTS: 5, BONUS: V.BONUS.map((b) => b.mult), MAX_BONUS: V.MAX_BONUS };
  const rnd = () => Math.random();
  function mulberry(seed) { return function () { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // rarOf[id]: a seeded shuffle of the 10,000 ids, cut into the rarity counts, so every relic's rarity is fixed forever.
  const rarOf = new Uint8Array(H.N);
  (function () {
    const ids = Array.from({ length: H.N }, (_, i) => i), r = mulberry(1066);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    let k = 0;
    H.COUNTS.forEach((n, rar) => { for (let i = 0; i < n; i++) rarOf[ids[k++]] = rar; });
  })();
  const byRar = RAR.map((_, rar) => { const a = []; for (let id = 0; id < H.N; id++) if (rarOf[id] === rar) a.push(id); return a; });
  const loot = () => SVT.RAID.def(1).products;
  const S = () => { const st = SVT.state(); if (!st.hoard) st.hoard = { owned: {}, spent: 0, pity: 0, serial: 0, ship: [] }; if (!st.hoard.ship) st.hoard.ship = []; return st.hoard; };
  // ---------- longship: up to SLOTS equipped relics, each adding its rarity's bonus to Viking mine income ----------
  let shipMult = null;
  SVT.relicBonus = (id) => H.BONUS[rarOf[id]];
  SVT.hoardShip = () => { const h = S(); h.ship = h.ship.filter((id) => h.owned[id]); return h.ship.slice(); };
  SVT.hoardEquipped = (id) => S().ship.includes(id);
  SVT.hoardRecalc = () => { let x = 1; SVT.hoardShip().forEach((id) => { x += SVT.relicBonus(id) - 1; }); shipMult = Math.min(H.MAX_BONUS, Math.round(x * 100) / 100); return shipMult; };
  SVT.hoardMult = () => (shipMult === null ? SVT.hoardRecalc() : shipMult);
  SVT.hoardEquip = (id) => { const h = S(); if (!h.owned[id] || h.ship.includes(id) || SVT.hoardShip().length >= H.SLOTS) return false; h.ship.push(id); SVT.hoardRecalc(); SVT.save(); return true; };
  SVT.hoardUnequip = (id) => { const h = S(); h.ship = h.ship.filter((x) => x !== id); SVT.hoardRecalc(); SVT.save(); return true; };
  // Best 5: the rarest relics owned (newest first on a tie). Returns how many slots changed.
  SVT.hoardBest = () => { const h = S(), before = h.ship.join(); h.ship = SVT.hoardOwned().sort((a, b) => rarOf[b] - rarOf[a] || h.owned[b].n - h.owned[a].n).slice(0, H.SLOTS); SVT.hoardRecalc(); SVT.save(); return h.ship.join() !== before; };

  SVT.HOARD = H;
  SVT.relic = (id) => {
    const l = Math.floor(id / H.PER_LOOT), m = Math.floor((id % H.PER_LOOT) / EPITHETS.length), e = id % EPITHETS.length;
    return { id, loot: l, material: m, epithet: e, rar: rarOf[id], rarity: RAR[rarOf[id]].id, name: MATERIALS[m][0] + " " + loot()[l].toLowerCase() + " " + EPITHETS[e], color: MATERIALS[m][1], emoji: EMOJI[l] };
  };
  SVT.relicRar = (id) => rarOf[id];
  SVT.hoardOwned = () => Object.keys(S().owned).map(Number);
  SVT.hoardHas = (id) => !!S().owned[id];
  SVT.hoardCount = (rar) => (rar === undefined ? SVT.hoardOwned().length : byRar[rar].filter((id) => S().owned[id]).length);
  SVT.hoardTotal = (rar) => (rar === undefined ? H.N : H.COUNTS[rar]);
  // Tokens: earned ever (boats) minus spent on spins.
  SVT.hoardTokens = () => Math.max(0, SVT.vikingTokens() - (S().spent || 0));
  SVT.hoardOdds = (stake, pity) => {
    pity = pity === undefined ? S().pity : pity;
    const base = H.ODDS[stake]; if (!base) return null;
    let p = base.slice(); const top = p[4] + p[5];
    if (pity + stake >= H.PITY.HARD) p = [0, 0, 0, 0, p[4] / top, p[5] / top];
    else if (pity >= H.PITY.SOFT) { const add = Math.min(1 - top, (pity - H.PITY.SOFT + 1) * H.PITY.SOFT_STEP), low = p[0] + p[1] + p[2] + p[3]; for (let i = 0; i < 4; i++) p[i] *= (low - add) / low; p[4] += add; }
    return p;
  };
  const rollRar = (stake, pity, r) => { const p = SVT.hoardOdds(stake, pity); let x = r === undefined ? rnd() : r; for (let i = 0; i < p.length; i++) { if (x < p[i]) return i; x -= p[i]; } return p.length - 1; };
  // A relic of this rarity you don't own yet; a full tier bumps up (then down) a tier. null when the hoard is complete.
  function unowned(rar) {
    const h = S();
    const order = [rar]; for (let d = 1; d < RAR.length; d++) { if (rar + d < RAR.length) order.push(rar + d); if (rar - d >= 0) order.push(rar - d); }
    for (const r of order) { const free = byRar[r].filter((id) => !h.owned[id]); if (free.length) return free[Math.floor(rnd() * free.length)]; }
    return null;
  }
  function give(id, stake, from) {
    const h = S();
    h.owned[id] = { n: ++h.serial, at: Date.now(), stake, from: from || "spin" };
    return Object.assign(SVT.relic(id), { n: h.owned[id].n, new: true });
  }
  // One spin: spends `stake` tokens. Returns the relic (null if the tokens are not there or the hoard is complete).
  SVT.hoardSpin = (stake) => {
    const h = S();
    if (!H.ODDS[stake] || SVT.hoardTokens() < stake) return null;
    let rar = rollRar(stake, h.pity);
    if (h.serial === 0) rar = Math.max(rar, H.FIRST_MIN);
    const id = unowned(rar);
    if (id === null) return null;
    h.spent = (h.spent || 0) + stake;
    h.pity = rarOf[id] >= 4 ? 0 : h.pity + stake;
    const it = give(id, stake);
    SVT.save();
    return it;
  };
  SVT.hoardMaxSpins = (stake, limit) => Math.min(limit || H.BULK_MAX, Math.floor(SVT.hoardTokens() / stake), H.N - SVT.hoardCount());
  SVT.hoardSpinMany = (stake, limit) => { const out = []; limit = limit || H.BULK_MAX; while (out.length < limit) { const it = SVT.hoardSpin(stake); if (!it) break; out.push(it); } return out; };
  // Merging: any three relics of one rarity become one unowned relic of the next (Mythic is the top).
  SVT.hoardMerges = () => RAR.map((_, rar) => ({ rar, ids: byRar[rar].filter((id) => S().owned[id] && !S().ship.includes(id)).sort((a, b) => S().owned[a].n - S().owned[b].n) }))
    .filter((g) => g.rar < RAR.length - 1 && g.ids.length >= 3).sort((a, b) => b.rar - a.rar);
  SVT.hoardMerge = (rar, ids) => {
    const h = S(), g = SVT.hoardMerges().find((m) => m.rar === rar);
    if (!g) return null;
    const used = ids ? ids.filter((id) => g.ids.includes(id)) : g.ids.slice(0, 3);
    if (used.length !== 3 || new Set(used).size !== 3) return null;
    const id = unowned(rar + 1);
    if (id === null || rarOf[id] <= rar) return null;
    used.forEach((u) => delete h.owned[u]);
    const it = give(id, 0, "merge");
    it.merged = used;
    SVT.save();
    return it;
  };

  // ---------- panel ----------
  // Three tabs that read as three steps: Spin (tokens -> relics), Relics (what you own, equip or forge) and
  // Longship (the five equipped relics and the Viking income bonus they add up to).
  let box = null, busy = false, tab = "spin", stake = 1, bulk = false, filter = null;
  function close() { if (box) box.remove(); box = null; busy = false; document.removeEventListener("keydown", onKey); }
  function onKey(e) { if (e.key === "Escape") close(); }
  const pct = (x) => (x * 100 < 1 && x > 0 ? (x * 100).toFixed(1) : Math.round(x * 100)) + "%";
  const multText = (m) => "⚡ ×" + m + " Viking income";
  function shell(...kids) {
    const { h } = SVT.ui;
    if (box) box.remove();
    box = h("div", { class: "vault hoard", id: "hoard", role: "dialog", "aria-label": "Viking Hoard" },
      h("div", { class: "vault-head" },
        h("span", { class: "vault-logo", "aria-hidden": "true", text: "🛡" }),
        h("h2", { text: "Viking Hoard" }),
        h("span", { class: "vault-coins hoard-coins", text: "🛡 " + SVT.hoardTokens() }),
        h("button", { class: "x-btn", "aria-label": "Close", onclick: close, text: "✕" })),
      h("div", { class: "vault-tabs" },
        h("button", { class: "vault-tab" + (tab === "spin" ? " on" : ""), onclick: () => { tab = "spin"; open(); }, text: "1. Spin" }),
        h("button", { class: "vault-tab" + (tab === "hoard" ? " on" : ""), onclick: () => { tab = "hoard"; open(); }, text: "2. Relics (" + SVT.hoardCount() + ")" }),
        h("button", { class: "vault-tab" + (tab === "ship" ? " on" : ""), onclick: () => { tab = "ship"; open(); }, text: "3. Longship ⚡×" + SVT.hoardMult() })),
      ...kids);
    document.body.append(box);
    document.addEventListener("keydown", onKey);
  }
  const refresh = () => { if (SVT.render) SVT.render(); open(); };
  function card(it, big) {
    const { h, toast } = SVT.ui;
    const on = SVT.hoardEquipped(it.id), full = !on && SVT.hoardShip().length >= H.SLOTS;
    const equip = h("button", { class: "btn small hoard-equip" + (on ? " off" : " fund-cta"),
      onclick: () => { if (on) { SVT.hoardUnequip(it.id); toast("⛵ " + it.name + " taken off the longship"); } else if (full) { toast("⛵ The longship is full (" + H.SLOTS + " relics). Take one off on the Longship tab."); return; } else { SVT.hoardEquip(it.id); toast("⛵ " + it.name + " is on the longship: " + multText(SVT.hoardMult())); } refresh(); },
      text: on ? "Take off" : full ? "Ship full" : "Equip" });
    return h("div", { class: "vault-card hoard-card r-" + it.rarity + (big ? " big" : "") + (it.new ? " new" : "") + (on ? " onship" : "") },
      h("div", { class: "vault-art hoard-art", style: "--mat:" + it.color }, h("span", { class: "hoard-emoji", "aria-hidden": "true", text: it.emoji }), h("span", { class: "vault-art-rar", text: RAR[it.rar].name })),
      h("div", { class: "vault-card-body" },
        h("b", { class: "vault-card-name", text: it.name }),
        h("span", { class: "vault-card-rar r-" + it.rarity, text: RAR[it.rar].name + (it.rar >= 4 ? " ★" : "") + " · " + multText(SVT.relicBonus(it.id)) }),
        h("span", { class: "vault-card-where", text: on ? "⛵ On the longship" : "Equip it to add its bonus" + (it.merged ? " · forged from 3 " + RAR[it.rar - 1].name : "") }),
        h("div", { class: "vault-equip-row" }, equip, h("span", { class: "muted small", text: "#" + String(it.id + 1).padStart(5, "0") + " of " + H.N }))));
  }
  function steps(on) {
    const { h } = SVT.ui;
    const step = (n, icon, title, text) => h("div", { class: "hoard-step" + (on === n ? " on" : "") }, h("span", { class: "hoard-step-n", text: n }), h("div", null, h("b", { text: icon + " " + title }), h("span", { text: text })));
    return h("div", { class: "hoard-steps" },
      step(1, "🛡", "Tokens → spin", "Clearing a Viking mine pays tokens. A spin turns tokens into a relic."),
      step(2, "📿", "Relics", "10,000 relics, each with a fixed rarity. Three of one rarity forge into one better."),
      step(3, "⛵", "Longship", "Equip up to " + H.SLOTS + " relics. Their bonuses add up and speed up every Viking mine."));
  }
  function spinTab() {
    const { h } = SVT.ui, hd = S(), have = SVT.hoardTokens();
    if (!H.STAKES.includes(stake) || stake > have) stake = H.STAKES.filter((s) => s <= have).pop() || 1;
    const many = SVT.hoardMaxSpins(stake), p = SVT.hoardOdds(stake), pityLeft = Math.max(0, H.PITY.HARD - hd.pity);
    const body = h("div", { class: "vault-body" },
      steps(1),
      have ? h("p", { class: "vault-lede", text: "You have 🛡 " + have + (have === 1 ? " token" : " tokens") + ". More tokens in one spin means better odds." }) : h("p", { class: "vault-empty", text: "No tokens to spin. Clear a Viking mine for 1 to 5 tokens (a replay pays 1)." }),
      h("div", { class: "vault-stakes" }, H.STAKES.map((s) => h("button", { class: "vault-stake" + (s === stake ? " on" : ""), disabled: s > have, onclick: () => { stake = s; open(); } }, h("b", { text: "🛡 " + s }), h("small", { text: s === 1 ? "1 token" : s + " tokens" })))),
      h("button", { class: "vault-bulk" + (bulk ? " on" : ""), "aria-pressed": bulk ? "true" : "false", onclick: () => { bulk = !bulk; open(); } },
        h("b", { text: bulk ? "🔁 Max: on" : "🔁 Max" }), h("span", { text: bulk ? "Spins " + many + "× " + stake + (stake === 1 ? " token" : " tokens") + " in one go" + (many >= H.BULK_MAX ? " (" + H.BULK_MAX + " per press)" : "") : "Spin until the tokens run out" })),
      h("p", { class: "muted small hoard-odds-title", text: "Odds for a " + stake + "-token spin:" }),
      h("div", { class: "vault-odds" }, RAR.map((r, i) => h("div", { class: "vault-odd r-" + r.id }, h("b", { text: r.name }), h("span", { text: pct(p[i]) })))),
      h("p", { class: "muted small", text: (hd.pity >= H.PITY.SOFT ? "🔥 " : "") + "Legendary or better guaranteed within " + pityLeft + " more " + (pityLeft === 1 ? "token" : "tokens") + "." + (hd.serial === 0 ? " Your first spin is at least Rare." : "") }));
    const go = h("button", { class: "btn fund-cta big vault-roll hoard-spin", disabled: have < stake || !many, onclick: () => (bulk ? spinMany(stake) : spinOne(stake)),
      text: !have ? "No tokens to spin" : bulk ? "Spin Max · " + many + " × " + stake + (stake === 1 ? " token" : " tokens") : "Spin " + stake + (stake === 1 ? " token" : " tokens") });
    shell(body, h("div", { class: "vault-foot" }, go));
  }
  function spinOne(s) {
    const { h } = SVT.ui;
    if (busy) return;
    const it = SVT.hoardSpin(s);
    if (!it) return;
    busy = true;
    const finals = [MATERIALS[it.material][0], loot()[it.loot], EPITHETS[it.epithet], RAR[it.rar].name];
    const pools = [MATERIALS.map((m) => m[0]), loot(), EPITHETS, RAR.map((r) => r.name)];
    const segs = finals.map((t, i) => h("div", { class: "vault-seg", "data-i": i + 2 }, h("span", { text: pools[i][0] })));
    const stage = h("div", { class: "vault-spin" }, segs.flatMap((sg, i) => (i ? [h("span", { class: "vault-star", text: "ᛟ" }), sg] : [sg])));
    shell(h("div", { class: "vault-body vault-rolling" }, h("p", { class: "vault-lede", text: "The runes are cast…" }), stage));
    let locked = 0;
    const spin = setInterval(() => segs.forEach((sg, i) => { if (i >= locked) sg.firstChild.textContent = pools[i][Math.floor(rnd() * pools[i].length)]; }), 70);
    const lock = () => {
      if (!box || !box.contains(stage)) { clearInterval(spin); busy = false; return; }
      const sg = segs[locked]; sg.firstChild.textContent = finals[locked]; sg.classList.add("lock");
      if (locked === 3) { sg.classList.add("r-" + it.rarity); stage.classList.add("r-" + it.rarity); }
      if (navigator.vibrate) navigator.vibrate(20);
      locked++;
      if (locked < segs.length) setTimeout(lock, locked === 3 ? 900 : 550); else { clearInterval(spin); setTimeout(() => reveal([it]), 600); }
    };
    setTimeout(lock, 700);
  }
  function spinMany(s) {
    const { h } = SVT.ui;
    if (busy) return;
    const items = SVT.hoardSpinMany(s);
    if (!items.length) return;
    busy = true;
    const pools = [MATERIALS.map((m) => m[0]), loot(), EPITHETS];
    const segs = pools.map((p, i) => h("div", { class: "vault-seg", "data-i": i + 2 }, h("span", { text: p[0] })));
    const stage = h("div", { class: "vault-spin" }, segs);
    shell(h("div", { class: "vault-body vault-rolling" }, h("p", { class: "vault-lede", text: "Casting the runes " + items.length + " times…" }), stage));
    const spin = setInterval(() => segs.forEach((sg, i) => { sg.firstChild.textContent = pools[i][Math.floor(rnd() * pools[i].length)]; }), 70);
    setTimeout(() => { clearInterval(spin); if (box && box.contains(stage)) reveal(items); else busy = false; }, 1400);
  }
  function reveal(items) {
    const { h, toast } = SVT.ui;
    busy = false;
    const sorted = items.slice().sort((a, b) => b.rar - a.rar || b.n - a.n), best = sorted[0];
    const tally = RAR.map((r, i) => items.filter((it) => it.rar === i).length), one = items.length === 1;
    const room = H.SLOTS - SVT.hoardShip().length;
    shell(h("div", { class: "vault-body vault-reveal r-" + best.rarity },
      h("p", { class: "vault-got", text: tally[5] ? "✨ " + (one ? "" : tally[5] + " ") + "MYTHIC! ✨" : tally[4] ? "⭐ " + (one ? "" : tally[4] + " ") + "Legendary! ⭐" : one ? (best.rar === 3 ? "Epic!" : "The runes say…") : items.length + " new relics" }),
      one ? null : h("div", { class: "vault-tally" }, RAR.map((r, i) => tally[i] ? h("span", { class: "vault-tally-pill r-" + r.id, text: tally[i] + " " + r.name }) : null)),
      one ? card(best, true) : h("div", { class: "vault-haul" }, sorted.map((it) => card(it, false))),
      h("p", { class: "muted small", text: room > 0 ? "Tap Equip to put a relic on the longship (" + room + (room === 1 ? " free slot" : " free slots") + ") and speed up the Viking mines." : "The longship is full: swap relics on the Longship tab, or let Best 5 pick the rarest." })),
      h("div", { class: "vault-foot" },
        h("button", { class: "btn fund-cta big", onclick: () => { SVT.hoardBest(); toast("⛵ Best 5 on the longship: " + multText(SVT.hoardMult())); tab = "ship"; refresh(); }, text: "⛵ Equip best 5 → ×" + bestMult() }),
        h("button", { class: "btn big", onclick: () => { tab = "spin"; open(); }, text: SVT.hoardTokens() ? "Spin again" : "Back" })));
    if (tally[4] + tally[5]) toast((tally[5] ? "✨ " + tally[5] + " Mythic" : "") + (tally[5] && tally[4] ? ", " : "") + (tally[4] ? "⭐ " + tally[4] + " Legendary" : "") + " relic" + (tally[4] + tally[5] > 1 ? "s" : "") + "!", "big");
    if (SVT.render) SVT.render();
  }
  function bestMult() { const h = S(); let x = 1; SVT.hoardOwned().sort((a, b) => rarOf[b] - rarOf[a]).slice(0, H.SLOTS).forEach((id) => { x += H.BONUS[rarOf[id]] - 1; }); return Math.min(H.MAX_BONUS, Math.round(x * 100) / 100); }
  function hoardTab() {
    const { h, toast } = SVT.ui, groups = SVT.hoardMerges();
    const owned = SVT.hoardOwned().filter((id) => filter === null || rarOf[id] === filter).map((id) => Object.assign(SVT.relic(id), { n: S().owned[id].n, merged: S().owned[id].from === "merge" ? true : null }))
      .sort((a, b) => (SVT.hoardEquipped(b.id) ? 1 : 0) - (SVT.hoardEquipped(a.id) ? 1 : 0) || b.rar - a.rar || b.n - a.n);
    const MAX = 150;
    shell(h("div", { class: "vault-body" },
      steps(2),
      h("div", { class: "hoard-shipbar" },
        h("span", { text: "⛵ Longship: " + SVT.hoardShip().length + " of " + H.SLOTS + " relics · " + multText(SVT.hoardMult()) }),
        SVT.hoardCount() ? h("button", { class: "btn small fund-cta", onclick: () => { SVT.hoardBest(); toast("⛵ Best 5 on the longship: " + multText(SVT.hoardMult())); refresh(); }, text: "Equip best 5" }) : null),
      groups.length ? h("div", { class: "hoard-forge" },
        h("b", { text: "⚒️ Forge: 3 of a kind → 1 of the next rarity" }),
        groups.map((g) => h("div", { class: "hoard-merge-row r-" + RAR[g.rar].id },
          h("div", null, h("b", { text: g.ids.length + " " + RAR[g.rar].name }), h("span", { class: "muted small", text: " → " + RAR[g.rar + 1].name + " (3 each)" })),
          h("div", { class: "hoard-merge-btns" },
            h("button", { class: "btn small fund-cta", onclick: () => { const it = SVT.hoardMerge(g.rar); if (it) reveal([it]); }, text: "Forge 1" }),
            g.ids.length >= 6 ? h("button", { class: "btn small", onclick: () => { const out = []; for (let i = 0; i < Math.floor(g.ids.length / 3) && out.length < H.BULK_MAX; i++) { const it = SVT.hoardMerge(g.rar); if (!it) break; out.push(it); } if (out.length) reveal(out); }, text: "Forge all (" + Math.floor(g.ids.length / 3) + ")" }) : null)))) : null,
      h("div", { class: "hoard-tally" }, RAR.map((r, i) => h("button", { class: "vault-tally-pill hoard-filter r-" + r.id + (filter === i ? " on" : ""), onclick: () => { filter = filter === i ? null : i; open(); }, text: SVT.hoardCount(i) + "/" + H.COUNTS[i] + " " + r.name }))),
      owned.length ? h("div", { class: "vault-haul" }, owned.slice(0, MAX).map((it) => card(it, false))) : h("p", { class: "vault-empty", text: SVT.hoardCount() ? "No relics of that rarity yet." : "No relics yet. Spin for relics on the Spin tab." }),
      owned.length > MAX ? h("p", { class: "muted small", text: "Showing " + MAX + " of " + owned.length + " (equipped and rarest first)." }) : null));
  }
  function shipTab() {
    const { h, toast } = SVT.ui, ship = SVT.hoardShip();
    const slots = Array.from({ length: H.SLOTS }, (_, i) => {
      const id = ship[i];
      if (id === undefined) return h("div", { class: "hoard-slot empty" }, h("span", { class: "hoard-slot-n", text: "Slot " + (i + 1) }), h("span", { class: "muted small", text: "Empty. Tap Equip on a relic in the Relics tab." }));
      return card(Object.assign(SVT.relic(id), { n: S().owned[id].n }), false);
    });
    shell(h("div", { class: "vault-body" },
      steps(3),
      h("div", { class: "hoard-shipbar big" }, h("b", { text: multText(SVT.hoardMult()) }), h("span", { class: "muted small", text: ship.length ? "Every Viking mine digs, lifts and sells ×" + SVT.hoardMult() + " faster. Bonuses add up (Common ×" + H.BONUS[0] + " … Mythic ×" + H.BONUS[5] + "), up to ×" + H.MAX_BONUS + "." : "Nothing equipped yet. Each relic adds its rarity's bonus: Common ×" + H.BONUS[0] + ", Uncommon ×" + H.BONUS[1] + ", Rare ×" + H.BONUS[2] + ", Epic ×" + H.BONUS[3] + ", Legendary ×" + H.BONUS[4] + ", Mythic ×" + H.BONUS[5] + "." })),
      h("div", { class: "hoard-slotbtns" },
        SVT.hoardCount() ? h("button", { class: "btn small fund-cta", onclick: () => { SVT.hoardBest(); toast("⛵ Best 5 on the longship: " + multText(SVT.hoardMult())); refresh(); }, text: "Equip best 5 → ×" + bestMult() }) : null,
        ship.length ? h("button", { class: "btn small", onclick: () => { ship.forEach((id) => SVT.hoardUnequip(id)); refresh(); }, text: "Take all off" }) : null),
      h("div", { class: "vault-haul" }, slots)));
  }
  function open() { close(); if (tab === "hoard") hoardTab(); else if (tab === "ship" || tab === "merge") shipTab(); else spinTab(); }
  SVT.openHoard = (t) => { tab = t || "spin"; open(); };
  SVT.closeHoard = close;
})();
