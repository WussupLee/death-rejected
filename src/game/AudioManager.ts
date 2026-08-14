export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private drone: OscillatorNode | null = null;
  private lastBeat = 0;
  private combat = false;

  async unlock(): Promise<void> {
    this.ensureContext();
    if (this.context?.state === "suspended") await this.context.resume();
  }

  setCombat(active: boolean): void {
    this.combat = active;
    if (!this.context || !this.ambience) return;
    this.ambience.gain.setTargetAtTime(active ? 0.045 : 0.025, this.context.currentTime, 0.5);
  }

  update(): void {
    if (!this.context || this.context.state !== "running") return;
    const interval = this.combat ? 0.48 : 1.5;
    if (this.context.currentTime - this.lastBeat > interval) {
      this.lastBeat = this.context.currentTime;
      if (this.combat) this.thump(48, 0.08, 0.075);
    }
  }

  pistol(): void {
    this.noise(0.065, 0.42, 900);
    this.tone(120, 58, 0.095, 0.21, "sawtooth");
  }

  shotgun(): void {
    this.noise(0.15, 0.7, 620);
    this.tone(84, 39, 0.2, 0.3, "square");
    window.setTimeout(() => this.noise(0.06, 0.22, 320), 34);
  }

  knife(): void {
    this.noise(0.07, 0.24, 2200);
    this.tone(310, 150, 0.09, 0.08, "triangle");
  }

  hit(): void {
    this.tone(185, 110, 0.06, 0.08, "square");
  }

  kill(): void {
    this.tone(155, 52, 0.14, 0.14, "sawtooth");
  }

  hurt(): void {
    this.noise(0.1, 0.28, 500);
    this.tone(74, 38, 0.16, 0.2, "sawtooth");
  }

  reload(): void {
    this.tone(760, 420, 0.055, 0.05, "square");
    window.setTimeout(() => this.tone(520, 220, 0.07, 0.045, "square"), 150);
  }

  moon(): void {
    this.thump(42, 0.6, 0.32);
    this.tone(118, 44, 0.7, 0.12, "sawtooth");
  }

  reject(): void {
    this.noise(0.8, 0.42, 420);
    this.tone(72, 22, 1.4, 0.28, "sawtooth");
  }

  private ensureContext(): void {
    if (this.context) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.46;
    this.master.connect(this.context.destination);

    this.ambience = this.context.createGain();
    this.ambience.gain.value = 0.025;
    this.ambience.connect(this.master);
    this.drone = this.context.createOscillator();
    this.drone.type = "sawtooth";
    this.drone.frequency.value = 37;
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 110;
    this.drone.connect(filter).connect(this.ambience);
    this.drone.start();
  }

  private tone(start: number, end: number, duration: number, volume: number, type: OscillatorType): void {
    if (!this.context || !this.master) return;
    const time = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, time);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), time + duration);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
  }

  private thump(frequency: number, duration: number, volume: number): void {
    this.tone(frequency * 1.8, frequency, duration, volume, "sine");
  }

  private noise(duration: number, volume: number, cutoff: number): void {
    if (!this.context || !this.master) return;
    const length = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const gain = this.context.createGain();
    const time = this.context.currentTime;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
  }
}
