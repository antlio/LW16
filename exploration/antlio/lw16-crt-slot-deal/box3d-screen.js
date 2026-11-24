// the box is the reader. the scene is over the page, with no buttons: the person presses and
// moves the things of the scene. the mark of the lid opens the box. a press on the rest of
// the box makes it jump, and two presses that are near in time open it. the cell of the
// mark, on the inner side of the lid, is a screen with a slot under it. the person moves
// the card from its pocket up into the slot, and the screen comes on. the scene is in a dialog, so the page under it
// takes no input

import * as THREE from 'three'
import { RoundedBoxGeometry } from '../shared/three/RoundedBoxGeometry.js'
import { UNION } from '../lw16-crt-slot/mark.js'
import {
  CARD,
  createCard,
  createFoilMaterial,
  drawPaperCard,
} from '../lw16-crt-slot-foil/card3d.js?v=2'
import { shown } from '../lw16-crt-slot-foil/foil.js?v=3'
import { unlock } from '../lw16-crt-slot/sound.js?v=1'
import { createBloom } from './bloom.js?v=2'
import {
  playCardIn,
  playCardOut,
  playCreate,
  playKnock,
  playOpen,
} from './box-sound.js?v=12'

// wall is how thick the sides of the box are, and tilt leans its top away, so its under side shows
const BOX = { side: 1.3, depth: 0.32, lid: 0.12, radius: 0.012, wall: 0.02, tilt: -0.16 }
// the note and the pocket of the card are on a sheet in the box. the sheet is under the rim
// of the box by sunk, and the pocket goes down into it by pocket
const SHEET = { sunk: 0.028, deep: 0.07, pocket: 0.035 }
// the scene is made for a column of 9 to 16. a window that is less wide moves the camera back
const VIEW = { fov: 28, distance: 8, column: 9 / 16 }
// where things are, in units from the middle of the window
const PLACES = {
  closed: new THREE.Vector3(0, 0, 0),
  // the open box is near, so the note can be read. its lid is over it, so its middle is low
  open: new THREE.Vector3(0, -0.65, 1.8),
}
// the seconds after the box opens
const TIMES = { lid: [0, 1.1], light: [0.3, 1.1] }
// with "under" in its address, the lid has only the slot, in the middle of the cell of the
// mark. the screen is then the floor of the pocket, so the card is on it
const isScreenUnder = new URL(import.meta.url).searchParams.has('under')
// with "light" in its address, the box is white paper with a light lining, in a light room.
// pick has the dark value first, then the light one
const isLight = new URL(import.meta.url).searchParams.has('light')
const pick = (dark, light) => (isLight ? light : dark)
// the note of the box has other forms, by "note" in the address. rock: its "LW16" is in New
// Rocker, a type of rock posters. punk: it is in Reggae One, with a lean, and the note has
// another order. pixel: that order, with "LW16" in Geist Pixel
const NOTE_TYPE = new URL(import.meta.url).searchParams.get('note')
// with "claim" in its address, the card is first made from light (light-build.js), with no
// box, and it turns on its side when the light of its foil is at the end of its way. as it
// turns, the open box comes out of the room behind it, the card goes to its pocket, and the
// tabs hold it (hold). after that the scene is the open box with no card made first. the
// seconds are from the start of the scene. place is where the card is made, and lean is the
// small turn and the lean of the card at first
const CLAIM = {
  make: [0.1, 4.5],
  turn: [5.16, 6.16],
  box: [5.16, 6.6],
  pack: [6.9, 8.2],
  hold: [8.2, 8.5],
  place: new THREE.Vector3(0, 0.3, 2.5),
  lean: { yaw: 0.5, roll: -0.1 },
}
// the screen is the cell of the mark on the inner side of the lid: only glass, with pad of
// paper around it. bulge is how round the glass is. picture is the size of what it shows,
// in pixels, and lines is how many lines the tube has
const SCREEN = {
  ratio: 16 / 10,
  pad: 0.02,
  radius: 0.03,
  bulge: 0.22,
  picture: { w: 800, h: 500 },
  ink: '#e9f0ea',
  lines: 110,
}
// the slot is a line in the paper, this far under the glass, in the middle of the paper
// that the cell has there. depth is the part of the height of the card that goes into it
const SLOT = { w: 0.7, depth: 0.55, under: 0.06 }
// the globe of the screen: how far it leans to the window, and its turn in each second
const GLOBE = { tilt: 0.38, turn: 0.35, parallels: [-60, -40, -20, 0, 20, 40, 60] }
// the way of the card goes from 0, in the pocket, to 1, at the end of the slot. a card that
// is let go after seatFrom goes in. a card in the slot that is pulled back before outAt
// comes out, and the screen goes off. in the first part of its way, to slide, the top of the
// card comes up by tilt and the card goes up from under the tabs. then, to lift, it comes off
// the paper
const WAY = { seatFrom: 0.72, outAt: 0.88, high: 0.05, slide: 0.03, lift: 0.06, tilt: 0.35 }
// fast, with a small overshoot when the card comes back to the pocket
const SPRING = { stiffness: 420, damping: 34 }
// a press on the box that does not open it: the box goes up, and its lid opens by a small angle
const JUMP = { seconds: 0.5, high: 0.09, lid: 0.2, turn: 0.03 }
// two presses on the box open it when the second one is this soon after the first
const DOUBLE_PRESS_SECONDS = 0.4
// how far the box leans under the pointer, and how fast it follows
const HOVER = { lean: 0.11, speed: 0.14 }
// the lid is a database table. columns are the places of its column lines, in parts of its
// width. the cells around the middle are one cell for the mark, from a first line to a last line
const TABLE = {
  columns: [0, 0.06, 0.18, 0.3, 0.44, 0.58, 0.7, 0.84, 1],
  rows: 16,
  mark: { columns: [2, 7], rows: [4, 12] },
}
// the cell of the mark on the open lid: x is from its middle, and y is up from the hinge
const MARK_CELL = {
  x: ((TABLE.columns[TABLE.mark.columns[0]] + TABLE.columns[TABLE.mark.columns[1]]) / 2 - 0.5) * BOX.side,
  y: (1 - (TABLE.mark.rows[0] + TABLE.mark.rows[1]) / 2 / TABLE.rows) * BOX.side,
  w: (TABLE.columns[TABLE.mark.columns[1]] - TABLE.columns[TABLE.mark.columns[0]]) * BOX.side,
  h: ((TABLE.mark.rows[1] - TABLE.mark.rows[0]) / TABLE.rows) * BOX.side,
}
// the glass under the card is a little less wide than the card, so the card covers it
const GLASS_WIDTH = isScreenUnder ? CARD.h - 0.04 : MARK_CELL.w - SCREEN.pad * 2
const GLASS = { w: GLASS_WIDTH, h: GLASS_WIDTH / SCREEN.ratio }
// in the lid, the glass is at the top of the cell, so the paper under it has room for the slot
GLASS.y = MARK_CELL.y + MARK_CELL.h / 2 - SCREEN.pad - GLASS.h / 2
// the mouth of the slot, up from the hinge
const SLOT_MOUTH = isScreenUnder ? MARK_CELL.y : GLASS.y - GLASS.h / 2 - SLOT.under
// the mark takes a press this far from the middle of the lid, in parts of its width
const MARK_REACH = 0.15
// the foil of the print of the note: how many times its colors go around in the width of the
// sheet, and how much color it has
const NOTE_FOIL = { bands: 2.4, color: 0.7 }
// the light goes over the closed box once in this many seconds
const SWEEP_SECONDS = 4.2
// white paper gives back much more light than black paper, so the light box has less light
const SKY_LIGHT = pick(0.32, 1)
const LIGHTS = {
  key: pick(11, 3.2),
  under: pick(2.5, 0.5),
  top: pick(28, 7.5),
  sweep: pick(1.6, 0.3),
  mark: 1.2,
  open: 0.25,
  arrow: 1.8,
  blast: 2.6,
}
// when the card goes in, a blast goes out from the slot: a ring of the marks of the table
// are lights for a moment, then the next ring. a ring is as wide as a row of the table.
// speed is rings in a second, and rings is how many there are to the far corner. dark is
// the part of the marks that stay dark
const BLAST = { speed: 14, rings: 15, dark: 0.15 }
const pageCard = document.getElementById('card')
const isMotionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches

const span = (value, [from, to]) => Math.min(Math.max((value - from) / (to - from), 0), 1)
const ease = (value) => value * value * (3 - 2 * value)

const paint = ({ w, h = w, draw }) => {
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h })
  draw(canvas.getContext('2d'))
  return canvas
}

const textureOf = (canvas, isColor = true) => {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.anisotropy = 8
  return texture
}

const MARK = new Path2D(UNION)

// the outline of the mark with its middle at a point. the mark is 109 wide and 113 high
const strokeMark = ({ ctx, x, y, width, line, color, glow = 0 }) => {
  const scale = width / 109
  ctx.save()
  ctx.translate(x - width / 2, y - (113 * scale) / 2)
  ctx.scale(scale, scale)
  ctx.lineJoin = 'round'
  ctx.lineWidth = line / scale
  ctx.strokeStyle = ctx.shadowColor = color
  ctx.shadowBlur = glow
  ctx.stroke(MARK)
  ctx.restore()
}

const LID_SIZE = 1024

