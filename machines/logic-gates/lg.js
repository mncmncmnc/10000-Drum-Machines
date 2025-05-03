// Audio Context setup
let audioContext;
let isPlaying = false;
const audioSamples = {
    kick: null,
    snare: null,
    hihat: null,
    clap: null
};

// UI Elements
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = playPauseBtn.querySelector('.play-icon');
const pauseIcon = playPauseBtn.querySelector('.pause-icon');
const statusText = document.querySelector('.status-text');

// Add these global constants at the top of the file
const FRAMES_PER_BEAT = 4; // 16th notes per quarter note
const BASE_BPM = 120; // Reference BPM for frame calculations

// for future
// Adjustable frame resolution (8th notes, 32nd notes, etc.)?
// Swing/groove amount per clock?
// Frame subdivision display in the UI?

// Initialize audio context on user interaction
document.addEventListener('click', initAudioContext, { once: true });

function initAudioContext() {
    if (audioContext) return;
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    loadAudioSamples();
    statusText.textContent = 'Audio Ready - Press Play';

    // Periodically check audio context state
    setInterval(() => {
        if (isPlaying && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('Audio context resumed');
            }).catch(error => {
                console.error('Error resuming audio context:', error);
            });
        }
    }, 1000);
}

// Play/Pause functionality
playPauseBtn.addEventListener('click', togglePlayPause);

function updateAllConnections() {
    // Update gate connections
    gates.forEach(gate => gate.updateConnections());
    
    // Update instrument connections
    instruments.forEach(instrument => instrument.updateConnection());
}

function togglePlayPause() {
    if (!audioContext) {
        initAudioContext();
    }

    // Continue with play/pause logic regardless of whether we just initialized
    isPlaying = !isPlaying;
    
    if (isPlaying) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        statusText.textContent = 'Playing';
        
        // Resume audio context if it was suspended
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        // Start all clocks with synchronized timing
        const startTime = audioContext.currentTime;
        clocks.forEach(clock => {
            clock.nextFrameTime = startTime;
            clock.start();
        });
    } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        statusText.textContent = 'Paused';
        
        // Stop all clocks
        clocks.forEach(clock => clock.stop());
        
        // Update all connections when paused
        updateAllConnections();
    }
}

// Load audio samples
async function loadAudioSamples() {
    const samples = {
        kick: 'lg-sounds/kick.wav',
        snare: 'lg-sounds/snare.wav',
        hihat: 'lg-sounds/hihat.wav',
        clap: 'lg-sounds/clap.wav'
    };

    for (const [name, url] of Object.entries(samples)) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            audioSamples[name] = audioBuffer;
        } catch (error) {
            console.error(`Error loading ${name} sample:`, error);
            statusText.textContent = 'Error loading samples';
        }
    }
}

// Clock class to handle timing
class Clock {
    constructor(id, defaultBpm) {
        this.id = id;
        this.bpm = defaultBpm;
        this.isRunning = false;
        this.frameCount = 0;
        this.nextFrameTime = 0;
        this.listeners = new Set();
        this.element = document.getElementById(`clock${id}`);
        this.bpmInput = document.getElementById(`bpm${id}`);
        
        // Calculate how many frames to wait based on BPM
        this.updateFrameInterval();
        
        this.bpmInput.addEventListener('change', () => {
            this.setBpm(parseInt(this.bpmInput.value) || 120);
        });
    }

    updateFrameInterval() {
        // Calculate how many frames to wait before next pulse
        // For example, at 120 BPM (BASE_BPM), wait 4 frames (quarter note)
        // At 60 BPM, wait 8 frames
        // At 240 BPM, wait 2 frames
        this.framesPerPulse = Math.round((BASE_BPM / this.bpm) * FRAMES_PER_BEAT);
    }

    setBpm(bpm) {
        this.bpm = Math.max(0, Math.min(999, bpm));
        this.bpmInput.value = this.bpm;
        this.updateFrameInterval();
        this.frameCount = 0; // Reset frame count when BPM changes
    }

