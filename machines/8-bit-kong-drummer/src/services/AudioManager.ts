
import { DrumType } from '../types';

class AudioManager {
  private ctx: AudioContext | null = null;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private createOscillator(freq: number, type: OscillatorType, duration: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private createNoise(duration: number, highPass: boolean = false) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    if (highPass) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(5000, this.ctx.currentTime);
      noise.connect(filter);
      filter.connect(gain);
    } else {
      noise.connect(gain);
    }

    gain.connect(this.ctx.destination);
    noise.start();
  }

  playSound(type: DrumType) {
    this.init();
    if (!this.ctx) return;

    switch (type) {
      case DrumType.KICK:
        this.playKick();
        break;
      case DrumType.SNARE:
        this.playSnare();
        break;
      case DrumType.HIHAT:
        this.playHiHat();
        break;
      case DrumType.CLAP:
        this.playClap();
        break;
      case DrumType.CRASH:
        this.playCrash();
        break;
    }
  }

  private playKick() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  private playSnare() {
    this.createNoise(0.1, false);
    this.createOscillator(200, 'triangle', 0.1);
  }

  private playHiHat() {
    this.createNoise(0.05, true);
  }

  private playClap() {
    // 8-bit claps are often multiple bursts of noise
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.createNoise(0.03, false), i * 15);
    }
  }

  private playCrash() {
    this.createNoise(1.5, true);
  }
}

export const audioManager = new AudioManager();
