import { UNION } from '../lw16-crt-slot/mark.js'
import { FONT } from './font.js'
import { BOOT_MS } from '../lw16-crt-slot/slot.js?v=2'

// the screen is this many dots. the canvas in the page has the same size
const GRID = { w: 160, h: 100 }
const INK = { green: '#3ecf8e', white: '#e6f1eb', amber: '#f0b35a', dim: '#1f6b4a' }
// the calm screen is the globe, one label and the big line. it has no rulers, status, third line or ticker
const isCalm = new URL(import.meta.url).searchParams.has('calm')
// the globe is big while the monitor reads the card, then it goes up to make room for the text
const GLOBE = {
  boot: { x: 80, y: 38, r: 27 },
  live: isCalm ? { x: 80, y: 34, r: 18 } : { x: 80, y: 30, r: 14 },
  tilt: 0.38,
  turnsPerSecond: 0.14,
  settleSeconds: 0.5,
  // a globe with a radius above this has all its lines
  fine: 20,
}
// the last picture stays a little, as the light of a tube does
const FADE = 0.42
const TICKER_DOTS_PER_SECOND = 14
const MARGIN = 6
const KICKER_Y = isCalm ? 59 : 49

const at = (id) => document.getElementById(id)
const crt = at('crt')
// a page with this line shows it while the monitor has no card
const idle = at('idle')
const ctx = at('dots').getContext('2d')
const glow = at('glow').getContext('2d')
const mark = new Path2D(UNION)
const isMotionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches

// wide and tall are the size of one dot of a letter, in dots of the screen
const drawText = ({ text, x, y, color, wide = 1, tall = 1, align = 'left' }) => {
  const width = text.length * 6 * wide - wide
  const left = Math.round(x - (align === 'right' ? width : align === 'center' ? width / 2 : 0))
  ctx.fillStyle = color
  for (const [index, char] of [...text].entries()) {
    for (const [row, bits] of (FONT[char] ?? []).entries()) {
      for (let column = 0; column < 5; column++) {
        if (bits & (16 >> column))
          ctx.fillRect(left + (index * 6 + column) * wide, y + row * tall, wide, tall)
      }
    }
  }
}

// a globe of lines with the supabase mark in it. the lines on the far side are dim
const drawGlobe = ({ x, y, r, yaw }) => {
  const [sinTilt, cosTilt] = [Math.sin(GLOBE.tilt), Math.cos(GLOBE.tilt)]
  const plot = (px, py, pz) => {
    const isNear = py * sinTilt + pz * cosTilt > 0
    ctx.globalAlpha = isNear ? 0.75 : 0.2
    ctx.fillRect(Math.round(x + px * r), Math.round(y - (py * cosTilt - pz * sinTilt) * r), 1, 1)
  }
  ctx.fillStyle = INK.white
  // a small globe has fewer lines, or they join into one white disk
  const [meridians, parallels] = r > GLOBE.fine ? [6, [-2, -1, 0, 1, 2]] : [3, [-1.3, 0, 1.3]]
  const steps = Math.ceil(r * 8)
  for (let step = 0; step < steps; step++) {
    const angle = (step / steps) * Math.PI * 2
    for (let meridian = 0; meridian < meridians; meridian++) {
      const longitude = yaw + (meridian * Math.PI) / meridians
      plot(
        Math.cos(angle) * Math.sin(longitude),
        Math.sin(angle),
        Math.cos(angle) * Math.cos(longitude)
      )
    }
    for (const parallel of parallels) {
      const latitude = (parallel * Math.PI) / 6
      plot(
        Math.cos(latitude) * Math.cos(angle),
        Math.sin(latitude),
        Math.cos(latitude) * Math.sin(angle)
      )
    }
  }
  ctx.globalAlpha = 1

  const scale = (r * 1.1) / 113
  ctx.save()
  ctx.translate(x - 54.5 * scale, y - 56.5 * scale)
  ctx.scale(scale, scale)
  // the mark takes away the lines behind it, so its outline reads
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fill(mark)
  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = INK.green
  ctx.lineWidth = 1.4 / scale
  ctx.lineJoin = 'round'
  ctx.stroke(mark)
  ctx.restore()
}

const drawRulers = () => {
  ctx.fillStyle = INK.dim
  for (let x = MARGIN; x <= GRID.w - MARGIN; x += 2) {
    const tick = (x - MARGIN) % 20 ? 1 : 3
    ctx.fillRect(x, 1, 1, tick)
    ctx.fillRect(x, GRID.h - 1 - tick, 1, tick)
  }
}