// small light and dark dots on a height picture are the grain of paper
const addGrain = (ctx, amount) => {
  const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  for (let index = 0; index < image.data.length; index += 4) {
    const dot = (Math.random() - 0.5) * amount
    for (let channel = 0; channel < 3; channel++) image.data[index + channel] += dot
  }
  ctx.putImageData(image, 0, 0)
}

// a number from 0 to 1 that is always the same for a cell
const cellNumber = (column, row) =>
  Math.abs((Math.sin(column * 127.1 + row * 311.7) * 43758.5453) % 1)

// the table of the lid: the lines of its cells, a number for each row, a label for each
// column, and rows of dots and blocks in place of the values. shade fills some cells. a
// table with no line has only its numbers and its marks
const drawTable = ({ ctx, line, ink, shade }) => {
  const { columns, rows, mark } = TABLE
  const rowHeight = LID_SIZE / rows
  ctx.save()
  ctx.lineWidth = line
  ctx.strokeStyle = ink
  ctx.font = '600 20px ui-monospace, Menlo, monospace'
  ctx.textBaseline = 'middle'
  // all the cells are one path, so a line between two cells is drawn one time
  ctx.beginPath()
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns.length - 1; column++) {
      const isMarkCell =
        column >= mark.columns[0] &&
        column < mark.columns[1] &&
        row >= mark.rows[0] &&
        row < mark.rows[1]
      if (isMarkCell) continue
      const [left, right] = [columns[column] * LID_SIZE, columns[column + 1] * LID_SIZE]
      const middle = (row + 0.5) * rowHeight
      ctx.rect(left, row * rowHeight, right - left, rowHeight)
      ctx.fillStyle = ink
      if (column === 0) {
        ctx.fillText(row ? String(row).padStart(2, '0') : '#', left + 18, middle)
        continue
      }
      const kind = row ? cellNumber(column, row) : 0.5
      if (kind > 0.9) {
        ctx.fillStyle = shade
        ctx.fillRect(left, row * rowHeight, right - left, rowHeight)
      }
      if (kind < 0.3 || kind > 0.9) continue
      // a value starts as dots and goes on as blocks. a label is four blocks
      const marks = row ? Math.floor((right - left - 28) / 13) : 4
      const dots = row ? Math.floor(cellNumber(row, column) * 1.6 * marks) : 0
      for (let index = 0; index < marks; index++) {
        const [width, height] = index < dots ? [3, 3] : [7, 12]
        ctx.fillRect(left + 16 + index * 13, middle - height / 2, width, height)
      }
    }
  }
  if (line) ctx.stroke()
  ctx.restore()
}

// the paper of the two sides of the lid is black, or white in the light box, with a little
// more light at one corner
const fillPaper = (ctx) => {
  const paper = ctx.createLinearGradient(0, 0, LID_SIZE, LID_SIZE)
  paper.addColorStop(0, pick('#222223', '#f4f3ef'))
  paper.addColorStop(1, pick('#111112', '#e6e4dd'))
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, LID_SIZE, LID_SIZE)
}

const lidColor = paint({
  w: LID_SIZE,
  draw: (ctx) => {
    fillPaper(ctx)
    drawTable({
      ctx,
      line: 2,
      ink: pick('rgb(226 226 220 / 0.2)', 'rgb(28 28 30 / 0.2)'),
      shade: pick('rgb(255 255 255 / 0.05)', 'rgb(0 0 0 / 0.04)'),
    })
    strokeMark({
      ctx,
      x: LID_SIZE / 2,
      y: LID_SIZE / 2,
      width: 200,
      line: 6,
      color: 'rgb(62 207 142 / 0.75)',
    })
  },
})

// white is high. the table and the mark are pressed into the lid, and the light shows their edges
const lidHeight = paint({
  w: LID_SIZE,
  draw: (ctx) => {
    ctx.fillStyle = '#aaa'
    ctx.fillRect(0, 0, LID_SIZE, LID_SIZE)
    drawTable({ ctx, line: 3, ink: '#000', shade: '#8a8a8a' })
    strokeMark({ ctx, x: LID_SIZE / 2, y: LID_SIZE / 2, width: 200, line: 8, color: '#000' })
    addGrain(ctx, 26)
  },
})

const lidGlow = paint({
  w: LID_SIZE,
  draw: (ctx) => {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, LID_SIZE, LID_SIZE)
    // the light of the mark is green in its middle, with the colors of foil at its edge. the
    // colors go around the middle of the mark, which is 109 wide and 113 high. three lines
    // with little color, each less wide than the one under it, make the edge soft. a black
    // line takes the colors out of the middle, so the green there stays green
    const foil = ctx.createConicGradient(0.6, 54.5, 56.5)
    for (const [at, color] of [
      '#ff3d9a',
      '#ffc23d',
      '#3dffd0',
      '#3d8bff',
      '#b55dff',
      '#ff3d9a',
    ].entries()) {
      foil.addColorStop(at / 5, color)
    }
    ctx.globalAlpha = 0.3
    for (const line of [24, 17, 11]) {
      strokeMark({ ctx, x: LID_SIZE / 2, y: LID_SIZE / 2, width: 200, line, color: foil })
    }
    ctx.globalAlpha = 1
    strokeMark({ ctx, x: LID_SIZE / 2, y: LID_SIZE / 2, width: 200, line: 8, color: '#000' })
    strokeMark({ ctx, x: LID_SIZE / 2, y: LID_SIZE / 2, width: 200, line: 5, color: '#3ecf8e' })
  },
})

// the mouth of the slot on a picture of the inner side of the lid: a thin line with round ends
const fillSlot = (ctx, ink) => {
  ctx.fillStyle = ink
  ctx.beginPath()
  ctx.roundRect(
    (0.5 - SLOT.w / BOX.side / 2) * LID_SIZE,
    (1 - SLOT_MOUTH / BOX.side) * LID_SIZE - 9,
    (SLOT.w / BOX.side) * LID_SIZE,
    18,
    9
  )
  ctx.fill()
}

// one arrow of small squares points down at the slot, in the middle of the paper over it.
// the lid with only the slot has it. it is pressed into the paper, and it is a light with
// the card in
const fillArrow = (ctx, ink) => {
  ctx.fillStyle = ink
  const middle = (1 - (SLOT_MOUTH + MARK_CELL.h / 4) / BOX.side) * LID_SIZE
  for (let row = 0; row < 4; row++) {
    // the last row is the point, and each row over it is one square more to each side
    const out = 3 - row
    for (const side of out ? [-1, 1] : [0]) {
      ctx.fillRect(LID_SIZE / 2 + side * out * 20 - 5, middle + (row - 1.5) * 20 - 5, 10, 10)
    }
  }
}

// the inner side of the lid is the paper of its outer side. it is seen from its other side
// when the lid is open, so its picture is drawn turned
const lidInside = paint({
  w: LID_SIZE,
  draw: (ctx) => {
    ctx.translate(LID_SIZE, LID_SIZE)
    ctx.rotate(Math.PI)
    fillPaper(ctx)
    // the light of the open box is a spot at the top of the lid. its fall to the corners is in
    // the picture, because the same light must keep the tray under the lid bright
    const fall = ctx.createRadialGradient(LID_SIZE / 2, 60, 80, LID_SIZE / 2, 60, LID_SIZE * 1.05)
    fall.addColorStop(0, 'rgb(0 0 0 / 0)')
    fall.addColorStop(0.45, `rgb(0 0 0 / ${pick(0.42, 0.05)})`)
    fall.addColorStop(1, `rgb(0 0 0 / ${pick(0.68, 0.14)})`)
    ctx.fillStyle = fall
    ctx.fillRect(0, 0, LID_SIZE, LID_SIZE)
    fillSlot(ctx, '#050505')
    if (isScreenUnder) fillArrow(ctx, `rgb(0 0 0 / ${pick(0.5, 0.25)})`)
  },
})

const lidInsideGlow = paint({
  w: LID_SIZE,
  draw: (ctx) => {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, LID_SIZE, LID_SIZE)
    ctx.translate(LID_SIZE, LID_SIZE)
    ctx.rotate(Math.PI)
    // the lights of the lid are two kinds, and each has a color of its own in this picture:
    // green for the marks of the table, and red for the arrow
    drawTable({ ctx, line: 0, ink: '#0f0', shade: '#000' })
    if (isScreenUnder) fillArrow(ctx, '#f00')
  },
})

