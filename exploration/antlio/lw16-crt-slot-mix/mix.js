// a start is a scene that covers the page. the first one is the start with no choice in the address
const STARTS = {
  claim: {
    script: '../lw16-crt-slot-deal/claim.js?v=34',
    sheet: '../lw16-crt-slot-deal/claim.css?v=7',
  },
  boxreader: {
    script: '../lw16-crt-slot-deal/box3d-screen.js?v=53',
    sheet: '../lw16-crt-slot-deal/box3d-tap.css?v=2',
  },
  boxunder: {
    script: '../lw16-crt-slot-deal/box3d-screen.js?v=53&under',
    sheet: '../lw16-crt-slot-deal/box3d-tap.css?v=2',
  },
  boxlight: {
    script: '../lw16-crt-slot-deal/box3d-screen.js?v=53&light',
    sheet: '../lw16-crt-slot-deal/box3d-tap.css?v=2',
  },
  claimbox: {
    script: '../lw16-crt-slot-deal/box3d-screen.js?v=53&claim&note=pixel',
    sheet: '../lw16-crt-slot-deal/box3d-tap.css?v=4',
  },
  boxpixel: {
    script: '../lw16-crt-slot-deal/box3d-screen.js?v=53&note=pixel',
    sheet: '../lw16-crt-slot-deal/box3d-tap.css?v=2',
  },
  boxpunk: {
    script: '../lw16-crt-slot-deal/box3d-screen.js?v=53&note=punk',
    sheet: '../lw16-crt-slot-deal/box3d-tap.css?v=2',
  },
  boxrock: {
    script: '../lw16-crt-slot-deal/box3d-screen.js?v=53&note=rock',
    sheet: '../lw16-crt-slot-deal/box3d-tap.css?v=2',
  },
}
const start = STARTS[new URLSearchParams(location.search).get('start')] ?? STARTS.claim
// the monitor is the page of the bare study, so a change to that study shows here too
const page = new URL('../lw16-crt-slot-bare/', location.href)
const source = new DOMParser().parseFromString(
  await (await fetch(page, { cache: 'no-cache' })).text(),
  'text/html'
)
const sheets = [...source.querySelectorAll('link[rel="stylesheet"]')].map(
  (link) => new URL(link.getAttribute('href'), page).href
)
// the sheet of the wide card goes after those of the monitor, because some monitors set the card width
sheets.push(
  '../lw16-crt-slot-foil/foil.css?v=1',
  '../lw16-crt-slot-foil/wide.css?v=1',
  '../lw16-crt-slot-dots/dots.css?v=3',
  start.sheet
)
// the page shows only when its styles are there, so it does not flash with no style
await Promise.all(
  sheets.map(
    (href) =>
      new Promise((done) => {
        const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href })
        link.onload = link.onerror = done
        document.head.append(link)
      })
  )
)

const main = document.adoptNode(source.querySelector('main'))
main
  .querySelector('#card')
  .insertAdjacentHTML('beforeend', '<canvas class="foil" id="foil" aria-hidden="true"></canvas>')
main
  .querySelector('.picture')
  .insertAdjacentHTML(
    'afterbegin',
    '<canvas class="glow" id="glow" width="160" height="100" aria-hidden="true"></canvas>' +
      '<canvas class="dots" id="dots" width="160" height="100" aria-hidden="true"></canvas>'
  )
document.body.append(document.adoptNode(source.querySelector('.defs')), main)

// slot.js writes the name on the card, and the script of the card reads it, so the order is fixed
await import('../lw16-crt-slot/slot.js?v=2')
await import('../lw16-crt-slot-foil/white.js?v=4&wide')
await import('../lw16-crt-slot-dots/screen.js?v=3')
await import(new URLSearchParams(location.search).has('light') ? `${start.script}&light` : start.script)
