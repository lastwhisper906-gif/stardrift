export class AudioSystem {
  private ctx: AudioContext | null = null
  private engineOsc: OscillatorNode | null = null
  private engineGain: GainNode | null = null

  init(): void {
    try {
      this.ctx = new AudioContext()
      // Master engine hum (sawtooth filtered)
      const masterGain = this.ctx.createGain()
      masterGain.gain.value = 0.6
      masterGain.connect(this.ctx.destination)

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 200
      filter.connect(masterGain)

      this.engineOsc = this.ctx.createOscillator()
      this.engineOsc.type = 'sawtooth'
      this.engineOsc.frequency.value = 55

      this.engineGain = this.ctx.createGain()
      this.engineGain.gain.value = 0
      this.engineOsc.connect(this.engineGain)
      this.engineGain.connect(filter)
      this.engineOsc.start()

      // Idle ambient hum (very low)
      const idleOsc = this.ctx.createOscillator()
      idleOsc.type = 'sine'
      idleOsc.frequency.value = 40
      const idleGain = this.ctx.createGain()
      idleGain.gain.value = 0.012
      idleOsc.connect(idleGain)
      idleGain.connect(this.ctx.destination)
      idleOsc.start()
    } catch {
      // Audio not available (headless/test env)
      this.ctx = null
    }
  }

  setThrottle(throttle: number): void {
    if (!this.ctx || !this.engineGain || !this.engineOsc) return
    const t = this.ctx.currentTime
    const vol = Math.max(0, throttle) * 0.045
    this.engineGain.gain.setTargetAtTime(vol, t, 0.15)
    this.engineOsc.frequency.setTargetAtTime(55 + throttle * 30, t, 0.2)
  }

  playImpact(): void {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g   = this.ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(120, t)
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.3)
    g.gain.setValueAtTime(0.18, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    osc.connect(g)
    g.connect(this.ctx.destination)
    osc.start(t)
    osc.stop(t + 0.4)
  }

  playShot(): void {
    if (!this.ctx) return
    const t   = this.ctx.currentTime
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.12), this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const env = Math.pow(1 - i / data.length, 1.5)
      data[i] = (Math.random() * 2 - 1) * env * 0.35
    }
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const g = this.ctx.createGain()
    g.gain.value = 0.9
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 600
    src.connect(filter)
    filter.connect(g)
    g.connect(this.ctx.destination)
    src.start(t)
  }

  playDock(): void {
    if (!this.ctx) return
    // Pleasant ascending tone
    const t = this.ctx.currentTime
    for (const [delay, freq] of [[0, 440], [0.15, 554], [0.30, 660]] as [number, number][]) {
      const osc = this.ctx.createOscillator()
      const g   = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      g.gain.setValueAtTime(0, t + delay)
      g.gain.linearRampToValueAtTime(0.15, t + delay + 0.05)
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.4)
      osc.connect(g)
      g.connect(this.ctx.destination)
      osc.start(t + delay)
      osc.stop(t + delay + 0.5)
    }
  }

  playAlertBeep(): void {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g   = this.ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 880
    g.gain.setValueAtTime(0.07, t)
    g.gain.setValueAtTime(0, t + 0.12)
    osc.connect(g)
    g.connect(this.ctx.destination)
    osc.start(t)
    osc.stop(t + 0.15)
  }
}
