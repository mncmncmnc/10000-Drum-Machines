class DVDBouncingLogo {
    constructor() {
        this.canvas = document.getElementById('dvdCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Logo properties
        this.logo = new Image();
        this.logo.src = 'DVD-Video_Logo.svg.png';
        
        // Safari detection
        this.isSafari = this.detectSafari();
        
        // Pre-processed colored logos for Safari compatibility
        this.coloredLogos = {};
        this.logoProcessed = false;
        
        // Physics properties
        this.baseSpeed = 0.5;
        this.baseLogoWidth = 240;
        this.baseLogoHeight = 120;
        
        // Logo management
        this.logos = [];
        this.logoCount = 1;
        this.maxLogos = 20;
        
        // Control values
        this.angleVariance = 5;
        this.speedVariance = 10;
        this.globalSpeed = 1;
        
        // Sound properties
        this.audioContext = null;
        this.sounds = {};
        this.edgeSounds = {
            top: 'tr606kit/606BASS.WAV',
            left: 'tr606kit/606SNAR.WAV',
            right: 'tr606kit/606OHAT.WAV',
            bottom: 'tr606kit/606LTOM.WAV'
        };
        this.lastSoundTime = 0;
        this.soundDebounceTime = 50; // milliseconds between sounds
        
        // Edge flash properties
        this.edgeFlash = {
            top: { active: false, alpha: 0, duration: 0 },
            left: { active: false, alpha: 0, duration: 0 },
            right: { active: false, alpha: 0, duration: 0 },
            bottom: { active: false, alpha: 0, duration: 0 }
        };
        this.flashDuration = 300; // milliseconds
        this.flashIntensity = 0.8; // max alpha value
        
        // Animation timing
        this.lastTime = 0;
        
        // Color properties
        this.colors = [
            '#ff0000', // Red
            '#ff8000', // Orange
            '#ffff00', // Yellow
            '#80ff00', // Lime
            '#00ff00', // Green
            '#00ff80', // Spring Green
            '#00ffff', // Cyan
            '#0080ff', // Blue
            '#0000ff', // Blue
            '#8000ff', // Purple
            '#ff00ff', // Magenta
            '#ff0080'  // Pink
        ];
        this.currentColorIndex = 0;
        
        this.setupCanvas();
        this.setupControls();
        this.loadSounds();
        this.initializeLogos();
        this.updateLogoCount();
        
        // Handle audio context suspension/resumption
        this.setupAudioContextHandling();
        
        // Process logo when it loads
        this.logo.onload = () => {
            if (this.isSafari) {
                this.processLogoForColors();
            }
            this.animate();
        };
    }
    
    detectSafari() {
        const userAgent = navigator.userAgent;
        return /Safari/.test(userAgent) && /Apple Computer/.test(navigator.vendor) && !/Chrome/.test(userAgent);
    }
    
    setupCanvas() {
        // Set canvas size to window size
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });
    }
    
    setupControls() {
        // Control panel collapse functionality
        const controlPanel = document.getElementById('controlPanel');
        const collapseBtn = document.getElementById('collapseBtn');
        const controlHeader = document.querySelector('.control-header');
        
        controlHeader.addEventListener('click', () => {
            controlPanel.classList.toggle('collapsed');
            collapseBtn.textContent = controlPanel.classList.contains('collapsed') ? '+' : '−';
        });
        
        // Slider controls
        const angleVarianceSlider = document.getElementById('angleVariance');
        const speedVarianceSlider = document.getElementById('speedVariance');
        const globalSpeedSlider = document.getElementById('globalSpeed');
        
        const angleVarianceValue = document.getElementById('angleVarianceValue');
        const speedVarianceValue = document.getElementById('speedVarianceValue');
        const globalSpeedValue = document.getElementById('globalSpeedValue');
        
        // Update angle variance
        angleVarianceSlider.addEventListener('input', (e) => {
            this.angleVariance = parseInt(e.target.value);
            angleVarianceValue.textContent = this.angleVariance + '°';
        });
        
        // Update speed variance
        speedVarianceSlider.addEventListener('input', (e) => {
            this.speedVariance = parseInt(e.target.value);
            speedVarianceValue.textContent = this.speedVariance + '%';
        });
        
        // Update global speed
        globalSpeedSlider.addEventListener('input', (e) => {
            this.globalSpeed = parseFloat(e.target.value);
            globalSpeedValue.textContent = this.globalSpeed + 'x';
            
            // Adjust current velocity based on global speed
            const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const newSpeed = this.baseSpeed * this.globalSpeed;
            const scale = newSpeed / currentSpeed;
            this.vx *= scale;
            this.vy *= scale;
        });
        
        // Sound controls
        const topEdgeSelect = document.getElementById('topEdge');
        const leftEdgeSelect = document.getElementById('leftEdge');
        const rightEdgeSelect = document.getElementById('rightEdge');
        const bottomEdgeSelect = document.getElementById('bottomEdge');
        
        topEdgeSelect.addEventListener('change', (e) => {
            this.edgeSounds.top = e.target.value;
        });
        
        leftEdgeSelect.addEventListener('change', (e) => {
            this.edgeSounds.left = e.target.value;
        });
        
        rightEdgeSelect.addEventListener('change', (e) => {
            this.edgeSounds.right = e.target.value;
        });
        
        bottomEdgeSelect.addEventListener('change', (e) => {
            this.edgeSounds.bottom = e.target.value;
        });
        
        // Logo count controls
        const decreaseLogosBtn = document.getElementById('decreaseLogos');
        const increaseLogosBtn = document.getElementById('increaseLogos');
        const logoCountValue = document.getElementById('logoCountValue');
        
        decreaseLogosBtn.addEventListener('click', () => {
            if (this.logoCount > 1) {
                this.logoCount--;
                this.logos.pop(); // Remove the last logo
                this.updateLogoCount();
                this.resizeLogos();
            }
        });
        
        increaseLogosBtn.addEventListener('click', () => {
            if (this.logoCount < this.maxLogos) {
                this.logoCount++;
                this.logos.push(this.createLogo()); // Add a new logo
                this.updateLogoCount();
                this.resizeLogos();
            }
        });
        
        this.updateLogoCount = () => {
            logoCountValue.textContent = this.logoCount;
            decreaseLogosBtn.disabled = this.logoCount <= 1;
            increaseLogosBtn.disabled = this.logoCount >= this.maxLogos;
        };
        

    }
    
    initializeLogos() {
        this.logos = [];
        for (let i = 0; i < this.logoCount; i++) {
            this.logos.push(this.createLogo());
        }
        this.resizeLogos();
    }
    
    createLogo() {
        return {
            x: Math.random() * (this.canvas.width - this.baseLogoWidth),
            y: Math.random() * (this.canvas.height - this.baseLogoHeight),
            vx: (Math.random() - 0.5) * this.baseSpeed * 2,
            vy: (Math.random() - 0.5) * this.baseSpeed * 2,
            colorIndex: Math.floor(Math.random() * this.colors.length),
            width: this.baseLogoWidth,
            height: this.baseLogoHeight
        };
    }
    
    resizeLogos() {
        // Calculate scale based on number of logos
        // More logos = smaller size, but maintain minimum visibility
        const scale = Math.max(0.3, 1 - (this.logoCount - 1) * 0.15);
        
        this.logos.forEach(logo => {
            logo.width = this.baseLogoWidth * scale;
            logo.height = this.baseLogoHeight * scale;
        });
    }
    
    loadSounds() {
        // Initialize Web Audio API
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported, falling back to HTML5 Audio');
            this.audioContext = null;
        }
        
        // Preload all sound files
        const soundFiles = [
            'tr606kit/606BASS.WAV',
            'tr606kit/606SNAR.WAV',
            'tr606kit/606OHAT.WAV',
            'tr606kit/606CHAT.WAV',
            'tr606kit/606MHAT.WAV',
            'tr606kit/606LTOM.WAV',
            'tr606kit/606HTOM.WAV',
            'tr606kit/606CYMB.WAV'
        ];
        
        if (this.audioContext) {
            // Use Web Audio API for better scheduling
            soundFiles.forEach(file => {
                this.loadSoundWebAudio(file);
            });
        } else {
            // Fallback to HTML5 Audio
            soundFiles.forEach(file => {
                this.sounds[file] = new Audio(file);
            });
        }
    }
    
    async loadSoundWebAudio(file) {
        try {
            const response = await fetch(file);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.sounds[file] = audioBuffer;
        } catch (e) {
            console.log(`Failed to load sound: ${file}`, e);
        }
    }
    
    playSound(soundPath) {
        if (!soundPath) return;
        
        const currentTime = performance.now();
        
        // Debounce rapid sound triggers
        if (currentTime - this.lastSoundTime < this.soundDebounceTime) {
            return;
        }
        
        this.lastSoundTime = currentTime;
        
        if (this.audioContext && this.sounds[soundPath] instanceof AudioBuffer) {
            // Use Web Audio API for better scheduling
            this.playSoundWebAudio(soundPath);
        } else if (this.sounds[soundPath]) {
            // Fallback to HTML5 Audio
            this.playSoundHTML5(soundPath);
        }
    }
    
    playSoundWebAudio(soundPath) {
        try {
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = this.sounds[soundPath];
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Set volume
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            
            // Schedule the sound to play immediately
            source.start(this.audioContext.currentTime);
            
            // Clean up the source after it finishes
            source.onended = () => {
                source.disconnect();
                gainNode.disconnect();
            };
        } catch (e) {
            console.log('Web Audio play failed:', e);
        }
    }
    
    playSoundHTML5(soundPath) {
        try {
            // Clone the audio to allow overlapping sounds
            const sound = this.sounds[soundPath].cloneNode();
            sound.volume = 0.3; // Reduce volume to 30%
            sound.play().catch(e => console.log('Audio play failed:', e));
        } catch (e) {
            console.log('HTML5 Audio play failed:', e);
        }
    }
    
    setupAudioContextHandling() {
        if (!this.audioContext) return;
        
        // Resume audio context on user interaction
        const resumeAudio = () => {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        };
        
        // Listen for user interactions to resume audio context
        ['click', 'touchstart', 'keydown'].forEach(event => {
            document.addEventListener(event, resumeAudio, { once: true });
        });
        
        // Also resume on first sound play
        const originalPlaySound = this.playSound.bind(this);
        this.playSound = (soundPath) => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            originalPlaySound(soundPath);
        };
    }
    
    triggerEdgeFlash(edge) {
        if (this.edgeFlash[edge]) {
            this.edgeFlash[edge].active = true;
            this.edgeFlash[edge].alpha = this.flashIntensity;
            this.edgeFlash[edge].duration = this.flashDuration;
        }
    }
    
    updateEdgeFlashes(deltaTime) {
        Object.keys(this.edgeFlash).forEach(edge => {
            const flash = this.edgeFlash[edge];
            if (flash.active) {
                flash.duration -= deltaTime;
                if (flash.duration <= 0) {
                    flash.active = false;
                    flash.alpha = 0;
                } else {
                    // Fade out the flash
                    flash.alpha = this.flashIntensity * (flash.duration / this.flashDuration);
                }
            }
        });
    }
    
    resetLogo() {
        // Reset position to center
        this.x = this.canvas.width / 2 - this.logoWidth / 2;
        this.y = this.canvas.height / 2 - this.logoHeight / 2;
        
        // Reset velocity with random direction
        const angle = Math.random() * 2 * Math.PI;
        const speed = this.baseSpeed * this.globalSpeed;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
    }
    
    checkCollision(logo) {
        let bounced = false;
        let edgeHit = null;
        
        // Check horizontal boundaries
        if (logo.x <= 0) {
            logo.vx = -logo.vx;
            bounced = true;
            edgeHit = 'left';
        } else if (logo.x + logo.width >= this.canvas.width) {
            logo.vx = -logo.vx;
            bounced = true;
            edgeHit = 'right';
        }
        
        // Check vertical boundaries
        if (logo.y <= 0) {
            logo.vy = -logo.vy;
            bounced = true;
            edgeHit = 'top';
        } else if (logo.y + logo.height >= this.canvas.height) {
            logo.vy = -logo.vy;
            bounced = true;
            edgeHit = 'bottom';
        }
        
        if (bounced) {
            this.applyBounceVariance(logo);
            
            // Play sound for the edge that was hit
            if (edgeHit && this.edgeSounds[edgeHit]) {
                this.playSound(this.edgeSounds[edgeHit]);
            }
            
            // Trigger edge flash
            if (edgeHit) {
                this.triggerEdgeFlash(edgeHit);
            }
        }
        
        return bounced;
    }
    
    applyBounceVariance(logo) {
        // Apply angle variance
        if (this.angleVariance > 0) {
            const currentAngle = Math.atan2(logo.vy, logo.vx);
            const varianceRadians = (this.angleVariance * Math.PI) / 180;
            const randomAngle = currentAngle + (Math.random() - 0.5) * varianceRadians;
            
            const currentSpeed = Math.sqrt(logo.vx * logo.vx + logo.vy * logo.vy);
            logo.vx = Math.cos(randomAngle) * currentSpeed;
            logo.vy = Math.sin(randomAngle) * currentSpeed;
        }
        
        // Apply speed variance
        if (this.speedVariance > 0) {
            const currentSpeed = Math.sqrt(logo.vx * logo.vx + logo.vy * logo.vy);
            const varianceFactor = 1 + (Math.random() - 0.5) * (this.speedVariance / 100);
            const newSpeed = currentSpeed * varianceFactor;
            
            const angle = Math.atan2(logo.vy, logo.vx);
            logo.vx = Math.cos(angle) * newSpeed;
            logo.vy = Math.sin(angle) * newSpeed;
        }
        
        // Change color on bounce
        logo.colorIndex = (logo.colorIndex + 1) % this.colors.length;
    }
    
    update(deltaTime) {
        // Update edge flashes
        this.updateEdgeFlashes(deltaTime);
        
        // Update all logos
        this.logos.forEach(logo => {
            // Update position
            logo.x += logo.vx * this.globalSpeed;
            logo.y += logo.vy * this.globalSpeed;
            
            // Check for collisions
            this.checkCollision(logo);
            
            // Keep logo within bounds (safety check)
            logo.x = Math.max(0, Math.min(logo.x, this.canvas.width - logo.width));
            logo.y = Math.max(0, Math.min(logo.y, this.canvas.height - logo.height));
        });
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw all logos
        this.logos.forEach(logo => {
            if (this.isSafari) {
                // Safari: Use pre-processed colored logos
                if (this.logoProcessed) {
                    const colorCanvas = this.coloredLogos[logo.colorIndex];
                    this.ctx.drawImage(colorCanvas, logo.x, logo.y, logo.width, logo.height);
                } else {
                    // Fallback rectangle if image not loaded or processed
                    this.ctx.fillStyle = this.colors[logo.colorIndex];
                    this.ctx.fillRect(logo.x, logo.y, logo.width, logo.height);
                }
            } else {
                // Other browsers: Use original filter-based approach
                if (this.logo.complete) {
                    // First draw the white logo
                    this.ctx.globalCompositeOperation = 'source-over';
                    this.ctx.filter = 'brightness(0) invert(1)';
                    this.ctx.drawImage(this.logo, logo.x, logo.y, logo.width, logo.height);
                    this.ctx.filter = 'none';
                    
                    // Then overlay with the current color
                    this.ctx.globalCompositeOperation = 'multiply';
                    this.ctx.fillStyle = this.colors[logo.colorIndex];
                    this.ctx.fillRect(logo.x, logo.y, logo.width, logo.height);
                    this.ctx.globalCompositeOperation = 'source-over';
                } else {
                    // Fallback rectangle if image not loaded
                    this.ctx.fillStyle = this.colors[logo.colorIndex];
                    this.ctx.fillRect(logo.x, logo.y, logo.width, logo.height);
                }
            }
        });
        
        // Draw edge flashes
        this.drawEdgeFlashes();
    }
    
    drawEdgeFlashes() {
        this.ctx.globalCompositeOperation = 'screen';
        
        // Top edge flash
        if (this.edgeFlash.top.active) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${this.edgeFlash.top.alpha})`;
            this.ctx.fillRect(0, 0, this.canvas.width, 10);
        }
        
        // Left edge flash
        if (this.edgeFlash.left.active) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${this.edgeFlash.left.alpha})`;
            this.ctx.fillRect(0, 0, 10, this.canvas.height);
        }
        
        // Right edge flash
        if (this.edgeFlash.right.active) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${this.edgeFlash.right.alpha})`;
            this.ctx.fillRect(this.canvas.width - 10, 0, 10, this.canvas.height);
        }
        
        // Bottom edge flash
        if (this.edgeFlash.bottom.active) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${this.edgeFlash.bottom.alpha})`;
            this.ctx.fillRect(0, this.canvas.height - 10, this.canvas.width, 10);
        }
        
        this.ctx.globalCompositeOperation = 'source-over';
    }
    
    processLogoForColors() {
        if (this.logoProcessed) return;
        
        // Create a temporary canvas to process the logo
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Set canvas size to logo size
        tempCanvas.width = this.baseLogoWidth;
        tempCanvas.height = this.baseLogoHeight;
        
        // Draw the original logo
        tempCtx.drawImage(this.logo, 0, 0, this.baseLogoWidth, this.baseLogoHeight);
        
        // Get image data
        const imageData = tempCtx.getImageData(0, 0, this.baseLogoWidth, this.baseLogoHeight);
        const data = imageData.data;
        
        // Process each color
        this.colors.forEach((color, colorIndex) => {
            // Create a new canvas for this colored version
            const colorCanvas = document.createElement('canvas');
            const colorCtx = colorCanvas.getContext('2d');
            colorCanvas.width = this.baseLogoWidth;
            colorCanvas.height = this.baseLogoHeight;
            
            // Create new image data for this color
            const colorImageData = new ImageData(this.baseLogoWidth, this.baseLogoHeight);
            const colorData = colorImageData.data;
            
            // Convert hex color to RGB
            const hex = color.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            
            // Process each pixel
            for (let i = 0; i < data.length; i += 4) {
                const alpha = data[i + 3];
                
                if (alpha > 0) {
                    // For non-transparent pixels, use the color
                    colorData[i] = r;     // Red
                    colorData[i + 1] = g; // Green
                    colorData[i + 2] = b; // Blue
                    colorData[i + 3] = alpha; // Alpha
                } else {
                    // Keep transparent pixels transparent
                    colorData[i] = 0;
                    colorData[i + 1] = 0;
                    colorData[i + 2] = 0;
                    colorData[i + 3] = 0;
                }
            }
            
            // Put the colored image data back to the canvas
            colorCtx.putImageData(colorImageData, 0, 0);
            
            // Store the colored canvas
            this.coloredLogos[colorIndex] = colorCanvas;
        });
        
        this.logoProcessed = true;
    }
    
    animate(currentTime = 0) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.draw();
        requestAnimationFrame((time) => this.animate(time));
    }
}

// Initialize the DVD bouncing logo when the page loads
window.addEventListener('load', () => {
    new DVDBouncingLogo();
});
