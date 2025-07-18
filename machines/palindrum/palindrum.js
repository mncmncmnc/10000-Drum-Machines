class Palindrum {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
        this.isReverse = false;
        this.currentStep = 0;
        this.tempo = 120;
        this.sequence = {
            bass: new Array(16).fill(false),
            kick: new Array(16).fill(false),
            snare: new Array(16).fill(false),
            hihat: new Array(16).fill(false),
            clap: new Array(16).fill(false),
            shake: new Array(16).fill(false)
        };
        this.interval = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupAudioContext();
        this.createDefaultPattern();
    }
    
    setupEventListeners() {
        // Play buttons (left side)
        document.getElementById('playBtn').addEventListener('click', () => this.togglePlay(false));
        
        // Play buttons (right side - reverse)
        const rightPlayBtn = document.querySelector('.right-side .btn-primary');
        
        rightPlayBtn.addEventListener('click', () => this.togglePlay(true));
        
        // Tempo control (left side)
        const tempoSlider = document.getElementById('tempo');
        const tempoValue = document.getElementById('tempoValue');
        
        // Tempo control (right side)
        const rightTempoSlider = document.querySelector('.right-side input[type="range"]');
        const rightTempoValue = document.querySelector('.right-side .tempo-control span');
        
        tempoSlider.addEventListener('input', (e) => {
            this.tempo = parseInt(e.target.value);
            tempoValue.textContent = this.tempo;
            // Update right side tempo
            rightTempoSlider.value = this.tempo;
            rightTempoValue.textContent = this.tempo;
            if (this.isPlaying) {
                this.stop();
                this.play(this.isReverse);
            }
        });
        
        rightTempoSlider.addEventListener('input', (e) => {
            this.tempo = parseInt(e.target.value);
            rightTempoValue.textContent = this.tempo;
            // Update left side tempo
            tempoSlider.value = this.tempo;
            tempoValue.textContent = this.tempo;
            if (this.isPlaying) {
                this.stop();
                this.play(this.isReverse);
            }
        });
        
        // Step buttons
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', (e) => {
                const track = e.target.closest('.track').dataset.track;
                const stepIndex = parseInt(e.target.dataset.step);
                this.toggleStep(track, stepIndex);
            });
        });
    }
    
    setupAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error('Web Audio API not supported');
        }
    }
    
    createDefaultPattern() {
        // Create a basic drum pattern
        this.sequence.bass[0] = true;
        this.sequence.bass[4] = true;
        this.sequence.bass[8] = true;
        this.sequence.bass[12] = true;
        
        this.sequence.snare[2] = true;
        this.sequence.snare[6] = true;
        this.sequence.snare[10] = true;
        this.sequence.snare[14] = true;
        
        this.sequence.hihat[0] = true;
        this.sequence.hihat[2] = true;
        this.sequence.hihat[4] = true;
        this.sequence.hihat[6] = true;
        this.sequence.hihat[8] = true;
        this.sequence.hihat[10] = true;
        this.sequence.hihat[12] = true;
        this.sequence.hihat[14] = true;
        
        // Apply palindrome to steps 8-15 (reverse of steps 0-7)
        this.applyPalindrome();
        this.updateVisuals();
    }
    
    applyPalindrome() {
        // Steps 8-15 are the reverse of steps 0-7
        for (let track in this.sequence) {
            for (let i = 0; i < 8; i++) {
                this.sequence[track][i + 8] = this.sequence[track][7 - i];
            }
        }
    }
    
    toggleStep(track, stepIndex) {
        this.sequence[track][stepIndex] = !this.sequence[track][stepIndex];
        
        // If we're modifying steps 0-7, update the palindrome (steps 8-15)
        if (stepIndex < 8) {
            this.sequence[track][15 - stepIndex] = this.sequence[track][stepIndex];
        } else {
            // If we're modifying steps 8-15, update the corresponding step in 0-7
            this.sequence[track][15 - stepIndex] = this.sequence[track][stepIndex];
        }
        
        this.updateVisuals();
    }
    
    updateVisuals() {
        // Update step visual states
        document.querySelectorAll('.step').forEach(step => {
            const track = step.closest('.track').dataset.track;
            const stepIndex = parseInt(step.dataset.step);
            
            if (this.sequence[track][stepIndex]) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
    }
    
    togglePlay(reverse = false) {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.play(reverse);
        }
    }
    
    play(reverse = false) {
        if (!this.audioContext) {
            this.setupAudioContext();
        }
        
        this.isPlaying = true;
        this.isReverse = reverse;
        
        // Update button text
        const leftPlayBtn = document.getElementById('playBtn');
        const rightPlayBtn = document.querySelector('.right-side .btn-primary');
        
        // Both buttons show pause when playing
        leftPlayBtn.textContent = 'Pause';
        rightPlayBtn.textContent = 'Pause';
        
        document.querySelector('.sequencer').classList.add('playing');
        
        const stepTime = (60 / this.tempo) * 0.25; // 16th note timing
        
        this.interval = setInterval(() => {
            this.playStep(this.currentStep);
            this.highlightStep(this.currentStep);
            
            if (reverse) {
                this.currentStep = this.currentStep === 0 ? 15 : this.currentStep - 1;
            } else {
                this.currentStep = (this.currentStep + 1) % 16;
            }
        }, stepTime * 1000);
    }
    
    stop() {
        this.isPlaying = false;
        this.currentStep = 0;
        
        // Reset button text
        const leftPlayBtn = document.getElementById('playBtn');
        const rightPlayBtn = document.querySelector('.right-side .btn-primary');
        leftPlayBtn.textContent = 'Play';
        rightPlayBtn.textContent = 'Play';
        
        document.querySelector('.sequencer').classList.remove('playing');
        
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        // Clear all step highlights
        document.querySelectorAll('.step-indicator').forEach(indicator => {
            indicator.classList.remove('active');
        });
        
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('current-column');
        });
    }
    
    highlightStep(stepIndex) {
        // Remove previous highlights
        document.querySelectorAll('.step-indicator').forEach(indicator => {
            indicator.classList.remove('active', 'current-column');
        });
        
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('current-column');
        });
        
        // Add highlight to current step indicator
        const indicators = document.querySelectorAll('.step-indicator');
        if (indicators[stepIndex]) {
            indicators[stepIndex].classList.add('active', 'current-column');
        }
        
        // Add column highlighting to all steps in the current column
        const steps = document.querySelectorAll(`.step[data-step="${stepIndex}"]`);
        steps.forEach(step => {
            step.classList.add('current-column');
        });
    }
    
    playStep(stepIndex) {
        for (let track in this.sequence) {
            if (this.sequence[track][stepIndex]) {
                this.playSound(track);
            }
        }
    }
    
    playSound(track) {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        const now = this.audioContext.currentTime;
        
        switch (track) {
            case 'bass':
                oscillator.frequency.setValueAtTime(60, now);
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.3, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                oscillator.start(now);
                oscillator.stop(now + 0.1);
                break;
                
            case 'kick':
                oscillator.frequency.setValueAtTime(150, now);
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.4, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                oscillator.start(now);
                oscillator.stop(now + 0.15);
                break;
                
            case 'snare':
                // White noise for snare
                const bufferSize = this.audioContext.sampleRate * 0.1;
                const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
                const output = buffer.getChannelData(0);
                
                for (let i = 0; i < bufferSize; i++) {
                    output[i] = Math.random() * 2 - 1;
                }
                
                const whiteNoise = this.audioContext.createBufferSource();
                whiteNoise.buffer = buffer;
                whiteNoise.connect(gainNode);
                
                gainNode.gain.setValueAtTime(0.2, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                whiteNoise.start(now);
                whiteNoise.stop(now + 0.1);
                break;
                
            case 'hihat':
                oscillator.frequency.setValueAtTime(800, now);
                oscillator.type = 'square';
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                oscillator.start(now);
                oscillator.stop(now + 0.05);
                break;
                
            case 'clap':
                // Clap sound using multiple oscillators
                for (let i = 0; i < 3; i++) {
                    const clapOsc = this.audioContext.createOscillator();
                    const clapGain = this.audioContext.createGain();
                    
                    clapOsc.connect(clapGain);
                    clapGain.connect(this.audioContext.destination);
                    
                    clapOsc.frequency.setValueAtTime(200 + i * 100, now);
                    clapOsc.type = 'sine';
                    clapGain.gain.setValueAtTime(0.1, now);
                    clapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                    
                    clapOsc.start(now);
                    clapOsc.stop(now + 0.1);
                }
                break;
                
            case 'shake':
                // Shake sound using noise
                const shakeBufferSize = this.audioContext.sampleRate * 0.2;
                const shakeBuffer = this.audioContext.createBuffer(1, shakeBufferSize, this.audioContext.sampleRate);
                const shakeOutput = shakeBuffer.getChannelData(0);
                
                for (let i = 0; i < shakeBufferSize; i++) {
                    shakeOutput[i] = Math.random() * 2 - 1;
                }
                
                const shakeNoise = this.audioContext.createBufferSource();
                shakeNoise.buffer = shakeBuffer;
                shakeNoise.connect(gainNode);
                
                gainNode.gain.setValueAtTime(0.15, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                shakeNoise.start(now);
                shakeNoise.stop(now + 0.2);
                break;
        }
    }
}

// Initialize the drum machine when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new Palindrum();
}); 