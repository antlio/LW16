// the card is made from particles when the person claims it, with no box. the card is a
// grid of small cells, and each cell has one particle. a particle comes from a little
// under its cell, goes up to it, and is that cell of the card when it gets there. the cells
// at the top of the card are first and those at its lower edge are last, so the card is
// made from its top to its bottom. the card then stays in the scene. the scene is in a
// dialog, so the page under it takes no input

import * as THREE from 'three'
import {
  CARD,
  createCard,
  createFoilMaterial,
  drawPaperCard,
} from '../lw16-crt-slot-foil/card3d.js?v=2'
import { shown } from '../lw16-crt-slot-foil/foil.js?v=3'
import { createBloom } from './bloom.js'
import { playCreate } from './box-sound.js?v=3'

// the scene is made for a column of 9 to 16. a window that is less wide moves the camera back
const VIEW = { fov: 28, distance: 8, column: 9 / 16 }
// where the card is made, in units from the middle of the window
const PLACE = new THREE.Vector3(0, 0.3, 2.5)
// the seconds in which the card is made, after the claim
const MAKE_SECONDS = [0.1, 4.5]
// the card starts with a small turn and a lean, and it has neither at the end
const TURN = { yaw: 0.5, roll: -0.1 }
// the cells of the card in its width. spread is how far from its row a cell can be when it
// gets there, in parts of the height of the card, so the line of new cells is not straight.
// a new cell is white, and it has the picture of the card after flash
const CELLS = { columns: 44, spread: 0.16, flash: 0.07 }
CELLS.rows = Math.round((CELLS.columns * CARD.h) / CARD.w)
// the line that makes the card goes from over its top to under its lower edge, in parts of
// its height. the first particles are on their way before the line is at the top
const LINE = { from: 1.42, to: -0.2 }
// a particle: how far under its cell it starts, how far to the side and to the window, how
// long its tail is, how far apart its three colors are, and how much light it has
const PARTICLE = { under: [0.25, 0.75], side: 0.45, near: [0.05, 0.35], tail: 0.07, apart: 0.005, light: 0.42 }
const isMotionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches

const span = (value, [from, to]) => Math.min(Math.max((value - from) / (to - from), 0), 1)
const ease = (value) => value * value * (3 - 2 * value)

const dialog = document.createElement('dialog')
dialog.className = 'claim'
dialog.setAttribute('aria-label', 'Your Launch Week 16 card')
dialog.innerHTML = `
  <canvas aria-hidden="true"></canvas>
  <button class="claim-key" type="button" aria-live="polite">Claim your card</button>`
document.body.append(dialog)
const canvas = dialog.querySelector('canvas')
const claimKey = dialog.querySelector('.claim-key')

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 0.1, 50)
const bloom = createBloom(renderer, { haze: [0.004, 0.004, 0.006] })
renderer.setClearColor(0x030304)
// the edge of the card has a plane that cuts it at the line that makes the card
renderer.localClippingEnabled = true
scene.add(new THREE.HemisphereLight(0x8c8c96, 0x101014, 1.4))

// when the line is at this place, a cell gets there. the shader of the card and the shader
// of the particles have the same text for it, so a particle and its cell agree
const LANDING = /* glsl */ `
  float claimRandom(vec2 seed) { return fract(sin(dot(seed, vec2(127.1, 311.7))) * 43758.5453); }
  float claimLanding(vec2 cell) {
    return (cell.y + .5) / ${CELLS.rows}. + (claimRandom(cell) - .5) * ${CELLS.spread.toFixed(3)};
  }
`

