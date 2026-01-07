// Simple seeded random number generator
class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }

    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
}

// Get density range based on hour (0-23)
// Returns [minHits, maxHits] for 16 steps
function getDensityRange(hour) {
    // Map hour to density curve
    // Early morning (0-6): sparse (1-2 hits)
    // Morning (6-12): moderate (2-4 hits)
    // Afternoon (12-18): moderate-heavy (3-5 hits)
    // Evening (18-24): heavy (4-6 hits)
    
    // Create a smooth curve that peaks in evening
    const normalized = hour / 24;
    const curve = Math.sin(normalized * Math.PI - Math.PI / 2) * 0.5 + 0.5;
    
    // Map curve to hit range
    const minHits = Math.floor(1 + curve * 2); // 1-3
    const maxHits = Math.floor(2 + curve * 4); // 2-6
    
    return [minHits, maxHits];
}

// Generate pattern based on seed and density range
function generatePattern(seed, minHits, maxHits) {
    const rng = new SeededRandom(seed);
    const pattern = new Array(16).fill(false);
    
    // Determine number of hits within range
    const numHits = Math.floor(minHits + rng.next() * (maxHits - minHits + 1));
    
    // Select which steps get hits
    const availableSteps = Array.from({ length: 16 }, (_, i) => i);
    const selectedSteps = [];
    
    for (let i = 0; i < numHits; i++) {
        const randomIndex = Math.floor(rng.next() * availableSteps.length);
        selectedSteps.push(availableSteps.splice(randomIndex, 1)[0]);
    }
    
    // Activate selected steps
    selectedSteps.forEach(step => {
        pattern[step] = true;
    });
    
    return pattern;
}

// Mutate pattern by flipping 1-2 steps based on seed
function mutatePattern(previousPattern, seed) {
    const rng = new SeededRandom(seed);
    const pattern = [...previousPattern]; // Copy previous pattern
    
    // Determine how many steps to flip (1 or 2)
    const numFlips = Math.floor(1 + rng.next() * 2); // 1 or 2
    
    // Select random steps to flip
    const availableSteps = Array.from({ length: 16 }, (_, i) => i);
    
    for (let i = 0; i < numFlips; i++) {
        const randomIndex = Math.floor(rng.next() * availableSteps.length);
        const stepToFlip = availableSteps.splice(randomIndex, 1)[0];
        pattern[stepToFlip] = !pattern[stepToFlip]; // Flip the step
    }
    
    return pattern;
}

// Format time for display
function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// Store previous hi-hat pattern for gradual mutation
let previousHihatPattern = null;
let previousHour = null;

// Playback state
let isPlaying = false;
let currentPatterns = {
    bass: null,
    snare: null,
    hihat: null
};

// Audio file mapping (8-hour windows)
// 4AM-12PM (4:00-12:00): First sound
// 12PM-8PM (12:00-20:00): Second sound
// 8PM-4AM (20:00-4:00): Third sound
const audioFiles = {
    bass: [
        'bd/BD0075.WAV',  // 4AM-12PM
        'bd/boom.wav',    // 12PM-8PM
        'bd/BT0A0A7.WAV'  // 8PM-4AM
    ],
    snare: [
        'sd/chit.wav',    // 4AM-12PM
        'sd/clap.wav',    // 12PM-8PM
        'sd/SD7525.WAV'   // 8PM-4AM
    ],
    hihat: [
        'hh/CH.WAV',      // 4AM-12PM
        'hh/OH50.WAV',    // 12PM-8PM
        'hh/tick.wav'     // 8PM-4AM
    ]
};

// Web Audio API setup
let audioContext = null;
const audioBuffers = {
    bass: [[], [], []],  // 3 sounds per instrument
    snare: [[], [], []],
    hihat: [[], [], []]
};
let audioReady = false;

// Effects chain
let masterGain = null;
let lowPassFilter = null;
let reverbConvolver = null;
let reverbGain = null;
let dryGain = null;

// Scheduler state
let nextNoteTime = 0.0;
let scheduleAheadTime = 0.1; // How far ahead to schedule (100ms)
let lookahead = 25.0; // How often to call scheduler (25ms)
let currentStep = 0;
let scheduleInterval = null;
let startTime = 0.0;

