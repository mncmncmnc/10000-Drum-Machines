document.addEventListener('DOMContentLoaded', () => {
    // Get all text containers and elements
    const textContainers = document.querySelectorAll('.text-container');
    const textElements = document.querySelectorAll('.text-element');
    
    // Get tools and panels
    const resizeTool = document.getElementById('resize-tool');
    const distortTool = document.getElementById('distort-tool');
    const panTool = document.getElementById('pan-tool');
    const sequenceTool = document.getElementById('sequence-tool');
    const echoTool = document.getElementById('echo-tool');
    const flipTool = document.getElementById('flip-tool');
    const muteTool = document.getElementById('mute-tool');
    const fontTool = document.getElementById('font-tool');
    const randomFontsTool = document.getElementById('random-fonts-tool');
    const playTool = document.getElementById('play-tool');
    const bpmInput = document.getElementById('bpm-input');
    const sequencerPanel = document.querySelector('.sequencer-panel');
    const echoPanel = document.querySelector('.echo-panel');

    // Track currently selected container and last selected container
    let selectedContainer = null;
    let lastSelectedContainer = document.getElementById('bass-drum'); // Set default last selected container

    // State tracking for each text element
    const textStates = new Map();
    textContainers.forEach(container => {
        const element = container.querySelector('.text-element');
        textStates.set(container, {
            isResizing: false,
            isDistorting: false,
            isRotating: false,
            isFlipped: false,
            isMuted: false,
            currentHandle: null,
            startX: 0,
            startY: 0,
            startFontSize: 48,
            startLeft: 0,
            startTop: 0,
            startRotation: 0,
            startScaleX: 1,
            startScaleY: 1,
            currentRotation: 0,
            currentSkewX: 0,
            currentSkewY: 0,
            currentScaleX: 1,
            currentScaleY: 1,
            observer: null
        });
    });

    // Sequencer state
    let isPlaying = false;
    let currentStep = 0;
    let sequencerInterval = null;
    let bpm = 120;

    // Sound Manager class to handle loading and playing sounds
    class SoundManager {
        constructor() {
            this.sounds = new Map();
            this.loadedSounds = new Map();
            this.reversedSounds = new Map(); // Map for reversed sounds per container-font
            this.context = null;
            this.gainNodes = new Map();
            this.distortionNodes = new Map();
            this.filterNodes = new Map();
            this.distortionGainNodes = new Map();
            this.pannerNodes = new Map();
            this.panValues = new Map();
            this.echoNodes = new Map();
            this.echoValues = new Map();
            this.currentBpm = 120; // Store current BPM
            this.soundMappings = {
                'bass-drum': {
                    'Arial': 'bassdrum/bassdrumBD0075_808.WAV',
                    'Times New Roman': 'bassdrum/bassBTAA0D3_909.WAV',
                    'Courier New': 'bassdrum/kick_dm1.wav',
                    'Comic Sans MS': 'bassdrum/kick_909_dmx.wav',
                    'Bungee': 'bassdrum/kick_rounded_impact.wav',
                    'Rye': 'bassdrum/kick_taka_hollow.wav',
                    'Monoton': 'bassdrum/kick_xdfg.wav',
                    'UnifrakturCook': 'bassdrum/kick_yolo.wav',
                    'Orbitron': 'bassdrum/bass_hit_1.wav',
                    'DotGothic16': 'bassdrum/bass_drum_thick.wav',
                    'Major Mono Display': 'bassdrum/bass_thunk.wav',
                    'Redacted': 'bassdrum/drum_060_sine_drop.wav',
                    'Ceviche One': 'bassdrum/Kick_2.wav',
                    'Raleway Dots': 'bassdrum/13_Kick_007.wav',
                    'Sigmar': 'bassdrum/20_Kick_014.wav',
                    'DynaPuff': 'bassdrum/350_Kick_18.wav',
                    'Gochi Hand': 'bassdrum/kicklast.wav'
                },
                'hi-hat': {
                    'Arial': 'hihat/closedhatCH_808.WAV',
                    'Times New Roman': 'hihat/hihat_combo_606.wav',
                    'Courier New': 'hihat/hihat_dm-1.wav',
                    'Comic Sans MS': 'hihat/oh_dm1.wav',
                    'Bungee': 'hihat/hihat_closed_bull_whip.wav',
                    'Rye': 'hihat/hihat_closed_crack.wav',
                    'Monoton': 'hihat/hihat_closed_trash.wav',
                    'UnifrakturCook': 'hihat/hihat_closed_source.wav',
                    'Orbitron': 'hihat/hihat_open_electronic.wav',
                    'DotGothic16': 'hihat/hihat_open_good.wav',
                    'Major Mono Display': 'hihat/hihat_open_chopped.wav',
                    'Redacted': 'hihat/hihat_open_brim.wav',
                    'Ceviche One': 'hihat/hihat_open_dm_vintage.wav',
                    'Raleway Dots': 'hihat/57_Closed_Hat_002.wav',
                    'Sigmar': 'hihat/hihat_closed_c78.wav',
                    'DynaPuff': 'hihat/openhatOH10_808.WAV',
                    'Gochi Hand': 'hihat/snaphat.wav'
                },
                'snare-drum': {
                    'Arial': 'snare/snareSD7550__808.WAV',
                    'Times New Roman': 'snare/snareST3T3SA__909.WAV',
                    'Courier New': 'snare/snare_dm-1.wav',
                    'Comic Sans MS': 'snare/snare_606.wav',
                    'Bungee': 'snare/snare_soft_ring.wav',
                    'Rye': 'snare/snare_soft_e.wav',
                    'Monoton': 'snare/snare_geomatrix.wav',
                    'UnifrakturCook': 'snare/snare_dc_snare.wav',
                    'Orbitron': 'snare/snare_bizzness_sp1200r.wav',
                    'DotGothic16': 'snare/snare_acoustic.wav',
                    'Major Mono Display': 'snare/snare_70s_funk_mpc.wav',
                    'Redacted': 'snare/354_Snare_003.wav',
                    'Ceviche One': 'snare/365_Snare_014.wav',
                    'Raleway Dots': 'snare/89_Perc_1.wav',
                    'Sigmar': 'snare/Snare_24.wav',
                    'DynaPuff': 'snare/snare_verb_h3500_2.wav',
                    'Gochi Hand': 'snare/orchsnare.wav'
                },
                'hand-clap': {
                    'Arial': 'handclap/clap_808.wav',
                    'Times New Roman': 'handclap/clap909.wav',
                    'Courier New': 'handclap/clap_dmx.wav',
                    'Comic Sans MS': 'handclap/clap_808_light_quick.wav',
                    'Bungee': 'handclap/clap_cargo.wav',
                    'Rye': 'handclap/clap_vinyl.wav',
                    'Monoton': 'handclap/clap_tight.wav',
                    'UnifrakturCook': 'handclap/clap_super_duper_layer.wav',
                    'Orbitron': 'handclap/clap_rk_2.wav',
                    'DotGothic16': 'handclap/clap_hugo_clones.wav',
                    'Major Mono Display': 'handclap/clap_people.wav',
                    'Redacted': 'handclap/clap_electrified.wav',
                    'Ceviche One': 'handclap/clap_boss.wav',
                    'Raleway Dots': 'handclap/154_Perc_FX_039.wav',
                    'Sigmar': 'handclap/83_Clap_2.wav',
                    'DynaPuff': 'handclap/Perc_2.wav',
                    'Gochi Hand': 'handclap/clapambience.wav'
                }
            };
        }

        async initializeAudio() {
            if (!this.context) {
                this.context = new (window.AudioContext || window.webkitAudioContext)();
                // Resume the context (needed for Chrome)
                if (this.context.state === 'suspended') {
                    await this.context.resume();
                }
                
                // Create custom waveshaper curve for overdrive
                this.createOverdriveCurve();
            }
            return this.context;
        }

        // Create a custom waveshaper curve for overdrive effect
        createOverdriveCurve() {
            const curve = new Float32Array(44100);
            const deg = Math.PI / 180;
            
            for (let i = 0; i < 44100; ++i) {
                const x = (i * 2) / 44100 - 1;
                // Create a more aggressive waveshaping curve with stronger harmonics
                // Using a combination of soft clipping and hard clipping
                const softClip = (3 + 2) * x * 20 * deg / (Math.PI + 2 * Math.abs(x));
                const hardClip = Math.sign(x) * (1 - Math.exp(-Math.abs(x) * 5));
                // Mix the two curves for more complex distortion, with more hard clipping
                curve[i] = (softClip * 0.5 + hardClip * 0.5) * 1.8; // More hard clipping and more boost
            }
            
            this.overdriveCurve = curve;
        }

        // Get or create distortion processing chain for a container
        getDistortionChain(containerId) {
            if (!this.context) return null;
            
            if (!this.distortionNodes.has(containerId)) {
                // Create nodes for the distortion chain
                const waveshaper = this.context.createWaveShaper();
                const filter = this.context.createBiquadFilter();
                const distortionGain = this.context.createGain();
                
                // Configure waveshaper
                waveshaper.curve = this.overdriveCurve;
                waveshaper.oversample = '4x';
                
                // Configure filter
                filter.type = 'lowpass';
                filter.frequency.value = 2000;
                filter.Q.value = 1;
                
                // Configure distortion gain
                distortionGain.gain.value = 0.5; // Default mix level
                
                // Store nodes
                this.distortionNodes.set(containerId, waveshaper);
                this.filterNodes.set(containerId, filter);
                this.distortionGainNodes.set(containerId, distortionGain);
            }
            
            return {
                waveshaper: this.distortionNodes.get(containerId),
                filter: this.filterNodes.get(containerId),
                gain: this.distortionGainNodes.get(containerId)
            };
        }

        // Update distortion parameters based on handle position
        updateDistortion(containerId, handle, deltaX, deltaY) {
            const chain = this.getDistortionChain(containerId);
            if (!chain) return;
            
            const rect = document.getElementById(containerId).getBoundingClientRect();
            const maxDistortion = 1.5; // Increased distortion range
            const maxFilterFreq = 8000; // Back to original
            const minFilterFreq = 200; // Back to original
            
            // Calculate normalized values (-1 to 1)
            const normX = Math.max(-1, Math.min(1, deltaX / rect.width));
            const normY = Math.max(-1, Math.min(1, deltaY / rect.height));
            
            // Different handles control different aspects
            if (handle.classList.contains('bottom-right')) {
                // Control distortion amount and filter frequency
                chain.gain.gain.value = 0.4 + (Math.abs(normX) * maxDistortion); // Higher base gain
                chain.filter.frequency.value = minFilterFreq + (Math.abs(normY) * (maxFilterFreq - minFilterFreq));
                chain.filter.Q.value = 1 + (Math.abs(normX) * 5); // Back to original resonance
            } else if (handle.classList.contains('bottom-left')) {
                // Control distortion amount and filter type
                chain.gain.gain.value = 0.4 + (Math.abs(normX) * maxDistortion);
                chain.filter.type = normY > 0 ? 'highpass' : 'lowpass';
                chain.filter.frequency.value = minFilterFreq + (Math.abs(normY) * (maxFilterFreq - minFilterFreq));
                chain.filter.Q.value = 1; // Fixed Q for cleaner filtering
            } else if (handle.classList.contains('top-right')) {
                // Control filter frequency and resonance
                chain.filter.frequency.value = minFilterFreq + (Math.abs(normX) * (maxFilterFreq - minFilterFreq));
                chain.filter.Q.value = 1 + (Math.abs(normY) * 10);
                chain.gain.gain.value = 0.4 + (Math.abs(normY) * maxDistortion);
            } else if (handle.classList.contains('top-left')) {
                // Control overall mix and filter type
                chain.gain.gain.value = 0.4 + (Math.abs(normX) * maxDistortion);
                chain.filter.type = normY > 0 ? 'bandpass' : 'notch';
                chain.filter.frequency.value = minFilterFreq + (Math.abs(normY) * (maxFilterFreq - minFilterFreq));
                chain.filter.Q.value = 1; // Fixed Q for cleaner filtering
            }
        }

        // Add method to get or create gain node for a container
        getGainNode(containerId) {
            // Only create gain node if we have an audio context
            if (!this.context) return null;
            
            if (!this.gainNodes.has(containerId)) {
                const gainNode = this.context.createGain();
                gainNode.gain.value = 0.5; // Set default volume to 50%
                this.gainNodes.set(containerId, gainNode);
            }
            return this.gainNodes.get(containerId);
        }

        // Update volume based on text size
        updateVolume(containerId, fontSize) {
            // Only create gain node if we're actually playing sound
            if (!this.context || !this.loadedSounds.size) return;
            
            const gainNode = this.getGainNode(containerId);
            if (!gainNode) return;

            // More reasonable size range: 12px to 200px
            const minSize = 12;
            const maxSize = 200;
            const minVolume = 0.1;  // 10% volume
            const maxVolume = 1.0;  // 100% volume

            // Clamp the font size to our range
            const clampedSize = Math.max(minSize, Math.min(maxSize, fontSize));
            
            // Calculate normalized value between 0 and 1
            const normalizedSize = (clampedSize - minSize) / (maxSize - minSize);
            
            // Use quadratic curve (x²) for more intuitive volume control
            // This means volume increases more quickly with size
            const volume = minVolume + (maxVolume - minVolume) * (normalizedSize * normalizedSize);
            
            // Clamp the final volume to ensure it stays in range
            const clampedVolume = Math.max(minVolume, Math.min(maxVolume, volume));
            
            // Apply volume change with a small ramp to avoid clicks
            gainNode.gain.setTargetAtTime(clampedVolume, this.context.currentTime, 0.01);
        }

        async loadSound(containerId, fontFamily) {
            // Initialize audio context if not already done
            await this.initializeAudio();
            
            const soundPath = this.soundMappings[containerId][fontFamily];
            if (!soundPath) return null;

            const key = `${containerId}-${fontFamily}`;
            if (this.loadedSounds.has(key)) {
                return this.loadedSounds.get(key);
            }

            try {
                const response = await fetch(`txtdrums/${soundPath}`);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
                this.loadedSounds.set(key, audioBuffer);
                return audioBuffer;
            } catch (error) {
                console.error(`Error loading sound ${soundPath}:`, error);
                return null;
            }
        }

        // Get or create panner node for a container
        getPannerNode(containerId) {
            if (!this.context) return null;
            
            if (!this.pannerNodes.has(containerId)) {
                const panner = this.context.createStereoPanner();
                // Initialize with stored pan value or center
                panner.pan.value = this.panValues.get(containerId) || 0;
                this.pannerNodes.set(containerId, panner);
            }
            return this.pannerNodes.get(containerId);
        }

        // Update pan position for a container
        updatePan(containerId, panValue) {
            // Clamp pan value between -1 and 1
            const clampedPan = Math.max(-1, Math.min(1, panValue));
            
            // Store the pan value
            this.panValues.set(containerId, clampedPan);
            
            // Update the panner if it exists with smooth transition
            const panner = this.pannerNodes.get(containerId);
            if (panner) {
                // Use setTargetAtTime for smooth transition
                // Parameters: target value, current time, time constant (in seconds)
                // Lower time constant = faster transition, higher = smoother
                panner.pan.setTargetAtTime(clampedPan, this.context.currentTime, 0.01);
            }
        }

        // Calculate delay time based on BPM
        calculateDelayTime(bpm) {
            // Calculate time for a dotted eighth note (3/16 of a beat)
            // 60 seconds / BPM = time for one beat
            // Multiply by 3/16 for dotted eighth note
            return (60 / bpm) * (3/16);
        }

        // Update BPM for echo timing
        updateBpm(bpm) {
            this.currentBpm = bpm;
            const delayTime = this.calculateDelayTime(bpm);
            
            // Update delay time for all active echo chains
            this.echoNodes.forEach(chain => {
                chain.delay.delayTime.setTargetAtTime(delayTime, this.context.currentTime, 0.01);
            });
        }

        // Get or create echo processing chain for a container
        getEchoChain(containerId) {
            if (!this.context) return null;
            
            if (!this.echoNodes.has(containerId)) {
                // Create nodes for echo chain
                const delay = this.context.createDelay();
                const feedback = this.context.createGain();
                const wetGain = this.context.createGain();
                const dryGain = this.context.createGain();
                
                // Configure initial values with BPM-synced delay
                delay.delayTime.value = this.calculateDelayTime(this.currentBpm);
                feedback.gain.value = 0.3;
                wetGain.gain.value = 0.5;
                dryGain.gain.value = 0.5;
                
                // Store nodes
                this.echoNodes.set(containerId, {
                    delay,
                    feedback,
                    wetGain,
                    dryGain
                });
                
                // Initialize with stored values if they exist
                const storedValues = this.echoValues.get(containerId);
                if (storedValues) {
                    this.updateEcho(containerId, storedValues.layers);
                }
            }
            
            return this.echoNodes.get(containerId);
        }

        // Update echo parameters based on number of layers
        updateEcho(containerId, layers) {
            const chain = this.getEchoChain(containerId);
            if (!chain) return;
            
            // Store the echo settings
            this.echoValues.set(containerId, { layers });
            
            if (layers === 0) {
                // When layers is 0, completely disable echo
                chain.wetGain.gain.setTargetAtTime(0, this.context.currentTime, 0.01);
                chain.dryGain.gain.setTargetAtTime(1, this.context.currentTime, 0.01);
                chain.feedback.gain.setTargetAtTime(0, this.context.currentTime, 0.01);
                return;
            }
            
            // Calculate wet/dry mix based on layers (1-6)
            // More layers = more wet signal
            const wetMix = Math.min(0.8, 0.3 + (layers * 0.0625)); // 0.3 to 0.8
            const dryMix = 1 - wetMix;
            
            // Calculate feedback based on layers
            // More layers = more feedback
            const feedbackAmount = Math.min(0.6, 0.2 + (layers * 0.05)); // 0.2 to 0.6
            
            // Smoothly update the values
            chain.wetGain.gain.setTargetAtTime(wetMix, this.context.currentTime, 0.01);
            chain.dryGain.gain.setTargetAtTime(dryMix, this.context.currentTime, 0.01);
            chain.feedback.gain.setTargetAtTime(feedbackAmount, this.context.currentTime, 0.01);
        }

        // Add method to reverse an audio buffer
        reverseBuffer(buffer, containerId, fontFamily) {
            const key = `${containerId}-${fontFamily}-reversed`;
            if (this.reversedSounds.has(key)) {
                return this.reversedSounds.get(key);
            }

            // Create a new buffer with the same properties
            const reversedBuffer = this.context.createBuffer(
                buffer.numberOfChannels,
                buffer.length,
                buffer.sampleRate
            );

            // Reverse each channel
            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                const channelData = buffer.getChannelData(channel);
                const reversedData = reversedBuffer.getChannelData(channel);
                
                // Copy data in reverse
                for (let i = 0; i < buffer.length; i++) {
                    reversedData[i] = channelData[buffer.length - 1 - i];
                }
            }

            // Store the reversed buffer with container-font specific key
            this.reversedSounds.set(key, reversedBuffer);
            return reversedBuffer;
        }

        async playSound(containerId, fontFamily) {
            // Initialize audio context if not already done
            await this.initializeAudio();
            
            const key = `${containerId}-${fontFamily}`;
            const buffer = this.loadedSounds.get(key);
            if (!buffer) return;

            const source = this.context.createBufferSource();
            
            // Check if this specific text element is flipped
            const container = document.getElementById(containerId);
            const state = textStates.get(container);
            if (state.isFlipped) {
                // Use reversed buffer for this specific container-font combination
                source.buffer = this.reverseBuffer(buffer, containerId, fontFamily);
            } else {
                source.buffer = buffer;
            }
            
            // Get or create gain node for this container
            const gainNode = this.getGainNode(containerId);
            
            // Get or create panner node
            const pannerNode = this.getPannerNode(containerId);
            
            // Get echo chain if echo is enabled
            const element = container.querySelector('.text-element');
            const echoEnabled = element.classList.contains('echo-enabled');
            const echoChain = echoEnabled ? this.getEchoChain(containerId) : null;
            
            // Check if this specific text element is currently being distorted
            const isCurrentlyDistorting = state.isDistorting && container === selectedContainer;
            
            if (isCurrentlyDistorting) {
                // Get distortion chain
                const chain = this.getDistortionChain(containerId);
                
                // Create a dry/wet mixer for distortion
                const dryGain = this.context.createGain();
                const wetGain = this.context.createGain();
                
                // Set up the processing chain
                source.connect(gainNode);
                gainNode.connect(dryGain);
                gainNode.connect(chain.waveshaper);
                chain.waveshaper.connect(chain.filter);
                chain.filter.connect(chain.gain);
                chain.gain.connect(wetGain);
                
                if (echoChain) {
                    // Connect distortion to echo
                    dryGain.connect(echoChain.dryGain);
                    wetGain.connect(echoChain.delay);
                    echoChain.delay.connect(echoChain.feedback);
                    echoChain.feedback.connect(echoChain.delay);
                    echoChain.delay.connect(echoChain.wetGain);
                    
                    // Connect echo outputs to panner
                    echoChain.dryGain.connect(pannerNode);
                    echoChain.wetGain.connect(pannerNode);
                } else {
                    // Connect distortion directly to panner
                    dryGain.connect(pannerNode);
                    wetGain.connect(pannerNode);
                }
                
                // Set dry/wet mix for distortion
                dryGain.gain.value = 0.25;
                wetGain.gain.value = 0.75;
            } else {
                // Normal routing
                source.connect(gainNode);
                
                if (echoChain) {
                    // Connect through echo chain
                    gainNode.connect(echoChain.dryGain);
                    gainNode.connect(echoChain.delay);
                    echoChain.delay.connect(echoChain.feedback);
                    echoChain.feedback.connect(echoChain.delay);
                    echoChain.delay.connect(echoChain.wetGain);
                    
                    // Connect echo outputs to panner
                    echoChain.dryGain.connect(pannerNode);
                    echoChain.wetGain.connect(pannerNode);
                } else {
                    // Connect directly to panner
                    gainNode.connect(pannerNode);
                }
            }
            
            pannerNode.connect(this.context.destination);
            source.start();
        }
    }

    // Initialize sound manager
    const soundManager = new SoundManager();

    // Function to get random fonts with no repeats
    async function assignRandomFonts() {
        const fonts = [
            'Arial',
            'Times New Roman',
            'Courier New',
            'Comic Sans MS',
            'Bungee',
            'Rye',
            'Monoton',
            'UnifrakturCook',
            'Orbitron',
            'DotGothic16',
            'Major Mono Display',
            'Redacted',
            'Ceviche One',
            'Raleway Dots',
            'Sigmar',
            'DynaPuff',
            'Gochi Hand'
        ];
        
        // Shuffle array using Fisher-Yates algorithm
        for (let i = fonts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [fonts[i], fonts[j]] = [fonts[j], fonts[i]];
        }
        
        // Initialize audio context if needed
        if (!soundManager.context) {
            await soundManager.initializeAudio();
        }
        
        // Assign first 4 fonts to the text elements
        for (const container of textContainers) {
            const element = container.querySelector('.text-element');
            const fontSelect = container.querySelector('.font-select');
            const selectedFont = fonts[Array.from(textContainers).indexOf(container)];
            
            // Set the font
            element.style.fontFamily = selectedFont;
            
            // Update the select to match
            fontSelect.value = selectedFont;
            
            // Load the new sound
            await soundManager.loadSound(container.id, selectedFont);
            
            // Handle Major Mono Display special case
            if (selectedFont === 'Major Mono Display') {
                // Store current text as original if not already stored
                if (!element.hasAttribute('data-original-text')) {
                    element.setAttribute('data-original-text', element.textContent);
                }
                // Convert to lowercase
                element.textContent = element.textContent.toLowerCase();
            } else {
                // If switching from Major Mono Display, restore original text
                if (element.hasAttribute('data-original-text')) {
                    element.textContent = element.getAttribute('data-original-text');
                    element.removeAttribute('data-original-text');
                }
            }
            
            // Update size to match new font
            updateSize(container, parseInt(window.getComputedStyle(element).fontSize));
        }
    }

    // Function to safely select a container
    function selectContainer(container) {
        if (!container) return;
        
        // Clear any active states from the previous container
        if (selectedContainer) {
            const prevState = textStates.get(selectedContainer);
            if (prevState) {
                prevState.isResizing = false;
                prevState.isDistorting = false;
                prevState.isRotating = false;
                prevState.currentHandle = null;
            }
            selectedContainer.classList.remove('selected');
        }
        
        // Select new container
        selectedContainer = container;
        lastSelectedContainer = container; // Update last selected
        selectedContainer.classList.add('selected');

        // Update cursor styles based on active tool
        if (resizeTool.classList.contains('active')) {
            container.style.cursor = 'default';
            container.querySelectorAll('.resize-handle').forEach(handle => {
                if (handle.classList.contains('bottom-right')) {
                    handle.style.cursor = 'nwse-resize';
                } else if (handle.classList.contains('bottom-left')) {
                    handle.style.cursor = 'nesw-resize';
                } else if (handle.classList.contains('top-right')) {
                    handle.style.cursor = 'nesw-resize';
                } else if (handle.classList.contains('top-left')) {
                    handle.style.cursor = 'nwse-resize';
                }
            });
        } else if (distortTool.classList.contains('active')) {
            container.style.cursor = 'default';
            container.querySelectorAll('.distort-handle').forEach(handle => {
                if (handle.classList.contains('bottom-right')) {
                    handle.style.cursor = 'nwse-resize';
                } else if (handle.classList.contains('bottom-left')) {
                    handle.style.cursor = 'nesw-resize';
                } else if (handle.classList.contains('top-right')) {
                    handle.style.cursor = 'nesw-resize';
                } else if (handle.classList.contains('top-left')) {
                    handle.style.cursor = 'nwse-resize';
                }
            });
        } else if (panTool.classList.contains('active')) {
            container.style.cursor = 'grab';
            container.querySelectorAll('.resize-handle').forEach(handle => {
                handle.style.cursor = 'grab';
            });
            // Ensure 3D transform style is preserved
            container.querySelector('.text-element').style.transformStyle = 'preserve-3d';
        }

        // Initialize pan value if not set
        if (!soundManager.panValues.has(container.id)) {
            // Calculate initial pan from current rotation
            const element = container.querySelector('.text-element');
            const transform = window.getComputedStyle(element).transform;
            const matrix = new DOMMatrix(transform);
            const rotation = Math.round(Math.atan2(matrix.m21, matrix.m11) * (180/Math.PI));
            const panValue = rotation / 65; // Map rotation to pan
            soundManager.updatePan(container.id, panValue);
        }
    }

    // Function to safely deselect current container
    function deselectContainer() {
        if (selectedContainer) {
            selectedContainer.classList.remove('selected');
            selectedContainer = null;
        }
    }

    // Helper function to set cursor styles - only used internally
    function setCursorStylesForTool(container, tool) {
        if (!container) return;
        
        if (tool === 'resize') {
            container.style.cursor = 'default';
            container.querySelectorAll('.resize-handle').forEach(handle => {
                if (handle.classList.contains('bottom-right')) {
                    handle.style.cursor = 'nwse-resize';
                } else if (handle.classList.contains('bottom-left')) {
                    handle.style.cursor = 'nesw-resize';
                } else if (handle.classList.contains('top-right')) {
                    handle.style.cursor = 'nesw-resize';
                } else if (handle.classList.contains('top-left')) {
                    handle.style.cursor = 'nwse-resize';
                }
            });
        } else if (tool === 'distort') {
            container.style.cursor = 'default';
            container.querySelectorAll('.distort-handle').forEach(handle => {
                if (handle.classList.contains('bottom-right')) {
                    handle.style.cursor = 'nwse-resize';
                } else if (handle.classList.contains('bottom-left')) {
                    handle.style.cursor = 'nesw-resize';
                } else if (handle.classList.contains('top-right')) {
                    handle.style.cursor = 'nesw-resize';
                } else if (handle.classList.contains('top-left')) {
                    handle.style.cursor = 'nwse-resize';
                }
            });
        } else if (tool === 'pan') {
            container.style.cursor = 'grab';
            container.querySelectorAll('.resize-handle').forEach(handle => {
                handle.style.cursor = 'grab';
            });
            container.querySelector('.text-element').style.transformStyle = 'preserve-3d';
        }
    }

    // Function to handle tool activation with container selection
    function activateToolWithContainer(tool, container) {
        if (!container) return;
        
        // Clear any active states from all containers
        textContainers.forEach(cont => {
            const contState = textStates.get(cont);
            if (contState) {
                contState.isResizing = false;
                contState.isDistorting = false;
                contState.isRotating = false;
                contState.currentHandle = null;
            }
        });
        
        // Remove any existing event listeners
        document.removeEventListener('mousemove', handleRotateMouseMove);
        document.removeEventListener('mouseup', handleRotateMouseUp);
        
        if (tool.classList.contains('active')) {
            deactivateAllTools();
        } else {
            deactivateAllTools();
            tool.classList.add('active');
            selectContainer(container);
            
            // Set cursor styles based on tool
            const toolType = tool.id.replace('-tool', '');
            setCursorStylesForTool(container, toolType);
            
            // Show appropriate panel
            if (tool === sequenceTool) {
                container.querySelector('.sequencer-panel').classList.remove('hidden');
            } else if (tool === echoTool) {
                container.querySelector('.echo-panel').classList.remove('hidden');
                const element = container.querySelector('.text-element');
                element.setAttribute('data-text', element.textContent);
            } else if (tool === fontTool) {
                container.querySelector('.font-panel').classList.remove('hidden');
            }
        }
    }

    // Function to update text size for a specific container
    function updateSize(container, newFontSize) {
        const element = container.querySelector('.text-element');
        // Enforce minimum and maximum sizes (in pixels)
        newFontSize = Math.max(12, Math.min(20000, newFontSize));
        
        // Update the text element
        element.style.fontSize = `${newFontSize}px`;
        
        // Update volume based on new size
        soundManager.updateVolume(container.id, newFontSize);
        
        // Force a reflow to get accurate measurements
        element.offsetHeight;
        
        // Update container size to match text exactly
        const textWidth = element.offsetWidth;
        const textHeight = element.offsetHeight;
        container.style.width = `${textWidth + 20}px`;  // Add padding
        container.style.height = `${textHeight + 20}px`;  // Add padding
    }

    // Handle mouse events for resizing and distorting
    textContainers.forEach(container => {
        const state = textStates.get(container);
        
        container.querySelectorAll('.resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                if (!resizeTool.classList.contains('active') || container !== selectedContainer) return;
                
                e.preventDefault();
                e.stopPropagation();
                
                state.isResizing = true;
                state.currentHandle = handle;
                
                // Get initial positions and sizes
                state.startX = e.clientX;
                state.startY = e.clientY;
                state.startFontSize = parseInt(window.getComputedStyle(container.querySelector('.text-element')).fontSize);
                
                // Add temporary event listeners
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            });
        });

        container.querySelectorAll('.distort-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                if (!distortTool.classList.contains('active') || container !== selectedContainer) return;
                
                e.preventDefault();
                e.stopPropagation();
                
                state.isDistorting = true;
                state.currentHandle = handle;
                
                // Get initial positions and current scale
                state.startX = e.clientX;
                state.startY = e.clientY;
                const transform = window.getComputedStyle(container.querySelector('.text-element')).transform;
                const matrix = new DOMMatrix(transform);
                state.startScaleX = matrix.m11;
                state.startScaleY = matrix.m22;
                
                // Add temporary event listeners
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            });
        });
    });

    function handleMouseMove(e) {
        if (!selectedContainer) return;
        const state = textStates.get(selectedContainer);
        if (!state.isResizing && !state.isDistorting) return;

        const deltaX = e.clientX - state.startX;
        const deltaY = e.clientY - state.startY;
        const element = selectedContainer.querySelector('.text-element');
        
        // Get initial container dimensions and position
        const startRect = selectedContainer.getBoundingClientRect();
        const startWidth = startRect.width;
        const startHeight = startRect.height;
        const startLeft = parseFloat(window.getComputedStyle(selectedContainer).left);
        const startTop = parseFloat(window.getComputedStyle(selectedContainer).top);
        
        if (state.isResizing) {
            // Calculate the scale factor based on the dominant direction of movement
            let scaleFactor;
            let newLeft = startLeft;
            let newTop = startTop;
            
            // Minimum font size (in pixels)
            const MIN_FONT_SIZE = 12;
            // Minimum container size (in pixels, including padding)
            const MIN_CONTAINER_SIZE = 50;
            
            if (state.currentHandle.classList.contains('bottom-right')) {
                scaleFactor = 1 + Math.max(deltaX / startWidth, deltaY / startHeight);
            } else if (state.currentHandle.classList.contains('bottom-left')) {
                scaleFactor = 1 + Math.max(-deltaX / startWidth, deltaY / startHeight);
                // Only adjust left position based on width change
                newLeft = startLeft + (startWidth * (scaleFactor - 1));
            } else if (state.currentHandle.classList.contains('top-right')) {
                scaleFactor = 1 + Math.max(deltaX / startWidth, -deltaY / startHeight);
                // Only adjust top position based on height change
                newTop = startTop + (startHeight * (scaleFactor - 1));
            } else if (state.currentHandle.classList.contains('top-left')) {
                scaleFactor = 1 + Math.max(-deltaX / startWidth, -deltaY / startHeight);
                // Adjust both left and top positions based on width and height changes
                newLeft = startLeft + (startWidth * (scaleFactor - 1));
                newTop = startTop + (startHeight * (scaleFactor - 1));
            }
            
            // Calculate new font size based on scale factor, with minimum constraint
            const newFontSize = Math.max(MIN_FONT_SIZE, state.startFontSize * scaleFactor);
            
            // Update font size
            element.style.fontSize = `${newFontSize}px`;
            
            // Update volume based on new size
            soundManager.updateVolume(selectedContainer.id, newFontSize);
            
            // Force a reflow to get accurate measurements
            element.offsetHeight;
            
            // Get the base dimensions of the text
            const baseWidth = element.offsetWidth;
            const baseHeight = element.offsetHeight;
            
            // Calculate container size based on whether text is distorted
            if (state.currentSkewX === 0 && state.currentSkewY === 0 && 
                state.currentScaleX === 1 && state.currentScaleY === 1) {
                // For undistorted text, use exact dimensions with minimum size
                selectedContainer.style.width = `${Math.max(MIN_CONTAINER_SIZE, baseWidth + 20)}px`;
                selectedContainer.style.height = `${Math.max(MIN_CONTAINER_SIZE, baseHeight + 20)}px`;
            } else {
                // For distorted text, calculate proportional scaling
                const skewXRad = Math.abs(state.currentSkewX) * (Math.PI / 180);
                const skewYRad = Math.abs(state.currentSkewY) * (Math.PI / 180);
                
                // Calculate the additional space needed due to skew
                const skewWidth = baseHeight * Math.tan(skewXRad);
                const skewHeight = baseWidth * Math.tan(skewYRad);
                
                // Calculate the scale ratio relative to the original font size
                const scaleRatio = newFontSize / state.startFontSize;
                
                // Calculate the base dimensions with distortion
                const distortedWidth = (baseWidth * state.currentScaleX) + skewWidth;
                const distortedHeight = (baseHeight * state.currentScaleY) + skewHeight;
                
                // Apply proportional scaling while maintaining distortion
                const finalWidth = distortedWidth * scaleRatio;
                const finalHeight = distortedHeight * scaleRatio;
                
                // Update container size with padding and minimum size constraint
                selectedContainer.style.width = `${Math.max(MIN_CONTAINER_SIZE, finalWidth + 20)}px`;
                selectedContainer.style.height = `${Math.max(MIN_CONTAINER_SIZE, finalHeight + 20)}px`;
            }
            
            // Update position only for left and top handles
            if (state.currentHandle.classList.contains('left') || state.currentHandle.classList.contains('top')) {
                selectedContainer.style.left = `${newLeft}px`;
                selectedContainer.style.top = `${newTop}px`;
            }
        } else if (state.isDistorting) {
            // Update audio distortion parameters
            soundManager.updateDistortion(selectedContainer.id, state.currentHandle, deltaX, deltaY);
            
            // For distortion, we'll use CSS transform-origin and skew
            const rect = selectedContainer.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            // Calculate the angle of distortion based on handle position
            let skewX = 0;
            let skewY = 0;
            let scaleX = state.startScaleX;
            let scaleY = state.startScaleY;
            
            // Maximum allowed skew angle in degrees
            const MAX_SKEW = 30;
            // Maximum scale factor
            const MAX_SCALE = 2;
            // Minimum scale factor
            const MIN_SCALE = 0.5;
            
            if (state.currentHandle.classList.contains('bottom-right')) {
                skewX = Math.max(-MAX_SKEW, Math.min(MAX_SKEW, (deltaY / rect.height) * MAX_SKEW));
                skewY = Math.max(-MAX_SKEW, Math.min(MAX_SKEW, (deltaX / rect.width) * MAX_SKEW));
                scaleX = state.startScaleX * (1 + deltaX / rect.width);
                scaleY = state.startScaleY * (1 + deltaY / rect.height);
            } else if (state.currentHandle.classList.contains('bottom-left')) {
                skewX = Math.max(-MAX_SKEW, Math.min(MAX_SKEW, (deltaY / rect.height) * MAX_SKEW));
                skewY = Math.max(-MAX_SKEW, Math.min(MAX_SKEW, (-deltaX / rect.width) * MAX_SKEW));
                scaleX = state.startScaleX * (1 - deltaX / rect.width);
                scaleY = state.startScaleY * (1 + deltaY / rect.height);
            } else if (state.currentHandle.classList.contains('top-right')) {
                skewX = Math.max(-MAX_SKEW, Math.min(MAX_SKEW, (-deltaY / rect.height) * MAX_SKEW));
                skewY = Math.max(-MAX_SKEW, Math.min(MAX_SKEW, (deltaX / rect.width) * MAX_SKEW));
                scaleX = state.startScaleX * (1 + deltaX / rect.width);
                scaleY = state.startScaleY * (1 - deltaY / rect.height);
            } else if (state.currentHandle.classList.contains('top-left')) {
                skewX = Math.max(-MAX_SKEW, Math.min(MAX_SKEW, (-deltaY / rect.height) * MAX_SKEW));
                skewY = Math.max(-MAX_SKEW, Math.min(MAX_SKEW, (-deltaX / rect.width) * MAX_SKEW));
                scaleX = state.startScaleX * (1 - deltaX / rect.width);
                scaleY = state.startScaleY * (1 - deltaY / rect.height);
            }
            
            // Clamp scales to reasonable limits
            scaleX = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleX));
            scaleY = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleY));
            
            // Store current distortion values
            state.currentSkewX = skewX;
            state.currentSkewY = skewY;
            state.currentScaleX = scaleX;
            state.currentScaleY = scaleY;
            
            // Apply the distortion while preserving any existing rotation
            element.style.transform = `scale(${scaleX}, ${scaleY}) skew(${skewX}deg, ${skewY}deg) rotateY(${state.currentRotation}deg)`;

            // Calculate the actual dimensions of the skewed text
            const baseWidth = element.offsetWidth;
            const baseHeight = element.offsetHeight;
            
            // Calculate the maximum width and height needed to contain the skewed text
            const skewXRad = Math.abs(skewX) * (Math.PI / 180);
            const skewYRad = Math.abs(skewY) * (Math.PI / 180);
            
            // Calculate the additional space needed due to skew
            const skewWidth = baseHeight * Math.tan(skewXRad);
            const skewHeight = baseWidth * Math.tan(skewYRad);
            
            // Calculate final dimensions including scale and skew
            const finalWidth = (baseWidth * scaleX) + skewWidth;
            const finalHeight = (baseHeight * scaleY) + skewHeight;
            
            // Update container size with padding
            selectedContainer.style.width = `${finalWidth + 20}px`;  // Add padding
            selectedContainer.style.height = `${finalHeight + 20}px`;  // Add padding

            // Update handle positions without distorting them
            selectedContainer.querySelectorAll('.distort-handle').forEach(handle => {
                // Reset any previous transform and positioning
                handle.style.transform = '';
                handle.style.left = '';
                handle.style.top = '';
                handle.style.right = '';
                handle.style.bottom = '';
                
                // Position the handle based on its corner
                if (handle.classList.contains('right')) {
                    handle.style.right = '-6px';
                } else {
                    handle.style.left = '-6px';
                }
                
                if (handle.classList.contains('bottom')) {
                    handle.style.bottom = '-6px';
                } else {
                    handle.style.top = '-6px';
                }
            });
        }
    }

    function handleMouseUp() {
        if (!selectedContainer) return;
        const state = textStates.get(selectedContainer);
        if (!state.isResizing && !state.isDistorting) return;
        
        state.isResizing = false;
        state.isDistorting = false;
        state.currentHandle = null;
        
        // Remove temporary event listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        // Don't deactivate tools - let the user explicitly deactivate them
    }

    // Add mousedown handler to select text containers and handle tool activation
    document.addEventListener('mousedown', (e) => {
        // Find the clicked container, including when clicking on sequencer panels
        const clickedContainer = e.target.closest('.text-container') || 
                               (sequenceTool.classList.contains('active') && e.target.closest('.sequencer-panel')?.closest('.text-container'));
        
        // If clicking on a text container or its sequencer panel
        if (clickedContainer) {
            // Store current tool states before any changes
            const wasSequenceActive = sequenceTool.classList.contains('active');
            const wasEchoActive = echoTool.classList.contains('active');
            const wasFontActive = fontTool.classList.contains('active');
            const wasPanActive = panTool.classList.contains('active');
            
            // If clicking on a different container than the currently selected one
            if (clickedContainer !== selectedContainer) {
                // Clear any active states from the previous container
                if (selectedContainer) {
                    const prevState = textStates.get(selectedContainer);
                    if (prevState) {
                        prevState.isResizing = false;
                        prevState.isDistorting = false;
                        prevState.isRotating = false;
                        prevState.currentHandle = null;
                    }
                    // Remove any existing event listeners
                    document.removeEventListener('mousemove', handleRotateMouseMove);
                    document.removeEventListener('mouseup', handleRotateMouseUp);
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                    
                    // Hide panels for the previously selected container
                    selectedContainer.querySelector('.echo-panel')?.classList.add('hidden');
                    selectedContainer.querySelector('.font-panel')?.classList.add('hidden');
                }
                
                // Select the new container
                selectContainer(clickedContainer);
                
                // If pan tool was active, reactivate it for the new container
                if (wasPanActive) {
                    panTool.classList.add('active');
                    setCursorStylesForTool(clickedContainer, 'pan');
                }
                // If no tool is active, activate resize tool
                else if (!wasSequenceActive && !wasEchoActive && !wasFontActive &&
                         !resizeTool.classList.contains('active') && 
                         !distortTool.classList.contains('active')) {
                    activateToolWithContainer(resizeTool, clickedContainer);
                }
                // Otherwise show appropriate panel for the new container if tool is active
                else if (wasEchoActive) {
                    const echoPanel = clickedContainer.querySelector('.echo-panel');
                    echoPanel.classList.remove('hidden');
                    const element = clickedContainer.querySelector('.text-element');
                    element.setAttribute('data-text', element.textContent);
                }
                else if (wasFontActive) {
                    clickedContainer.querySelector('.font-panel').classList.remove('hidden');
                }
            }
            // If clicking on the currently selected container and no tool is active
            else if (!wasSequenceActive && !wasEchoActive && !wasFontActive && !wasPanActive &&
                     !resizeTool.classList.contains('active') && 
                     !distortTool.classList.contains('active')) {
                activateToolWithContainer(resizeTool, clickedContainer);
            }
        }
        // If clicking outside any container and not on toolbar
        else if (!e.target.closest('.toolbar')) {
            // Check if we're in the middle of any operation before deactivating
            const isResizing = selectedContainer && textStates.get(selectedContainer)?.isResizing;
            const isDistorting = selectedContainer && textStates.get(selectedContainer)?.isDistorting;
            const isRotating = selectedContainer && textStates.get(selectedContainer)?.isRotating;
            
            // Only deactivate if we're not in the middle of an operation
            if (!isResizing && !isDistorting && !isRotating) {
                deselectContainer();
                deactivateAllTools();
            }
        }
    });

    // Handle mouse events for rotating
    textContainers.forEach(container => {
        container.addEventListener('mousedown', (e) => {
            // Only handle rotate operation if pan tool is active and this is the selected container
            if (!panTool.classList.contains('active') || container !== selectedContainer) {
                return;
            }

            // Don't handle rotate if clicking on panels or handles
            if (e.target.closest('.echo-panel') || 
                e.target.closest('.font-panel') || 
                e.target.classList.contains('resize-handle')) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            
            const state = textStates.get(container);
            state.isRotating = true;
            state.startX = e.clientX;
            state.startY = e.clientY;
            
            // Get current rotation
            const transform = window.getComputedStyle(container.querySelector('.text-element')).transform;
            const matrix = new DOMMatrix(transform);
            state.startRotation = Math.round(Math.atan2(matrix.m21, matrix.m11) * (180/Math.PI));
            
            // Add temporary event listeners
            document.addEventListener('mousemove', handleRotateMouseMove);
            document.addEventListener('mouseup', handleRotateMouseUp);
        });
    });

    function handleRotateMouseMove(e) {
        if (!selectedContainer) return;
        const state = textStates.get(selectedContainer);
        if (!state.isRotating) return;

        const deltaX = e.clientX - state.startX;
        // Calculate pan value based on horizontal movement
        // Map the rotation range (-65 to 65 degrees) to pan range (-1 to 1)
        const panValue = (deltaX / 2) / 65; // 65 degrees is our max rotation
        
        // Update the pan position
        soundManager.updatePan(selectedContainer.id, panValue);
        
        // Calculate rotation based on horizontal movement (1 degree per 2 pixels)
        let newRotation = state.startRotation + (deltaX / 2);
        
        // Clamp rotation between -65 and 65 degrees
        newRotation = Math.max(-65, Math.min(65, newRotation));
        state.currentRotation = newRotation;
        
        // Apply rotation while preserving any existing distortion
        const element = selectedContainer.querySelector('.text-element');
        element.style.transform = `scale(${state.currentScaleX}, ${state.currentScaleY}) skew(${state.currentSkewX}deg, ${state.currentSkewY}deg) rotateY(${newRotation}deg)`;
    }

    function handleRotateMouseUp(e) {
        if (!selectedContainer) return;
        const state = textStates.get(selectedContainer);
        if (!state.isRotating) return;
        
        // Calculate final pan value based on final rotation
        const panValue = state.currentRotation / 65; // Map rotation to pan
        soundManager.updatePan(selectedContainer.id, panValue);
        
        state.isRotating = false;
        state.currentHandle = null;
        
        // Remove temporary event listeners
        document.removeEventListener('mousemove', handleRotateMouseMove);
        document.removeEventListener('mouseup', handleRotateMouseUp);
    }

    // Function to update BPM
    function updateBPM(newBpm) {
        bpm = Math.max(20, Math.min(300, newBpm));
        bpmInput.value = bpm;
        if (isPlaying) {
            stopSequencer();
            startSequencer();
        }
    }

    // Function to start sequencer
    function startSequencer() {
        if (isPlaying) return;
        isPlaying = true;
        playTool.classList.add('playing');
        playTool.textContent = 'PAUSE';
        
        // Update echo timing when starting sequencer
        soundManager.updateBpm(bpm);
        
        // Calculate step duration for sixteenth notes
        const sixteenthNoteDuration = (60000 / (bpm * 4));
        sequencerInterval = setInterval(async () => {
            // Remove current step highlight from all containers
            textContainers.forEach(container => {
                const steps = container.querySelectorAll('.step');
                steps[currentStep].classList.remove('current');
            });
            
            // Move to next step
            currentStep = (currentStep + 1) % 16;
            
            // Play the step (which will add the new current highlight)
            await playStep(currentStep);
        }, sixteenthNoteDuration);
    }

    // Function to stop sequencer
    function stopSequencer() {
        if (!isPlaying) return;
        isPlaying = false;
        playTool.classList.remove('playing');
        playTool.textContent = 'PLAY';
        clearInterval(sequencerInterval);
        
        // Remove current step highlight from all containers
        textContainers.forEach(container => {
            const steps = container.querySelectorAll('.step');
            steps[currentStep].classList.remove('current');
        });
        currentStep = 0;
    }

    // Update play tool click handler
    playTool.addEventListener('click', async () => {
        try {
            // Initialize audio context on first user interaction
            if (!soundManager.context) {
                await soundManager.initializeAudio();
                // Load sounds for all active fonts after context is initialized
                for (const container of textContainers) {
                    const element = container.querySelector('.text-element');
                    const fontFamily = window.getComputedStyle(element).fontFamily.split(',')[0].replace(/['"]/g, '');
                    await soundManager.loadSound(container.id, fontFamily);
                }
            }

            if (isPlaying) {
                stopSequencer();
            } else {
                // Resume context if it was suspended
                if (soundManager.context.state === 'suspended') {
                    await soundManager.context.resume();
                }
                startSequencer();
            }
        } catch (error) {
            console.error('Error initializing audio:', error);
        }
    });

    // Add BPM input handler
    bpmInput.addEventListener('change', (e) => {
        let newBpm = parseInt(e.target.value);
        // Only clamp the value when it's actually submitted
        newBpm = Math.max(20, Math.min(300, newBpm));
        e.target.value = newBpm; // Update the input with clamped value
        updateBPM(newBpm);
        // Update echo timing
        soundManager.updateBpm(newBpm);
    });

    // Remove the restrictive input handler and replace with a more permissive one
    bpmInput.addEventListener('input', (e) => {
        // Allow any input, we'll validate on change
        const value = e.target.value;
        // Only update BPM if it's a valid number
        if (!isNaN(value) && value !== '') {
            const numValue = parseInt(value);
            // Update echo timing in real-time as BPM changes, but don't clamp the display value
            soundManager.updateBpm(numValue);
        }
    });

    // Modify deactivateAllTools to handle sequencer state
    function deactivateAllTools() {
        resizeTool.classList.remove('active');
        distortTool.classList.remove('active');
        panTool.classList.remove('active');
        sequenceTool.classList.remove('active');
        echoTool.classList.remove('active');
        flipTool.classList.remove('active');
        fontTool.classList.remove('active');
        randomFontsTool.classList.remove('active');
        
        // Don't stop sequencer playback when deactivating tools
        // stopSequencer();
        
        // Reset cursor styles for all containers
        textContainers.forEach(container => {
            container.style.cursor = 'default';
            container.querySelectorAll('.resize-handle').forEach(handle => {
                handle.style.cursor = 'default';
            });
            container.querySelectorAll('.distort-handle').forEach(handle => {
                handle.style.cursor = 'default';
            });
            // Hide panels for all containers
            container.querySelector('.sequencer-panel').classList.add('hidden');
            container.querySelector('.echo-panel').classList.add('hidden');
            container.querySelector('.font-panel').classList.add('hidden');
        });
    }

    // Add perspective to all containers for 3D effect
    textContainers.forEach(container => {
        container.style.perspective = '1000px';
        container.querySelector('.text-element').style.transformStyle = 'preserve-3d';
    });

    // Create sequencer steps for each container
    textContainers.forEach(container => {
        const stepsContainer = container.querySelector('.steps');
        let isDragging = false;
        let lastSetState = null; // Track the last state we set during drag

        for (let i = 0; i < 16; i++) {
            const step = document.createElement('div');
            step.className = 'step';
            
            // Add mousedown handler
            step.addEventListener('mousedown', (e) => {
                if (sequenceTool.classList.contains('active') && container === selectedContainer) {
                    e.preventDefault(); // Prevent text selection
                    isDragging = true;
                    // Toggle the current step and store its new state
                    step.classList.toggle('active');
                    lastSetState = step.classList.contains('active');
                }
            });

            // Add mouseenter handler for drag
            step.addEventListener('mouseenter', (e) => {
                if (isDragging && sequenceTool.classList.contains('active') && container === selectedContainer) {
                    // Set the step to match the last state we set
                    if (lastSetState) {
                        step.classList.add('active');
                    } else {
                        step.classList.remove('active');
                    }
                }
            });

            stepsContainer.appendChild(step);
        }

        // Add mouseup handler to the container to end dragging
        stepsContainer.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Add mouseleave handler to the container to end dragging
        stepsContainer.addEventListener('mouseleave', () => {
            isDragging = false;
        });
    });

    // Set up observers for each text element
    textContainers.forEach(container => {
        const element = container.querySelector('.text-element');
        const state = textStates.get(container);
        
        state.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'characterData' || mutation.type === 'childList') {
                    // If text is flipped, we need to flip it back before setting data-text
                    if (state.isFlipped) {
                        const currentText = element.textContent;
                        element.setAttribute('data-text', currentText.split('').reverse().join(''));
                    } else {
                        element.setAttribute('data-text', element.textContent);
                    }
                }
            });
        });

        state.observer.observe(element, {
            characterData: true,
            childList: true,
            subtree: true
        });
    });

    // Tool click handlers
    resizeTool.addEventListener('click', () => {
        if (resizeTool.classList.contains('active')) {
            deselectContainer();
            deactivateAllTools();
        } else {
            const container = selectedContainer || lastSelectedContainer;
            activateToolWithContainer(resizeTool, container);
        }
    });

    distortTool.addEventListener('click', () => {
        if (distortTool.classList.contains('active')) {
            deselectContainer();
            deactivateAllTools();
        } else {
            const container = selectedContainer || lastSelectedContainer;
            activateToolWithContainer(distortTool, container);
        }
    });

    panTool.addEventListener('click', () => {
        if (panTool.classList.contains('active')) {
            deselectContainer();
            deactivateAllTools();
        } else {
            const container = selectedContainer || lastSelectedContainer;
            activateToolWithContainer(panTool, container);
        }
    });

    sequenceTool.addEventListener('click', () => {
        if (sequenceTool.classList.contains('active')) {
            deselectContainer();
            deactivateAllTools();
        } else {
            const container = selectedContainer || lastSelectedContainer;
            activateToolWithContainer(sequenceTool, container);
        }
    });

    echoTool.addEventListener('click', () => {
        if (echoTool.classList.contains('active')) {
            deselectContainer();
            deactivateAllTools();
        } else {
            const container = selectedContainer || lastSelectedContainer;
            activateToolWithContainer(echoTool, container);
        }
    });

    fontTool.addEventListener('click', () => {
        if (fontTool.classList.contains('active')) {
            deselectContainer();
            deactivateAllTools();
        } else {
            const container = selectedContainer || lastSelectedContainer;
            activateToolWithContainer(fontTool, container);
        }
    });

    // Add random fonts tool click handler
    randomFontsTool.addEventListener('click', async () => {
        // Deselect any selected container first
        deselectContainer();
        deactivateAllTools();
        randomFontsTool.classList.add('active');
        await assignRandomFonts();
        // Remove active class after a brief delay
        setTimeout(() => {
            randomFontsTool.classList.remove('active');
        }, 100);
    });

    // Add random sequence tool click handler
    const randomSequenceTool = document.getElementById('random-sequence-tool');
    randomSequenceTool.addEventListener('click', () => {
        // Store current tool states
        const wasSequenceActive = sequenceTool.classList.contains('active');
        const wasRandomActive = randomSequenceTool.classList.contains('active');
        
        // If random tool is already active, just deactivate it
        if (wasRandomActive) {
            randomSequenceTool.classList.remove('active');
            return;
        }
        
        // If sequence tool wasn't active, deactivate all tools first
        if (!wasSequenceActive) {
            deactivateAllTools();
        }
        
        // Activate random sequence tool
        randomSequenceTool.classList.add('active');
        
        // Function to get a random boolean with a 30% chance of true
        const getRandomStep = () => Math.random() < 0.3;
        
        // Randomize steps for all containers
        textContainers.forEach(container => {
            const steps = container.querySelectorAll('.step');
            steps.forEach(step => {
                // Clear existing active state
                step.classList.remove('active');
                // Set new random state
                if (getRandomStep()) {
                    step.classList.add('active');
                }
            });
        });
        
        // Deactivate random sequence tool and activate sequence tool if needed
        setTimeout(() => {
            randomSequenceTool.classList.remove('active');
            if (!wasSequenceActive && lastSelectedContainer) {
                activateToolWithContainer(sequenceTool, lastSelectedContainer);
            }
        }, 100);
    });

    // Handle echo slider changes for each container
    const echoSliders = {
        'bass-drum': document.getElementById('echo-layers-bass'),
        'hi-hat': document.getElementById('echo-layers-hihat'),
        'snare-drum': document.getElementById('echo-layers-snare'),
        'hand-clap': document.getElementById('echo-layers-clap')
    };

    // Add input handlers for each echo slider
    Object.entries(echoSliders).forEach(([containerId, slider]) => {
        if (!slider) {
            console.error(`Echo slider not found for ${containerId}`);
            return;
        }
        slider.addEventListener('input', (e) => {
            const container = document.getElementById(containerId);
            if (!container || container !== selectedContainer) return;
            
            const sliderValue = parseInt(e.target.value);
            const element = container.querySelector('.text-element');
            
            // Update echo effect
            if (sliderValue === 0) {
                // At 0, echo is off
                element.classList.remove('echo-enabled');
                element.removeAttribute('data-echo-layers');
                // Update echo processing to disable
                soundManager.updateEcho(containerId, 0);
            } else {
                // For values 1-6, enable echo with corresponding layers
                element.classList.add('echo-enabled');
                element.setAttribute('data-echo-layers', sliderValue);
                // Update echo processing
                soundManager.updateEcho(containerId, sliderValue);
            }
        });
    });

    // Initialize all text elements with default size
    textContainers.forEach(container => {
        updateSize(container, 48);
    });

    // Function to generate random sequence without tool activation
    function generateRandomSequence() {
        // Function to get a random boolean with a 30% chance of true
        const getRandomStep = () => Math.random() < 0.3;
        
        // Randomize steps for all containers
        textContainers.forEach(container => {
            const steps = container.querySelectorAll('.step');
            steps.forEach(step => {
                // Clear existing active state
                step.classList.remove('active');
                // Set new random state
                if (getRandomStep()) {
                    step.classList.add('active');
                }
            });
        });
    }

    // Generate random sequence on load
    generateRandomSequence();

    // Add flip tool click handler
    flipTool.addEventListener('click', () => {
        const container = selectedContainer || lastSelectedContainer;
        if (!container) return;
        
        const state = textStates.get(container);
        const element = container.querySelector('.text-element');
        
        // Toggle flipped state and update text
        state.isFlipped = !state.isFlipped;
        const currentText = element.textContent;
        element.textContent = currentText.split('').reverse().join('');
        
        // Update echo text if active
        if (element.classList.contains('echo-enabled')) {
            element.setAttribute('data-text', element.textContent);
        }
    });

    // Handle font selection changes for each container
    textContainers.forEach(container => {
        const fontSelect = container.querySelector('.font-select');
        const element = container.querySelector('.text-element');
        
        // Set initial font to Arial
        element.style.fontFamily = 'Arial';
        fontSelect.value = 'Arial';
        // Don't load sound immediately - wait for user interaction
        // soundManager.loadSound(container.id, 'Arial');
        
        // Store original text for each container
        const originalText = element.textContent;
        
        fontSelect.addEventListener('change', async (e) => {
            if (container !== selectedContainer) return;
            
            const selectedFont = e.target.value;
            element.style.fontFamily = selectedFont;
            
            // Load the new sound
            await soundManager.loadSound(container.id, selectedFont);
            
            // Handle Major Mono Display special case
            if (selectedFont === 'Major Mono Display') {
                if (!element.hasAttribute('data-original-text')) {
                    element.setAttribute('data-original-text', element.textContent);
                }
                element.textContent = element.textContent.toLowerCase();
            } else {
                if (element.hasAttribute('data-original-text')) {
                    element.textContent = element.getAttribute('data-original-text');
                    element.removeAttribute('data-original-text');
                }
            }
            
            // Update container size to match new font
            updateSize(container, parseInt(window.getComputedStyle(element).fontSize));
            
            // If echo is enabled, update the echo effect
            if (element.classList.contains('echo-enabled')) {
                const echoLayers = element.getAttribute('data-echo-layers');
                element.classList.remove('echo-enabled');
                element.removeAttribute('data-echo-layers');
                element.offsetHeight;
                element.classList.add('echo-enabled');
                element.setAttribute('data-echo-layers', echoLayers);
            }
        });
    });

    // Add info tool click handler
    const infoTool = document.getElementById('info-tool');
    const infoModal = document.getElementById('info-modal');
    const closeModal = document.querySelector('.close-modal');

    infoTool.addEventListener('click', () => {
        infoModal.classList.remove('hidden');
    });

    closeModal.addEventListener('click', () => {
        infoModal.classList.add('hidden');
    });

    // Close modal when clicking outside
    infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) {
            infoModal.classList.add('hidden');
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !infoModal.classList.contains('hidden')) {
            infoModal.classList.add('hidden');
        }
    });

    // Add mute tool click handler
    muteTool.addEventListener('click', () => {
        const container = selectedContainer || lastSelectedContainer;
        if (!container) return;
        
        const state = textStates.get(container);
        const element = container.querySelector('.text-element');
        
        // Toggle muted state
        state.isMuted = !state.isMuted;
        element.classList.toggle('muted');
        
        // Remove the step clearing - we want to preserve the pattern
        // if (state.isMuted) {
        //     container.querySelectorAll('.step').forEach(step => {
        //         step.classList.remove('active');
        //     });
        // }
    });

    // Update sequencer playback to include sounds
    async function playStep(stepIndex) {
        // Ensure audio context is running
        if (soundManager.context && soundManager.context.state === 'suspended') {
            await soundManager.context.resume();
        }

        // Add current step highlight to all containers
        textContainers.forEach(container => {
            const steps = container.querySelectorAll('.step');
            steps[stepIndex].classList.add('current');
        });

        for (const container of textContainers) {
            const state = textStates.get(container);
            const steps = container.querySelectorAll('.step');
            const step = steps[stepIndex];
            
            // Skip this container if it's muted, but continue with others
            if (state.isMuted) continue;
            
            if (step.classList.contains('active')) {
                const element = container.querySelector('.text-element');
                const fontFamily = window.getComputedStyle(element).fontFamily.split(',')[0].replace(/['"]/g, '');
                
                // Play the sound
                await soundManager.playSound(container.id, fontFamily);
                
                // Store original transform and create animation
                const originalTransform = element.style.transform;
                const animationDuration = 100; // Fixed 100ms duration for all animations
                
                // Create and start animation
                const animation = element.animate([
                    { transform: originalTransform },
                    { transform: getAnimationTransform(container.id, originalTransform) },
                    { transform: originalTransform }
                ], {
                    duration: animationDuration,
                    easing: 'ease-in-out'
                });
                
                // Ensure the element returns to its original state
                animation.onfinish = () => {
                    element.style.transform = originalTransform;
                };
            }
        }
    }

    // Helper function to get the appropriate transform for each container type
    function getAnimationTransform(containerId, originalTransform) {
        switch(containerId) {
            case 'bass-drum':
                return originalTransform + ' scale(1.3)';
            case 'hi-hat':
                return originalTransform + ' skew(20deg, 0deg)';
            case 'snare-drum':
                return originalTransform + ' rotate(15deg)';
            case 'hand-clap':
                return originalTransform + ' scale(1.2) skew(30deg, 0deg) rotate(10deg)';
            default:
                return originalTransform;
        }
    }

    // Update click handler for text elements
    textContainers.forEach(container => {
        const element = container.querySelector('.text-element');
        // Remove click handler entirely since we don't want any sound playback on click
        element.addEventListener('click', () => {
            // No sound playback - just handle selection
        });
    });
});