const lidInsideHeight = paint({
  w: LID_SIZE,
  draw: (ctx) => {
    ctx.fillStyle = '#aaa'
    ctx.fillRect(0, 0, LID_SIZE, LID_SIZE)
    ctx.translate(LID_SIZE, LID_SIZE)
    ctx.rotate(Math.PI)
    drawTable({ ctx, line: 3, ink: '#707070', shade: '#9a9a9a' })
    if (isScreenUnder) fillArrow(ctx, '#000')
    else {
      // the cell of the screen is a little lower than the paper, so the glass is in the lid
      ctx.fillStyle = '#8a8a8a'
      ctx.fillRect(
        (MARK_CELL.x / BOX.side + 0.5) * LID_SIZE - (MARK_CELL.w / BOX.side / 2) * LID_SIZE,
        (TABLE.mark.rows[0] / TABLE.rows) * LID_SIZE,
        (MARK_CELL.w / BOX.side) * LID_SIZE,
        (MARK_CELL.h / BOX.side) * LID_SIZE
      )
      // the paper comes up to the glass with no hard step, as the frame of a tube does:
      // lines of less and less width, one on the other, make a soft slope
      ctx.strokeStyle = 'rgb(255 255 255 / 0.09)'
      ctx.beginPath()
      ctx.roundRect(
        ((MARK_CELL.x - GLASS.w / 2) / BOX.side + 0.5) * LID_SIZE,
        (1 - (GLASS.y + GLASS.h / 2) / BOX.side) * LID_SIZE,
        (GLASS.w / BOX.side) * LID_SIZE,
        (GLASS.h / BOX.side) * LID_SIZE,
        (SCREEN.radius / BOX.side) * LID_SIZE
      )
      for (let width = 48; width > 0; width -= 8) {
        ctx.lineWidth = width
        ctx.stroke()
      }
    }
    fillSlot(ctx, '#000')
    addGrain(ctx, 16)
  },
})

// the sheet in the box has a note at its top. the pocket of the card is under the note, and
// the card is on its side in it, so a box that is square has room for it
// a note with its sentence under the pocket has a higher pocket
const POCKET = { y: { punk: -0.2, pixel: -0.16 }[NOTE_TYPE] ?? -0.24, pad: 0.014 }
// what holds the card in its pocket: two half round tabs of the lining over its lower edge,
// and a half round cut over its upper edge for a finger. tab and cut are their sizes, tabX
// is how far a tab is from the middle
const HOLDER = { tab: 0.05, tabX: 0.3, cut: 0.06 }
const SHEET_SIDE = BOX.side * 0.97 - BOX.wall * 2
// short fibers that lie more or less in one direction, half of them light and half dark
const strokeFibers = (ctx, alpha) => {
  ctx.lineWidth = 1.3
  for (const ink of ['255 255 255', '0 0 0']) {
    ctx.strokeStyle = `rgb(${ink} / ${alpha})`
    ctx.beginPath()
    for (let fiber = 0; fiber < 22000; fiber++) {
      const [x, y] = [Math.random() * LID_SIZE, Math.random() * LID_SIZE]
      const angle = Math.PI / 2 + (Math.random() - 0.5) * 1.2
      const length = 5 + Math.random() * 10
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length)
    }
    ctx.stroke()
  }
}

// soft clouds: a small picture of grain made large
const drawClouds = (ctx, { cells, alpha }) => {
  ctx.globalAlpha = alpha
  ctx.drawImage(
    paint({
      w: cells,
      draw: (small) => {
        small.fillStyle = '#808080'
        small.fillRect(0, 0, cells, cells)
        addGrain(small, 255)
      },
    }),
    0,
    0,
    LID_SIZE,
    LID_SIZE
  )
  ctx.globalAlpha = 1
}

// the wide marks on velvet where a hand went against its nap, as curves from a point,
// by a point, to a point
const NAP_MARKS = [
  [60, 560, 300, 380, 640, 470],
  [520, 60, 760, 200, 1000, 90],
  [700, 420, 880, 640, 1010, 900],
  [40, 960, 260, 860, 420, 1000],
]

// black velvet from the front, or light felt in the light box. the nap takes the light in
// clouds and in marks, and the fibers make it soft
const velvetColor = paint({
  w: LID_SIZE,
  draw: (ctx) => {
    ctx.fillStyle = pick('#060607', '#f1efe9')
    ctx.fillRect(0, 0, LID_SIZE, LID_SIZE)
    drawClouds(ctx, { cells: 7, alpha: 0.06 })
    drawClouds(ctx, { cells: 28, alpha: 0.05 })
    // a mark has no hard edge: only its shadow is on the picture, and the mark is off it
    ctx.save()
    ctx.shadowColor = pick('rgb(225 225 240 / 0.075)', 'rgb(255 255 255 / 0.3)')
    ctx.shadowBlur = 60
    ctx.shadowOffsetX = LID_SIZE * 2
    ctx.lineWidth = 120
    ctx.lineCap = 'round'
    ctx.translate(-LID_SIZE * 2, 0)
    for (const [fromX, fromY, byX, byY, toX, toY] of NAP_MARKS) {
      ctx.beginPath()
      ctx.moveTo(fromX, fromY)
      ctx.quadraticCurveTo(byX, byY, toX, toY)
      ctx.stroke()
    }
    ctx.restore()
    strokeFibers(ctx, 0.07)
  },
})

// white is high. the fibers are the nap of the lining
const velvetHeight = paint({
  w: LID_SIZE,
  draw: (ctx) => {
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, LID_SIZE, LID_SIZE)
    drawClouds(ctx, { cells: 28, alpha: 0.2 })
    strokeFibers(ctx, 0.5)
  },
})

// the note is a short label, in the pixels of the picture of the sheet: one line of small
// print, a bar code, and the note
const NOTE = { left: 92, right: 932, ink: pick('#e8e4da', '#1d1c1a') }
// the file of Reggae One has only the four letters of "LW16"
const noteFont = {
  rock: ['New Rocker', 'NewRocker-Regular.ttf'],
  punk: ['Reggae One', 'ReggaeOne-LW16.ttf'],
  pixel: ['Geist Pixel Square', 'GeistPixel-Square.woff2'],
}[NOTE_TYPE]
if (noteFont) {
  // a canvas draws only with a font that is there, so the note waits for it
  const face = new FontFace(
    noteFont[0],
    `url(${new URL(`../shared/fonts/${noteFont[1]}`, import.meta.url)})`
  )
  document.fonts.add(await face.load())
}

// "LW16" in a display type, as wide as the note. its letters are as high as the room from
// top to bottom, and the tail of a letter is in that room too. the letters are wider than
// in the font (wide) and they lean to the right (lean). the space between them takes the
// rest of the width
const drawWideTitle = (ctx, { family, top, bottom, wide, lean }) => {
  const { left, right } = NOTE
  ctx.font = `400 200px "${family}"`
  const box = ctx.measureText('LW16')
  const scale = (bottom - top) / (box.actualBoundingBoxAscent + box.actualBoundingBoxDescent)
  ctx.font = `400 ${200 * scale}px "${family}"`
  const letters = [...'LW16'].map((letter) => ({
    letter,
    width: ctx.measureText(letter).width * wide,
  }))
  // the tops of letters that lean are to the right of their feet by this much
  const room = right - left - lean * (bottom - top)
  const space = (room - letters.reduce((sum, { width }) => sum + width, 0)) / 3
  ctx.textAlign = 'left'
  for (const [index, { letter }] of letters.entries()) {
    const before = letters.slice(0, index).reduce((sum, { width }) => sum + width + space, 0)
    ctx.save()
    ctx.translate(left + before, bottom - box.actualBoundingBoxDescent * scale)
    ctx.transform(wide, 0, -lean, 1, 0, 0)
    ctx.fillText(letter, 0, 0)
    ctx.restore()
  }
}

// "LW16" in the middle of the note. its first type is Geist Pixel, the type of the Launch
// Week 16 site. the panel of the title changes these values (title-tune.js)
const TITLE = {
  font: 'Geist Pixel Square',
  weight: 400,
  heavy: 0.07,
  lean: 0,
  wide: 1,
  height: 140,
}

// Geist Pixel has one weight, so a line around each letter makes it heavy, and the corners
// of that line are square as the dots of the type are
const drawPixelTitle = (ctx) => {
  const { font, weight, heavy, lean, wide, height } = TITLE
  const bottom = 134 + height
  ctx.font = `${weight} 200px "${font}"`
  const box = ctx.measureText('LW16')
  const size =
    (200 * height) / (box.actualBoundingBoxAscent + box.actualBoundingBoxDescent + 200 * heavy)
  ctx.font = `${weight} ${size}px "${font}"`
  ctx.lineJoin = 'miter'
  ctx.lineWidth = size * heavy
  ctx.strokeStyle = NOTE.ink
  const base = bottom - (size * heavy) / 2 - (box.actualBoundingBoxDescent * size) / 200
  ctx.save()
  ctx.translate((NOTE.left + NOTE.right) / 2, base)
  ctx.transform(wide, 0, -lean, 1, 0, 0)
  // a line width of 0 is not a value for a canvas, which then keeps the last width
  if (heavy) ctx.strokeText('LW16', 0, 0)
  ctx.fillText('LW16', 0, 0)
  ctx.restore()
}

