# Changelog

Every update gets a version number. The game shows its version in Settings and at the bottom of each screen.

## v0.25.0 (2026-10-23)

- Real pictures for every Vault item. All 900 products now have their own icon (a motor looks like a motor, a soldering kit like a soldering iron), picked by hand from Material Design Icons, Game-icons.net and Tabler and bundled with the game, so nothing is fetched from the web. The item's rolled colour and finish are painted onto the icon itself: a Chrome Indigo calculator is a chrome-and-indigo calculator shape, Holographic shimmers, Neon glows. Credits are in Settings.
- On the home screen Chip now holds and wears the shapes themselves, with a glow in the rarity's colour, instead of framed tiles.
- Auto-equip: one button on the Chip tab fills every slot with the best item of its kind (biggest bonus, then rarest) and never wears the same item twice.
- Cleaner Vault: item cards show the name, rarity, bonus, where it goes and one Equip / Take off button, with the full six-part code behind Details. Shorter text on the Roll and Chip tabs, and "Choose slot" is gone (the Chip tab places items in a specific hand or floor side).

## v0.23.0 (2026-10-23)

- Viking Raid caps are the same on every stage now: shafts stop at Lv 25, the lift and the warehouse at Lv 100. Clearing a stage means every shaft at 25 and both hubs at 100. With the lift and warehouse able to go so much further, deep mines are no longer choked by a lift that stops at Lv 60; the difficulty of a stage is all in its prices and omens. Target clear times are unchanged (10 minutes on stage 1 to 12 hours on stage 50) and every stage's prices were refitted. The goal bar and the Stages panel spell out both caps.
- The lift, the warehouse and the deepest shaft now finish together. Raid prices climb 1.5× per shaft level (25 levels) and 1.1× per lift or warehouse level (100 levels), and each stage's hub prices are set so the last level of the lift, of the warehouse and of the deepest shaft cost the same. Upgrade evenly and all three max out around the same time instead of the shafts finishing early and the hubs dragging on.
- Manager abilities now work in Viking Raid too: Speed, Storage and Price all fire there, with the same durations and cooldowns as in the labs. Only the passive rarity bonus worked there before.
- Fix: an empty yellow pill sat over the Tap labels and under "Tap to build" on every lift, warehouse and shaft until an ability had run there (the v0.22 ability tag was created visible). It is hidden until an ability is active.

## v0.22.1 (2026-10-23)

- Viking Raid is steeper. Each deeper shaft now costs 1.3× the one above it (they all cost the same before), so the last shafts of a mine are the expensive ones and the whole mine needs upgrading to pay for them. Target clear times go up again: 10 minutes on stage 1, about 22 on stage 10, 80 on stage 25, 5 hours on stage 40 and 12 hours on stage 50 (was 3 minutes to 3 hours). Price scales refitted with the pacing sim.

## v0.22.0 (2026-10-23)

- Manager abilities now come in three kinds you can see: ⚡ **Speed** (Crunch Time, Express Lift, Launch Blitz) runs the node faster, so floor cycles shorten, the workers and belt hurry, the lift car races and the warehouse worker sprints with the cart; 📦 **Storage** (Big Batch, Bulk Freight, Fleet Expansion) makes every cycle, lift trip and cart load carry that many times more, with bigger crates, a bigger lift car and a bigger cart on screen; 💸 **Price** (Budget Cut, Vendor Deal, Bulk Contract) turns the Level button green with the discount on it. Speed and Storage both multiply income by the rank's boost, so no manager got weaker; the floor ability "Hackathon" is renamed "Big Batch".
- While an ability runs, a tag over the floor, lift tower or warehouse names it (⚡ ×4, 📦 ×3, 💸 −60%). The ⚡ button on a seat now shows the kind's icon, the manager list groups by Speed / Storage / Price, and the type row under the Floors / Lift / Warehouse tabs has four choices: All, Speed, Storage, Price. The Level panel's "Per cycle" and "Round trip" rows show the faster times during a speed ability.
- Viking Raid is harder. Stage max levels start at 15 (was 10) and rise to 60, and the target clear times are 3 minutes on stage 1 rising to 3 hours on stage 50 (was 1.5 to 30 minutes). Price scales were refitted with the pacing sim.

