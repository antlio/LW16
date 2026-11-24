// a card that is made from particles. the card is a grid of small cells, and each cell has
// one particle. a particle comes from a little under its cell, goes up to it, and is that
// cell of the card when it gets there. a spark and one pass of the light of the foil come
// as the last cells get there. a scene makes the card (../lw16-crt-slot-foil/card3d.js),
// gives it to createLightBuild, and tells it in each frame how much of the card is made.
// the edge of the card has a plane that cuts it, so the scene needs
// renderer.localClippingEnabled

import * as THREE from 'three'
import { CARD } from '../lw16-crt-slot-foil/card3d.js?v=2'
import { FONT } from '../lw16-crt-slot-dots/font.js'

// the most cells in the width of the card that a panel can set
export const COLUMN_LIMIT = 90
// the cells of the card in its width. spread is how far from its row a cell can be when it
// gets there, in parts of the height of the card, so the line of new cells is not straight.
// a new cell has the color of the flash, and it has the picture of the card after flash. in
// the lowest part of the card (even), the spread goes down to 0. so the last row gets there
// as one line, and no cell is late
export const CELLS = { columns: 53, spread: 0.19, flash: 0.08, even: 0.62 }
// a particle. size is its size at its start, in parts of a cell. lead is how far the line
// is from its cell when it starts. then: how far under its cell it starts, how far to the
// side and to the window, the length of its tail, the space between its three colors, and
// its light. a particle gets slow near its cell, and it stays there until the cell is
// there. under the lowest rows that shows as a line of squares under the card. so in the
// lowest part of the card (late), a particle does not get slow, and it is at its cell only
// when the cell is there
export const PARTICLE = {
  size: 0.05,
  lead: [0.12, 0.32],
  under: [0.25, 0.75],
  side: 0.45,
  near: [0.05, 0.35],
  tail: 0.02,
  apart: 0.005,
  light: 1.15,
  late: 0.12,
}
// a particle is a square, a small square or a glyph. part is the share of the particles
// of that kind. size is its size on its way, in parts of a cell. text is the glyphs
export const KINDS = {
  small: { part: 0.81, size: 0.4 },
  glyph: { part: 0.1, size: 1.9, text: 'SUPABASE' },
}
// a particle is drawn three times, a little apart, once in each color of layers
export const COLORS = { flash: '#ffffff', layers: ['#ff0000', '#00ff00', '#0000ff'] }
// as the last cells get there, the light of the foil goes up the card one time, from under
// its lower edge to over its top. it is a band as wide as the card then, and not a spot.
// the card has no light of the foil before that. the seconds are from the moment the card
// is made. light is how much of that light the card gets, and 1 is all of it. a spark near
// the lower edge of the card starts it. spark is the light of that spark, and sparkAt is
// how far it is over that edge, in parts of the height of the card
export const SHINE = { seconds: [-0.14, 0.66], light: 1, spark: 1, sparkAt: 0.008 }

// a panel can set an end that is before its start, and the value is then 0 or 1
export const span = (value, [from, to]) =>
  Math.min(Math.max((value - from) / Math.max(to - from, 0.000001), 0), 1)
export const ease = (value) => value * value * (3 - 2 * value)

// when the line is at this place, a cell gets there. the shader of the card and the shader
// of the particles have the same text for it, so a particle and its cell agree
const LANDING = /* glsl */ `
  uniform vec2 uGrid;
  uniform vec2 uSpread;
  float claimRandom(vec2 seed) { return fract(sin(dot(seed, vec2(127.1, 311.7))) * 43758.5453); }
  float claimLanding(vec2 cell) {
    float height = (cell.y + .5) / uGrid.y;
    return height + (claimRandom(cell) - .5) * uSpread.x * smoothstep(0., uSpread.y, height);
  }
`