const drawBoot = (seconds) => {
  drawText({
    text: `READING CARD${'.'.repeat(1 + (Math.floor(seconds * 4) % 3))}`,
    x: 44,
    y: 72,
    color: INK.green,
  })
  drawText({
    text: at('boot-card').textContent.toUpperCase(),
    x: 80,
    y: 83,
    color: INK.white,
    align: 'center',
  })
  ctx.fillStyle = INK.amber
  const blocks = Math.floor(Math.min((seconds * 1000) / BOOT_MS, 1) * 25)
  for (let block = 0; block < blocks; block++) ctx.fillRect(30 + block * 4, 93, 3, 2)
}

const drawLive = (seconds) => {
  const read = (id) => at(id).textContent.toUpperCase()
  drawText({ text: read('kicker'), x: 80, y: KICKER_Y, color: INK.amber, align: 'center' })
  // a long headline has tall thin letters, so it stays on one line
  const headline = read('headline')
  const isWide = headline.length <= 12
  drawText({
    text: headline,
    x: 80,
    y: KICKER_Y + 10,
    color: INK.green,
    wide: isWide ? 2 : 1,
    tall: 2,
    align: 'center',
  })
  if (isCalm) return

  ctx.fillStyle = INK.amber
  ctx.fillRect(MARGIN, 6, 29, 1)
  ctx.fillRect(MARGIN, 16, 29, 1)
  ctx.fillRect(MARGIN, 6, 1, 11)
  ctx.fillRect(MARGIN + 28, 6, 1, 11)
  drawText({ text: 'LW16', x: MARGIN + 3, y: 8, color: INK.amber })
  drawText({ text: read('status'), x: GRID.w - MARGIN, y: 8, color: INK.white, align: 'right' })
  drawText({ text: read('sub'), x: 80, y: 77, color: INK.green, align: 'center' })

  // one line of text that goes from right to left without end
  const ticker = `${read('holder')} * ${read('dates')} * `
  const width = ticker.length * 6
  const start = isMotionReduced ? 0 : -Math.floor((seconds * TICKER_DOTS_PER_SECOND) % width)
  ctx.save()
  ctx.beginPath()
  ctx.rect(MARGIN, 87, GRID.w - MARGIN * 2, 7)
  ctx.clip()
  for (let x = MARGIN + start; x < GRID.w; x += width)
    drawText({ text: ticker, x, y: 87, color: INK.white })
  ctx.restore()
}

const drawIdle = () => {
  ctx.clearRect(0, 0, GRID.w, GRID.h)
  drawText({
    text: idle.textContent.toUpperCase(),
    x: 80,
    y: 43,
    color: INK.green,
    wide: 2,
    tall: 2,
    align: 'center',
  })
}

const copyToGlow = () => {
  glow.clearRect(0, 0, GRID.w, GRID.h)
  glow.drawImage(ctx.canvas, 0, 0)
}

let frame = 0
let poweredAt = 0
let liveAt = 0

const tick = (now) => {
  const isLive = !at('live').hidden
  if (isLive && !liveAt) liveAt = now
  // the fade takes light away and puts no black down, so a dot that is off shows the screen
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = `rgb(0 0 0 / ${FADE})`
  ctx.fillRect(0, 0, GRID.w, GRID.h)
  ctx.globalCompositeOperation = 'source-over'

  const settled = isLive ? Math.min((now - liveAt) / 1000 / GLOBE.settleSeconds, 1) : 0
  const eased = 1 - (1 - settled) ** 3
  const between = (key) => GLOBE.boot[key] + (GLOBE.live[key] - GLOBE.boot[key]) * eased
  const seconds = (now - poweredAt) / 1000
  if (!isCalm) drawRulers()
  drawGlobe({
    x: between('x'),
    y: between('y'),
    r: between('r'),
    yaw: isMotionReduced ? 0.6 : seconds * GLOBE.turnsPerSecond * Math.PI * 2,
  })
  if (settled === 1) drawLive((now - liveAt) / 1000 - GLOBE.settleSeconds)
  if (!isLive) drawBoot(seconds)

  frame = crt.dataset.power === 'on' ? requestAnimationFrame(tick) : 0
  if (!frame && idle) drawIdle()
  copyToGlow()
}

if (idle) {
  drawIdle()
  copyToGlow()
}

// slot.js sets data-power on the monitor. the screen draws only while it is on
new MutationObserver(() => {
  if (crt.dataset.power !== 'on') return
  poweredAt = performance.now()
  liveAt = 0
  ctx.clearRect(0, 0, GRID.w, GRID.h)
  if (!frame) frame = requestAnimationFrame(tick)
}).observe(crt, { attributes: true, attributeFilter: ['data-power'] })
