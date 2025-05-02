// Drum sounds configuration
const drumSounds = [
    { name: 'Bass Drum', file: 'bn-sounds/bassdrum-BT3A0D3.WAV', defaultValue: 0 },
    { name: 'Snare', file: 'bn-sounds/snare-ST0TASA.WAV', defaultValue: 0 },
    { name: 'Closed Hi-Hat', file: 'bn-sounds/closedhihat-HHCD6.WAV', defaultValue: 0 },
    { name: 'Open Hi-Hat', file: 'bn-sounds/openhihat-HHOD2.WAV', defaultValue: 0 },
    { name: 'Clap', file: 'bn-sounds/clap-HANDCLP2.WAV', defaultValue: 0 },
    { name: 'Low Tom', file: 'bn-sounds/lowtom-LTAD3.WAV', defaultValue: 0 },
    { name: 'Mid Tom', file: 'bn-sounds/midtom-MTAD3.WAV', defaultValue: 0 },
    { name: 'High Tom', file: 'bn-sounds/hitom-HTAD3.WAV', defaultValue: 0 },
    { name: 'Rim', file: 'bn-sounds/rim-RIM63.WAV', defaultValue: 0 },
    { name: 'Ride', file: 'bn-sounds/ride-RIDED4.WAV', defaultValue: 0 },
    { name: 'Crash', file: 'bn-sounds/crash-CSHD4.WAV', defaultValue: 0 }
];

// Audio context and buffers
let audioContext;
let soundBuffers = {};
let isPlaying = false;
let currentStep = 0;
let stepInterval;

// Initialize the drum machine
async function initDrumMachine() {
    // Create audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Load all drum sounds
    for (const sound of drumSounds) {
        try {
            const response = await fetch(sound.file);
            const arrayBuffer = await response.arrayBuffer();
            soundBuffers[sound.name] = await audioContext.decodeAudioData(arrayBuffer);
        } catch (error) {
            console.error(`Error loading sound ${sound.name}:`, error);
        }
    }

    // Create tracks UI
    createTracks();
    
    // Set up event listeners
    document.getElementById('playPause').addEventListener('click', togglePlay);
    document.getElementById('bpm').addEventListener('input', updateBPM);
    
    // Set up spinner buttons
    document.querySelector('.spinner-up').addEventListener('click', () => adjustBPM(1));
    document.querySelector('.spinner-down').addEventListener('click', () => adjustBPM(-1));
    
    // Set up modal
    const modal = document.getElementById('helpModal');
    const helpButton = document.getElementById('helpButton');
    const closeButton = document.querySelector('.close-button');

    helpButton.addEventListener('click', () => {
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

    // Set up example pattern links
    document.querySelectorAll('[data-pattern]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pattern = JSON.parse(link.dataset.pattern);
            
            // Reset all tracks to 0 first
            document.querySelectorAll('.track-input').forEach(input => {
                input.value = '0';
                const event = new Event('input');
                input.dispatchEvent(event);
            });
            
            // Set the pattern values
            Object.entries(pattern).forEach(([trackName, value]) => {
                const track = Array.from(document.querySelectorAll('.track')).find(t => 
                    t.querySelector('.track-name').textContent.includes(trackName)
                );
                if (track) {
                    const input = track.querySelector('.track-input');
                    input.value = value;
                    const event = new Event('input');
                    input.dispatchEvent(event);
                }
            });
            
            // Close the modal
            modal.style.display = 'none';
        });
    });
    
    // Set initial decimal display
    const binaryInput = document.getElementById('bpm').value;
    const decimalBpm = parseInt(binaryInput, 2);
    document.getElementById('decimalBpm').textContent = `(${decimalBpm})`;
}

// Adjust BPM up or down
function adjustBPM(direction) {
    const bpmInput = document.getElementById('bpm');
    const currentBinary = bpmInput.value;
    const currentDecimal = parseInt(currentBinary, 2);
    
    // Calculate new value
    let newDecimal = currentDecimal + direction;
    
    // Clamp between 30 and 400
    newDecimal = Math.max(30, Math.min(400, newDecimal));
    
    // Convert back to binary without padding
    const newBinary = newDecimal.toString(2);
    
    // Update input and display
    bpmInput.value = newBinary;
    document.getElementById('decimalBpm').textContent = `(${newDecimal})`;
    
    // Update timing if playing
    if (isPlaying) {
        clearInterval(stepInterval);
        const stepDuration = 60000 / newDecimal / 4;
        stepInterval = setInterval(playStep, stepDuration);
    }
}