// the notes with a large "LW16": the small print is in the middle over it, the note has no
// bar code, and the sentence is under the pocket of the card, with no full stop. the pixel
// note has a smaller "LW16" and a higher pocket, so its sentence has more room
const drawLargeNote = (ctx) => {
  const middle = (NOTE.left + NOTE.right) / 2
  ctx.textAlign = 'center'
  ctx.font = '600 20px ui-monospace, Menlo, monospace'
  ctx.fillText('SUPABASE', middle, 104)
  if (NOTE_TYPE === 'pixel') drawPixelTitle(ctx)
  else drawWideTitle(ctx, { family: 'Reggae One', top: 132, bottom: 322, wide: 1.1, lean: 0.22 })
  ctx.textAlign = 'center'
  ctx.font = `400 ${NOTE_TYPE === 'pixel' ? 36 : 28}px Inter, "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillText('One launch a day, 6 to 10 December', middle, NOTE_TYPE === 'pixel' ? 992 : 1004)
}

const drawNote = (ctx) => {
  const { left, right, ink } = NOTE
  ctx.fillStyle = ink
  if (NOTE_TYPE === 'punk' || NOTE_TYPE === 'pixel') return drawLargeNote(ctx)
  ctx.font = '600 20px ui-monospace, Menlo, monospace'
  ctx.fillText('SUPABASE', left, 104)
  // the bars are thin at the left and wide at the right, and a space is as wide as its bar
  for (let bar = 0, x = 690; x < right; bar++) {
    const width = Math.min(2 + bar * 0.28, right - x)
    ctx.fillRect(x, 70, width, 42)
    x += width * 2
  }
  ctx.font = '400 32px Inter, "Helvetica Neue", Helvetica, Arial, sans-serif'
  if (NOTE_TYPE === 'rock') {
    // the sentence is under the wide "LW16", in the middle
    drawWideTitle(ctx, { family: 'New Rocker', top: 128, bottom: 318, wide: 1.3, lean: 0 })
    ctx.textAlign = 'center'
    ctx.font = '400 32px Inter, "Helvetica Neue", Helvetica, Arial, sans-serif'
    ctx.fillText('One launch a day, 6 to 10 December.', (left + right) / 2, 356)
    return
  }
  ctx.fillText('One launch a day, 6 to 10 December.', left, 272)
  ctx.font = 'italic 500 64px Georgia, "Times New Roman", serif'
  ctx.fillText('LW16', left, 212)
}

const drawSheet = (ctx) => {
  ctx.drawImage(velvetColor, 0, 0)
  drawNote(ctx)
}
const sheetColor = paint({ w: LID_SIZE, draw: drawSheet })

const paperHeight = paint({
  w: 512,
  draw: (ctx) => {
    ctx.fillStyle = '#888'
    ctx.fillRect(0, 0, 512, 512)
    addGrain(ctx, 60)
  },
})


const dialog = document.createElement('dialog')
dialog.className = 'box3d'
dialog.setAttribute('aria-label', 'Your Launch Week 16 card')
const canvas = Object.assign(document.createElement('canvas'), { role: 'button', tabIndex: 0 })
dialog.append(canvas)
document.body.append(dialog)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 0.1, 50)
const bloom = createBloom(renderer, { haze: pick([0.011, 0.009, 0.002], [0, 0, 0]) })

// the light room is under the light that glows, so it does not glow over the box. its
// numbers are light and not a color of the screen, and the screen shows them less light
const roomColor = pick(new THREE.Color(0x060501), new THREE.Color().setRGB(0.95, 0.94, 0.9))
renderer.setClearColor(roomColor)
if (isLight) {
  bloom.strength.value = 0.25
  dialog.style.background = '#e6e4dc'
  dialog.classList.add('light')
}
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const withShadow = (light) => {
  light.castShadow = true
  light.shadow.mapSize.set(2048, 2048)
  light.shadow.camera.near = 1
  light.shadow.camera.far = 14
  light.shadow.bias = -0.0005
  light.shadow.normalBias = 0.012
  light.shadow.radius = 5
  return light
}

const sky = new THREE.HemisphereLight(pick(0x3c3a36, 0xffffff), pick(0x0c0a08, 0xc9c5bb), SKY_LIGHT)
scene.add(sky)
// the key light is near the box, up and to the left, so the far side of the lid has less light
const key = withShadow(new THREE.SpotLight(0xffffff, LIGHTS.key, 0, 0.6, 1, 1.8))
// a low light, so the under side of the box shows its two parts
const under = new THREE.PointLight(0xffe2c8, LIGHTS.under, 5, 1.6)
// the light of the open box is over its lid. it is white, so the lining stays black
const top = withShadow(new THREE.SpotLight(0xffffff, 0, 0, 0.5, 1, 1.4))
// this light goes over the box from left to right, and the lines of the lid shine as it goes
const sweep = new THREE.PointLight(0xfff0dc, 0, 5, 1.8)
scene.add(key, key.target, under, top, top.target, sweep)

const paperBump = textureOf(paperHeight, false)
paperBump.wrapS = paperBump.wrapT = THREE.RepeatWrapping
paperBump.repeat.set(4, 4)
const shell = new THREE.MeshStandardMaterial({
  color: pick(0x18181a, 0xebe9e2),
  roughness: 0.85,
  bumpMap: paperBump,
  bumpScale: 0.3,
})
// the lining of the box is black velvet: it does not shine, and its nap has a soft light at
// the edges that turn away
const VELVET = {
  roughness: 1,
  sheen: 1,
  sheenRoughness: 0.6,
  sheenColor: 0x6c6c78,
  bumpMap: textureOf(velvetHeight, false),
  bumpScale: 2.5,
}
const lining = new THREE.MeshPhysicalMaterial({ ...VELVET, map: textureOf(velvetColor) })
const lidFront = new THREE.MeshStandardMaterial({
  map: textureOf(lidColor),
  bumpMap: textureOf(lidHeight, false),
  bumpScale: 8,
  roughness: 0.7,
  emissive: 0xffffff,
  emissiveMap: textureOf(lidGlow),
  emissiveIntensity: 0,
})
const lidBack = new THREE.MeshStandardMaterial({
  map: textureOf(lidInside),
  bumpMap: textureOf(lidInsideHeight, false),
  bumpScale: 3,
  roughness: 0.7,
  emissive: 0x3ecf8e,
  emissiveMap: textureOf(lidInsideGlow),
})
// how much light the arrow has, and the blast: the ring it is at, and how much light it has
const lidLight = { arrow: { value: 0 }, blast: { value: new THREE.Vector2() } }
lidBack.onBeforeCompile = (shader) => {
  shader.uniforms.uArrow = lidLight.arrow
  shader.uniforms.uBlast = lidLight.blast
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uArrow;\nuniform vec2 uBlast;')
    .replace(
      '#include <emissivemap_fragment>',
      /* glsl */ `vec4 lights = texture2D(emissiveMap, vEmissiveMapUv);
      // two marks next to each other are one light, and all of it is in one ring
      vec2 marks = vec2(${(LID_SIZE / 26).toFixed(1)}, ${TABLE.rows}.);
      vec2 mark = floor(vEmissiveMapUv * marks);
      // the picture is turned, so the slot is this far down it
      vec2 slot = vec2(.5, ${(1 - SLOT_MOUTH / BOX.side).toFixed(3)});
      float behind = floor(uBlast.x) - floor(distance((mark + .5) / marks, slot) * ${TABLE.rows}.);
      // the first ring of the blast has all its light, and the two rings after it have less
      float strength = behind == 0. ? 1. : behind == 1. ? .7 : behind == 2. ? .4 : 0.;
      float isLit = step(${BLAST.dark.toFixed(2)}, fract(sin(dot(mark, vec2(127.1, 311.7))) * 43758.5453));
      float fade = max(1. - pow(uBlast.x / ${BLAST.rings}., 2.), 0.);
      totalEmissiveRadiance *= lights.r * uArrow + lights.g * strength * isLit * fade * uBlast.y;`
    )
}

const solid = (geometry, material) => {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}

const BASE_SIDE = BOX.side * 0.97
const box = new THREE.Group()
const floor = solid(new THREE.BoxGeometry(BASE_SIDE, BASE_SIDE, 0.02), shell)
floor.position.z = -BOX.depth / 2 + 0.01
const walls = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
].map(([x, y]) => {
  // the outer side of a wall is the color of the box, and its top and inner sides are the lining
  const wall = solid(
    new THREE.BoxGeometry(x ? BOX.wall : BASE_SIDE, y ? BOX.wall : BASE_SIDE, BOX.depth),
    [x > 0 || y !== 0, x < 0 || y !== 0, y > 0, y < 0, false, true].map((isOuter) =>
      isOuter ? shell : lining
    )
  )
  wall.position.set((x * (BASE_SIDE - BOX.wall)) / 2, (y * (BASE_SIDE - BOX.wall)) / 2, 0)
  return wall
})

const pocketSize = { w: CARD.h + POCKET.pad * 2, h: CARD.w + POCKET.pad * 2 }
const sheetShape = new THREE.Shape()
  .moveTo(-SHEET_SIDE / 2, -SHEET_SIDE / 2)
  .lineTo(SHEET_SIDE / 2, -SHEET_SIDE / 2)
  .lineTo(SHEET_SIDE / 2, SHEET_SIDE / 2)
  .lineTo(-SHEET_SIDE / 2, SHEET_SIDE / 2)
const pocketHole = new THREE.Path()
  .moveTo(-pocketSize.w / 2 + 0.05, POCKET.y - pocketSize.h / 2)
  .absarc(pocketSize.w / 2 - 0.05, POCKET.y - pocketSize.h / 2 + 0.05, 0.05, -Math.PI / 2, 0)
  .absarc(pocketSize.w / 2 - 0.05, POCKET.y + pocketSize.h / 2 - 0.05, 0.05, 0, Math.PI / 2)
  .absarc(0, POCKET.y + pocketSize.h / 2, HOLDER.cut, 0, Math.PI)
  .absarc(-pocketSize.w / 2 + 0.05, POCKET.y + pocketSize.h / 2 - 0.05, 0.05, Math.PI / 2, Math.PI)
  .absarc(
    -pocketSize.w / 2 + 0.05,
    POCKET.y - pocketSize.h / 2 + 0.05,
    0.05,
    Math.PI,
    Math.PI * 1.5
  )
sheetShape.holes.push(pocketHole)
const sheetGeometry = new THREE.ExtrudeGeometry(sheetShape, {
  depth: SHEET.deep,
  bevelEnabled: false,
  curveSegments: 8,
})
// the picture of the sheet covers it from edge to edge
for (let index = 0; index < sheetGeometry.attributes.uv.count; index++) {
  sheetGeometry.attributes.uv.setXY(
    index,
    sheetGeometry.attributes.position.getX(index) / SHEET_SIDE + 0.5,
    sheetGeometry.attributes.position.getY(index) / SHEET_SIDE + 0.5
  )
}
const sheetTop = BOX.depth / 2 - SHEET.sunk
const sheetMaterial = new THREE.MeshPhysicalMaterial({ ...VELVET, map: textureOf(sheetColor) })
// the print of the note is foil. its color goes through the spectrum with the distance to
// the light of the card, so it moves as that light moves. the light is a place on the picture
const noteLight = { value: new THREE.Vector2(0.5, 0.3) }
sheetMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uNoteLight = noteLight
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec2 uNoteLight;')
    .replace(
      '#include <map_fragment>',
      /* glsl */ `#include <map_fragment>
      // only the print is light, so the velvet keeps its color. in the light box the print
      // is dark, and the foil gives it color
      float light = smoothstep(.2, .55, dot(diffuseColor.rgb, vec3(.2126, .7152, .0722)));
      vec3 spectrum = .5 + .5 * cos(6.2832 * (distance(vMapUv, uNoteLight) * ${NOTE_FOIL.bands.toFixed(2)} + vec3(0., .33, .67)));
      ${
        isLight
          ? `diffuseColor.rgb += spectrum * .1 * (1. - light) * ${NOTE_FOIL.color.toFixed(2)};`
          : `diffuseColor.rgb *= mix(vec3(1.), .55 + spectrum * .9, light * ${NOTE_FOIL.color.toFixed(2)});`
      }`
    )
}
const sheet = solid(sheetGeometry, sheetMaterial)
sheet.position.z = sheetTop - SHEET.deep
// the drawing on the floor of the pocket: small pictures in the manner of a sheet of
// stickers. a globe of square cells and a disk of small signs, near the middle, and a label
const drawPocketArt = (ctx) => {
  const { width, height } = ctx.canvas
  const fillMark = ({ x, y, size }) => {
    ctx.save()
    ctx.translate(x - size / 2, y - (size * 113) / 109 / 2)
    ctx.scale(size / 109, size / 109)
    ctx.fill(MARK)
    ctx.restore()
  }
  ctx.lineWidth = 2
  ctx.strokeStyle = pick('rgb(232 228 218 / 0.34)', 'rgb(29 28 26 / 0.3)')
  ctx.fillStyle = pick('rgb(232 228 218 / 0.3)', 'rgb(29 28 26 / 0.26)')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const row = height * 0.43

  // the cell globe: a ring, land from the numbers of the cells, and a cross with no cells
  const cellGlobe = { x: width / 2 - 128, cell: 13, middle: 7 }
  for (let y = 0; y <= cellGlobe.middle * 2; y++) {
    for (let x = 0; x <= cellGlobe.middle * 2; x++) {
      const away = Math.hypot(x - cellGlobe.middle, y - cellGlobe.middle)
      const isRing = away > 6.4 && away <= 7.5
      const isLand =
        away <= 6.4 && x !== cellGlobe.middle && y !== cellGlobe.middle && cellNumber(x, y) > 0.5
      if (!isRing && !isLand) continue
      ctx.fillRect(
        cellGlobe.x + (x - cellGlobe.middle - 0.5) * cellGlobe.cell,
        row + (y - cellGlobe.middle - 0.5) * cellGlobe.cell,
        cellGlobe.cell,
        cellGlobe.cell
      )
    }
  }

  // the disk of signs is a globe too: the signs are its land
  const disk = { x: width / 2 + 128, radius: 98 }
  ctx.beginPath()
  ctx.arc(disk.x, row, disk.radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.font = '500 11px ui-monospace, Menlo, monospace'
  for (let y = -84; y <= 84; y += 12) {
    for (let x = -84; x <= 84; x += 8) {
      const away = Math.hypot(x, y)
      if (away > 88 || away < 34 || cellNumber(x, y) < 0.42) continue
      ctx.fillText(':.|+'[Math.floor(cellNumber(y, x) * 4)], disk.x + x, row + y)
    }
  }
  fillMark({ x: disk.x, y: row, size: 40 })

  const label = { y: height * 0.68, w: 160, h: 48 }
  ctx.beginPath()
  ctx.roundRect(width / 2 - label.w / 2, label.y - label.h / 2, label.w, label.h, label.h / 2)
  const globeX = width / 2 - 42
  ctx.moveTo(globeX + 12, label.y)
  ctx.arc(globeX, label.y, 12, 0, Math.PI * 2)
  ctx.moveTo(globeX + 5, label.y)
  ctx.ellipse(globeX, label.y, 5, 12, 0, 0, Math.PI * 2)
  ctx.moveTo(globeX - 12, label.y)
  ctx.lineTo(globeX + 12, label.y)
  ctx.stroke()
  ctx.font = '500 22px Inter, "Helvetica Neue", Helvetica, Arial, sans-serif'
  ctx.fillText('LW16', width / 2 + 16, label.y + 1)
}

// the floor of the pocket is darker velvet. its drawing shows when the card is out. a floor
// that is the screen has no drawing
const pocketColor = paint({
  w: LID_SIZE,
  h: Math.round((LID_SIZE * pocketSize.h) / pocketSize.w),
  draw: (ctx) => {
    ctx.drawImage(velvetColor, 0, 0)
    ctx.fillStyle = `rgb(0 0 0 / ${pick(0.5, 0.07)})`
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    if (isScreenUnder) return
    // the drawing is made larger from the middle, so it has less room around it
    ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2)
    ctx.scale(1.2, 1.2)
    ctx.translate(-ctx.canvas.width / 2, -ctx.canvas.height / 2)
    drawPocketArt(ctx)
  },
})
const pocketFloor = solid(
  new THREE.PlaneGeometry(pocketSize.w, pocketSize.h),
  new THREE.MeshPhysicalMaterial({ ...VELVET, map: textureOf(pocketColor) })
)
pocketFloor.position.set(0, POCKET.y, sheetTop - SHEET.pocket)
// the cut for the finger has the same floor as the pocket
const cutFloor = solid(new THREE.CircleGeometry(HOLDER.cut, 24, 0, Math.PI), lining)
cutFloor.position.set(0, POCKET.y + pocketSize.h / 2, sheetTop - SHEET.pocket)
const tabs = [-HOLDER.tabX, HOLDER.tabX].map((x) => {
  const tab = solid(new THREE.CircleGeometry(HOLDER.tab, 24, 0, Math.PI), lining)
  tab.position.set(x, POCKET.y - pocketSize.h / 2, sheetTop + 0.0005)
  return tab
})

// the lid turns around the top edge of the box
const hinge = new THREE.Group()
hinge.position.set(0, BOX.side / 2, BOX.depth / 2)
const lid = solid(new RoundedBoxGeometry(BOX.side, BOX.side, BOX.lid, 3, BOX.radius), [
  shell,
  shell,
  shell,
  shell,
  lidFront,
  lidBack,
])
lid.position.set(0, -BOX.side / 2, BOX.lid / 2)

// the screen shows a picture that this script draws: a globe of thin lines that turns, and
// small text. the page has the text: its reader writes it when its card goes in
const screenCtx = Object.assign(document.createElement('canvas'), {
  width: SCREEN.picture.w,
  height: SCREEN.picture.h,
}).getContext('2d')
const screenTexture = textureOf(screenCtx.canvas)
// thin lines get dim in a small copy of the picture, so the picture has no small copies
screenTexture.generateMipmaps = false
screenTexture.minFilter = THREE.LinearFilter
const pageReader = document.getElementById('crt')

// ponytail: the page plays its own sounds when its reader comes on, and this scene has
// other sounds for that. the sound module of the page keeps the first AudioContext that it
// makes, so here it gets one that never runs. the page then has no sound after the scene
// is closed. a mute in ../lw16-crt-slot/sound.js is the way to do this well
const RealAudioContext = window.AudioContext
window.AudioContext = class {
  state = 'suspended'
  resume() {}
}
unlock()
window.AudioContext = RealAudioContext

// a globe of lines, seen a little from above. the lines on its far half are dim
const drawGlobe = ({ ctx, x, y, r, yaw }) => {
  const [sinTilt, cosTilt] = [Math.sin(GLOBE.tilt), Math.cos(GLOBE.tilt)]
  // one circle on the globe, drawn two times: its far part, then its near part
  const stroke = (pointAt) => {
    for (const isNear of [false, true]) {
      ctx.globalAlpha = isNear ? 0.6 : 0.16
      ctx.beginPath()
      let isLineOn = false
      for (let part = 0; part <= 96; part++) {
        const [px, py, pz] = pointAt((part / 96) * Math.PI * 2)
        if (py * sinTilt + pz * cosTilt > 0 !== isNear) {
          isLineOn = false
          continue
        }
        const place = [x + px * r, y - (py * cosTilt - pz * sinTilt) * r]
        if (isLineOn) ctx.lineTo(...place)
        else ctx.moveTo(...place)
        isLineOn = true
      }
      ctx.stroke()
    }
  }
  for (let meridian = 0; meridian < 6; meridian++) {
    const longitude = yaw + (meridian * Math.PI) / 6
    stroke((angle) => [
      Math.cos(angle) * Math.sin(longitude),
      Math.sin(angle),
      Math.cos(angle) * Math.cos(longitude),
    ])
  }
  for (const parallel of GLOBE.parallels) {
    const latitude = THREE.MathUtils.degToRad(parallel)
    stroke((angle) => [
      Math.cos(latitude) * Math.cos(angle),
      Math.sin(latitude),
      Math.cos(latitude) * Math.sin(angle),
    ])
  }
}

// on is 0 with no card and 1 with the card in the slot
const drawScreen = ({ seconds, on, isCardIn }) => {
  const { w, h } = SCREEN.picture
  const ctx = screenCtx
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = ctx.fillStyle = SCREEN.ink
  ctx.lineWidth = 1.4
  ctx.textAlign = 'center'
  // with a card in the slot the globe is small and high, so the text has room
  drawGlobe({
    ctx,
    x: w / 2,
    y: h * (0.44 - 0.13 * on),
    r: h * (0.38 - 0.19 * on),
    yaw: isMotionReduced ? 0.6 : seconds * GLOBE.turn,
  })
  const write = ({ text, y, size }) => {
    ctx.font = `500 ${size}px ui-monospace, Menlo, monospace`
    ctx.fillText(text, w / 2, y, w * 0.86)
  }
  ctx.globalAlpha = 0.6
  if (!isCardIn) return write({ text: 'Insert', y: h - 32, size: 24 })
  // the reader of the page reads the card for a moment, then it has the text of the day
  const isLive = pageReader.dataset.power === 'on' && !document.getElementById('live').hidden
  if (!isLive) return write({ text: 'Reading card', y: h - 32, size: 24 })
  write({ text: document.getElementById('kicker').textContent, y: h * 0.61, size: 24 })
  write({ text: document.getElementById('sub').textContent, y: h * 0.92, size: 24 })
  ctx.globalAlpha = 0.9
  write({ text: document.getElementById('headline').textContent, y: h * 0.79, size: 64 })
}

// the reader is made as it is with the lid open: y is up from the hinge, and z is out from
// the inner side of the lid. the half turn puts it on that side of the closed lid
const reader = new THREE.Group()
reader.rotation.x = Math.PI
// the glass has round corners as a shape, so its edge is as smooth as the other edges
const glassCorner = [GLASS.w / 2 - SCREEN.radius, GLASS.h / 2 - SCREEN.radius]
const glassGeometry = new THREE.ShapeGeometry(
  new THREE.Shape()
    .moveTo(-glassCorner[0], -GLASS.h / 2)
    .absarc(glassCorner[0], -glassCorner[1], SCREEN.radius, -Math.PI / 2, 0)
    .absarc(glassCorner[0], glassCorner[1], SCREEN.radius, 0, Math.PI / 2)
    .absarc(-glassCorner[0], glassCorner[1], SCREEN.radius, Math.PI / 2, Math.PI)
    .absarc(-glassCorner[0], -glassCorner[1], SCREEN.radius, Math.PI, Math.PI * 1.5),
  12
)
// the picture covers the glass from edge to edge
for (let index = 0; index < glassGeometry.attributes.uv.count; index++) {
  glassGeometry.attributes.uv.setXY(
    index,
    glassGeometry.attributes.position.getX(index) / GLASS.w + 0.5,
    glassGeometry.attributes.position.getY(index) / GLASS.h + 0.5
  )
}
const glass = new THREE.Mesh(
  glassGeometry,
  new THREE.ShaderMaterial({
    uniforms: { uPicture: { value: screenTexture } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D uPicture;
      void main() {
        vec2 size = vec2(${GLASS.w.toFixed(4)}, ${GLASS.h.toFixed(4)});
        float radius = ${SCREEN.radius.toFixed(4)};
        vec2 corner = abs(vUv - .5) * size - size * .5 + radius;
        float inside = radius - length(max(corner, vec2(0.))) - min(max(corner.x, corner.y), 0.);
        vec2 fromMiddle = vUv - .5;
        float away = dot(fromMiddle, fromMiddle);
        // dark glass, with more light at the middle of its top
        float fromTop = length(vec2(fromMiddle.x / 1.2, .5 - fromMiddle.y)) / .7;
        vec3 color = mix(vec3(.0103, .0103, .0086), vec3(.0033, .0033, .003), min(fromTop, 1.));
        // the glass is round as the front of a tube is. the light of the room is a soft
        // band on its upper part
        vec2 band = (vUv - vec2(.5, .84)) / vec2(.4, .1);
        color += vec3(.011, .011, .01) * exp(-dot(band, band));
        // the picture is larger at the middle of the round glass. its three colors are apart,
        // and more so at the sides, so a thin line has a little of each color at its edges
        vec2 place = fromMiddle * (1. + away * ${SCREEN.bulge.toFixed(2)}) + .5;
        vec2 apart = vec2(.0018, .0008) + fromMiddle * .006;
        vec4 warm = texture2D(uPicture, place + apart);
        vec4 middle = texture2D(uPicture, place);
        vec4 cold = texture2D(uPicture, place - apart);
        vec3 picture = vec3(warm.r * warm.a, middle.g * middle.a, cold.b * cold.a) * 1.8;
        // the lines of the tube go across the picture, and they bend with the glass. they are
        // parts of the picture, so they are the same in a window of any size
        color += picture * (.6 + .4 * sin(place.y * ${(SCREEN.lines * Math.PI * 2).toFixed(1)}));
        // the sides of the round glass turn away, and its edge is under the paper, in
        // shade. a thin line of light is around it
        color *= 1. - away * 1.1;
        color *= mix(.1, 1., smoothstep(0., .03, inside));
        color += vec3(.006) * (1. - smoothstep(0., .004, inside));
        gl_FragColor = vec4(color, 1.);
      }
    `,
  })
)
if (isScreenUnder) {
  glass.position.set(0, POCKET.y, sheetTop - SHEET.pocket + 0.0008)
  box.add(glass)
} else {
  glass.position.set(MARK_CELL.x, GLASS.y, 0.0008)
  reader.add(glass)
}
// this plane has no color. it is in front of the part of the card that is in the slot, and
// it is drawn before the card, so that part does not show
const slotCover = new THREE.Mesh(
  new THREE.PlaneGeometry(SLOT.w, CARD.h * SLOT.depth + 0.02),
  new THREE.MeshBasicMaterial({ colorWrite: false })
)
slotCover.position.set(0, SLOT_MOUTH + slotCover.geometry.parameters.height / 2, 0.03)
slotCover.renderOrder = 1
reader.add(slotCover)
// the inside of the slot is velvet, as the lining is. the paper of the lid shines, so a
// color on its picture shows grey. the velvet is a little less wide than the groove in the
// paper, so the edge of the groove shows
const slotVelvetRadius = (7 / LID_SIZE) * BOX.side
const slotVelvetEnd = (SLOT.w - 0.006) / 2 - slotVelvetRadius
const slotVelvetShape = new THREE.Shape()
  .absarc(slotVelvetEnd, 0, slotVelvetRadius, -Math.PI / 2, Math.PI / 2)
  .absarc(-slotVelvetEnd, 0, slotVelvetRadius, Math.PI / 2, Math.PI * 1.5)