// Get sound index based on hour (0-23)
function getSoundIndex(hour) {
    // 4AM-12PM (4-12): index 0
    // 12PM-8PM (12-20): index 1
    // 8PM-4AM (20-4): index 2
    if (hour >= 4 && hour < 12) {
        return 0;
    } else if (hour >= 12 && hour < 20) {
        return 1;
    } else {
        return 2; // 20-23 or 0-3
    }
}

// Create simple reverb impulse response
function createReverbImpulse(duration, decay, sampleRate) {
    const length = sampleRate * duration;
    const impulse = audioContext.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            const n = length - i;
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
        }
    }
    
    return impulse;
}

// Initialize Web Audio API
function initAudioContext() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create effects chain
        masterGain = audioContext.createGain();
        masterGain.gain.value = 1.0;
        
        // Low pass filter (very subtle)
        lowPassFilter = audioContext.createBiquadFilter();
        lowPassFilter.type = 'lowpass';
        lowPassFilter.Q.value = 1;
        
        // Reverb (very subtle)
        const impulse = createReverbImpulse(0.3, 2, audioContext.sampleRate);
        reverbConvolver = audioContext.createConvolver();
        reverbConvolver.buffer = impulse;
        
        // Dry/wet mix for reverb
        dryGain = audioContext.createGain();
        reverbGain = audioContext.createGain();
        
        // Connect: source -> lowpass -> split to dry/reverb -> master -> destination
        lowPassFilter.connect(dryGain);
        lowPassFilter.connect(reverbConvolver);
        reverbConvolver.connect(reverbGain);
        dryGain.connect(masterGain);
        reverbGain.connect(masterGain);
        masterGain.connect(audioContext.destination);
        
        // Initialize with current time
        updateEffects();
        
    } catch (e) {
        console.error('Web Audio API not supported', e);
        return false;
    }
    return true;
}

// Update effects based on time of day
function updateEffects() {
    if (!audioContext || !lowPassFilter || !dryGain || !reverbGain) return;
    
    const hour = new Date().getHours();
    
    // Low pass filter: 6am (min) to 6pm (max)
    // Very subtle: 19500Hz at 6am to 20000Hz at 6pm
    let filterProgress;
    if (hour >= 6 && hour < 18) {
        // 6am to 6pm: increasing
        filterProgress = (hour - 6) / 12; // 0 to 1
    } else {
        // 6pm to 6am: decreasing
        filterProgress = hour < 6 ? 1 - ((hour + 6) / 12) : 1 - ((hour - 18) / 12);
    }
    const filterCutoff = 19500 + (filterProgress * 500); // 19500 to 20000
    lowPassFilter.frequency.value = filterCutoff;
    
    // Reverb: 6pm (min) to 6am (max)
    // Very subtle: 0% wet at 6pm to 8% wet at 6am
    let reverbProgress;
    if (hour >= 18 || hour < 6) {
        // 6pm to 6am: increasing
        reverbProgress = hour >= 18 ? ((hour - 18) / 12) : ((hour + 6) / 12);
    } else {
        // 6am to 6pm: decreasing
        reverbProgress = 1 - ((hour - 6) / 12);
    }
    const reverbWet = reverbProgress * 0.08; // 0 to 0.08 (8%)
    
    // Set dry/wet mix
    dryGain.gain.value = 1.0 - reverbWet;
    reverbGain.gain.value = reverbWet;
}

// Load audio file as buffer
async function loadAudioBuffer(url) {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
    } catch (err) {
        console.error('Error loading audio:', url, err);
        return null;
    }
}

// Preload audio files as buffers
async function preloadAudio() {
    if (!initAudioContext()) {
        audioReady = true; // Continue without audio
        return;
    }
    
    const promises = [];
    
    for (const instrument of ['bass', 'snare', 'hihat']) {
        for (let soundIndex = 0; soundIndex < audioFiles[instrument].length; soundIndex++) {
            const file = audioFiles[instrument][soundIndex];
            const promise = loadAudioBuffer(file).then(buffer => {
                audioBuffers[instrument][soundIndex] = buffer;
            });
            promises.push(promise);
        }
    }
    
    try {
        await Promise.all(promises);
        audioReady = true;
        console.log('All audio files loaded');
    } catch (err) {
        console.warn('Some audio files failed to load:', err);
        audioReady = true; // Continue anyway
    }
}

