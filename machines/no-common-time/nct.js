class DrumMachine {
    constructor() {
        this.currentTimeSignature = this.getRandomTimeSignature();
        this.bpm = 120;
        this.isPlaying = false;
        this.currentStep = 0;
        this.currentSound = 'drum1';
        this.isPainting = false;  // Add painting state
        this.paintValue = false;  // Track whether we're painting on or off
        this.sequences = {
            drum1: new Set(),
            drum2: new Set(),
            drum3: new Set(),
            drum4: new Set()
        };
        
        this.initializeSynths();
        this.initializeElements();
        this.initializeEventListeners();
        this.updateGrid();
    }

    getRandomTimeSignature() {
        const timeSignatures = [
            '3/2', '5/2', '5/4', '7/2', '7/4', '5/8', '7/8',
            '11/8', '13/8', '15/8', '17/16', '19/8', '23/16', '25/16'
        ];
        return timeSignatures[Math.floor(Math.random() * timeSignatures.length)];
    }

    initializeSynths() {
        // Create a master volume control
        this.masterVolume = new Tone.Volume(-6).toDestination();
        
        // Add a compressor for the bass drum
        this.bassDrumCompressor = new Tone.Compressor({
            threshold: -24,
            ratio: 12,
            attack: 0.003,
            release: 0.25
        }).connect(this.masterVolume);
        
        // Bass Drum - Using MembraneSynth with modulation
        this.bassDrum = new Tone.MembraneSynth({
            pitchDecay: 0.08,
            octaves: 3,
            oscillator: {
                type: "sine4"
            },
            envelope: {
                attack: 0.005,    // Slightly longer attack to prevent clipping
                decay: 0.3,       // Slightly shorter decay
                sustain: 0.01,
                release: 1.2,     // Slightly shorter release
                attackCurve: "linear"  // Changed to linear for more consistent attack
            }
        }).connect(this.bassDrumCompressor);  // Connect to compressor instead of master

        // Add a subtle distortion to the bass drum
        this.bassDrumDistortion = new Tone.Distortion({
            distortion: 0.15,     // Reduced distortion slightly
            oversample: "4x"
        }).connect(this.bassDrumCompressor);  // Connect to compressor
        this.bassDrum.connect(this.bassDrumDistortion);

        // Snare - Using NoiseSynth with filtering
        this.snare = new Tone.NoiseSynth({
            noise: {
                type: "white"
            },
            envelope: {
                attack: 0.005,
                decay: 0.1,
                sustain: 0
            }
        }).connect(this.masterVolume);
        
        // Add a filter to the snare for more character
        this.snareFilter = new Tone.Filter({
            frequency: 1000,
            type: "bandpass",
            Q: 1
        }).connect(this.masterVolume);
        this.snare.connect(this.snareFilter);

        // Hi-hat - Using MetalSynth with high frequency
        this.hihat = new Tone.MetalSynth({
            frequency: 4000,
            envelope: {
                attack: 0.001,
                decay: 0.1,
                release: 0.01
            },
            harmonicity: 5.1,
            modulationIndex: 32,
            resonance: 4000,
            octaves: 1.5
        }).connect(this.masterVolume);

        // Shaker - Using filtered noise with short envelope and pitch modulation
        this.shaker = new Tone.FMSynth({
            harmonicity: 3.01,
            modulationIndex: 10,
            oscillator: {
                type: "sine"
            },
            envelope: {
                attack: 0.01,
                decay: 0.2,
                sustain: 0.1,
                release: 0.5
            },
            modulation: {
                type: "square"
            },
            modulationEnvelope: {
                attack: 0.5,
                decay: 0.1,
                sustain: 0.2,
                release: 0.1
            }
        }).connect(this.masterVolume);
        
        // Add a complex filter chain for the bell sound
        this.shakerFilter = new Tone.Filter({
            frequency: 2000,
            type: "bandpass",
            Q: 4
        }).connect(this.masterVolume);

        // Add reverb for space
        this.shakerReverb = new Tone.Reverb({
            decay: 1.5,
            preDelay: 0.1,
            wet: 0.3
        }).connect(this.shakerFilter);

        // Add a pitch shift for extra character
        this.shakerPitch = new Tone.PitchShift({
            pitch: 7,          // Shift up a perfect fifth
            windowSize: 0.1,
            delayTime: 0.01
        }).connect(this.shakerReverb);

        // Connect the chain: shaker -> pitch shift -> reverb -> filter -> master
        this.shaker.connect(this.shakerPitch);
    }

    initializeElements() {
        // Controls
        this.timeSignatureSelect = document.getElementById('timeSignature');
        this.timeSignatureSelect.value = this.currentTimeSignature;
        this.bpmInput = document.getElementById('bpm');
        this.bpmValue = document.getElementById('bpmValue');
        this.playPauseButton = document.getElementById('playPauseButton');
        this.randomizeButton = document.getElementById('randomizeButton');
        this.sequencerGrid = document.getElementById('sequencerGrid');
        
        // Sound tabs
        this.tabButtons = document.querySelectorAll('.tab-button');
    }

    initializeEventListeners() {
        // Time signature change
        this.timeSignatureSelect.addEventListener('change', async (e) => {
            const wasPlaying = this.isPlaying;
            if (wasPlaying) {
                this.stop();
            }
            
            const oldTimeSignature = this.currentTimeSignature;
            const newTimeSignature = e.target.value;
            
            // Get the number of steps for both old and new time signatures
            const oldSteps = this.getStepsForTimeSignature(oldTimeSignature);
            const newSteps = this.getStepsForTimeSignature(newTimeSignature);
            
            // Create new sequences that preserve as many steps as possible
            const newSequences = {
                drum1: new Set(),
                drum2: new Set(),
                drum3: new Set(),
                drum4: new Set()
            };
            
            // For each drum sound, map the old steps to new steps
            Object.keys(this.sequences).forEach(sound => {
                this.sequences[sound].forEach(step => {
                    // Map the old step position to the new grid
                    // This preserves the relative position of steps
                    const mappedStep = Math.floor((step / oldSteps) * newSteps);
                    if (mappedStep < newSteps) {
                        newSequences[sound].add(mappedStep);
                    }
                });
            });
            
            // Update the sequences and time signature
            this.sequences = newSequences;
            this.currentTimeSignature = newTimeSignature;
            
            this.updateGrid();
            
            if (wasPlaying) {
                await this.start();
            }
        });

        // BPM control
        this.bpmInput.addEventListener('input', (e) => {
            this.bpm = parseInt(e.target.value);
            this.bpmValue.textContent = this.bpm;
            if (this.isPlaying) {
                Tone.Transport.bpm.value = this.bpm;
            }
        });

        // Play/Pause control
        this.playPauseButton.addEventListener('click', () => {
            if (this.isPlaying) {
                this.pause();
            } else {
                this.start();
            }
        });

        // Sound tabs
        this.tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                this.currentSound = button.dataset.sound;
                this.updateGrid();
            });
        });

        // Randomize button
        this.randomizeButton.addEventListener('click', () => {
            this.randomizeAllSequences();
        });
    }

    getStepsForTimeSignature(timeSignature) {
        const [beats, unit] = timeSignature.split('/');
        const beatsNum = parseInt(beats);
        const unitNum = parseInt(unit);
        
        // Convert all time signatures to 16th notes
        // For example:
        // 4/4 = 4 beats * 4 (16th notes per beat) = 16 steps
        // 5/4 = 5 beats * 4 = 20 steps
        // 7/8 = 7 beats * 2 (16th notes per beat) = 14 steps
        // 17/16 = 17 beats * 1 (16th note per beat) = 17 steps
        
        const sixteenthNotesPerBeat = 16 / unitNum;
        return beatsNum * sixteenthNotesPerBeat;
    }

    updateGrid() {
        const steps = this.getStepsForTimeSignature(this.currentTimeSignature);
        this.sequencerGrid.style.gridTemplateColumns = `repeat(${steps}, 1fr)`;
        this.sequencerGrid.innerHTML = '';

        // Create grid steps
        for (let i = 0; i < steps; i++) {
            const step = document.createElement('div');
            step.className = 'grid-step';
            step.dataset.step = i;
            
            // Set active state based on current sequence
            if (this.sequences[this.currentSound].has(i)) {
                step.classList.add('active');
            }

            // Add mouse event listeners for painting
            step.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent text selection while dragging
                this.isPainting = true;
                this.paintValue = !this.sequences[this.currentSound].has(i);
                this.toggleStep(i);
            });

            step.addEventListener('mouseover', () => {
                if (this.isPainting) {
                    if (this.sequences[this.currentSound].has(i) !== this.paintValue) {
                        this.toggleStep(i);
                    }
                }
            });

            this.sequencerGrid.appendChild(step);
        }

        // Add mouseup listener to the document to stop painting when mouse is released
        document.addEventListener('mouseup', () => {
            this.isPainting = false;
        });
    }

    toggleStep(stepIndex) {
        if (this.sequences[this.currentSound].has(stepIndex)) {
            this.sequences[this.currentSound].delete(stepIndex);
        } else {
            this.sequences[this.currentSound].add(stepIndex);
        }
        this.updateGrid();
    }

    async start() {
        if (this.isPlaying) return;

        await Tone.start();
        Tone.Transport.bpm.value = this.bpm;
        
        const steps = this.getStepsForTimeSignature(this.currentTimeSignature);
        this.currentStep = 0;

        // Create a single loop for all drums
        Tone.Transport.scheduleRepeat((time) => {
            // Update visual feedback
            this.updateStepHighlight(this.currentStep);
            
            // Trigger sounds based on sequence
            if (this.sequences.drum1.has(this.currentStep)) {
                this.bassDrum.triggerAttackRelease("C1", "16n", time);
            }
            if (this.sequences.drum2.has(this.currentStep)) {
                this.snare.triggerAttackRelease("16n", time);
            }
            if (this.sequences.drum3.has(this.currentStep)) {
                this.hihat.triggerAttackRelease("C6", "16n", time);
            }
            if (this.sequences.drum4.has(this.currentStep)) {
                this.shaker.triggerAttackRelease("C5", "16n", time);
            }

            // Move to next step
            this.currentStep = (this.currentStep + 1) % steps;
        }, '16n');

        Tone.Transport.start();
        this.isPlaying = true;
        this.playPauseButton.textContent = 'Pause';
    }

    pause() {
        if (!this.isPlaying) return;

        Tone.Transport.pause();
        this.isPlaying = false;
        this.playPauseButton.textContent = 'Play';
    }

    stop() {
        if (!this.isPlaying) return;

        Tone.Transport.stop();
        Tone.Transport.cancel();
        this.isPlaying = false;
        this.currentStep = 0;
        this.playPauseButton.textContent = 'Play';
        
        // Clear all step highlights
        document.querySelectorAll('.grid-step').forEach(step => {
            step.classList.remove('current');
        });
    }

    updateStepHighlight(currentStep) {
        // Remove highlight from all steps
        document.querySelectorAll('.grid-step').forEach(step => {
            step.classList.remove('current');
        });

        // Add highlight to current step
        const steps = document.querySelectorAll('.grid-step');
        if (steps[currentStep]) {
            steps[currentStep].classList.add('current');
        }
    }

    randomizeAllSequences() {
        const steps = this.getStepsForTimeSignature(this.currentTimeSignature);
        
        // Clear all existing sequences
        Object.keys(this.sequences).forEach(sound => {
            this.sequences[sound] = new Set();
        });

        // Generate random patterns for each sound
        // Using different probabilities for each sound to create more musical patterns
        const probabilities = {
            drum1: 0.3,  // Bass drum - less frequent
            drum2: 0.25, // Snare - less frequent
            drum3: 0.4,  // Hi-hat - more frequent
            drum4: 0.2   // Shaker - least frequent
        };

        Object.keys(this.sequences).forEach(sound => {
            for (let i = 0; i < steps; i++) {
                if (Math.random() < probabilities[sound]) {
                    this.sequences[sound].add(i);
                }
            }
        });

        // Update the grid to show the new patterns
        this.updateGrid();
    }
}

// Initialize the drum machine when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const drumMachine = new DrumMachine();
});