const slotVelvetGeometry = new THREE.ShapeGeometry(slotVelvetShape, 8)
for (let index = 0; index < slotVelvetGeometry.attributes.uv.count; index++) {
  slotVelvetGeometry.attributes.uv.setXY(
    index,
    slotVelvetGeometry.attributes.position.getX(index) / BOX.side + 0.5,
    slotVelvetGeometry.attributes.position.getY(index) / BOX.side + 0.5
  )
}
// the light of the lid is strong, so this velvet has less sheen than the lining
const slotVelvet = solid(
  slotVelvetGeometry,
  new THREE.MeshPhysicalMaterial({
    ...VELVET,
    map: lining.map,
    color: pick(0x555555, 0xffffff),
    sheenColor: pick(0x1c1c22, 0x6c6c78),
  })
)
slotVelvet.position.set(0, SLOT_MOUTH, 0.0005)
reader.add(slotVelvet)
hinge.add(lid, reader)
box.add(floor, ...walls, sheet, pocketFloor, cutFloor, ...tabs, hinge)
scene.add(box)

const foil = shown ? createFoilMaterial(shown) : null
// a card with no shader is a picture: the one its script drew on the page, or the paper card
const picture =
  document.getElementById('foil') ??
  drawPaperCard(document.getElementById('card-handle').textContent)
