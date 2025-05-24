// Sequence definitions
const sequences = {
    odd: {
        name: "Odd Numbers",
        values: Array.from({length: 65}, (_, i) => 2*i + 1), // Generates odd numbers from 1 to 129
        generate: function(length) { return this.values.slice(0, length); }
    },
    even: {
        name: "Even Numbers",
        values: Array.from({length: 65}, (_, i) => 2*i), // Generates even numbers from 0 to 128
        generate: function(length) { return this.values.slice(0, length); }
    },
    prime: {
        name: "Prime Numbers",
        values: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127],
        generate: function(length) { return this.values.slice(0, length); }
    },
    fibonacci: {
        name: "Fibonacci Sequence",
        values: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89],
        generate: function(length) { return this.values.slice(0, length); }
    },
    lucas: {
        name: "Lucas Numbers",
        values: [2, 1, 3, 4, 7, 11, 18, 29, 47, 76, 123],
        generate: function(length) { return this.values.slice(0, length); }
    },
    triangular: {
        name: "Triangular Numbers",
        values: [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78, 91, 105, 120],
        generate: function(length) { return this.values.slice(0, length); }
    },
    square: {
        name: "Square Numbers",
        values: [1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121],
        generate: function(length) { return this.values.slice(0, length); }
    },
    cubic: {
        name: "Cubic Numbers",
        values: [1, 8, 27, 64],
        generate: function(length) { return this.values.slice(0, length); }
    },
    tetrahedral: {
        name: "Tetrahedral Numbers",
        values: [1, 4, 10, 20, 35, 56, 84, 120],
        generate: function(length) { return this.values.slice(0, length); }
    },
    pentagonal: {
        name: "Pentagonal Numbers",
        values: [1, 5, 12, 22, 35, 51, 70, 92, 117],
        generate: function(length) { return this.values.slice(0, length); }
    },
    hexagonal: {
        name: "Hexagonal Numbers",
        values: [1, 6, 15, 28, 45, 66, 91, 120],
        generate: function(length) { return this.values.slice(0, length); }
    },
    "centered-hexagonal": {
        name: "Centered Hexagonal Numbers",
        values: [1, 7, 19, 37, 61, 91],
        generate: function(length) { return this.values.slice(0, length); }
    },
    factorial: {
        name: "Factorials",
        values: [1, 1, 2, 6, 24, 120],
        generate: function(length) { return this.values.slice(0, length); }
    },
    "double-factorial": {
        name: "Double Factorials",
        values: [1, 1, 2, 3, 8, 15, 48, 105],
        generate: function(length) { return this.values.slice(0, length); }
    },
    "powers-of-2": {
        name: "Powers of 2",
        values: [1, 2, 4, 8, 16, 32, 64, 128],
        generate: function(length) { return this.values.slice(0, length); }
    },
    "powers-of-10": {
        name: "Powers of 10",
        values: [1, 10, 100],
        generate: function(length) { return this.values.slice(0, length); }
    },
    schroder: {
        name: "Schröder Numbers",
        values: [1, 2, 6, 22, 90],
        generate: function(length) { return this.values.slice(0, length); }
    },
    "look-and-say": {
        name: "Look-and-Say Sequence",
        values: [1, 11, 21],
        generate: function(length) { return this.values.slice(0, length); }
    },
    sylvester: {
        name: "Sylvester's Sequence",
        values: [2, 3, 7, 43],
        generate: function(length) { return this.values.slice(0, length); }
    },
    ulam: {
        name: "Ulam Sequence",
        values: [1, 2, 3, 4, 6, 8, 11, 13, 16, 18, 26, 28, 36, 38, 47, 48, 53, 57, 62, 69, 72, 77, 82, 87, 97, 99, 102, 105, 108, 115, 122],
        generate: function(length) { return this.values.slice(0, length); }
    },
    happy: {
        name: "Happy Numbers",
        values: [1, 7, 10, 13, 19, 23, 28, 31, 32, 44, 49, 68, 70, 79, 82, 86, 91, 94, 97, 100],
        generate: function(length) { return this.values.slice(0, length); }
    },
    perfect: {
        name: "Perfect Numbers",
        values: [6, 28],
        generate: function(length) { return this.values.slice(0, length); }
    },
    mersenne: {
        name: "Mersenne Primes",
        values: [3, 7, 31, 127],
        generate: function(length) { return this.values.slice(0, length); }
    },
    "sophie-germain": {
        name: "Sophie Germain Primes",
        values: [2, 3, 5, 11, 23, 29, 41, 53, 83, 89, 113],
        generate: function(length) { return this.values.slice(0, length); }
    },
    "noble-gases": {
        name: "Atomic Numbers of Noble Gases",
        values: [2, 10, 18, 36, 54, 86, 118],
        generate: function(length) { return this.values.slice(0, length); }
    },
    "alkali-metals": {
        name: "Atomic Numbers of Alkali Metals",
        values: [3, 11, 19, 37, 55, 87],
        generate: function(length) { return this.values.slice(0, length); }
    },
    "east-west-highways": {
        name: "Major East-West U.S. Interstate Highways",
        values: [10, 20, 30, 40, 50, 60, 70, 80, 90],
        generate: function(length) { return this.values.slice(0, length); }
    },
    "north-south-highways": {
        name: "Major North-South U.S. Interstate Highways",
        values: [5, 15, 25, 35, 45, 55, 65, 75, 85, 95],
        generate: function(length) { return this.values.slice(0, length); }
    },
    "manhattan-6": {
        name: "6 Train Numbered Street Stops In Manhattan",
        values: [14, 23, 28, 33, 42, 51, 59, 68, 77, 86, 96, 103, 110, 116, 125],
        generate: function(length) { return this.values.slice(0, length); }
    }
};