// line is where the line that makes the card is: 1 is the top edge of the card and 0 is
// its lower edge
const line = { value: LINE.from }
const cutPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0))
const foil = shown ? createFoilMaterial(shown) : null
if (foil) {
  foil.uniforms.uLine = line
  // a cell that is not there yet is not drawn, and a new cell is white
  foil.fragmentShader = foil.fragmentShader.replace(
    /void main\(\) \{\s*cardMain\(\);/,
    /* glsl */ `uniform float uLine;
    ${LANDING}
    void main() {
      float claimAt = claimLanding(floor(vUv * vec2(${CELLS.columns}., ${CELLS.rows}.)));
      if (uLine > claimAt) discard;
      cardMain();
      float claimNew = 1. - smoothstep(0., ${CELLS.flash.toFixed(3)}, claimAt - uLine);
      outColor.rgb = mix(outColor.rgb, vec3(1.), claimNew * .7);`
  )
}
// a card with no shader is a picture: the one its script drew on the page, or the paper card
const picture =
  document.getElementById('foil') ??
  drawPaperCard(document.getElementById('card-handle').textContent)
const pictureTexture = new THREE.CanvasTexture(picture)
pictureTexture.colorSpace = THREE.SRGBColorSpace
const card = createCard(
  foil ?? new THREE.MeshBasicMaterial({ map: pictureTexture, clippingPlanes: [cutPlane] })
)
// the edge of the card is one material for all cards, so this card has its own
card.children[0].material = card.children[0].material.clone()
card.children[0].material.clippingPlanes = [cutPlane]
scene.add(card)

// one particle for each cell: a small square with a tail. each has the column and the row
// of its cell, and three numbers of its own
const particleShape = new THREE.InstancedBufferGeometry()
particleShape.setAttribute(
  'position',
  new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3)
)
particleShape.setIndex([0, 1, 2, 2, 1, 3])
const cellCount = CELLS.columns * CELLS.rows
particleShape.setAttribute(
  'aCell',
  new THREE.InstancedBufferAttribute(
    Float32Array.from({ length: cellCount * 2 }, (_, index) =>
      index % 2 ? Math.floor(index / 2 / CELLS.columns) : Math.floor(index / 2) % CELLS.columns
    ),
    2
  )
)
particleShape.setAttribute(
  'aSeed',
  new THREE.InstancedBufferAttribute(Float32Array.from({ length: cellCount * 3 }, Math.random), 3)
)
particleShape.instanceCount = cellCount
// the particles are drawn three times, in red, green and blue, a little apart. they are
// parts of the card, so they turn with it
const particles = [
  [PARTICLE.apart, 0xff0000],
  [0, 0x00ff00],
  [-PARTICLE.apart, 0x0000ff],
].map(([apart, color]) => {
  const mesh = new THREE.Mesh(
    particleShape,
    new THREE.ShaderMaterial({
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      // a particle that goes to the side has its shape turned over, so its two sides are drawn
      side: THREE.DoubleSide,
      uniforms: { uLine: line, uApart: { value: apart }, uColor: { value: new THREE.Color(color) } },
      vertexShader: /* glsl */ `
        attribute vec2 aCell;
        attribute vec3 aSeed;
        uniform float uLine;
        uniform float uApart;
        varying float vLight;
        varying float vAlong;
        ${LANDING}
        void main() {
          // way is 0 when the particle starts and 1 when it is at its cell. a particle is
          // on its way while the line comes down to the place of its cell
          float lead = .12 + aSeed.x * .2;
          float way = 1. - (uLine - claimLanding(aCell)) / lead;
          float isOn = step(0., way) * step(way, 1.);
          way = clamp(way, 0., 1.);
          vec3 cell = vec3(
            ((aCell + .5) / vec2(${CELLS.columns}., ${CELLS.rows}.) - .5) * vec2(${CARD.w.toFixed(3)}, ${CARD.h.toFixed(3)}),
            ${(CARD.depth / 2 + 0.002).toFixed(4)}
          );
          vec3 start = cell + vec3(
            (aSeed.y - .5) * ${PARTICLE.side.toFixed(2)},
            -mix(${PARTICLE.under[0].toFixed(2)}, ${PARTICLE.under[1].toFixed(2)}, aSeed.z),
            mix(${PARTICLE.near[0].toFixed(2)}, ${PARTICLE.near[1].toFixed(2)}, aSeed.x)
          );
          // fast at first, then slow near its cell
          vec3 here = mix(start, cell, 1. - pow(1. - way, 3.));
          here.x += sin(way * 6. + aSeed.z * 40.) * .03 * (1. - way);
          // the square is as large as a cell when it gets there, and its tail has no length then
          vec2 along = normalize(cell.xy - start.xy);
          float size = ${(CARD.w / CELLS.columns / 2).toFixed(5)} * mix(.35, 1., way);
          float tail = pow(1. - way, 1.5) * ${PARTICLE.tail.toFixed(2)};
          here.xy += vec2(along.y, -along.x) * size * position.x
            + along * (position.y > 0. ? size : -size - tail)
            + vec2(uApart * (1. - way), 0.);
          vLight = isOn * smoothstep(0., .2, way) * (.4 + aSeed.y);
          vAlong = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(here, 1.);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vLight;
        varying float vAlong;
        void main() {
          // the tail has less light than the square
          float light = vLight * mix(.1, 1., smoothstep(-1., .3, vAlong));
          gl_FragColor = vec4(uColor * light * ${PARTICLE.light.toFixed(1)}, 1.);
        }
      `,
    })
  )
  mesh.frustumCulled = false
  mesh.renderOrder = 2
  return mesh
})
card.add(...particles)

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

