// Viking boats (v0.33): the 50 boats Chip can sail on the home screen, unlocked with Viking tokens from the raid
// island. Drawn in code as SVG (like Chip himself), so every boat is sharp at any size and needs no image files.
// Each boat is a recipe: hull shape and colors, figurehead, sail pattern and emblem, shields, oars and pennant.
window.SVT = window.SVT || {};

(function () {
  // [name, kind, hull, trim, sail, pattern, sail2, shields, shieldA, shieldB, head, flag, emblem, note]
  // kind: raft | canoe | boat (sail) · pattern: plain | stripes | checks | diagonal | bands
  // head: none | curl | serpent | dragon | wolf | raven | ram | bear · emblem: none | sun | hammer | raven | axe | valknut | star | tree | eye | skull
  const B = [
    ["Driftwood Raft", "raft", "#a8743f", "#7a4d26", "", "plain", "", 0, "", "", "none", "#d7263d", "none", "A few logs and some rope. It floats, mostly."],
    ["Log Canoe", "canoe", "#8a5a32", "#5c3a1e", "", "plain", "", 0, "", "", "none", "#f0a500", "none", "Hollowed from a single oak."],
    ["Fishing Faering", "boat", "#b07a45", "#6b4325", "#f3ecd8", "plain", "", 0, "", "", "none", "#2f7fd6", "none", "Four oars and a patched sail."],
    ["Tar Skiff", "boat", "#3b2a1e", "#1f140c", "#d9b382", "plain", "", 0, "", "", "curl", "#d7263d", "none", "Black with pine tar, smells like it too."],
    ["Fjord Ferry", "boat", "#9c6b3c", "#5c3a1e", "#eaf4ff", "stripes", "#2f7fd6", 2, "#2f7fd6", "#f3ecd8", "curl", "#2f7fd6", "none", "Carries sheep across the fjord."],
    ["Trader's Byrding", "boat", "#a86a3a", "#6b4325", "#f6e6c4", "bands", "#c84646", 2, "#c84646", "#f6e6c4", "curl", "#c84646", "none", "A coastal hauler with a wide belly."],
    ["Salt Karvi", "boat", "#7d8e9d", "#4a5866", "#dfe7ee", "stripes", "#5d6d7e", 3, "#5d6d7e", "#dfe7ee", "ram", "#5d6d7e", "none", "Grey as the winter sea."],
    ["Amber Knarr", "boat", "#c48a3a", "#8a5a1e", "#ffe6a8", "plain", "", 3, "#ffb300", "#8a5a1e", "curl", "#ffb300", "sun", "Deep hold, full of amber."],
    ["Ember Snekkja", "boat", "#7a2e1e", "#4a1a10", "#ffd28a", "stripes", "#d7263d", 4, "#d7263d", "#ffd28a", "serpent", "#d7263d", "none", "Her sail glows like coals."],
    ["Mist Runner", "boat", "#6f8191", "#3f4f5c", "#eef3f7", "diagonal", "#9fb3c4", 4, "#9fb3c4", "#eef3f7", "serpent", "#9fb3c4", "none", "Slips through fog without a sound."],
    ["Wolf Skiff", "boat", "#5c4a3a", "#2f2419", "#d9d2c5", "checks", "#5c4a3a", 4, "#2f2419", "#d9d2c5", "wolf", "#2f2419", "none", "A wolf's head on a small prow."],
    ["Raven Karvi", "boat", "#2f3640", "#111318", "#cfd8e3", "plain", "", 5, "#111318", "#cfd8e3", "raven", "#111318", "raven", "Two ravens follow it everywhere."],
    ["Frost Byrding", "boat", "#8fb3c7", "#4f7a93", "#ffffff", "stripes", "#8fb3c7", 5, "#4f7a93", "#ffffff", "curl", "#4fa3ff", "none", "Ice on the oars by dawn."],
    ["Oak Heart", "boat", "#9c6b3c", "#5c3a1e", "#e6d2a8", "bands", "#1b7f4c", 5, "#1b7f4c", "#e6d2a8", "ram", "#1b7f4c", "tree", "Built from one great oak."],
    ["Storm Petrel", "boat", "#3a4a5c", "#1e2a36", "#bcd0e6", "diagonal", "#3a4a5c", 6, "#3a4a5c", "#bcd0e6", "serpent", "#2457d6", "none", "Flies before the gale."],
    ["Serpent of Vik", "boat", "#4a6b3a", "#2a4020", "#dbe8c8", "stripes", "#4a6b3a", 6, "#2a4020", "#dbe8c8", "serpent", "#9ccc1c", "none", "The first true longship."],
    ["Iron Jarl", "boat", "#55606b", "#2f3640", "#c7ced6", "checks", "#55606b", 7, "#2f3640", "#c7ced6", "wolf", "#5d6d7e", "axe", "Shields of beaten iron."],
    ["Bloodaxe", "boat", "#6b1e1e", "#3a0e0e", "#f2c4c4", "stripes", "#6b1e1e", 7, "#d7263d", "#f2c4c4", "dragon", "#d7263d", "axe", "No one asks about the name."],
    ["Thunder Skeid", "boat", "#2b2b6b", "#161640", "#dcd6ff", "diagonal", "#5b3fd6", 8, "#5b3fd6", "#dcd6ff", "dragon", "#5b3fd6", "hammer", "Forty oars and a hammer on the sail."],
    ["Sea Bear", "boat", "#6b4a2a", "#3a2614", "#e8dcc8", "plain", "", 8, "#3a2614", "#e8dcc8", "bear", "#8a5a32", "none", "Heavy, slow and unstoppable."],
    ["Gold Tooth", "boat", "#8a5a1e", "#4a2e0c", "#ffe36a", "bands", "#ffb300", 8, "#ffb300", "#4a2e0c", "dragon", "#ffb300", "sun", "Gilded teeth on the dragon."],
    ["Night Raven", "boat", "#1a1f2b", "#0b0e14", "#8a95a8", "stripes", "#1a1f2b", 9, "#0b0e14", "#8a95a8", "raven", "#111318", "raven", "Sails only after dark."],
    ["Whale Road", "boat", "#3f6f8a", "#224457", "#cfe6f2", "bands", "#3f6f8a", 9, "#224457", "#cfe6f2", "curl", "#17a2a8", "none", "Named for the open sea."],
    ["Rune Keel", "boat", "#7a5a3a", "#4a3420", "#efe3cf", "checks", "#7a5a3a", 10, "#c84646", "#efe3cf", "serpent", "#c84646", "valknut", "Runes carved along the keel."],
    ["Skull Drakkar", "boat", "#3a3a3a", "#141414", "#e0e0e0", "diagonal", "#3a3a3a", 10, "#141414", "#e0e0e0", "dragon", "#d7263d", "skull", "Grinning from the prow."],
    ["Elk Horn", "boat", "#8a6a4a", "#5a4230", "#f0e6d6", "stripes", "#8a6a4a", 10, "#5a4230", "#f0e6d6", "ram", "#9ccc1c", "none", "Antlers on every shield."],
    ["Hammerfall", "boat", "#4a4a5a", "#26263a", "#d6d6e8", "bands", "#5b3fd6", 11, "#5b3fd6", "#d6d6e8", "wolf", "#5b3fd6", "hammer", "Thor's hammer, twice the size."],
    ["Dragonfire", "boat", "#8a2a1a", "#4a120a", "#ffb37a", "diagonal", "#ff6f59", 11, "#ff6f59", "#ffb37a", "dragon", "#ff8c1a", "sun", "Red hull, orange sail, hot temper."],
    ["Ice Wyrm", "boat", "#9fcfe6", "#4f8fb0", "#ffffff", "stripes", "#9fcfe6", 12, "#4f8fb0", "#ffffff", "serpent", "#22d3ee", "star", "Frost on the sail, always."],
    ["Bone Crown", "boat", "#d9d2c5", "#8a8070", "#f7f2ea", "checks", "#d9d2c5", 12, "#8a8070", "#f7f2ea", "dragon", "#111318", "skull", "Bleached white from bow to stern."],
    ["Jarl's Pride", "boat", "#5a2a6b", "#331540", "#f0d6ff", "bands", "#8e44ad", 13, "#8e44ad", "#f0d6ff", "dragon", "#ffb300", "sun", "Purple sail: the jarl paid for it."],
    ["Storm Crow", "boat", "#2b3a4a", "#121a24", "#b8c6d6", "diagonal", "#2b3a4a", 13, "#121a24", "#b8c6d6", "raven", "#2457d6", "raven", "Crows ride the yard in a storm."],
    ["Fenrir", "boat", "#4a4a4a", "#1e1e1e", "#cfcfcf", "stripes", "#4a4a4a", 14, "#1e1e1e", "#cfcfcf", "wolf", "#5d6d7e", "eye", "The wolf that swallows the sun."],
    ["Sea Serpent", "boat", "#1b6f5c", "#0e3f34", "#c8f0e6", "bands", "#17a2a8", 14, "#0e3f34", "#c8f0e6", "serpent", "#2ecc71", "none", "Longer than any serpent should be."],
    ["Valkyrie", "boat", "#b0b8c8", "#6a7488", "#ffffff", "diagonal", "#4fa3ff", 15, "#4fa3ff", "#ffffff", "ram", "#4fa3ff", "star", "Silver wings on the prow."],
    ["Ash Spear", "boat", "#6b6b5a", "#3a3a2e", "#e6e6d6", "stripes", "#6b6b5a", 15, "#3a3a2e", "#e6e6d6", "serpent", "#9ccc1c", "axe", "Narrow as a spear, fast as one."],
    ["Troll Bane", "boat", "#3a5a2a", "#1e3014", "#d6e8c8", "checks", "#3a5a2a", 16, "#1e3014", "#d6e8c8", "bear", "#1b7f4c", "axe", "Trolls stay off the shore."],
    ["Gilded Prow", "boat", "#7a4a1a", "#4a2a0a", "#ffe9a8", "bands", "#ffb300", 16, "#ffb300", "#7a4a1a", "dragon", "#ffb300", "sun", "The prow alone cost a village."],
    ["Thunderhead", "boat", "#2a2a6b", "#121240", "#c8c8ff", "diagonal", "#5b3fd6", 17, "#5b3fd6", "#c8c8ff", "dragon", "#ffe600", "hammer", "Lightning struck it twice. It liked it."],
    ["Midnight Sun", "boat", "#1f2a44", "#0c1122", "#ffd27a", "plain", "", 17, "#ffb300", "#0c1122", "raven", "#ffb300", "sun", "Golden sail under a sky that never darkens."],
    ["Odin's Eye", "boat", "#4a3a5a", "#261c30", "#e6daf0", "stripes", "#4a3a5a", 18, "#261c30", "#e6daf0", "raven", "#8e44ad", "eye", "One eye on the sail, watching."],
    ["World Serpent", "boat", "#1e5a4a", "#0c2e26", "#b8e8d8", "bands", "#2ecc71", 18, "#0c2e26", "#b8e8d8", "serpent", "#2ecc71", "valknut", "Bites its own tail around the sea."],
    ["Great Bear", "boat", "#5a3a1e", "#2e1c0c", "#f0e0c8", "checks", "#5a3a1e", 19, "#2e1c0c", "#f0e0c8", "bear", "#8a5a32", "star", "Twenty-four oars a side."],
    ["Dragon Hoard", "boat", "#6b1e2e", "#3a0e18", "#ffd700", "diagonal", "#d7263d", 19, "#d7263d", "#ffd700", "dragon", "#ffd700", "sun", "Pays for itself. Every voyage."],
    ["Yggdrasil", "boat", "#3a5a3a", "#1c2e1c", "#e0f0d8", "bands", "#1b7f4c", 20, "#1b7f4c", "#e0f0d8", "ram", "#2ecc71", "tree", "The world tree on a green sail."],
    ["Golden Drakkar", "boat", "#c89a2a", "#8a5a1e", "#fff1c0", "stripes", "#ffb300", 20, "#ffb300", "#fff1c0", "dragon", "#ffb300", "sun", "Gold leaf on every plank.", true],
    ["Skidbladnir", "boat", "#2457d6", "#13307a", "#dce9ff", "diagonal", "#4fa3ff", 21, "#4fa3ff", "#dce9ff", "dragon", "#ffe600", "star", "Folds up to fit in a pocket. Allegedly.", true],
    ["Naglfar", "boat", "#3a3a40", "#141418", "#c8c8d0", "checks", "#3a3a40", 21, "#141418", "#c8c8d0", "skull", "#d7263d", "skull", "Built from the nails of the dead.", true],
    ["Hringhorni", "boat", "#b8c8d8", "#6a7a8a", "#ffffff", "bands", "#4fa3ff", 22, "#4fa3ff", "#ffffff", "ram", "#ffffff", "star", "The greatest ship ever launched.", true],
    ["Chip's Flagship", "boat", "#1b3f86", "#0c1f4a", "#a5f25a", "diagonal", "#ffe600", 23, "#ffe600", "#a5f25a", "dragon", "#a5f25a", "eye", "Fifty tokens' worth of boat. Skål, captain!", true],
  ];

  SVT.BOATS = B.map((b, i) => ({ k: i + 1, name: b[0], kind: b[1], note: b[13], glow: !!b[14] }));

  const esc = (s) => s;
  // Emblem painted on the sail, centered at (x, y), about r wide.
  function emblem(kind, x, y, r, c) {
    switch (kind) {
      case "sun": return `<circle cx="${x}" cy="${y}" r="${r * .55}" fill="${c}"/>` + Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<line x1="${x + Math.cos(a) * r * .7}" y1="${y + Math.sin(a) * r * .7}" x2="${x + Math.cos(a) * r}" y2="${y + Math.sin(a) * r}" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`; }).join("");
      case "hammer": return `<rect x="${x - r * .9}" y="${y - r * .7}" width="${r * 1.8}" height="${r * .8}" rx="4" fill="${c}"/><rect x="${x - r * .18}" y="${y - r * .1}" width="${r * .36}" height="${r * 1.2}" rx="3" fill="${c}"/>`;
      case "raven": return `<path d="M${x - r} ${y + r * .3} q ${r * .6} -${r * 1.1} ${r * 1.3} -${r * .7} l ${r * .5} -${r * .1} l -${r * .4} ${r * .3} q ${r * .2} ${r * .5} -${r * .3} ${r * .8} l ${r * .3} ${r * .4} l -${r * .7} -${r * .2} q -${r * .6} ${r * .1} -${r * .7} -${r * .5} z" fill="${c}"/>`;
      case "axe": return `<rect x="${x - 3}" y="${y - r}" width="6" height="${r * 2}" rx="3" fill="${c}"/><path d="M${x + 2} ${y - r * .8} q ${r * .9} ${r * .1} ${r * .9} ${r * .9} q -${r * .3} ${r * .6} -${r * .9} ${r * .7} z" fill="${c}"/>`;
      case "valknut": return [0, 1, 2].map((i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 3, cx = x + Math.cos(a) * r * .35, cy = y + Math.sin(a) * r * .35; return `<path d="M${cx} ${cy - r * .5} L${cx + r * .45} ${cy + r * .3} L${cx - r * .45} ${cy + r * .3} z" fill="none" stroke="${c}" stroke-width="4" stroke-linejoin="round"/>`; }).join("");
      case "star": return `<path d="${Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; return (i ? "L" : "M") + (x + Math.cos(a) * rr) + " " + (y + Math.sin(a) * rr); }).join(" ")} z" fill="${c}"/>`;
      case "tree": return `<rect x="${x - 3}" y="${y}" width="6" height="${r}" fill="${c}"/><path d="M${x} ${y - r} l ${r * .8} ${r * .9} h -${r * .45} l ${r * .55} ${r * .7} h -${r * 1.8} l ${r * .55} -${r * .7} h -${r * .45} z" fill="${c}"/>`;
      case "eye": return `<path d="M${x - r} ${y} q ${r} -${r * .9} ${r * 2} 0 q -${r} ${r * .9} -${r * 2} 0 z" fill="${c}"/><circle cx="${x}" cy="${y}" r="${r * .32}" fill="#fff"/><circle cx="${x}" cy="${y}" r="${r * .15}" fill="${c}"/>`;
      case "skull": return `<circle cx="${x}" cy="${y - r * .15}" r="${r * .7}" fill="${c}"/><rect x="${x - r * .4}" y="${y + r * .3}" width="${r * .8}" height="${r * .45}" rx="3" fill="${c}"/><circle cx="${x - r * .28}" cy="${y - r * .2}" r="${r * .17}" fill="#fff"/><circle cx="${x + r * .28}" cy="${y - r * .2}" r="${r * .17}" fill="#fff"/>`;
      default: return "";
    }
  }
  // Figurehead at the bow (bx, by): the neck rises from the gunwale and the head looks forward (right).
  function figurehead(kind, bx, by, c, trim) {
    const neck = `<path d="M${bx - 10} ${by + 16} Q ${bx + 2} ${by - 2} ${bx + 4} ${by - 22}" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"/>`;
    const eye = (x, y) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff"/><circle cx="${x + .6}" cy="${y}" r="1.3" fill="#111"/>`;
    switch (kind) {
      case "curl": return `<path d="M${bx - 8} ${by + 14} Q ${bx + 6} ${by - 10} ${bx - 4} ${by - 18} q -8 -4 -8 4 q 0 6 6 6" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>`;
      case "serpent": return neck + `<path d="M${bx - 4} ${by - 24} q 14 -10 24 -2 l -6 4 q -2 6 -8 6 q -8 0 -10 -8 z" fill="${c}"/>` + eye(bx + 8, by - 24);
      case "dragon": return neck + `<path d="M${bx - 8} ${by - 26} q 16 -14 32 -4 l -4 6 l 6 4 l -10 2 q -4 8 -14 6 q -12 -2 -10 -14 z" fill="${c}"/><path d="M${bx + 2} ${by - 34} l 4 -10 l 4 10 z M${bx + 12} ${by - 33} l 5 -9 l 3 10 z" fill="${trim}"/>` + eye(bx + 10, by - 27);
      case "wolf": return neck + `<path d="M${bx - 6} ${by - 26} q 14 -8 30 -4 l -4 8 l -14 4 q -12 2 -12 -8 z" fill="${c}"/><path d="M${bx - 2} ${by - 30} l 2 -12 l 8 10 z M${bx + 8} ${by - 32} l 4 -11 l 6 11 z" fill="${c}"/>` + eye(bx + 10, by - 27);
      case "raven": return neck + `<path d="M${bx - 4} ${by - 26} q 10 -10 20 -4 l 16 2 l -16 6 q -8 6 -18 2 z" fill="${c}"/>` + eye(bx + 8, by - 26);
      case "ram": return neck + `<path d="M${bx - 6} ${by - 24} q 12 -10 26 -2 l -6 6 q -8 4 -16 2 q -8 -2 -4 -6 z" fill="${c}"/><path d="M${bx} ${by - 26} a 8 8 0 1 1 10 -8" fill="none" stroke="${trim}" stroke-width="4"/>` + eye(bx + 10, by - 24);
      case "bear": return neck + `<path d="M${bx - 8} ${by - 26} q 16 -12 30 -2 l -2 8 q -12 6 -22 2 q -8 -2 -6 -8 z" fill="${c}"/><circle cx="${bx - 2}" cy="${by - 32}" r="4" fill="${c}"/><circle cx="${bx + 10}" cy="${by - 34}" r="4" fill="${c}"/>` + eye(bx + 10, by - 27);
      case "skull": return neck + `<circle cx="${bx + 6}" cy="${by - 28}" r="11" fill="#e8e0d0"/><rect x="${bx - 1}" y="${by - 20}" width="14" height="7" rx="2" fill="#e8e0d0"/><circle cx="${bx + 2}" cy="${by - 30}" r="3" fill="#222"/><circle cx="${bx + 11}" cy="${by - 30}" r="3" fill="#222"/>`;
      default: return "";
    }
  }
  // Sail pattern as a clipped group over the sail path.
  function sailPattern(pattern, c2, x0, x1, y0, y1) {
    const w = x1 - x0;
    if (pattern === "stripes") return Array.from({ length: Math.floor(w / 16) }, (_, i) => (i % 2 ? `<rect x="${x0 + i * 16}" y="${y0 - 5}" width="16" height="${y1 - y0 + 10}" fill="${c2}"/>` : "")).join("");
    if (pattern === "bands") return [0, 2].map((i) => `<rect x="${x0 - 10}" y="${y0 + 8 + i * 14}" width="${w + 20}" height="8" fill="${c2}"/>`).join("") + `<rect x="${x0 - 10}" y="${y1 - 10}" width="${w + 20}" height="6" fill="${c2}"/>`;
    if (pattern === "checks") { let s = ""; for (let i = 0; i * 14 < w; i++) for (let j = 0; j * 14 < y1 - y0; j++) if ((i + j) % 2) s += `<rect x="${x0 + i * 14}" y="${y0 + j * 14}" width="14" height="14" fill="${c2}"/>`; return s; }
    if (pattern === "diagonal") return Array.from({ length: Math.floor((w + 80) / 18) }, (_, i) => (i % 2 ? `<path d="M${x0 - 40 + i * 18} ${y1 + 10} l 40 -${y1 - y0 + 20} h 9 l -40 ${y1 - y0 + 20} z" fill="${c2}"/>` : "")).join("");
    return "";
  }

  // The boat as an SVG string. k is 1..50. The deck sits at y 92 of a 320x160 box, the bow points right.
  SVT.boatSvg = function (k, cls) {
    const b = B[Math.max(0, Math.min(B.length - 1, (k || 1) - 1))];
    const [name, kind, hull, trim, sail, pattern, sail2, shields, shA, shB, head, flag, emb] = b, glow = !!b[14];
    const id = "bt" + k;
    let body = "";
    if (kind === "raft") {
      body = Array.from({ length: 6 }, (_, i) => `<rect x="${116 + i * 20}" y="90" width="18" height="22" rx="7" fill="${i % 2 ? hull : trim}"/>`).join("") +
        `<rect x="112" y="96" width="128" height="4" fill="#5c3a1e"/><rect x="112" y="106" width="128" height="4" fill="#5c3a1e"/>` +
        `<rect x="166" y="30" width="4" height="62" fill="#5c3a1e"/><path d="M170 32 l 26 7 l -26 7 z" fill="${flag}"/>`;
    } else if (kind === "canoe") {
      body = `<path d="M86 88 Q 96 118 136 118 L 216 118 Q 256 118 266 86 Q 252 100 216 100 L 136 100 Q 100 100 86 88 z" fill="${hull}"/>` +
        `<path d="M94 92 Q 126 104 176 104 Q 226 104 258 90" fill="none" stroke="${trim}" stroke-width="3"/>` +
        `<path d="M 222 80 l 22 36" stroke="#8a5a32" stroke-width="4" stroke-linecap="round"/><ellipse cx="246" cy="118" rx="7" ry="4" fill="#8a5a32"/>`;
    } else {
      const CX = 176, MX = 112, L = Math.min(300, 118 + k * 3.7), sx = CX - L / 2, bx = CX + L / 2, deck = 92, keel = 126;
      const hullPath = `M${sx} ${deck - 22} Q ${sx + 6} ${keel - 6} ${sx + 34} ${keel} L ${bx - 34} ${keel} Q ${bx - 8} ${keel - 6} ${bx} ${deck - 30} L ${bx - 10} ${deck} Q ${CX} ${deck + 6} ${sx + 10} ${deck} z`;
      const planks = [8, 16, 24].map((d) => `<path d="M${sx + 2} ${deck + d - 4} Q ${CX} ${deck + d + 6} ${bx - 2} ${deck + d - 6}" fill="none" stroke="${trim}" stroke-width="2" opacity=".7"/>`).join("");
      const n = Math.min(shields, Math.floor((L - 70) / 19));
      const shieldRow = Array.from({ length: n }, (_, i) => { const x = sx + 36 + i * ((L - 72) / Math.max(1, n - 1)) , c = i % 2 ? shB : shA, c2 = i % 2 ? shA : shB; return `<circle cx="${x}" cy="${deck - 2}" r="9.5" fill="${c}" stroke="${trim}" stroke-width="2"/><circle cx="${x}" cy="${deck - 2}" r="5" fill="none" stroke="${c2}" stroke-width="2"/><circle cx="${x}" cy="${deck - 2}" r="2" fill="${trim}"/>`; }).join("");
      const oars = Array.from({ length: Math.max(2, Math.floor(n / 2)) }, (_, i) => { const x = sx + 40 + i * ((L - 80) / Math.max(1, Math.floor(n / 2) - 1 || 1)); return `<line x1="${x}" y1="${deck + 4}" x2="${x - 14}" y2="${keel + 16}" stroke="#5c3a1e" stroke-width="3" stroke-linecap="round"/>`; }).join("");
      const sw = Math.min(130, 66 + k * 1.3), x0 = MX - sw / 2, x1 = MX + sw / 2, y0 = 26, y1 = 82;
      const sailPath = `M${x0} ${y0} L ${x1} ${y0} Q ${x1 + 14} ${(y0 + y1) / 2} ${x1 - 4} ${y1} L ${x0 + 4} ${y1} Q ${x0 - 14} ${(y0 + y1) / 2} ${x0} ${y0} z`;
      const sailFill = glow ? `url(#${id}g)` : sail;
      body = `<defs><clipPath id="${id}s"><path d="${sailPath}"/></clipPath><clipPath id="${id}h"><path d="${hullPath}"/></clipPath>` +
        (glow ? `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${sail}"/></linearGradient>` : "") + `</defs>` +
        oars +
        `<rect x="${MX - 3}" y="14" width="6" height="${deck - 12}" rx="3" fill="#5c3a1e"/>` +
        `<path d="${sailPath}" fill="${sailFill}" stroke="${trim}" stroke-width="2"/>` +
        `<g clip-path="url(#${id}s)">${sailPattern(pattern, sail2, x0, x1, y0, y1)}</g>` +
        emblem(emb, MX, (y0 + y1) / 2 + 2, Math.min(22, sw * .22), trim) +
        `<path d="${sailPath}" fill="none" stroke="${trim}" stroke-width="2"/>` +
        `<rect x="${x0 - 6}" y="${y0 - 3}" width="${sw + 12}" height="6" rx="3" fill="#5c3a1e"/>` +
        `<path d="M${MX} 10 l -30 7 l 30 7 z" fill="${flag}"/>` +
        `<path d="${hullPath}" fill="${hull}" stroke="${trim}" stroke-width="3" stroke-linejoin="round"/>` +
        `<g clip-path="url(#${id}h)">${planks}</g>` +
        `<path d="M${sx + 10} ${deck} Q ${CX} ${deck + 6} ${bx - 10} ${deck}" fill="none" stroke="${trim}" stroke-width="4"/>` +
        shieldRow +
        figurehead(head, bx - 2, deck - 24, hull, trim) +
        `<path d="M${sx + 2} ${deck - 18} q -10 -8 -4 -16 q 6 -4 8 2" fill="none" stroke="${hull}" stroke-width="7" stroke-linecap="round"/>` +
        (glow ? `<path d="${hullPath}" fill="url(#${id}g)" opacity=".18"/>` : "");
    }
    return `<svg class="boat${cls ? " " + cls : ""}${glow ? " glow" : ""}" viewBox="0 0 352 160" aria-label="${esc(name)}">${body}</svg>`;
  };
})();
