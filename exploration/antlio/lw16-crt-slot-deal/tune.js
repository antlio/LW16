// the panel of a scene, made with DialKit (github.com/joshpuckett/dialkit): the values of
// its look in a panel, and the steps of its time as bars in a timeline. DialKit keeps the
// changed values in the browser of the person, so they are there after a reload

import {
  createDialKit,
  createDialRoot,
  createDialTimeline,
  createDialTimelineRoot,
} from '../shared/dialkit/dialkit.js'

// the picker of DialKit can give a color in a form that three.js does not read, so each
// color goes through a canvas, which gives its red, green and blue
const ink = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext(
  '2d',
  { willReadFrequently: true }
)
const hexOf = (color) => {
  ink.fillStyle = color
  ink.fillRect(0, 0, 1, 1)
  const [red, green, blue] = ink.getImageData(0, 0, 1, 1).data
  return `#${[red, green, blue].map((part) => part.toString(16).padStart(2, '0')).join('')}`
}

// the changed values stay in the browser only while the first values in the code are the
// same. so a change of the code shows, and the values of the person do not hide it
export const keyOf = (name, config) =>
  `${name}-${[...JSON.stringify(config)].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7)}`

// groups has the rows of each group. a row is a name, the thing that has the value, and the
// key of the value. a number also has its limits and its step. a text that starts with # is
// a color. make is the seconds in which the card is made. after has the steps that come
// when it is made: the name of each, and its seconds from that moment. parent is the thing
// that has the scene
export const openPanel = ({
  parent,
  clock,
  playSound,
  stopSound,
  make,
  after,
  groups,
  onChange,
}) => {
  document.head.append(
    Object.assign(document.createElement('link'), {
      rel: 'stylesheet',
      href: new URL('../shared/dialkit/styles.css', import.meta.url),
    })
  )
  // with the versions as a menu, the panel is less high than with the versions as pictures.
  // so it covers less of the timeline
  createDialRoot({ theme: 'dark', versions: 'menu' })
  const dock = createDialTimelineRoot({ theme: 'dark' })
  // the timeline is over the lower part of the window, so the scene gets the part over it
  const fit = () => {
    const { top, height } = dock.element.getBoundingClientRect()
    parent.style.height = height ? `${top}px` : ''
  }
  new ResizeObserver(fit).observe(dock.element)
  addEventListener('resize', fit)

  const isColor = (object, key) => String(object[key]).startsWith('#')
  const colors = new Set(
    Object.values(groups).flatMap((rows) =>
      rows.filter(([, object, key]) => isColor(object, key)).map(([label]) => label)
    )
  )
  const lookConfig = {
    ...Object.fromEntries(
      Object.entries(groups).map(([group, rows], index) => [
        group,
        {
          _collapsed: index > 0,
          ...Object.fromEntries(
            rows.map(([label, object, key, ...limits]) => [
              label,
              limits.length
                ? [object[key], ...limits]
                : { type: isColor(object, key) ? 'color' : 'text', default: object[key] },
            ])
          ),
        },
      ])
    ),
    'Reset values': { type: 'action' },
  }
  const look = createDialKit('Card from light', lookConfig, {
    id: keyOf('lw16-claim-look', lookConfig),
    persist: true,
    onAction: () => look.resetValues(),
  })
  look.subscribe((values) => {
    for (const [group, rows] of Object.entries(groups)) {
      for (const [label, object, key] of rows) {
        object[key] = colors.has(label) ? hexOf(values[group][label]) : values[group][label]
      }
    }
    onChange()
  })

  // each step is a bar with no values of its own: the scene reads only where the bar
  // starts and how long it is
  const timeConfig = {
    duration: make[1] + Math.max(...Object.values(after).map(([, to]) => to)) + 0.6,
    make: { at: make[0], duration: make[1] - make[0] },
    ...Object.fromEntries(
      Object.entries(after).map(([name, [from, to]]) => [
        name,
        { at: make[1] + from, duration: to - from },
      ])
    ),
  }
  const time = createDialTimeline('Card from light', timeConfig, {
    id: keyOf('lw16-claim-time', timeConfig),
    persist: true,
  })
  clock.isDriven = true
  let last = { time: 0, playing: false }
  time.subscribe((values) => {
    make[0] = values.make.at
    make[1] = values.make.at + values.make.duration
    for (const [name, seconds] of Object.entries(after)) {
      seconds[0] = values[name].at - make[1]
      seconds[1] = values[name].at + values[name].duration - make[1]
    }
    clock.seconds = values.time
    // the sound has no place to start from but its start, so it is only for a play from 0
    const hasJumped = Math.abs(values.time - last.time) > 0.25
    if (hasJumped || !values.playing) stopSound()
    if (values.playing && (hasJumped || !last.playing) && values.time < 0.1) playSound()
    last = { time: values.time, playing: values.playing }
  })
}
