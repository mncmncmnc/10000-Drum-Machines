// Initialize Tone.js and sequencer state
let isPlaying = false;
let currentStep = 0;
let sequence = Array(4).fill().map(() => Array(16).fill(false));

// Create four distinct noise generators with different characteristics
const synths = [
    // Noise Generator 1 - White Noise, Bright and Crisp
    {
        noise: new Tone.Noise({
            type: 'white',
            volume: -2
        }),
        filter: new Tone.Filter({
            frequency: 2000,
            type: 'lowpass'
        }),
        envelope: new Tone.AmplitudeEnvelope({
            attack: 0.005,
            decay: 0.05,
            release: 0.1
        }),
        isDrone: false,
        isSidechained: false
    },
    // Noise Generator 2 - Pink Noise, Warm and Sustained
    {
        noise: new Tone.Noise({
            type: 'pink',
            volume: -2
        }),
        filter: new Tone.Filter({
            frequency: 500,
            type: 'lowpass'
        }),
        envelope: new Tone.AmplitudeEnvelope({
            attack: 0.01,
            decay: 0.2,
            release: 0.3
        }),
        isDrone: false,
        isSidechained: false
    },
    // Noise Generator 3 - Brown Noise, Airy and Bright
    {
        noise: new Tone.Noise({
            type: 'brown',
            volume: -2
        }),
        filter: new Tone.Filter({
            frequency: 8000,
            type: 'lowpass'
        }),
        envelope: new Tone.AmplitudeEnvelope({
            attack: 0.02,
            decay: 0.15,
            release: 0.4
        }),
        isDrone: false,
        isSidechained: false
    },
    // Noise Generator 4 - Pink Noise, Deep and Punchy
    {
        noise: new Tone.Noise({
            type: 'pink',
            volume: -2
        }),
        filter: new Tone.Filter({
            frequency: 300,
            type: 'lowpass'
        }),
        envelope: new Tone.AmplitudeEnvelope({
            attack: 0.03,
            decay: 0.3,
            release: 0.5
        }),
        isDrone: false,
        isSidechained: false
    }
];

// Connect the audio chain for each noise generator
synths.forEach(synth => {
    synth.noise.connect(synth.envelope);
    synth.envelope.connect(synth.filter);
    synth.filter.toDestination();
    synth.noise.start();
});

// Initialize audio context and set master volume
async function initAudio() {
    try {
        await Tone.start();
        Tone.Destination.volume.value = -5;
    } catch (err) {
        console.error('Error starting audio context:', err);
    }
}

// Handle viewport scaling
function updateScale() {
    const wrapper = document.querySelector('.wrapper');
    const viewportWidth = window.innerWidth - 40; // Account for body padding
    const viewportHeight = window.innerHeight - 40;
    
    // Calculate scale factors for both dimensions
    const scaleX = viewportWidth / 1200;
    const scaleY = viewportHeight / 800;
    
    // Use the smaller scale to ensure everything fits
    const scale = Math.min(scaleX, scaleY);
    
    // Apply the scale
    wrapper.style.setProperty('--scale-factor', scale);
}