## v0.21.0 (2026-10-23)

- Merging changed: any three items of the same rarity now merge, whatever their product or lab. You get one new item of the next rarity: a random product from one of the three items' labs, with a fresh look and a fresh bonus roll. The Merge section in the Items tab lists each rarity you can merge with a "Merge 3 weakest" button, or tap "Pick 3" to choose exactly which three go. Items on Chip still don't count, and Mythic is still the top.

## v0.20.2 (2026-10-23)

- Manager panels get a type row under the Floors / Lift / Warehouse tabs: ✨ All, ⚡ Speed or 💸 Cost, with the count of each. Pick one to see only those managers, best rarity first. The choice sticks while you browse.
- Fix: holding the Level Up button sometimes missed the first touch. The press now takes over the pointer, so a finger that drifts slightly or a browser that wants to scroll no longer cuts the hold short, and the long-press menu is suppressed.

## v0.20.1 (2026-10-23)

- The ×50 buy button is gone. The Level panel now offers ×1, ×10, Max and Next.
- Max now lands on a round level: it buys as many levels as you can afford, rounded down so the new level is a multiple of 50 (from Lv 56 with cash for 140 levels it goes to Lv 100). If you cannot afford the next multiple of 50 it buys everything you can afford, and if you can afford the max level it takes you there.
- Saves that had ×50 selected switch to Max. The ▲▲▲ badge on a Level button still means you can reach the next multiple of 50, which is where Max will land.
- Manager lists are grouped by ability type, ⚡ Speed boosts first and then 💸 Cost cuts, with the best rarity at the top of each group. Free managers still come before the ones already working somewhere.

## v0.20.0 (2026-10-23)

- Chip now really wears his collectibles. Nine slots sit on his body: left hand, right hand, wrist, head, neck, body, feet, and the floor on either side of him. Each item is drawn at that spot on the home screen, so he holds the calculator, wears the watch, carries the AI chip on his head and hangs the lanyard round his neck. Big things like arcade cabinets and servers stand next to him.
- Every one of the 900 products across all 30 labs now has a category (hand, wrist, head, neck, body, feet or floor), and an item only goes in a slot of its own kind. Neck wear goes round the neck only; anything he cannot wear goes on the floor beside him. Old saves move their worn items to the matching slot.
- Per-slot inventories are sorted rarest first (then biggest bonus). An item that is already on Chip is not listed again and cannot be equipped twice; Equip on a worn item tells you where it already is.
- Merging: in the Items tab, three unequipped items of the same product and rarity merge into one new item of that product at the next rarity, with a fresh look and a fresh bonus roll (Mythic cannot be merged further). The Merge section shows every set you can merge.
- Opening a new lab on the map now pays 50 wild coins. Existing saves get 50 for every lab already open, once.

## v0.19.0 (2026-10-23)

- Item bonuses: some collectibles now boost lab income while Chip wears them. The chance and size grow with rarity: Common 20% chance of ×1.05, Uncommon 35% of ×1.1, Rare 50% of ×1.15, Epic 70% of ×1.25, Legendary always ×1.35, Mythic always ×1.5. Items you already own roll their bonus when the game loads.
- Worn bonuses add up (×1.2 and ×1.5 make ×1.7), capped at ×3. They apply to every lab, not Viking Raid. The total shows on the home screen under Chip, on the Vault's Chip tab, and on each item card.
- Easier equipping: every item card has one Equip button that puts it in the best slot it fits (or swaps out the weakest item there), and a Take off button. "Choose slot" still lets you pick a specific spot.
- New Chip tab in the Vault: his six slots in a grid. Tap a slot to see its own inventory, only the items that fit it, best bonus first, and tap an item to put it there. Tapping an item on Chip on the home screen opens that slot.

