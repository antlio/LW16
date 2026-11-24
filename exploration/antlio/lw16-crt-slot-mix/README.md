# LW16 monitor card slot, mix

Open `/lw16-crt-slot-mix/`. A scene covers the page, and the address says which one (`?start=`):

- `claim` (with no choice in the address): the card is made from light.
- `boxreader`: the card is in a box, and the screen and the slot are in its lid.
- `boxunder`: the same box with only the slot in its lid, and the screen under the card.

All are in `../lw16-crt-slot-deal/`. The card is the white card on its side. The page under the scene is the bare monitor with the dot screen. It does not show: the boxes use its reader for the text of their screen. `?today=` and `?handle=` work as on the first page.

## How it is built

- `mix.js` gets the page of the bare monitor, and takes its styles, its SVG parts and its `main`. A change to that study shows here with no other change.
- Then it adds the canvases of the dot screen and the card, and loads `../lw16-crt-slot/slot.js`, `../lw16-crt-slot-foil/white.js?wide`, `../lw16-crt-slot-dots/screen.js` and the script of the start.
- `mix.css` hides the page, so it does not show before the scene is there.

## Verification

Checked in headless Chromium at 1440 x 900, and in the gallery preview: the three starts load with no console errors and no missing files, and the page under the scene does not show before the scene is there. In Card made from light, a press, Enter and Escape do nothing after the card is made. In the two boxes, the card goes from its pocket into the slot and the screen comes on.

Not checked: WebKit, a phone, touch, and the sounds.
