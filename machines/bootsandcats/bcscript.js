// Predefined lists of images
const BOOTS_IMAGES = Array.from({length: 70}, (_, i) => `boots-img/boots${String(i + 1).padStart(2, '0')}.png`);
const CATS_IMAGES = Array.from({length: 39}, (_, i) => `cats-img/cats${String(i + 1).padStart(2, '0')}.png`);

// Function to get a random image from a directory
function getRandomImage(directory) {
    const images = directory === 'boots-img' ? BOOTS_IMAGES : CATS_IMAGES;
    return images[Math.floor(Math.random() * images.length)];
}

// Create and append an image element
function createImageElement(src) {
    const img = document.createElement('img');
    img.src = src;
    img.className = 'dropped-image';
    img.draggable = false;
    return img;
}

// Create and append an ampersand element
function createAmpersand() {
    const separators = ['&', 'and', '+'];
    const separator = separators[Math.floor(Math.random() * separators.length)];
    
    const ampersand = document.createElement('div');
    ampersand.textContent = separator;
    ampersand.className = 'ampersand';
    
    // Adjust font size for "and" since it's longer
    if (separator === 'and') {
        ampersand.style.fontSize = '32px';  // Smaller font for "and"
    } else if (separator === '+') {
        ampersand.style.fontSize = '56px';  // Larger font for "+"
    }
    
    return ampersand;
}

// Create a preview image element
function createPreviewImage(src) {
    const img = document.createElement('img');
    img.src = src;
    img.style.width = '100px';
    img.style.height = '100px';
    img.style.objectFit = 'contain';
    return img;
}

// Set up source boxes
document.querySelectorAll('.source-box').forEach(box => {
    let isDragging = false;
    let currentImageUrl = null;
    let previewImage = null;

    // Common function to start dragging
    function startDrag(e, isTouch = false) {
        if (isTouch && e.touches.length !== 1) return; // Only handle single touch
        
        const directory = box.id === 'boots-box' ? 'boots-img' : 'cats-img';
        currentImageUrl = getRandomImage(directory);
        
        if (currentImageUrl) {
            isDragging = true;
            previewImage = createPreviewImage(currentImageUrl);
            document.body.appendChild(previewImage);
            
            // Position the preview
            const updatePreview = (e) => {
                const clientX = isTouch ? e.touches[0].clientX : e.clientX;
                const clientY = isTouch ? e.touches[0].clientY : e.clientY;
                previewImage.style.position = 'fixed';
                previewImage.style.left = (clientX - 50) + 'px';
                previewImage.style.top = (clientY - 50) + 'px';
                previewImage.style.pointerEvents = 'none';
                previewImage.style.zIndex = '1000';
            };
            
            updatePreview(e);
            
            // Add appropriate event listeners
            if (isTouch) {
                document.addEventListener('touchmove', updatePreview, { passive: false });
                document.addEventListener('touchmove', preventScroll, { passive: false });
            } else {
                document.addEventListener('mousemove', updatePreview);
            }
            
            // Handle end of drag
            const handleDragEnd = (e) => {
                if (!isDragging) return;
                
                isDragging = false;
                
                // Remove event listeners
                if (isTouch) {
                    document.removeEventListener('touchmove', updatePreview);
                    document.removeEventListener('touchmove', preventScroll);
                    document.removeEventListener('touchend', handleDragEnd);
                } else {
                    document.removeEventListener('mousemove', updatePreview);
                    document.removeEventListener('mouseup', handleDragEnd);
                }
                
                // Get coordinates
                const clientX = isTouch ? e.changedTouches[0].clientX : e.clientX;
                const clientY = isTouch ? e.changedTouches[0].clientY : e.clientY;
                
                // Check if we're over the drop zone
                const dropZone = document.getElementById('drop-zone');
                const dropRect = dropZone.getBoundingClientRect();
                
                if (clientX >= dropRect.left && clientX <= dropRect.right &&
                    clientY >= dropRect.top && clientY <= dropRect.bottom) {
                    // We're over the drop zone, add the image
                    const img = createImageElement(currentImageUrl);
                    dropZone.appendChild(img);
                    
                    // Always add an ampersand after the image
                    const ampersand = createAmpersand();
                    dropZone.appendChild(ampersand);
                }
                
                // Clean up
                if (previewImage && previewImage.parentNode) {
                    previewImage.parentNode.removeChild(previewImage);
                }
                previewImage = null;
                currentImageUrl = null;
            };
            
            // Add appropriate end event listener
            if (isTouch) {
                document.addEventListener('touchend', handleDragEnd);
            } else {
                document.addEventListener('mouseup', handleDragEnd);
            }
        }
    }

    // Prevent scrolling while dragging on touch devices
    function preventScroll(e) {
        if (isDragging) {
            e.preventDefault();
        }
    }

    // Mouse events
    box.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only left click
        startDrag(e, false);
    });

    // Touch events
    box.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent default touch behavior
        startDrag(e, true);
    }, { passive: false });

    // Prevent context menu on long press for touch devices
    box.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
});

