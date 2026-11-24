# Shared modules

- `three/`: the Three.js modules the studies import, with its license.
- `uqr/`: the QR code encoder of the LW16 card, copied from the `uqr` npm package.
- `dialkit/`: the plain JavaScript build of DialKit 2.2.1 (`dist/vanilla/index.js` and `styles.css` of the `dialkit` npm package, MIT), for the panel of the card from light.
- `fonts/`: the types of the note in the card box. Geist Pixel Square is from the Launch Week 16 site. New Rocker and the four letters of "LW16" from Reggae One are from Google Fonts, with their licenses.

Keep these modules out of the study folders, so removing a study does not remove another study's runtime.
