# Vault item pictures

`js/icons.js` is generated. It holds one SVG per product (about 300 distinct icons for the 900 products), picked by
the rules in `tools/icon-map.mjs`, from these open-source sets (all credited in Settings):

- Material Design Icons, Apache 2.0 (`@iconify-json/mdi`)
- Game-icons.net, CC BY 3.0 (`@iconify-json/game-icons`)
- Tabler Icons, MIT (`@iconify-json/tabler`)
- Phosphor, MIT (`@iconify-json/ph`)
- IconPark, Apache 2.0 (`@iconify-json/icon-park`)

To change a picture, edit a rule in `tools/icon-map.mjs` (first matching rule wins), then rebuild:

```
mkdir -p /tmp/iconsets && cd /tmp/iconsets && npm init -y && npm i @iconify-json/mdi @iconify-json/game-icons @iconify-json/tabler @iconify-json/ph @iconify-json/icon-park
cd <repo> && ICON_PKGS=/tmp/iconsets node tools/build-icons.mjs --check   # lists missing icons and products with no rule
ICON_PKGS=/tmp/iconsets node tools/build-icons.mjs                        # writes js/icons.js
```

Browse icon names at https://icon-sets.iconify.design/ (sets `mdi`, `game-icons`, `tabler`, `ph`, `icon-park`).