    tick(currentTime) {
        if (!this.isRunning || !audioContext) return;

        const frameInterval = 60 / (BASE_BPM * FRAMES_PER_BEAT);
        const currentAudioTime = audioContext.currentTime;

        // Process all frames up to current time
        while (this.nextFrameTime <= currentAudioTime) {
            this.frameCount++;
            
            // Trigger pulse when we've counted enough frames
            if (this.frameCount >= this.framesPerPulse) {
                this.element.classList.add('active');
                setTimeout(() => this.element.classList.remove('active'), 50);
                this.notifyListeners();
                this.frameCount = 0;
            }
            
            // Calculate next frame time
            this.nextFrameTime += frameInterval;
        }
    }

    start() {
        this.isRunning = true;
        this.frameCount = 0;
        this.nextFrameTime = audioContext ? audioContext.currentTime : 0;
    }

    stop() {
        this.isRunning = false;
    }

    addListener(listener) {
        this.listeners.add(listener);
    }

    removeListener(listener) {
        this.listeners.delete(listener);
    }

    notifyListeners() {
        this.listeners.forEach(listener => listener(this));
    }
}

// Logic Gate class
class LogicGate {
    constructor(id) {
        this.id = id;
        this.type = 'AND';
        this.inputA = null;
        this.inputB = null;
        this.lastInputAState = false;
        this.lastInputBState = false;
        this.listeners = new Set();
        
        // Store bound handlers to properly remove listeners
        this.boundHandleInputA = this.handleInputA.bind(this);
        this.boundHandleInputB = this.handleInputB.bind(this);
        
        this.element = document.getElementById(`gate${id}`);
        this.inputASelect = document.getElementById(`gate${id}-inputA`);
        this.inputBSelect = document.getElementById(`gate${id}-inputB`);
        this.typeSelect = document.getElementById(`gate${id}-type`);
        
        // Create gate icon element
        this.gateIcon = document.createElement('div');
        this.gateIcon.className = 'gate-icon';
        this.typeSelect.parentElement.appendChild(this.gateIcon);
        
        this.setupInputSelects();
        this.setupTypeSelect();
        this.updateGateIcon(this.type);

        // Set default clock connections
        // Default pattern for gates
        // Gate 1: Clock 1 -> Clock 2
        // Gate 2: Clock 2 -> Clock 3
        // Gate 3: Clock 3 -> Clock 4
        const clockA = id;  // First clock number matches gate number
        const clockB = (id % 4) + 1;  // Second clock wraps around to 1
        
        this.inputASelect.value = `clock${clockA}`;
        this.inputBSelect.value = `clock${clockB}`;
        this.updateConnections();
    }

    updateGateIcon(type) {
        const icons = {
            'AND': '[ & ]',
            'NAND': '[ ~& ]',
            'OR': '[ ∨ ]',
            'NOR': '[ ~∨ ]',
            'XOR': '[ ⊕ ]',
            'XNOR': '[ ⊙ ]',
            'NOT': '[ ¬ ]'
        };
        this.gateIcon.textContent = icons[type] || type;
    }

    setupInputSelects() {
        const sources = [
            { value: 'none', label: 'None' },
            ...Array(4).fill().map((_, i) => ({ value: `clock${i + 1}`, label: `Clock ${i + 1}` })),
            ...Array(4).fill().map((_, i) => {
                if (i + 1 !== this.id) {
                    return { value: `gate${i + 1}`, label: `Gate ${i + 1}` };
                }
            }).filter(Boolean)
        ];

        [this.inputASelect, this.inputBSelect].forEach(select => {
            sources.forEach(source => {
                const option = document.createElement('option');
                option.value = source.value;
                option.textContent = source.label;
                select.appendChild(option);
            });

            select.addEventListener('change', () => {
                this.updateConnections();
                drawAllConnections();
            });
        });
    }

