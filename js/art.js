// Cartoon art drawn in code: Chip, the game's robot mascot. Pure SVG, so it stays sharp and needs no image files.
window.SVT = window.SVT || {};

(function () {
  let uid = 0;
  // pose: "hold" (arms up, holding the sign above his head), "wave" (one arm waving) or "head" (just the face, for badges).
  SVT.mascot = function (pose) {
    const id = "m" + ++uid; // gradient ids must be unique per copy on the page
    const g = (n) => id + n;
    const defs = `<defs>
      <linearGradient id="${g("body")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd84d"/><stop offset=".55" stop-color="#ffb21e"/><stop offset="1" stop-color="#f08a0c"/></linearGradient>
      <linearGradient id="${g("head")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4fbff"/><stop offset="1" stop-color="#9fd2f3"/></linearGradient>
      <linearGradient id="${g("visor")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#28407a"/><stop offset="1" stop-color="#14204a"/></linearGradient>
      <radialGradient id="${g("screen")}" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#9ffcff"/><stop offset="1" stop-color="#1fb6d9"/></radialGradient>
      <radialGradient id="${g("ball")}" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#ff9a9a"/><stop offset="1" stop-color="#e5303e"/></radialGradient>
      <linearGradient id="${g("limb")}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8fa4b8"/><stop offset=".5" stop-color="#d9e6f0"/><stop offset="1" stop-color="#8fa4b8"/></linearGradient>
    </defs>`;
    const face = `
      <g class="m-antenna">
        <rect x="96" y="20" width="8" height="26" rx="4" fill="#8fa4b8"/>
        <circle cx="100" cy="18" r="11" fill="url(#${g("ball")})"/><circle cx="96" cy="14" r="3.5" fill="#fff" opacity=".8"/>
      </g>
      <rect x="44" y="40" width="112" height="92" rx="42" fill="url(#${g("head")})" stroke="#5a8fb8" stroke-width="3"/>
      <circle cx="42" cy="88" r="10" fill="#ffb21e" stroke="#c96f08" stroke-width="3"/><circle cx="158" cy="88" r="10" fill="#ffb21e" stroke="#c96f08" stroke-width="3"/>
      <rect x="58" y="60" width="84" height="56" rx="26" fill="url(#${g("visor")})"/>
      <g class="m-eyes">
        <ellipse cx="82" cy="86" rx="11" ry="13" fill="#fff"/><ellipse cx="118" cy="86" rx="11" ry="13" fill="#fff"/>
        <circle cx="84" cy="88" r="7" fill="#1b2a52"/><circle cx="120" cy="88" r="7" fill="#1b2a52"/>
        <circle cx="87" cy="84" r="3" fill="#fff"/><circle cx="123" cy="84" r="3" fill="#fff"/>
      </g>
      <path d="M90 104 Q100 112 110 104" fill="none" stroke="#7ef3ff" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="66" cy="104" rx="7" ry="4" fill="#ff7fa8" opacity=".55"/><ellipse cx="134" cy="104" rx="7" ry="4" fill="#ff7fa8" opacity=".55"/>
      <ellipse cx="78" cy="52" rx="22" ry="7" fill="#fff" opacity=".7"/>`;
    if (pose === "head") {
      return `<svg class="mascot head" viewBox="28 4 144 132" aria-hidden="true">${defs}${face}</svg>`;
    }
    // An arm is a thick rounded stroke over a darker one (the outline), ending in a round orange hand.
    const arm = (cls, d, hx, hy) => `<g class="m-arm ${cls}"><path d="${d}" fill="none" stroke="#5f7489" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="#d3e0eb" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6" transform="translate(-4 -2)"/>
      <circle cx="${hx}" cy="${hy}" r="17" fill="#ffb21e" stroke="#c96f08" stroke-width="3"/><circle cx="${hx - 5}" cy="${hy - 6}" r="5" fill="#fff" opacity=".6"/></g>`;
    const arms = pose === "hold"
      ? arm("l", "M50 150 Q12 116 34 30", 34, 26) + arm("r", "M150 150 Q188 116 166 30", 166, 26)
      : `<g class="m-arm l"><rect x="28" y="140" width="22" height="64" rx="11" transform="rotate(14 39 142)" fill="url(#${g("limb")})" stroke="#5f7489" stroke-width="3"/><circle cx="27" cy="204" r="13" fill="#ffb21e" stroke="#c96f08" stroke-width="3"/></g>
         <g class="m-arm r wave"><rect x="150" y="84" width="22" height="64" rx="11" fill="url(#${g("limb")})" stroke="#5f7489" stroke-width="3"/><circle cx="161" cy="80" r="14" fill="#ffb21e" stroke="#c96f08" stroke-width="3"/></g>`;
    return `<svg class="mascot ${pose}" viewBox="0 0 200 270" aria-hidden="true">${defs}
      <ellipse class="m-shadow" cx="100" cy="258" rx="62" ry="10" fill="#1b4020" opacity=".25"/>
      <g class="m-all">
        <g class="m-legs">
          <rect x="66" y="210" width="24" height="40" rx="12" fill="url(#${g("limb")})" stroke="#5f7489" stroke-width="3"/>
          <rect x="110" y="210" width="24" height="40" rx="12" fill="url(#${g("limb")})" stroke="#5f7489" stroke-width="3"/>
          <ellipse cx="76" cy="250" rx="20" ry="10" fill="#3f6fd6" stroke="#23408a" stroke-width="3"/>
          <ellipse cx="124" cy="250" rx="20" ry="10" fill="#3f6fd6" stroke="#23408a" stroke-width="3"/>
        </g>
        <g class="m-body">
          ${pose === "hold" ? "" : arms}
          <rect x="46" y="128" width="108" height="92" rx="38" fill="url(#${g("body")})" stroke="#c96f08" stroke-width="3"/>
          <ellipse cx="78" cy="146" rx="22" ry="9" fill="#fff" opacity=".55"/>
          <rect x="72" y="152" width="56" height="44" rx="16" fill="url(#${g("screen")})" stroke="#0f7b96" stroke-width="3"/>
          <text x="100" y="186" text-anchor="middle" font-family="Lilita One, Arial Black, sans-serif" font-size="32" fill="#fff" stroke="#0f7b96" stroke-width="3" paint-order="stroke">$</text>
          <g class="m-head">${face}</g>
          ${pose === "hold" ? arms : ""}
        </g>
      </g>
    </svg>`;
  };
})();