## v0.18.1 (2026-10-23)

- Fix: swiping down no longer refreshes the page. The browser's pull-to-refresh is turned off on the whole game, and a downward drag with nothing left to scroll up is swallowed before the browser sees it. Scrolling the mine, the map and the panels works as before.
- Assembly Line Rush is faster: parts now arrive every 0.9 s at the start (was 1.25 s) and every 0.4 s by the end (was 0.5 s), and they ride the belt in 2.4 s down to 1.1 s (was 3.4 s down to 1.5 s). About 75 parts fit in a run instead of 55.
- Rush boost thresholds move up to match: 20+ parts ×2, 35+ ×3, 50+ ×4, 65+ ×5 (were 15/25/35/45). The boost lengths are unchanged.

## v0.18.0 (2026-10-22)

- Tech Vault coins: a new player starts with 50 wild coins that roll at any open lab (existing saves get them once). Beating a lab, first time or on a replay, now pays 10 of its coins instead of 1; labs you beat earlier are topped up to 10 per win.
- Stakes are now 1, 3, 5 or 10 coins per roll (same odds ladder as before: 10 coins is 18% Legendary or better and never Common). Pity now guarantees a Legendary or better within 75 coins, with rising odds from the 50th.
- New Trophies tab in the Vault: every lab you have beaten with its win count and coins, your inventory totals by rarity, coins spent, and what Chip has in each of his six slots. The Gallery tab is now called Items.

## v0.17.1 (2026-10-22)

- Fix: the screen shook every time you hired, assigned, unassigned or sold a manager. The manager panel was rebuilt after each tap and replayed its spring-in animation. A panel that is already open now swaps in place with no animation. The same fix covers every other panel that rebuilds itself after a tap.

## v0.17.0 (2026-10-22)

- New mini game, the Tech Vault (🎁 Vault on the home screen and the map): a collectible roll.
- Beating a lab (raising its IPO) now pays a 🪙 coin stamped with that lab. Labs beaten before this update get their coin when the game loads.
- A coin rolls one of that lab's 30 products as a one-of-a-kind collectible, revealed slot-machine style in six parts: product ✱ rarity ✱ color + finish ✱ size ✱ mods ✱ serial. Rarity goes Common, Uncommon, Rare, Epic, Legendary, Mythic, each with its own color hue.
- Put 1, 2, 3 or 5 coins from the same lab into one roll for better odds (1 coin: 2% Legendary or better; 5 coins: 18%, and never Common). The odds table is always shown.
- Pity: a Legendary or better is guaranteed within 15 coins, with rising odds from the 10th. Your first roll ever is at least Rare.
- No two items in your Vault ever share a look (the game rerolls the look if it is taken), and every item carries a random 6-character DNA tag.
- Replay: a beaten lab keeps its 🏆 and now has a Replay button on the map. It starts over from floor 1 in its own bonus slot beside your 5 open labs (one replay at a time), and raising its IPO again pays another coin.
- Chip wears your collectibles on the home screen in six slots: left hand, right hand, hat, neck, floor left and floor right. Keychain and pocket items fit hands, hat or neck; standard and jumbo items fit hands or the floor; desk and giant items fit the floor only; wearables (watches, headsets, glasses...) also fit hat or neck. New items go onto Chip automatically while he has a free slot.
- Gallery tab in the Vault: a shelf per lab with every item you have rolled, rarest first.

## v0.16.0 (2026-10-22)

- New mini game, Assembly Line Rush (🏭 Rush), in the old "Coming soon" spot on the home screen and the bottom bar.
- Parts (🔋 batteries, 💾 chips, ⚙️ gears) ride down a conveyor. Swipe each one into its bin (left, down or right) before it drops off the end. Tapping the bins or using the arrow keys also works.
- A run lasts 45 seconds, and the belt speeds up as it goes. A wrong bin or a dropped part costs one of your 3 lives.
- The score earns a timed income boost for every lab. Viking Raid is not included.
  - 15+ parts: ×2 for 10 minutes
  - 25+ parts: ×3 for 15 minutes
  - 35+ parts: ×4 for 20 minutes
  - 45+ parts: ×5 for 30 minutes
