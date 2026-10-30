// Bug Hunt: the second mini game (v0.37). Bugs pop out of a 3×3 rack of servers; tap each one before it crawls back
// in. Data gems pop up too: tapping one costs a life, and so does a bug that gets away. The rack speeds up over the
// run. The score picks a timed income boost that stacks with Assembly Line Rush (see B.BUGS and SVT.finishBugs).
// Tiles answer on pointerdown (not click), like the Rush bins since v0.36.1, so quick taps on a phone never drop.
window.SVT = window.SVT || {};

(function () {
  const B = SVT.B;
  const BUGS = ["🐛", "🪲", "🐞", "🕷️"];
  const GEM = "💎";
  const KEYS = { 1: 6, 2: 7, 3: 8, 4: 3, 5: 4, 6: 5, 7: 0, 8: 1, 9: 2 }; // numpad layout: 7 8 9 is the top row
  // Pace over the run: a new pop every 0.85 s at the start, down to 0.35 s; a bug stays out 1.6 s at the start,
  // down to 0.75 s. About 50 pops fit in a run and a fifth are gems, so ×3 (36 bugs) needs a near-perfect run.
  const popGap = (t) => Math.max(0.35, 0.85 - t * 0.017);
  const bugLife = (t) => Math.max(0.75, 1.6 - t * 0.03);
  const GEM_SHARE = 0.2, MAX_OUT = 4;

  let box = null, game = null;
  const ui = () => SVT.ui;
  const clock = (s) => SVT.rushClock(s);

  function close() {
    if (game) game.stop();
    game = null;
    if (box) box.remove();
    box = null;
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) {
    if (e.key === "Escape") { close(); return; }
    if (game && KEYS[e.key] !== undefined) { e.preventDefault(); game.hit(KEYS[e.key]); }
  }

  function shell(...kids) {
    const { h } = ui();
    if (box) box.remove();
    box = h("div", { class: "rush bugs", id: "bugs", role: "dialog", "aria-label": "Bug Hunt" },
      h("div", { class: "rush-head" },
        h("span", { class: "rush-logo", "aria-hidden": "true", text: "🐛" }),
        h("h2", { text: "Bug Hunt" }),
        h("button", { class: "x-btn", "aria-label": "Close", onclick: close, text: "✕" })),
      ...kids);
    document.body.append(box);
    document.addEventListener("keydown", onKey);
  }

  function rewardTable(hit) {
    const { h } = ui();
    return h("div", { class: "rush-tiers" }, B.BUGS.TIERS.map((x) =>
      h("div", { class: "rush-tier" + (hit && hit.mult === x.mult ? " hit" : "") },
        h("b", { text: "×" + x.mult }), h("span", { text: x.score + "+ bugs" }), h("small", { text: x.minutes + " min" }))));
  }

  // Start screen: rules, rewards, the current boost and the cooldown.
  function openBugs() {
    const { h } = ui();
    close();
    const R = SVT.state().bugs;
    const status = h("p", { class: "rush-status" });
    const play = h("button", { class: "btn fund-cta big bugs-play", onclick: () => { if (!SVT.bugsWait()) startRun(); } });
    shell(h("div", { class: "rush-body" },
      h("p", { class: "rush-lede", text: "Bugs are loose in the server rack. Tap each one before it crawls back in. Leave the 💎 data gems alone: tapping a gem or letting a bug get away costs a ❤️. You have 3, and the bugs get quicker." }),
      h("div", { class: "bug-legend" },
        h("div", { class: "bug-tile demo has-bug" }, h("span", { class: "bug-face", text: "🐛" }), h("small", { text: "Tap!" })),
        h("div", { class: "bug-tile demo has-gem" }, h("span", { class: "bug-face", text: GEM }), h("small", { text: "Leave it" }))),
      h("p", { class: "muted small", text: "Squash enough bugs in " + B.BUGS.SECONDS + " seconds for an income boost in every lab, Viking Raid included. It stacks with the Rush boost. One run every " + B.BUGS.COOLDOWN / 60 + " minutes." }),
      rewardTable(),
      R.best ? h("p", { class: "muted small", text: "Your best: " + R.best + " bugs" }) : null,
      status),
      h("div", { class: "rush-foot" }, play));
    const tick = () => {
      if (!box || game) return;
      const wait = SVT.bugsWait(), left = SVT.bugsLeft();
      status.textContent = left > 0 ? "⚡ ×" + R.mult + " boost active: " + clock(left) + " left" : "";
      play.textContent = wait > 0 ? "Next hunt in " + clock(wait) : "Start the hunt!";
      play.disabled = wait > 0;
      setTimeout(tick, 250);
    };
    tick();
  }

  // One run.
  function startRun() {
    const { h } = ui();
    const score = h("b", { class: "rush-score", text: "0" });
    const lives = h("span", { class: "rush-lives" });
    const timeFill = h("i", { class: "rush-time-fill" });
    const combo = h("span", { class: "rush-combo" });
    const tiles = [];
    const rack = h("div", { class: "bug-rack" }, [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
      const face = h("span", { class: "bug-face", "aria-hidden": "true" });
      const el = h("button", { class: "bug-tile", "aria-label": "Server " + (i + 1), "data-hold": "1",
        onpointerdown: (e) => { if (e.isPrimary && e.button <= 0) { e.preventDefault(); g.hit(i); } },
        onclick: (e) => { if (e.detail === 0) g.hit(i); } },
        h("span", { class: "bug-leds", "aria-hidden": "true" }), face);
      tiles.push({ el, face, kind: null, until: 0 });
      return el;
    }));
    const stage = h("div", { class: "rush-stage bugs-stage" }, rack);
    shell(h("div", { class: "rush-hud" }, h("div", { class: "rush-time" }, timeFill), h("div", { class: "rush-stats" }, lives, combo, score)), stage);

    const g = (game = { tiles, t: 0, next: 0.7, score: 0, lives: B.BUGS.LIVES, streak: 0, over: false, raf: 0 });
    let last = performance.now();
    const drawLives = () => (lives.textContent = "❤️".repeat(g.lives) + "🖤".repeat(B.BUGS.LIVES - g.lives));
    drawLives();

    const clear = (tile) => { tile.kind = null; tile.el.classList.remove("has-bug", "has-gem"); };
    const pop = () => {
      const free = tiles.filter((x) => !x.kind);
      if (!free.length || tiles.length - free.length >= MAX_OUT) return;
      const tile = free[Math.floor(Math.random() * free.length)];
      const gem = Math.random() < GEM_SHARE;
      tile.kind = gem ? "gem" : "bug";
      tile.until = g.t + (gem ? 1 : bugLife(g.t));
      tile.face.textContent = gem ? GEM : BUGS[Math.floor(Math.random() * BUGS.length)];
      tile.el.classList.remove("ok", "bad"); void tile.el.offsetWidth;
      tile.el.classList.add(gem ? "has-gem" : "has-bug");
    };
    const flash = (tile, ok) => { tile.el.classList.remove("ok", "bad"); void tile.el.offsetWidth; tile.el.classList.add(ok ? "ok" : "bad"); };
    const lose = () => {
      g.lives--; g.streak = 0; drawLives(); combo.textContent = "";
      stage.classList.remove("hurt"); void stage.offsetWidth; stage.classList.add("hurt");
      if (navigator.vibrate) navigator.vibrate(60);
      if (g.lives <= 0) end();
    };
    g.hit = (i) => {
      if (g.over) return;
      const tile = tiles[i];
      if (!tile || !tile.kind) return;
      const ok = tile.kind === "bug";
      clear(tile);
      flash(tile, ok);
      if (ok) {
        g.score++; g.streak++;
        score.textContent = String(g.score);
        score.classList.remove("pop"); void score.offsetWidth; score.classList.add("pop");
        combo.textContent = g.streak >= 5 ? "🔥 " + g.streak : "";
      } else lose();
    };
    g.stop = () => { g.over = true; cancelAnimationFrame(g.raf); };
    g.end = end;
    function end() {
      if (g.over && g.ended) return;
      g.stop(); g.ended = true;
      const res = SVT.finishBugs(g.score);
      setTimeout(() => results(g.score, res), 450);
    }
    function frame(now) {
      if (g.over) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      g.t += dt;
      g.next -= dt;
      if (g.next <= 0 && g.t < B.BUGS.SECONDS - 1) { pop(); g.next = popGap(g.t); }
      for (const tile of tiles) {
        if (tile.kind && g.t >= tile.until) {
          const escaped = tile.kind === "bug";
          clear(tile);
          if (escaped) { flash(tile, false); lose(); if (g.over) return; }
        }
      }
      timeFill.style.transform = "scaleX(" + Math.max(0, 1 - g.t / B.BUGS.SECONDS).toFixed(4) + ")";
      if (g.t >= B.BUGS.SECONDS) { end(); return; }
      g.raf = requestAnimationFrame(frame);
    }
    stage.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false }); // keep the page from scrolling
    g.raf = requestAnimationFrame(frame);
  }

  function results(n, res) {
    const { h } = ui();
    if (!box) return;
    const tier = res.tier;
    const next = B.BUGS.TIERS.find((x) => x.score > n);
    shell(h("div", { class: "rush-body rush-result" },
      h("div", { class: "rush-big", text: String(n) }),
      h("p", { class: "rush-sub", text: "bugs squashed" }),
      tier
        ? h("p", { class: "rush-win", text: res.applied ? "⚡ ×" + tier.mult + " income in every lab for " + tier.minutes + " minutes, on top of any Rush boost!" : "⚡ You earned ×" + tier.mult + ", but your current Bug Hunt boost is bigger, so it stays." })
        : h("p", { class: "rush-miss", text: "No boost this time. Squash " + B.BUGS.TIERS[0].score + " bugs for ×" + B.BUGS.TIERS[0].mult + "." }),
      tier && next ? h("p", { class: "muted small", text: next.score - n + " more for ×" + next.mult + "." }) : null,
      rewardTable(tier)),
      h("div", { class: "rush-foot" }, h("button", { class: "btn fund-cta big", onclick: close, text: "Back to the lab" })));
    if (tier && res.applied) SVT.ui.toast("⚡ ×" + tier.mult + " Bug Hunt boost for " + tier.minutes + " min!", "big");
  }

  SVT.openBugs = openBugs;
  SVT.closeBugs = close;
  SVT.bugsGame = () => game;
})();
