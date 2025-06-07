// Constants
const USGS_FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const UPDATE_INTERVAL = 60000; // 1 minute
const STEPS_IN_DAY = 24; // 24 steps for each hour of the day
const MINUTES_PER_STEP = 60; // 60 minutes (1 hour) per step
const STEPS_PER_BEAT = 2; // Each beat spans 2 sequence steps
let MIN_MAGNITUDE = 2.5;

const INSTRUMENTS = ['kick', 'snare', 'hihat', 'cymbal', 'clap', 'boom', 'tom', 'tink', 'ride'];

// Audio elements
const audioElements = {
    kick: document.getElementById('kick'),
    snare: document.getElementById('snare'),
    hihat: document.getElementById('hihat'),
    cymbal: document.getElementById('cymbal')
};

// Create audio pools for overlapping sounds
const audioPool = {};
const POOL_SIZE = 3;

// Initialize Web Audio API
let audioContext;
const buffers = {};

// Seismograph variables
let continentAnalyzers = {};
let seismographCanvases = {};
let seismographCtxs = {};
let dataArrays = {};
let bufferLength;
let seismographData = {};
let continentActivity = {};
let animationId;
const SEISMOGRAPH_HISTORY = 100; // Reduced to match our display needs
const CONTINENTS = ['americas', 'europe', 'asia', 'africa', 'oceania'];
const GRID_CELL_WIDTH = 16; // Matches the CSS grid size
const SCROLL_SPEED = GRID_CELL_WIDTH / 2; // One grid cell scrolls every 2 seconds

// Global map variables
let mapProjection;
let mapWidth;
let mapHeight;

// Load and decode audio files
async function loadAudioFile(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

// Initialize audio system
async function initAudioSystem() {
    console.log('Initializing audio system...');
    
    try {
        // Create audio context on first user interaction
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('AudioContext created:', audioContext.state);
        }
        
        // Create analyzers for each continent
        CONTINENTS.forEach(continent => {
            continentAnalyzers[continent] = audioContext.createAnalyser();
            continentAnalyzers[continent].fftSize = 256;
            continentAnalyzers[continent].connect(audioContext.destination);
            dataArrays[continent] = new Uint8Array(continentAnalyzers[continent].frequencyBinCount);
        });
        
        bufferLength = continentAnalyzers[CONTINENTS[0]].frequencyBinCount;
        
        // Initialize seismograph
        initSeismograph();
        
        // Load all audio files
        const audioFiles = {
            kick: 'kick.wav',
            snare: 'snare.wav',
            hihat: 'hihat.wav',
            cymbal: 'cymbal.wav',
            clap: 'clap.wav',
            boom: 'boom.wav',
            tom: 'tom.wav',
            tink: 'tink.wav',
            ride: 'ride.wav'
        };
        
        // Load each audio file with better error handling
        for (const [key, file] of Object.entries(audioFiles)) {
            try {
                const response = await fetch(file);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                buffers[key] = await audioContext.decodeAudioData(arrayBuffer);
                console.log(`Successfully loaded audio buffer for ${key}`);
            } catch (err) {
                console.error(`Failed to load ${file}:`, err);
                // Try loading from the audio element as fallback
                const audioElement = document.getElementById(key);
                if (audioElement) {
                    try {
                        const response = await fetch(audioElement.src);
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        const arrayBuffer = await response.arrayBuffer();
                        buffers[key] = await audioContext.decodeAudioData(arrayBuffer);
                        console.log(`Successfully loaded audio buffer for ${key} from audio element`);
                    } catch (fallbackErr) {
                        console.error(`Failed to load ${key} from audio element:`, fallbackErr);
                    }
                }
            }
        }
        
        // Verify audio initialization
        const loadedSounds = Object.keys(buffers);
        console.log('Loaded audio buffers:', loadedSounds);
        if (loadedSounds.length === 0) {
            throw new Error('No audio buffers were loaded successfully');
        }
        
    } catch (error) {
        console.error('Audio system initialization failed:', error);
        throw error;
    }
}

// Play a sound at a specific time
function playSound(type, time, subdivision = 0, totalSubdivisions = 1, quake = null) {
    if (!buffers[type]) {
        console.error(`No buffer loaded for ${type}`);
        return;
    }
    
    const source = audioContext.createBufferSource();
    source.buffer = buffers[type];
    
    const gainNode = audioContext.createGain();
    
    // Set volume based on earthquake magnitude if available
    if (quake) {
        const magnitude = quake.properties.mag;
        // More dramatic volume scaling:
        // - Magnitude 2.5 -> volume 0.1 (very quiet)
        // - Magnitude 4.0 -> volume 0.4 (moderate)
        // - Magnitude 6.0 -> volume 0.8 (loud)
        // - Magnitude 8.0+ -> volume 1.0 (maximum)
        const normalizedMag = (magnitude - 2.5) / 5.5; // Scale from 2.5-8.0 to 0-1
        const volume = Math.min(1.0, Math.max(0.1, normalizedMag));
        gainNode.gain.value = volume;
    } else {
        gainNode.gain.value = 0.4; // Lower default volume to make magnitude differences more noticeable
    }
    
    // Find which continent this sound belongs to
    let soundContinent = null;
    for (const [continent, instrument] of Object.entries(drumMappings)) {
        if (instrument === type) {
            soundContinent = continent;
            break;
        }
    }
    
    // Connect to the appropriate analyzer
    if (soundContinent && continentAnalyzers[soundContinent]) {
        source.connect(gainNode);
        gainNode.connect(continentAnalyzers[soundContinent]);
    } else {
        // Fallback to connecting to all analyzers if we can't determine the continent
        source.connect(gainNode);
        Object.values(continentAnalyzers).forEach(analyzer => {
            gainNode.connect(analyzer);
        });
    }
    
    // Simple animation for map marker when played
    if (quake) {
        const [longitude, latitude] = quake.geometry.coordinates;
        const marker = document.querySelector(`.earthquake-marker[data-longitude="${longitude}"][data-latitude="${latitude}"]`);
        
        if (marker) {
            const magnitude = quake.properties.mag;
            const finalSize = Math.round(magnitude * 5);
            const stepDuration = 30 / tempo;
            const subdivisionDuration = stepDuration / totalSubdivisions;
            const startTime = time + (subdivisionDuration * subdivision);
            
            setTimeout(() => {
                marker.style.width = '5px';
                marker.style.height = '5px';
                marker.style.backgroundColor = '#000000';
                marker.style.opacity = '1';
                marker.style.transform = 'translate(-50%, -50%)';
                marker.style.transition = `width ${subdivisionDuration}s ease-out, height ${subdivisionDuration}s ease-out, transform 1.5s ease-out`;
            }, (startTime - audioContext.currentTime) * 1000);
            
            setTimeout(() => {
                marker.style.width = `${finalSize}px`;
                marker.style.height = `${finalSize}px`;
                marker.style.transform = 'translate(-50%, -50%) scale(1.5)';
            }, (startTime - audioContext.currentTime + 0.01) * 1000);
            
            setTimeout(() => {
                marker.style.opacity = '0';
                marker.style.transform = 'translate(-50%, -50%) scale(1.0)';
            }, (startTime - audioContext.currentTime + subdivisionDuration) * 1000);
        }
    }
    
    source.start(time);
    console.log(`${type} scheduled at ${time.toFixed(3)}s with volume ${gainNode.gain.value.toFixed(2)}`);
}

