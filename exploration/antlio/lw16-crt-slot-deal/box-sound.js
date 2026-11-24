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

// the sound goes up to gain in attack seconds, then down to nothing
const envelope = ({ at, gain, attack = 0.005, duration }) => {
  const amp = context.createGain()
  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.exponentialRampToValueAtTime(gain, at + attack)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  amp.connect(context.destination)
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

// the card is made from light. while its cells get there (cellSeconds), short crisp sounds
// come, as grains that fall on glass. a note comes when the card is made. a soft hit and
// two notes come when it is still on its side. all the seconds are from now
export const playCreate = ({ cellSeconds: [firstCell, lastCell], madeSeconds, stillSeconds }) => {
  start()
  // the card has too many cells for one sound each, so a grain is for a group of them
  for (let delay = firstCell; delay < lastCell; delay += 0.012 + Math.random() * 0.03) {
    const gain = 0.012 + Math.random() * 0.03
    noise({
      type: 'highpass',
      from: 5500 + Math.random() * 5000,
      duration: 0.012 + Math.random() * 0.012,
      gain,
      attack: 0.001,
      delay,
    })
    // some grains have a short high note, as glass has
    if (Math.random() < 0.3) {
      tone({ from: 2600 + Math.random() * 3200, duration: 0.035, gain: gain * 0.35, attack: 0.001, delay })
    }
  }
  tone({ from: 659, duration: 0.9, gain: 0.05, attack: 0.02, delay: madeSeconds - 0.1 })
  // the card is slow at the end of its turn, so the hit is a little before the end
  tone({ from: 150, to: 75, duration: 0.14, gain: 0.2, delay: stillSeconds - 0.08 })
  tone({ from: 988, duration: 1.3, gain: 0.045, attack: 0.02, delay: stillSeconds - 0.08 })
  tone({ from: 1319, duration: 1.5, gain: 0.025, attack: 0.02, delay: stillSeconds + 0.02 })
}