    setupTypeSelect() {
        const gateTypes = ['AND', 'NAND', 'OR', 'NOR', 'XOR', 'XNOR', 'NOT'];
        gateTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            this.typeSelect.appendChild(option);
        });

        this.typeSelect.addEventListener('change', () => {
            this.type = this.typeSelect.value;
            this.updateGateIcon(this.type);
            // For NOT gate, disable input B and set it to 'none'
            if (this.type === 'NOT') {
                this.inputBSelect.value = 'none';
                this.inputBSelect.disabled = true;
            } else {
                this.inputBSelect.disabled = false;
            }
            this.evaluate();
        });
    }

    updateConnections() {
        // Remove old listeners using stored bound handlers
        if (this.inputA) {
            this.inputA.removeListener(this.boundHandleInputA);
        }
        if (this.inputB) {
            this.inputB.removeListener(this.boundHandleInputB);
        }

        // Reset states when connections change
        this.lastInputAState = false;
        this.lastInputBState = false;

        // Set new inputs
        const inputASource = this.inputASelect.value;
        const inputBSource = this.inputBSelect.value;

        this.inputA = inputASource === 'none' ? null : getSourceById(inputASource);
        this.inputB = inputBSource === 'none' ? null : getSourceById(inputBSource);

        // Add new listeners using stored bound handlers
        if (this.inputA) {
            this.inputA.addListener(this.boundHandleInputA);
        }
        if (this.inputB) {
            this.inputB.addListener(this.boundHandleInputB);
        }
    }

    handleInputA() {
        if (!isPlaying) return;
        this.lastInputAState = true;
        this.evaluate();
        setTimeout(() => {
            this.lastInputAState = false;
            this.evaluate();
        }, 50);
    }

    handleInputB() {
        if (!isPlaying) return;
        this.lastInputBState = true;
        this.evaluate();
        setTimeout(() => {
            this.lastInputBState = false;
            this.evaluate();
        }, 50);
    }

    evaluate() {
        if (!isPlaying) return;
        
        // Get current input states, treating 'none' as false
        const inputAState = this.inputASelect.value === 'none' ? false : this.lastInputAState;
        const inputBState = this.inputBSelect.value === 'none' ? false : this.lastInputBState;
        
        let output = false;
        
        switch (this.type) {
            case 'NOT':
                output = !inputAState;
                break;
            case 'AND':
                output = inputAState && inputBState;
                break;
            case 'NAND':
                output = !(inputAState && inputBState);
                break;
            case 'OR':
                output = inputAState || inputBState;
                break;
            case 'NOR':
                output = !(inputAState || inputBState);
                break;
            case 'XOR':
                output = inputAState !== inputBState;
                break;
            case 'XNOR':
                output = inputAState === inputBState;
                break;
        }

        if (output) {
            this.element.classList.add('active');
            this.notifyListeners();
            setTimeout(() => {
                this.element.classList.remove('active');
            }, 50);
        }
    }

    addListener(listener) {
        this.listeners.add(listener);
    }

    removeListener(listener) {
        this.listeners.delete(listener);
    }

    notifyListeners() {
        this.listeners.forEach(listener => listener(this));
    }
}

// Instrument class
class Instrument {
    constructor(name, defaultGateNumber) {
        this.name = name;
        this.input = null;
        this.element = document.getElementById(name);
        this.inputSelect = document.getElementById(`${name}-input`);
        this.outputSelect = document.getElementById(`${name}-output`);
        
        // Set up input and output selects
        this.setupInputSelect();
        this.setupOutputSelect();
        
        // Set default gate connection
        if (defaultGateNumber) {
            this.inputSelect.value = `gate${defaultGateNumber}`;
            this.updateConnection();
        }

        // Set default output sound based on position
        const defaultSounds = {
            'sound1': 'kick',
            'sound2': 'snare',
            'sound3': 'hihat',
            'sound4': 'clap'
        };
        this.outputSelect.value = defaultSounds[name];
        this.name = defaultSounds[name]; // Set the initial sound name
    }

    setupInputSelect() {
        const sources = [
            { value: 'none', label: 'None' },
            ...Array(4).fill().map((_, i) => ({ value: `clock${i + 1}`, label: `Clock ${i + 1}` })),
            ...Array(4).fill().map((_, i) => ({ value: `gate${i + 1}`, label: `Gate ${i + 1}` }))
        ];

        sources.forEach(source => {
            const option = document.createElement('option');
            option.value = source.value;
            option.textContent = source.label;
            this.inputSelect.appendChild(option);
        });

        this.inputSelect.addEventListener('change', () => {
            this.updateConnection();
            drawAllConnections();
        });
    }