// wait: the key is there. make: the card is made. ready: the card is there
let step = 'wait'
let stepAt = 0
let hasPointerMoved = false
const cardPlace = new THREE.Vector3()
const lightPlace = new THREE.Vector3()
const cardUp = new THREE.Vector3()

const draw = (now) => {
  const seconds = now / 1000
  // with no motion, each step shows its last picture at once
  const since = isMotionReduced ? 99 : seconds - stepAt
  const made = step === 'wait' ? 0 : step === 'make' ? span(since, MAKE_SECONDS) : 1

  cardPlace.copy(PLACE)
  cardPlace.y += Math.sin(seconds * 0.9) * 0.012
  card.position.copy(cardPlace)
  // the card turns to the window and comes up from its lean as it is made
  const turned = ease(made)
  card.rotation.set(
    0,
    TURN.yaw * (1 - turned) + Math.sin(seconds * 0.5) * 0.08 * turned,
    TURN.roll * (1 - turned)
  )

  line.value = LINE.from + (LINE.to - LINE.from) * made
  // the edge of the card is there only where all the cells are there
  cardUp.set(0, 1, 0).applyQuaternion(card.quaternion)
  cutPlane.setFromNormalAndCoplanarPoint(
    cardUp,
    lightPlace
      .copy(cardUp)
      .multiplyScalar((line.value + CELLS.spread / 2 - 0.5) * CARD.h)
      .add(cardPlace)
  )

  if (step === 'make') {
    claimKey.textContent = `Making your card ${Math.round(made * 100)}%`
    if (made === 1) show('ready')
  }

  if (foil) {
    // the light of the foil is under the pointer after its first move
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
    foil.uniforms.uHover.value = 1
  }

  bloom.render(scene, camera)
  requestAnimationFrame(draw)
}

const show = (next) => {
  step = next
  stepAt = performance.now() / 1000
  if (step !== 'ready') return
  // the key goes away, and the card is the last thing. a press on it does nothing
  claimKey.dataset.done = ''
  claimKey.inert = true
  canvas.removeAttribute('aria-hidden')
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', 'Your Launch Week 16 card')
}

claimKey.addEventListener('click', () => {
  if (step !== 'wait') return
  claimKey.setAttribute('aria-disabled', 'true')
  playCreate(MAKE_SECONDS[1])
  show('make')
})
canvas.addEventListener('pointermove', (event) => {
  hasPointerMoved = true
  pointer.set(
    (event.clientX / dialog.clientWidth) * 2 - 1,
    1 - (event.clientY / dialog.clientHeight) * 2
  )
})
// the scene is the end, so Escape does not show the page under it
dialog.addEventListener('cancel', (event) => event.preventDefault())
addEventListener('resize', resize)

dialog.showModal()
resize()
requestAnimationFrame(draw)