- You get one run every 15 minutes. A new boost replaces the current one only if it is bigger, or the same size with more time left.
- While a boost is running, the Rush button and the home bubble show it with a countdown (for example ×4 12:30).

## v0.15.0 (2026-10-22)

- Viking Raid: a stage is now cleared by maxing out the mine instead of earning a gold goal. Open every shaft, then take every shaft, the lift and the warehouse to the stage's max level.
- Stage 1 has 5 shafts, and each stage adds one, up to 30 from stage 26.
- Max level is 10 on stages 1–5 and rises by 5 every 5 stages, to 55 on stages 46–50. Upgrades stop at the max (the button shows MAX).
- Raids are now quick: about 1.5 minutes for stage 1, rising to about 30 minutes for stage 50 (was 12 hours). Every shaft costs about the same, and prices per stage were fitted with the pacing sim (tests/raid-goals.mjs).
- The goal bar, stage list and home screen show progress toward maxing the mine. Opening a raid shaft now says "New shaft".

## v0.14.2 (2026-10-22)

- Fix: the box under the last floor or shaft ("All 5 shafts open…", "All 30 floors unlocked…") squeezed its text into a narrow column, one word per line. It has no floor number, so its text fell into the number column. It now spans the full width.

## v0.14.1 (2026-10-22)

- Fix: the Funding round list was drawn as scattered, tilted text across the screen. The new cartoon ladder on the home screen shared its style name, so the list picked up the ladder's position and tilt. The ladder now has its own name.

## v0.14.0 (2026-10-22)

A cartoon makeover, styled after polished casual mobile games.

- Meet Chip, the game's robot mascot. He's drawn in code, so he stays sharp at any size. He breathes, blinks, wobbles his antenna and nods.
- New home screen:
  - A garden in front of the lab HQ, with drifting clouds and the mine entrance.
  - Pills at the top for cash and labs beaten, plus a settings gear.
  - A purple progress bar for your funding rounds.
  - Chip holding up a sign with your floor count.
  - Round bobbing bubbles for Map, Viking Raid (with a red ! when a new stage is waiting) and Coming soon.
  - A big glossy green Play button with your lab's name on a purple tab.
- New fonts: Lilita One for headings, numbers and buttons, and Fredoka for everything else. Big labels get white text with a thick outline.
- Glossy, chunky buttons everywhere: Level buttons, Level Up, Unlock, Hire, the bottom bar's round icon badges and the header's cash pill.
- More life in the animations:
  - Floors, the lift and the warehouse squash and stretch when you tap them.
  - Level Up throws out a little burst of stars.
  - "Tap" hints bounce, and upgrade badges wiggle when you can afford them.
  - Panels and toasts spring in.
  - The header coin flips now and then, and the sun pulses while clouds drift by.
- If your phone is set to reduce motion, the idle animations are switched off.

## v0.13.2 (2026-10-22)

- New jump arrows at the bottom left, like Idle Miner. ⬆ appears once you scroll down and glides you back to the top of the mine. ⬇ appears when there is more mine below and glides you down to the deepest floor. You can watch it scroll, and touching the screen stops it.

## v0.13.1 (2026-10-22)

- Hiring a manager from a floor's, the lift's or the warehouse's manager panel now puts them straight to work there. If a rarer manager already works that spot, they stay and the new hire goes to your Owned list. Hiring from the main Managers list still just adds them to Owned.

## v0.13.0 (2026-10-22)