// Make the drop zone touch-friendly
const dropZone = document.getElementById('drop-zone');
dropZone.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent default touch behavior
}, { passive: false });

// Audio setup
let audioContext = null;
let snareBuffer = null;
let hihatBuffer = null;
let bassBuffer = null;
const playPauseBtn = document.getElementById('playPauseBtn');

// Initialize audio context and load sounds
async function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Load audio files
        const loadSound = async (url) => {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            return await audioContext.decodeAudioData(arrayBuffer);
        };

        snareBuffer = await loadSound('bootcatsounds/snareST3T3SA.WAV');
        hihatBuffer = await loadSound('bootcatsounds/hihatHHOD8.WAV');
        bassBuffer = await loadSound('bootcatsounds/bassBTAA0D3.WAV');
    } catch (err) {
        console.error('Error initializing audio:', err);
    }
}

// Function to play a sound with precise timing
function playSound(buffer, time = audioContext.currentTime) {
    if (!audioContext || !buffer) return;
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(time);
}

// Drum machine state
let isPlaying = false;
let currentStep = 0;
let nextNoteTime = 0;
let scheduledNotes = [];
const BPM = 120;
const STEPS_PER_BEAT = 1;
const SECONDS_PER_STEP = 60 / BPM / STEPS_PER_BEAT;
const LOOKAHEAD = 25.0; // How frequently to call scheduling function (in milliseconds)
const SCHEDULE_AHEAD_TIME = 0.1; // How far ahead to schedule audio (in seconds)

// Function to get the sequence of sounds
function getSequence() {
    const sequence = [];
    const elements = Array.from(dropZone.children);
    
    for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (element.tagName === 'IMG') {
            const isCat = element.src.includes('cats-img');
            sequence.push(isCat ? 'cat' : 'boot');
        }
    }
    return sequence;
}

// Function to schedule the next note
function scheduleNote(time) {
    const sequence = getSequence();
    if (sequence.length === 0) return;
    
    const currentElement = sequence[currentStep % sequence.length];
    
    // Schedule the main sound
    if (currentElement === 'cat') {
        playSound(snareBuffer, time);
        playSound(hihatBuffer, time + SECONDS_PER_STEP / 2);
    } else { // boot
        playSound(bassBuffer, time);
        playSound(hihatBuffer, time + SECONDS_PER_STEP / 2);
    }
    
    // Update visual feedback
    const images = dropZone.querySelectorAll('img');
    images.forEach((img, index) => {
        img.style.opacity = (index === currentStep % sequence.length) ? '1' : '0.5';
    });
    
    currentStep++;
}

// Function to schedule notes ahead
function scheduler() {
    while (nextNoteTime < audioContext.currentTime + SCHEDULE_AHEAD_TIME) {
        scheduleNote(nextNoteTime);
        nextNoteTime += SECONDS_PER_STEP;
    }
    scheduledNotes.push(setTimeout(scheduler, LOOKAHEAD));
}

// Play/Pause button click handler
playPauseBtn.addEventListener('click', async () => {
    if (!audioContext) {
        await initAudio();
    }

    isPlaying = !isPlaying;
    
    if (isPlaying) {
        // Resume audio context if it was suspended
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        playPauseBtn.textContent = 'PAUSE';
        playPauseBtn.classList.add('playing');
        currentStep = 0;
        nextNoteTime = audioContext.currentTime;
        scheduler();
    } else {
        playPauseBtn.textContent = 'PLAY';
        playPauseBtn.classList.remove('playing');
        
        // Clear all scheduled notes
        scheduledNotes.forEach(timeout => clearTimeout(timeout));
        scheduledNotes = [];
        
        // Reset image opacities
        const images = dropZone.querySelectorAll('img');
        images.forEach(img => img.style.opacity = '1');
    }
});

// Make sure the drop zone is properly set up
dropZone.style.border = '2px dashed #ccc';
dropZone.style.minHeight = '200px';
dropZone.style.minWidth = '200px';
