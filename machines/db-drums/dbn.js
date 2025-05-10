const deBruijnSequence = '0000000010000001100000101000001110000100100001011000011010000111' +
                         '1000010001000010100000111000011001000011011000111010001111100100' +
                         '1010010011100101011001011010010111100110011010100110111001110110' +
                         '0111101001111110101010111010110110101111101101111011101111111';

const drumSounds = [
    { name: 'BD', file: 'bn-sounds/bassdrum-BT3A0D3.WAV', defaultValue: 0 },
    { name: 'SD', file: 'bn-sounds/snare-ST0TASA.WAV', defaultValue: 0 },
    { name: 'CH', file: 'bn-sounds/closedhihat-HHCD6.WAV', defaultValue: 0 },
    { name: 'OH', file: 'bn-sounds/openhihat-HHOD2.WAV', defaultValue: 0 },
    { name: 'CP', file: 'bn-sounds/clap-HANDCLP2.WAV', defaultValue: 0 },
    { name: 'LT', file: 'bn-sounds/lowtom-LTAD3.WAV', defaultValue: 0 },
    { name: 'MT', file: 'bn-sounds/midtom-MTAD3.WAV', defaultValue: 0 },
    { name: 'HT', file: 'bn-sounds/hitom-HTAD3.WAV', defaultValue: 0 },
    { name: 'RS', file: 'bn-sounds/rim-RIM63.WAV', defaultValue: 0 },
    { name: 'RD', file: 'bn-sounds/ride-RIDED4.WAV', defaultValue: 0 },
    { name: 'CR', file: 'bn-sounds/crash-CSHD4.WAV', defaultValue: 0 }
];

let audioContext;
let soundBuffers = {};
let isPlaying = false;
let currentStep = 0;
let stepInterval = null;

function offsetToBinary(offset) {
    offset = Math.max(0, Math.min(255, offset));
    return deBruijnSequence.slice(offset, offset + 8);
}

async function initDrumMachine() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    for (const sound of drumSounds) {
        try {
            const response = await fetch(sound.file);
            const buffer = await response.arrayBuffer();
            soundBuffers[sound.name] = await audioContext.decodeAudioData(buffer);
        } catch (e) {
            console.error(`Failed to load ${sound.name}`, e);
        }
    }

    createTracks();
    document.getElementById('playPause').addEventListener('click', togglePlay);
    document.getElementById('bpm').addEventListener('input', updateBPM);
    updateBPM(true);
}

function createTracks() {
    const container = document.querySelector('.tracks');

    drumSounds.forEach(({ name, defaultValue }) => {
        const track = document.createElement('div');
        track.className = 'track';

        const binary = offsetToBinary(defaultValue);

        track.innerHTML = `
          <div class="track-controls">
            <button class="clear-button">Clear</button>
            <button class="random-button">RND</button>
            <input type="range" class="track-input" min="0" max="255" value="${defaultValue}" />
          </div>
          <div class="track-sequence"></div>
          <div class="track-name">${name}</div>
        `;

        const input = track.querySelector('.track-input');
        const sequence = track.querySelector('.track-sequence');

        for (let i = 0; i < 8; i++) {
            const step = document.createElement('div');
            step.className = 'step';
            step.textContent = binary[i];
            step.classList.toggle('on', binary[i] === '1');
            sequence.appendChild(step);
        }

        input.addEventListener('input', () => {
            const val = parseInt(input.value);
            const bin = offsetToBinary(val);
            updateTrackSequence(sequence, bin);
        });

        track.querySelector('.clear-button').onclick = () => {
            input.value = 0;
            input.dispatchEvent(new Event('input'));
        };

        track.querySelector('.random-button').onclick = () => {
            input.value = Math.floor(Math.random() * 256);
            input.dispatchEvent(new Event('input'));
        };

        container.appendChild(track);
    });
}

function updateTrackSequence(sequence, binary) {
    const steps = sequence.querySelectorAll('.step');
    steps.forEach((step, i) => {
        step.textContent = binary[i];
        step.classList.toggle('on', binary[i] === '1');
    });
}

function playSound(name) {
    if (!soundBuffers[name]) return;
    const src = audioContext.createBufferSource();
    src.buffer = soundBuffers[name];
    src.connect(audioContext.destination);
    src.start();
}

function togglePlay() {
    const bpm = parseInt(document.getElementById('bpm').value);
    const btn = document.getElementById('playPause');

	if (!isPlaying) {
		currentStep = 0;
	}


    if (isPlaying) {
        clearInterval(stepInterval);
        stepInterval = null;
        isPlaying = false;
        btn.textContent = 'Play';
    } else {
        if (isNaN(bpm)) return;
        const duration = 60000 / bpm / 4;
        stepInterval = setInterval(playStep, duration);
        isPlaying = true;
        btn.textContent = 'Pause';
    }
}

function updateBPM() {
    const bpm = parseInt(document.getElementById('bpm').value);
    document.getElementById('decimalBpm').textContent = `(${bpm})`;

    if (isPlaying && !isNaN(bpm)) {
        clearInterval(stepInterval);
        const duration = 60000 / bpm / 4;
        stepInterval = setInterval(playStep, duration);
    }
}

function playStep() {
    const tracks = document.querySelectorAll('.track');
    document.querySelectorAll('.step.playing').forEach(el => el.classList.remove('playing'));

    tracks.forEach(track => {
        const steps = track.querySelectorAll('.step');
        const step = steps[currentStep];
        step.classList.add('playing');
        if (step.classList.contains('on')) {
            const name = track.querySelector('.track-name').textContent.trim();
            playSound(name);
        }
    });

    currentStep = (currentStep + 1) % 8;
}

window.addEventListener('load', initDrumMachine);