- All 30 map locations are now real labs, each with its own theme, five teams and 30 products (Cinema Studios, Robotics Foundry, EV Auto Plant, Space Port … Moonbase).
- Five labs are open at a time. Seed funding still opens labs 2 to 5. After that, beating a lab (raising its IPO) opens the lab five places on: beat Garage HQ to open Cinema Studios (lab 6), Arcade District to open lab 7, and so on up to lab 30.
- Beaten labs close for good. They show a 🏆 on the map, stop running and can't be entered again, and play moves to another open lab. The Funding panel tells you which lab the IPO will open.
- Difficulty keeps ramping: about 6% longer per lab, from about 14 hours for lab 6 to about 56 hours for lab 30 (efficient play, pacing sim).
- The map list shows your open labs, the ones next to open and what opens them, and your beaten labs.

## v0.12.1 (2026-10-22)

- The warehouse worker now starts at the warehouse, pushes the empty cart over to the lift, loads the money there, and pushes it back. You get paid when the cart is back at the warehouse.

## v0.12.0 (2026-10-22)

- Easier start, steady ramp. Each lab now has its own price level. Times below are for a player who keeps managers on everything (from a new pacing sim, `tests/pace.mjs`):
  - Garage HQ: about 2 hours to IPO (it was about 10 days). Seed in ~3 minutes, Series A ~15 minutes.
  - Arcade District about 3 hours, Archive Library about 4 hours, Maker Workshop about 7.5 hours, Sound Studio about 13 hours.
- New island: Viking Raid, on the map under Islands.
  - 50 Viking mines, generated from the stage number: each has its own name, shaft count (5 to 30) and omens like Rich veins or Frozen ropes.
  - Same shafts, lift and warehouse loop. Managers automate, but there are no manager abilities and no funding rounds.
  - Each stage has a gold goal shown in a bar under the header. Reaching it clears the stage and opens the next.
  - Every stage takes longer: stage 1 about 3 minutes, stage 25 about 45 minutes, stage 50 about 12 hours. The goals are tuned with the pacing sim (`tests/raid-goals.mjs`).
  - In a raid, the Funding button becomes Stages.
- New buy option after Max: Next. It buys up to the next unlock (every 5 levels, so it also stops on the big milestones like 10, 25 and 50). At level 1 it buys 4, at 56 it buys 4, at 60 it buys 5.
- The Level panel always opens on Next, whatever you picked last time. Swiping to the next floor or hub inside the panel keeps your choice.
- New home screen. The game opens on it, with big buttons for Play (back into your current lab), Map, Viking Raid, Settings and a Coming soon placeholder. The 🏠 button at the top right of every lab (and on the map) brings you back to it. Brand-new players still start in the garage with the intro.

## v0.11.5 (2026-10-22)

- Fixed the manager portrait in the Level panel (and the manager cards) being squished flat. It is now a proper square face for every rarity.

## v0.11.4 (2026-10-22)

- Taps register reliably. A press that lifts close to where it started counts as a tap, even if your finger slides slightly or the panel scrolls a hair. Nothing fires twice.
- The Hire button no longer rebuilds itself while you press it, which used to swallow taps.
- No lag after tapping. Buttons darken or squish the moment you touch them, and the screen updates on the very next frame instead of up to 150ms later.
- Changes still animate. The buy-amount chip highlight slides over, and level numbers and stat values pop when they change.
- Bigger touch targets for the x1/x10/x50/Max chips, the ✕ button, the filter tabs and manager buttons.
- Long stat values in the Level panel wrap instead of covering the label.

## v0.11.3 (2026-10-22)

- Smoother animations throughout.
  - The game now steps every screen frame instead of 10 times a second.
  - The warehouse cart and the lift car move with GPU transforms every frame, instead of hopping on a slower timer. The cart also eases in and out at each end.
  - The lift's gold fill and the cycle progress bars fill smoothly every frame.
  - Layout is measured once a second instead of every update, so phones do less work.

## v0.11.2 (2026-10-22)

- x10 and x50 now buy up to the next multiple, like Idle Miner. At level 56, x10 goes to 60. At 60, it goes to 70. At 56, x50 goes to 100. The Level Up label, the cost and the ▲▲ / ▲▲▲ badges follow these amounts.