const card = createCard(foil ?? new THREE.MeshBasicMaterial({ map: textureOf(picture) }))
card.children[0].castShadow = true
for (const part of card.children) part.renderOrder = 2
scene.add(card)
// while the card is made, a sheet in the color of the room is between the card and the box.
// the glass of the screen takes no light, so only a sheet hides the box. the sheet is drawn
// first, so the particles of the card are over it
const veil = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshBasicMaterial({ color: roomColor, transparent: true, depthWrite: false, toneMapped: false })
)
veil.position.z = 2.1
veil.renderOrder = -1
scene.add(veil)
// with no motion, the card is in the closed box at once
const light =
  new URL(import.meta.url).searchParams.has('claim') && foil && !isMotionReduced
    ? await import('./light-build.js?v=1')
    : null
const build = light?.createLightBuild({ card, foil })
// the edge of the card has a plane that cuts it at the line that makes the card
renderer.localClippingEnabled = Boolean(build)

const resize = () => {
  const { clientWidth: width, clientHeight: height } = dialog
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.position.z = VIEW.distance / Math.min(1, camera.aspect / VIEW.column)
  camera.updateProjectionMatrix()
  bloom.resize()
}

// the places of the card on its way, from the middle of the box: in the pocket, and at the
// end of the slot. z is how far out the card is when it is over the box
const SLOT_MOUTH_Y = BOX.side / 2 + SLOT_MOUTH
const TRACK = {
  rest: POCKET.y,
  seat: SLOT_MOUTH_Y + CARD.h * (SLOT.depth - 0.5),
  pocketZ: sheetTop - SHEET.pocket + CARD.depth,
  z: BOX.depth / 2 + 0.011,
  // how far the card goes up in its pocket, so its lower edge is out from under the tabs
  slide: HOLDER.tab - POCKET.pad + 0.01,
}
// the part of the way where the top of the card is on the mouth of the slot
const MOUTH_AT =
  WAY.lift +
  ((1 - WAY.lift) * (SLOT_MOUTH_Y - CARD.h / 2 - TRACK.rest - TRACK.slide)) /
    (TRACK.seat - TRACK.rest - TRACK.slide)

