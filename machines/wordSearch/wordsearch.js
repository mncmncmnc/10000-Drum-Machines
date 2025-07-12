class WordSearchDrumMachine {
    constructor() {
        this.text = '';
        this.words = [];
        this.currentWordIndex = 0;
        this.isPlaying = false;
        this.interval = null;
        this.rules = [];
        this.textContainer = document.getElementById('text-container');
        this.currentWordPositions = [];
        
        // Sound rotation system
        this.availableSounds = ['BassDrum1', 'Snare1', 'HhC', 'HhO', 'HandClap', 'HiTom', 'MedTom', 'LowTom', 'RimShot', 'Crash', 'Ride', 'CowBell', 'Tamb'];
        this.nextSoundIndex = 0;
        
        // Audio samples
        this.audioSamples = {};
        
        // Precise timing system
        this.animationId = null;
        this.lastFrameTime = 0;
        this.targetInterval = 0;
        this.accumulatedTime = 0;
        
        // Full text section management
        this.currentSection = 0;
        this.wordsPerSection = 10000;
        
        // Debug: Set to true to test section transitions quickly
        this.debugMode = false;
        if (this.debugMode) {
            this.wordsPerSection = 50; // Test with 50 words per section
        }
        
        this.initializeEventListeners();
        this.loadText();
        this.loadAudioSamples();
        
        // Initialize sound rotation based on existing rules
        this.initializeSoundRotation();
        
        // Create default rules for Moby Dick
        this.createDefaultRules();
    }

    async loadText() {
        try {
            const selectedWork = document.getElementById('work-select').value;
            const response = await fetch(`texts/${selectedWork}.txt`);
            this.text = await response.text();
            this.processText();
        } catch (error) {
            console.error('Error loading text:', error);
            this.textContainer.innerHTML = '<p>Error loading text file</p>';
        }
    }

    async loadAudioSamples() {
        const soundFiles = [
            'BassDrum1', 'Snare1', 'HhC', 'HhO', 'HandClap', 'HiTom', 
            'MedTom', 'LowTom', 'RimShot', 'Crash', 'Ride', 'CowBell', 'Tamb'
        ];
        
        for (const sound of soundFiles) {
            try {
                const audio = new Audio(`tr707/${sound}.wav`);
                this.audioSamples[sound] = audio;
            } catch (error) {
                console.error(`Error loading audio sample ${sound}:`, error);
            }
        }
    }

    getSoundDisplayName(sound) {
        const displayNames = {
            'BassDrum1': 'Bass Drum',
            'Snare1': 'Snare Drum',
            'HhC': 'Closed Hi-Hat',
            'HhO': 'Open Hi-Hat',
            'HandClap': 'Hand Clap',
            'HiTom': 'High Tom',
            'MedTom': 'Medium Tom',
            'LowTom': 'Low Tom',
            'RimShot': 'Rim Shot',
            'Crash': 'Crash',
            'Ride': 'Ride',
            'CowBell': 'Cowbell',
            'Tamb': 'Tambourine'
        };
        return displayNames[sound] || sound;
    }

    initializeSoundRotation() {
        // Count existing rules to determine next sound
        const existingRules = document.querySelectorAll('.rule-row');
        this.nextSoundIndex = existingRules.length % this.availableSounds.length;
    }

    createDefaultRules() {
        const defaultRules = [
            { word: 'me', sound: 'BassDrum1' },
            { word: 'my', sound: 'Snare1' },
            { word: 'sea', sound: 'HandClap' }
        ];
        
        // Clear any existing rules first
        const rulesContainer = document.getElementById('rules-container');
        rulesContainer.innerHTML = '';
        
        defaultRules.forEach(rule => {
            const ruleRow = document.createElement('div');
            ruleRow.className = 'rule-row';
            
            // Build the select options with the specified sound selected
            const soundOptions = this.availableSounds.map(sound => {
                const selected = sound === rule.sound ? 'selected' : '';
                const displayName = this.getSoundDisplayName(sound);
                return `<option value="${sound}" ${selected}>${displayName}</option>`;
            }).join('');
            
            ruleRow.innerHTML = `
                <input type="text" class="word-input" placeholder="Enter word..." autocapitalize="off" autocorrect="off" spellcheck="false" value="${rule.word}">
                <select class="sound-select">
                    ${soundOptions}
                </select>
                <button class="remove-rule">×</button>
            `;
            rulesContainer.appendChild(ruleRow);
        });
        
        // Reset sound rotation to continue from where defaults left off
        this.nextSoundIndex = defaultRules.length % this.availableSounds.length;
    }

    processText() {
        // Store the original text and find word positions
        this.originalText = this.text;
        this.wordPositions = [];
        
        // Find all word positions in the original text
        const wordRegex = /\b\w+\b/g;
        let match;
        while ((match = wordRegex.exec(this.text)) !== null) {
            this.wordPositions.push({
                word: match[0],
                start: match.index,
                end: match.index + match[0].length
            });
        }

        this.renderText();
    }

    renderText() {
        const excerptSize = document.getElementById('excerpt-size').value;
        let textToShow = this.originalText;
        let wordPositionsToShow = this.wordPositions;
        
        // For "full" text, show different content based on playback state
        if (excerptSize === 'full') {
            if (this.isPlaying) {
                // When playing, show current section of 10,000 words
                const startIndex = this.currentSection * this.wordsPerSection;
                const endIndex = Math.min(startIndex + this.wordsPerSection, this.wordPositions.length);
                const startChar = startIndex > 0 ? this.wordPositions[startIndex - 1].end : 0;
                const endChar = endIndex < this.wordPositions.length ? this.wordPositions[endIndex - 1].end : this.originalText.length;
                
                textToShow = this.originalText.substring(startChar, endChar);
                wordPositionsToShow = this.wordPositions.slice(startIndex, endIndex);
                
                // Adjust word positions to be relative to the sliced text
                wordPositionsToShow = wordPositionsToShow.map(pos => ({
                    ...pos,
                    start: pos.start - startChar,
                    end: pos.end - startChar
                }));
            } else {
                // When stopped, show full text without spans for browsing
                this.textContainer.innerHTML = this.originalText;
                this.currentWordPositions = this.wordPositions;
                return;
            }
        } else {
            // For excerpt sizes, use the specified number of words
            const size = parseInt(excerptSize);
            const maxCharPosition = this.wordPositions[size - 1]?.end || this.originalText.length;
            textToShow = this.originalText.substring(0, maxCharPosition);
            wordPositionsToShow = this.wordPositions.slice(0, size);
        }

        // Build HTML with all triggered words already in place
        let html = '';
        let lastEnd = 0;
        
        wordPositionsToShow.forEach((wordPos, index) => {
            const beforeWord = textToShow.substring(lastEnd, wordPos.start);
            const wordText = textToShow.substring(wordPos.start, wordPos.end);
            
            // Use the global word index for data-index to maintain consistency
            const globalIndex = this.currentSection * this.wordsPerSection + index;
            html += beforeWord + `<span class="word" data-index="${globalIndex}">${wordText}</span>`;
            
            lastEnd = wordPos.end;
        });
        
        // Add remaining text
        const textAfter = textToShow.substring(lastEnd);
        html += textAfter;
        
        this.textContainer.innerHTML = html;
        this.currentWordPositions = wordPositionsToShow;
    }

    initializeEventListeners() {
        // Work selector
        document.getElementById('work-select').addEventListener('change', () => {
            const wasPlaying = this.isPlaying;
            if (wasPlaying) {
                this.stop(); // Stop playback when changing works
            }
            this.loadText();
            this.currentWordIndex = 0;
            if (wasPlaying) {
                // Optionally restart playback with new text
                // this.start(); // Uncomment if you want auto-restart
            }
        });

        // Scroll rate slider
        const scrollRateSlider = document.getElementById('scroll-rate');
        const scrollRateValue = document.getElementById('scroll-rate-value');
        
        scrollRateSlider.addEventListener('input', (e) => {
            scrollRateValue.textContent = e.target.value;
            if (this.isPlaying) {
                // Update the target interval for the next tick
                const scrollRate = parseInt(e.target.value);
                this.targetInterval = 1000 / scrollRate;
            }
        });

        // Excerpt size selector
        document.getElementById('excerpt-size').addEventListener('change', () => {
            this.renderText();
            this.currentWordIndex = 0;
        });

        // Control button
        document.getElementById('play-btn').addEventListener('click', () => this.togglePlayback());

        // Add rule button
        document.getElementById('add-rule').addEventListener('click', () => this.addRule());

        // Clear all rules button
        document.getElementById('clear-all-rules').addEventListener('click', () => this.clearAllRules());

        // Remove rule buttons (delegated event)
        document.getElementById('rules-container').addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-rule')) {
                this.removeRule(e.target.closest('.rule-row'));
                // Update rules immediately when a rule is deleted during playback
                if (this.isPlaying) {
                    this.rules = this.getRules();
                }
            }
        });

        // Live sound change detection
        document.getElementById('rules-container').addEventListener('change', (e) => {
            if (e.target.classList.contains('sound-select') && this.isPlaying) {
                // Update rules immediately when sound is changed during playback
                this.rules = this.getRules();
            }
        });

        // Live word input detection
        document.getElementById('rules-container').addEventListener('input', (e) => {
            if (e.target.classList.contains('word-input') && this.isPlaying) {
                // Update rules immediately when word is changed during playback
                this.rules = this.getRules();
            }
        });

        // Modal functionality
        document.getElementById('info-btn').addEventListener('click', () => {
            document.getElementById('info-modal').style.display = 'block';
        });

        document.getElementById('close-modal').addEventListener('click', () => {
            document.getElementById('info-modal').style.display = 'none';
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('info-modal');
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    addRule() {
        const rulesContainer = document.getElementById('rules-container');
        const ruleRow = document.createElement('div');
        ruleRow.className = 'rule-row';
        
        // Get the next sound in rotation
        const nextSound = this.availableSounds[this.nextSoundIndex];
        
        // Build the select options with the next sound selected
        const soundOptions = this.availableSounds.map(sound => {
            const selected = sound === nextSound ? 'selected' : '';
            const displayName = this.getSoundDisplayName(sound);
            return `<option value="${sound}" ${selected}>${displayName}</option>`;
        }).join('');
        
        ruleRow.innerHTML = `
            <input type="text" class="word-input" placeholder="Enter word..." autocapitalize="off" autocorrect="off" spellcheck="false">
            <select class="sound-select">
                ${soundOptions}
            </select>
            <button class="remove-rule">×</button>
        `;
        rulesContainer.appendChild(ruleRow);
        
        // Move to next sound in rotation
        this.nextSoundIndex = (this.nextSoundIndex + 1) % this.availableSounds.length;
    }

    removeRule(ruleRow) {
        ruleRow.remove();
    }

    clearAllRules() {
        // Stop playback if currently playing
        if (this.isPlaying) {
            this.stop();
        }
        
        // Clear all rule rows
        const rulesContainer = document.getElementById('rules-container');
        rulesContainer.innerHTML = '';
        
        // Reset sound rotation
        this.nextSoundIndex = 0;
        
        // Clear rules array
        this.rules = [];
        
        // Re-render text to clear any triggered words
        this.renderText();
    }

    getRules() {
        const rules = [];
        document.querySelectorAll('.rule-row').forEach((row, index) => {
            const wordInput = row.querySelector('.word-input');
            const soundSelect = row.querySelector('.sound-select');
            const word = wordInput.value.trim().toLowerCase();
            const sound = soundSelect.value;
            
            if (word) {
                rules.push({ word, sound, row, index });
            }
        });
        return rules;
    }

    togglePlayback() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.start();
        }
    }

    start() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.rules = this.getRules();
        this.currentWordIndex = 0;
        this.currentSection = 0; // Reset to first section
        
        // Update button text
        document.getElementById('play-btn').textContent = 'Stop';
        
        // Re-render text to switch to performance mode if needed
        this.renderText();
        
        const scrollRate = parseInt(document.getElementById('scroll-rate').value);
        this.targetInterval = 1000 / scrollRate;
        this.accumulatedTime = 0;
        this.lastFrameTime = performance.now();
        
        this.animationId = requestAnimationFrame(this.tick.bind(this));
    }

    stop() {
        this.isPlaying = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        // Just remove the highlighted class, don't clear all spans
        const currentHighlighted = this.textContainer.querySelector('.word.highlighted');
        if (currentHighlighted) {
            currentHighlighted.classList.remove('highlighted');
        }
        
        // Update button text
        document.getElementById('play-btn').textContent = 'Start';
        
        // Re-render text to switch back to full text mode if needed
        this.renderText();
        
        // Scroll to the top of the text
        const textDisplay = document.querySelector('.text-display');
        if (textDisplay) {
            textDisplay.scrollTop = 0;
        }
    }

    reset() {
        this.stop();
        this.currentWordIndex = 0;
        this.rules = []; // Clear all rules
        
        // Reset sound rotation
        this.nextSoundIndex = 0;
        
        // Clear all rule rows from the interface
        const rulesContainer = document.getElementById('rules-container');
        rulesContainer.innerHTML = `
            <div class="rule-row">
                <input type="text" class="word-input" placeholder="Enter word..." autocapitalize="off" autocorrect="off" spellcheck="false">
                <select class="sound-select">
                    <option value="BassDrum1" selected>Bass Drum 1</option>
                    <option value="Snare1">Snare 1</option>
                    <option value="HhC">Hi-Hat Closed</option>
                    <option value="HhO">Hi-Hat Open</option>
                    <option value="HandClap">Hand Clap</option>
                    <option value="HiTom">High Tom</option>
                    <option value="MedTom">Medium Tom</option>
                    <option value="LowTom">Low Tom</option>
                    <option value="RimShot">Rim Shot</option>
                    <option value="Crash">Crash</option>
                    <option value="Ride">Ride</option>
                    <option value="CowBell">Cow Bell</option>
                    <option value="Tamb">Tambourine</option>
                </select>
                <button class="remove-rule">×</button>
            </div>
        `;
        
        this.renderText(); // Re-render to clear all triggered words
    }

    highlightNextWord() {
        const excerptSize = document.getElementById('excerpt-size').value;
        let maxWords = this.currentWordPositions.length;
        
        if (excerptSize !== 'full') {
            maxWords = parseInt(excerptSize);
        }

        // If we've reached the end of current section
        if (this.currentWordIndex >= maxWords) {
            if (excerptSize === 'full') {
                // Check if there are more sections to go through
                const totalSections = Math.ceil(this.wordPositions.length / this.wordsPerSection);
                if (this.currentSection < totalSections - 1) {
                    // Move to next section
                    this.currentSection++;
                    this.currentWordIndex = 0;
                    this.renderText(); // Re-render with new section
                    // Wait a frame for DOM to update, then highlight
                    requestAnimationFrame(() => {
                        this.highlightCurrentWord();
                    });
                    return;
                } else {
                    // We've reached the end of the full text, loop back to beginning
                    this.currentSection = 0;
                    this.currentWordIndex = 0;
                    this.renderText(); // Re-render with first section
                    // Wait a frame for DOM to update, then highlight
                    requestAnimationFrame(() => {
                        this.highlightCurrentWord();
                    });
                    return;
                }
            } else {
                // For excerpts, loop back to the beginning
                this.currentWordIndex = 0;
            }
        }

        // Clear previous highlight
        const currentHighlighted = this.textContainer.querySelector('.word.highlighted');
        if (currentHighlighted) {
            currentHighlighted.classList.remove('highlighted');
        }
        
        // Highlight the current word
        this.highlightCurrentWord();
        
        // Move to next word
        this.currentWordIndex++;
    }

    clearHighlights() {
        // Remove all spans and restore original text
        const excerptSize = document.getElementById('excerpt-size').value;
        let textToShow = this.originalText;
        
        if (excerptSize !== 'full') {
            const size = parseInt(excerptSize);
            const maxCharPosition = this.wordPositions[size - 1]?.end || this.originalText.length;
            textToShow = this.originalText.substring(0, maxCharPosition);
        }
        
        this.textContainer.innerHTML = textToShow;
    }

    scrollToWord(wordPosition) {
        // Simple approach: scroll to the highlighted element
        const highlightedElement = this.textContainer.querySelector('.word.highlighted');
        if (highlightedElement) {
            highlightedElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        }
    }

    tick(currentTime) {
        if (!this.isPlaying) return;
        
        const deltaTime = currentTime - this.lastFrameTime;
        this.accumulatedTime += deltaTime;
        
        // Check if we should trigger the next word
        if (this.accumulatedTime >= this.targetInterval) {
            this.highlightNextWord();
            this.accumulatedTime -= this.targetInterval;
        }
        
        this.lastFrameTime = currentTime;
        this.animationId = requestAnimationFrame(this.tick.bind(this));
    }

    highlightCurrentWord() {
        const currentWord = this.currentWordPositions[this.currentWordIndex];
        
        if (currentWord) {
            // Add highlight to current word using global index
            const globalIndex = this.currentSection * this.wordsPerSection + this.currentWordIndex;
            const wordElement = this.textContainer.querySelector(`[data-index="${globalIndex}"]`);
            if (wordElement) {
                wordElement.classList.add('highlighted');
            }
            
            // Check if current word matches any rules
            const matchingRule = this.rules.find(rule => 
                rule.word.toLowerCase() === currentWord.word.toLowerCase()
            );
            
            if (matchingRule) {
                // Trigger sound immediately
                this.triggerSound(matchingRule.sound);
                
                // Flash the rule row immediately
                matchingRule.row.classList.add('triggered');
                setTimeout(() => {
                    matchingRule.row.classList.remove('triggered');
                }, 300);
                
                // Add triggered class to word with timing based on scroll rate
                const scrollRate = parseInt(document.getElementById('scroll-rate').value);
                const flashDuration = Math.max(1000, 1000 / scrollRate); // At least 1 second, or 1 word interval
                
                wordElement.classList.add('triggered');
                setTimeout(() => {
                    wordElement.classList.remove('triggered');
                }, flashDuration);
            }
            
            // Scroll to keep highlighted word visible
            this.scrollToWord(currentWord);
        }
    }

    triggerSound(soundType) {
        const audio = this.audioSamples[soundType];
        if (audio) {
            // Clone the audio to allow overlapping sounds
            const audioClone = audio.cloneNode();
            audioClone.play().catch(error => {
                console.error('Error playing sound:', error);
            });
        }
    }
}

// Initialize the drum machine when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new WordSearchDrumMachine();
});
