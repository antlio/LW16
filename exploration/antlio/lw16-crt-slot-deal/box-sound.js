// the sounds of the box, made in the browser: a knock for a press, and the lid as it opens

let context
let noiseBuffer

// a browser starts audio only after a press or a key, so each sound starts it
const start = () => {
  context ??= new AudioContext()
  if (context.state === 'suspended') context.resume()
  if (noiseBuffer) return
  noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate)
  const samples = noiseBuffer.getChannelData(0)
  for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1
}

// the sound goes up to gain in attack seconds, then down to nothing. out is where it goes
const envelope = ({ at, gain, attack = 0.005, duration, out = context.destination }) => {
  const amp = context.createGain()
  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.exponentialRampToValueAtTime(gain, at + attack)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  amp.connect(out)
  return amp
}

const tone = ({ from, to = from, delay = 0, ...shape }) => {
  const at = context.currentTime + delay
  const oscillator = context.createOscillator()
  oscillator.frequency.setValueAtTime(from, at)
  oscillator.frequency.exponentialRampToValueAtTime(to, at + shape.duration)
  oscillator.connect(envelope({ at, ...shape }))
  oscillator.start(at)
  oscillator.stop(at + shape.duration + 0.02)
}

// noise through a filter. a low filter is a hit on paper board, and a band that goes up is
// paper that moves on paper
const noise = ({ type, from, to = from, delay = 0, ...shape }) => {
  const at = context.currentTime + delay
  const source = context.createBufferSource()
  source.buffer = noiseBuffer
  // each sound starts at its own place in the noise, so two short sounds are not the same.
  // the noise plays again from its start, so a sound that starts late in it is not cut
  source.loop = true
  const filter = context.createBiquadFilter()
  filter.type = type
  filter.frequency.setValueAtTime(from, at)
  filter.frequency.exponentialRampToValueAtTime(to, at + shape.duration)
  source.connect(filter).connect(envelope({ at, ...shape }))
  source.start(at, Math.random())
  source.stop(at + shape.duration + 0.02)
}

// a press on the box: the hit, then the lid comes down again after landSeconds
export const playKnock = (landSeconds) => {
  start()
  noise({ type: 'lowpass', from: 1400, to: 300, duration: 0.07, gain: 0.5 })
  tone({ from: 150, to: 70, duration: 0.11, gain: 0.35 })
  noise({ type: 'lowpass', from: 700, to: 250, duration: 0.06, gain: 0.2, delay: landSeconds })
  tone({ from: 110, to: 60, duration: 0.09, gain: 0.14, delay: landSeconds })
}

// the lid comes down on the box, with no person who does it: one soft hit
export const playClose = () => {
  start()
  noise({ type: 'lowpass', from: 900, to: 260, duration: 0.07, gain: 0.3 })
  tone({ from: 120, to: 62, duration: 0.1, gain: 0.22 })
}

// the lid comes off the box, its paper moves, and three soft notes come with the light
export const playOpen = () => {
  start()
  tone({ from: 120, to: 55, duration: 0.16, gain: 0.3 })
  noise({ type: 'bandpass', from: 500, to: 2600, duration: 0.95, gain: 0.12, attack: 0.3 })
  tone({ from: 587, duration: 1.6, gain: 0.05, attack: 0.02, delay: 0.35 })
  tone({ from: 880, duration: 1.4, gain: 0.035, attack: 0.02, delay: 0.43 })
  tone({ from: 1319, duration: 1.2, gain: 0.02, attack: 0.02, delay: 0.51 })
}

// the card gets to the end of the slot: it slides in, a catch takes it, and two soft notes
// come as the screen comes on
export const playCardIn = () => {
  start()
  noise({ type: 'bandpass', from: 3200, to: 1400, duration: 0.09, gain: 0.1 })
  noise({ type: 'highpass', from: 5000, duration: 0.02, gain: 0.12, delay: 0.07 })
  tone({ from: 190, to: 120, duration: 0.07, gain: 0.3, delay: 0.07 })
  tone({ from: 523, duration: 0.7, gain: 0.05, attack: 0.02, delay: 0.22 })
  tone({ from: 784, duration: 0.9, gain: 0.045, attack: 0.02, delay: 0.34 })
}

// the card comes out: the catch lets it go, and one soft note goes down
export const playCardOut = () => {
  start()
  noise({ type: 'highpass', from: 4000, duration: 0.02, gain: 0.1 })
  tone({ from: 392, to: 294, duration: 0.35, gain: 0.05, attack: 0.02, delay: 0.03 })
}

// the card is made from light. from now until the card is made, short crisp sounds
// come, as grains that fall on glass. wind comes while the light of the foil goes up the
// card (shineSeconds). a lower move of air comes while the card turns on its side
// (turnSeconds). all the seconds are from now. gap is the time between two grains, in parts
// of its first value. the result stops the sound
export const playCreate = ({ madeSeconds, shineSeconds, turnSeconds, volume, gap }) => {
  start()
  const out = context.createGain()
  out.gain.value = volume
  out.connect(context.destination)
  // with no press on the page, the browser keeps the sound off until a press. the sound is
  // then too late for the card, so it does not start
  const askedAt = performance.now()
  context.resume().then(() => {
    if (performance.now() - askedAt > 300) return
    // the card has too many cells for one sound each, so a grain is for a group of them. the
    // first particles are small and far, so the grains start when most of them can be seen
    for (let delay = madeSeconds * 0.12; delay < madeSeconds - 0.1; delay += (0.012 + Math.random() * 0.03) * gap) {
      const gain = 0.012 + Math.random() * 0.03
      noise({
        type: 'highpass',
        from: 5500 + Math.random() * 5000,
        duration: 0.012 + Math.random() * 0.012,
        gain,
        attack: 0.001,
        delay,
        out,
      })
      // some grains have a short high note, as glass has
      if (Math.random() < 0.3) {
        tone({
          from: 2600 + Math.random() * 3200,
          duration: 0.035,
          gain: gain * 0.35,
          attack: 0.001,
          delay,
          out,
        })
      }
    }
    const [shineFrom, shineTo] = shineSeconds
    noise({
      type: 'bandpass',
      from: 700,
      to: 2600,
      duration: shineTo - shineFrom,
      gain: 0.05,
      attack: (shineTo - shineFrom) * 0.45,
      delay: shineFrom,
      out,
    })
    // the card is slow at the end of its turn, so the air is only for the first part of it
    const [turnFrom, turnTo] = turnSeconds
    noise({
      type: 'bandpass',
      from: 1800,
      to: 450,
      duration: (turnTo - turnFrom) * 0.7,
      gain: 0.06,
      attack: (turnTo - turnFrom) * 0.25,
      delay: turnFrom,
      out,
    })
  })
  return () => out.disconnect()
}