## v0.11.1 (2026-10-22)

- There is now a road under the lift tower and the warehouse. Each warehouse trip shows a worker pushing a cart of money from the lift to the warehouse, with the amount over the cart. The cart unloads there, you're paid on arrival, and the worker pushes it back empty.
- A warehouse trip now takes 4 seconds there and back, and carries the same amount per second as before.

## v0.11.0 (2026-10-21)

- One tap, one cycle, like Idle Miner. With a manager, it keeps going on its own.
  - Floor: a tap runs one 3-second build cycle, then the crate gets that cycle's products.
  - Lift: a tap sends it down once and back up once. The extra 5-second timer is gone.
  - Warehouse: a tap ships one 3-second trip from the top of the shaft, and you're paid when it arrives.
  - Tapping again while a cycle or trip is running does nothing.
- The number above the lift tower is now what's stored at the top of the shaft, waiting for the warehouse. The number above the warehouse is gone, since your cash is the total.
- The Level panel shows "Per cycle" for floors and "Load per trip" for the warehouse.
- Upgrade badges on Level buttons: ▲ when you can afford 1 level, ▲▲ for 10, and a gold ▲▲▲ for 50.

## v0.10.4 (2026-10-21)

- Bottom bar: Map and Funding swapped. Map is now the big green button in the middle, and Funding sits on the left, pulsing yellow when you can raise.

## v0.10.3 (2026-10-21)

- The Level and manager panels keep one fixed size, so the x1/x10/x50/Max toggle, Level Up and Hire buttons stay in exactly the same spot when you swipe between floors, the lift and the warehouse.

## v0.10.2 (2026-10-21)

- Achievement and unlock pop-ups are smaller and sit low in the middle of the screen, between the floor numbers and the Level buttons, so they no longer cover controls. At most two show at a time, and they clear faster.
- With a panel open, only the newest pop-up shows, at the very top above the panel.
- The 🔄 Update button is now only in Settings.
- The version now includes the build date and time in your local time, e.g. V0.10.2.10.21.26.18:05 (version, MM.DD.YY, HH:MM). It shows at the bottom of each screen and in Settings.

## v0.10.1 (2026-10-21)

- Removed the duplicate Update button from the bottom bar; Update stays at the top. Its spot is now a 🚧 Coming soon (under construction) button.

## v0.10.0 (2026-10-21)

- Idle Miner-style panels: a blue panel with a chunky border, a red ✕, and big ‹ › arrows on the sides. Swipes and arrow keys still work.
- Level panel:
  - The header reads "Floor 3 Level 31" (or Lift / Warehouse).
  - The manager portrait sits beside a yellow progress bar with an arrow, showing the next unlock or "Max level reached."
  - Each stat is a row with an icon and a blue value pill, showing what the next level gives in green.
  - The x1 / x10 / x50 / Max toggle sits bottom left, beside a big green "Level Up xN" button with the cost (hold it to keep buying).
- Manager panel:
  - "Assigned manager" sits on top with a portrait, rarity, boost, timer, a red Unassign and ⚡ Use.
  - Your other managers appear below as cards with a blue Assign button. Busy managers stay greyed at the bottom.
  - A big Hire manager button with the cost is pinned at the bottom. Hiring and assigning keep the panel open.
  - The roster from the bottom bar has filter tabs for Floors, Lift and Warehouse.
- The lift car is bigger and fills with gold as it loads, showing the amount and how full it is (%). A tag above the shaft shows "Lift $load / $capacity · % full".
- Loading takes time now: money pours in at the lift's Loading speed, a new stat in the Lift panel that goes up with lift levels. Unloading at the top drains it the same way.
- Numbered yellow tags on the shaft beside each floor.
- New bottom bar: blue, with a big green Funding button in the middle and an Update button.

## v0.9.0 (2026-10-21)

