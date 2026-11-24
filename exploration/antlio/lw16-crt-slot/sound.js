let context

// a browser starts audio only after a press or a key
export const unlock = () => {
  context ??= new AudioContext()
  if (context.state === 'suspended') context.resume()
}

const tone = ({ type = 'sine', from, to = from, duration, gain, delay = 0 }) => {
  if (context?.state !== 'running') return
  const at = context.currentTime + delay
  const oscillator = context.createOscillator()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(from, at)
  oscillator.frequency.exponentialRampToValueAtTime(to, at + duration)
  const amp = context.createGain()
  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.006)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  oscillator.connect(amp).connect(context.destination)
  oscillator.start(at)
  oscillator.stop(at + duration + 0.02)
}

// the edge of the card on the mouth of the slot
export const tick = () => tone({ type: 'square', from: 1800, to: 900, duration: 0.02, gain: 0.06 })

// the card hits the end of the slot, then the tube gets its charge
export const powerOn = () => {
  tone({ from: 90, to: 45, duration: 0.22, gain: 0.5 })
  tone({ type: 'sawtooth', from: 110, to: 116, duration: 0.9, gain: 0.03, delay: 0.03 })
  tone({ from: 7000, to: 12000, duration: 0.5, gain: 0.012, delay: 0.03 })
}

export const powerOff = () => tone({ from: 500, to: 50, duration: 0.2, gain: 0.2 })
