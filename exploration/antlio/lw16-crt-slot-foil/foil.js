// what the foil cards share: the light of the pointer, the colors of the foil, the grain, the
// ink and the canvas. the light, the foil and the grain are from the holographic card
// example of vgpu (github.com/vercel-labs/vgpu, MIT, copyright (c) 2025 Vercel, Inc.),
// moved from WGSL to GLSL

export const ART = { w: 660, h: 1000 }
const SANS = 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif'
const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace'

// a black picture for the shader of a card. each card draws its own parts on it, in red for
// ink and in green and blue for what its shader needs
export const createArt = ({ w, h } = ART) => {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  return ctx
}

// the event name at a height, and the lines at the bottom of each card
export const drawLettering = ({ ctx, handle, titleY }) => {
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = '#f00'
  ctx.font = `600 76px ${SANS}`
  ctx.fillText('LW16', 56, titleY)
  ctx.font = `500 46px ${SANS}`
  ctx.fillText(handle, 56, 880)
  ctx.font = `500 21px ${MONO}`
  ctx.letterSpacing = '4px'
  ctx.fillText('LAUNCH WEEK 16', 56, 932)
  ctx.textAlign = 'right'
  ctx.fillText('NO. 0042', 608, 880)
  ctx.fillText('6 TO 10 DEC 2026', 608, 932)
}

const VERTEX = /* glsl */ `#version 300 es
  in vec2 aPosition;
  out vec2 vUv;
  void main() {
    vUv = aPosition * .5 + .5;
    gl_Position = vec4(aPosition, 0., 1.);
  }
`

// the start of the fragment shader of each card. the card adds its own main after it
export const SHARED = /* glsl */ `#version 300 es
  precision highp float;
  precision highp int;
  uniform sampler2D uArt;
  uniform vec2 uPointer;
  uniform float uHover;
  in vec2 vUv;
  out vec4 outColor;

  // half the size of the card, with its long side as 1, its center at 0 and y down. the upright
  // card is .66 by 1. a scene that does not set the size has the upright card
  uniform vec2 uHalf;
  #define HALF (uHalf.x > 0. ? uHalf : vec2(.66, 1.))
  const vec3 TINT = vec3(.72, .76, .8);

  float roundedBox(vec2 p, vec2 halfSize, float radius) {
    vec2 q = abs(p) - halfSize + radius;
    return length(max(q, vec2(0.))) + min(max(q.x, q.y), 0.) - radius;
  }

  float segment(vec2 p, vec2 a, vec2 b) {
    vec2 v = b - a;
    return length(p - a - v * clamp(dot(p - a, v) / dot(v, v), 0., 1.));
  }

  float stroke(float away, float width, float aa) {
    return 1. - smoothstep(width, width + aa, abs(away));
  }

  // visible wavelengths in micrometers, as display colors
  vec3 wavelengthColor(float wavelength) {
    vec3 response = (vec3(wavelength) - vec3(.610, .545, .460)) / vec3(.045, .038, .032);
    float visible = smoothstep(.380, .410, wavelength) * (1. - smoothstep(.700, .780, wavelength));
    return exp(-.5 * response * response) * visible;
  }

  // a reflection grating: order * wavelength = spacing * dot(light + view, across)
  // after the diffraction model of GPU Gems, chapter 8 (Jos Stam)
  vec3 diffraction(vec2 across, vec2 lightAndView, float spacing) {
    float pathDifference = spacing * abs(dot(lightAndView, across));
    float along = dot(lightAndView, vec2(-across.y, across.x));
    float envelope = exp(-along * along / .36);
    vec3 reflected = vec3(0.);
    for (int order = 1; order <= 3; order++) {
      float m = float(order);
      reflected += wavelengthColor(pathDifference / m) / (m * m);
    }
    return reflected * envelope;
  }

  vec3 pearlColor(float phase) {
    return vec3(.55, .52, .64) + vec3(.43, .40, .34) * cos(6.2831853 * (phase + vec3(.05, .38, .63)));
  }

  // grain that stays on the surface: grain that moves reads as snow
  float grain(vec2 point) {
    uvec2 q = uvec2(abs(point) * 2400.);
    uint n = (q.x * 1597334677u) ^ (q.y * 3812015801u);
    n = (n ^ (n >> 16u)) * 2246822519u;
    return float(n & 1023u) / 1023. - .5;
  }

  // the direction across the lines of a field, in the plane of the card
  vec2 acrossOf(float field, vec2 p) {
    vec2 dx = dFdx(p);
    vec2 dy = dFdy(p);
    vec2 gradient = vec2(dFdx(field) * dy.y - dFdy(field) * dx.y, dFdy(field) * dx.x - dFdx(field) * dy.x);
    return gradient / max(length(gradient), .00000001);
  }

  // the light of the pointer at a point of the card. amount is how much of it the point
  // gets, glint is a thin bright line in it, and reveal is how much foil it shows
  struct Light {
    float hover;
    float spotlight;
    float glint;
    float amount;
    float reveal;
    vec2 delta;
    vec2 lightAndView;
    float illumination;
  };

  Light lightAt(vec2 p) {
    float hover = clamp(uHover, 0., 1.);
    vec3 hit = vec3(p, 0.);
    vec2 lightCenter = uPointer * HALF;
    vec2 delta = p - lightCenter;
    float sweep = delta.x * .72 + delta.y * .52 + sin(p.y * 4. + p.x * 3.) * .08;
    float lightBand = exp(-sweep * sweep / (.36 * .36));
    vec2 oval = delta * vec2(1.05, .72);
    float spotlight = exp(-dot(oval, oval) * 2.6);
    float amount = lightBand * spotlight * hover;
    vec3 toLight = normalize(vec3(lightCenter, 1.2) - hit);
    vec3 toEye = normalize(vec3(0., 0., 4.5) - hit);
    return Light(
      hover,
      spotlight,
      exp(-sweep * sweep / (.085 * .085)),
      amount,
      hover * (.06 + .24 * spotlight + amount * 1.15),
      delta,
      (toLight + toEye).xy,
      max(toLight.z, 0.) * max(toEye.z, 0.)
    );
  }

  // the card with no foil: dark and matte, with a grain that the light shows more
  vec3 graphite(vec2 p, Light light, float noise) {
    vec3 color = vec3(.085, .09, .1) + .008 * (.9 - p.y);
    color += noise * (.022 + light.amount * .085);
    return color + light.amount * (vec3(.045) + TINT * .065);
  }

  // the ink, a small plus and the rim go on last. the ink does not change with the light
  vec3 finish(vec3 color, vec2 p, float aa, float ink, Light light, vec3 pearl) {
    color = mix(color, vec3(.77, .79, .82), ink);
    vec2 plus = p - vec2(.52, -.84);
    float plusMark = min(segment(plus, vec2(-.024, 0.), vec2(.024, 0.)), segment(plus, vec2(0., -.024), vec2(0., .024)));
    color = mix(color, vec3(.48, .51, .55), stroke(plusMark, .0007, aa * .65));
    float rim = stroke(roundedBox(p, HALF, .079) + .004, .0012, aa * .7);
    float rimLight = pow(max(0., 1. - length(light.delta) * .65), 3.) * light.hover;
    return mix(color, vec3(.25, .28, .32) + (pearl * .7 + TINT * .3) * rimLight * .6, rim);
  }
`

