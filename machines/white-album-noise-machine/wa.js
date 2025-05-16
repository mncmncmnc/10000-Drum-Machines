// State management
const state = {
    samples: [],
    selectedSamples: [],
    isPlaying: false,
    currentStep: 0,
    tempo: 120,
    sequencer: Array(4).fill().map(() => Array(16).fill(false)),
    players: [],
    waveforms: [],
    regions: Array(4).fill(null),
    sampleStartPoints: Array(4).fill(0),
    sampleEndPoints: Array(4).fill(1),
    audioInitialized: false,
    mutedTracks: Array(4).fill(false),
    soloedTracks: Array(4).fill(false),
    reversedTracks: Array(4).fill(false),
    swingAmount: 0
};

// Add a simple cache for audio buffers
const audioBufferCache = new Map();

// Initialize Tone.js
async function initAudio() {
    if (!state.audioInitialized) {
        try {
            await Tone.start();
            Tone.Transport.bpm.value = state.tempo;
            state.audioInitialized = true;
        } catch (error) {
            console.error('Error initializing audio:', error);
        }
    }
}

// Clean up existing samples and players
async function cleanupSamples() {
    // Stop all players
    state.players.forEach(player => {
        player.stop();
        player.dispose();
    });
    
    // Destroy all waveforms
    state.waveforms.forEach(wavesurfer => {
        wavesurfer.destroy();
    });
    
    // Clear arrays
    state.players = [];
    state.waveforms = [];
    state.regions = Array(4).fill(null);
    state.sampleStartPoints = Array(4).fill(0);
    state.sampleEndPoints = Array(4).fill(1);
    state.selectedSamples = [];
    
    // Clear waveform containers
    for (let i = 1; i <= 4; i++) {
        const container = document.querySelector(`#waveform${i}`);
        container.innerHTML = '';
    }
}

// Helper function to generate random region parameters
function generateRandomRegion(duration) {
    // Random region length between 5% and 30% of the total duration
    const regionLength = duration * (0.05 + Math.random() * 0.25);
    // Random start position, ensuring the region fits within the waveform
    const maxStart = duration - regionLength;
    const start = Math.random() * maxStart;
    return {
        start,
        end: start + regionLength
    };
}

