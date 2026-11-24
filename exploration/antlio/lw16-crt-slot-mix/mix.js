// the start is what the page shows before the card is free
const STARTS = {
  claim: {
    label: 'Card made from light',
    script: '../lw16-crt-slot-deal/claim.js?v=12',
    sheet: '../lw16-crt-slot-deal/claim.css?v=4',
  },
  boxreader: {
    label: 'Card in a box, 3D, reader in the lid',
    script: '../lw16-crt-slot-deal/box3d-screen.js?v=17',
    sheet: '../lw16-crt-slot-deal/box3d-tap.css?v=2',
  },
}

const params = new URLSearchParams(location.search)
const form = document.getElementById('mix')
// the first start is the one with no choice in the address
const startChoice = params.get('start') in STARTS ? params.get('start') : Object.keys(STARTS)[0]
for (const [key, { label }] of Object.entries(STARTS)) {
  form.elements.start.add(new Option(label, key, false, key === startChoice))
}

// the scripts of the studies keep state and listeners, so a new choice loads the page again
form.addEventListener('change', (event) => {
  params.set(event.target.name, event.target.value)
  location.search = params
})

const start = STARTS[startChoice]
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
await import(start.script)
