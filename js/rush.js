// Assembly Line Rush: the mini game in the old "Coming soon" spot. Parts ride down a conveyor; swipe each one into
// its bin (left, down or right) before it falls off the end. Wrong bins and dropped parts cost a life. The belt
// speeds up as the run goes on. The score picks a timed income boost for every lab (see B.RUSH and SVT.finishRush).
window.SVT = window.SVT || {};

(function () {
  const B = SVT.B;
  const PARTS = [
    { id: "battery", icon: "🔋", name: "Batteries", dir: "left" },
    { id: "chip", icon: "💾", name: "Chips", dir: "down" },
    { id: "gear", icon: "⚙️", name: "Gears", dir: "right" },
  ];
  const KEYS = { ArrowLeft: "left", ArrowDown: "down", ArrowRight: "right", a: "left", s: "down", d: "right" };
  // Belt pace over the run: a new part every 0.9 s at the start, down to 0.4 s; a part takes 2.4 s to ride the
  // belt at the start, down to 1.1 s. About 75 parts fit in a run, so ×5 (65) needs a near-perfect run and a
  // careful player lands ×2–×3. (v0.18.1: the first pace, 1.25 s to 0.5 s, felt too slow.)
  const spawnGap = (t) => Math.max(0.4, 0.9 - t * 0.0125);
  const rideTime = (t) => Math.max(1.1, 2.4 - t * 0.03);

  let box = null, game = null;
  const ui = () => SVT.ui;
  const clock = (s) => { s = Math.ceil(s); const m = Math.floor(s / 60); return m + ":" + String(s % 60).padStart(2, "0"); };

  function close() {
    if (game) game.stop();
    game = null;
    if (box) box.remove();
    box = null;
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) {
    if (e.key === "Escape") { close(); return; }
    if (game && KEYS[e.key]) { e.preventDefault(); game.swipe(KEYS[e.key]); }
  }

  function shell(...kids) {
    const { h } = ui();
    if (box) box.remove();
    box = h("div", { class: "rush", id: "rush", role: "dialog", "aria-label": "Assembly Line Rush" },
      h("div", { class: "rush-head" },
        h("span", { class: "rush-logo", "aria-hidden": "true", text: "🏭" }),
        h("h2", { text: "Assembly Line Rush" }),
        h("button", { class: "x-btn", "aria-label": "Close", onclick: close, text: "✕" })),
      ...kids);
    document.body.append(box);
    document.addEventListener("keydown", onKey);
  }

  function rewardTable(hit) {
    const { h } = ui();
    return h("div", { class: "rush-tiers" }, B.RUSH.TIERS.map((x) =>
      h("div", { class: "rush-tier" + (hit && hit.mult === x.mult ? " hit" : "") },
        h("b", { text: "×" + x.mult }), h("span", { text: x.score + "+ parts" }), h("small", { text: x.minutes + " min" }))));
  }

  // Start screen: rules, rewards, the current boost and the cooldown.
  function openRush() {
    const { h } = ui();
    close();
    const R = SVT.state().rush;
    const status = h("p", { class: "rush-status" });
    const play = h("button", { class: "btn fund-cta big rush-play", onclick: () => { if (!SVT.rushWait()) startRun(); } });
    shell(h("div", { class: "rush-body" },
      h("p", { class: "rush-lede", text: "Parts ride down the belt. Swipe each one into its bin before it drops off the end. Wrong bin or a dropped part costs a ❤️. You have 3, and the belt keeps speeding up." }),
      h("div", { class: "rush-bins legend" }, PARTS.map((p) => h("div", { class: "rush-bin b-" + p.dir },
        h("span", { class: "bin-ic", text: p.icon }), h("small", { text: (p.dir === "left" ? "⬅ " : p.dir === "down" ? "⬇ " : "➡ ") + p.name })))),
      h("p", { class: "muted small", text: "Sort enough parts in " + B.RUSH.SECONDS + " seconds to boost every lab's income, Viking Raid included. One run every " + B.RUSH.COOLDOWN / 60 + " minutes." }),
      rewardTable(),
      R.best ? h("p", { class: "muted small", text: "Your best: " + R.best + " parts" }) : null,
      status),
      h("div", { class: "rush-foot" }, play));
    const tick = () => {
      if (!box || game) return;
      const wait = SVT.rushWait(), left = SVT.rushLeft();
      status.textContent = left > 0 ? "⚡ ×" + R.mult + " boost active: " + clock(left) + " left" : "";
      play.textContent = wait > 0 ? "Next run in " + clock(wait) : "Start the line!";
      play.disabled = wait > 0;
      setTimeout(tick, 250);
    };
    tick();
  }

  // One run.
  function startRun() {
    const { h } = ui();
    const belt = h("div", { class: "rush-belt" }, h("div", { class: "rush-rail" }));
    const score = h("b", { class: "rush-score", text: "0" });
    const lives = h("span", { class: "rush-lives" });
    const timeFill = h("i", { class: "rush-time-fill" });
    const combo = h("span", { class: "rush-combo" });
    const bins = {};
    const binRow = h("div", { class: "rush-bins" }, PARTS.map((p) => (bins[p.dir] = h("button", { class: "rush-bin b-" + p.dir, "aria-label": p.name + " bin", onclick: () => g.swipe(p.dir) },
      h("span", { class: "bin-ic", text: p.icon }), h("small", { text: p.name })))));
    const stage = h("div", { class: "rush-stage" }, belt, binRow);
    shell(h("div", { class: "rush-hud" }, h("div", { class: "rush-time" }, timeFill), h("div", { class: "rush-stats" }, lives, combo, score)), stage);

    const g = (game = { parts: [], t: 0, next: 0.6, score: 0, lives: B.RUSH.LIVES, streak: 0, over: false, raf: 0 });
    let last = performance.now(), x0 = null, y0 = 0;
    const H = () => belt.clientHeight || 400;
    const drawLives = () => (lives.textContent = "❤️".repeat(g.lives) + "🖤".repeat(B.RUSH.LIVES - g.lives));
    drawLives();

    const spawn = () => {
      const p = PARTS[Math.floor(Math.random() * PARTS.length)];
      const el = h("div", { class: "rush-part p-" + p.id, "data-dir": p.dir, text: p.icon });
      belt.append(el);
      g.parts.push({ p, el, y: -60, v: (H() + 60) / rideTime(g.t) });
    };
    const flash = (dir, ok) => {
      const b = bins[dir];
      if (!b) return;
      b.classList.remove("ok", "bad"); void b.offsetWidth; b.classList.add(ok ? "ok" : "bad");
    };
    const lose = () => {
      g.lives--; g.streak = 0; drawLives();
      stage.classList.remove("hurt"); void stage.offsetWidth; stage.classList.add("hurt");
      if (navigator.vibrate) navigator.vibrate(60);
      if (g.lives <= 0) end();
    };
    // Sort the part nearest the bins.
    g.swipe = (dir) => {
      if (g.over) return;
      const part = g.parts.filter((x) => !x.done).sort((a, b) => b.y - a.y)[0];
      if (!part) return;
      part.done = true;
      const ok = part.p.dir === dir;
      part.el.classList.add(ok ? "fly-" + dir : "wrong");
      setTimeout(() => part.el.remove(), 380);
      g.parts = g.parts.filter((x) => x !== part);
      flash(dir, ok);
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
      const res = SVT.finishRush(g.score);
      setTimeout(() => results(g.score, res), 450);
    }
    function frame(now) {
      if (g.over) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      g.t += dt;
      g.next -= dt;
      if (g.next <= 0 && g.t < B.RUSH.SECONDS - 0.8) { spawn(); g.next = spawnGap(g.t); }
      const bottom = H() - 30;
      for (const x of g.parts.slice()) {
        x.y += x.v * dt;
        x.el.style.transform = "translate(-50%," + x.y.toFixed(1) + "px)";
        if (x.y > bottom) {
          x.done = true;
          x.el.classList.add("drop");
          setTimeout(() => x.el.remove(), 380);
          g.parts = g.parts.filter((y) => y !== x);
          lose();
          if (g.over) return;
        }
      }
      const nearest = g.parts.reduce((a, b) => (!a || b.y > a.y ? b : a), null);
      g.parts.forEach((x) => x.el.classList.toggle("next", x === nearest));
      timeFill.style.transform = "scaleX(" + Math.max(0, 1 - g.t / B.RUSH.SECONDS).toFixed(4) + ")";
      if (g.t >= B.RUSH.SECONDS) { end(); return; }
      g.raf = requestAnimationFrame(frame);
    }
    // Swipes anywhere on the play area. A short tap does nothing (the bins are buttons for tapping).
    stage.addEventListener("pointerdown", (e) => { x0 = e.clientX; y0 = e.clientY; });
    stage.addEventListener("pointerup", (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
      g.swipe(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy > 0 ? "down" : null);
    });
    stage.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false }); // keep the page from scrolling
    g.raf = requestAnimationFrame(frame);
  }

  function results(n, res) {
    const { h } = ui();
    if (!box) return;
    const tier = res.tier;
    const next = B.RUSH.TIERS.find((x) => x.score > n);
    shell(h("div", { class: "rush-body rush-result" },
      h("div", { class: "rush-big", text: String(n) }),
      h("p", { class: "rush-sub", text: "parts sorted" }),
      tier
        ? h("p", { class: "rush-win", text: res.applied ? "⚡ ×" + tier.mult + " income in every lab for " + tier.minutes + " minutes!" : "⚡ You earned ×" + tier.mult + ", but your current boost is bigger, so it stays." })
        : h("p", { class: "rush-miss", text: "No boost this time. Sort " + B.RUSH.TIERS[0].score + " parts for ×" + B.RUSH.TIERS[0].mult + "." }),
      tier && next ? h("p", { class: "muted small", text: next.score - n + " more for ×" + next.mult + "." }) : null,
      rewardTable(tier)),
      h("div", { class: "rush-foot" }, h("button", { class: "btn fund-cta big", onclick: close, text: "Back to the lab" })));
    if (tier && res.applied) SVT.ui.toast("⚡ ×" + tier.mult + " income boost for " + tier.minutes + " min!", "big");
  }

  SVT.openRush = openRush;
  SVT.closeRush = close;
  SVT.rushGame = () => game;
  SVT.rushClock = clock;
})();
