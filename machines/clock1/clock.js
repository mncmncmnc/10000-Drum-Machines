class DrumMachine {
    constructor() {
        this.clockInterval = null;
        this.highFreqInterval = null;
        this.clockCount = 0;
        this.subClockCount = 0;
        this.trackStates = {};
        this.trackCounters = {};
        this.lastTriggerTimes = {}; // Track last trigger time for each track
        this.lastClockCountForTrack = {}; // Track last clock count for each track
        this.isPlaying = false; // Start paused
        
        // Audio setup
        this.audioContext = null;
        this.sounds = {};
        this.soundMap = {
            'bass-drum': 'clocksounds/BT0A0A7.WAV',
            'closed-hihat': 'clocksounds/HHCD8.WAV',
            'open-hihat': 'clocksounds/HHOD0.WAV',
            'snare-drum': 'clocksounds/ST7TASA.WAV',
            'clap': 'clocksounds/HANDCLP1.WAV'
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updatePlayPauseButton();
        this.initAudio();
    }

    setupEventListeners() {
        // Listen for changes on operator and value selects
        document.querySelectorAll('.operator-select, .value-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const track = e.target.dataset.track;
                this.updateTrackState(track);
            });
        });
        
        // Listen for play/pause button clicks
        document.getElementById('playPauseBtn').addEventListener('click', () => {
            this.togglePlayPause();
        });
        
        // Listen for help button clicks
        document.getElementById('helpBtn').addEventListener('click', () => {
            this.openModal();
        });
        
        // Listen for modal close button clicks
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });
        
        // Close modal when clicking outside of it
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('helpModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    startClock() {
        if (this.isPlaying) {
            // 60 BPM = 1 second intervals for main clock
            this.clockInterval = setInterval(() => {
                this.clockCount++;
                this.pulseClock();
                this.checkTracks();
            }, 1000);
        }
    }
    
    stopClock() {
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
            this.clockInterval = null;
        }
    }
    
    togglePlayPause() {
        this.isPlaying = !this.isPlaying;
        this.updatePlayPauseButton();
        
        if (this.isPlaying) {
            this.startClock();
        } else {
            this.stopClock();
        }
    }
    
    updatePlayPauseButton() {
        const button = document.getElementById('playPauseBtn');
        button.textContent = this.isPlaying ? 'PAUSE' : 'PLAY';
    }
    
    openModal() {
        document.getElementById('helpModal').style.display = 'block';
    }
    
    closeModal() {
        document.getElementById('helpModal').style.display = 'none';
    }
    
    async initAudio() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Load all sound files
            for (const [track, soundPath] of Object.entries(this.soundMap)) {
                await this.loadSound(track, soundPath);
            }
            
            console.log('All sounds loaded successfully');
        } catch (error) {
            console.error('Error initializing audio:', error);
        }
    }
    
    async loadSound(track, soundPath) {
        try {
            const response = await fetch(soundPath);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.sounds[track] = audioBuffer;
        } catch (error) {
            console.error(`Error loading sound for ${track}:`, error);
        }
    }
    
    playSound(track) {
        if (!this.audioContext || !this.sounds[track]) {
            return;
        }
        
        try {
            // Resume audio context if suspended (required for user interaction)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            const source = this.audioContext.createBufferSource();
            source.buffer = this.sounds[track];
            source.connect(this.audioContext.destination);
            source.start();
        } catch (error) {
            console.error(`Error playing sound for ${track}:`, error);
        }
    }

    pulseClock() {
        const clockLight = document.getElementById('clockLight');
        clockLight.classList.add('active');
        
        setTimeout(() => {
            clockLight.classList.remove('active');
        }, 100);
    }

    updateTrackState(track) {
        const operatorSelect = document.querySelector(`.operator-select[data-track="${track}"]`);
        const valueSelect = document.querySelector(`.value-select[data-track="${track}"]`);
        
        const operator = operatorSelect.value;
        const value = parseInt(valueSelect.value);
        
        if (operator && value) {
            this.trackStates[track] = { operator, value };
            this.trackCounters[track] = 0;
        } else {
            delete this.trackStates[track];
            delete this.trackCounters[track];
        }
    }

    checkTracks() {
        Object.keys(this.trackStates).forEach(track => {
            const state = this.trackStates[track];
            
            if (state.operator === 'divide') {
                // Divide: trigger every nth master clock pulse
                // ÷2 triggers every 2nd clock pulse, ÷4 every 4th, etc.
                if ((this.clockCount % state.value) === 0) {
                    this.pulseTrack(track);
                }
            } else if (state.operator === 'multiply') {
                // Multiply: trigger multiple times per master clock pulse
                // ×2 triggers 2 times per clock pulse, ×4 triggers 4 times, etc.
                // We need to trigger multiple times within the same clock pulse
                for (let i = 0; i < state.value; i++) {
                    // Stagger the triggers within the clock pulse
                    setTimeout(() => {
                        this.pulseTrack(track);
                    }, i * (1000 / state.value));
                }
            }
        });
    }

    pulseTrack(track) {
        const trackLight = document.getElementById(`${track}-light`);
        if (trackLight) {
            trackLight.classList.add('active');
            
            setTimeout(() => {
                trackLight.classList.remove('active');
            }, 100);
        }
        
        // Play the sound for this track
        this.playSound(track);
    }
}

// Initialize the drum machine when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DrumMachine();
});