// UI elements
const playButton = document.getElementById('playButton');
const playIcon = playButton.querySelector('.play-icon');
const playText = playButton.querySelector('.play-text');
const tempoSlider = document.getElementById('tempoSlider');
const tempoValue = document.getElementById('tempoValue');
const dateSelector = document.getElementById('dateSelector');
const earthquakeCountElement = document.getElementById('earthquakeCount');
const currentEarthquakeElement = document.getElementById('currentEarthquake');
const minMagnitudeValue = document.getElementById('minMagnitudeValue');
const increaseMagnitudeBtn = document.getElementById('increaseMagnitude');
const decreaseMagnitudeBtn = document.getElementById('decreaseMagnitude');

// State
let isPlaying = false;
let earthquakeData = [];
let currentStep = -1;
let sequencerInterval;
let tempo = 120;

// Continental regions (rough longitude boundaries)
const continentalRegions = {
    americas: { min: -180, max: -30 },  // -180° to -30° (includes all of North and South America)
    europe: { min: -30, max: 40 },      // -30° to 40° (includes Europe and Africa)
    asia: { min: 40, max: 150 },        // 40° to 150° (includes Asia)
    oceania: { min: 150, max: 180 },    // 150° to 180° (includes Oceania)
    africa: { min: -20, max: 40 }       // -20° to 40° (overlaps with Europe intentionally)
};

// Update drum mappings to match new defaults
let drumMappings = {
    americas: 'hihat',
    europe: 'cymbal',
    asia: 'boom',
    africa: 'snare',
    oceania: 'tink'
};

// Event Listeners
function setupEventListeners() {
    playButton.addEventListener('click', togglePlay);
    tempoSlider.addEventListener('input', updateTempo);
    dateSelector.addEventListener('change', handleDateChange);
    
    // Add date navigation listeners
    document.getElementById('prevDate').addEventListener('click', () => {
        const currentDate = new Date(dateSelector.value);
        currentDate.setDate(currentDate.getDate() - 1);
        dateSelector.value = currentDate.toISOString().split('T')[0];
        handleDateChange();
    });
    
    document.getElementById('nextDate').addEventListener('click', () => {
        const currentDate = new Date(dateSelector.value);
        currentDate.setDate(currentDate.getDate() + 1);
        dateSelector.value = currentDate.toISOString().split('T')[0];
        handleDateChange();
    });
    
    // Add magnitude control listeners
    increaseMagnitudeBtn.addEventListener('click', () => {
        const newValue = Math.round((parseFloat(minMagnitudeValue.value) + 0.1) * 10) / 10;
        minMagnitudeValue.value = Math.min(10, newValue).toFixed(1);
        MIN_MAGNITUDE = parseFloat(minMagnitudeValue.value);
        fetchEarthquakeData();
    });
    
    decreaseMagnitudeBtn.addEventListener('click', () => {
        const newValue = Math.round((parseFloat(minMagnitudeValue.value) - 0.1) * 10) / 10;
        minMagnitudeValue.value = Math.max(0, newValue).toFixed(1);
        MIN_MAGNITUDE = parseFloat(minMagnitudeValue.value);
        fetchEarthquakeData();
    });
    
    // Add direct input listener
    minMagnitudeValue.addEventListener('change', () => {
        let value = parseFloat(minMagnitudeValue.value);
        value = Math.max(0, Math.min(10, value)); // Clamp between 0 and 10
        value = Math.round(value * 10) / 10; // Round to 1 decimal place
        minMagnitudeValue.value = value.toFixed(1);
        MIN_MAGNITUDE = value;
        fetchEarthquakeData();
    });
    
    // Setup continental instrument select listeners
    document.querySelectorAll('.instrument-select').forEach(select => {
        // Set initial values first
        const continent = select.dataset.continent;
        if (drumMappings[continent]) {
            select.value = drumMappings[continent];
        }
        
        // Add change event listener
        select.addEventListener('change', (e) => {
            const continent = e.target.dataset.continent;
            const newInstrument = e.target.value;
            drumMappings[continent] = newInstrument;
            
            // Test the new instrument sound
            if (audioContext && buffers[newInstrument]) {
                playSound(newInstrument, audioContext.currentTime);
            }
            
            console.log(`Changed ${continent} instrument to ${newInstrument}`);
        });
    });
    
    // Setup step cell hover listeners (will be added after sequencer creation)
    setupStepCellHoverListeners();
}