// Add sequence URLs mapping
const sequenceURLs = {
    odd: "https://en.wikipedia.org/wiki/Odd_number",
    even: "https://en.wikipedia.org/wiki/Even_number",
    prime: "https://en.wikipedia.org/wiki/Prime_number",
    fibonacci: "https://en.wikipedia.org/wiki/Fibonacci_sequence",
    lucas: "https://en.wikipedia.org/wiki/Lucas_number",
    triangular: "https://en.wikipedia.org/wiki/Triangular_number",
    square: "https://en.wikipedia.org/wiki/Square_number",
    cubic: "https://en.wikipedia.org/wiki/Cube_(algebra)",
    tetrahedral: "https://en.wikipedia.org/wiki/Tetrahedral_number",
    pentagonal: "https://en.wikipedia.org/wiki/Pentagonal_number",
    hexagonal: "https://en.wikipedia.org/wiki/Hexagonal_number",
    "centered-hexagonal": "https://en.wikipedia.org/wiki/Centered_hexagonal_number",
    factorial: "https://en.wikipedia.org/wiki/Factorial",
    "double-factorial": "https://en.wikipedia.org/wiki/Double_factorial",
    "powers-of-2": "https://en.wikipedia.org/wiki/Power_of_two",
    "powers-of-10": "https://en.wikipedia.org/wiki/Power_of_10",
    schroder: "https://en.wikipedia.org/wiki/Schr%C3%B6der_number",
    "look-and-say": "https://en.wikipedia.org/wiki/Look-and-say_sequence",
    sylvester: "https://en.wikipedia.org/wiki/Sylvester%27s_sequence",
    ulam: "https://en.wikipedia.org/wiki/Ulam_number",
    happy: "https://en.wikipedia.org/wiki/Happy_number",
    perfect: "https://en.wikipedia.org/wiki/Perfect_number",
    mersenne: "https://en.wikipedia.org/wiki/Mersenne_prime",
    "sophie-germain": "https://en.wikipedia.org/wiki/Sophie_Germain_prime",
    "noble-gases": "https://en.wikipedia.org/wiki/Noble_gas",
    "alkali-metals": "https://en.wikipedia.org/wiki/Alkali_metal",
    "east-west-highways": "https://www.interstate-map.com/",
    "north-south-highways": "https://www.interstate-map.com/",
    "manhattan-6": "https://new.mta.info/map/5256"
};

// UI State
let currentSequenceLength = 32;
let currentBPM = 120;
let showStepNumbers = true;

// Add play state
let isPlaying = false;
let currentStep = 0;
let playInterval = null;

// DOM Elements
const sequenceLengthInput = document.getElementById('sequence-length');
const bpmInput = document.getElementById('bpm');
const showStepNumbersInput = document.getElementById('show-step-numbers');
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanes = document.querySelectorAll('.tab-pane');
const sequenceSelects = document.querySelectorAll('.sequence-select');

// Audio context and sound buffers
let audioContext = null;
let audioContextInitialized = false;
const soundBuffers = new Map();
let soundSelects = null;

// Modify the audio context initialization
async function initAudio() {
    if (!audioContextInitialized) {
        try {
            // Create audio context only when needed
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Resume audio context if suspended
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            audioContextInitialized = true;
            console.log('Audio context initialized successfully');
        } catch (error) {
            console.error('Error initializing audio context:', error);
            throw error;
        }
    }
    return audioContext;
}

