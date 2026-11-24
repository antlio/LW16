// the card is made from particles when the scene opens, with no box and no key. the cells
// at the top of the card are first and those at its lower edge are last, so the card is
// made from its top to its bottom (light-build.js). the card then stays in the scene. the
// scene is in a dialog, so the page under it takes no input. a panel changes the values of
// the scene, and with "plain" in the address the scene has no panel

import * as THREE from 'three'
import {
  CARD,
  createCard,
  createFoilMaterial,
  drawPaperCard,
} from '../lw16-crt-slot-foil/card3d.js?v=2'
import { shown } from '../lw16-crt-slot-foil/foil.js?v=3'
import { createBloom } from './bloom.js?v=2'
import { playCreate } from './box-sound.js?v=12'
import {
  CELLS,
  COLORS,
  COLUMN_LIMIT,
  KINDS,
  PARTICLE,
  SHINE,
  createLightBuild,
  ease,
  span,
} from './light-build.js?v=1'

// the scene is made for a column of 9 to 16. a window that is less wide moves the camera back
const VIEW = { fov: 28, distance: 8, column: 9 / 16 }
// where the card is made, in units from the middle of the window
const PLACE = new THREE.Vector3(0, 0.3, 2.5)
// the seconds in which the card is made, after the claim
const MAKE_SECONDS = [0.1, 4.5]
// the card starts with a small turn and a lean, and it has neither at the end
const TURN = { yaw: 0.5, roll: -0.1 }
const ROOM = { color: '#030304' }
// when the card is made, it goes down by a part of its height, and then it turns on its
// side. the seconds are from the moment it is made. the turn starts when the light of the
// foil is at the end of its way up the card (SHINE)
const SETTLE = { down: 0.16, downSeconds: [-0.15, 0.3], turnSeconds: [0.66, 1.66] }
// gap is the time between two grains of the sound, in parts of its first value
const SOUND = { volume: 1, gap: 1 }
const isMotionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const isTuned = !new URLSearchParams(location.search).has('plain')

const dialog = document.createElement('dialog')
dialog.className = 'claim'
dialog.setAttribute('aria-label', 'Your Launch Week 16 card')
dialog.innerHTML = `
  <canvas role="img" aria-label="Your Launch Week 16 card"></canvas>`
document.body.append(dialog)
const canvas = dialog.querySelector('canvas')

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 0.1, 50)
const bloom = createBloom(renderer, { haze: [0.004, 0.004, 0.006] })
// the particles have much light, so the glow of this scene is less than that of the boxes
bloom.strength.value = 0.4
// the edge of the card has a plane that cuts it at the line that makes the card
renderer.localClippingEnabled = true
scene.add(new THREE.HemisphereLight(0x8c8c96, 0x101014, 1.4))

const foil = shown ? createFoilMaterial(shown) : null
// a card with no shader is a picture: the one its script drew on the page, or the paper card
const picture =
  document.getElementById('foil') ??
  drawPaperCard(document.getElementById('card-handle').textContent)
const pictureTexture = new THREE.CanvasTexture(picture)
pictureTexture.colorSpace = THREE.SRGBColorSpace
const card = createCard(foil ?? new THREE.MeshBasicMaterial({ map: pictureTexture }))
scene.add(card)
const build = createLightBuild({ card, foil })

// puts the values of the constants into the scene. the panel calls it after each change
const apply = () => {
  build.apply()
  renderer.setClearColor(ROOM.color)
}

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const facingPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1))

const resize = () => {
  const { clientWidth: width, clientHeight: height } = dialog
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.position.z = VIEW.distance / Math.min(1, camera.aspect / VIEW.column)
  camera.updateProjectionMatrix()
  bloom.resize()
}

// seconds is the time since the scene opened. the steps of the scene are parts of this
// time. with the panel, the timeline of the panel moves the time
const clock = { seconds: 0, isDriven: false }
let lastNow = performance.now()
let hasPointerMoved = false
const cardPlace = new THREE.Vector3()
const lightPlace = new THREE.Vector3()

const draw = (now) => {
  const seconds = now / 1000
  if (!clock.isDriven) clock.seconds += (now - lastNow) / 1000
  lastNow = now
  // with no motion, the card is there at once
  const since = isMotionReduced ? 99 : clock.seconds
  const made = span(since, MAKE_SECONDS)
  const settleSeconds = since - MAKE_SECONDS[1]

  cardPlace.copy(PLACE)
  cardPlace.y +=
    Math.sin(seconds * 0.9) * 0.012 - SETTLE.down * ease(span(settleSeconds, SETTLE.downSeconds))
  card.position.copy(cardPlace)
  // the card turns to the window and comes up from its lean as it is made. its print is on
  // its side, so the card turns on its side when it is made, and the print reads
  const turned = ease(made)
  card.rotation.set(
    0,
    TURN.yaw * (1 - turned) + Math.sin(seconds * 0.5) * 0.08 * turned,
    TURN.roll * (1 - turned) + (Math.PI / 2) * ease(span(settleSeconds, SETTLE.turnSeconds))
  )

  const shone = build.update({ made, settleSeconds })
  if (foil && shone === 1) {
    // the light of the foil is under the pointer after its first move. after its way up the
    // card, it comes on again at its place in 0.8 seconds
    lightPlace
      .set(0.05 + Math.sin(seconds * 0.7) * 0.12, 0.05 + Math.cos(seconds * 0.9) * 0.14, 1)
      .add(cardPlace)
    if (hasPointerMoved) {
      raycaster.setFromCamera(pointer, camera)
      facingPlane.constant = -cardPlace.z
      raycaster.ray.intersectPlane(facingPlane, lightPlace)
    }
    card.updateMatrixWorld()
    card.worldToLocal(lightPlace)
    foil.uniforms.uPointer.value.set(lightPlace.x / (CARD.w / 2), -lightPlace.y / (CARD.h / 2))
    foil.uniforms.uHover.value = ease(span(settleSeconds - SHINE.seconds[1], [0, 0.8]))
  }

  bloom.render(scene, camera)
  requestAnimationFrame(draw)
}