- Managers look different by rarity, in their seats and in the managers list. Hair and skin vary by name.
  - Common: grey shirt.
  - Uncommon: green shirt and tie.
  - Rare: blue suit, cap and a blue glow.
  - Epic: purple suit, shades and a spinning sparkle ring.
  - Legendary: gold suit, crown and a pulsing gold glow.
  - Super: rainbow suit and ring, a shining crown, a blurred rainbow aura and an orbiting star.
- The lift now works like Idle Miner's elevator.
  - A tap (or a manager) starts a trip, and the trip always finishes.
  - The lift goes down floor by floor, stopping at each floor that has money.
  - At each stop it loads what fits and turns back up as soon as it's full. With room for 10 and 20 waiting on Floor 1, it loads 10 there and comes straight back.
  - Coins fly from the floor's crate into the shaft while it loads. The car in the shaft shows its load and moves to the real floor.
  - Travel time depends on how deep it actually went.

## v0.8.0 (2026-10-21)

Idle Miner Tycoon-style cleanup, based on screenshots of the real game.

- Top bar: one big coin-and-cash pill in the middle with income under it, the lab name on the left and 🔄 Update on the right. The buy amount chips now live in each Level sheet.
- Above ground is one scene: sky, sun and hills, with the lift tower on the left and the warehouse on the right. Each building shows a coin tag with what it's holding (the lift shows the total waiting on the floors, the warehouse shows what's ready to ship), its animation in a window, the manager seat in its doorway and a big blue Level button. A courier pushes a cart between them while the warehouse works.
- Floors are tunnels in brown earth: number and product tag, a cash crate on the left with the money waiting for the lift, the manager seat, the production line (now flowing toward the crate) and a rock face with the big blue Level button. Much less text.
- Tap a manager seat to hire, pick or swap. A ⚡ bolt on the seat fires the manager's ability and shows its timer. A green ▲ on a Level button means you can afford an upgrade. Upgrades happen in the Level sheet.
- Hold the Upgrade button to keep buying, faster the longer you hold, until you let go or run out of cash.
- Managers list: managers already working somewhere else go to the bottom, greyed out, and can't be assigned (unassign them first).
- Map: "Your labs" now sits above the map.

## v0.7.1 (2026-10-21)

- Tapping fast no longer highlights words or pops up a dictionary or long-press menu. Text selection, the tap flash and double-tap zoom are turned off so the game feels like an app.

## v0.7.0 (2026-10-21)

Work animations: you can watch every floor make, pack and move its products.

- Each floor is a small production line. A tech builds the product at the bench, a wrapping machine film-wraps and tapes it into a box, and the conveyor carries it into the "For lift" rack.
- The building tool changes with the tech era: soldering with orange sparks (Early Computing, Mobile Boom), welding with blue-white sparks and a flash (8-Bit & 16-Bit, Smart Devices) and a laser cutter (Flagship Tech).
- As the team grows, extra builders and packers appear, and carriers walk boxes to the rack.
- The lift loads boxes at the bottom, rides them up and unloads them at the top.
- At the warehouse, boxes ride a belt into a truck that fills up, drives off, and comes back for the next load.
- Everything stops when nobody is working, so it's easy to see which floors need a tap or a manager.

## v0.6.2 (2026-10-21)

- The Hire button on the managers screen sits at the top, right under the tabs, so you can hire several in a row without scrolling.

## v0.6.1 (2026-10-21)

- Updates now apply on their own. The app skips the browser's 10-minute cache for its own files, checks for a new version whenever you come back to it, and reloads once when one is ready (your progress is saved first).
- New 🔄 Update button at the top of the lab (and "Check for update" in Settings) saves, grabs the newest version and reloads, so you don't need to pull down to refresh.

## v0.6.0 (2026-10-21)

Idle Miner Tycoon-style upgrade panel and navigation.