// Load a sound file
async function loadSound(filename) {
    if (!audioContext) {
        await initAudio();
    }
    
    if (soundBuffers.has(filename)) {
        return soundBuffers.get(filename);
    }

    try {
        const response = await fetch(`numSounds/${filename}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        soundBuffers.set(filename, audioBuffer);
        return audioBuffer;
    } catch (error) {
        console.error(`Error loading sound ${filename}:`, error);
        return null;
    }
}

// Modify the playSound function to be more robust
async function playSound(filename) {
    try {
        const context = await initAudio();
        if (!context) {
            console.error('Audio context not available');
            return;
        }
        
        if (!soundBuffers.has(filename)) {
            await loadSound(filename);
        }
        
        if (!soundBuffers.has(filename)) {
            console.error(`Sound ${filename} not loaded`);
            return;
        }

        const source = context.createBufferSource();
        source.buffer = soundBuffers.get(filename);
        source.connect(context.destination);
        source.start(0);
    } catch (error) {
        console.error(`Error playing sound ${filename}:`, error);
    }
}

// Initialize sequence displays
function initializeSequenceDisplay(container, length) {
    container.innerHTML = '';
    for (let i = 0; i < length; i++) {
        const step = document.createElement('div');
        step.className = 'sequence-step';
        const stepNumber = document.createElement('span');
        stepNumber.className = 'step-number';
        stepNumber.textContent = i + 1;
        stepNumber.style.display = showStepNumbers ? 'block' : 'none';
        step.appendChild(stepNumber);
        container.appendChild(step);
    }
    container.classList.toggle('show-numbers', showStepNumbers);
}

// Update sequence display
function updateSequenceDisplay(container, sequence) {
    if (!container) return;
    
    const steps = container.querySelectorAll('.sequence-step');
    if (!steps.length) return;
    
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    const activeSteps = new Set(sequence);
    
    steps.forEach((step, index) => {
        step.classList.toggle('active', activeSteps.has(index + 1));
    });
}

// Add debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Cache for generated sequences
const sequenceCache = new Map();

// Optimize sequence generation with caching
function getSequence(type, length) {
    const cacheKey = `${type}-${length}`;
    if (sequenceCache.has(cacheKey)) {
        return sequenceCache.get(cacheKey);
    }
    
    if (!sequences[type]) return [];
    
    const sequence = sequences[type].generate(length);
    sequenceCache.set(cacheKey, sequence);
    return sequence;
}

// Add this new function after the existing functions
function adjustSelectWidth(select) {
    if (!select) return;
    
    // Create a temporary select to measure the text
    const temp = document.createElement('select');
    temp.style.visibility = 'hidden';
    temp.style.position = 'absolute';
    temp.style.fontSize = window.getComputedStyle(select).fontSize;
    temp.style.fontFamily = window.getComputedStyle(select).fontFamily;
    document.body.appendChild(temp);
    
    // Add the selected option to measure
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption) {
        const option = document.createElement('option');
        option.text = selectedOption.text;
        temp.appendChild(option);
        
        // Get the width and add some padding
        const width = temp.offsetWidth + 40; // Add padding for the dropdown arrow and some extra space
        select.style.width = `${Math.max(280, width)}px`; // Minimum width of 280px
        
        // Clean up
        document.body.removeChild(temp);
    }
}

// Modify the handleSequenceSelect function to ensure sequences are properly displayed
const handleSequenceSelect = debounce((select, displayContainer) => {
    if (!select || !displayContainer) return;
    
    const sequenceType = select.value;
    const learnMoreButton = select.closest('.sequence-controls')?.querySelector('.learn-more');
    
    if (!sequenceType) {
        displayContainer.querySelectorAll('.sequence-step').forEach(step => {
            step.classList.remove('active');
        });
        select.style.width = '280px'; // Reset to default width when no selection
        if (learnMoreButton) {
            learnMoreButton.classList.remove('visible');
        }
        return;
    }
    
    const sequence = getSequence(sequenceType, currentSequenceLength);
    if (sequence && sequence.length > 0) {
        updateSequenceDisplay(displayContainer, sequence);
        adjustSelectWidth(select);
        if (learnMoreButton) {
            learnMoreButton.classList.add('visible');
        }
    }
}, 100);

// Add event listener for window resize to readjust widths
window.addEventListener('resize', debounce(() => {
    document.querySelectorAll('.sequence-select').forEach(select => {
        if (select.value) {
            adjustSelectWidth(select);
        }
    });
}, 100));

// Handle tab switching
function handleTabClick(button) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabPanes.forEach(pane => pane.classList.remove('active'));
    
    button.classList.add('active');
    const tabId = button.dataset.tab;
    const activePane = document.getElementById(tabId);
    activePane.classList.add('active');
    
    // Re-render the sequence display for the active tab
    const displayContainer = activePane.querySelector('.sequence-display');
    const select = activePane.querySelector('.sequence-select');
    if (displayContainer && select && select.value) {
        handleSequenceSelect(select, displayContainer);
    }
}

// Optimize sequence length change handler
const handleSequenceLengthChange = debounce(() => {
    const newLength = parseInt(sequenceLengthInput.value);
    if (isNaN(newLength) || newLength < 4) {
        sequenceLengthInput.value = 4;
        currentSequenceLength = 4;
    } else if (newLength > 128) {
        sequenceLengthInput.value = 128;
        currentSequenceLength = 128;
    } else {
        currentSequenceLength = newLength;
    }
    
    // Store current playback state
    const wasPlaying = isPlaying;
    if (wasPlaying) {
        // Temporarily pause playback
        togglePlay();
    }
    
    sequenceCache.clear(); // Clear cache when length changes
    
    // Update all sequence displays
    tabPanes.forEach(pane => {
        const displayContainer = pane.querySelector('.sequence-display');
        const select = pane.querySelector('.sequence-select');
        if (!displayContainer || !select) return;
        
        // Store current active steps before reinitializing
        const activeSteps = new Set();
        displayContainer.querySelectorAll('.sequence-step.active').forEach(step => {
            const stepNum = parseInt(step.querySelector('.step-number').textContent);
            if (stepNum <= newLength) {
                activeSteps.add(stepNum);
            }
        });
        
        // Reinitialize display
        initializeSequenceDisplay(displayContainer, currentSequenceLength);
        
        // Restore active steps
        if (select.value) {
            const sequence = getSequence(select.value, currentSequenceLength);
            updateSequenceDisplay(displayContainer, sequence);
        } else {
            // If no sequence selected, restore previous active steps
            displayContainer.querySelectorAll('.sequence-step').forEach(step => {
                const stepNum = parseInt(step.querySelector('.step-number').textContent);
                step.classList.toggle('active', activeSteps.has(stepNum));
            });
        }
    });
    
    // Restore playback state if it was playing
    if (wasPlaying) {
        // Small delay to ensure DOM updates are complete
        setTimeout(() => {
            togglePlay();
        }, 50);
    }
}, 100);

// Modify the togglePlay function to be simpler and more reliable
async function togglePlay() {
    const button = document.getElementById('play-pause');
    if (!button) return;

    try {
        // Initialize audio context on first play
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Resume audio context if suspended (Chrome requirement)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        isPlaying = !isPlaying;
        button.textContent = isPlaying ? 'PAUSE' : 'PLAY';

        if (isPlaying) {
            const stepDuration = (60 / currentBPM) * 1000 / 4;
            if (playInterval) {
                clearInterval(playInterval);
            }
            
            // Start playback
            playInterval = setInterval(() => {
                // Update all sequence displays to show current step and play sounds
                for (const pane of tabPanes) {
                    const steps = pane.querySelectorAll('.sequence-step');
                    const soundSelect = pane.querySelector('.sound-select');
                    const sequenceSelect = pane.querySelector('.sequence-select');
                    
                    if (steps.length) {
                        // Update step highlighting
                        steps.forEach((step, i) => {
                            step.classList.toggle('current', i === currentStep);
                        });
                        
                        // Play sound if needed
                        if (sequenceSelect?.value && soundSelect) {
                            const sequence = getSequence(sequenceSelect.value, currentSequenceLength);
                            if (sequence && sequence.includes(currentStep + 1)) {
                                playSound(soundSelect.value).catch(console.error);
                            }
                        }
                    }
                }
                
                currentStep = (currentStep + 1) % currentSequenceLength;
            }, stepDuration);
        } else {
            if (playInterval) {
                clearInterval(playInterval);
                playInterval = null;
            }
            // Clear current step highlighting
            document.querySelectorAll('.sequence-step').forEach(step => {
                step.classList.remove('current');
            });
            currentStep = 0;
        }
    } catch (error) {
        console.error('Error in togglePlay:', error);
        isPlaying = false;
        button.textContent = 'PLAY';
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    }
}

// Modify the initialize function to ensure proper setup
async function initialize() {
    // Add navigation button handlers
    const backButton = document.getElementById('back-button');
    const infoButton = document.getElementById('info-button');
    const infoModal = document.getElementById('info-modal');
    const modalClose = document.querySelector('.modal-close');

    if (backButton) {
        backButton.addEventListener('click', () => {
            window.location.href = '../../index.html';
        });
    }

    if (infoButton && infoModal) {
        infoButton.addEventListener('click', () => {
            infoModal.style.display = 'flex';
        });
    }

    if (modalClose && infoModal) {
        modalClose.addEventListener('click', () => {
            infoModal.style.display = 'none';
        });

        // Close modal when clicking outside
        infoModal.addEventListener('click', (e) => {
            if (e.target === infoModal) {
                infoModal.style.display = 'none';
            }
        });
    }

    // Set up tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => handleTabClick(button));
    });

    // Set initial sequence length input value
    if (sequenceLengthInput) {
        sequenceLengthInput.value = currentSequenceLength;
        sequenceLengthInput.addEventListener('change', handleSequenceLengthChange);
    }

    // Set up sequence selects
    document.querySelectorAll('.sequence-select').forEach(select => {
        const displayContainer = select.closest('.tab-pane')?.querySelector('.sequence-display');
        const learnMoreButton = select.closest('.sequence-controls')?.querySelector('.learn-more');
        
        if (displayContainer) {
            // Set initial sequence if one is selected
            if (select.value) {
                handleSequenceSelect(select, displayContainer);
                if (learnMoreButton) {
                    learnMoreButton.classList.add('visible');
                }
            } else if (learnMoreButton) {
                learnMoreButton.classList.remove('visible');
            }
            
            // Add change listener
            select.addEventListener('change', () => {
                handleSequenceSelect(select, displayContainer);
            });
        }
    });

    // Initialize sequence displays
    tabPanes.forEach(pane => {
        const displayContainer = pane.querySelector('.sequence-display');
        if (displayContainer) {
            initializeSequenceDisplay(displayContainer, currentSequenceLength);
        }
    });

    // Set up play/pause button
    const playPauseButton = document.getElementById('play-pause');
    if (playPauseButton) {
        playPauseButton.addEventListener('click', async (e) => {
            e.preventDefault();
            await togglePlay();
        });
    }

    // Set up other controls
    if (bpmInput) {
        const enforceBPMLimits = (value) => {
            const numValue = parseInt(value);
            if (isNaN(numValue)) {
                bpmInput.value = currentBPM;
                return currentBPM;
            }
            if (numValue < 30) {
                bpmInput.value = 30;
                return 30;
            }
            if (numValue > 300) {
                bpmInput.value = 300;
                return 300;
            }
            return numValue;
        };

        // Allow free typing during input
        bpmInput.addEventListener('input', (e) => {
            // Only validate that it's a number, don't enforce limits yet
            const numValue = parseInt(e.target.value);
            if (isNaN(numValue)) {
                e.target.value = currentBPM;
            }
        });

        // Enforce limits and update playback when input is complete
        const updateBPM = (e) => {
            const newBPM = enforceBPMLimits(e.target.value);
            if (newBPM !== currentBPM) {
                currentBPM = newBPM;
                if (isPlaying) {
                    togglePlay(); // Pause
                    togglePlay(); // Play with new BPM
                }
            }
        };

        bpmInput.addEventListener('change', updateBPM);
        bpmInput.addEventListener('blur', updateBPM);
    }

    if (showStepNumbersInput) {
        showStepNumbersInput.addEventListener('change', (e) => {
            showStepNumbers = e.target.checked;
            document.querySelectorAll('.sequence-display').forEach(container => {
                container.classList.toggle('show-numbers', showStepNumbers);
                container.querySelectorAll('.step-number').forEach(stepNumber => {
                    stepNumber.style.display = showStepNumbers ? 'block' : 'none';
                });
            });
        });
        
        // Set initial state
        showStepNumbers = showStepNumbersInput.checked;
        document.querySelectorAll('.sequence-display').forEach(container => {
            container.classList.toggle('show-numbers', showStepNumbers);
            container.querySelectorAll('.step-number').forEach(stepNumber => {
                stepNumber.style.display = showStepNumbers ? 'block' : 'none';
            });
        });
    }

    // Set up learn more buttons
    document.querySelectorAll('.learn-more').forEach(button => {
        button.addEventListener('click', () => {
            const tabPane = button.closest('.tab-pane');
            const sequenceSelect = tabPane?.querySelector('.sequence-select');
            if (sequenceSelect?.value && sequenceURLs[sequenceSelect.value]) {
                window.open(sequenceURLs[sequenceSelect.value], '_blank');
            }
        });
    });
}

// Start the application
initialize();