// the sound of a card that is made from its start. the panel stops it when its time stops
// or goes to another second
let stopCreate = () => {}
const stopSound = () => {
  stopCreate()
  stopCreate = () => {}
}
const playSound = () => {
  stopSound()
  stopCreate = playCreate({
    madeSeconds: MAKE_SECONDS[1],
    shineSeconds: SHINE.seconds.map((seconds) => MAKE_SECONDS[1] + seconds),
    turnSeconds: SETTLE.turnSeconds.map((seconds) => MAKE_SECONDS[1] + seconds),
    ...SOUND,
  })
}
canvas.addEventListener('pointermove', (event) => {
  hasPointerMoved = true
  pointer.set(
    (event.clientX / dialog.clientWidth) * 2 - 1,
    1 - (event.clientY / dialog.clientHeight) * 2
  )
})
// the scene is the end, so Escape does not show the page under it
dialog.addEventListener('cancel', (event) => event.preventDefault())
// the panel makes the dialog less high than the window, so the size is that of the dialog
new ResizeObserver(resize).observe(dialog)

apply()
// the panel has parts that it puts in the page and not in the dialog. a dialog that takes
// all the input of the page stops them, so the dialog does not do that with the panel
if (isTuned) dialog.show()
else dialog.showModal()
resize()
requestAnimationFrame(draw)
// with the panel, the timeline starts the sound
if (!isTuned) playSound()

// the panel is after the start of the scene, so the scene starts with no panel too. each
// row is a name, the thing that has the value, the key of the value, and its limits and
// step. the seconds of the steps are bars in the timeline of the panel, and not rows
if (isTuned) {
  const { openPanel } = await import('./tune.js?v=5')
  openPanel({
    parent: dialog,
    clock,
    playSound,
    stopSound,
    make: MAKE_SECONDS,
    after: { down: SETTLE.downSeconds, shine: SHINE.seconds, turn: SETTLE.turnSeconds },
    onChange: apply,
    groups: {
      Cells: [
        ['Cells across', CELLS, 'columns', 12, COLUMN_LIMIT, 1],
        ['Ragged line', CELLS, 'spread', 0, 0.5, 0.01],
        ['Even lower part', CELLS, 'even', 0.01, 1, 0.01],
        ['Flash height', CELLS, 'flash', 0.005, 0.4, 0.005],
        ['Flash color', COLORS, 'flash'],
      ],
      Particles: [
        ['Square size', PARTICLE, 'size', 0.05, 2, 0.05],
        ['Small share', KINDS.small, 'part', 0, 1, 0.01],
        ['Small size', KINDS.small, 'size', 0.05, 2, 0.05],
        ['Tail', PARTICLE, 'tail', 0, 0.4, 0.005],
        ['Light', PARTICLE, 'light', 0, 2, 0.01],
        ['Color split', PARTICLE, 'apart', 0, 0.04, 0.0005],
        ['Color 1', COLORS.layers, 0],
        ['Color 2', COLORS.layers, 1],
        ['Color 3', COLORS.layers, 2],
      ],
      Glyphs: [
        ['Characters', KINDS.glyph, 'text'],
        ['Share', KINDS.glyph, 'part', 0, 1, 0.01],
        ['Size', KINDS.glyph, 'size', 0.2, 8, 0.1],
      ],
      Flight: [
        ['Lead, short', PARTICLE.lead, 0, 0.02, 1, 0.01],
        ['Lead, long', PARTICLE.lead, 1, 0.02, 1, 0.01],
        ['Under, near', PARTICLE.under, 0, 0, 2, 0.01],
        ['Under, far', PARTICLE.under, 1, 0, 2, 0.01],
        ['To the side', PARTICLE, 'side', 0, 3, 0.01],
        ['To the window, near', PARTICLE.near, 0, 0, 2, 0.01],
        ['To the window, far', PARTICLE.near, 1, 0, 2, 0.01],
        ['No wait at lower edge', PARTICLE, 'late', 0, 0.5, 0.01],
      ],
      Motion: [
        ['Start turn', TURN, 'yaw', -1.5, 1.5, 0.01],
        ['Start lean', TURN, 'roll', -1, 1, 0.01],
        ['Down', SETTLE, 'down', 0, 0.6, 0.01],
      ],
      Shine: [
        ['Strength', SHINE, 'light', 0, 1, 0.05],
        ['Spark', SHINE, 'spark', 0, 4, 0.05],
        ['Spark height', SHINE, 'sparkAt', -0.06, 0.06, 0.002],
      ],
      Scene: [
        ['Back', ROOM, 'color'],
        ['Glow', bloom.strength, 'value', 0, 2, 0.05],
      ],
      Sound: [
        ['Volume', SOUND, 'volume', 0, 3, 0.05],
        ['Grain gap', SOUND, 'gap', 0.3, 4, 0.05],
      ],
    },
  })
}
