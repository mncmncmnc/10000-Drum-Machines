// Generate a valid closed Knight's Tour
function generateKnightTour(startPos = 0) {
    const board = new Array(64).fill(-1);
    const moves = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
    ];

    function isValidMove(x, y) {
        return x >= 0 && x < 8 && y >= 0 && y < 8 && board[y * 8 + x] === -1;
    }

    function getValidMoves(x, y) {
        return moves
            .map(([dx, dy]) => [x + dx, y + dy])
            .filter(([nx, ny]) => isValidMove(nx, ny));
    }

    function getNextMove(x, y) {
        const validMoves = getValidMoves(x, y);
        if (validMoves.length === 0) return null;
        
        // Use Warnsdorff's algorithm: choose the move with the fewest next moves
        return validMoves.reduce((best, [nx, ny]) => {
            const nextMoves = getValidMoves(nx, ny).length;
            return nextMoves < best.moves ? { pos: [nx, ny], moves: nextMoves } : best;
        }, { pos: validMoves[0], moves: getValidMoves(...validMoves[0]).length }).pos;
    }

    // Start from the given position
    let currentPos = startPos;
    let moveCount = 0;

    while (moveCount < 64) {
        const x = currentPos % 8;
        const y = Math.floor(currentPos / 8);
        board[currentPos] = moveCount;
        moveCount++;

        const nextMove = getNextMove(x, y);
        if (!nextMove) break;
        currentPos = nextMove[1] * 8 + nextMove[0];
    }

    // Convert to our sequence format
    const sequence = new Array(64);
    for (let i = 0; i < 64; i++) {
        sequence[board[i]] = i;
    }

    return sequence;
}

// Generate the tour
const KNIGHTS_TOUR = generateKnightTour();

class KnightSequencer {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.isPlaying = false;
        this.tempo = 120;
        this.knights = [
            { position: 0, speed: 1.8, color: '#e74c3c', sound: 'bassdrumBD0075.WAV', lastMoveTime: 0, path: [], tour: generateKnightTour(0) },
            { position: 16, speed: 0.5, color: '#2ecc71', sound: 'snareSD7550.WAV', lastMoveTime: 0, path: [], tour: generateKnightTour(16) },
            { position: 32, speed: 0.75, color: '#f1c40f', sound: 'closedhatCH.WAV', lastMoveTime: 0, path: [], tour: generateKnightTour(32) },
            { position: 48, speed: 0.2, color: '#e67e22', sound: 'cowbellCB.WAV', lastMoveTime: 0, path: [], tour: generateKnightTour(48) }
        ];
        
        this.samples = {};
        this.effects = {
            rank: 'none',
            file: 'none'
        };
        
        // Create mix nodes
        this.dryGain = this.audioContext.createGain();
        this.dryGain.connect(this.audioContext.destination);
        
        // Reverb setup
        this.reverbMix = this.audioContext.createGain();
        this.reverbMix.connect(this.audioContext.destination);
        
        this.reverbWet = this.audioContext.createGain();
        this.reverbWet.connect(this.reverbMix);
        
        // Simple reverb with a single delay and feedback
        this.reverbDelay = this.audioContext.createDelay();
        this.reverbDelay.delayTime.value = 0.1;
        
        this.reverbFeedback = this.audioContext.createGain();
        this.reverbFeedback.gain.value = 0.8;
        
        this.reverbFilter = this.audioContext.createBiquadFilter();
        this.reverbFilter.type = 'lowpass';
        this.reverbFilter.frequency.value = 2000;
        this.reverbFilter.Q.value = 0.7;
        
        // Connect reverb network
        this.reverbDelay.connect(this.reverbFilter);
        this.reverbFilter.connect(this.reverbWet);
        this.reverbFilter.connect(this.reverbFeedback);
        this.reverbFeedback.connect(this.reverbDelay);
        
        // Delay setup
        this.delayMix = this.audioContext.createGain();
        this.delayMix.connect(this.audioContext.destination);
        
        this.delayWet = this.audioContext.createGain();
        this.delayWet.connect(this.delayMix);
        
        this.delay = this.audioContext.createDelay();
        this.updateDelayTime(); // Initialize delay time based on tempo
        
