import { DAYS } from '../lw16-card-flow/stamps.js'
import { weekOn } from '../lw16-landing/week.js'
import { powerOff, powerOn, tick, unlock } from './sound.js?v=1'

// fast, with a small overshoot when the card comes back out
const SPRING = { stiffness: 420, damping: 34 }
// the part of the card height that goes into the monitor
const DEPTH = 0.45
// the part of that depth the card moves before a release takes it to the other end
const RELEASE = 0.3
// a release carries the card on for this many seconds of its speed
const FLICK = 0.1
// how far the card can go past its two ends, in pixels
const STRETCH = { out: 60, slot: 6 }
export const BOOT_MS = 1300
const HINTS = {
  off: 'Drag your card up into the slot of the monitor.',
  on: 'Pull the card out to switch the monitor off.',
}

const query = new URLSearchParams(location.search)
const handle = query.get('handle') ?? 'antlio'
// ?today=2026-12-07 shows the monitor as it is on that day, from 09:00 UTC
const today = query.get('today')
const clockOffset = today ? Date.parse(`${today}T09:00:00Z`) - Date.now() : 0

const at = (id) => document.getElementById(id)
const crt = at('crt')
const card = at('card')
const isMotionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches

at('card-handle').textContent = `@${handle}`
at('boot-card').textContent = `Card 0042 · @${handle}`
at('holder').textContent = `No. 0042 · @${handle}`
at('hint').textContent = HINTS.off

const two = (value) => String(value).padStart(2, '0')

const countdown = (ms) => {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(seconds / 86400)
  const clock = [seconds / 3600 % 24, seconds / 60 % 60, seconds % 60].map((part) => two(Math.floor(part)))
  return `${days ? `${days}d ` : ''}${clock.join(':')}`
}

const showLive = () => {
  const now = Date.now() + clockOffset
  const days = weekOn(new Date(now).toISOString().slice(0, 10), DAYS.length)
  const live = days.findIndex((day) => day.isLive)
  const next = days.find((day) => day.isLocked)
  const left = next ? countdown(Date.parse(next.date) - now) : ''
  const [status, kicker, headline, sub] =
    live >= 0
      ? [
          `Day ${live + 1}/${days.length}`,
          'Launch of the day',
          DAYS[live].feature,
          next ? `Next launch in ${left}` : 'Last launch of the week',
        ]
      : next
        ? ['Standby', 'First launch in', left, `${days.length} days, ${days.length} launches`]
        : ['Off air', 'Launch Week 16', 'That is a wrap', `${days.length} launches shipped`]
  at('status').textContent = status
  at('kicker').textContent = kicker
  at('headline').textContent = headline
  at('sub').textContent = sub
  at('dates').textContent = new Date(now).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
  at('boot').hidden = true
  at('live').hidden = false
}

let isOn = false
let bootTimer = 0
let clock = 0

const power = (next) => {
  isOn = next
  crt.dataset.power = isOn ? 'on' : 'off'
  card.setAttribute('aria-pressed', isOn)
  at('hint').textContent = isOn ? HINTS.on : HINTS.off
  clearTimeout(bootTimer)
  clearInterval(clock)
  if (!isOn) return powerOff()
  powerOn()
  at('boot').hidden = false
  at('live').hidden = true
  bootTimer = setTimeout(() => {
    showLive()
    clock = setInterval(showLive, 1000)
  }, BOOT_MS)
}

// y is how far the card is from its place under the monitor, and up is negative
let y = 0
let velocity = 0
let isSeatWanted = false
let frame = 0
let lastFrame = 0
let grab = null
let wasDragged = false

// the top of the card is on the mouth of the slot at mouth(), and at its end at seat()
const mouth = () => -card.offsetTop
const seat = () => mouth() - card.offsetHeight * DEPTH
const contact = () => seat() + card.offsetHeight * DEPTH * RELEASE

const place = (next) => {
  if (y > mouth() !== next > mouth()) tick()
  y = next
  card.style.translate = `0 ${y}px`
  if (!isOn && y <= seat() + 1) power(true)
  if (isOn && y > contact()) power(false)
}

const step = (time) => {
  const target = isSeatWanted ? seat() : 0
  const dt = Math.min((time - lastFrame) / 1000, 1 / 30)
  lastFrame = time
  velocity += (SPRING.stiffness * (target - y) - SPRING.damping * velocity) * dt
  // the slot has a hard end, so the card stops there with no overshoot
  const next = Math.max(y + velocity * dt, seat())
  const isResting =
    (isSeatWanted && next === seat()) || (Math.abs(target - next) < 0.2 && Math.abs(velocity) < 5)
  if (isResting) velocity = 0
  place(isResting ? target : next)
  frame = isResting ? 0 : requestAnimationFrame(step)
}

const settle = () => {
  if (isMotionReduced) return place(isSeatWanted ? seat() : 0)
  if (frame) return
  lastFrame = performance.now()
  frame = requestAnimationFrame(step)
}

const stretch = (over, limit) => over / (1 + Math.abs(over) / limit)

card.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return
  unlock()
  card.setPointerCapture(event.pointerId)
  cancelAnimationFrame(frame)
  frame = 0
  velocity = 0
  grab = { offset: event.clientY - y, wasOn: isOn, lastY: event.clientY, lastTime: event.timeStamp }
})

card.addEventListener('pointermove', (event) => {
  if (!grab) return
  const raw = event.clientY - grab.offset
  const free = Math.min(Math.max(raw, seat()), 0)
  place(free + stretch(raw - free, raw > 0 ? STRETCH.out : STRETCH.slot))
  const dt = (event.timeStamp - grab.lastTime) / 1000
  if (dt > 0) velocity = 0.6 * ((event.clientY - grab.lastY) / dt) + 0.4 * velocity
  if (Math.abs(event.clientY - grab.lastY) > 0) wasDragged = true
  grab.lastY = event.clientY
  grab.lastTime = event.timeStamp
})

const release = (event) => {
  if (!grab) return
  // a pointer that stopped before the release gives the card no speed
  if (event.timeStamp - grab.lastTime > 80) velocity = 0
  const line = seat() + card.offsetHeight * DEPTH * (grab.wasOn ? RELEASE : 1 - RELEASE)
  isSeatWanted = y + velocity * FLICK < line
  grab = null
  settle()
}

card.addEventListener('pointerup', release)
card.addEventListener('pointercancel', (event) => {
  release(event)
  wasDragged = false
})

// a press with no drag, or Enter or Space, puts the card in or takes it out
card.addEventListener('click', () => {
  if (wasDragged) return (wasDragged = false)
  unlock()
  isSeatWanted = !isSeatWanted
  settle()
})

addEventListener('resize', () => {
  if (!grab && !frame) place(isSeatWanted ? seat() : 0)
})