// Initialize UI and set up event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Modal functionality
    const modal = document.getElementById('infoModal');
    const infoButton = document.querySelector('.info-button');
    const closeButton = document.querySelector('.close-button');

    infoButton.addEventListener('click', () => {
        modal.style.display = 'block';
    });

    closeButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Initial scale
    updateScale();
    
    // Update scale on resize with debounce
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(updateScale, 10);
    });

    // Create 16-step sequencer grid for each noise generator
    const gridContainer = document.querySelector('.grid-container');
    for (let row = 0; row < 4; row++) {
        const gridRow = document.createElement('div');
        gridRow.className = 'grid-row';
        gridRow.dataset.synth = row;
        
        for (let col = 0; col < 16; col++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.step = col;
            cell.dataset.synth = row;
            gridRow.appendChild(cell);
        }
        
        gridContainer.appendChild(gridRow);
    }

    // Set up controls for each noise generator
    document.querySelectorAll('.synth').forEach((synthEl, synthIndex) => {
        const synth = synths[synthIndex];
        const gridRow = document.querySelector(`.grid-row[data-synth="${synthIndex}"]`);
        const sidechainControl = synthEl.querySelector('.sidechain-control');
        const sidechainCheckbox = synthEl.querySelector('.sidechain');
        
        // Mode selector (Trigger/Drone)
        const modeSelector = synthEl.querySelector('.mode-selector');
        const triggerButton = synthEl.querySelector('.trigger');
        modeSelector.addEventListener('change', (e) => {
            const isDrone = e.target.value === 'drone';
            synth.isDrone = isDrone;
            synthEl.dataset.mode = isDrone ? 'drone' : 'trigger';
            
            // Show/hide sidechain control and trigger button
            sidechainControl.style.display = isDrone ? 'block' : 'none';
            triggerButton.style.display = isDrone ? 'none' : 'block';
            
            // Update grid row visual state
            if (isDrone) {
                gridRow.classList.add('droning');
                // Start drone if sequencer is playing
                if (isPlaying) {
                    synth.envelope.triggerAttack();
                }
            } else {
                gridRow.classList.remove('droning');
                synth.envelope.triggerRelease();
                // Reset sidechain state
                synth.isSidechained = false;
                sidechainCheckbox.checked = false;
                // Restore normal volume
                synth.noise.volume.value = -2;
            }
        });
        
        // Sidechain checkbox
        sidechainCheckbox.addEventListener('change', (e) => {
            synth.isSidechained = e.target.checked;
            if (synth.isDrone && isPlaying) {
                if (!e.target.checked) {
                    // Restore normal volume when disabling sidechain
                    synth.noise.volume.value = -2;
                }
            }
        });
        
        // Manual trigger button
        synthEl.querySelector('.trigger').addEventListener('click', async () => {
            await initAudio();
            // Trigger with envelope
            synth.envelope.triggerAttackRelease('16n');
        });
        
        // Sound parameter controls
        synthEl.querySelector('.noise-type').addEventListener('change', (e) => {
            synth.noise.type = e.target.value;
        });
        
        synthEl.querySelector('.filter').addEventListener('input', (e) => {
            synth.filter.frequency.value = e.target.value;
        });
        
        synthEl.querySelector('.attack').addEventListener('input', (e) => {
            synth.envelope.attack = parseFloat(e.target.value);
        });
        
        synthEl.querySelector('.decay').addEventListener('input', (e) => {
            synth.envelope.decay = parseFloat(e.target.value);
        });
        
        synthEl.querySelector('.release').addEventListener('input', (e) => {
            synth.envelope.release = parseFloat(e.target.value);
        });
    });

    // Sequencer transport controls
    const playStopButton = document.getElementById('playStop');
    playStopButton.addEventListener('click', async () => {
        if (!isPlaying) {
            await initAudio();
            // Start any drones that are in drone mode
            synths.forEach(synth => {
                if (synth.isDrone) {
                    synth.envelope.triggerAttack();
                }
            });
            Tone.Transport.start();
            isPlaying = true;
            playStopButton.textContent = 'Pause';
        } else {
            Tone.Transport.pause();
            isPlaying = false;
            playStopButton.textContent = 'Play';
            
            // Stop all drones
            synths.forEach(synth => {
                if (synth.isDrone) {
                    synth.envelope.triggerRelease();
                }
            });
        }
    });

    // Tempo control
    document.getElementById('bpm').addEventListener('input', (e) => {
        Tone.Transport.bpm.value = parseInt(e.target.value);
    });

    // Global swing control
    const swingInput = document.getElementById('swing');
    const swingValue = document.querySelector('.swing-value');
    swingInput.addEventListener('input', (e) => {
        const swingAmount = parseInt(e.target.value);
        Tone.Transport.swing = swingAmount / 100;
        swingValue.textContent = `${swingAmount}%`;
    });

    // Randomize pattern
    document.getElementById('randomize').addEventListener('click', () => {
        sequence = sequence.map(track => 
            track.map(() => Math.random() > 0.7)
        );
        updateGrid();
    });

    // Clear pattern
    document.getElementById('clear').addEventListener('click', () => {
        sequence = sequence.map(track => 
            track.map(() => false)
        );
        updateGrid();
    });

    // Grid cell interaction
    gridContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('grid-cell')) {
            const step = parseInt(e.target.dataset.step);
            const synthIndex = parseInt(e.target.dataset.synth);
            
            // Toggle step on/off
            sequence[synthIndex][step] = !sequence[synthIndex][step];
            e.target.classList.toggle('active');
        }
    });
});

// Update grid visualization to reflect current state
function updateGrid() {
    document.querySelectorAll('.grid-cell').forEach(cell => {
        const step = parseInt(cell.dataset.step);
        const synthIndex = parseInt(cell.dataset.synth);
        
        // Remove all classes
        cell.classList.remove('active', 'current');
        
        // Add appropriate classes
        if (sequence[synthIndex][step]) {
            cell.classList.add('active');
        }
        if (step === currentStep) {
            cell.classList.add('current');
        }
    });
}

// Create sequencer
const seq = new Tone.Sequence(
    (time, step) => {
        currentStep = step;
        updateGrid();
        
        // Handle all synths
        sequence.forEach((track, synthIndex) => {
            const synth = synths[synthIndex];
            
            if (synth.isDrone) {
                if (synth.isSidechained) {
                    // Check if any other track has an active step
                    const anyOtherTrackActive = sequence.some((otherTrack, otherIndex) => 
                        otherIndex !== synthIndex && otherTrack[step]
                    );
                    
                    if (anyOtherTrackActive) {
                        // Duck the drone by reducing its volume
                        synth.noise.volume.value = -20;
                    } else {
                        // Restore normal volume
                        synth.noise.volume.value = -2;
                    }
                }
            } else if (track[step]) {
                // Normal trigger for non-droning synths
                synth.envelope.triggerAttackRelease('16n', time);
            }
        });
    },
    [...Array(16).keys()],
    '16n'
);

// Start the sequencer
seq.start(0);