// foil is the material of the front of the card when it is the foil of card3d.js, and
// null for a card that is a picture
export const createLightBuild = ({ card, foil }) => {
  // the values that the shaders get. the shader of the card and the shaders of the
  // particles have the same ones. uLine is where the line that makes the card is: 1 is the
  // top edge of the card and 0 is its lower edge
  const uniforms = {
    uLine: { value: 0 },
    uGrid: { value: new THREE.Vector2() },
    uSpread: { value: new THREE.Vector2() },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color() },
    uBand: { value: 0 },
    uLead: { value: new THREE.Vector2() },
    uUnder: { value: new THREE.Vector2() },
    uNear: { value: new THREE.Vector2() },
    uSizes: { value: new THREE.Vector3() },
    uParts: { value: new THREE.Vector2() },
    uSide: { value: 0 },
    uTail: { value: 0 },
    uLate: { value: 0 },
    uApart: { value: 0 },
    uLight: { value: 0 },
    uGlyphs: { value: null },
    uGlyphCount: { value: 0 },
  }

  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0))
  const [edge, front] = card.children
  // the edge of the card is one material for all cards, so this card has its own
  edge.material = edge.material.clone()
  edge.material.clippingPlanes = [cutPlane]
  if (!foil) front.material.clippingPlanes = [cutPlane]
  if (foil) {
    Object.assign(foil.uniforms, uniforms)
    // the ink line at the edge of the card of the page is thinner than a pixel here. it
    // breaks up when the card turns, so the scene does not draw it
    foil.fragmentShader = foil.fragmentShader.replace(/float rim = [^;]+;/g, 'float rim = 0.;')
    // the light of the foil is a spot with a line of more light in it. uBand makes it a
    // band across the card, with all of its light
    foil.fragmentShader = foil.fragmentShader
      .replace('uniform float uHover;', 'uniform float uHover;\n  uniform float uBand;')
      .replace(
        'float lightBand = exp(-sweep * sweep / (.36 * .36));',
        'float lightBand = mix(exp(-sweep * sweep / (.36 * .36)), 1., uBand);'
      )
      .replace(
        'float spotlight = exp(-dot(oval, oval) * 2.6);',
        'float spotlight = mix(exp(-dot(oval, oval) * 2.6), exp(-delta.y * delta.y * 3.), uBand);'
      )
    // the edge of the card is soft over one pixel, as the edge of the card of the page is.
    // the card has much more light than the dark behind it. so the samples of the scene
    // alone leave steps on its edge. the power makes the soft part even to the eye
    foil.transparent = true
    // a cell that is not there yet is not drawn, and a new cell has the color of the flash
    foil.fragmentShader = foil.fragmentShader.replace(
      /void main\(\) \{\s*cardMain\(\);/,
      /* glsl */ `uniform float uLine;
      uniform float uFlash;
      uniform vec3 uFlashColor;
      ${LANDING}
      void main() {
        float claimAt = claimLanding(floor(vUv * uGrid));
        if (uLine > claimAt) discard;
        cardMain();
        float claimNew = 1. - smoothstep(0., uFlash, claimAt - uLine);
        outColor.rgb = mix(outColor.rgb, uFlashColor, claimNew * .7);
        vec2 claimPoint = (vUv - .5) * 2. * HALF;
        float claimEdge = roundedBox(claimPoint, HALF, ${(CARD.radius * 2).toFixed(3)});
        outColor.a = pow(clamp(-claimEdge / length(fwidth(claimPoint)), 0., 1.), 2.2);`
    )
  }

  // one particle for each cell: a square with a tail, a small square with a short tail, or
  // a glyph with no tail. each has the column and the row of its cell, and four numbers of
  // its own. the lists have room for the most cells that a panel can set
  const particleShape = new THREE.InstancedBufferGeometry()
  particleShape.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3)
  )
  particleShape.setIndex([0, 1, 2, 2, 1, 3])
  const cellLimit = COLUMN_LIMIT * Math.round((COLUMN_LIMIT * CARD.h) / CARD.w)
  const cellsOfParticles = new THREE.InstancedBufferAttribute(new Float32Array(cellLimit * 2), 2)
  particleShape.setAttribute('aCell', cellsOfParticles)
  particleShape.setAttribute(
    'aSeed',
    new THREE.InstancedBufferAttribute(Float32Array.from({ length: cellLimit * 4 }, Math.random), 4)
  )
  // the particles are drawn three times, a little apart. they are parts of the card, so
  // they turn with it
  const particles = [1, 0, -1].map((shift) => {
    const mesh = new THREE.Mesh(
      particleShape,
      new THREE.ShaderMaterial({
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        // a particle that goes to the side has its shape turned over, so its two sides are drawn
        side: THREE.DoubleSide,
        uniforms: { ...uniforms, uShift: { value: shift }, uColor: { value: new THREE.Color() } },
        vertexShader: /* glsl */ `
          attribute vec2 aCell;
          attribute vec4 aSeed;
          uniform float uLine;
          uniform float uShift;
          uniform float uApart;
          uniform float uSide;
          uniform float uTail;
          uniform float uLate;
          uniform float uGlyphCount;
          uniform vec2 uLead;
          uniform vec2 uUnder;
          uniform vec2 uNear;
          uniform vec2 uParts;
          uniform vec3 uSizes;
          varying float vLight;
          varying vec2 vAt;
          varying float vGlyph;
          varying float vFull;
          ${LANDING}
          void main() {
            // way is 0 when the particle starts and 1 when it is at its cell. a particle is
            // on its way while the line comes down to the place of its cell
            float way = 1. - (uLine - claimLanding(aCell)) / mix(uLead.x, uLead.y, aSeed.x);
            float isOn = step(0., way) * step(way, 1.);
            way = clamp(way, 0., 1.);
            vec3 cell = vec3(
              ((aCell + .5) / uGrid - .5) * vec2(${CARD.w.toFixed(3)}, ${CARD.h.toFixed(3)}),
              ${(CARD.depth / 2 + 0.002).toFixed(4)}
            );
            vec3 start = cell + vec3(
              (aSeed.y - .5) * uSide,
              -mix(uUnder.x, uUnder.y, aSeed.z),
              mix(uNear.x, uNear.y, aSeed.x)
            );
            // fast at first, then slow near its cell. in the lowest rows its speed does not
            // change
            float late = 1. - clamp((aCell.y + .5) / uGrid.y / max(uLate, .0001), 0., 1.);
            vec3 here = mix(start, cell, mix(1. - pow(1. - way, 3.), way, late));
            here.x += sin(way * 6. + aSeed.z * 40.) * .03 * (1. - way);
            float isGlyph = step(aSeed.w, uParts.x);
            float isSmall = step(aSeed.w, uParts.y) - isGlyph;
            // each kind is as large as a cell when it gets there, and its tail has no length
            // then. the small square and the glyph keep their size until they are near the cell
            vFull = smoothstep(.7, 1., way);
            float grow = mix(uSizes.x, 1., way);
            grow = mix(grow, mix(uSizes.y, 1., vFull), isSmall);
            grow = mix(grow, mix(uSizes.z, 1., vFull), isGlyph);
            float size = ${(CARD.w / 2).toFixed(3)} / uGrid.x * grow;
            float tail = pow(1. - way, 1.5) * uTail * (1. - isGlyph) * (1. - isSmall * .5);
            // a glyph does not turn with its way, so it reads
            vec2 along = mix(normalize(cell.xy - start.xy), vec2(0., 1.), isGlyph);
            here.xy += vec2(along.y, -along.x) * size * position.x
              + along * (position.y > 0. ? size : -size - tail)
              + vec2(uShift * uApart * (1. - way), 0.);
            vLight = isOn * smoothstep(0., .2, way) * (.4 + aSeed.y);
            vAt = position.xy;
            vGlyph = isGlyph > 0. ? floor(aSeed.w / uParts.x * uGlyphCount) : -1.;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(here, 1.);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform sampler2D uGlyphs;
          uniform float uGlyphCount;
          uniform float uLight;
          varying float vLight;
          varying vec2 vAt;
          varying float vGlyph;
          varying float vFull;
          void main() {
            // the tail has less light than the square
            float light = vLight * mix(.1, 1., smoothstep(-1., .3, vAt.y));
            if (vGlyph >= 0.) {
              // the glyph is in the middle 5 columns of a square of 7 by 7 dots. the square
              // is full when the glyph is at its cell
              vec2 pixel = min(floor((vAt * .5 + .5) * 7.), 6.) - vec2(1., 0.);
              float ink = pixel.x < 0. || pixel.x > 4. ? 0. : texture2D(
                uGlyphs,
                vec2((vGlyph * 5. + pixel.x + .5) / (uGlyphCount * 5.), 1. - (pixel.y + .5) / 7.)
              ).r;
              light = vLight * mix(ink, 1., vFull);
            }
            gl_FragColor = vec4(uColor * light * uLight, 1.);
          }
        `,
      })
    )
    mesh.frustumCulled = false
    mesh.renderOrder = 2
    return mesh
  })

  // the spark that starts the light of the foil: a thin line of light along the lower edge
  // of the card, with most of its light at its middle. it is not a dot
  const spark = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD.w * 1.1, 0.16),
    new THREE.ShaderMaterial({
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      uniforms: {
        uColor: uniforms.uFlashColor,
        uLight: { value: 0 },
        uReach: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vAt;
        void main() {
          vAt = uv * 2. - 1.;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uLight;
        uniform float uReach;
        varying vec2 vAt;
        void main() {
          // the light is 0 at the sides of the plane, so the shape of the plane does not show
          float along = exp(-vAt.x * vAt.x / (uReach * uReach)) * smoothstep(1., .55, abs(vAt.x));
          float line = exp(-vAt.y * vAt.y * 60.);
          float glow = exp(-vAt.y * vAt.y * 6.) * .12;
          gl_FragColor = vec4(uColor * (line + glow) * along * uLight, 1.);
        }
      `,
    })
  )
  spark.position.z = CARD.depth / 2 + 0.003
  spark.renderOrder = 3
  card.add(...particles, spark)

  let glyphText = null
  const cardUp = new THREE.Vector3()
  const cutPoint = new THREE.Vector3()

  // puts the values of the constants into the card. a panel calls it after each change
  const apply = () => {
    const rows = Math.round((CELLS.columns * CARD.h) / CARD.w)
    for (let index = 0; index < CELLS.columns * rows; index++) {
      cellsOfParticles.array[index * 2] = index % CELLS.columns
      cellsOfParticles.array[index * 2 + 1] = Math.floor(index / CELLS.columns)
    }
    cellsOfParticles.needsUpdate = true
    particleShape.instanceCount = CELLS.columns * rows

    // the font has only capital letters, and a glyph that is not in it is not drawn
    const glyphs = [...KINDS.glyph.text.toUpperCase()].filter((char) => FONT[char])
    if (glyphs.length && glyphs.join('') !== glyphText) {
      glyphText = glyphs.join('')
      // the dots of the glyphs, one glyph after the other, 5 by 7 each. the first row of
      // the picture is the top row of a glyph
      const dots = new Uint8Array(glyphs.length * 5 * 7)
      for (const [index, char] of glyphs.entries()) {
        for (const [row, bits] of FONT[char].entries()) {
          for (let column = 0; column < 5; column++) {
            if (bits & (16 >> column)) dots[(row * glyphs.length + index) * 5 + column] = 255
          }
        }
      }
      uniforms.uGlyphs.value?.dispose()
      uniforms.uGlyphs.value = new THREE.DataTexture(dots, glyphs.length * 5, 7, THREE.RedFormat)
      uniforms.uGlyphs.value.needsUpdate = true
      uniforms.uGlyphCount.value = glyphs.length
    }
    // with no glyph to draw, no particle is a glyph
    const glyphPart = glyphs.length ? KINDS.glyph.part : -1

    uniforms.uGrid.value.set(CELLS.columns, rows)
    uniforms.uSpread.value.set(CELLS.spread, CELLS.even)
    uniforms.uFlash.value = CELLS.flash
    uniforms.uFlashColor.value.set(COLORS.flash)
    uniforms.uLead.value.fromArray(PARTICLE.lead)
    uniforms.uUnder.value.fromArray(PARTICLE.under)
    uniforms.uNear.value.fromArray(PARTICLE.near)
    uniforms.uSizes.value.set(PARTICLE.size, KINDS.small.size, KINDS.glyph.size)
    uniforms.uParts.value.set(glyphPart, Math.max(glyphPart, 0) + KINDS.small.part)
    uniforms.uSide.value = PARTICLE.side
    uniforms.uTail.value = PARTICLE.tail
    uniforms.uLate.value = PARTICLE.late
    uniforms.uApart.value = PARTICLE.apart
    uniforms.uLight.value = PARTICLE.light
    for (const [index, mesh] of particles.entries()) {
      mesh.material.uniforms.uColor.value.set(COLORS.layers[index])
    }
    spark.position.y = (SHINE.sparkAt - 0.5) * CARD.h
  }
  apply()

  // made is the part of the card that is made, from 0 to 1. settleSeconds is the seconds
  // since the card is made, and it is under 0 before that. the card must be at its place
  // of this frame. the result is how far the light of the foil is on its way up the card:
  // under 1, that light is not the light of the scene
  const update = ({ made, settleSeconds }) => {
    // the line goes from over the top of the card to a little under its lower edge. at its
    // start, the particle with the longest lead to the highest cell has not started
    const lineFrom = 1 + CELLS.spread / 2 + PARTICLE.lead[1] + 0.02
    // a cell is white while the line is near it, so the line goes on under the card when
    // the card is made. the last rows then get the picture of the card too
    uniforms.uLine.value =
      lineFrom + (-0.02 - lineFrom) * made - 2 * CELLS.flash * span(settleSeconds, [0, 0.3])
    // the edge of the card is there only where all the cells are there
    cardUp.set(0, 1, 0).applyQuaternion(card.quaternion)
    cutPlane.setFromNormalAndCoplanarPoint(
      cardUp,
      cutPoint
        .copy(cardUp)
        .multiplyScalar(
          (uniforms.uLine.value +
            (CELLS.spread / 2) *
              THREE.MathUtils.smoothstep(uniforms.uLine.value + CELLS.spread / 2, 0, CELLS.even) -
            0.5) *
            CARD.h
        )
        .add(card.position)
    )

    // the spark comes on fast, and it goes out while it gets to the corners of the card
    const sparkSeconds = settleSeconds - SHINE.seconds[0]
    spark.material.uniforms.uLight.value =
      SHINE.spark * span(sparkSeconds, [0, 0.05]) * (1 - span(sparkSeconds, [0.05, 0.35]))
    spark.material.uniforms.uReach.value = 0.25 + 0.35 * ease(span(sparkSeconds, [0, 0.25]))

    // on its way up the card, the light starts and ends off the card, and it has no light
    // there. so its move to its place in the scene after that does not show
    const shone = span(settleSeconds, SHINE.seconds)
    uniforms.uBand.value = shone < 1 ? 1 : 0
    if (foil && shone < 1) {
      foil.uniforms.uPointer.value.set(0, THREE.MathUtils.lerp(1.9, -1.9, shone))
      foil.uniforms.uHover.value = SHINE.light * span(shone, [0, 0.15]) * (1 - span(shone, [0.85, 1]))
    }
    return shone
  }

  return { apply, update }
}
