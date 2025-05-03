// script.js

const sequenceInput = document.getElementById('sequence');
const playButton = document.getElementById('play');
const stopButton = document.getElementById('stop');
const bpmSlider = document.getElementById('bpm');
const bpmValue = document.getElementById('bpm-value');
const codeExamples = document.querySelectorAll('.instructions code');

// Web Audio API setup
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let isPlaying = false;
let nextNoteTime = 0;
let currentStep = 0;
let bpm = parseInt(bpmSlider.value);

// Audio buffer storage
const audioBuffers = {
	boom: null,
	chit: null,
	tick: null,
	tiss: null,
	tcha: null
};

// Load audio files
async function loadAudioBuffers() {
	try {
		const sounds = {
			boom: 'pdm-sounds/bd.wav',
			chit: 'pdm-sounds/sd.wav',
			tick: 'pdm-sounds/ch.wav',
			tiss: 'pdm-sounds/oh.wav',
			tcha: 'pdm-sounds/cp.wav'
		};

		for (const [key, url] of Object.entries(sounds)) {
			const response = await fetch(url);
			const arrayBuffer = await response.arrayBuffer();
			audioBuffers[key] = await audioContext.decodeAudioData(arrayBuffer);
		}
	} catch (error) {
		console.error('Error loading audio files:', error);
	}
}

const playSound = (soundType) => {
	if (!audioBuffers[soundType]) return;
	
	const source = audioContext.createBufferSource();
	source.buffer = audioBuffers[soundType];
	source.connect(audioContext.destination);
	source.start(nextNoteTime);

	// Add flash effect
	const container = document.querySelector('.container');
	container.classList.add('flash');
	setTimeout(() => {
		container.classList.remove('flash');
	}, 100);
}

const parseSequence = (sequence) => {
	const steps = [];
	let i = 0;

	while (i < sequence.length) {
		if (sequence[i] === ' ') {
			steps.push(null);
			i++;
		} else {
			const step = sequence.slice(i, i + 4);
			switch(step) {
				case 'boom':
					steps.push('boom');
					break;
				case 'chit':
					steps.push('chit');
					break;
				case 'tick':
					steps.push('tick');
					break;
				case 'tiss':
					steps.push('tiss');
					break;
				case 'tcha':
					steps.push('tcha');
					break;
				default:
					steps.push(null);
					break;
			}
			i += 4;
		}
	}
	return steps;
}

const scheduleNote = (parsedSequence) => {
	if (!isPlaying) return;

	const secondsPerBeat = 60.0 / bpm;
	const secondsPerStep = secondsPerBeat / 4; // Assuming 4/4 time

	while (nextNoteTime < audioContext.currentTime + 0.1) {
		const sound = parsedSequence[currentStep];
		if (sound) {
			playSound(sound);
		}
		nextNoteTime += secondsPerStep;
		currentStep = (currentStep + 1) % parsedSequence.length;
	}

	requestAnimationFrame(() => scheduleNote(parsedSequence));
}

playButton.addEventListener('click', async () => {
	if (!audioContext) return;
	
	// Stop any existing playback first
	isPlaying = false;
	// Small delay to ensure the previous playback loop has ended
	await new Promise(resolve => setTimeout(resolve, 32));
	
	if (audioContext.state === 'suspended') {
		await audioContext.resume();
	}

	const sequence = sequenceInput.value.trimStart();
	const parsedSequence = parseSequence(sequence);
	bpm = parseInt(bpmSlider.value);
	
	isPlaying = true;
	nextNoteTime = audioContext.currentTime;
	currentStep = 0;
	
	scheduleNote(parsedSequence);
});

stopButton.addEventListener('click', () => {
	isPlaying = false;
});

bpmSlider.addEventListener('input', () => {
	bpm = parseInt(bpmSlider.value);
	bpmValue.textContent = bpm;
});

codeExamples.forEach(example => {
	example.addEventListener('click', () => {
		sequenceInput.value = example.innerHTML.replaceAll('&nbsp;', ' ');
		example.style.cursor = 'pointer';
	});
});

// Initialize audio buffers when the page loads
loadAudioBuffers();

// Modal functionality
const infoButton = document.getElementById('infoButton');
const infoModal = document.getElementById('infoModal');
const closeButton = document.querySelector('.close-button');

infoButton.addEventListener('click', () => {
	infoModal.style.display = 'block';
});

closeButton.addEventListener('click', () => {
	infoModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
	if (event.target === infoModal) {
		infoModal.style.display = 'none';
	}
});
