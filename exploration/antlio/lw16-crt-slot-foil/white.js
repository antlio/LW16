// a white foil card, after a flat design of the user: "LW16" in square pixels and the
// supabase logo at the top, an empty middle, a green tag, and a big name in two lines. the
// card is plain with no light. the light of the pointer shows fine wavy lines on all the
// card, with no big sign in the middle

import { FONT } from '../lw16-crt-slot-dots/font.js'
import { UNION } from '../lw16-crt-slot/mark.js'
import { createArt, startFoil } from './foil.js?v=3'

const SANS = 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif'
const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace'
// with "wide" in its address, this file is the same card on its side
const isWide = new URL(import.meta.url).searchParams.has('wide')
const SIZE = isWide ? { w: 1000, h: 660 } : { w: 660, h: 1000 }
// the place of the print, in pixels of the picture. pixel is one square of the "LW16" letters,
// top is the top of the first row, tag is the top of the tag, and lines are the lines of
// the name. source is the point the wavy lines go around, in units of the card. the card on
// its side has no tag, and only the name of the person
const PRINT = isWide
  ? {
      left: 50,
      right: 950,
      pixel: 8,
      top: 50,
      title: 70,
      lines: [606],
      source: [1.7, -1.2],
    }
  : {
      left: 50,
      right: 610,
      pixel: 8,
      top: 52,
      tag: 672,
      title: 78,
      lines: [836, 924],
      source: [1.05, -1.5],
    }

// red is black ink, and green is the green of the tag and of the logo
const drawArt = (handle) => {
  const ctx = createArt(SIZE)
  const mark = new Path2D(UNION)
  ctx.globalCompositeOperation = 'lighter'

  ctx.fillStyle = '#f00'
  for (const [index, char] of [...'LW16'].entries()) {
    for (const [row, bits] of FONT[char].entries()) {
      for (let column = 0; column < 5; column++) {
        if (!(bits & (16 >> column))) continue
        ctx.fillRect(
          PRINT.left + (index * 6 + column) * PRINT.pixel,
          PRINT.top + row * PRINT.pixel,
          PRINT.pixel,
          PRINT.pixel
        )
      }
    }
  }
  ctx.font = `600 34px ${SANS}`
  ctx.letterSpacing = '-0.5px'
  ctx.textAlign = 'right'
  ctx.fillText('supabase', PRINT.right, PRINT.top + 40)
  const logoLeft = PRINT.right - ctx.measureText('supabase').width - 50
  ctx.textAlign = 'left'
  ctx.save()
  ctx.translate(logoLeft, PRINT.top + 6)
  ctx.scale(38 / 109, 38 / 109)
  ctx.fillStyle = '#0f0'
  ctx.fill(mark)
  ctx.restore()

  if (PRINT.tag) {
    // the tag is as wide as its text
    ctx.font = `600 21px ${MONO}`
    ctx.letterSpacing = '3px'
    const tag = 'TICKET NO. 0042'
    ctx.fillStyle = '#0f0'
    ctx.beginPath()
    ctx.roundRect(PRINT.left, PRINT.tag, ctx.measureText(tag).width + 40, 58, 4)
    ctx.fill()
    ctx.fillStyle = '#f00'
    ctx.fillText(tag, PRINT.left + 21, PRINT.tag + 37)
  }

  // a long name has smaller letters, so each line stays on the card
  ctx.letterSpacing = '-2px'
  for (const [line, text] of [handle, 'Launch Week 16'].slice(0, PRINT.lines.length).entries()) {
    ctx.font = `500 ${PRINT.title}px ${SANS}`
    const size = Math.min(1, (PRINT.right - PRINT.left) / ctx.measureText(text).width) * PRINT.title
    ctx.font = `500 ${size}px ${SANS}`
    ctx.fillText(text, PRINT.left - 3, PRINT.lines[line])
  }
  return ctx.canvas
}

const MAIN = /* glsl */ `
  const vec3 GREEN = vec3(.243, .812, .557);
  const vec3 INK = vec3(.07);
  // the lines go around a point that is off the card, so no part of the card is their middle
  const vec2 SOURCE = vec2(${PRINT.source[0].toFixed(2)}, ${PRINT.source[1].toFixed(2)});

  float etchedPhase(vec2 p) {
    vec2 warp = vec2(sin(p.y * 7. + sin(p.x * 4.)) * .085, sin(p.x * 6. - p.y * 3.) * .07);
    vec2 q = p + warp;
    float radius = length(q * vec2(1., .76));
    return radius * 142. + sin(atan(q.y, q.x) * 3. + radius * 8.) * 1.7;
  }

  void main() {
    vec2 uv = vec2(vUv.x, 1. - vUv.y);
    vec2 p = (uv - .5) * 2. * HALF;
    float aa = max(length(fwidth(p)), .0006);
    vec3 art = texture(uArt, uv).rgb;
    Light light = lightAt(p);
    float noise = grain(p + 2.);
    // far from the light the lines are not there at all, so the card is plain
    float reveal = min(max(light.reveal - .06, 0.) * 1.1, 1.);

    // white paper with a little grain. it is not full white, so the light has room to show
    vec3 color = vec3(.935, .935, .92) + noise * .012 + light.amount * .06;

    float contour = etchedPhase(p - SOURCE);
    float waves = stroke(sin(contour), .06, min(fwidth(contour), 1.));
    // a second, thinner set of lines a little to the side, as a foil has
    float echo = etchedPhase(p - SOURCE - vec2(.007, -.004));
    float echoLines = stroke(sin(echo), .025, min(fwidth(echo), 1.));
    vec3 spectrum = diffraction(acrossOf(contour, p), light.lightAndView, 1.5) * light.illumination;
    vec3 pearl = pearlColor(dot(light.lightAndView, vec2(.48, -.32)) + p.y * .32 + contour * .003);
    // on white paper the foil is a color on the lines, and not more light
    vec3 tint = pearl * .78 + spectrum * .45;
    color = mix(color, tint, (waves * .8 + echoLines * .3) * reveal * .9);
    color = mix(color, pearl * .4 + .6, light.amount * .1);
    // small dots between the lines
    vec2 grid = (fract((p + 1.) * 20.) - .5) / 20.;
    color = mix(color, tint * .8, stroke(length(grid), .0009, aa * .4) * reveal * .5);
    float sparkle = pow(max(noise + .5, 0.), 24.) * light.glint * light.spotlight * light.hover;
    color = mix(color, pearl, min(sparkle * .5, 1.));

    color = mix(color, GREEN * (1. + light.amount * .1), art.g);
    color = mix(color, INK, art.r);
    float rim = stroke(roundedBox(p, HALF, .079) + .004, .0016, aa * .7);
    outColor = vec4(mix(color, INK, rim), 1.);
  }
`

export const foil = { art: drawArt(document.getElementById('card-handle').textContent), main: MAIN }
startFoil(foil)