// Play Controls
function togglePlay() {
    if (!isPlaying) {
        // Start playback
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        playIcon.textContent = '⏸';
        playText.textContent = '';
        
        // Hide all markers when starting playback
        document.querySelectorAll('.earthquake-marker').forEach(marker => {
            marker.style.backgroundColor = 'transparent';
            marker.style.opacity = '0';
        });
        
        startPlayback();
        isPlaying = true;
    } else {
        // Stop playback
        playIcon.textContent = '▶';
        playText.textContent = '';
        stopPlayback();
        
        // Show all markers with solid black when paused
        document.querySelectorAll('.earthquake-marker').forEach(marker => {
            marker.style.backgroundColor = '#000000';
            marker.style.opacity = '1';
        });
        
        isPlaying = false;
    }
}

// Set default date to 3 days ago to ensure we have data
function setDefaultDate() {
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - (3 * 24 * 60 * 60 * 1000));
    const dateString = threeDaysAgo.toISOString().split('T')[0];
    dateSelector.value = dateString;
}

// Initialize
async function init() {
    console.log('Initializing drum machine...');
    
    try {
        // Set default date first
        setDefaultDate();
        
        // Initialize audio system first
        await initAudioSystem();
        
        setupEventListeners();
        createContinentSequencer();
        await fetchEarthquakeData();
        setupMap();
        
        // Start seismograph animation immediately
        startSeismographAnimation();
        
        // Log initial state
        console.log('Initial drum mappings:', drumMappings);
        console.log('Number of earthquakes loaded:', earthquakeData.length);
        
        // Analyze earthquake distribution
        const regionCounts = {};
        earthquakeData.forEach(quake => {
            const [longitude, latitude] = quake.geometry.coordinates;
            const region = getRegionFromLongitude(longitude, latitude);
            regionCounts[region] = (regionCounts[region] || 0) + 1;
        });
        console.log('Earthquake distribution by region:', regionCounts);
        
        console.log('Drum machine initialized successfully!');
    } catch (error) {
        console.error('Failed to initialize drum machine:', error);
    }
}

function setupStepCellHoverListeners() {
    // Add hover listeners to earthquake beats
    document.querySelectorAll('.earthquake-beat').forEach(beat => {
        beat.addEventListener('mouseenter', () => {
            // Highlight the beat
            beat.style.backgroundColor = '#00ff00';
            
            // Find and highlight corresponding map marker
            const marker = document.querySelector(`.earthquake-marker[data-longitude="${beat.dataset.longitude}"][data-latitude="${beat.dataset.latitude}"]`);
            if (marker) {
                marker.classList.add('highlighted');
                marker.style.backgroundColor = '#00ff00';
                
                // Show marker tooltip
                const tooltip = document.createElement('div');
                tooltip.className = 'custom-tooltip';
                tooltip.textContent = `${beat.dataset.latitude}°, ${beat.dataset.longitude}°\n${beat.dataset.place}`;
                marker.appendChild(tooltip);
            }

            // Show sequencer tooltip
            const quake = earthquakeData.find(q => 
                q.geometry.coordinates[0] === parseFloat(beat.dataset.longitude) && 
                q.geometry.coordinates[1] === parseFloat(beat.dataset.latitude)
            );
            if (quake) {
                const time = new Date(quake.properties.time);
                const hours = time.getUTCHours().toString().padStart(2, '0');
                const minutes = time.getUTCMinutes().toString().padStart(2, '0');
                
                const cellTooltip = document.createElement('div');
                cellTooltip.className = 'custom-tooltip';
                cellTooltip.innerHTML = `<span style="color: #00ff00;">M${quake.properties.mag.toFixed(1)}</span> ${hours}:${minutes} UTC`;
                
                // Add tooltip to the parent cell or subdivision
                const container = beat.closest('.step-cell') || beat.closest('.subdivision-element');
                if (container) {
                    container.appendChild(cellTooltip);
                }
            }
        });
        
        beat.addEventListener('mouseleave', () => {
            // Reset beat highlight
            beat.style.backgroundColor = 'transparent';
            
            // Reset map marker
            const marker = document.querySelector(`.earthquake-marker[data-longitude="${beat.dataset.longitude}"][data-latitude="${beat.dataset.latitude}"]`);
            if (marker) {
                marker.classList.remove('highlighted');
                marker.style.backgroundColor = isPlaying ? 'transparent' : '#000000';
                
                // Remove marker tooltip
                const tooltip = marker.querySelector('.custom-tooltip');
                if (tooltip) {
                    tooltip.remove();
                }
            }

            // Remove sequencer tooltip
            const container = beat.closest('.step-cell') || beat.closest('.subdivision-element');
            if (container) {
                const tooltip = container.querySelector('.custom-tooltip');
                if (tooltip) {
                    tooltip.remove();
                }
            }
        });
    });
}

function highlightMatchingEarthquakes(step, continent) {
    // Find earthquakes that match this time slot and region
    const matchingQuakes = earthquakeData.filter(quake => {
        const quakeTime = new Date(quake.properties.time);
        const quakeHour = quakeTime.getUTCHours();
        const [longitude, latitude] = quake.geometry.coordinates;
        const region = getRegionFromLongitude(longitude, latitude);
        
        return quakeHour === step && region === continent;
    });
    
    // Highlight matching earthquake markers and show their tooltips
    matchingQuakes.forEach(quake => {
        const [longitude, latitude] = quake.geometry.coordinates;
        const marker = document.querySelector(`.earthquake-marker[data-longitude="${longitude}"][data-latitude="${latitude}"]`);
        
        if (marker) {
            marker.classList.add('highlighted');
            marker.style.backgroundColor = '#00ff00';
            
            // Show map tooltip using the same format as direct hover
            const tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            tooltip.style.position = 'absolute';
            tooltip.style.bottom = '120%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translateX(-50%)';
            tooltip.style.background = '#000000';
            tooltip.style.color = '#ffffff';
            tooltip.style.padding = '4px 8px';
            tooltip.style.fontSize = '10px';
            tooltip.style.fontFamily = 'monospace';
            tooltip.style.whiteSpace = 'pre';
            tooltip.style.borderRadius = '2px';
            tooltip.style.zIndex = '1001';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            
            tooltip.textContent = `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°\n${quake.properties.place}`;
            marker.appendChild(tooltip);
        }
    });
}