// claim: the card is made and goes into the box. box: the box is closed. open: it is open
let step = build ? 'claim' : 'box'
let stepAt = 0
// the part of the scene under the pointer: the mark of the lid, the box, the card, or nothing
let hovered = null
let jumpAt = -99
// how far the card is on its way, and how fast it goes, in ways for each second
let way = 0
let waySpeed = 0
let isSeatWanted = false
// a card in the hand: where the card and the pointer were at the start, and if the screen was on
let grab = null
// when the claim button was pressed, for the seconds of CLAIM. before that, the scene waits at 0
let claimAt = null
let isReaderOn = false
let lastSeconds = 0
// when the card went into the slot. before that, no blast is on its way
let blastAt = -99

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const LID_MIDDLE = new THREE.Vector2(0.5, 0.5)
// where the pointer is on the box, from its middle, from -1 to 1
const hoverFromMiddle = new THREE.Vector2()
// these go to their new values in small steps, so the box does not move at once
const lean = new THREE.Vector2()
const glow = { mark: 0, pointer: 0, screen: 0 }
// the lights are with the pointer after its first move, and they stay where it was last
let hasPointerMoved = false
const facingPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1))
const pointerPlace = new THREE.Vector3()

// the place under the pointer on a plane that faces the window, this far from the middle
const pointerAt = (z) => {
  raycaster.setFromCamera(pointer, camera)
  facingPlane.constant = -z
  raycaster.ray.intersectPlane(facingPlane, pointerPlace)
  return pointerPlace
}

const partAt = (event) => {
  pointer.set(
    (event.clientX / dialog.clientWidth) * 2 - 1,
    1 - (event.clientY / dialog.clientHeight) * 2
  )
  raycaster.setFromCamera(pointer, camera)
  if (step === 'claim') return null
  if (step !== 'box') {
    // the part of the card that is in the slot takes no pointer
    const [onCard] = raycaster.intersectObject(card)
    return onCard && box.worldToLocal(onCard.point).y < SLOT_MOUTH_Y ? 'card' : null
  }
  const [hit] = raycaster.intersectObject(box)
  if (!hit) return null
  hoverFromMiddle
    .set(hit.point.x - box.position.x, hit.point.y - box.position.y)
    .divideScalar(BOX.side / 2)
  // the picture of the lid is on side 4 of its box, and the mark is in the middle of the picture
  const isOnMark =
    hit.object === lid &&
    hit.face.materialIndex === 4 &&
    hit.uv.distanceTo(LID_MIDDLE) < MARK_REACH
  return isOnMark ? 'mark' : 'box'
}

const cardPlace = new THREE.Vector3()
const lightPlace = new THREE.Vector3()
const lightInBox = new THREE.Vector3()
const sweepPlace = new THREE.Vector3()
// the light of the pointer is this far in front of the thing under it
const LIGHT_OVER = new THREE.Vector3(0, 0, 0.5)

const draw = (now) => {
  const seconds = now / 1000
  const frameSeconds = Math.min(seconds - lastSeconds, 1 / 30)
  lastSeconds = seconds
  // with no motion, each step shows its last picture at once
  const opened = step === 'box' ? 0 : isMotionReduced ? 99 : seconds - stepAt

  const isOnBox = step === 'box' && hovered !== null && !isMotionReduced
  glow.mark += ((step === 'box' && hovered === 'mark' ? 1 : 0) - glow.mark) * HOVER.speed
  glow.pointer += ((hasPointerMoved ? 1 : 0) - glow.pointer) * HOVER.speed
  // the side of the box that is under the pointer goes down
  lean.x += ((isOnBox ? -hoverFromMiddle.y : 0) * HOVER.lean - lean.x) * HOVER.speed
  lean.y += ((isOnBox ? hoverFromMiddle.x : 0) * HOVER.lean - lean.y) * HOVER.speed

  const claimSeconds = claimAt === null ? 0 : seconds - claimAt
  // while the card is made, the box is open. it comes out of the room as the card turns
  const lidOpen = step === 'claim' ? 1 : ease(span(opened, TIMES.lid))
  const jump = isMotionReduced ? 0 : Math.sin(span(seconds - jumpAt, [0, JUMP.seconds]) * Math.PI)
  hinge.rotation.x = -Math.PI * lidOpen - JUMP.lid * jump * (1 - lidOpen)
  box.position.lerpVectors(PLACES.closed, PLACES.open, lidOpen)
  box.position.y += JUMP.high * jump * (1 - lidOpen)
  veil.material.opacity = step === 'claim' ? 1 - ease(span(claimSeconds, CLAIM.box)) : 0
  veil.visible = veil.material.opacity > 0
  sky.intensity = SKY_LIGHT * (1 - lidOpen * pick(0.35, 0))
  box.rotation.set(
    (BOX.tilt + Math.sin(seconds * 0.8) * 0.012 + lean.x) * (1 - lidOpen),
    (Math.sin(seconds * 0.6) * 0.04 + lean.y) * (1 - lidOpen),
    (0.012 + JUMP.turn * jump) * (1 - lidOpen)
  )
  key.position.set(box.position.x - 1.5, box.position.y + 1.6, box.position.z + 2.2)
  key.target.position.set(box.position.x - 0.25, box.position.y + 0.25, box.position.z)
  key.intensity = LIGHTS.key * (1 - lidOpen)
  under.position.set(box.position.x + 0.3, box.position.y - 2.4, box.position.z + 0.5)
  under.intensity = LIGHTS.under * (1 - lidOpen)
  top.position.set(box.position.x, box.position.y + 3.4, box.position.z + 2.6)
  top.target.position.set(box.position.x, box.position.y + 1.45, box.position.z)
  top.intensity = LIGHTS.top * lidOpen

  const pass = ((seconds % SWEEP_SECONDS) / SWEEP_SECONDS) * 5 - 1.2
  sweepPlace.set(box.position.x + (pass - 0.5) * 2.4, box.position.y + 0.3, box.position.z + 0.9)
  // after the first move of the pointer, this light is over the pointer, on the box or off it
  sweep.position
    .copy(pointerAt(box.position.z + BOX.depth / 2))
    .add(LIGHT_OVER)
    .lerp(sweepPlace, 1 - glow.pointer)
  // the light of the pointer has more light than the one that goes by itself. over the
  // open box it has less, because the lining is near black and the note is print
  sweep.intensity =
    LIGHTS.sweep * (1 + glow.pointer) * (1 - lidOpen + LIGHTS.open * glow.pointer * lidOpen)
  lidFront.emissiveIntensity =
    LIGHTS.mark * Math.max(Math.exp(-((pass - 0.5) ** 2) / 0.05), glow.mark) * (1 - lidOpen)

  // a card that is not in the hand goes to the pocket or to the end of the slot
  if (!grab) {
    const target = isSeatWanted ? 1 : 0
    waySpeed += (SPRING.stiffness * (target - way) - SPRING.damping * waySpeed) * frameSeconds
    // the slot has a hard end, so the card stops there
    way = isMotionReduced ? target : Math.min(way + waySpeed * frameSeconds, 1)
    if (way === 1) waySpeed = 0
  }
  // the reader of the page does the rest. a press on the card of the page puts that card in
  // or takes it out, and the page writes the text that the screen shows
  const isCardIn = way > (isReaderOn ? WAY.outAt : 0.999)
  if (isCardIn !== isReaderOn) {
    isReaderOn = isCardIn
    pageCard.click()
    if (isCardIn) {
      playCardIn()
      blastAt = seconds
    } else playCardOut()
  }
  glow.screen += ((isReaderOn ? 1 : 0) - glow.screen) * HOVER.speed
  lidLight.arrow.value = LIGHTS.arrow * glow.screen
  lidLight.blast.value.set((seconds - blastAt) * BLAST.speed, isMotionReduced ? 0 : LIGHTS.blast)
  if (step !== 'box') {
    drawScreen({ seconds, on: glow.screen, isCardIn: isReaderOn })
    screenTexture.needsUpdate = true
  }

  // the claim puts the card down on the paper over the tabs, and then it goes under them
  if (step === 'claim') way = WAY.slide * (1 - ease(span(claimSeconds, CLAIM.hold)))
  // as a hand takes a card from its pocket: the top of the card comes up, and the card goes
  // up from under the tabs with its lower edge in the pocket. then it comes off the paper,
  // lies flat again, turns up, and goes to the slot with its top first. the lower edge stays
  // under the tabs, so they do not go through it
  const cardTilt =
    WAY.tilt * ease(span(way, [0, WAY.slide * 0.6])) * (1 - ease(span(way, [WAY.slide, WAY.lift])))
  const cardY =
    TRACK.rest +
    TRACK.slide * ease(span(way, [WAY.slide * 0.3, WAY.slide])) +
    (TRACK.seat - TRACK.rest - TRACK.slide) * span(way, [WAY.lift, 1])
  const cardTurn = (Math.PI / 2) * (1 - ease(span(way, [WAY.lift, 0.4])))
  box.updateMatrixWorld()
  cardPlace
    .set(
      0,
      // the card turns around its lower edge, so its middle comes out of the pocket
      cardY - (CARD.w / 2) * (1 - Math.cos(cardTilt)),
      TRACK.pocketZ +
        (CARD.w / 2) * Math.sin(cardTilt) +
        (TRACK.z - TRACK.pocketZ) * ease(span(way, [WAY.slide, WAY.lift])) +
        Math.sin(span(way, [WAY.slide, MOUTH_AT]) * Math.PI) * WAY.high
    )
    .applyMatrix4(box.matrixWorld)
  card.position.copy(cardPlace)
  card.rotation.set(box.rotation.x + cardTilt, 0, cardTurn)

  // the light has a place in the scene, so it goes over the foil as the card turns. after
  // the first move of the pointer, the light is under the pointer, on the card or off it
  lightPlace
    .set(0.05 + Math.sin(seconds * 0.7) * 0.12, 0.05 + Math.cos(seconds * 0.9) * 0.14, 1)
    .add(cardPlace)
    .lerp(pointerAt(cardPlace.z), glow.pointer)
  box.worldToLocal(lightInBox.copy(lightPlace))
  noteLight.value.set(lightInBox.x / SHEET_SIDE + 0.5, lightInBox.y / SHEET_SIDE + 0.5)
  if (foil) {
    card.updateMatrixWorld()
    card.worldToLocal(lightPlace)
    foil.uniforms.uPointer.value.set(lightPlace.x / (CARD.w / 2), -lightPlace.y / (CARD.h / 2))
    foil.uniforms.uHover.value = ease(span(opened, TIMES.light))
  }
  if (build) drawClaim(claimSeconds)

  bloom.render(scene, camera)
  requestAnimationFrame(draw)
}

