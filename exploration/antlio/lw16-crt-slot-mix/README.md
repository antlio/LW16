# LW16 monitor card slot, mix

Open `/lw16-crt-slot-mix/`. The page has the bare monitor with the dot screen, and the white card on its side. The bar at the top has one list:

- **Start**: Card made from light (`?start=claim`), or Card in a box, 3D, reader in the lid (`?start=boxreader`). Both are in `../lw16-crt-slot-deal/`.

`?today=` and `?handle=` work as on the first page.

## How it is built

- `mix.js` gets the page of the bare monitor, and takes its styles, its SVG parts and its `main`. A change to that study shows here with no other change.
- Then it adds the canvases of the dot screen and the card, and loads `../lw16-crt-slot/slot.js`, `../lw16-crt-slot-foil/white.js?wide`, `../lw16-crt-slot-dots/screen.js` and the script of the start.
- A new start loads the page again, because the scripts of the studies keep state.

## Verification

Checked in headless Chromium at 1440 x 900, and in the gallery preview: both starts load with no console errors and no missing files. In Card made from light, a press, Enter and Escape do nothing after the card is made. In the box, the card goes from its pocket into the slot and the screen comes on.

Not checked: WebKit, a phone, touch, and the sounds.
