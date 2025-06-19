class DrumMachine {
    constructor() {
        this.tracks = ['kick', 'snare', 'hihat', 'clap'];
        this.steps = 16;
        this.currentStep = 0;
        this.isPlaying = false;
        this.tempo = 120;
        this.interval = null;
        this.stepData = {};
        this.selectedSounds = {
            kick: 'bassdrumBD0075',
            snare: 'snareSD7550',
            hihat: 'closedhatCH',
            clap: 'CP'
        };
        
        // Effects
        this.effects = {
            autopan: {
                active: false,
                probability: 50
            },
            distortion: {
                active: false,
                probability: 50
            },
            stutter: {
                active: false,
                probability: 50
            },
            ratchet: {
                active: false,
                probability: 50
            }
        };
        
        // Audio context and sounds
        this.audioContext = null;
        this.sounds = {};
        this.availableSounds = [
            'bassdrumBD0075',
            'snareSD7550', 
            'closedhatCH',
            'openhatOH10',
            'cowbellCB',
            'highcongaHC50',
            'midcongaMC50',
            'lowcongaLC50',
            'CP'
        ];
        
        this.init();
    }
    
    init() {
        this.generateSteps();
        this.setupEventListeners();
        this.initializeStepData();
        this.initAudio();
        this.populateSoundDropdowns();
    }
    
    async initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await this.loadSounds();
        } catch (error) {
            console.error('Failed to initialize audio:', error);
        }
    }
    
    async loadSounds() {
        for (const soundName of this.availableSounds) {
            try {
                const response = await fetch(`quantsounds/${soundName}.WAV`);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                this.sounds[soundName] = audioBuffer;
            } catch (error) {
                console.error(`Failed to load sound ${soundName}:`, error);
            }
        }
    }
    
    populateSoundDropdowns() {
        this.tracks.forEach(track => {
            const select = document.querySelector(`[data-track="${track}"] .sound-select`);
            if (select) {
                select.innerHTML = '';
                this.availableSounds.forEach(sound => {
                    const option = document.createElement('option');
                    option.value = sound;
                    option.textContent = this.formatSoundName(sound);
                    if (sound === this.selectedSounds[track]) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            }
        });
    }
    
    formatSoundName(soundName) {
        // Convert sound names to more readable format
        const nameMap = {
            'bassdrumBD0075': 'Bass Drum',
            'snareSD7550': 'Snare',
            'closedhatCH': 'Closed Hat',
            'openhatOH10': 'Open Hat',
            'cowbellCB': 'Cowbell',
            'highcongaHC50': 'High Conga',
            'midcongaMC50': 'Mid Conga',
            'lowcongaLC50': 'Low Conga',
            'CP': 'Clap'
        };
        return nameMap[soundName] || soundName;
    }
    
    generateSteps() {
        this.tracks.forEach(trackName => {
            const track = document.querySelector(`[data-track="${trackName}"] .steps`);
            track.innerHTML = '';
            
            for (let i = 0; i < this.steps; i++) {
                const stepContainer = document.createElement('div');
                stepContainer.className = 'step-container';
                stepContainer.dataset.step = i;
                stepContainer.dataset.track = trackName;
                
                // Create the step button
                const step = document.createElement('div');
                step.className = 'step';
                
                // Add step number
                const stepNumber = document.createElement('div');
                stepNumber.textContent = i + 1;
                step.appendChild(stepNumber);
                
                // Create separate probability control
                const probControl = document.createElement('div');
                probControl.className = 'probability-control';
                probControl.style.display = 'none';
                
                const probBar = document.createElement('div');
                probBar.className = 'probability-bar';
                
                const probIndicator = document.createElement('div');
                probIndicator.className = 'probability-indicator';
                probIndicator.style.width = '50%';
                
                const probValue = document.createElement('div');
                probValue.className = 'probability-value';
                probValue.textContent = '50%';
                
                probBar.appendChild(probIndicator);
                probBar.appendChild(probValue);
                probControl.appendChild(probBar);
                
                stepContainer.appendChild(step);
                stepContainer.appendChild(probControl);
                
                track.appendChild(stepContainer);
            }
        });
    }
    
    initializeStepData() {
        this.tracks.forEach(track => {
            this.stepData[track] = {};
            for (let i = 0; i < this.steps; i++) {
                this.stepData[track][i] = {
                    active: false,
                    probability: 50
                };
            }
        });
    }
    
    setupEventListeners() {
        // Step click events
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', (e) => this.toggleStep(e));
        });
        
        // Probability bar events - completely rewritten
        document.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('probability-bar') || e.target.classList.contains('probability-indicator')) {
                if (e.target.closest('.effect-probability')) {
                    this.startEffectProbabilityDrag(e);
                } else {
                    this.startProbabilityDrag(e);
                }
            }
        });
        
        // Add touch event support for mobile
        document.addEventListener('touchstart', (e) => {
            if (e.target.classList.contains('probability-bar') || e.target.classList.contains('probability-indicator')) {
                e.preventDefault();
                if (e.target.closest('.effect-probability')) {
                    this.startEffectProbabilityDrag(e);
                } else {
                    this.startProbabilityDrag(e);
                }
            }
        });
        
        // Control events
        document.getElementById('play-pause').addEventListener('click', () => {
            // Resume audio context on first interaction
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            this.togglePlay();
        });
        document.getElementById('clear').addEventListener('click', () => this.clear());
        
        // Info modal events
        document.querySelector('.info-btn').addEventListener('click', () => {
            document.getElementById('info-modal').style.display = 'block';
        });
        
        document.querySelector('.close').addEventListener('click', () => {
            document.getElementById('info-modal').style.display = 'none';
        });
        
        // Close modal when clicking outside of it
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('info-modal');
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        // Effect controls
        document.getElementById('autopan-toggle').addEventListener('click', () => {
            const btn = document.getElementById('autopan-toggle');
            const probControl = btn.parentElement.querySelector('.effect-probability');
            this.effects.autopan.active = !this.effects.autopan.active;
            
            if (this.effects.autopan.active) {
                btn.classList.add('active');
                probControl.style.display = 'block';
            } else {
                btn.classList.remove('active');
                probControl.style.display = 'none';
            }
        });
        
        document.getElementById('distortion-toggle').addEventListener('click', () => {
            const btn = document.getElementById('distortion-toggle');
            const probControl = btn.parentElement.querySelector('.effect-probability');
            this.effects.distortion.active = !this.effects.distortion.active;
            
            if (this.effects.distortion.active) {
                btn.classList.add('active');
                probControl.style.display = 'block';
            } else {
                btn.classList.remove('active');
                probControl.style.display = 'none';
            }
        });
        
        document.getElementById('stutter-toggle').addEventListener('click', () => {
            const btn = document.getElementById('stutter-toggle');
            const probControl = btn.parentElement.querySelector('.effect-probability');
            this.effects.stutter.active = !this.effects.stutter.active;
            
            if (this.effects.stutter.active) {
                // Turn off ratchet if it's on (but not distortion)
                if (this.effects.ratchet.active) {
                    const ratchetBtn = document.getElementById('ratchet-toggle');
                    const ratchetProbControl = ratchetBtn.parentElement.querySelector('.effect-probability');
                    this.effects.ratchet.active = false;
                    ratchetBtn.classList.remove('active');
                    ratchetProbControl.style.display = 'none';
                }
                
                btn.classList.add('active');
                probControl.style.display = 'block';
            } else {
                btn.classList.remove('active');
                probControl.style.display = 'none';
            }
        });
        
        document.getElementById('ratchet-toggle').addEventListener('click', () => {
            const btn = document.getElementById('ratchet-toggle');
            const probControl = btn.parentElement.querySelector('.effect-probability');
            this.effects.ratchet.active = !this.effects.ratchet.active;
            
            if (this.effects.ratchet.active) {
                // Turn off stutter if it's on (but not distortion)
                if (this.effects.stutter.active) {
                    const stutterBtn = document.getElementById('stutter-toggle');
                    const stutterProbControl = stutterBtn.parentElement.querySelector('.effect-probability');
                    this.effects.stutter.active = false;
                    stutterBtn.classList.remove('active');
                    stutterProbControl.style.display = 'none';
                }
                
                btn.classList.add('active');
                probControl.style.display = 'block';
            } else {
                btn.classList.remove('active');
                probControl.style.display = 'none';
            }
        });
        
        // Sound selection events
        document.querySelectorAll('.sound-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const track = e.target.dataset.track;
                this.selectedSounds[track] = e.target.value;
            });
        });
        
        // Tempo control
        const tempoInput = document.getElementById('tempo');
        const tempoDownBtn = document.getElementById('tempo-down');
        const tempoUpBtn = document.getElementById('tempo-up');
        
        let tempoInputTimeout;
        
        tempoInput.addEventListener('input', (e) => {
            // Clear any existing timeout
            clearTimeout(tempoInputTimeout);
            
            // Set a timeout to wait for user to finish typing
            tempoInputTimeout = setTimeout(() => {
                let newTempo = parseInt(e.target.value);
                
                // Validate and constrain the value
                if (newTempo < 30) {
                    newTempo = 30;
                    e.target.value = 30;
                } else if (newTempo > 280) {
                    newTempo = 280;
                    e.target.value = 280;
                }
                
                this.tempo = newTempo;
                if (this.isPlaying) {
                    this.stop();
                    this.play();
                }
            }, 500); // Wait 500ms after user stops typing
        });
        
        tempoDownBtn.addEventListener('click', () => {
            const newTempo = Math.max(30, this.tempo - 1);
            this.tempo = newTempo;
            tempoInput.value = newTempo;
            if (this.isPlaying) {
                this.stop();
                this.play();
            }
        });
        
        tempoUpBtn.addEventListener('click', () => {
            const newTempo = Math.min(280, this.tempo + 1);
            this.tempo = newTempo;
            tempoInput.value = newTempo;
            if (this.isPlaying) {
                this.stop();
                this.play();
            }
        });
    }
    
    toggleStep(e) {
        const step = e.currentTarget;
        const stepContainer = step.parentElement;
        const track = stepContainer.dataset.track;
        const stepIndex = parseInt(stepContainer.dataset.step);
        
        // Toggle active state
        const isActive = step.classList.toggle('active');
        this.stepData[track][stepIndex].active = isActive;
        
        // Show/hide probability control
        const probControl = stepContainer.querySelector('.probability-control');
        if (isActive) {
            probControl.style.display = 'block';
        } else {
            probControl.style.display = 'none';
        }
    }
    
    startProbabilityDrag(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Find the probability bar (either the clicked element or its parent)
        const probBar = e.target.classList.contains('probability-bar') ? e.target : e.target.parentElement;
        const stepContainer = probBar.closest('.step-container');
        const track = stepContainer.dataset.track;
        const stepIndex = parseInt(stepContainer.dataset.step);
        
        const updateProbability = (clientX) => {
            const rect = probBar.getBoundingClientRect();
            const clickX = clientX - rect.left;
            const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
            
            const indicator = probBar.querySelector('.probability-indicator');
            const value = probBar.querySelector('.probability-value');
            
            indicator.style.width = percentage + '%';
            value.textContent = Math.round(percentage) + '%';
            
            this.stepData[track][stepIndex].probability = Math.round(percentage);
        };
        
        // Get clientX from either mouse or touch event
        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        
        // Update on initial click/touch
        updateProbability(clientX);
        
        const handleMouseMove = (e) => {
            const moveClientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            updateProbability(moveClientX);
        };
        
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleMouseMove);
            document.removeEventListener('touchend', handleMouseUp);
        };
        
        // Add both mouse and touch event listeners
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchmove', handleMouseMove, { passive: false });
        document.addEventListener('touchend', handleMouseUp);
    }
    
    startEffectProbabilityDrag(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const probBar = e.target.classList.contains('probability-bar') ? e.target : e.target.parentElement;
        const effectControl = probBar.closest('.effect-control');
        const effectBtn = effectControl.querySelector('.effect-btn');
        const effectType = effectBtn.id.replace('-toggle', ''); // 'stutter-toggle' -> 'stutter'
        
        const updateProbability = (clientX) => {
            const rect = probBar.getBoundingClientRect();
            const clickX = clientX - rect.left;
            const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
            
            const indicator = probBar.querySelector('.probability-indicator');
            const value = probBar.querySelector('.probability-value');
            
            indicator.style.width = percentage + '%';
            value.textContent = Math.round(percentage) + '%';
            
            this.effects[effectType].probability = Math.round(percentage);
        };
        
        // Get clientX from either mouse or touch event
        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        
        // Update on initial click/touch
        updateProbability(clientX);
        
        const handleMouseMove = (e) => {
            const moveClientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            updateProbability(moveClientX);
        };
        
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleMouseMove);
            document.removeEventListener('touchend', handleMouseUp);
        };
        
        // Add both mouse and touch event listeners
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchmove', handleMouseMove, { passive: false });
        document.addEventListener('touchend', handleMouseUp);
    }
    
    togglePlay() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.play();
        }
    }
    
    play() {
        this.isPlaying = true;
        document.getElementById('play-pause').textContent = 'STOP';
        document.getElementById('play-pause').classList.add('playing');
        
        const stepTime = (60 / this.tempo) * 1000 / 4; // 16th notes
        this.interval = setInterval(() => {
            this.playStep();
            this.currentStep = (this.currentStep + 1) % this.steps;
        }, stepTime);
    }
    
    stop() {
        this.isPlaying = false;
        document.getElementById('play-pause').textContent = 'PLAY';
        document.getElementById('play-pause').classList.remove('playing');
        
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        // Clear playing indicators
        document.querySelectorAll('.step.playing').forEach(step => {
            step.classList.remove('playing');
        });
    }
    
    playStep() {
        // Clear previous playing indicators and cues
        document.querySelectorAll('.step.playing, .step-hit, .step-missed').forEach(step => {
            step.classList.remove('playing', 'step-hit', 'step-missed');
        });
        
        // Highlight current step
        document.querySelectorAll(`[data-step="${this.currentStep}"] .step`).forEach(step => {
            step.classList.add('playing');
        });
        
        // Play tracks with probability
        this.tracks.forEach(track => {
            const stepData = this.stepData[track][this.currentStep];
            const stepEl = document.querySelector(`[data-track="${track}"][data-step="${this.currentStep}"] .step`);
            if (stepData.active) {
                // Apply probability
                const random = Math.random() * 100;
                if (random <= stepData.probability) {
                    if (stepEl) {
                        stepEl.classList.add('step-hit');
                        setTimeout(() => stepEl.classList.remove('step-hit'), 200);
                    }
                    this.triggerSound(track);
                } else {
                    if (stepEl) {
                        stepEl.classList.add('step-missed');
                        setTimeout(() => stepEl.classList.remove('step-missed'), 200);
                    }
                }
            }
        });
    }
    
    triggerSound(track) {
        const selectedSound = this.selectedSounds[track];
        console.log(`Playing ${selectedSound} at step ${this.currentStep + 1}`);
        
        // Check if effects should trigger
        let shouldAutopan = false;
        let shouldDistort = false;
        let shouldStutter = false;
        let shouldRatchet = false;
        
        if (this.effects.autopan.active) {
            const random = Math.random() * 100;
            shouldAutopan = random <= this.effects.autopan.probability;
        }
        
        if (this.effects.distortion.active) {
            const random = Math.random() * 100;
            shouldDistort = random <= this.effects.distortion.probability;
        }
        
        if (this.effects.stutter.active) {
            const random = Math.random() * 100;
            shouldStutter = random <= this.effects.stutter.probability;
        }
        
        if (this.effects.ratchet.active) {
            const random = Math.random() * 100;
            shouldRatchet = random <= this.effects.ratchet.probability;
        }
        
        // Play the actual sound
        if (this.audioContext && this.sounds[selectedSound]) {
            // Ensure audio context is running
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            if (shouldRatchet) {
                // Play 4 64th notes in quick succession (with optional effects)
                const stepTime = (60 / this.tempo) * 1000 / 4; // 16th note duration
                const ratchetDelay = stepTime / 4; // 64th note duration
                
                for (let i = 0; i < 4; i++) {
                    setTimeout(() => {
                        const source = this.audioContext.createBufferSource();
                        source.buffer = this.sounds[selectedSound];
                        
                        let currentNode = source;
                        
                        if (shouldDistort) {
                            // Apply distortion
                            const distortion = this.audioContext.createWaveShaper();
                            distortion.curve = this.makeDistortionCurve(400);
                            distortion.oversample = '4x';
                            currentNode.connect(distortion);
                            currentNode = distortion;
                        }
                        
                        if (shouldAutopan) {
                            // Apply autopan (random left or right)
                            const panner = this.audioContext.createStereoPanner();
                            panner.pan.value = Math.random() < 0.5 ? -1 : 1; // Full left or full right
                            currentNode.connect(panner);
                            currentNode = panner;
                        }
                        
                        currentNode.connect(this.audioContext.destination);
                        source.start(0);
                    }, i * ratchetDelay);
                }
                
                // Visual feedback for ratchet
                const step = document.querySelector(`[data-track="${track}"][data-step="${this.currentStep}"] .step`);
                const ratchetBtn = document.getElementById('ratchet-toggle');
                
                if (step) {
                    step.classList.add('step-ratchet');
                    setTimeout(() => step.classList.remove('step-ratchet'), 400);
                }
                
                if (ratchetBtn) {
                    ratchetBtn.classList.add('effect-ratchet');
                    setTimeout(() => ratchetBtn.classList.remove('effect-ratchet'), 400);
                }
            } else if (shouldStutter) {
                // Play two 32nd notes in quick succession (with optional effects)
                const source1 = this.audioContext.createBufferSource();
                source1.buffer = this.sounds[selectedSound];
                
                let currentNode1 = source1;
                
                if (shouldDistort) {
                    // Apply distortion
                    const distortion = this.audioContext.createWaveShaper();
                    distortion.curve = this.makeDistortionCurve(400);
                    distortion.oversample = '4x';
                    currentNode1.connect(distortion);
                    currentNode1 = distortion;
                }
                
                if (shouldAutopan) {
                    // Apply autopan (random left or right)
                    const panner = this.audioContext.createStereoPanner();
                    panner.pan.value = Math.random() < 0.5 ? -1 : 1; // Full left or full right
                    currentNode1.connect(panner);
                    currentNode1 = panner;
                }
                
                currentNode1.connect(this.audioContext.destination);
                source1.start(0);
                
                // Second hit after 1/8th of a step (32nd note)
                const stepTime = (60 / this.tempo) * 1000 / 4; // 16th note duration
                const stutterDelay = stepTime / 2; // 32nd note duration
                
                setTimeout(() => {
                    const source2 = this.audioContext.createBufferSource();
                    source2.buffer = this.sounds[selectedSound];
                    
                    let currentNode2 = source2;
                    
                    if (shouldDistort) {
                        // Apply distortion
                        const distortion = this.audioContext.createWaveShaper();
                        distortion.curve = this.makeDistortionCurve(400);
                        distortion.oversample = '4x';
                        currentNode2.connect(distortion);
                        currentNode2 = distortion;
                    }
                    
                    if (shouldAutopan) {
                        // Apply autopan (random left or right)
                        const panner = this.audioContext.createStereoPanner();
                        panner.pan.value = Math.random() < 0.5 ? -1 : 1; // Full left or full right
                        currentNode2.connect(panner);
                        currentNode2 = panner;
                    }
                    
                    currentNode2.connect(this.audioContext.destination);
                    source2.start(0);
                }, stutterDelay);
                
                // Visual feedback for stutter
                const step = document.querySelector(`[data-track="${track}"][data-step="${this.currentStep}"] .step`);
                const stutterBtn = document.getElementById('stutter-toggle');
                
                if (step) {
                    step.classList.add('step-stutter');
                    setTimeout(() => step.classList.remove('step-stutter'), 300);
                }
                
                if (stutterBtn) {
                    stutterBtn.classList.add('effect-stutter');
                    setTimeout(() => stutterBtn.classList.remove('effect-stutter'), 300);
                }
            } else {
                // Normal single hit (with optional effects)
                const source = this.audioContext.createBufferSource();
                source.buffer = this.sounds[selectedSound];
                
                let currentNode = source;
                
                if (shouldDistort) {
                    // Apply distortion
                    const distortion = this.audioContext.createWaveShaper();
                    distortion.curve = this.makeDistortionCurve(400);
                    distortion.oversample = '4x';
                    currentNode.connect(distortion);
                    currentNode = distortion;
                }
                
                if (shouldAutopan) {
                    // Apply autopan (random left or right)
                    const panner = this.audioContext.createStereoPanner();
                    panner.pan.value = Math.random() < 0.5 ? -1 : 1; // Full left or full right
                    currentNode.connect(panner);
                    currentNode = panner;
                }
                
                currentNode.connect(this.audioContext.destination);
                source.start(0);
                
                // Visual feedback for effects
                if (shouldAutopan) {
                    const step = document.querySelector(`[data-track="${track}"][data-step="${this.currentStep}"] .step`);
                    const autopanBtn = document.getElementById('autopan-toggle');
                    
                    if (step) {
                        step.classList.add('step-autopan');
                        setTimeout(() => step.classList.remove('step-autopan'), 200);
                    }
                    
                    if (autopanBtn) {
                        autopanBtn.classList.add('effect-autopan');
                        setTimeout(() => autopanBtn.classList.remove('effect-autopan'), 200);
                    }
                } else if (shouldDistort) {
                    const step = document.querySelector(`[data-track="${track}"][data-step="${this.currentStep}"] .step`);
                    const distortionBtn = document.getElementById('distortion-toggle');
                    
                    if (step) {
                        step.classList.add('step-distortion');
                        setTimeout(() => step.classList.remove('step-distortion'), 200);
                    }
                    
                    if (distortionBtn) {
                        distortionBtn.classList.add('effect-distortion');
                        setTimeout(() => distortionBtn.classList.remove('effect-distortion'), 200);
                    }
                }
            }
        }
        
        // Visual feedback (only for non-effect hits)
        if (!shouldAutopan && !shouldDistort && !shouldStutter && !shouldRatchet) {
            const step = document.querySelector(`[data-track="${track}"][data-step="${this.currentStep}"] .step`);
            if (step) {
                step.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    step.style.transform = 'scale(1)';
                }, 50);
            }
        }
    }
    
    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }
    
    clear() {
        this.stop();
        this.initializeStepData();
        
        // Clear all step activations
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });
        
        // Clear all step probability controls
        document.querySelectorAll('.probability-control').forEach(probControl => {
            probControl.style.display = 'none';
            
            const indicator = probControl.querySelector('.probability-indicator');
            const value = probControl.querySelector('.probability-value');
            indicator.style.width = '50%';
            value.textContent = '50%';
        });
        
        // Reset all effects to inactive state
        this.effects.autopan.active = false;
        this.effects.distortion.active = false;
        this.effects.stutter.active = false;
        this.effects.ratchet.active = false;
        
        // Reset effect probabilities to 50%
        this.effects.autopan.probability = 50;
        this.effects.distortion.probability = 50;
        this.effects.stutter.probability = 50;
        this.effects.ratchet.probability = 50;
        
        // Clear effect button states
        document.getElementById('autopan-toggle').classList.remove('active');
        document.getElementById('distortion-toggle').classList.remove('active');
        document.getElementById('stutter-toggle').classList.remove('active');
        document.getElementById('ratchet-toggle').classList.remove('active');
        
        // Hide all effect probability controls
        document.querySelectorAll('.effect-probability').forEach(probControl => {
            probControl.style.display = 'none';
            
            const indicator = probControl.querySelector('.probability-indicator');
            const value = probControl.querySelector('.probability-value');
            indicator.style.width = '50%';
            value.textContent = '50%';
        });
    }
}

// Initialize the drum machine when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DrumMachine();
});