// the card that is made from light, and its way into the box. it is made at its place, with
// a small turn and a lean at first, and it turns on its side there. then it goes to its
// pocket, a little to the window on its way, and the tabs of the pocket turn up for it. the
// rest of draw put the card in its pocket before this, so its place there is in cardPlace
const drawClaim = (claimSeconds) => {
  if (step !== 'claim') {
    // the plane that cuts the edge of the card stays with the card
    build.update({ made: 1, settleSeconds: 99 })
    return
  }
  const made = ease(span(claimSeconds, CLAIM.make))
  const packed = ease(span(claimSeconds, CLAIM.pack))
  card.position.lerpVectors(CLAIM.place, cardPlace, packed)
  card.position.z += Math.sin(packed * Math.PI) * 0.35
  card.rotation.set(
    card.rotation.x * packed,
    CLAIM.lean.yaw * (1 - made),
    CLAIM.lean.roll * (1 - made) + (Math.PI / 2) * ease(span(claimSeconds, CLAIM.turn))
  )
  // far from the box, the shadow of the card on the lid is a second dark card behind it
  card.children[0].castShadow = packed > 0.8
  const settleSeconds = claimSeconds - CLAIM.make[1]
  const shone = build.update({ made: span(claimSeconds, CLAIM.make), settleSeconds })
  // after its way up the card, the light of the foil comes on again at its place
  if (shone === 1) {
    foil.uniforms.uHover.value = ease(span(settleSeconds - light.SHINE.seconds[1], [0, 0.8]))
  }
  if (claimSeconds < CLAIM.hold[1]) return
  // the box stays open with the card in its pocket, as a box that was opened with a press
  step = 'open'
  stepAt = performance.now() / 1000 - TIMES.lid[1]
  nameScene()
}

// the scene has no text. the canvas is its one control, and its name is what Enter does
const nameScene = () => {
  const name =
    step === 'claim'
      ? 'Your Launch Week 16 card'
      : step === 'box'
      ? 'Open the box'
      : isSeatWanted
        ? 'Take the card out of the reader'
        : 'Put the card in the reader'
  canvas.setAttribute('aria-label', name)
}

const isLidOpen = () =>
  step === 'open' && (isMotionReduced || performance.now() / 1000 - stepAt > TIMES.lid[1])

const openBox = () => {
  playOpen()
  step = 'open'
  stepAt = performance.now() / 1000
  hovered = null
  canvas.style.cursor = ''
  nameScene()
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || !isLidOpen() || partAt(event) !== 'card') return
  canvas.setPointerCapture(event.pointerId)
  waySpeed = 0
  grab = { way, y: pointerAt(box.position.z + BOX.depth / 2).y, wasOn: isReaderOn }
  canvas.style.cursor = 'grabbing'
})
canvas.addEventListener('pointermove', (event) => {
  hasPointerMoved = true
  hovered = partAt(event)
  if (!grab) {
    canvas.style.cursor = step === 'box' ? (hovered ? 'pointer' : '') : hovered ? 'grab' : ''
    return
  }
  const moved = pointerAt(box.position.z + BOX.depth / 2).y - grab.y
  way = Math.min(Math.max(grab.way + moved / (TRACK.seat - TRACK.rest), 0), 1)
})
const release = () => {
  if (!grab) return
  isSeatWanted = way > (grab.wasOn ? WAY.outAt : WAY.seatFrom)
  grab = null
  canvas.style.cursor = hovered ? 'grab' : ''
  nameScene()
}
canvas.addEventListener('pointerup', release)
canvas.addEventListener('pointercancel', release)
canvas.addEventListener('pointerleave', () => {
  hovered = null
})
canvas.addEventListener('click', (event) => {
  if (step !== 'box') return
  const part = partAt(event)
  if (part === 'mark') return openBox()
  if (!part) return
  // the mark opens the box with one press. the rest of the box jumps, and it opens only
  // with a second press that comes soon after
  const now = performance.now() / 1000
  if (now - jumpAt < DOUBLE_PRESS_SECONDS) return openBox()
  jumpAt = now
  playKnock(JUMP.seconds * 0.85)
})
// the keys do what the pointer does: they open the box, then put the card in or take it out
canvas.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  if (step === 'box') return openBox()
  if (!isLidOpen()) return
  isSeatWanted = !isSeatWanted
  nameScene()
})
// the page under the scene does not show, so Escape does not close the scene
dialog.addEventListener('cancel', (event) => event.preventDefault())
addEventListener('resize', resize)

// the panel of the title is in the page and not in the dialog. a modal dialog takes all the
// input of the page, so with the panel the dialog is not modal
if (NOTE_TYPE === 'pixel') {
  dialog.show()
  const { openTitlePanel } = await import('./title-tune.js?v=1')
  openTitlePanel({
    title: TITLE,
    theme: pick('dark', 'light'),
    onChange: () => {
      drawSheet(sheetColor.getContext('2d'))
      sheetMaterial.map.needsUpdate = true
    },
  })
} else dialog.showModal()
resize()
nameScene()
requestAnimationFrame(draw)
if (build) {
  const claimButton = Object.assign(document.createElement('button'), {
    className: 'claim-start',
    textContent: 'Claim my card',
  })
  dialog.append(claimButton)
  const lightSwitch = Object.assign(document.createElement('button'), {
    className: 'light-switch',
    role: 'switch',
    innerHTML: 'Light<span></span>',
  })
  lightSwitch.setAttribute('aria-checked', String(isLight))
  dialog.append(lightSwitch)
  // the colors of the room are made at the start, so the switch loads the scene again
  lightSwitch.addEventListener('click', () => {
    const url = new URL(location.href)
    if (isLight) url.searchParams.delete('light')
    else url.searchParams.set('light', '')
    location.href = url
  })
  // the sound needs a press on the page, so it starts with the button
  claimButton.addEventListener('click', () => {
    claimAt = performance.now() / 1000
    claimButton.remove()
    canvas.focus()
    playCreate({
      madeSeconds: CLAIM.make[1],
      shineSeconds: light.SHINE.seconds.map((seconds) => CLAIM.make[1] + seconds),
      turnSeconds: CLAIM.turn,
      volume: 1,
      gap: 1,
    })
  })
}