    setupOutputSelect() {
        // Don't add options if they already exist (they're defined in HTML)
        this.outputSelect.addEventListener('change', () => {
            // Store the selected output sound
            this.name = this.outputSelect.value;
        });
    }

    updateConnection() {
        if (this.input) {
            this.input.removeListener(this.handleInput.bind(this));
        }

        const inputSource = this.inputSelect.value;
        this.input = inputSource === 'none' ? null : getSourceById(inputSource);

        if (this.input) {
            this.input.addListener(this.handleInput.bind(this));
        }
    }

    handleInput(source) {
        // Don't process input if set to None
        if (this.inputSelect.value === 'none') return;

        // Check if the source matches our input
        const inputSource = this.inputSelect.value;
        if ((source instanceof Clock && inputSource === `clock${source.id}`) ||
            (source instanceof LogicGate && inputSource === `gate${source.id}`)) {
            this.element.classList.add('active');
            setTimeout(() => this.element.classList.remove('active'), 50);
            this.playSound();
        }
    }

    playSound() {
        // Don't play sound if system is paused or input is None
        if (!isPlaying || !audioContext || !audioSamples[this.name] || this.inputSelect.value === 'none') return;

        // Check if context is suspended
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        // Create a new buffer source for each play
        const source = audioContext.createBufferSource();
        source.buffer = audioSamples[this.name];

        // Create a gain node for volume control
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 1.0;

        // Connect the source to the gain node and then to the destination
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Start the sound immediately
        source.start(0);

        // Clean up
        source.onended = () => {
            source.disconnect();
            gainNode.disconnect();
        };
    }
}

// Helper function to get source by ID
function getSourceById(id) {
    if (id.startsWith('clock')) {
        return clocks[parseInt(id.slice(5)) - 1];
    } else if (id.startsWith('gate')) {
        return gates[parseInt(id.slice(4)) - 1];
    }
    return null;
}

// Initialize components
const clocks = [
    new Clock(1, parseInt(document.getElementById('bpm1').value) || 45),
    new Clock(2, parseInt(document.getElementById('bpm2').value) || 330),
    new Clock(3, parseInt(document.getElementById('bpm3').value) || 60),
    new Clock(4, parseInt(document.getElementById('bpm4').value) || 100)
];

const gates = [
    new LogicGate(1),
    new LogicGate(2),
    new LogicGate(3),
    new LogicGate(4)
];

// Set Gate 3's type to OR
gates[2].typeSelect.value = 'OR';
gates[2].type = 'OR';
gates[2].updateGateIcon('OR');

// Set Gate 4's special connections after all gates are created
gates[3].inputASelect.value = 'gate3';
gates[3].inputBSelect.value = 'clock4';
gates[3].updateConnections();

const instruments = [
    new Instrument('sound1', 1),    // Connect to Gate 1 by default
    new Instrument('sound2', 2),   // Connect to Gate 2 by default
    new Instrument('sound3', 3),   // Connect to Gate 3 by default
    new Instrument('sound4', 4)     // Connect to Gate 4 by default
];

// Animation loop
function animate(currentTime) {
    if (isPlaying) {
        clocks.forEach(clock => clock.tick(currentTime));
        // Redraw connections every frame to show flashes
        drawAllConnections();
    }
    requestAnimationFrame(animate);
}

// Start the animation loop
requestAnimationFrame(animate);

// Connection drawing
const canvas = document.getElementById('connectionCanvas');
const ctx = canvas.getContext('2d');

function updateCanvasSize() {
    const container = document.querySelector('.container');
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
}

function getElementCenter(element) {
    const rect = element.getBoundingClientRect();
    const containerRect = document.querySelector('.container').getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top + rect.height / 2 - containerRect.top
    };
}