// Convert decimal to 16-bit binary string
function decimalToBinary(decimal) {
    return parseInt(decimal).toString(2).padStart(16, '0');
}

// Create track UI elements
function createTracks() {
    const tracksContainer = document.querySelector('.tracks');
    
    drumSounds.forEach(sound => {
        const track = document.createElement('div');
        track.className = 'track';
        
        track.innerHTML = `
            <input type="number" class="track-input" min="0" max="65535" value="${sound.defaultValue}">
            <div class="track-sequence" style="position: relative;">
                <div class="error-message" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(255, 0, 0, 0.9); color: white; padding: 0.5vw; font-size: 1vw; z-index: 1;">enter a number</div>
            </div>
            <div class="track-name">(${sound.name})</div>
        `;
        
        // Create sequence steps
        const sequence = track.querySelector('.track-sequence');
        for (let i = 0; i < 16; i++) {
            const step = document.createElement('div');
            step.className = 'step';
            step.textContent = '0';
            sequence.appendChild(step);
        }
        
        // Add input event listener
        const input = track.querySelector('.track-input');
        const errorMessage = track.querySelector('.error-message');
        
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            
            // Check if input is a valid number
            if (value === '' || isNaN(value)) {
                errorMessage.style.display = 'block';
                return;
            }
            
            // Check if number is within range
            const num = parseInt(value);
            if (num < 0 || num > 65535) {
                errorMessage.style.display = 'block';
                return;
            }
            
            // Valid input
            errorMessage.style.display = 'none';
            const binary = decimalToBinary(value);
            updateTrackSequence(sequence, binary);
        });
        
        // Initialize with default value
        const binary = decimalToBinary(sound.defaultValue);
        updateTrackSequence(sequence, binary);
        
        tracksContainer.appendChild(track);
    });
}

// Update track sequence visualization
function updateTrackSequence(sequence, binary) {
    const steps = sequence.querySelectorAll('.step');
    steps.forEach((step, index) => {
        const value = binary[index];
        step.textContent = value;
        step.classList.toggle('on', value === '1');
    });
}

// Play a sound
function playSound(soundName) {
    if (soundBuffers[soundName]) {
        const source = audioContext.createBufferSource();
        source.buffer = soundBuffers[soundName];
        source.connect(audioContext.destination);
        source.start();
    }
}

// Toggle play/pause
async function togglePlay() {
    const button = document.getElementById('playPause');
    if (isPlaying) {
        clearInterval(stepInterval);
        button.textContent = 'Play';
    } else {
        // Resume audio context if it's suspended
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        const binaryInput = document.getElementById('bpm').value;
        const decimalBpm = parseInt(binaryInput, 2);
        const stepDuration = 60000 / decimalBpm / 4; // 16th note duration in ms
        stepInterval = setInterval(playStep, stepDuration);
        button.textContent = 'Pause';
    }
    isPlaying = !isPlaying;
}

// Play current step
function playStep() {
    const tracks = document.querySelectorAll('.track');
    
    // Remove previous step highlight
    document.querySelectorAll('.step.playing').forEach(step => {
        step.classList.remove('playing');
    });
    
    // Play current step
    tracks.forEach(track => {
        const steps = track.querySelectorAll('.step');
        const step = steps[currentStep];
        step.classList.add('playing');
        
        if (step.classList.contains('on')) {
            const soundName = track.querySelector('.track-name').textContent.replace(/[()]/g, '').trim();
            playSound(soundName);
        }
    });
    
    // Move to next step
    currentStep = (currentStep + 1) % 16;
}

// Update BPM
function updateBPM() {
    const binaryInput = document.getElementById('bpm').value;
    
    // Validate binary input
    if (!/^[01]+$/.test(binaryInput)) {
        return; // Don't update if input contains non-binary characters
    }
    
    const decimalBpm = parseInt(binaryInput, 2); // Convert binary to decimal
    
    // Check if BPM is within valid range (30-400)
    if (decimalBpm < 30 || decimalBpm > 400) {
        return; // Don't update if BPM is out of range
    }
    
    document.getElementById('decimalBpm').textContent = `(${decimalBpm})`;
    
    if (isPlaying) {
        clearInterval(stepInterval);
        const stepDuration = 60000 / decimalBpm / 4;
        stepInterval = setInterval(playStep, stepDuration);
    }
}

// Initialize when the page loads
window.addEventListener('load', initDrumMachine);