function clearEarthquakeHighlights() {
    document.querySelectorAll('.earthquake-marker.highlighted').forEach(marker => {
        marker.classList.remove('highlighted');
        marker.style.backgroundColor = isPlaying ? 'transparent' : '#000000';
        
        // Hide custom tooltip
        hideCustomTooltip(marker);
    });
}

function showCustomTooltip(marker, quake) {
    // Remove any existing tooltip
    hideCustomTooltip(marker);
    
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    
    // Format coordinates to 2 decimal places and get magnitude
    const [longitude, latitude] = quake.geometry.coordinates;
    const magnitude = quake.properties.mag;
    
    tooltip.style.position = 'absolute';
    tooltip.style.bottom = '120%';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.style.background = '#000000';
    tooltip.style.color = '#ffffff';
    tooltip.style.padding = '4px 8px';
    tooltip.style.fontSize = '10px';
    tooltip.style.fontFamily = 'monospace';
    tooltip.style.whiteSpace = 'pre';
    tooltip.style.borderRadius = '2px';
    tooltip.style.zIndex = '1001';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    
    tooltip.textContent = `M${magnitude.toFixed(1)}\n${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
    
    marker.appendChild(tooltip);
}

function hideCustomTooltip(marker) {
    const tooltip = marker.querySelector('.custom-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// Seismograph Functions
function initSeismograph() {
    seismographCanvases = {};
    seismographCtxs = {};
    
    CONTINENTS.forEach(continent => {
        // Initialize with a straight line
        seismographData[continent] = new Array(SEISMOGRAPH_HISTORY).fill(0);
        continentActivity[continent] = 0;
        
        // Setup canvas
        seismographCanvases[continent] = document.getElementById(`seismograph-${continent}`);
        if (!seismographCanvases[continent]) return;
        
        seismographCtxs[continent] = seismographCanvases[continent].getContext('2d');
        
        // Set canvas size to match display size
        const rect = seismographCanvases[continent].getBoundingClientRect();
        seismographCanvases[continent].width = rect.width;
        seismographCanvases[continent].height = rect.height;
    });
}

function startSeismographAnimation() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    let lastUpdate = 0;
    const updateInterval = 1000 / 30; // Update at 30fps to match smooth animation
    
    function animate(timestamp) {
        if (timestamp - lastUpdate >= updateInterval) {
            updateAllSeismographData();
            drawAllSeismographs();
            lastUpdate = timestamp;
        }
        animationId = requestAnimationFrame(animate);
    }
    
    animate(0);
}

function updateAllSeismographData() {
    CONTINENTS.forEach(continent => {
        if (!continentAnalyzers[continent]) return;
        
        // Get frequency data when playing
        if (isPlaying) {
        continentAnalyzers[continent].getByteFrequencyData(dataArrays[continent]);
        
            // Calculate current amplitude
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArrays[continent][i];
        }
        const average = sum / bufferLength;
            const activity = (average / 255) * 0.8; // Scale down to prevent cutoff
            
            // Add new value with some decay of the previous value
            const lastValue = seismographData[continent][0] || 0;
            const newValue = Math.max(activity, lastValue * 0.85);
        
            // Shift existing data right
            seismographData[continent].pop();
            seismographData[continent].unshift(newValue);
        } else {
            // When not playing, create subtle background noise
            const noise = Math.random() * 0.03; // Very small random movement
            const lastValue = seismographData[continent][0] || 0;
            const newValue = Math.max(0, Math.min(0.1, lastValue * 0.95 + noise));
            
            // Shift existing data right
            seismographData[continent].pop();
            seismographData[continent].unshift(newValue);
        }
    });
}

function drawAllSeismographs() {
    CONTINENTS.forEach(continent => {
        drawSeismograph(continent);
    });
    
    // Update main status indicator
    const statusIndicator = document.getElementById('seismicStatus');
    if (statusIndicator) {
        const hasActivity = CONTINENTS.some(continent => 
            seismographData[continent] && 
            seismographData[continent][seismographData[continent].length - 1] !== 0
        );
        statusIndicator.style.color = hasActivity ? '#00ff00' : '#000000';
    }
}

function drawSeismograph(continent) {
    if (!seismographCtxs[continent]) return;
    
    const ctx = seismographCtxs[continent];
    const width = seismographCanvases[continent].width;
    const height = seismographCanvases[continent].height;
    
    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Draw the waveform
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    
    // Disable anti-aliasing for crisp lines
    ctx.imageSmoothingEnabled = false;
    
    ctx.beginPath();
    
    const pointSpacing = width / (SEISMOGRAPH_HISTORY - 1);
    
    // Start at the bottom of the first point
    ctx.moveTo(0, height);
    
    // Draw each point (left to right)
    seismographData[continent].forEach((value, index) => {
        const x = Math.round(index * pointSpacing); // Round to nearest pixel
        const y = Math.round(height - (value * height)); // Round to nearest pixel
        ctx.lineTo(x, y);
    });
    
    // Draw the line
    ctx.stroke();
}

// Function to trigger continent-specific seismic activity
function triggerContinentActivity(continent, intensity = 1.0) {
    if (!seismographData[continent]) return;
    
    // Scale intensity for better visibility but prevent cutoff
    const scaledIntensity = Math.min(intensity * 1.5, 0.8);
    
    // Add a burst of activity at the start of the array (left side)
    seismographData[continent][0] = scaledIntensity;
}

function updateTempo() {
    tempo = parseInt(tempoSlider.value);
    tempoValue.textContent = tempo;
    
    if (isPlaying) {
        stopPlayback();
        startPlayback();
    }
}

// Sequencer Grid - Rebuilt for continent-first approach
function createContinentSequencer() {
    const continents = ['americas', 'europe', 'asia', 'africa', 'oceania'];
    
    continents.forEach(continent => {
        const trackSteps = document.querySelector(`.track-steps[data-continent="${continent}"]`);
        if (!trackSteps) return;
        
        // Clear existing cells
        trackSteps.innerHTML = '';
        
        // Create 24 step cells for each hour
        for (let step = 0; step < STEPS_IN_DAY; step++) {
            const cell = document.createElement('div');
            cell.className = 'step-cell';
            cell.dataset.step = step;
            cell.dataset.continent = continent;
            
            trackSteps.appendChild(cell);
        }
    });
    
    // Setup hover listeners after cells are created
    setupStepCellHoverListeners();
}

function updateContinentSequencer() {
    // Store current playing states before clearing
    const playingStates = new Map();
    document.querySelectorAll('.step-cell').forEach(cell => {
        const key = `${cell.dataset.continent}-${cell.dataset.step}`;
        playingStates.set(key, cell.classList.contains('playing'));
    });
    
    // Group earthquakes by continent and hour
    const continentHourData = {};
    ['americas', 'europe', 'asia', 'africa', 'oceania'].forEach(continent => {
        continentHourData[continent] = new Array(STEPS_IN_DAY).fill(0);
    });

    earthquakeData.forEach(quake => {
        const time = new Date(quake.properties.time);
        const hour = time.getUTCHours();
        const [longitude, latitude] = quake.geometry.coordinates;
        const region = getRegionFromLongitude(longitude, latitude);
        
        if (continentHourData[region]) {
            continentHourData[region][hour]++;
        }
    });
    
    // Update step cells with earthquake counts and restore playing states
    Object.entries(continentHourData).forEach(([continent, hourCounts]) => {
        hourCounts.forEach((count, hour) => {
            const cell = document.querySelector(`.track-steps[data-continent="${continent}"] .step-cell[data-step="${hour}"]`);
            if (cell) {
                // Clear existing content
                cell.innerHTML = '';
                
                if (count > 0) {
                    cell.classList.add('has-earthquake');
                    
                    // Get earthquakes for this hour and continent
                    const hourQuakes = earthquakeData.filter(quake => {
                        const quakeTime = new Date(quake.properties.time);
                        const quakeHour = quakeTime.getUTCHours();
                        const [longitude, latitude] = quake.geometry.coordinates;
                        const region = getRegionFromLongitude(longitude, latitude);
                        return quakeHour === hour && region === continent;
                    });

                    if (count === 1) {
                        // Single earthquake - create one earthquake beat div
                        const quake = hourQuakes[0];
                        const beatDiv = document.createElement('div');
                        beatDiv.className = 'earthquake-beat';
                        beatDiv.dataset.longitude = quake.geometry.coordinates[0];
                        beatDiv.dataset.latitude = quake.geometry.coordinates[1];
                        beatDiv.dataset.place = quake.properties.place;
                        cell.appendChild(beatDiv);
                    } else {
                        // Multiple earthquakes - create subdivisions with earthquake beats
                        cell.dataset.subdivisions = count.toString();
                        hourQuakes.forEach((quake, i) => {
                            const subdivision = document.createElement('div');
                            subdivision.className = 'subdivision-element';
                            subdivision.dataset.subdivisionIndex = i.toString();
                            subdivision.style.position = 'absolute';
                            subdivision.style.left = `${(i / count) * 100}%`;
                            subdivision.style.top = '0';
                            subdivision.style.bottom = '0';
                            subdivision.style.width = `${100 / count}%`;
                            subdivision.style.backgroundColor = 'transparent';
                            subdivision.style.border = i > 0 ? '1px solid #ffffff' : 'none';
                            subdivision.style.borderTop = 'none';
                            subdivision.style.borderBottom = 'none';
                            subdivision.style.borderRight = 'none';
                            subdivision.style.pointerEvents = 'auto';
                            
                            // Create earthquake beat div inside subdivision
                            const beatDiv = document.createElement('div');
                            beatDiv.className = 'earthquake-beat';
                            beatDiv.dataset.longitude = quake.geometry.coordinates[0];
                            beatDiv.dataset.latitude = quake.geometry.coordinates[1];
                            beatDiv.dataset.place = quake.properties.place;
                            subdivision.appendChild(beatDiv);
                            
                            cell.appendChild(subdivision);
                        });
                    }
                } else {
                    cell.classList.remove('has-earthquake');
                    cell.dataset.subdivisions = '0';
                }
                
                // Restore playing state if it was playing before
                const key = `${continent}-${hour}`;
                if (playingStates.get(key)) {
                    cell.classList.add('playing');
                }
            }
        });
    });
    
    // Setup hover listeners after updating cells
    setupStepCellHoverListeners();
}

function playStep(step, time) {
    currentStep = step;
    
    // Clear all playing states and hide all markers
    document.querySelectorAll('.step-cell').forEach(cell => {
        cell.classList.remove('playing');
        // Clear subdivision highlights
        cell.querySelectorAll('.subdivision-element').forEach(sub => {
            sub.style.backgroundColor = 'transparent';
        });
    });
    
    // Hide all markers first
    document.querySelectorAll('.earthquake-marker').forEach(marker => {
        marker.style.opacity = '0';
        marker.style.transition = 'opacity 0.1s ease-out';
    });
    
    // Add playing class to current step cells (for sequence position)
    document.querySelectorAll(`.step-cell[data-step="${step}"]`).forEach(cell => {
        cell.classList.add('playing');
    });
    
    // Group earthquakes for this hour by continent
    const stepQuakes = {};
    ['americas', 'europe', 'asia', 'africa', 'oceania'].forEach(continent => {
        stepQuakes[continent] = [];
    });
    
    let allStepQuakes = [];
    
    earthquakeData.forEach(quake => {
        const quakeTime = new Date(quake.properties.time);
        const quakeHour = quakeTime.getUTCHours();
        
        if (quakeHour === step) {
            const [longitude, latitude] = quake.geometry.coordinates;
            const region = getRegionFromLongitude(longitude, latitude);
            
            if (stepQuakes[region]) {
                stepQuakes[region].push(quake);
                allStepQuakes.push(quake);
                
                // Show this quake's marker
                const marker = document.querySelector(`.earthquake-marker[data-longitude="${longitude}"][data-latitude="${latitude}"]`);
                if (marker) {
                    marker.style.opacity = '1';
                    marker.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                }
            }
        }
    });
    
    // Update current earthquake display
    updateCurrentEarthquakeDisplay(allStepQuakes, step);
    
    // Calculate step duration for subdivisions
    const stepDuration = 30 / tempo; // Same as in startPlayback
    
    // Play subdivided sounds for each continent and highlight subdivisions
    Object.entries(stepQuakes).forEach(([continent, quakes]) => {
        if (quakes.length === 0) return;
        
        const instrument = drumMappings[continent];
        if (!instrument || !buffers[instrument]) return;
        
        // Trigger seismic activity for this continent
        const intensity = Math.min(quakes.length / 3, 1.0);
        triggerContinentActivity(continent, intensity);
        
        // Get the step cell for this continent
        const cell = document.querySelector(`.track-steps[data-continent="${continent}"] .step-cell[data-step="${step}"]`);
        
        if (quakes.length === 1) {
            // Single earthquake - highlight entire cell with green
            if (cell) {
                cell.classList.add('playing');
                cell.style.backgroundColor = '#00ff00';
                cell.style.color = '#ffffff';
                
                // Clear highlight after a short duration
                setTimeout(() => {
                    cell.style.backgroundColor = '';
                    cell.style.color = '';
                }, 200);
            }
            playSound(instrument, time, 0, 1, quakes[0]);
        } else {
            // Multiple earthquakes - highlight individual subdivisions
            quakes.forEach((quake, index) => {
                const subdivisionOffset = (stepDuration * index) / quakes.length;
                const hitTime = time + subdivisionOffset;
                
                // Schedule subdivision highlight
                if (cell) {
                    const subdivision = cell.querySelector(`.subdivision-element[data-subdivision-index="${index}"]`);
                    if (subdivision) {
                        setTimeout(() => {
                            subdivision.style.backgroundColor = '#00ff00';
                            subdivision.style.color = '#ffffff';
                        }, (hitTime - audioContext.currentTime) * 1000);
                        
                        // Clear highlight after a short duration
                        setTimeout(() => {
                            subdivision.style.backgroundColor = 'transparent';
                            subdivision.style.color = 'inherit';
                        }, (hitTime - audioContext.currentTime + 0.2) * 1000);
                    }
                }
                
                playSound(instrument, hitTime, index, quakes.length, quake);
            });
        }
    });
}

function updateCurrentEarthquakeDisplay(quakes, step) {
    if (!currentEarthquakeElement) return;
    
    if (quakes.length === 0) {
        currentEarthquakeElement.innerHTML = `<p>Hour ${String(step).padStart(2, '0')}:00 - No seismic activity</p>`;
        currentEarthquakeElement.classList.remove('active');
    } else if (quakes.length === 1) {
        const quake = quakes[0];
        const time = new Date(quake.properties.time);
        currentEarthquakeElement.innerHTML = `
            <p><strong>Hour ${String(step).padStart(2, '0')}:00</strong> - 
            M${quake.properties.mag.toFixed(1)} at ${time.getUTCHours()}:${String(time.getUTCMinutes()).padStart(2, '0')} - 
            ${quake.properties.place}</p>
        `;
        currentEarthquakeElement.classList.add('active');
    } else {
        const timeRange = `Hour ${String(step).padStart(2, '0')}:00`;
        const magnitudes = quakes.map(q => q.properties.mag.toFixed(1)).join(', ');
        currentEarthquakeElement.innerHTML = `
            <p><strong>${timeRange}</strong> - 
            ${quakes.length} earthquakes (M${magnitudes}) - Multiple locations</p>
        `;
        currentEarthquakeElement.classList.add('active');
    }
}

function startPlayback() {
    if (!audioContext) {
        initAudioSystem();
    } else if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    // Clear any existing interval first
    if (sequencerInterval) {
        clearInterval(sequencerInterval);
        sequencerInterval = null;
    }
    
    // Calculate step duration based on tempo - play at double speed
    const stepDuration = 30 / tempo; // Half of (60 / tempo) to double the speed
    
    currentStep = -1;
    
    sequencerInterval = setInterval(() => {
        currentStep = (currentStep + 1) % STEPS_IN_DAY;
        const nextStepTime = audioContext.currentTime;
        
        // Play this step
        playStep(currentStep, nextStepTime);
        
    }, stepDuration * 1000);
}

function stopPlayback() {
    if (sequencerInterval) {
        clearInterval(sequencerInterval);
        sequencerInterval = null;
    }
    currentStep = -1;
    
    // Reset playing states
    document.querySelectorAll('.step-cell').forEach(cell => {
        cell.classList.remove('playing');
    });
}

function getRegionFromLongitude(longitude, latitude = null) {
    // Normalize longitude to -180 to 180 range
    let normalizedLong = longitude;
    while (normalizedLong > 180) normalizedLong -= 360;
    while (normalizedLong < -180) normalizedLong += 360;
    
    // Enhanced debug logging
    console.log(`Region Assignment Debug:
    Original coordinates: ${longitude}°E, ${latitude}°N
    Normalized longitude: ${normalizedLong}°
    Checking region boundaries...`);
    
    let region;
    
    // Americas includes Alaska (-180° to -30°)
    if (normalizedLong >= -180 && normalizedLong <= -30) {
        region = 'americas';
        console.log('    Longitude in Americas range (-180° to -30°)');
    }
    // Europe and Africa share longitude (-30° to 40°)
    else if (normalizedLong > -30 && normalizedLong <= 40) {
        // If we have latitude info, use it to distinguish between Europe and Africa
        if (latitude !== null) {
            console.log(`    Longitude in Europe/Africa shared range (-30° to 40°)
    Checking latitude ${latitude}°N against boundary`);
            // Europe is generally above 40°N (adjusted from 35°N to account for Mediterranean)
            if (latitude >= 40) {
                region = 'europe';
                console.log('    Assigned to Europe (latitude >= 40°N)');
            }
            // Africa is generally below 40°N
            else {
                region = 'africa';
                console.log('    Assigned to Africa (latitude < 40°N)');
            }
        } else {
            // Default to europe if no latitude info (shouldn't happen with map markers)
            region = 'europe';
            console.log('    WARNING: No latitude provided, defaulting to Europe');
        }
    }
    // Asia (40° to 150°)
    else if (normalizedLong > 40 && normalizedLong < 150) {
        region = 'asia';
        console.log('    Longitude in Asia range (40° to 150°)');
    }
    // Oceania (150° to 180°)
    else if (normalizedLong >= 150 && normalizedLong <= 180) {
        region = 'oceania';
        console.log('    Longitude in Oceania range (150° to 180°)');
    }
    
    console.log(`Final region assignment: ${region}\n`);
    return region;
}

// Data Fetching
async function fetchEarthquakeData() {
    try {
        console.log('Fetching earthquake data...');
        
        const selectedDate = dateSelector.value;
        let url;
        
        if (selectedDate) {
            // Use specific date
            const startTime = `${selectedDate}T00:00:00`;
            const endTime = `${selectedDate}T23:59:59`;
            url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime}&endtime=${endTime}&minmagnitude=${MIN_MAGNITUDE}`;
        } else {
            // Fallback to recent data
            url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Received ${data.features.length} earthquakes for ${selectedDate || 'recent data'}`);
        
        // Log each earthquake's details for debugging
        data.features.forEach(quake => {
            const [longitude, latitude] = quake.geometry.coordinates;
            const place = quake.properties.place;
            console.log(`Earthquake at ${place}:
    Coordinates: ${latitude}°N, ${longitude}°E
    Region: ${getRegionFromLongitude(longitude, latitude)}`);
        });
        
        earthquakeData = data.features;
        updateEarthquakeCount();
        updateContinentSequencer();
        updateMapMarkers();
        
    } catch (error) {
        console.error('Error fetching earthquake data:', error);
        earthquakeData = [];
        updateEarthquakeCount();
        updateContinentSequencer();
    }
}

// UI Updates
function updateEarthquakeCount() {
    earthquakeCountElement.textContent = earthquakeData.length;
}

// Map Functions
function setupMap() {
    const mapContainer = document.querySelector('.map-container');
    mapWidth = mapContainer.clientWidth;
    mapHeight = mapContainer.clientHeight;
    
    // Use a modified Mercator projection with adjusted scale and center
    mapProjection = d3.geoMercator()
        .scale((mapWidth - 100) / (2 * Math.PI))  // Reduce scale slightly to show more
        .center([0, 20])  // Center the map lower to show more of northern regions
        .translate([mapWidth / 2, mapHeight / 2]);
        
    const path = d3.geoPath().projection(mapProjection);
    
    // Clear existing map content
    const svg = d3.select('#map');
    svg.selectAll('*').remove();
    
    // Set SVG dimensions
    svg.attr('width', mapWidth)
       .attr('height', mapHeight)
       .style('background-color', 'var(--map-water)');
    
    // Load and render world map
    d3.json('https://unpkg.com/world-atlas@2/countries-110m.json').then(data => {
        const countries = topojson.feature(data, data.objects.countries);
        const continents = topojson.feature(data, data.objects.land);
        
        // First draw countries
        svg.selectAll('path.country')
            .data(countries.features)
            .enter()
            .append('path')
            .attr('class', 'country')
            .attr('d', path);
            
        // Then draw continent outlines
        svg.selectAll('path.continent')
            .data(continents.features)
            .enter()
            .append('path')
            .attr('class', 'continent')
            .attr('d', path);
            
        // After map is loaded, update markers
        updateMapMarkers();
    }).catch(error => {
        console.error('Error loading map data:', error);
    });
}

function updateMapMarkers() {
    const markerContainer = document.getElementById('markerContainer');
    markerContainer.innerHTML = '';
    
    earthquakeData.forEach(quake => {
        const [longitude, latitude] = quake.geometry.coordinates;
        const magnitude = quake.properties.mag;
        const place = quake.properties.place;
        const time = new Date(quake.properties.time);
        const hour = time.getUTCHours();
        const region = getRegionFromLongitude(longitude, latitude);
        
        const marker = document.createElement('div');
        marker.className = 'earthquake-marker';
        
        // Size based on magnitude: 0.5px per 0.1M (magnitude × 5)
        const size = Math.round(magnitude * 5);
        marker.style.width = `${size}px`;
        marker.style.height = `${size}px`;
        marker.style.borderRadius = '50%';
        marker.style.backgroundColor = isPlaying ? 'transparent' : '#000000';
        marker.style.border = 'none';
        marker.style.position = 'absolute';
        marker.style.display = 'flex';
        marker.style.alignItems = 'center';
        marker.style.justifyContent = 'center';
        marker.style.fontSize = `${Math.max(6, size * 0.2)}px`;
        marker.style.fontFamily = 'monospace';
        marker.style.fontWeight = 'bold';
        marker.style.color = '#000000';
        marker.style.cursor = 'pointer';
        marker.style.pointerEvents = 'auto';
        marker.style.opacity = isPlaying ? '0' : '1';
        
        // Add data attributes for identification
        marker.dataset.longitude = longitude;
        marker.dataset.latitude = latitude;
        marker.dataset.magnitude = magnitude;
        marker.dataset.hour = hour;
        marker.dataset.region = region;
        
        // Add hover event listeners
        marker.addEventListener('mouseenter', () => {
            // Show marker tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            tooltip.style.position = 'absolute';
            tooltip.style.bottom = '120%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translateX(-50%)';
            tooltip.style.background = '#000000';
            tooltip.style.color = '#ffffff';
            tooltip.style.padding = '4px 8px';
            tooltip.style.fontSize = '10px';
            tooltip.style.fontFamily = 'monospace';
            tooltip.style.whiteSpace = 'pre';
            tooltip.style.borderRadius = '2px';
            tooltip.style.zIndex = '1001';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            
            tooltip.textContent = `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°\n${place}`;
            marker.appendChild(tooltip);
            
            // Highlight the marker itself
            marker.classList.add('highlighted');
            marker.style.backgroundColor = '#00ff00';
            
            // Find and highlight corresponding sequencer cell
            const cell = document.querySelector(`.track-steps[data-continent="${region}"] .step-cell[data-step="${hour}"]`);
            if (cell) {
                cell.classList.add('highlighted');
                
                // Find the specific subdivision for this earthquake
                const quakesInHour = earthquakeData.filter(q => {
                    const qTime = new Date(q.properties.time);
                    const qHour = qTime.getUTCHours();
                    const [qLong, qLat] = q.geometry.coordinates;
                    const qRegion = getRegionFromLongitude(qLong, qLat);
                    return qHour === hour && qRegion === region;
                });
                
                const quakeIndex = quakesInHour.findIndex(q => 
                    q.geometry.coordinates[0] === longitude && 
                    q.geometry.coordinates[1] === latitude
                );
                
                if (quakesInHour.length > 1) {
                    // Multiple earthquakes - highlight specific subdivision
                    const subdivision = cell.querySelector(`.subdivision-element[data-subdivision-index="${quakeIndex}"]`);
                    if (subdivision) {
                        subdivision.style.backgroundColor = '#00ff00';
                    }
                } else {
                    // Single earthquake - highlight whole cell
                    cell.style.backgroundColor = '#00ff00';
                }
                
                // Create tooltip for sequencer cell
                const cellTooltip = document.createElement('div');
                cellTooltip.className = 'custom-tooltip';
                cellTooltip.style.position = 'absolute';
                cellTooltip.style.bottom = '120%';
                cellTooltip.style.left = '50%';
                cellTooltip.style.transform = 'translateX(-50%)';
                cellTooltip.style.background = '#000000';
                cellTooltip.style.color = '#ffffff';
                cellTooltip.style.padding = '4px 8px';
                cellTooltip.style.fontSize = '10px';
                cellTooltip.style.fontFamily = 'monospace';
                cellTooltip.style.whiteSpace = 'pre';
                cellTooltip.style.borderRadius = '2px';
                cellTooltip.style.zIndex = '1001';
                cellTooltip.style.pointerEvents = 'none';
                cellTooltip.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
                
                const hours = time.getUTCHours().toString().padStart(2, '0');
                const minutes = time.getUTCMinutes().toString().padStart(2, '0');
                cellTooltip.innerHTML = `<span style="color: #00ff00;">M${magnitude.toFixed(1)}</span> ${hours}:${minutes} UTC`;
                cell.appendChild(cellTooltip);
            }
        });
        
        marker.addEventListener('mouseleave', () => {
            // Remove marker tooltip and highlighting
            const tooltip = marker.querySelector('.custom-tooltip');
            if (tooltip) {
                tooltip.remove();
            }
            marker.classList.remove('highlighted');
            marker.style.backgroundColor = isPlaying ? 'transparent' : '#000000';
            
            // Remove sequencer cell highlighting
            const cell = document.querySelector(`.track-steps[data-continent="${region}"] .step-cell[data-step="${hour}"]`);
            if (cell) {
                cell.classList.remove('highlighted');
                cell.style.backgroundColor = '';
                const cellTooltip = cell.querySelector('.custom-tooltip');
                if (cellTooltip) {
                    cellTooltip.remove();
                }
                
                // Remove subdivision highlighting
                const subdivisions = cell.querySelectorAll('.subdivision-element');
                subdivisions.forEach(sub => {
                    sub.style.backgroundColor = 'transparent';
                });
            }
        });
        
        // Convert coordinates to pixel position
        const position = latLongToPixel(latitude, longitude);
        marker.style.left = `${position.x}px`;
        marker.style.top = `${position.y}px`;
        
        markerContainer.appendChild(marker);
    });
}

function latLongToPixel(latitude, longitude) {
    if (!mapProjection) return { x: 0, y: 0 }; // Safety check
    
    // Use D3's projection to convert lat/long to pixels
    const [x, y] = mapProjection([longitude, latitude]);
    return { x, y };
}

async function handleDateChange() {
    const selectedDate = dateSelector.value;
    if (selectedDate) {
        console.log(`Loading earthquake data for ${selectedDate}`);
        console.log('Was playing before date change:', isPlaying);
        
        // Store current playing state
        const wasPlaying = isPlaying;
        const currentStepBefore = currentStep;
        
        // Check if it's June 3rd
        const date = new Date(selectedDate + 'T12:00:00Z'); // Use noon UTC to avoid timezone issues
        const birthdayMessage = document.getElementById('birthdayMessage');
        
        if (date.getUTCMonth() === 5 && date.getUTCDate() === 3 && date.getUTCFullYear() >= 1986) {
            birthdayMessage.classList.add('visible');
        } else {
            birthdayMessage.classList.remove('visible');
        }
        
        // Fetch new data for selected date (keep playback running)
        await fetchEarthquakeData();
        
        console.log('Is playing after date change:', isPlaying);
        console.log('Current step before:', currentStepBefore, 'Current step after:', currentStep);
        
        // If we were playing before, make sure we're still playing
        if (wasPlaying && !isPlaying) {
            console.log('Playback was interrupted - restarting...');
            togglePlay();
        }
    }
}

function createSeismographChannel(continent) {
    const channel = document.createElement('div');
    channel.className = 'seismograph-channel';
    
    const canvas = document.createElement('canvas');
    canvas.className = 'seismograph-canvas';
    canvas.width = 800;
    canvas.height = 20;
    
    channel.appendChild(canvas);
    return channel;
}

// Initialize the application
init();

// Modal functionality
const modal = document.getElementById('helpModal');
const helpButton = document.querySelector('.help h3');
const closeButton = document.querySelector('.modal-close');

helpButton.addEventListener('click', () => {
    modal.classList.add('show');
});

closeButton.addEventListener('click', () => {
    modal.classList.remove('show');
});

// Close modal when clicking outside
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('show');
    }
});

// Close modal with escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
        modal.classList.remove('show');
    }
}); 