// Schedule sound to play at a specific time
function scheduleSound(instrument, stepIndex, time) {
    if (!audioContext || !audioReady) return;
    if (!currentPatterns[instrument] || !currentPatterns[instrument][stepIndex]) {
        return; // Step is not active
    }
    
    const hour = new Date().getHours();
    const soundIndex = getSoundIndex(hour);
    const buffer = audioBuffers[instrument][soundIndex];
    
    if (!buffer) return;
    
    // Create buffer source and route through effects chain
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(lowPassFilter); // Route through effects chain
    source.start(time);
}

// Update clock display
function updateClock() {
    const clockElement = document.getElementById('clock');
    const now = new Date();
    const timeString = formatTime(now);
    
    // Create layered structure: each character gets a dark grey "8" behind it
    // (8 shows all segments in a 7-segment display)
    clockElement.innerHTML = timeString.split('').map(char => {
        if (char === ':') {
            return '<span class="digit"><span class="digit-shadow">:</span><span class="digit-foreground">:</span></span>';
        }
        return `<span class="digit"><span class="digit-shadow">8</span><span class="digit-foreground">${char}</span></span>`;
    }).join('');
}

// Update all patterns based on current time
function updatePatterns() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    
    // Get density range based on hour (affects all instruments)
    const [minHits, maxHits] = getDensityRange(hour);
    
    // Generate patterns
    // Hour seeds bass drum
    const bassPattern = generatePattern(hour, minHits, maxHits);
    
    // Minute seeds snare (within hour's density range)
    const snarePattern = generatePattern(minute, minHits, maxHits);
    
    // Hi-hat: use gradual mutation if pattern exists and hour hasn't changed
    let hihatPattern;
    if (previousHihatPattern !== null && previousHour === hour) {
        // Mutate previous pattern gradually
        hihatPattern = mutatePattern(previousHihatPattern, second);
    } else {
        // Generate new pattern (first run or hour changed)
        hihatPattern = generatePattern(second, minHits, maxHits);
    }
    
    // Store current state for next iteration
    previousHihatPattern = hihatPattern;
    previousHour = hour;
    
    // Store patterns for playback
    currentPatterns.bass = bassPattern;
    currentPatterns.snare = snarePattern;
    currentPatterns.hihat = hihatPattern;
    
    // Apply patterns to DOM
    applyPattern('bass-row', bassPattern);
    applyPattern('snare-row', snarePattern);
    applyPattern('hihat-row', hihatPattern);
}

// Calculate tempo based on hour (150 BPM at midnight, 90 BPM at noon)
function getTempo(hour) {
    // Use cosine curve: 150 at hour 0, 90 at hour 12
    // BPM = 120 + 30 * cos(hour * π / 12)
    const bpm = 120 + 30 * Math.cos(hour * Math.PI / 12);
    return bpm;
}

// Convert BPM to milliseconds per step (16 steps per bar)
function bpmToStepInterval(bpm) {
    // 16 steps = 1 bar
    // 1 bar = 4 beats at the given BPM
    // So: (60 seconds / BPM) * 4 beats = seconds per bar
    // Then divide by 16 steps
    const secondsPerBar = (60 / bpm) * 4;
    const secondsPerStep = secondsPerBar / 16;
    return secondsPerStep * 1000; // Convert to milliseconds
}