function drawConnection(startElement, endElement, inputType = '') {
    const start = getElementCenter(startElement);
    const end = getElementCenter(endElement);
    
    // Adjust starting point (output) to bottom of source element
    start.y = start.y + startElement.offsetHeight / 2;

    // Adjust endpoint based on target type
    if (endElement.classList.contains('gate')) {
        // For gates, position at the top input points
        end.y = end.y - endElement.offsetHeight / 2;
        if (inputType === 'A') {
            end.x = end.x - endElement.offsetWidth / 3;
        } else if (inputType === 'B') {
            end.x = end.x + endElement.offsetWidth / 3;
        }
    } else {
        // For instruments, position at the top center
        end.y = end.y - endElement.offsetHeight / 2;
    }

    // Draw cable-like curved connection
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    
    // Calculate control points for a natural cable curve
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Adjust slack based on distance
    const slack = Math.min(Math.abs(dy) * 0.5, distance * 0.3);
    
    // Control points for the bezier curve
    const cp1x = start.x;
    const cp1y = start.y + slack;
    const cp2x = end.x;
    const cp2y = end.y - slack;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, end.x, end.y);
    
    // Style based on active state - only flash if the source is active
    const isActive = startElement.classList.contains('active');
    ctx.strokeStyle = isActive ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = isActive ? 3 : 2;
    ctx.stroke();

    // Draw input label
    if (inputType) {
        ctx.fillStyle = isActive ? '#ff4a4a' : 'rgba(255, 74, 74, 0.8)';
        ctx.font = '12px Arial';
        ctx.fillText(inputType, end.x - 6, end.y - 10);
    }
}

function drawAllConnections() {
    updateCanvasSize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw gate connections
    gates.forEach((gate, i) => {
        const gateElement = document.getElementById(`gate${i + 1}`);
        const inputASelect = document.getElementById(`gate${i + 1}-inputA`);
        const inputBSelect = document.getElementById(`gate${i + 1}-inputB`);

        // Handle Input A connections
        if (inputASelect.value.startsWith('clock')) {
            const clockNum = inputASelect.value.replace('clock', '');
            const clockElement = document.getElementById(`clock${clockNum}`);
            drawConnection(clockElement, gateElement, 'A');
        } else if (inputASelect.value.startsWith('gate')) {
            const sourceGateNum = inputASelect.value.replace('gate', '');
            const sourceGateElement = document.getElementById(`gate${sourceGateNum}`);
            drawConnection(sourceGateElement, gateElement, 'A');
        }

        // Handle Input B connections
        if (inputBSelect.value.startsWith('clock')) {
            const clockNum = inputBSelect.value.replace('clock', '');
            const clockElement = document.getElementById(`clock${clockNum}`);
            drawConnection(clockElement, gateElement, 'B');
        } else if (inputBSelect.value.startsWith('gate')) {
            const sourceGateNum = inputBSelect.value.replace('gate', '');
            const sourceGateElement = document.getElementById(`gate${sourceGateNum}`);
            drawConnection(sourceGateElement, gateElement, 'B');
        }
    });

    // Draw instrument connections
    instruments.forEach((instrument, i) => {
        const soundNum = i + 1;
        const instrumentElement = document.getElementById(`sound${soundNum}`);
        const inputSelect = document.getElementById(`sound${soundNum}-input`);
        const inputValue = inputSelect.value;

        if (inputValue.startsWith('gate')) {
            const gateNum = inputValue.replace('gate', '');
            const gateElement = document.getElementById(`gate${gateNum}`);
            drawConnection(gateElement, instrumentElement, 'IN');
        } else if (inputValue.startsWith('clock')) {
            const clockNum = inputValue.replace('clock', '');
            const clockElement = document.getElementById(`clock${clockNum}`);
            drawConnection(clockElement, instrumentElement, 'IN');
        }
    });
}

// Add event listeners for connection updates
function setupConnectionListeners() {
    const allSelects = document.querySelectorAll('select');
    allSelects.forEach(select => {
        select.addEventListener('change', drawAllConnections);
    });
}

// Update connections on window resize
window.addEventListener('resize', () => {
    requestAnimationFrame(drawAllConnections);
});

// Initialize connections
document.addEventListener('DOMContentLoaded', () => {
    setupConnectionListeners();
    drawAllConnections();
});

// Help Modal functionality
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const closeModal = document.querySelector('.close-modal');

helpBtn.addEventListener('click', () => {
    helpModal.style.display = 'block';
});

closeModal.addEventListener('click', () => {
    helpModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === helpModal) {
        helpModal.style.display = 'none';
    }
});
