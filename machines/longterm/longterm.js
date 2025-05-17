class DrumMachine {
    constructor() {
        this.isPlaying = false;
        this.startTime = null;
        this.tracks = {};
        this.sounds = {};
        
        // Constants
        this.COUNTDOWN_INTERVAL = 1000;
        this.FLASH_DURATION = 500;
        this.MAX_TRIGGERS = 100;
        
        this.durationInMs = {
            hour: 60 * 60 * 1000,
            day: 24 * 60 * 60 * 1000,
            week: 7 * 24 * 60 * 60 * 1000,
            month: 30 * 24 * 60 * 60 * 1000,
            year: 365 * 24 * 60 * 60 * 1000,
            decade: 10 * 365 * 24 * 60 * 60 * 1000,
            century: 100 * 365 * 24 * 60 * 60 * 1000,
            millennium: 1000 * 365 * 24 * 60 * 60 * 1000
        };

        this.soundOptions = [
            { value: 'bassdrumBD0075.WAV', label: 'bass drum' },
            { value: 'snareSD7550.WAV', label: 'snare' },
            { value: 'closedhatCH.WAV', label: 'closed hihat' },
            { value: 'openhatOH10.WAV', label: 'open hihat' },
            { value: 'cowbellCB.WAV', label: 'cowbell' },
            { value: 'highcongaHC50.WAV', label: 'high conga' },
            { value: 'midcongaMC50.WAV', label: 'mid conga' },
            { value: 'lowcongaLC50.WAV', label: 'low conga' }
        ];

        this.initializeTracks();
        this.setupEventListeners();
        this.preloadSounds();
        this.setupModal();
    }

    setupModal() {
        const modal = document.getElementById('infoModal');
        const infoBtn = document.getElementById('infoBtn');
        const infoBtnMobile = document.getElementById('infoBtn-mobile');
        const closeBtn = document.querySelector('.close');

        const openModal = () => {
            modal.style.display = 'block';
        };

        const closeModal = () => {
            modal.style.display = 'none';
        };

        infoBtn.addEventListener('click', openModal);
        infoBtnMobile.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);

        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });
    }

    preloadSounds() {
        this.soundOptions.forEach(sound => {
            if (sound.value) {
                try {
                    const audio = new Audio(`longterm-sounds/${sound.value}`);
                    audio.addEventListener('error', () => {
                        console.warn(`Failed to load sound: ${sound.value}`);
                    });
                    this.sounds[sound.value] = audio;
                } catch (error) {
                    console.warn(`Error creating audio for ${sound.value}:`, error);
                }
            }
        });
    }

    initializeTracks() {
        // Get all available sounds (excluding "none")
        const availableSounds = this.soundOptions.filter(opt => opt.value !== '');
        
        // Shuffle the sound options
        const shuffledSounds = [...availableSounds].sort(() => Math.random() - 0.5);
        let soundIndex = 0;

        document.querySelectorAll('.track').forEach(track => {
            const duration = track.dataset.duration;
            const triggerCount = track.querySelector('.trigger-count');
            const soundSelect = track.querySelector('.sound-select');
            
            // Populate sound options
            this.soundOptions.forEach(sound => {
                const option = document.createElement('option');
                option.value = sound.value;
                option.textContent = sound.label;
                soundSelect.appendChild(option);
            });
            
            // Populate trigger count options
            const option0 = document.createElement('option');
            option0.value = '0';
            option0.textContent = '0';
            triggerCount.appendChild(option0);
            
            for (let i = 1; i <= 100; i++) {
                const option = document.createElement('option');
                option.value = i.toString();
                option.textContent = i.toString();
                triggerCount.appendChild(option);
            }
            
            // Set random trigger count (1-100)
            const randomTriggers = Math.floor(Math.random() * 100) + 1;
            triggerCount.value = randomTriggers;
            
            // Set next available sound from shuffled array
            if (soundIndex < shuffledSounds.length) {
                soundSelect.value = shuffledSounds[soundIndex].value;
                soundIndex++;
            }
            
            this.tracks[duration] = {
                element: track,
                countdown: track.querySelector('.countdown'),
                triggerCount: triggerCount,
                soundSelect: soundSelect,
                nextTriggerTime: null
            };
        });
    }

    setupEventListeners() {
        const playPauseBtn = document.getElementById('playPauseBtn');
        playPauseBtn.addEventListener('click', () => this.togglePlayPause());

        // Update trigger times and titles when controls change
        Object.values(this.tracks).forEach(track => {
            track.triggerCount.addEventListener('change', () => {
                this.updateTriggerTimes();
                if (this.isPlaying) {
                    this.updateTrackTitle(track);
                }
            });
            track.soundSelect.addEventListener('change', () => {
                if (this.isPlaying) {
                    this.updateTrackTitle(track);
                }
            });
        });
    }

    updateTrackTitle(track) {
        const triggerCount = parseInt(track.triggerCount.value) || 0;
        const soundSelect = track.soundSelect;
        const soundName = soundSelect.options[soundSelect.selectedIndex].text;
        const durationName = track.element.dataset.duration.charAt(0).toUpperCase() + 
                           track.element.dataset.duration.slice(1);
        
        if (triggerCount > 0 && soundName !== 'none') {
            const article = durationName.toLowerCase().startsWith('hour') ? 'an' : 'a';
            // Capitalize each word and make instrument plural only if count > 1
            const formattedSound = soundName.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ') + (triggerCount === 1 ? '' : 's');
            
            track.element.querySelector('h2').textContent = 
                `${triggerCount} ${formattedSound} ${article} ${durationName}`;
        } else {
            // Reset to original duration name if no triggers or no sound
            track.element.querySelector('h2').textContent = durationName;
        }
    }

    togglePlayPause() {
        const playPauseBtn = document.getElementById('playPauseBtn');
        const playPauseBtnMobile = document.getElementById('playPauseBtn-mobile');
        this.isPlaying = !this.isPlaying;
        
        if (this.isPlaying) {
            this.startTime = Date.now();
            playPauseBtn.textContent = 'Pause';
            playPauseBtnMobile.textContent = 'Pause';
            
            // Update track titles
            Object.values(this.tracks).forEach(track => {
                this.updateTrackTitle(track);
            });
            
            this.updateTriggerTimes();
            this.startCountdown();
        } else {
            playPauseBtn.textContent = 'Play';
            playPauseBtnMobile.textContent = 'Play';
            
            // Reset track titles
            Object.entries(this.tracks).forEach(([duration, track]) => {
                track.element.querySelector('h2').textContent = 
                    duration.charAt(0).toUpperCase() + duration.slice(1);
            });
            
            this.stopCountdown();
        }
    }

    updateTriggerTimes() {
        if (!this.isPlaying) return;

        Object.entries(this.tracks).forEach(([duration, track]) => {
            const triggerCount = parseInt(track.triggerCount.value) || 0;
            const durationMs = this.durationInMs[duration];
            
            if (triggerCount > 0) {
                // Calculate the next trigger time based on evenly spaced intervals
                const interval = durationMs / (triggerCount + 1);
                const nextTriggerIndex = Math.floor((Date.now() - this.startTime) / interval);
                const nextTriggerTime = this.startTime + (nextTriggerIndex + 1) * interval;
                
                track.nextTriggerTime = nextTriggerTime;
            } else {
                track.nextTriggerTime = null;
            }
        });
    }

    startCountdown() {
        this.countdownInterval = setInterval(() => this.updateCountdowns(), this.COUNTDOWN_INTERVAL);
    }

    stopCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
    }

    formatCountdown(timeUntilNext, duration) {
        const seconds = Math.floor((timeUntilNext % (60 * 1000)) / 1000);
        const minutes = Math.floor((timeUntilNext % (60 * 60 * 1000)) / (60 * 1000));
        const hours = Math.floor((timeUntilNext % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const days = Math.floor((timeUntilNext % (30 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));
        const months = Math.floor((timeUntilNext % (365 * 24 * 60 * 60 * 1000)) / (30 * 24 * 60 * 60 * 1000));
        const years = Math.floor(timeUntilNext / (365 * 24 * 60 * 60 * 1000));

        const parts = [];
        
        switch(duration) {
            case 'hour':
                parts.push(`${minutes}m`);
                parts.push(`${seconds}s`);
                break;
            case 'day':
                parts.push(`${hours}h`);
                parts.push(`${minutes}m`);
                parts.push(`${seconds}s`);
                break;
            case 'week':
            case 'month':
                parts.push(`${days}d`);
                parts.push(`${hours}h`);
                parts.push(`${minutes}m`);
                parts.push(`${seconds}s`);
                break;
            case 'year':
                parts.push(`${months}mo`);
                parts.push(`${days}d`);
                parts.push(`${hours}h`);
                parts.push(`${minutes}m`);
                parts.push(`${seconds}s`);
                break;
            case 'decade':
            case 'century':
            case 'millennium':
                parts.push(`${years}y`);
                parts.push(`${months}mo`);
                parts.push(`${days}d`);
                parts.push(`${hours}h`);
                parts.push(`${minutes}m`);
                parts.push(`${seconds}s`);
                break;
        }

        return parts.join(' ') + ' until next hit';
    }

    playSound(soundFile) {
        if (soundFile && this.sounds[soundFile]) {
            // Clone the audio to allow overlapping sounds
            const sound = this.sounds[soundFile].cloneNode();
            sound.play();
        }
    }

    updateCountdowns() {
        const now = Date.now();

        Object.entries(this.tracks).forEach(([duration, track]) => {
            if (!track.nextTriggerTime) {
                track.countdown.textContent = '--:--:--';
                return;
            }

            const timeUntilNext = track.nextTriggerTime - now;
            
            if (timeUntilNext <= 0) {
                // Play the selected sound
                const soundFile = track.soundSelect.value;
                this.playSound(soundFile);
                
                // Add flash animation
                track.element.classList.add('flash');
                // Remove the class after animation completes
                setTimeout(() => {
                    track.element.classList.remove('flash');
                }, this.FLASH_DURATION);
                
                this.updateTriggerTimes();
                return;
            }

            track.countdown.textContent = this.formatCountdown(timeUntilNext, duration);
        });
    }
}

// Initialize the drum machine when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.drumMachine = new DrumMachine();
});