// Load and select random samples
async function loadSamples() {
    try {
        // Clean up existing samples first
        await cleanupSamples();
        
        // Load the sounds.json file
        const response = await fetch('sounds.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const availableSounds = await response.json();
        
        // Randomly select 4 unique sounds
        const selectedSounds = [];
        while (selectedSounds.length < 4) {
            const randomIndex = Math.floor(Math.random() * availableSounds.length);
            const sound = availableSounds[randomIndex];
            if (!selectedSounds.includes(sound)) {
                selectedSounds.push(sound);
            }
        }
        
        // Create players and waveforms for each sample
        for (let i = 0; i < selectedSounds.length; i++) {
            const soundPath = `slices/${selectedSounds[i]}`;
            
            // Check if we have this sound in cache
            let player;
            if (audioBufferCache.has(soundPath)) {
                // Reuse cached player
                player = audioBufferCache.get(soundPath);
                player.disconnect();
                player = new Tone.Player({
                    url: soundPath,
                    loop: false,
                    autostart: false
                }).toDestination();
            } else {
                // Create new player
                player = new Tone.Player({
                    url: soundPath,
                    loop: false,
                    autostart: false
                }).toDestination();
                // Cache the player
                audioBufferCache.set(soundPath, player);
            }
            
            state.players.push(player);

            // Initialize WaveSurfer
            const wavesurfer = WaveSurfer.create({
                container: `#waveform${i + 1}`,
                waveColor: '#ff0000',
                progressColor: '#ff6666',
                cursorColor: 'transparent',
                barWidth: 1,
                barGap: 1,
                responsive: true,
                height: 30,
                normalize: true,
                interact: false,
                hideScrollbar: true,
                plugins: [
                    WaveSurfer.regions.create()
                ]
            });

            // Load the audio file
            await wavesurfer.load(soundPath);
            
            // Custom click handler
            const container = document.querySelector(`#waveform${i + 1}`);
            container.addEventListener('click', async (e) => {
                await initAudio();
                
                // Get click position relative to container
                const rect = container.getBoundingClientRect();
                const clickPosition = (e.clientX - rect.left) / rect.width;
                
                // Check if click is within any region
                const regions = Object.values(wavesurfer.regions.list);
                const clickedRegion = regions.find(r => {
                    const start = r.start / wavesurfer.getDuration();
                    const end = r.end / wavesurfer.getDuration();
                    return clickPosition >= start && clickPosition <= end;
                });
                
                if (!clickedRegion) {
                    // If clicking outside a region, move the region to the click position
                    const currentRegion = regions[0]; // We know there's only one region per waveform
                    if (currentRegion) {
                        const duration = wavesurfer.getDuration();
                        const regionWidth = currentRegion.end - currentRegion.start;
                        const newStart = clickPosition * duration;
                        const newEnd = newStart + regionWidth;
                        
                        // Ensure the region stays within the waveform bounds
                        if (newEnd <= duration) {
                            // Update region using the correct API
                            currentRegion.update({
                                start: newStart,
                                end: newEnd
                            });
                            // Update state arrays
                            state.sampleStartPoints[i] = newStart / duration;
                            state.sampleEndPoints[i] = newEnd / duration;
                        } else {
                            // If it would go past the end, align to the end instead
                            const finalStart = duration - regionWidth;
                            currentRegion.update({
                                start: finalStart,
                                end: duration
                            });
                            // Update state arrays
                            state.sampleStartPoints[i] = finalStart / duration;
                            state.sampleEndPoints[i] = 1;
                        }
                    }
                }
            });

            // Create initial region after waveform is loaded
            wavesurfer.on('ready', () => {
                const duration = wavesurfer.getDuration();
                // Generate random region parameters
                const { start, end } = generateRandomRegion(duration);
                
                // Create region with random parameters
                const region = wavesurfer.regions.add({
                    start,
                    end,
                    color: 'rgba(0, 255, 0, 0.2)',
                    drag: true,
                    resize: true,
                    preventContextMenu: true
                });

                // Update state when region changes
                region.on('update-end', () => {
                    const start = region.start / duration;
                    const end = region.end / duration;
                    state.sampleStartPoints[i] = start;
                    state.sampleEndPoints[i] = end;
                });

                // Set initial state values
                state.sampleStartPoints[i] = 0;
                state.sampleEndPoints[i] = 0.15;

                state.regions[i] = region;
            });

            state.waveforms.push(wavesurfer);
        }
    } catch (error) {
        console.error('Error in loadSamples:', error);
    }
}

// Create sequencer grid
function createSequencerGrid() {
    const grids = document.querySelectorAll('.sequencer-grid');
    
    grids.forEach((grid, trackIndex) => {
        for (let i = 0; i < 16; i++) {
            const step = document.createElement('div');
            step.className = 'step';
            step.dataset.step = i;
            
            step.addEventListener('click', () => {
                state.sequencer[trackIndex][i] = !state.sequencer[trackIndex][i];
                step.classList.toggle('active');
            });
            
            grid.appendChild(step);
        }
    });
}

// Handle transport controls
function setupTransportControls() {
    const playButton = document.getElementById('play');
    const stopButton = document.getElementById('stop');
    const tempoInput = document.getElementById('tempo');
    const swingInput = document.getElementById('swing');
    const swingDisplay = document.getElementById('swing-display');
    
    if (!playButton || !stopButton || !tempoInput || !swingInput) {
        console.error('Required transport control elements not found');
        return;
    }
    
    // Helper function to update tempo
    const updateTempo = (newTempo) => {
        newTempo = Math.max(60, Math.min(180, newTempo));
        tempoInput.value = newTempo;
        Tone.Transport.bpm.value = newTempo;
        state.tempo = newTempo;
    };

    // Helper function to update swing
    const updateSwing = (newSwing) => {
        newSwing = Math.max(0, Math.min(100, newSwing));
        swingInput.value = newSwing;
        state.swingAmount = newSwing;
        if (swingDisplay) {
            swingDisplay.textContent = '%';
        }
        setupSequencer(); // Re-setup sequencer to apply new swing
    };
    
    playButton.addEventListener('click', async () => {
        await initAudio();
        if (!state.isPlaying) {
            Tone.Transport.start();
            state.isPlaying = true;
            playButton.textContent = 'Pause';
        } else {
            Tone.Transport.pause();
            state.isPlaying = false;
            playButton.textContent = 'Play';
            updateStepIndicators();
        }
    });
    
    stopButton.addEventListener('click', () => {
        Tone.Transport.stop();
        state.isPlaying = false;
        state.currentStep = 0;
        playButton.textContent = 'Play';
        updateStepIndicators();
    });
    
    // Tempo control
    tempoInput.addEventListener('change', (e) => {
        updateTempo(parseInt(e.target.value));
    });

    // Swing control
    swingInput.addEventListener('change', (e) => {
        updateSwing(parseInt(e.target.value));
    });

    // Initialize displays
    if (swingDisplay) swingDisplay.textContent = '%';
}

// Update step indicators
function updateStepIndicators() {
    const steps = document.querySelectorAll('.step');
    steps.forEach(step => step.classList.remove('current'));
    
    const currentSteps = document.querySelectorAll(`.step[data-step="${state.currentStep}"]`);
    currentSteps.forEach(step => step.classList.add('current'));
}

// Setup sample controls
function setupSampleControls() {
    const tracks = document.querySelectorAll('.track');
    
    tracks.forEach((track, trackIndex) => {
        const pitch = track.querySelector('.pitch');
        const volume = track.querySelector('.volume');
        const reverse = track.querySelector('.reverse');
        const mute = track.querySelector('.mute');
        const solo = track.querySelector('.solo');
        const waveform = state.waveforms[trackIndex];
        const player = state.players[trackIndex];
        
        // Update pitch
        pitch.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            player.playbackRate = Math.pow(2, value / 12);
            pitch.parentElement.querySelector('.slider-value').textContent = value;
        });
        
        // Update volume
        volume.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            player.volume.value = value;
            volume.parentElement.querySelector('.slider-value').textContent = value;
        });
        
        // Setup reverse button
        reverse.addEventListener('click', () => {
            state.reversedTracks[trackIndex] = !state.reversedTracks[trackIndex];
            reverse.classList.toggle('active');
            player.reverse = state.reversedTracks[trackIndex];
            if (waveform) {
                waveform.setPlaybackRate(state.reversedTracks[trackIndex] ? -1 : 1);
            }
        });

        // Setup mute button
        mute.addEventListener('click', () => {
            state.mutedTracks[trackIndex] = !state.mutedTracks[trackIndex];
            mute.classList.toggle('active');
            updateTrackMuting();
        });

        // Setup solo button
        solo.addEventListener('click', () => {
            // If this track is already soloed, just unsolo it
            if (state.soloedTracks[trackIndex]) {
                state.soloedTracks[trackIndex] = false;
                solo.classList.remove('active');
            } else {
                // Unsolo all other tracks first
                state.soloedTracks = state.soloedTracks.map((_, i) => {
                    if (i !== trackIndex) {
                        const otherSoloButton = tracks[i].querySelector('.solo');
                        otherSoloButton.classList.remove('active');
                        return false;
                    }
                    return true;
                });
                solo.classList.add('active');
            }
            updateTrackMuting();
        });
    });
}

