const { useState, useEffect, useRef, useCallback } = React;

// Drum definitions with colors
const DRUMS = [
{ id: 'kick', name: 'KICK', color: '#FF0000' },
{ id: 'snare', name: 'SNARE', color: '#00FF00' },
{ id: 'hihat', name: 'HIHAT', color: '#0099FF' },
{ id: 'perc', name: 'PERC', color: '#FF00FF' }];


// Arpeggiator patterns
const ARP_PATTERNS = {
  up: (notes, step) => notes[step % notes.length],
  down: (notes, step) => notes[notes.length - 1 - step % notes.length],
  upDown: (notes, step) => {
    const cycle = notes.length * 2 - 2;
    const pos = step % cycle;
    return pos < notes.length ? notes[pos] : notes[cycle - pos];
  },
  random: notes => notes[Math.floor(Math.random() * notes.length)],
  chord: (notes, step) => notes,
  bounce: (notes, step) => {
    const pos = Math.abs(Math.sin(step * 0.3)) * (notes.length - 1);
    return notes[Math.round(pos)];
  },
  cascade: (notes, step) => {
    const cascadeStep = Math.floor(step / 2) % notes.length;
    return step % 2 === 0 ? notes[cascadeStep] : notes[(cascadeStep + 2) % notes.length];
  },
  spiral: (notes, step) => {
    const spiralIndex = (step * 3 + Math.floor(step / notes.length)) % notes.length;
    return notes[spiralIndex];
  } };


// Musical scales
const SCALES = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  japanese: [0, 1, 5, 7, 8] };


// Euclidean rhythm generator
const generateEuclideanRhythm = (steps, pulses) => {
  const pattern = new Array(steps).fill(false);
  if (pulses === 0) return pattern;

  const pulsesLimited = Math.min(pulses, steps);

  for (let i = 0; i < pulsesLimited; i++) {
    pattern[Math.floor(i * steps / pulsesLimited)] = true;
  }

  const rotation = Math.floor(steps / 4);
  return [...pattern.slice(rotation), ...pattern.slice(0, rotation)];
};

// KD-Tree implementation
class KDNode {
  constructor(point, axis) {
    this.point = point;
    this.axis = axis;
    this.left = null;
    this.right = null;
  }}


class KDTree {
  constructor(points, indices) {
    this.indices = indices;
    this.root = points && points.length > 0 ? this.buildTree(points) : null;
  }

  buildTree(points, depth = 0) {
    if (!points || points.length === 0) return null;

    const k = 3;
    const axis = depth % k;

    points.sort((a, b) => a[this.indices[axis]] - b[this.indices[axis]]);
    const median = Math.floor(points.length / 2);

    const node = new KDNode(points[median], axis);
    node.left = this.buildTree(points.slice(0, median), depth + 1);
    node.right = this.buildTree(points.slice(median + 1), depth + 1);

    return node;
  }

  nearestNeighborInt(query, node = this.root, best = null) {
    if (node === null) return best;

    const dist = this.squaredDistance(query, node.point);
    if (!best || dist < best.dist) {
      best = { point: node.point, dist: dist };
    }

    const axis = node.axis;
    const side = query[axis] < node.point[this.indices[axis]] ? 'left' : 'right';
    best = this.nearestNeighborInt(query, node[side], best);

    if (best) {
      const otherSide = side === 'left' ? 'right' : 'left';
      const diff = query[axis] - node.point[this.indices[axis]];
      if (diff * diff < best.dist) {
        best = this.nearestNeighborInt(query, node[otherSide], best);
      }
    }
    return best;
  }

  nearestNeighbor(query) {
    if (!this.root) return null;
    const result = this.nearestNeighborInt(query);
    return result ? result.point : null;
  }

  squaredDistance(query, a) {
    let sum = 0;
    for (let i = 0; i < 3; i++) {
      const queryVal = query[i] || 0;
      const aVal = a[this.indices[i]] || 0;
      sum += (aVal - queryVal) ** 2;
    }
    return sum;
  }}