// the art and the shader of the card that the page shows, for a scene that draws it again
export let shown = null

// draws a card on the canvas in the card button. art is the picture of the card, and main is
// the end of its fragment shader. with no WebGL2 the canvas goes, and the paper card under
// it stays
export const startFoil = ({ art, main }) => {
  const canvas = document.getElementById('foil')
  // a page with no card button takes the art and the shader of a card, and draws them itself
  if (!canvas) return
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false })
  if (!gl) return canvas.remove()
  shown = { art, main }

  const program = gl.createProgram()
  for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, SHARED + main]]) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader))
    gl.attachShader(program, shader)
  }
  gl.bindAttribLocation(program, 0, 'aPosition')
  gl.linkProgram(program)
  gl.useProgram(program)

  // one triangle that is bigger than the canvas covers it with no seam
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  const uPointer = gl.getUniformLocation(program, 'uPointer')
  const uHover = gl.getUniformLocation(program, 'uHover')
  // the shape of the card is that of its picture, so a picture on its side is a card on its side
  const longSide = Math.max(art.width, art.height)
  gl.uniform2f(gl.getUniformLocation(program, 'uHalf'), art.width / longSide, art.height / longSide)
  const isMotionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  let pointer = null
  let hover = 0
  let lightX = 0.2
  let lightY = -0.25
  let frame = 0
  let lastFrame = 0

  // where the pointer is on the card, from -1 to 1 on each axis, and how near it is. the
  // foil starts to show one card width from the card
  const aim = () => {
    const rect = canvas.getBoundingClientRect()
    const x = (pointer.x - rect.left - rect.width / 2) / (rect.width / 2)
    const y = (pointer.y - rect.top - rect.height / 2) / (rect.height / 2)
    const away = Math.hypot(
      (Math.max(0, Math.abs(x) - 1) * rect.width) / 2,
      (Math.max(0, Math.abs(y) - 1) * rect.height) / 2
    )
    const near = Math.max(0, 1 - away / rect.width)
    return { x, y, near: near * near * (3 - 2 * near) }
  }

  const draw = (time) => {
    const blend = isMotionReduced ? 1 : 1 - Math.exp((-10 * Math.min(time - lastFrame, 100)) / 1000)
    lastFrame = time
    const { x, y, near } = pointer ? aim() : { x: lightX, y: lightY, near: 0 }
    hover += (near - hover) * blend
    if (near > 0) {
      lightX += (x - lightX) * blend
      lightY += (y - lightY) * blend
    }

    const ratio = Math.min(devicePixelRatio, 2)
    const width = Math.round(canvas.clientWidth * ratio)
    const height = Math.round(canvas.clientHeight * ratio)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    gl.viewport(0, 0, width, height)
    gl.uniform2f(uPointer, lightX, lightY)
    gl.uniform1f(uHover, hover)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    const isStill =
      Math.abs(near - hover) < 0.002 && (!near || Math.abs(x - lightX) + Math.abs(y - lightY) < 0.004)
    frame = isStill ? 0 : requestAnimationFrame(draw)
  }

  const wake = () => {
    if (frame) return
    lastFrame = performance.now()
    frame = requestAnimationFrame(draw)
  }

  const follow = (event) => {
    if (!event.isPrimary) return
    pointer = { x: event.clientX, y: event.clientY }
    wake()
  }
  const leave = () => {
    pointer = null
    wake()
  }
  addEventListener('pointermove', follow, { passive: true })
  addEventListener('pointerdown', follow, { passive: true })
  // a finger has no hover, so the light goes out when it lifts
  addEventListener('pointerup', (event) => event.pointerType !== 'mouse' && leave())
  addEventListener('pointercancel', leave)
  document.documentElement.addEventListener('pointerleave', leave)
  addEventListener('resize', wake)
  // the card moves under a still pointer when the spring of slot.js moves it
  new MutationObserver(wake).observe(canvas.parentElement, { attributes: true, attributeFilter: ['style'] })
  wake()
}
