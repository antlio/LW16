// the card as a thing in a three.js scene: its size, its shape, and the foil of the page on it

import * as THREE from 'three'
import { SHARED } from './foil.js?v=3'

// one unit is the height of the card
export const CARD = { w: 0.66, h: 1, depth: 0.012, radius: 0.04 }
// a scene shows the card with more light and more color than the page does
const FOIL = { gain: 1.25, color: 1.45 }

const cardShape = new THREE.Shape()
  .moveTo(-CARD.w / 2 + CARD.radius, -CARD.h / 2)
  .absarc(CARD.w / 2 - CARD.radius, -CARD.h / 2 + CARD.radius, CARD.radius, -Math.PI / 2, 0)
  .absarc(CARD.w / 2 - CARD.radius, CARD.h / 2 - CARD.radius, CARD.radius, 0, Math.PI / 2)
  .absarc(-CARD.w / 2 + CARD.radius, CARD.h / 2 - CARD.radius, CARD.radius, Math.PI / 2, Math.PI)
  .absarc(-CARD.w / 2 + CARD.radius, -CARD.h / 2 + CARD.radius, CARD.radius, Math.PI, Math.PI * 1.5)

// a flat card whose picture covers it from edge to edge
export const faceGeometry = new THREE.ShapeGeometry(cardShape, 8)
for (let index = 0; index < faceGeometry.attributes.uv.count; index++) {
  faceGeometry.attributes.uv.setXY(
    index,
    faceGeometry.attributes.position.getX(index) / CARD.w + 0.5,
    faceGeometry.attributes.position.getY(index) / CARD.h + 0.5
  )
}

const bodyGeometry = new THREE.ExtrudeGeometry(cardShape, {
  depth: CARD.depth,
  bevelEnabled: false,
  curveSegments: 8,
})
const bodyMaterial = new THREE.MeshStandardMaterial({
  color: 0x1b1d21,
  roughness: 0.45,
  metalness: 0.4,
})

// a card with its middle at 0. face is the material of its front
export const createCard = (face) => {
  const card = new THREE.Group()
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
  body.position.z = -CARD.depth / 2
  const front = new THREE.Mesh(faceGeometry, face)
  front.position.z = CARD.depth / 2 + 0.0006
  card.add(body, front)
  return card
}

// the card of a scene is upright. a picture on its side goes on it turned, left side at the top.
// then the picture reads when the card is on its side
const uprightOf = (art) => {
  if (art.width <= art.height) return art
  const canvas = Object.assign(document.createElement('canvas'), {
    width: art.height,
    height: art.width,
  })
  const ctx = canvas.getContext('2d')
  ctx.translate(art.height, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(art, 0, 0)
  return canvas
}

// the shader of the foil card of the page, on a card in space. the light of the pointer is
// a light of the scene here. the page draws in display colors, and the scene needs linear ones
export const createFoilMaterial = ({ art, main }) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uArt: {
        value: Object.assign(new THREE.CanvasTexture(uprightOf(art)), {
          flipY: false,
          generateMipmaps: true,
        }),
      },
      uPointer: { value: new THREE.Vector2(0.2, -0.25) },
      uHover: { value: 0 },
    },
    vertexShader: /* glsl */ `
      in vec3 position;
      in vec2 uv;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: `${SHARED.replace('#version 300 es', '')}${main.replace('void main()', 'void cardMain()')}
      void main() {
        cardMain();
        vec3 linear = pow(outColor.rgb, vec3(2.2));
        float light = dot(linear, vec3(.2126, .7152, .0722));
        outColor.rgb = max(mix(vec3(light), linear, ${FOIL.color.toFixed(2)}), 0.) * ${FOIL.gain.toFixed(2)};
      }
    `,
  })

// a plain picture of the paper card, which has no shader
export const drawPaperCard = (handle) => {
  const canvas = Object.assign(document.createElement('canvas'), { width: 330, height: 500 })
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ebe5d0'
  ctx.fillRect(0, 0, 330, 500)
  ctx.fillStyle = '#b99443'
  for (let pin = 0; pin < 10; pin++) ctx.fillRect(53 + pin * 23, 25, 14, 45)
  ctx.fillStyle = '#26262a'
  ctx.font = '500 19px ui-monospace, Menlo, monospace'
  ctx.fillText('Launch Week 16', 30, 400)
  ctx.font = '600 26px ui-monospace, Menlo, monospace'
  ctx.fillText(handle, 30, 432)
  return canvas
}
