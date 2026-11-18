type Cue = 'start' | 'retry' | 'success' | 'expired';

const melodies: Record<Cue, readonly number[]> = {
  start: [523.25, 659.25],
  retry: [440, 369.99],
  success: [523.25, 659.25, 783.99],
  expired: [392, 329.63],
};

export class GardenAudio {
  enabled = false;
  volume = .35;
  private context?: AudioContext;
  private notes = new Set<OscillatorNode>();
  private generation = 0;

  wake() {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state !== 'running') void this.context.resume().catch(() => {});
    } catch {
      // Sound is optional. The quiz clock runs independently.
    }
  }

  play(cue: Cue) {
    const context = this.context;
    if (!this.enabled || !context) return;
    if (context.state === 'running') {
      this.schedule(context, cue);
      return;
    }
    const generation = this.generation;
    void context.resume().then(() => {
      if (this.enabled && generation === this.generation) this.schedule(context, cue);
    }).catch(() => {});
  }

  private schedule(context: AudioContext, cue: Cue) {
    const start = context.currentTime + .01;
    for (const [index, hz] of melodies[cue].entries()) {
      const at = start + index * .096;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = hz;
      envelope.gain.setValueAtTime(.0001, at);
      envelope.gain.exponentialRampToValueAtTime(Math.max(.0001, this.volume * .19), at + .025);
      envelope.gain.exponentialRampToValueAtTime(.0001, at + .15);
      oscillator.connect(envelope).connect(context.destination);
      this.notes.add(oscillator);
      oscillator.onended = () => {
        this.notes.delete(oscillator);
        oscillator.disconnect();
        envelope.disconnect();
      };
      oscillator.start(at);
      oscillator.stop(at + .16);
    }
  }

  stop() {
    this.generation++;
    for (const oscillator of this.notes) oscillator.stop();
    this.notes.clear();
  }

  dispose() {
    this.stop();
    void this.context?.close().catch(() => {});
  }
}
