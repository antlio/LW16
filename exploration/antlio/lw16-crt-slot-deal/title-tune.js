// a DialKit panel for the "LW16" of the note: its type, its weight, and its form. the types
// come from Google Fonts. the panel keeps the changed values in the browser of the person

import { createDialKit, createDialRoot } from '../shared/dialkit/dialkit.js'
import { keyOf } from './tune.js?v=6'

// the weights of a type that has more than one. a type with no weights has only 400
const FONTS = {
  'Geist Pixel Square': null,
  'Rubik Glitch': null,
  'Rubik Wet Paint': null,
  'Rubik Spray Paint': null,
  'Rubik Dirt': null,
  'Permanent Marker': null,
  'Sedgwick Ave Display': null,
  'Special Elite': null,
  'Black Ops One': null,
  'New Rocker': null,
  'Reggae One': null,
  Bungee: null,
  Oswald: '200..700',
  Unbounded: '200..900',
}

export const openTitlePanel = async ({ title, theme, onChange }) => {
  const families = Object.entries(FONTS)
    .filter(([family]) => family !== 'Geist Pixel Square')
    .map(([family, weights]) =>
      `family=${family.replaceAll(' ', '+')}${weights ? `:wght@${weights}` : ''}`
    )
    .join('&')
  // a font face is known only when its sheet is there, so the panel waits for the sheet
  await Promise.all(
    [
      `https://fonts.googleapis.com/css2?${families}&display=block`,
      new URL('../shared/dialkit/styles.css', import.meta.url).href,
    ].map(
      (href) =>
        new Promise((done) => {
          const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href })
          link.onload = link.onerror = done
          document.head.append(link)
        })
    )
  )
  createDialRoot({ theme, position: 'top-left' })
  const config = {
    Title: {
      Font: { type: 'select', options: Object.keys(FONTS), default: title.font },
      Weight: [title.weight, 100, 900, 100],
      Heavy: [title.heavy, 0, 0.2, 0.005],
      Lean: [title.lean, -0.4, 0.4, 0.01],
      Wide: [title.wide, 0.5, 1.6, 0.01],
      Height: [title.height, 60, 260, 1],
    },
    'Reset values': { type: 'action' },
  }
  const panel = createDialKit('Box title', config, {
    id: keyOf('lw16-box-title', config),
    persist: true,
    onAction: () => panel.resetValues(),
  })
  panel.subscribe(async ({ Title }) => {
    title.font = Title.Font
    title.weight = Title.Weight
    title.heavy = Title.Heavy
    title.lean = Title.Lean
    title.wide = Title.Wide
    title.height = Title.Height
    // a canvas draws only with a font that is there
    await document.fonts.load(`${title.weight} 200px "${title.font}"`, 'LW16')
    onChange()
  })
}