// Update track muting based on mute and solo states
function updateTrackMuting() {
    const hasSoloedTracks = state.soloedTracks.some(soloed => soloed);
    
    state.players.forEach((player, trackIndex) => {
        const shouldMute = hasSoloedTracks ? 
            !state.soloedTracks[trackIndex] || state.mutedTracks[trackIndex] : 
            state.mutedTracks[trackIndex];
        
        player.mute = shouldMute;
    });
}

// Generate random sequence
function generateRandomSequence() {
    state.sequencer = state.sequencer.map(track => 
        Array(16).fill().map(() => Math.random() < 0.3) // 30% chance of activation
    );
    
    // Update UI
    document.querySelectorAll('.step').forEach((step, index) => {
        const trackIndex = Math.floor(index / 16);
        const stepIndex = index % 16;
        step.classList.toggle('active', state.sequencer[trackIndex][stepIndex]);
    });
}

// Setup sequencer
function setupSequencer() {
    // Clear any existing events
    Tone.Transport.cancel();
    
    // Calculate swing timing
    const getSwingTime = (step) => {
        if (state.swingAmount === 0) return 0;
        // Apply swing to even-numbered steps (0, 2, 4, etc.)
        if (step % 2 === 0) {
            return (state.swingAmount / 100) * 0.25; // Convert percentage to quarter note fraction
        }
        return 0;
    };

    Tone.Transport.scheduleRepeat((time) => {
        // Play active steps
        state.players.forEach((player, trackIndex) => {
            if (state.sequencer[trackIndex][state.currentStep]) {
                const duration = player.buffer.duration;
                const startTime = state.sampleStartPoints[trackIndex] * duration;
                const endTime = state.sampleEndPoints[trackIndex] * duration;
                const swingOffset = getSwingTime(state.currentStep);
                player.start(time + swingOffset, startTime, endTime - startTime);
            }
        });
        
        // Update UI
        updateStepIndicators();
        
        // Move to next step
        state.currentStep = (state.currentStep + 1) % 16;
    }, '16n');
}

// Initialize everything
async function init() {
    // Don't initialize audio immediately - wait for user interaction
    await loadSamples();
    createSequencerGrid();
    setupTransportControls();
    setupSequencer();
    setupSampleControls();
    
    // Setup modal functionality
    const modal = document.getElementById('info-modal');
    const infoButton = document.getElementById('info-button');
    const closeModal = document.querySelector('.close-modal');

    infoButton.addEventListener('click', () => {
        modal.style.display = 'block';
    });

    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Setup refresh button
    const refreshButton = document.getElementById('refresh');
    refreshButton.addEventListener('click', async () => {
        // Stop playback if playing
        if (state.isPlaying) {
            Tone.Transport.stop();
            state.isPlaying = false;
            document.getElementById('play').textContent = 'Play';
            state.currentStep = 0;
            updateStepIndicators();
        }
        
        // Load new samples
        await loadSamples();
        // Re-setup sample controls for the new players
        setupSampleControls();
    });

    // Setup random sequence button
    const randomSequenceButton = document.getElementById('random-sequence');
    randomSequenceButton.addEventListener('click', () => {
        generateRandomSequence();
    });
}

// Start the app
init().catch(console.error); 