- Tap a floor's number, name or "Lv N ›" button (or the Lift or Warehouse "Lv N ›") to open its stats sheet: level out of max, next unlock, a Now vs next-level table with gains in green, the upgrade button with its own ×1/×10/×50/Max chips, live numbers (waiting stock, share of lab output, manager and prestige bonus, lab income and what limits it) and the manager slot.
- Swipe left or right on the sheet, or use the ‹ › arrows or the keyboard arrow keys, to move through Lift, Warehouse and every floor.
- Choosing or hiring a manager from the sheet brings you back to the same floor.
- New bottom bar with Map, Managers, Funding and Settings, like Idle Miner Tycoon's. Funding glows when a round is ready.
- Buy amounts are now ×1, ×10, ×50 and Max (old ×100 saves switch to ×50).

## v0.5.0 (2026-10-21)

Managers rework.

- Hiring now puts the manager in your **Owned** list instead of straight onto a floor. Open it with 👔 in the top bar, or tap "Choose" or "Swap" on any floor, the lift or the warehouse.
- The Owned list is sorted by rarity (VP, then Senior, then Junior) and has tabs for Floor Leads, Lift and Warehouse managers. Pick **Use here** to put one to work, **Unassign** to take one off, or **Sell** one you don't need for half its price.
- Floor Leads can work any floor, so you can move your best one to your most valuable floor.
- Six manager rarities, rolled fresh on every hire: **Super 0.5%, Legendary 1%, Epic 3%, Rare 10%, Uncommon 30%, Common 55.5%**. Rarer managers get bigger boosts (×2 up to ×10), bigger discounts (−40% up to −90%), shorter cooldowns (15 minutes down to 6) and a bigger always-on bonus (none up to +100%). There is no pity counter; every hire is its own roll.
- Managers now have names.
- **Funding rounds now clear your managers.** After a prestige you hire a new team, and hire prices start low again.
- Hire price now grows with each manager of that role you hire (Floor Lead $40, Lift $200, Warehouse $250, ×2.5 each time).
- Saves from earlier versions carry over, with your current managers kept in place (Junior becomes Common, Senior becomes Rare, VP becomes Epic).

## v0.4.0 (2026-10-21)

- The lift (Freight Hub) and the warehouse (Commercial Hub) now sit side by side at the top: lift on the left, warehouse on the right, like Idle Miner Tycoon.
- The lift has its own tap area with a moving car, and the warehouse shows how much money is waiting to ship.

## v0.3.0 (2026-10-21)

Fixes from playing v0.2.0 on a phone.

- Fixed "Tap to build", "Tap to ship" and the other tap prompts staying on screen after you tap. A tapped floor or hub now shows a countdown ("Building… 4s"), and managed ones show "Auto".
- New lighter look: bright sky above ground, light lab floors, white cards, and a light map.
- Every floor now shows a clear "📦 For lift" box with the money waiting there for the lift.
- The Freight & Data Hub now shows the total money waiting on all floors and how much the lift carries per trip.

## v0.2.0 (2026-10-21)

First playable build.

- 30 R&D floors in Garage HQ, from a four-function calculator to an AI neural accelerator.
- Freight & Data Hub and Commercial & Cloud Hub, with income limited by the slowest of the three. The slow one is marked **Bottleneck**.
- Tap floors and hubs to work them; hire managers (Junior, Senior, VP) to automate them. Each manager has a timed ability with a cooldown.
- An unlock every 5 levels: +10% on floors, +2% on hubs, with bigger milestones at levels 10, 25, 50, 100 and up.
- Funding rounds (prestige): Seed, Series A, B, C and IPO. Floors 6, 11, 19 and 26 start new tech eras and stay locked until you raise the matching round. Raising resets the lab, keeps your managers and multiplies income for good.
- Map with 30 locations. Five labs are playable (Garage HQ, Arcade District, Archive Library, Maker Workshop, Sound Studio); each one opens when the previous lab raises Seed. Locations 6–30 show a lock and "Coming soon".
- Offline earnings for managed nodes, up to 2 hours.
- Installable on your phone's home screen, works offline after the first load.

## v0.1 (2026-10-21)

Design document only: Idle Miner Tycoon research, the 30-floor plan, balance formulas, managers and prestige concept.