        this.delayFeedback = this.audioContext.createGain();
        this.delayFeedback.gain.value = 0.85;
        
        this.delay.connect(this.delayWet);
        this.delay.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delay);
        
        this.loadSamples();
        this.setupUI();
        this.setupEventListeners();
        this.setupPaths();
        this.updateEffectIndicators();
    }

    updateDelayTime() {
        // Calculate eighth note duration in seconds based on tempo
        const eighthNoteDuration = (60 / this.tempo) / 2;  // Quarter note divided by 2
        // Set delay time to eighth note duration
        this.delay.delayTime.value = eighthNoteDuration;
    }

    async loadSamples() {
        const sampleFiles = [
            'bassdrumBD0075.WAV',
            'snareSD7550.WAV',
            'closedhatCH.WAV',
            'openhatOH10.WAV',
            'cowbellCB.WAV',
            'highcongaHC50.WAV',
            'midcongaMC50.WAV',
            'lowcongaLC50.WAV'
        ];

        for (const filename of sampleFiles) {
            try {
                const response = await fetch(`kn-sounds/${filename}`);
                const arrayBuffer = await response.arrayBuffer();
                this.samples[filename] = await this.audioContext.decodeAudioData(arrayBuffer);
            } catch (error) {
                console.error(`Error loading sample ${filename}:`, error);
            }
        }
    }

    setupUI() {
        // Create chessboard
        const chessboard = document.getElementById('chessboard');
        for (let i = 0; i < 64; i++) {
            const square = document.createElement('div');
            square.className = 'square';
            square.dataset.index = i;
            chessboard.appendChild(square);
        }
    }

    setupEventListeners() {
        // Play/Pause button
        document.getElementById('playPause').addEventListener('click', () => {
            if (this.isPlaying) {
                this.stop();
            } else {
                this.start();
            }
        });

        // Tempo control
        const tempoSlider = document.getElementById('tempo');
        const tempoValue = document.getElementById('tempoValue');
        tempoSlider.addEventListener('input', (e) => {
            this.tempo = parseInt(e.target.value);
            tempoValue.textContent = this.tempo;
            this.updateDelayTime(); // Update delay time when tempo changes
        });

        // Knight speed controls
        document.querySelectorAll('.speed').forEach((slider, index) => {
            slider.addEventListener('input', (e) => {
                this.knights[index].speed = parseFloat(e.target.value);
                e.target.nextElementSibling.textContent = `${e.target.value}x`;
            });
        });

        // Sound selection
        document.querySelectorAll('.sound-select').forEach((select, index) => {
            select.addEventListener('change', (e) => {
                this.knights[index].sound = e.target.value;
            });
        });

        // Effect selection
        document.querySelectorAll('.effect-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const dimension = e.target.dataset.dimension;
                this.effects[dimension] = e.target.value;
            });
        });

        // Path visibility toggle
        document.getElementById('showPaths').addEventListener('change', (e) => {
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.style.display = e.target.checked ? 'block' : 'none';
            }
            // Clear paths when toggled off
            if (!e.target.checked && this.pathContext) {
                this.pathContext.clearRect(0, 0, canvas.width, canvas.height);
                this.knights.forEach(knight => knight.path = []);
            }
        });
    }

    start() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        document.getElementById('playPause').textContent = 'Pause';
        this.audioContext.resume().then(() => this.scheduleNextStep());
    }

    stop() {
        this.isPlaying = false;
        document.getElementById('playPause').textContent = 'Play';
    }

    scheduleNextStep() {
        if (!this.isPlaying) return;

        const now = this.audioContext.currentTime;
        const baseStepDuration = 60 / this.tempo;

        // Update each knight's position and trigger sounds
        this.knights.forEach((knight, index) => {
            const timeSinceLastMove = now - knight.lastMoveTime;
            const knightStepDuration = baseStepDuration / knight.speed;
            
            if (timeSinceLastMove >= knightStepDuration) {
                const currentStep = knight.tour[knight.position];
                this.playSound(knight.sound, now, currentStep);
                this.updateKnightPosition(index, currentStep);
                knight.lastMoveTime = now;
            }
        });

        // Schedule next step
        setTimeout(() => this.scheduleNextStep(), 16);
    }

    shouldMoveKnight(knight) {
        const currentTime = this.audioContext.currentTime;
        const baseStepDuration = 60 / this.tempo;
        const knightStepDuration = baseStepDuration / knight.speed;
        
        return (currentTime - knight.lastMoveTime) >= knightStepDuration;
    }

    playSound(soundName, time, position) {
        if (!this.samples[soundName]) return;

        // Create audio nodes
        const source = this.audioContext.createBufferSource();
        const panner = this.audioContext.createStereoPanner();
        const distortion = this.audioContext.createWaveShaper();
        
        // Set up distortion curve
        const makeDistortionCurve = (amount) => {
            const samples = 44100;
            const curve = new Float32Array(samples);
            for (let i = 0; i < samples; i++) {
                const x = (i * 2) / samples - 1;
                curve[i] = (Math.PI + amount) * x / (Math.PI + amount * Math.abs(x));
            }
            return curve;
        };
        
        // Calculate position values
        const rank = position % 8;  // 0-7 (left to right)
        const file = Math.floor(position / 8);  // 0-7 (top to bottom)
        
        // Apply rank effect (left to right)
        switch(this.effects.rank) {
            case 'none':
                source.connect(this.audioContext.destination);
                break;
            case 'pan':
                panner.pan.value = (rank / 3.5) - 1;  // -1 to 1
                source.connect(panner);
                panner.connect(this.audioContext.destination);
                break;
            case 'filter':
                // Pitch shift: 0.8 (left) to 1.2 (right)
                source.playbackRate.value = 0.8 + (rank * 0.06);
                source.connect(this.audioContext.destination);
                break;
            case 'reverb':
                // Set wet/dry mix based on position
                const reverbWetAmount = rank / 7; // 0 to 1
                this.dryGain.gain.value = 1 - reverbWetAmount;
                this.reverbWet.gain.value = reverbWetAmount;
                source.connect(this.dryGain);
                source.connect(this.reverbDelay);
                break;
            case 'delay':
                // Set wet/dry mix based on position
                const delayWetAmount = rank / 7; // 0 to 1
                this.dryGain.gain.value = 1 - delayWetAmount;
                this.delayWet.gain.value = delayWetAmount;
                source.connect(this.dryGain);
                source.connect(this.delay);
                break;
            case 'distortion':
                distortion.curve = makeDistortionCurve(rank * 20); // Reduced from 100 to 20 for more subtle effect
                source.connect(distortion);
                distortion.connect(this.audioContext.destination);
                break;
            default:
                source.connect(this.audioContext.destination);
        }
        
        // Apply file effect (top to bottom)
        switch(this.effects.file) {
            case 'none':
                source.connect(this.audioContext.destination);
                break;
            case 'pan':
                panner.pan.value = (file / 3.5) - 1;  // -1 to 1
                source.connect(panner);
                panner.connect(this.audioContext.destination);
                break;
            case 'filter':
                // Pitch shift: 1.2 (higher) to 0.8 (lower) as we move down
                source.playbackRate.value = 1.2 - (file * 0.06);
                source.connect(this.audioContext.destination);
                break;
            case 'reverb':
                // Set wet/dry mix based on position
                const reverbWetAmount = file / 7; // 0 to 1
                this.dryGain.gain.value = 1 - reverbWetAmount;
                this.reverbWet.gain.value = reverbWetAmount;
                source.connect(this.dryGain);
                source.connect(this.reverbDelay);
                break;
            case 'delay':
                // Set wet/dry mix based on position
                const delayWetAmount = file / 7; // 0 to 1
                this.dryGain.gain.value = 1 - delayWetAmount;
                this.delayWet.gain.value = delayWetAmount;
                source.connect(this.dryGain);
                source.connect(this.delay);
                break;
            case 'distortion':
                distortion.curve = makeDistortionCurve(file * 20); // Reduced from 100 to 20 for more subtle effect
                source.connect(distortion);
                distortion.connect(this.audioContext.destination);
                break;
            default:
                source.connect(this.audioContext.destination);
        }
        
        // Start playback
        source.buffer = this.samples[soundName];
        source.start(time);
    }

    setupPaths() {
        // Create canvas for paths
        const chessboard = document.getElementById('chessboard');
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '600px';
        canvas.style.height = '600px';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '0';
        chessboard.style.position = 'relative';
        chessboard.appendChild(canvas);

        // Set canvas size to match chessboard
        const resizeCanvas = () => {
            canvas.width = 600;
            canvas.height = 600;
            this.pathContext = canvas.getContext('2d');
        };
        resizeCanvas();
    }

    updateKnightPosition(knightIndex, step) {
        const knight = this.knights[knightIndex];
        
        // Remove ALL existing knights of this type from the board
        document.querySelectorAll(`.knight-${knightIndex}`).forEach(k => k.remove());

        // Add new knight
        const square = document.querySelector(`.square[data-index="${step}"]`);
        if (!square) {
            console.error(`Invalid square index: ${step}`);
            return;
        }
        const knightElement = document.createElement('div');
        knightElement.className = `knight knight-${knightIndex}`;
        knightElement.textContent = '♞';
        square.appendChild(knightElement);

        // Update position for next step
        const currentIndex = knight.tour.indexOf(step);
        const nextIndex = (currentIndex + 1) % 64;
        knight.position = nextIndex;

        // If we've completed a tour, generate a new one from the current position
        if (nextIndex === 0) {
            knight.tour = generateKnightTour(step);
            // Clear the path when starting a new tour
            knight.path = [];
            
            // Add tour complete text
            const tourComplete = document.createElement('div');
            tourComplete.className = 'tour-complete';
            tourComplete.textContent = 'Tour Complete!';
            tourComplete.style.color = knight.color;
            square.appendChild(tourComplete);
            
            // Remove the text after animation completes
            setTimeout(() => {
                tourComplete.remove();
            }, 2000);
        }

        // Update path if paths are enabled
        if (document.getElementById('showPaths').checked) {
            const squareSize = 600 / 8;
            const row = Math.floor(step / 8);
            const col = step % 8;
            
            const x = (col * squareSize) + (squareSize / 2);
            const y = (row * squareSize) + (squareSize / 2);
            
            if (!knight.path) knight.path = [];
            knight.path.push([x, y]);
            if (knight.path.length > 64) {
                knight.path = knight.path.slice(-64);
            }

            this.pathContext.clearRect(0, 0, 600, 600);
            this.knights.forEach((k, idx) => {
                if (k.path && k.path.length > 1) {
                    this.pathContext.beginPath();
                    this.pathContext.moveTo(k.path[0][0], k.path[0][1]);
                    for (let i = 1; i < k.path.length; i++) {
                        this.pathContext.lineTo(k.path[i][0], k.path[i][1]);
                    }
                    this.pathContext.strokeStyle = k.color;
                    this.pathContext.lineWidth = 5;
                    this.pathContext.lineCap = 'round';
                    this.pathContext.lineJoin = 'round';
                    this.pathContext.globalAlpha = 0.8;
                    this.pathContext.stroke();
                }
            });
        }
    }

    updateEffectIndicators() {
        document.querySelectorAll('.square').forEach(square => {
            const index = parseInt(square.dataset.index);
            const rank = index % 8;
            const file = Math.floor(index / 8);
            
            const panIndicator = square.querySelector('.pan-indicator');
            const filterIndicator = square.querySelector('.filter-indicator');
            
            // Only update if indicators exist
            if (panIndicator) {
                panIndicator.style.transform = `translateX(${(rank / 7) * 100}%)`;
            }
            
            if (filterIndicator) {
                filterIndicator.style.opacity = (file / 7) * 0.3;
            }
        });
    }
}

// Initialize the sequencer when the page loads
window.addEventListener('load', () => {
    // Initialize modal first
    const modal = document.getElementById('infoModal');
    const infoButton = document.querySelector('.info-button');
    const closeButton = document.querySelector('.close-button');

    if (infoButton && modal && closeButton) {
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
    }

    // Then initialize sequencer
    const sequencer = new KnightSequencer();
});
