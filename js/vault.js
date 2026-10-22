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
  // Emoji for the product picture, by keyword in its name.
  const ICONS = [["phone", "📱"], ["console", "🎮"], ["handheld", "🎮"], ["game", "🕹️"], ["laptop", "💻"], ["computer", "💻"], ["pc", "🖥️"], ["monitor", "🖥️"],
    ["tablet", "📱"], ["watch", "⌚"], ["camera", "📷"], ["drone", "🚁"], ["robot", "🤖"], ["headset", "🎧"], ["headphones", "🎧"], ["earbuds", "🎧"], ["speaker", "🔊"],
    ["radio", "📻"], ["printer", "🖨️"], ["calculator", "🧮"], ["keyboard", "⌨️"], ["mouse", "🖱️"], ["car", "🚗"], ["rocket", "🚀"], ["satellite", "🛰️"],
    ["server", "🗄️"], ["drive", "💽"], ["disk", "💾"], ["battery", "🔋"], ["chip", "🔬"], ["ai ", "🧠"], ["ai", "🧠"], ["light", "💡"], ["led", "💡"], ["tv", "📺"],
    ["projector", "📽️"], ["film", "🎬", ], ["mic", "🎤"], ["synth", "🎹"], ["piano", "🎹"], ["guitar", "🎸"], ["bike", "🚲"], ["scooter", "🛴"], ["boat", "🚤"], ["ship", "🚢"],
    ["telescope", "🔭"], ["mp3", "🎵"], ["player", "🎵"], ["organizer", "📟"], ["pager", "📟"], ["meter", "📟"], ["modem", "📡"], ["router", "📡"], ["antenna", "📡"], ["sensor", "📡"], ["kit", "🧰"], ["machine", "⚙️"], ["engine", "⚙️"], ["lens", "👓"], ["glasses", "👓"], ["ring", "💍"], ["shoe", "👟"], ["sneaker", "👟"], ["jacket", "🧥"], ["cabinet", "🕹️"], ["microscope", "🔬"], ["heart", "❤️"], ["pump", "💉"], ["scanner", "🩻"], ["seed", "🌱"], ["farm", "🌾"], ["fish", "🐟"], ["plane", "✈️"], ["glider", "🛩️"]];
  SVT.productIcon = (name) => { const n = name.toLowerCase(); const hit = ICONS.find(([k]) => n.includes(k)); return hit ? hit[1] : "🔌"; };

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
    if (!V.ODDS[coins] || (v.coins[labId] || 0) < coins) return null;
    const def = SVT.LABS.find((l) => l.id === labId);
    if (!def) return null;
    v.coins[labId] -= coins;
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
    v.items.push(item);
    // The first items go straight onto Chip, into the first free slot.
    const free = SLOTS.find((sl) => !v.show[sl.id] && SVT.vaultFits(item, sl.id));
    if (free) v.show[free.id] = item.id;
    SVT.save();
    return item;
  };
  SVT.vaultItem = (id) => S().items.find((x) => x.id === id) || null;
  // Chip's slots: an item sits in at most one slot. SVT.vaultWear(slot, id) puts it there (id null clears the slot).
  const SLOTS = [
    { id: "hand_l", name: "Left hand", icon: "🤚" }, { id: "hand_r", name: "Right hand", icon: "✋" }, { id: "hat", name: "Hat", icon: "🎩" },
    { id: "neck", name: "Neck", icon: "📿" }, { id: "floor_l", name: "Floor left", icon: "⬅️" }, { id: "floor_r", name: "Floor right", icon: "➡️" },
  ];
  SVT.VAULT_SLOTS = SLOTS;
  // Where an item can go depends on its size: small things fit in a hand, on the head or round the neck; standard
  // and jumbo things in a hand or on the floor; desk and giant things on the floor only. Wearables (watches,
  // headsets, glasses, rings, necklaces...) also fit the hat or neck slot whatever their size.
  const WEARABLE = ["watch", "headset", "headphones", "earbuds", "glasses", "goggles", "ring", "necklace", "beanie", "hat", "helmet", "band", "badge", "pager", "earpiece", "tag", "visor", "crown", "hoodie", "jacket", "vest"];
  const SLOT_FIT = [["hand_l", "hand_r", "hat", "neck"], ["hand_l", "hand_r", "hat", "neck"], ["hand_l", "hand_r", "floor_l", "floor_r"], ["hand_l", "hand_r", "floor_l", "floor_r"], ["floor_l", "floor_r"], ["floor_l", "floor_r"]];
  SVT.vaultFits = (it, slot) => {
    if (SLOT_FIT[it.size].includes(slot)) return true;
    const n = SVT.itemProduct(it).toLowerCase();
    return (slot === "hat" || slot === "neck") && WEARABLE.some((w) => n.includes(w));
  };
  SVT.vaultWear = (slot, id) => {
    const v = S();
    for (const k in v.show) if (v.show[k] === id) delete v.show[k];
    if (id && SVT.vaultFits(SVT.vaultItem(id), slot)) v.show[slot] = id;
    SVT.save();
  };
  SVT.vaultSlotOf = (id) => Object.keys(S().show).find((k) => S().show[k] === id) || null;
  SVT.vaultWorn = () => SLOTS.map((sl) => ({ slot: sl, item: S().show[sl.id] ? SVT.vaultItem(S().show[sl.id]) : null })).filter((x) => x.item);

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
      h("span", { class: "vault-art-dev" }, h("span", { class: "vault-art-ic", text: SVT.productIcon(SVT.itemProduct(it)) })),
      h("span", { class: "vault-art-rar", text: RAR[it.rar].name }));
  };

  // ---------- UI ----------
  let box = null, busy = false, labPick = null, stake = 1, tab = "roll";
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
        h("button", { class: "vault-tab" + (tab === "gallery" ? " on" : ""), onclick: () => { tab = "gallery"; openVault(); }, text: "Gallery (" + S().items.length + ")" })),
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
    const labs = SVT.LABS.filter((l) => (v.coins[l.id] || 0) > 0);
    if (!labs.find((l) => l.id === labPick)) labPick = labs.length ? labs[0].id : null;
    const have = labPick ? v.coins[labPick] : 0;
    if (!V.STAKES.includes(stake) || stake > have) stake = V.STAKES.filter((s) => s <= have).pop() || 1;
    const pityLeft = Math.max(0, V.PITY.HARD - v.pity);
    const body = h("div", { class: "vault-body" },
      h("p", { class: "vault-lede", text: "Beat a lab to earn its coin. A coin rolls one of that lab's 30 products as a one-of-a-kind collectible: product, rarity, color, finish, size and mods. Put more coins into one roll for better odds." }),
      labs.length
        ? h("div", { class: "vault-labs" }, labs.map((l) => h("button", { class: "vault-lab" + (l.id === labPick ? " on" : ""), onclick: () => { labPick = l.id; openVault(); } },
          h("span", { text: l.icon + " " + l.name }), h("b", { text: "🪙 " + v.coins[l.id] }))))
        : h("p", { class: "vault-empty", text: "No coins yet. Raise a lab's IPO to earn its coin, then replay a beaten lab from the map for another." }),
      labPick ? h("div", { class: "vault-stakes" }, V.STAKES.map((s) => h("button", { class: "vault-stake" + (s === stake ? " on" : ""), disabled: s > have, onclick: () => { stake = s; openVault(); } }, h("b", { text: "🪙 " + s }), h("small", { text: s === 1 ? "1 coin" : s + " coins" })))) : null,
      labPick ? oddsTable(stake) : oddsTable(1),
      h("p", { class: "muted small", text: v.pity >= V.PITY.SOFT ? "🔥 Pity: " + v.pity + " coins since your last Legendary. Legendary or better is guaranteed within " + pityLeft + " more." : "Pity: a Legendary or better is guaranteed within " + pityLeft + " coins (" + v.pity + " spent since your last one)." + (v.serial === 0 ? " Your first roll is at least Rare." : "") }));
    const roll = h("button", { class: "btn fund-cta big vault-roll", disabled: !labPick || have < stake, onclick: () => doRoll(labPick, stake), text: labPick ? "Roll " + stake + (stake === 1 ? " coin" : " coins") : "No coins to roll" });
    shell(body, h("div", { class: "vault-foot" }, roll));
  }

  // The roll: six segments spin like a slot machine and lock in one by one, then the item card.
  function doRoll(labId, coins) {
    const { h } = SVT.ui;
    if (busy) return;
    const it = SVT.vaultRoll(labId, coins);
    if (!it) return;
    busy = true;
    const def = SVT.LABS.find((l) => l.id === labId);
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

  function itemCard(it, big) {
    const { h } = SVT.ui;
    const code = SVT.itemCode(it);
    const worn = SVT.vaultSlotOf(it.id);
    // Slot picker: tap a slot to put the item on Chip there; tap the slot it is in to take it off.
    const slots = h("div", { class: "vault-slots" }, SLOTS.map((sl) => {
      const mine = worn === sl.id, taken = !mine && !!S().show[sl.id], fits = SVT.vaultFits(it, sl.id);
      return h("button", { class: "vault-slot" + (mine ? " on" : !fits ? " nofit" : taken ? " taken" : ""), disabled: !fits, "aria-label": sl.name + (mine ? ", wearing this" : !fits ? ", does not fit" : taken ? ", holds another item" : ""), title: sl.name,
        onclick: () => { SVT.vaultWear(sl.id, mine ? null : it.id); if (SVT.render) SVT.render(); openVault(); } },
        h("span", { text: sl.icon }), h("small", { text: sl.name }));
    }));
    return h("div", { class: "vault-card r-" + it.rarity + (big ? " big" : "") },
      SVT.itemArt(it),
      h("div", { class: "vault-card-body" },
        h("b", { class: "vault-card-name", text: SVT.itemName(it) }),
        h("span", { class: "vault-card-rar r-" + it.rarity, text: RAR[it.rar].name + (it.rar >= 4 ? " ★" : "") }),
        h("div", { class: "vault-code" }, code.map((t, i) => h("span", { class: "vault-code-seg c" + i, text: t }))),
        h("p", { class: "muted small vault-wear-label", text: worn ? "Chip wears this: " + SLOTS.find((x) => x.id === worn).name : "Give it to Chip (" + SIZES[it.size][0].toLowerCase() + " size fits the lit slots):" }),
        slots));
  }
  function reveal(it) {
    const { h, toast } = SVT.ui;
    busy = false;
    shell(h("div", { class: "vault-body vault-reveal r-" + it.rarity },
      h("p", { class: "vault-got", text: it.rar >= 5 ? "✨ MYTHIC! ✨" : it.rar === 4 ? "⭐ Legendary! ⭐" : it.rar === 3 ? "Epic!" : "You got…" }),
      itemCard(it, true),
      h("p", { class: "muted small", text: "One of a kind: no other item in your Vault will ever share this look. DNA " + it.dna + "." })),
      h("div", { class: "vault-foot" }, h("button", { class: "btn fund-cta big", onclick: () => { tab = "roll"; openVault(); }, text: SVT.vaultCoins() ? "Roll again" : "Back to the Vault" })));
    if (it.rar >= 4) toast((it.rar >= 5 ? "✨ Mythic " : "⭐ Legendary ") + SVT.itemProduct(it) + "!", "big");
    if (SVT.render) SVT.render();
  }
  function gallery() {
    const { h } = SVT.ui;
    const v = S();
    const byLab = SVT.LABS.filter((l) => v.items.some((x) => x.lab === l.id));
    shell(h("div", { class: "vault-body" },
      v.items.length ? null : h("p", { class: "vault-empty", text: "Nothing on the shelves yet. Roll a coin to get your first collectible." }),
      byLab.map((l) => h("div", { class: "vault-shelf" },
        h("h3", { text: l.icon + " " + l.name }),
        v.items.filter((x) => x.lab === l.id).sort((a, b) => b.rar - a.rar || b.id - a.id).map((x) => itemCard(x))))));
  }

  SVT.openVault = () => { tab = "roll"; openVault(); };
  SVT.openGallery = () => { tab = "gallery"; openVault(); };
  SVT.closeVault = close;
  SVT.VAULT_DATA = { COLORS, FINISHES, SIZES, MODS, SIGNATURE };
})();
