# Silicon Valley Tycoon (idle-tap)

An idle tycoon game for your phone. You run an underground R&D electronics lab: engineering teams on 30 floors build products, a freight lift carries them up, and a commercial hub ships them for cash. Inspired by the loop of Idle Miner Tycoon, with its own theme, art and numbers.

**Version:** see [CHANGELOG.md](CHANGELOG.md).

## Play

- **On your phone:** open the GitHub Pages link (https://bigbriggs52.github.io/idle-tap/), then use your browser's *Add to Home Screen* to install it like an app.
- **Locally:** run any static file server in this folder, for example `npx http-server -p 8123 .`, and open http://localhost:8123.

No build step. It is plain HTML, CSS and JavaScript.

## Code map

| File | What it holds |
| --- | --- |
| `js/balance.js` | Every tuning number and formula (costs, outputs, milestones, managers, funding rounds) |
| `js/data.js` | Labs, map locations, floor products, tech-unlock names |
| `js/game.js` | Game state, simulation tick, actions, save/load, offline earnings |
| `js/ui.js` | Screens, buttons, map, sheets and toasts |
| `css/style.css` | Look and animations |
| `sw.js`, `manifest.webmanifest` | Install-to-home-screen and offline support |
| `tests/smoke.mjs` | Browser smoke test (Playwright) |

## Releasing a new version

1. Bump `VERSION` in `js/balance.js` and `CACHE` in `sw.js`.
2. Add an entry to `CHANGELOG.md`.
3. Merge to `main`; the Pages workflow deploys it.
