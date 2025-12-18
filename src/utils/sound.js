class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Default volume
        this.masterGain.connect(this.ctx.destination);
    }

    playTone(freq, type, duration, startTime = 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

        gain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
    }

    playClick() {
        // Subtle high pitch click
        this.playTone(800, 'sine', 0.05);
    }

    playHover() {
        // Very subtle low pop
        this.playTone(400, 'sine', 0.03);
    }

    playSuccess() {
        // Happy major chord arpeggio
        this.playTone(523.25, 'sine', 0.2, 0);    // C5
        this.playTone(659.25, 'sine', 0.2, 0.1);  // E5
        this.playTone(783.99, 'sine', 0.4, 0.2);  // G5
    }

    playError() {
        // Low dissonant buzz
        this.playTone(150, 'sawtooth', 0.3);
        this.playTone(140, 'sawtooth', 0.3);
    }

    playComplete() {
        // Victory fanfare
        const now = this.ctx.currentTime;
        [523.25, 523.25, 523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            this.playTone(freq, 'square', 0.2, i * 0.15);
        });
    }
}

export const soundManager = new SoundManager();