// Apply pattern to a row
function applyPattern(rowId, pattern) {
    const row = document.getElementById(rowId);
    const steps = row.querySelectorAll('.step');
    steps.forEach((step, index) => {
        if (pattern[index]) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
}

// Cache step elements for faster updates
let stepElements = null;

function cacheStepElements() {
    if (stepElements) return;
    stepElements = {
        bass: Array.from(document.querySelectorAll('#bass-row .step')),
        snare: Array.from(document.querySelectorAll('#snare-row .step')),
        hihat: Array.from(document.querySelectorAll('#hihat-row .step'))
    };
}

// Update playhead visualization
let lastPlayingStep = -1;

function updatePlayheadStep(step) {
    if (!stepElements) cacheStepElements();
    if (!isPlaying) {
        if (lastPlayingStep >= 0) {
            stepElements.bass[lastPlayingStep]?.classList.remove('playing');
            stepElements.snare[lastPlayingStep]?.classList.remove('playing');
            stepElements.hihat[lastPlayingStep]?.classList.remove('playing');
            lastPlayingStep = -1;
        }
        return;
    }
    
    // Update visual if step changed
    if (lastPlayingStep !== step) {
        if (lastPlayingStep >= 0) {
            stepElements.bass[lastPlayingStep]?.classList.remove('playing');
            stepElements.snare[lastPlayingStep]?.classList.remove('playing');
            stepElements.hihat[lastPlayingStep]?.classList.remove('playing');
        }
        
        if (stepElements.bass[step]) {
            stepElements.bass[step].classList.add('playing');
            stepElements.snare[step].classList.add('playing');
            stepElements.hihat[step].classList.add('playing');
        }
        
        lastPlayingStep = step;
    }
}

// Legacy function for compatibility
function updatePlayhead() {
    // Not used with new scheduler
}

// Scheduler - schedules notes ahead of time
function scheduler() {
    if (!isPlaying) return;
    
    const currentTime = audioContext.currentTime;
    const hour = new Date().getHours();
    const bpm = getTempo(hour);
    const stepInterval = bpmToStepInterval(bpm) / 1000; // Convert to seconds
    
    // Calculate which step should be visible now
    const elapsed = currentTime - startTime;
    const visualStep = Math.floor((elapsed / stepInterval) % 16);
    
    // Update visual
    updatePlayheadStep(visualStep);
    
    // Schedule notes while we're ahead of the current time
    while (nextNoteTime < currentTime + scheduleAheadTime) {
        // Schedule sounds for this step
        scheduleSound('bass', currentStep, nextNoteTime);
        scheduleSound('snare', currentStep, nextNoteTime);
        scheduleSound('hihat', currentStep, nextNoteTime);
        
        // Advance to next step
        currentStep = (currentStep + 1) % 16;
        nextNoteTime += stepInterval;
    }
}

// Start playback
function startPlayback() {
    if (isPlaying) return;
    if (!audioReady) {
        console.warn('Audio not ready yet');
        return;
    }
    
    // Resume audio context if suspended (required for autoplay policies)
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    isPlaying = true;
    currentStep = 0;
    
    // Initialize timing
    startTime = audioContext.currentTime;
    const hour = new Date().getHours();
    const bpm = getTempo(hour);
    const stepInterval = bpmToStepInterval(bpm) / 1000;
    nextNoteTime = startTime + 0.1; // Start 100ms from now
    
    // Schedule first step
    scheduleSound('bass', 0, nextNoteTime);
    scheduleSound('snare', 0, nextNoteTime);
    scheduleSound('hihat', 0, nextNoteTime);
    
    currentStep = 1;
    nextNoteTime += stepInterval;
    
    // Start scheduler
    if (scheduleInterval) {
        clearInterval(scheduleInterval);
    }
    scheduleInterval = setInterval(scheduler, lookahead);
    
    document.getElementById('play-pause-btn').textContent = 'Pause';
}

// Stop playback
function stopPlayback() {
    if (!isPlaying) return;
    
    isPlaying = false;
    if (scheduleInterval) {
        clearInterval(scheduleInterval);
        scheduleInterval = null;
    }
    
    // Remove playing class from all steps
    if (stepElements) {
        stepElements.bass.forEach(s => s.classList.remove('playing'));
        stepElements.snare.forEach(s => s.classList.remove('playing'));
        stepElements.hihat.forEach(s => s.classList.remove('playing'));
    } else {
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('playing');
        });
    }
    
    lastPlayingStep = -1;
    currentStep = 0;
    nextNoteTime = 0.0;
    
    document.getElementById('play-pause-btn').textContent = 'Play';
}

// Toggle play/pause
function togglePlayback() {
    if (isPlaying) {
        stopPlayback();
    } else {
        startPlayback();
    }
}

// Initialize and update every second
function init() {
    // Cache step elements for faster updates
    cacheStepElements();
    
    // Preload audio files and wait for them to be ready
    preloadAudio().then(() => {
        console.log('Audio files loaded');
    }).catch(err => {
        console.warn('Some audio files failed to load:', err);
    });
    
    updateClock();
    updatePatterns();
    
    // Set up play/pause button
    document.getElementById('play-pause-btn').addEventListener('click', togglePlayback);
    
    // Set up help button and modal
    const helpBtn = document.getElementById('help-btn');
    const modal = document.getElementById('modal');
    const modalClose = document.getElementById('modal-close');
    
    helpBtn.addEventListener('click', () => {
        modal.classList.add('active');
    });
    
    modalClose.addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
    
    setInterval(() => {
        updateClock();
        updatePatterns();
        updateEffects(); // Update effects based on time
    }, 1000);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

