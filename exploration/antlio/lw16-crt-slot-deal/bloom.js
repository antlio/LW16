// the light of the bright parts of a scene goes over the parts near them. the scene is drawn
// with no limit on its light, the bright parts are made small and soft in steps, and the sum
// goes to the screen in display colors

import * as THREE from 'three'

const LEVELS = 6
const SETTINGS = { threshold: 1, strength: 0.5 }

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0., 1.);
  }
`

// half the size, with a soft start for the light over the threshold
const DOWN = /* glsl */ `
  uniform sampler2D uSource;
  uniform vec2 uTexel;
  uniform float uThreshold;
  varying vec2 vUv;
  void main() {
    vec3 color = texture2D(uSource, vUv).rgb * 4.;
    color += texture2D(uSource, vUv + uTexel * vec2(1., 1.)).rgb;
    color += texture2D(uSource, vUv + uTexel * vec2(-1., 1.)).rgb;
    color += texture2D(uSource, vUv + uTexel * vec2(1., -1.)).rgb;
    color += texture2D(uSource, vUv + uTexel * vec2(-1., -1.)).rgb;
    color /= 8.;
    float peak = max(color.r, max(color.g, color.b));
    gl_FragColor = vec4(color * smoothstep(uThreshold, uThreshold + .6, peak), 1.);
  }
`

// twice the size, added to the picture of that size
const UP = /* glsl */ `
  uniform sampler2D uSource;
  uniform sampler2D uBase;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    vec3 color = vec3(0.);
    color += texture2D(uSource, vUv + uTexel * vec2(2., 0.)).rgb;
    color += texture2D(uSource, vUv + uTexel * vec2(-2., 0.)).rgb;
    color += texture2D(uSource, vUv + uTexel * vec2(0., 2.)).rgb;
    color += texture2D(uSource, vUv + uTexel * vec2(0., -2.)).rgb;
    color += texture2D(uSource, vUv + uTexel * vec2(1., 1.)).rgb * 2.;
    color += texture2D(uSource, vUv + uTexel * vec2(-1., 1.)).rgb * 2.;
    color += texture2D(uSource, vUv + uTexel * vec2(1., -1.)).rgb * 2.;
    color += texture2D(uSource, vUv + uTexel * vec2(-1., -1.)).rgb * 2.;
    gl_FragColor = vec4(color / 12. + texture2D(uBase, vUv).rgb, 1.);
  }
`

const SCREEN = /* glsl */ `
  uniform sampler2D uSource;
  uniform sampler2D uBloom;
  uniform float uStrength;
  uniform float uAspect;
  uniform vec3 uHaze;
  varying vec2 vUv;
  void main() {
    vec3 color = texture2D(uSource, vUv).rgb + texture2D(uBloom, vUv).rgb * uStrength;
    // a haze of a little light behind the things, and dark corners
    vec2 fromMiddle = (vUv - vec2(.5, .36)) * vec2(uAspect, 1.);
    color += uHaze * exp(-dot(fromMiddle, fromMiddle) * 5.);
    // the filmic curve of Narkowicz for ACES
    color = clamp(color * (2.51 * color + .03) / (color * (2.43 * color + .59) + .14), 0., 1.);
    color = pow(color, vec3(1. / 2.2));
    // a little noise, so the dark steps of the haze do not show as bands
    color += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5) / 255.;
    gl_FragColor = vec4(color, 1.);
  }
`

// haze is the color of the light behind the things
export const createBloom = (renderer, { haze }) => {
  const target = () =>
    new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false })
  const sharp = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
  const down = Array.from({ length: LEVELS }, target)
  const up = Array.from({ length: LEVELS - 1 }, target)
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const pass = (fragmentShader, uniforms) =>
    new THREE.ShaderMaterial({
      uniforms: { uSource: { value: null }, uTexel: { value: new THREE.Vector2() }, ...uniforms },
      vertexShader: VERTEX,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
    })
  const passes = {
    down: pass(DOWN, { uThreshold: { value: 0 } }),
    up: pass(UP, { uBase: { value: null } }),
    screen: pass(SCREEN, {
      uBloom: { value: null },
      uStrength: { value: SETTINGS.strength },
      uHaze: { value: new THREE.Vector3(...haze) },
      uAspect: { value: 1 },
    }),
  }

  const run = ({ material, source, into }) => {
    material.uniforms.uSource.value = source.texture
    material.uniforms.uTexel.value.set(1 / source.width, 1 / source.height)
    quad.material = material
    renderer.setRenderTarget(into)
    renderer.render(quad, quadCamera)
  }

  return {
    resize: () => {
      const size = renderer.getDrawingBufferSize(new THREE.Vector2())
      sharp.setSize(size.x, size.y)
      for (const [level, targetOfLevel] of down.entries()) {
        const [width, height] = [
          Math.max(size.x >> (level + 1), 1),
          Math.max(size.y >> (level + 1), 1),
        ]
        targetOfLevel.setSize(width, height)
        up[level]?.setSize(width, height)
      }
      passes.screen.uniforms.uAspect.value = size.x / size.y
    },
    render: (scene, camera) => {
      renderer.setRenderTarget(sharp)
      renderer.render(scene, camera)
      for (const [level, into] of down.entries()) {
        // only the first step takes the dark parts out
        passes.down.uniforms.uThreshold.value = level ? -1 : SETTINGS.threshold
        run({ material: passes.down, source: level ? down[level - 1] : sharp, into })
      }
      for (let level = LEVELS - 2; level >= 0; level--) {
        passes.up.uniforms.uBase.value = down[level].texture
        run({ material: passes.up, source: up[level + 1] ?? down[level + 1], into: up[level] })
      }
      passes.screen.uniforms.uBloom.value = up[0].texture
      run({ material: passes.screen, source: sharp, into: null })
    },
  }
}
