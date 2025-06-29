class DrumMachine {
    constructor(rows = 4, cols = 16, mines = 10) {
        this.rows = rows;
        this.cols = cols;
        this.maxMines = rows * cols - 1;
        this.minMines = 1;
        this.mines = Math.min(mines, this.maxMines);
        this.board = [];
        this.revealed = [];
        this.flagged = [];
        this.gameOver = false;
        this.gameWon = false;
        this.firstClick = true;
        this.timer = 0;
        this.timerInterval = null;
        this.minesLeft = this.mines;
        
        // Drum machine properties
        this.isPlaying = false;
        this.currentStep = 0;
        this.bpm = Math.floor(Math.random() * (160 - 80 + 1)) + 80; // Random BPM between 80-160
        this.stepInterval = null;
        this.stepDuration = (60 / this.bpm) * 1000 / 4; // Convert BPM to milliseconds per 16th note
        
        // Audio properties
        this.audioContext = null;
        this.sounds = [];
        this.soundCategories = ['bd', 'hh', 'sd', 'hc'];
        this.soundFiles = {
            bd: ['kick_taka_hollow.wav', 'kick_909_dmx.wav', 'bass_thunk.wav', '350_Kick_18.wav'],
            hh: ['hihat_open_electronic.wav', 'hihat_dm-1.wav', 'closedhatCH_808.WAV', 'openhatOH10_808.WAV'],
            sd: ['snare_verb_h3500_2.wav', 'snare_dc_snare.wav', 'snare_606.wav', 'snareST3T3SA__909.WAV'],
            hc: ['clap_tight.wav', 'clap_808_light_quick.wav', '154_Perc_FX_039.wav', '83_Clap_2.wav']
        };
        this.soundsLoaded = false;
        this.loadingPromise = null;
        this.init();
    }

    async init() {
        this.createBoard();
        this.createUI();
        this.updateMineCounter();
        this.updateTimer();
        this.setupMineAdjustButtons();
        // Defer audio init and sound loading until first user click
        document.body.addEventListener('click', this.handleFirstUserClick.bind(this), { once: true });
    }

    async handleFirstUserClick() {
        if (!this.soundsLoaded) {
            this.loadingPromise = this.initAudio().then(() => this.loadRandomSounds());
            await this.loadingPromise;
            this.soundsLoaded = true;
        }
    }

    async ensureSoundsLoaded() {
        if (!this.soundsLoaded && this.loadingPromise) {
            await this.loadingPromise;
        }
    }

    async initAudio() {
        // Initialize WebAudio API
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Resume audio context on first user interaction
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    async loadRandomSounds() {
        this.sounds = [];
        
        for (let i = 0; i < this.rows; i++) {
            const category = this.soundCategories[i];
            const files = this.soundFiles[category];
            const randomFile = files[Math.floor(Math.random() * files.length)];
            const soundPath = `minedrums/${category}/${randomFile}`;
            
            try {
                const audioBuffer = await this.loadAudioFile(soundPath);
                this.sounds[i] = audioBuffer;
            } catch (error) {
                console.error(`Failed to load sound for row ${i}:`, error);
                this.sounds[i] = null;
            }
        }
    }

    async loadAudioFile(url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await this.audioContext.decodeAudioData(arrayBuffer);
    }

    playSound(row) {
        if (!this.sounds[row] || !this.audioContext) return;
        
        const source = this.audioContext.createBufferSource();
        source.buffer = this.sounds[row];
        source.connect(this.audioContext.destination);
        source.start();
    }

    setupMineAdjustButtons() {
        const mineUpBtn = document.getElementById('mineUp');
        const mineDownBtn = document.getElementById('mineDown');
        
        // Auto-repeat functionality
        let upInterval = null;
        let downInterval = null;
        
        mineUpBtn.addEventListener('mousedown', () => {
            if (this.gameOver || !this.firstClick || this.mines >= this.maxMines) return;
            
            // Initial change
            this.adjustMineCount(1);
            
            // Start auto-repeat after a delay
            upInterval = setTimeout(() => {
                upInterval = setInterval(() => {
                    if (this.mines < this.maxMines) {
                        this.adjustMineCount(1);
                    } else {
                        clearInterval(upInterval);
                    }
                }, 100); // Repeat every 100ms
            }, 500); // Start repeating after 500ms
        });
        
        mineDownBtn.addEventListener('mousedown', () => {
            if (this.gameOver || !this.firstClick || this.mines <= this.minMines) return;
            
            // Initial change
            this.adjustMineCount(-1);
            
            // Start auto-repeat after a delay
            downInterval = setTimeout(() => {
                downInterval = setInterval(() => {
                    if (this.mines > this.minMines) {
                        this.adjustMineCount(-1);
                    } else {
                        clearInterval(downInterval);
                    }
                }, 100); // Repeat every 100ms
            }, 500); // Start repeating after 500ms
        });
        
        // Stop auto-repeat on mouse up
        mineUpBtn.addEventListener('mouseup', () => {
            if (upInterval) {
                clearTimeout(upInterval);
                clearInterval(upInterval);
                upInterval = null;
            }
        });
        
        mineDownBtn.addEventListener('mouseup', () => {
            if (downInterval) {
                clearTimeout(downInterval);
                clearInterval(downInterval);
                downInterval = null;
            }
        });
        
        // Stop auto-repeat when mouse leaves button
        mineUpBtn.addEventListener('mouseleave', () => {
            if (upInterval) {
                clearTimeout(upInterval);
                clearInterval(upInterval);
                upInterval = null;
            }
        });
        
        mineDownBtn.addEventListener('mouseleave', () => {
            if (downInterval) {
                clearTimeout(downInterval);
                clearInterval(downInterval);
                downInterval = null;
            }
        });
        
        this.updateMineAdjustButtons();
    }

    adjustMineCount(delta) {
        if (this.gameOver || !this.firstClick) {
            return; // Can't adjust during gameplay
        }
        
        const newMineCount = this.mines + delta;
        if (newMineCount >= this.minMines && newMineCount <= this.maxMines) {
            this.mines = newMineCount;
            this.minesLeft = this.mines;
            this.updateMineCounter();
            this.updateMineAdjustButtons();
        }
    }

    updateMineAdjustButtons() {
        const mineUpBtn = document.getElementById('mineUp');
        const mineDownBtn = document.getElementById('mineDown');
        const mineAdjustButtons = document.querySelector('.mine-adjust-buttons');
        
        if (this.firstClick) {
            // Show buttons and enable/disable based on limits
            mineAdjustButtons.classList.remove('hidden');
            mineUpBtn.disabled = this.mines >= this.maxMines;
            mineDownBtn.disabled = this.mines <= this.minMines;
        } else {
            // Hide buttons when game is in progress
            mineAdjustButtons.classList.add('hidden');
        }
    }

    createBoard() {
        // Initialize empty board
        for (let row = 0; row < this.rows; row++) {
            this.board[row] = [];
            this.revealed[row] = [];
            this.flagged[row] = [];
            for (let col = 0; col < this.cols; col++) {
                this.board[row][col] = 0;
                this.revealed[row][col] = false;
                this.flagged[row][col] = false;
            }
        }
    }

    placeMines(firstRow, firstCol) {
        let minesPlaced = 0;
        while (minesPlaced < this.mines) {
            const row = Math.floor(Math.random() * this.rows);
            const col = Math.floor(Math.random() * this.cols);
            
            // Don't place mine on first click or if mine already exists
            if ((row === firstRow && col === firstCol) || this.board[row][col] === -1) {
                continue;
            }
            
            this.board[row][col] = -1; // -1 represents a mine
            minesPlaced++;
        }

        // Calculate numbers for adjacent cells
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] !== -1) {
                    this.board[row][col] = this.countAdjacentMines(row, col);
                }
            }
        }
    }

    countAdjacentMines(row, col) {
        let count = 0;
        for (let r = Math.max(0, row - 1); r <= Math.min(this.rows - 1, row + 1); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(this.cols - 1, col + 1); c++) {
                if (this.board[r][c] === -1) {
                    count++;
                }
            }
        }
        return count;
    }

    createUI() {
        const gameBoard = document.getElementById('gameBoard');
        gameBoard.innerHTML = '';

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                cell.addEventListener('click', (e) => this.handleLeftClick(row, col));
                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.handleRightClick(row, col);
                });
                
                gameBoard.appendChild(cell);
            }
        }

        // Reset button
        const resetButton = document.querySelector('.reset-button');
        resetButton.addEventListener('click', async () => {
            this.stopSequencer(); // Ensure sequencer is stopped before reset
            await this.resetGame();
        });
    }

    async handleLeftClick(row, col) {
        // Ensure sounds are loaded before starting the game
        if (this.firstClick && !this.soundsLoaded) {
            await this.ensureSoundsLoaded();
        }
        if (this.gameOver || this.flagged[row][col]) {
            return;
        }
        if (this.firstClick) {
            this.placeMines(row, col);
            this.firstClick = false;
            this.startTimer();
            this.startSequencer();
            this.updateMineAdjustButtons();
        }
        if (this.board[row][col] === -1) {
            this.gameOver = true;
            this.revealAllMines();
            this.updateResetButton('😵');
            this.stopTimer();
            this.stopSequencer();
        } else {
            this.revealCell(row, col);
            if (this.checkWin()) {
                this.gameWon = true;
                this.gameOver = true;
                this.flagAllMines();
                this.updateResetButton('😎');
                this.stopTimer();
                // Don't stop sequencer - let it continue playing for win wobble effect
            }
        }
    }

    handleRightClick(row, col) {
        if (this.gameOver || this.revealed[row][col]) {
            return;
        }

        if (this.flagged[row][col]) {
            this.flagged[row][col] = false;
            this.minesLeft++;
            this.getCellElement(row, col).textContent = '';
        } else {
            this.flagged[row][col] = true;
            this.minesLeft--;
            this.getCellElement(row, col).textContent = '🚩';
        }

        this.updateMineCounter();
    }

    revealCell(row, col) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols || 
            this.revealed[row][col] || this.flagged[row][col]) {
            return;
        }

        this.revealed[row][col] = true;
        const cellElement = this.getCellElement(row, col);
        cellElement.classList.add('revealed');

        if (this.board[row][col] === 0) {
            // Reveal adjacent cells for empty cells
            for (let r = Math.max(0, row - 1); r <= Math.min(this.rows - 1, row + 1); r++) {
                for (let c = Math.max(0, col - 1); c <= Math.min(this.cols - 1, col + 1); c++) {
                    this.revealCell(r, c);
                }
            }
        } else {
            cellElement.textContent = this.board[row][col];
            cellElement.dataset.number = this.board[row][col];
        }
    }

    revealAllMines() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] === -1) {
                    const cellElement = this.getCellElement(row, col);
                    cellElement.classList.add('revealed', 'mine');
                    cellElement.textContent = '💣';
                }
            }
        }
    }

    flagAllMines() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] === -1 && !this.flagged[row][col]) {
                    this.flagged[row][col] = true;
                    this.getCellElement(row, col).textContent = '🚩';
                }
            }
        }
        this.minesLeft = 0;
        this.updateMineCounter();
    }

    checkWin() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] !== -1 && !this.revealed[row][col]) {
                    return false;
                }
            }
        }
        return true;
    }

    // Sequencer methods
    startSequencer() {
        this.isPlaying = true;
        this.currentStep = 0;
        this.stepInterval = setInterval(() => {
            this.playStep();
            this.currentStep = (this.currentStep + 1) % this.cols;
        }, this.stepDuration);
    }

    stopSequencer() {
        this.isPlaying = false;
        if (this.stepInterval) {
            clearInterval(this.stepInterval);
            this.stepInterval = null;
        }
        this.currentStep = 0;
        this.updateStepIndicator();
    }

    playStep() {
        // Visual feedback for current step
        this.updateStepIndicator();
        
        // Check if any instruments should play at this step
        for (let row = 0; row < this.rows; row++) {
            if (this.flagged[row][this.currentStep]) {
                this.triggerInstrument(row);
            }
        }
    }

    triggerInstrument(row) {
        // Visual feedback for triggered instruments
        const cell = this.getCellElement(row, this.currentStep);
        cell.classList.add('playing');
        setTimeout(() => {
            cell.classList.remove('playing');
        }, 100);
        
        // Win wobble effect - only when game is won and sequencer is still playing
        if (this.gameWon && this.isPlaying) {
            const gameContainer = document.querySelector('.game-container');
            gameContainer.classList.add('win-wobble');
            setTimeout(() => {
                gameContainer.classList.remove('win-wobble');
            }, 200);
        }
        
        // Play the sound
        this.playSound(row);
    }

    updateStepIndicator() {
        // Remove previous step indicator
        document.querySelectorAll('.cell.current-step').forEach(cell => {
            cell.classList.remove('current-step');
        });
        
        // Add current step indicator
        for (let row = 0; row < this.rows; row++) {
            const cell = this.getCellElement(row, this.currentStep);
            if (cell) {
                cell.classList.add('current-step');
            }
        }
    }

    updateBPMDisplay() {
        // BPM is not displayed - kept internal only
    }

    getCellElement(row, col) {
        return document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    }

    updateMineCounter() {
        const counter = document.querySelector('.mine-counter');
        let value = this.minesLeft;
        if (value < 0) {
            counter.textContent = '-' + String(Math.abs(value)).padStart(2, '0');
        } else {
            counter.textContent = String(value).padStart(3, '0');
        }
    }

    updateTimer() {
        const timerElement = document.querySelector('.timer');
        timerElement.textContent = this.timer.toString().padStart(3, '0');
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.timer++;
            this.updateTimer();
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateResetButton(emoji) {
        const resetButton = document.querySelector('.reset-button');
        resetButton.textContent = emoji;
    }

    async resetGame() {
        this.board = [];
        this.revealed = [];
        this.flagged = [];
        this.gameOver = false;
        this.gameWon = false;
        this.firstClick = true;
        this.timer = 0;
        this.minesLeft = this.mines;
        this.stopSequencer();
        this.bpm = Math.floor(Math.random() * (160 - 80 + 1)) + 80;
        this.stepDuration = (60 / this.bpm) * 1000 / 4;
        // Load new random sounds for this game, but only after user interaction
        if (this.soundsLoaded) {
            await this.loadRandomSounds();
        }
        this.stopTimer();
        this.updateResetButton('😊');
        this.updateMineCounter();
        this.updateTimer();
        this.updateMineAdjustButtons();
        this.createBoard();
        this.createUI();
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DrumMachine(4, 16, 10);
});
