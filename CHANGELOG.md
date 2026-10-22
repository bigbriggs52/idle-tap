# Changelog

Every update gets a version number. The game shows its version in Settings and at the bottom of each screen.

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