const MultiDrumMachine = () => {
  // Core state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tempo, setTempo] = useState(120);
  const [masterVolume, setMasterVolume] = useState(0.7);
  const [numSteps, setNumSteps] = useState(16);

  // Audio refs
  const audioContextRef = useRef(null);
  const mainGainNodeRef = useRef(null);
  const nextStepTimeRef = useRef(0);
  const currentStepRef = useRef(0);

  // Initialize drum states
  const [drumStates, setDrumStates] = useState(() => {
    const initialStates = {};
    DRUMS.forEach((drum, index) => {
      initialStates[drum.id] = {
        circle: {
          x: 25 + index % 2 * 50,
          y: 25 + Math.floor(index / 2) * 50,
          radius: 30 },

        euclideanPulses: 4,
        volume: 0.8,
        muted: false,
        patternMode: 'circle',
        autoEvolve: false,
        evolveSpeed: 0.1,
        evolveMode: 'lissajous',
        radiusLocked: false,
        evolutionTime: 0,
        noiseOffset: { x: Math.random() * 1000, y: Math.random() * 1000, r: Math.random() * 1000 },
        velocity: { x: 0, y: 0, r: 0 },
        arp: {
          enabled: false,
          pattern: 'up',
          scale: 'pentatonic',
          octaveRange: 2,
          baseNote: 60,
          speed: 1,
          noteLength: 0.8,
          swing: 0,
          currentArpStep: 0 } };


    });
    return initialStates;
  });

  // Pattern data
  const [patternData, setPatternData] = useState([]);
  const [kdTree, setKdTree] = useState(null);

  // Simple noise function
  const noise = x => {
    const x1 = Math.sin(x * 1.23) * 43758.5453;
    return x1 - Math.floor(x1);
  };

  // Initialize Web Audio
  const initializeAudio = useCallback(async () => {var _audioContextRef$curr;
    if (!audioContextRef.current) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();

        mainGainNodeRef.current = audioContextRef.current.createGain();
        mainGainNodeRef.current.gain.value = masterVolume;
        mainGainNodeRef.current.connect(audioContextRef.current.destination);

        console.log('Audio context initialized');
      } catch (error) {
        console.error('Failed to initialize AudioContext:', error);
      }
    }

    if (((_audioContextRef$curr = audioContextRef.current) === null || _audioContextRef$curr === void 0 ? void 0 : _audioContextRef$curr.state) === 'suspended') {
      try {
        await audioContextRef.current.resume();
        console.log('Audio context resumed');
      } catch (error) {
        console.error('Failed to resume audio context:', error);
      }
    }
  }, [masterVolume]);

  // Update master volume
  useEffect(() => {
    if (mainGainNodeRef.current) {
      mainGainNodeRef.current.gain.value = masterVolume;
    }
  }, [masterVolume]);

  // Convert MIDI note to frequency
  const midiToFreq = midiNote => {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  };

  // Play drum sound at specific frequency
  const playDrumNoteAtFreq = (drumId, frequency, velocity, drumVolume, startTime, duration) => {
    const context = audioContextRef.current;

    try {
      switch (drumId) {
        case 'kick':{
            const osc = context.createOscillator();
            const oscGain = context.createGain();

            osc.type = 'sine';
            const baseFreq = frequency || 60;
            const startFreq = baseFreq * 2 + velocity * 50;
            osc.frequency.setValueAtTime(startFreq, startTime);
            osc.frequency.exponentialRampToValueAtTime(baseFreq, startTime + 0.05);

            const noteLength = duration || 0.3;
            oscGain.gain.setValueAtTime(velocity * velocity * drumVolume, startTime);
            oscGain.gain.exponentialRampToValueAtTime(0.01, startTime + noteLength);

            osc.connect(oscGain);
            oscGain.connect(mainGainNodeRef.current);

            osc.start(startTime);
            osc.stop(startTime + noteLength);
            break;
          }

        case 'snare':{
            const osc = context.createOscillator();
            const oscGain = context.createGain();

            const noiseBuffer = context.createBuffer(1, context.sampleRate * 0.1, context.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) {
              noiseData[i] = Math.random() - 0.5;
            }

            const noiseSource = context.createBufferSource();
            noiseSource.buffer = noiseBuffer;
            const noiseGain = context.createGain();
            const noiseFilter = context.createBiquadFilter();

            osc.type = 'triangle';
            const baseFreq = frequency || 200;
            osc.frequency.setValueAtTime(baseFreq, startTime);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, startTime + 0.03);

            const noteLength = duration || 0.1;
            oscGain.gain.setValueAtTime(0.5 * velocity * drumVolume, startTime);
            oscGain.gain.exponentialRampToValueAtTime(0.01, startTime + noteLength);

            noiseFilter.type = 'highpass';
            noiseFilter.frequency.setValueAtTime(frequency ? frequency * 5 : 1000, startTime);

            noiseGain.gain.setValueAtTime(0.8 * velocity * drumVolume, startTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, startTime + noteLength * 1.5);

            osc.connect(oscGain);
            oscGain.connect(mainGainNodeRef.current);

            noiseSource.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(mainGainNodeRef.current);

            osc.start(startTime);
            osc.stop(startTime + noteLength);

            noiseSource.start(startTime);
            noiseSource.stop(startTime + noteLength * 1.5);
            break;
          }

        case 'hihat':{
            const noiseBuffer = context.createBuffer(1, context.sampleRate * 0.05, context.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) {
              noiseData[i] = Math.random() - 0.5;
            }

            const noiseSource = context.createBufferSource();
            noiseSource.buffer = noiseBuffer;
            const noiseGain = context.createGain();
            const hihatFilter = context.createBiquadFilter();

            hihatFilter.type = 'highpass';
            hihatFilter.frequency.setValueAtTime(frequency ? frequency * 10 : 8000, startTime);

            const noteLength = duration || 0.05;
            noiseGain.gain.setValueAtTime(0.5 * velocity * drumVolume, startTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, startTime + noteLength);

            noiseSource.connect(hihatFilter);
            hihatFilter.connect(noiseGain);
            noiseGain.connect(mainGainNodeRef.current);

            noiseSource.start(startTime);
            noiseSource.stop(startTime + noteLength);
            break;
          }

        case 'perc':{
            const osc1 = context.createOscillator();
            const osc2 = context.createOscillator();
            const gainNode = context.createGain();
            const filter = context.createBiquadFilter();

            osc1.type = 'square';
            osc2.type = 'square';

            const baseFreq = frequency || 800;
            osc1.frequency.setValueAtTime(baseFreq, startTime);
            osc2.frequency.setValueAtTime(baseFreq * 1.546, startTime);

            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(baseFreq * 3.75, startTime);
            filter.Q.setValueAtTime(15, startTime);

            const noteLength = duration || 0.08;
            gainNode.gain.setValueAtTime(0.3 * velocity * drumVolume, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + noteLength);

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(mainGainNodeRef.current);

            osc1.start(startTime);
            osc1.stop(startTime + noteLength);
            osc2.start(startTime);
            osc2.stop(startTime + noteLength);
            break;
          }}

    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  // Play synthesized drum sounds with arpeggiator
  const playDrumSound = useCallback((drumId, velocity = 1, stepInBar = 0) => {
    if (!audioContextRef.current || !mainGainNodeRef.current) return;
    if (drumStates[drumId].muted) return;

    const context = audioContextRef.current;
    const currentTime = context.currentTime;
    const drumVolume = drumStates[drumId].volume;
    const arp = drumStates[drumId].arp;

    const stepDuration = 60.0 / tempo / 4;
    const arpStepDuration = stepDuration / arp.speed;
    const swing = arp.swing * 0.2 * arpStepDuration;

    if (arp.enabled) {
      const scaleNotes = SCALES[arp.scale] || SCALES.pentatonic;
      const notes = [];

      for (let octave = 0; octave < arp.octaveRange; octave++) {
        scaleNotes.forEach(interval => {
          notes.push(arp.baseNote + interval + octave * 12);
        });
      }

      const patternFunc = ARP_PATTERNS[arp.pattern];

      if (arp.pattern === 'chord') {
        notes.forEach((midiNote, index) => {
          const freq = midiToFreq(midiNote);
          const noteVelocity = velocity * (1 - index * 0.1);
          playDrumNoteAtFreq(drumId, freq, noteVelocity, drumVolume, currentTime, arp.noteLength * arpStepDuration);
        });
      } else {
        const midiNote = patternFunc(notes, drumStates[drumId].arp.currentArpStep);
        const freq = midiToFreq(midiNote);

        const swingDelay = drumStates[drumId].arp.currentArpStep % 2 === 1 ? swing : 0;

        setTimeout(() => {
          playDrumNoteAtFreq(drumId, freq, velocity, drumVolume, context.currentTime, arp.noteLength * arpStepDuration);
        }, swingDelay * 1000);
      }

      setDrumStates(prev => ({
        ...prev,
        [drumId]: {
          ...prev[drumId],
          arp: {
            ...prev[drumId].arp,
            currentArpStep: (prev[drumId].arp.currentArpStep + 1) % (notes.length * 2) } } }));



    } else {
      playDrumNoteAtFreq(drumId, null, velocity, drumVolume, currentTime, null);
    }
  }, [drumStates, tempo]);

  // Initialize pattern database
  useEffect(() => {
    const nsteps = numSteps;
    const numToList = (k, n) => {
      const list = new Array(n).fill(0);
      let i = 0;
      while (k > 0 && i < n) {
        list[n - i - 1] = k % 2;
        i++;
        k = Math.floor(k / 2);
      }
      return list;
    };

    const dotProduct = (a, b) => a.reduce((sum, val, idx) => sum + val * b[idx], 0);
    const harmonics = [1, 2, 3, 4];
    const trigTables = [];

    harmonics.forEach(multiplier => {
      const sinTable = Array.from({ length: nsteps }, (_, x) =>
      Math.sin(x * Math.PI * 2 * multiplier / nsteps));

      const cosTable = Array.from({ length: nsteps }, (_, x) =>
      Math.cos(x * Math.PI * 2 * multiplier / nsteps));

      trigTables.push(sinTable, cosTable);
    });

    const data = [];
    const maxPatterns = 1 << nsteps;

    for (let i = 0; i < maxPatterns; i++) {
      const pattern = numToList(i, nsteps);
      const count = pattern.filter(bit => bit === 1).length;
      const safeDiv = val => count === 0 ? 0 : val / count;

      const features = [i, count];

      trigTables.forEach(table => {
        features.push(safeDiv(dotProduct(table, pattern)));
      });

      data.push(features);
    }

    setPatternData(data);
    setKdTree(new KDTree(data, [1, 2, 3]));
  }, [numSteps]);

  // Get active steps for a drum
  const getActiveSteps = useCallback(drumId => {
    const drumState = drumStates[drumId];

    if (drumState.patternMode === 'euclidean') {
      return generateEuclideanRhythm(numSteps, drumState.euclideanPulses);
    }

    if (!kdTree || !patternData || patternData.length === 0) {
      const defaultPattern = new Array(numSteps).fill(false);
      for (let i = 0; i < numSteps; i += 4) {
        defaultPattern[i] = true;
      }
      return defaultPattern;
    }

    const circle = drumState.circle;
    const scaledX = (circle.x - 50) / 50;
    const scaledY = (circle.y - 50) / 50;
    const ang = Math.atan2(scaledY, scaledX);

    const rawR = Math.sqrt(scaledX * scaledX + scaledY * scaledY);
    const r = Math.pow(rawR, 2.5);

    const radiusNorm = (circle.radius - 15) / 45;
    const densityTarget = Math.min(numSteps, Math.max(0, Math.round(radiusNorm * numSteps)));

    const query = [
    densityTarget,
    0.8 * r * Math.sin(ang),
    0.8 * r * Math.cos(ang)].
    map(v => isNaN(v) ? 0 : v);

    const nearest = kdTree.nearestNeighbor(query);
    if (!nearest) return Array(numSteps).fill(false);

    const patternId = nearest[0] || 0;

    const pattern = [];
    let k = patternId;
    for (let i = 0; i < numSteps; i++) {
      pattern[numSteps - i - 1] = k % 2;
      k = Math.floor(k / 2);
    }

    return pattern.map(val => Boolean(val));
  }, [kdTree, patternData, drumStates, numSteps]);

  // Auto-evolution for drums
  useEffect(() => {
    const intervals = [];

    DRUMS.forEach(drum => {
      if (drumStates[drum.id].autoEvolve && isPlaying) {
        const interval = setInterval(() => {
          setDrumStates(prev => {
            const state = prev[drum.id];
            const speed = state.evolveSpeed;
            const evolveMode = state.evolveMode;
            const currentCircle = state.circle;

            const newEvolutionTime = state.evolutionTime + speed * 0.02;
            const t = newEvolutionTime;

            let newX = currentCircle.x;
            let newY = currentCircle.y;
            let newRadius = currentCircle.radius;
            let newNoiseOffset = { ...state.noiseOffset };
            let newVelocity = { ...state.velocity };

            switch (evolveMode) {
              case 'lissajous':
                newX = 50 + 35 * Math.sin(t * 2.1 * speed) * Math.cos(t * 0.7 * speed);
                newY = 50 + 35 * Math.cos(t * 3.2 * speed) * Math.sin(t * 0.9 * speed);
                newRadius = state.radiusLocked ? currentCircle.radius :
                35 + 15 * Math.sin(t * 1.7 * speed);
                break;

              case 'chaos':
                const dx = (currentCircle.y - 50) * 0.1 - (currentCircle.x - 50) * 0.05;
                const dy = (currentCircle.x - 50) * 0.1 + Math.sin(t * speed) * 10;
                newX = Math.max(10, Math.min(90, currentCircle.x + dx * speed));
                newY = Math.max(10, Math.min(90, currentCircle.y + dy * speed));
                newRadius = state.radiusLocked ? currentCircle.radius :
                35 + 20 * Math.sin(t * 2.3 * speed);
                break;

              case 'perlin':
                newNoiseOffset.x += speed * 0.05;
                newNoiseOffset.y += speed * 0.05;
                newNoiseOffset.r += speed * 0.03;

                const noiseX = noise(newNoiseOffset.x) - 0.5;
                const noiseY = noise(newNoiseOffset.y + 100) - 0.5;
                const noiseR = noise(newNoiseOffset.r + 200);

                newX = 50 + noiseX * 70;
                newY = 50 + noiseY * 70;
                newRadius = state.radiusLocked ? currentCircle.radius :
                25 + noiseR * 30;
                break;

              case 'bounce':
                newVelocity.x += (Math.random() - 0.5) * speed * 2;
                newVelocity.y += (Math.random() - 0.5) * speed * 2;
                newVelocity.r = state.radiusLocked ? 0 : Math.sin(t * 3 * speed) * 0.5;

                newVelocity.x *= 0.98;
                newVelocity.y *= 0.98;

                newX = currentCircle.x + newVelocity.x;
                newY = currentCircle.y + newVelocity.y;
                newRadius = currentCircle.radius + newVelocity.r;

                if (newX < 15 || newX > 85) {
                  newVelocity.x *= -0.8;
                  newX = Math.max(15, Math.min(85, newX));
                }
                if (newY < 15 || newY > 85) {
                  newVelocity.y *= -0.8;
                  newY = Math.max(15, Math.min(85, newY));
                }
                break;

              case 'spiral':
                const spiralR = 30 + 15 * Math.sin(t * 0.5 * speed);
                const spiralAngle = t * 2 * speed;
                newX = 50 + spiralR * Math.cos(spiralAngle);
                newY = 50 + spiralR * Math.sin(spiralAngle);
                newRadius = state.radiusLocked ? currentCircle.radius :
                35 + 10 * Math.cos(t * 3 * speed);
                break;

              case 'drunk':
                const drunkAngle = Math.random() * Math.PI * 2;
                const drunkSpeed = speed * 3;
                newX = currentCircle.x + Math.cos(drunkAngle) * drunkSpeed;
                newY = currentCircle.y + Math.sin(drunkAngle) * drunkSpeed;
                newRadius = state.radiusLocked ? currentCircle.radius :
                currentCircle.radius + (Math.random() - 0.5) * 2 * speed;

                newX = Math.max(10, Math.min(90, newX));
                newY = Math.max(10, Math.min(90, newY));
                newRadius = Math.max(15, Math.min(60, newRadius));
                break;}


            return {
              ...prev,
              [drum.id]: {
                ...prev[drum.id],
                circle: {
                  x: Math.max(0, Math.min(100, newX)),
                  y: Math.max(0, Math.min(100, newY)),
                  radius: Math.max(15, Math.min(60, newRadius)) },

                evolutionTime: newEvolutionTime,
                noiseOffset: newNoiseOffset,
                velocity: newVelocity } };


          });
        }, 50);

        intervals.push(interval);
      }
    });

    return () => intervals.forEach(clearInterval);
  }, [drumStates, isPlaying]);

  // Scheduler function
  const scheduler = useCallback(() => {
    if (!audioContextRef.current || !isPlaying) return;

    const currentTime = audioContextRef.current.currentTime;
    const scheduleAheadTime = 0.1;
    const stepDuration = 60.0 / tempo / 4;

    while (nextStepTimeRef.current < currentTime + scheduleAheadTime) {
      const step = currentStepRef.current;

      DRUMS.forEach(drum => {
        const activeSteps = getActiveSteps(drum.id);

        if (activeSteps[step]) {
          const velocity = 0.8 + (Math.random() - 0.5) * 0.2;

          setTimeout(() => {
            playDrumSound(drum.id, velocity, step);
          }, Math.max(0, (nextStepTimeRef.current - currentTime) * 1000));
        }
      });

      setTimeout(() => {
        setCurrentStep(step);
      }, Math.max(0, (nextStepTimeRef.current - currentTime) * 1000));

      currentStepRef.current = (currentStepRef.current + 1) % numSteps;
      nextStepTimeRef.current += stepDuration;
    }
  }, [isPlaying, tempo, numSteps, getActiveSteps, playDrumSound]);

  // Run scheduler
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(scheduler, 25);

    return () => clearInterval(interval);
  }, [isPlaying, scheduler]);

  const togglePlayback = async () => {
    await initializeAudio();

    if (isPlaying) {
      setIsPlaying(false);
      nextStepTimeRef.current = 0;
    } else {
      setCurrentStep(0);
      currentStepRef.current = 0;
      nextStepTimeRef.current = audioContextRef.current.currentTime;
      setIsPlaying(true);
    }
  };

  const handleMouseDown = (drumId, event) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const initialX = (event.clientX - rect.left) / rect.width * 100;
    const initialY = (event.clientY - rect.top) / rect.height * 100;

    setDrumStates(prev => ({
      ...prev,
      [drumId]: {
        ...prev[drumId],
        circle: {
          ...prev[drumId].circle,
          x: Math.max(0, Math.min(100, initialX)),
          y: Math.max(0, Math.min(100, initialY)) } } }));




    const handleMouseMove = e => {
      const x = (e.clientX - rect.left) / rect.width * 100;
      const y = (e.clientY - rect.top) / rect.height * 100;

      setDrumStates(prev => ({
        ...prev,
        [drumId]: {
          ...prev[drumId],
          circle: {
            ...prev[drumId].circle,
            x: Math.max(0, Math.min(100, x)),
            y: Math.max(0, Math.min(100, y)) } } }));



    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const randomizeDrum = (drumId, mode = 'random') => {
    setDrumStates(prev => {
      const currentState = prev[drumId];
      let newCircle = { ...currentState.circle };

      const currentRadius = currentState.radiusLocked ? currentState.circle.radius : null;

      switch (mode) {
        case 'random':
          newCircle = {
            x: Math.random() * 100,
            y: Math.random() * 100,
            radius: currentRadius || 20 + Math.random() * 40 };

          break;

        case 'center':
          newCircle = {
            x: 40 + Math.random() * 20,
            y: 40 + Math.random() * 20,
            radius: currentRadius || 30 + Math.random() * 20 };

          break;

        case 'edge':
          const angle = Math.random() * Math.PI * 2;
          const r = 35 + Math.random() * 10;
          newCircle = {
            x: 50 + r * Math.cos(angle),
            y: 50 + r * Math.sin(angle),
            radius: currentRadius || 20 + Math.random() * 20 };

          break;

        case 'sparse':
          newCircle = {
            x: Math.random() * 100,
            y: Math.random() * 100,
            radius: currentRadius || 15 + Math.random() * 10 };

          break;

        case 'dense':
          newCircle = {
            x: Math.random() * 100,
            y: Math.random() * 100,
            radius: currentRadius || 40 + Math.random() * 20 };

          break;}


      return {
        ...prev,
        [drumId]: {
          ...prev[drumId],
          circle: newCircle } };


    });
  };

  const randomizeAll = (mode = 'random') => {
    if (mode === 'smart') {
      randomizeDrum('kick', 'center');
      randomizeDrum('snare', 'sparse');
      randomizeDrum('hihat', 'edge');
      randomizeDrum('perc', 'random');
    } else {
      DRUMS.forEach(drum => randomizeDrum(drum.id, mode));
    }
  };

  return /*#__PURE__*/(
    React.createElement("div", { style: { maxWidth: '1200px', margin: '0 auto', padding: '20px', fontFamily: 'monospace' } }, /*#__PURE__*/
    React.createElement("h1", { style: { fontSize: '16px', marginBottom: '20px' } }, "MULTI-DRUM GENERATIVE MACHINE WITH ARPEGGIATORS"), /*#__PURE__*/


    React.createElement("div", { style: { marginBottom: '20px', padding: '10px', border: '1px solid #ccc' } }, /*#__PURE__*/
    React.createElement("div", { style: { display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' } }, /*#__PURE__*/
    React.createElement("button", { onClick: togglePlayback, style: { padding: '5px 20px' } },
    isPlaying ? 'STOP' : 'PLAY'), /*#__PURE__*/

    React.createElement("button", { onClick: () => randomizeAll('random'), style: { padding: '5px 20px' } }, "RANDOMIZE ALL"), /*#__PURE__*/


    React.createElement("select", {
      onChange: e => randomizeAll(e.target.value),
      style: { padding: '5px', fontFamily: 'monospace', fontSize: '12px' },
      defaultValue: "" }, /*#__PURE__*/

    React.createElement("option", { value: "", disabled: true }, "PRESETS..."), /*#__PURE__*/
    React.createElement("option", { value: "smart" }, "SMART"), /*#__PURE__*/
    React.createElement("option", { value: "center" }, "CENTER"), /*#__PURE__*/
    React.createElement("option", { value: "edge" }, "EDGE"), /*#__PURE__*/
    React.createElement("option", { value: "sparse" }, "SPARSE"), /*#__PURE__*/
    React.createElement("option", { value: "dense" }, "DENSE"))), /*#__PURE__*/



    React.createElement("div", { style: { display: 'flex', gap: '20px', alignItems: 'center' } }, /*#__PURE__*/
    React.createElement("label", null, "BPM: ", /*#__PURE__*/React.createElement("input", { type: "number", value: tempo, onChange: e => setTempo(Number(e.target.value)),
      style: { width: '50px' }, min: "60", max: "200" })), /*#__PURE__*/
    React.createElement("label", null, "MASTER: ", /*#__PURE__*/React.createElement("input", { type: "range", value: masterVolume,
      onChange: e => setMasterVolume(Number(e.target.value)),
      min: "0", max: "1", step: "0.1", style: { width: '80px' } })), /*#__PURE__*/
    React.createElement("label", null, "STEPS: ", /*#__PURE__*/React.createElement("input", { type: "number", value: numSteps,
      onChange: e => {
        const newSteps = Number(e.target.value);
        if (newSteps >= 4 && newSteps <= 16) {
          setNumSteps(newSteps);
          currentStepRef.current = 0;
          setCurrentStep(0);
        }
      },
      style: { width: '40px' }, min: "4", max: "16" })))), /*#__PURE__*/




    React.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' } },
    DRUMS.map((drum) => /*#__PURE__*/
    React.createElement("div", { key: drum.id, style: {
        border: `2px solid ${drum.color}`,
        padding: '10px',
        borderRadius: '5px' } }, /*#__PURE__*/

    React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' } }, /*#__PURE__*/
    React.createElement("span", { style: { color: drum.color, fontWeight: 'bold' } }, drum.name), /*#__PURE__*/
    React.createElement("div", { style: { display: 'flex', gap: '5px' } }, /*#__PURE__*/
    React.createElement("button", { onClick: () => {
        const modes = ['random', 'center', 'edge', 'sparse', 'dense'];
        const randomMode = modes[Math.floor(Math.random() * modes.length)];
        randomizeDrum(drum.id, randomMode);
      },
      style: { padding: '2px 8px', fontSize: '11px' } }, "RND"), /*#__PURE__*/
    React.createElement("button", { onClick: () => setDrumStates(prev => ({
        ...prev,
        [drum.id]: { ...prev[drum.id], muted: !prev[drum.id].muted } })),

      style: {
        padding: '2px 8px',
        fontSize: '11px',
        backgroundColor: drumStates[drum.id].muted ? '#ff0000' : '#fff' } },

    drumStates[drum.id].muted ? 'MUTED' : 'MUTE'))), /*#__PURE__*/





    React.createElement("div", { style: { marginBottom: '5px', fontSize: '11px' } }, /*#__PURE__*/
    React.createElement("label", null, /*#__PURE__*/
    React.createElement("input", { type: "radio", checked: drumStates[drum.id].patternMode === 'circle',
      onChange: () => setDrumStates(prev => ({
        ...prev,
        [drum.id]: { ...prev[drum.id], patternMode: 'circle' } })) }), " CIRCLE"), /*#__PURE__*/


    React.createElement("label", { style: { marginLeft: '10px' } }, /*#__PURE__*/
    React.createElement("input", { type: "radio", checked: drumStates[drum.id].patternMode === 'euclidean',
      onChange: () => setDrumStates(prev => ({
        ...prev,
        [drum.id]: { ...prev[drum.id], patternMode: 'euclidean' } })) }), " EUCLIDEAN")),





    drumStates[drum.id].patternMode === 'circle' ? /*#__PURE__*/
    React.createElement("div", { style: {
        width: '100%',
        height: '120px',
        border: '1px solid #ccc',
        position: 'relative',
        cursor: 'crosshair',
        marginBottom: '5px',
        backgroundColor: '#f9f9f9' },
      onMouseDown: e => handleMouseDown(drum.id, e) }, /*#__PURE__*/
    React.createElement("div", { style: {
        position: 'absolute',
        left: `${drumStates[drum.id].circle.x}%`,
        top: `${drumStates[drum.id].circle.y}%`,
        width: `${drumStates[drum.id].circle.radius}px`,
        height: `${drumStates[drum.id].circle.radius}px`,
        border: `2px solid ${drum.color}`,
        borderRadius: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        backgroundColor: `${drum.color}22`,
        boxShadow: drumStates[drum.id].radiusLocked ? `inset 0 0 0 1px ${drum.color}` : 'none' } })) : /*#__PURE__*/



    React.createElement("div", { style: { marginBottom: '5px' } }, /*#__PURE__*/
    React.createElement("label", { style: { fontSize: '11px' } }, "PULSES: ", /*#__PURE__*/
    React.createElement("input", { type: "range",
      value: drumStates[drum.id].euclideanPulses,
      onChange: e => setDrumStates(prev => ({
        ...prev,
        [drum.id]: { ...prev[drum.id], euclideanPulses: Number(e.target.value) } })),

      min: "0", max: numSteps, style: { width: '80px' } }),
    drumStates[drum.id].euclideanPulses)), /*#__PURE__*/





    React.createElement("div", { style: { fontSize: '11px' } }, /*#__PURE__*/
    React.createElement("label", null, "VOL: ", /*#__PURE__*/React.createElement("input", { type: "range",
      value: drumStates[drum.id].volume,
      onChange: e => setDrumStates(prev => ({
        ...prev,
        [drum.id]: { ...prev[drum.id], volume: Number(e.target.value) } })),

      min: "0", max: "1", step: "0.1", style: { width: '60px' } })),

    drumStates[drum.id].patternMode === 'circle' && /*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement("label", { style: { marginLeft: '10px', opacity: drumStates[drum.id].radiusLocked ? 0.5 : 1 } }, "R: ", /*#__PURE__*/
    React.createElement("input", { type: "range",
      value: drumStates[drum.id].circle.radius,
      onChange: e => setDrumStates(prev => ({
        ...prev,
        [drum.id]: {
          ...prev[drum.id],
          circle: { ...prev[drum.id].circle, radius: Number(e.target.value) } } })),


      min: "15", max: "60", style: { width: '60px' },
      disabled: drumStates[drum.id].radiusLocked })), /*#__PURE__*/


    React.createElement("label", { style: { marginLeft: '5px' } }, /*#__PURE__*/
    React.createElement("input", { type: "checkbox",
      checked: drumStates[drum.id].radiusLocked,
      onChange: e => setDrumStates(prev => ({
        ...prev,
        [drum.id]: { ...prev[drum.id], radiusLocked: e.target.checked } })) }), /*#__PURE__*/


    React.createElement("span", { style: { fontSize: '10px' } }, "LOCK"))), /*#__PURE__*/




    React.createElement("div", { style: { marginTop: '5px' } }, /*#__PURE__*/
    React.createElement("label", null, /*#__PURE__*/
    React.createElement("input", { type: "checkbox",
      checked: drumStates[drum.id].autoEvolve,
      onChange: e => setDrumStates(prev => ({
        ...prev,
        [drum.id]: { ...prev[drum.id], autoEvolve: e.target.checked } })) }), "AUTO"),



    drumStates[drum.id].autoEvolve && /*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement("label", { style: { marginLeft: '10px' } }, "SPD: ", /*#__PURE__*/
    React.createElement("input", { type: "range",
      value: drumStates[drum.id].evolveSpeed,
      onChange: e => setDrumStates(prev => ({
        ...prev,
        [drum.id]: { ...prev[drum.id], evolveSpeed: Number(e.target.value) } })),

      min: "0.05", max: "1", step: "0.05", style: { width: '60px' } })), /*#__PURE__*/

    React.createElement("div", { style: { marginTop: '3px' } }, /*#__PURE__*/
    React.createElement("select", {
      value: drumStates[drum.id].evolveMode,
      onChange: e => setDrumStates(prev => ({
        ...prev,
        [drum.id]: { ...prev[drum.id], evolveMode: e.target.value } })),

      style: { fontSize: '11px', fontFamily: 'monospace' } }, /*#__PURE__*/

    React.createElement("option", { value: "lissajous" }, "LISSAJOUS"), /*#__PURE__*/
    React.createElement("option", { value: "chaos" }, "CHAOS"), /*#__PURE__*/
    React.createElement("option", { value: "perlin" }, "PERLIN"), /*#__PURE__*/
    React.createElement("option", { value: "bounce" }, "BOUNCE"), /*#__PURE__*/
    React.createElement("option", { value: "spiral" }, "SPIRAL"), /*#__PURE__*/
    React.createElement("option", { value: "drunk" }, "DRUNK")))))), /*#__PURE__*/








    React.createElement("div", { style: {
        marginTop: '10px',
        paddingTop: '10px',
        borderTop: '1px solid #ddd',
        backgroundColor: drumStates[drum.id].arp.enabled ? `${drum.color}11` : 'transparent',
        padding: '5px',
        borderRadius: '3px' } }, /*#__PURE__*/

    React.createElement("div", { style: { fontSize: '11px', fontWeight: 'bold', marginBottom: '5px' } }, "ARPEGGIATOR"), /*#__PURE__*/


    React.createElement("label", { style: { fontSize: '11px' } }, /*#__PURE__*/
    React.createElement("input", { type: "checkbox",
      checked: drumStates[drum.id].arp.enabled,
      onChange: e => setDrumStates(prev => ({
        ...prev,
        [drum.id]: {
          ...prev[drum.id],
          arp: { ...prev[drum.id].arp, enabled: e.target.checked } } })) }), "ENABLED"),





    drumStates[drum.id].arp.enabled && /*#__PURE__*/
    React.createElement("div", { style: { marginTop: '5px' } }, /*#__PURE__*/
    React.createElement("div", { style: { display: 'flex', gap: '10px', marginBottom: '5px' } }, /*#__PURE__*/
    React.createElement("label", { style: { fontSize: '10px' } }, "PATTERN:", /*#__PURE__*/

    React.createElement("select", {
      value: drumStates[drum.id].arp.pattern,
      onChange: e => setDrumStates(prev => ({
        ...prev,
        [drum.id]: {
          ...prev[drum.id],
          arp: { ...prev[drum.id].arp, pattern: e.target.value } } })),


      style: { fontSize: '10px', fontFamily: 'monospace', marginLeft: '5px' } }, /*#__PURE__*/

    React.createElement("option", { value: "up" }, "UP"), /*#__PURE__*/
    React.createElement("option", { value: "down" }, "DOWN"), /*#__PURE__*/
    React.createElement("option", { value: "upDown" }, "UP/DOWN"), /*#__PURE__*/
    React.createElement("option", { value: "random" }, "RANDOM"), /*#__PURE__*/
    React.createElement("option", { value: "chord" }, "CHORD"), /*#__PURE__*/
    React.createElement("option", { value: "bounce" }, "BOUNCE"), /*#__PURE__*/
    React.createElement("option", { value: "cascade" }, "CASCADE"), /*#__PURE__*/
    React.createElement("option", { value: "spiral" }, "SPIRAL"))), /*#__PURE__*/



    React.createElement("label", { style: { fontSize: '10px' } }, "SCALE:", /*#__PURE__*/

    React.createElement("select", {
      value: drumStates[drum.id].arp.scale,
      onChange: e => setDrumStates(prev => ({
        ...prev,
        [drum.id]: {
          ...prev[drum.id],
          arp: { ...prev[drum.id].arp, scale: e.target.value } } })),


      style: { fontSize: '10px', fontFamily: 'monospace', marginLeft: '5px' } }, /*#__PURE__*/

    React.createElement("option", { value: "chromatic" }, "CHROMATIC"), /*#__PURE__*/
    React.createElement("option", { value: "major" }, "MAJOR"), /*#__PURE__*/
    React.createElement("option", { value: "minor" }, "MINOR"), /*#__PURE__*/
    React.createElement("option", { value: "pentatonic" }, "PENTATONIC"), /*#__PURE__*/
    React.createElement("option", { value: "blues" }, "BLUES"), /*#__PURE__*/
    React.createElement("option", { value: "dorian" }, "DORIAN"), /*#__PURE__*/
    React.createElement("option", { value: "phrygian" }, "PHRYGIAN"), /*#__PURE__*/
    React.createElement("option", { value: "japanese" }, "JAPANESE")))), /*#__PURE__*/




    React.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', fontSize: '10px' } }, /*#__PURE__*/
    React.createElement("label", null, "NOTE: ", /*#__PURE__*/
    React.createElement("input", { type: "range",
      value: drumStates[drum.id].arp.baseNote,
      onChange: e => setDrumStates(prev => ({
        ...prev,
        [drum.id]: {
          ...prev[drum.id],
          arp: { ...prev[drum.id].arp, baseNote: Number(e.target.value) } } })),


      min: "36", max: "84", style: { width: '60px' } }),
    ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][drumStates[drum.id].arp.baseNote % 12], Math.floor(drumStates[drum.id].arp.baseNote / 12) - 1), /*#__PURE__*/


    React.createElement("label", null, "OCTAVES: ", /*#__PURE__*/
    React.createElement("input", { type: "range",
      value: drumStates[drum.id].arp.octaveRange,
      onChange: e => setDrumStates(prev => ({
        ...prev,
        [drum.id]: {
          ...prev[drum.id],
          arp: { ...prev[drum.id].arp, octaveRange: Number(e.target.value) } } })),


      min: "1", max: "4", style: { width: '50px' } }),
    drumStates[drum.id].arp.octaveRange), /*#__PURE__*/


    React.createElement("label", null, "SPEED: ", /*#__PURE__*/
    React.createElement("input", { type: "range",
      value: drumStates[drum.id].arp.speed,
      onChange: e => setDrumStates(prev => ({
        ...prev,
        [drum.id]: {
          ...prev[drum.id],
          arp: { ...prev[drum.id].arp, speed: Number(e.target.value) } } })),


      min: "0.25", max: "4", step: "0.25", style: { width: '50px' } }),
    drumStates[drum.id].arp.speed, "x"), /*#__PURE__*/


    React.createElement("label", null, "SWING: ", /*#__PURE__*/
    React.createElement("input", { type: "range",
      value: drumStates[drum.id].arp.swing,
      onChange: e => setDrumStates(prev => ({
        ...prev,
        [drum.id]: {
          ...prev[drum.id],
          arp: { ...prev[drum.id].arp, swing: Number(e.target.value) } } })),


      min: "0", max: "1", step: "0.1", style: { width: '50px' } }),
    Math.round(drumStates[drum.id].arp.swing * 100), "%")))), /*#__PURE__*/







    React.createElement("div", { style: { marginTop: '10px', display: 'flex', gap: '2px' } },
    getActiveSteps(drum.id).map((active, i) => /*#__PURE__*/
    React.createElement("div", { key: i, style: {
        flex: 1,
        height: '10px',
        backgroundColor: active ? drum.color : '#ddd',
        outline: isPlaying && i === currentStep ? '2px solid #000' : 'none',
        outlineOffset: '1px' } }))))))));








};

// Render the app
ReactDOM.render( /*#__PURE__*/React.createElement(MultiDrumMachine, null), document.getElementById('root'));