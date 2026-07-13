// Placeholder for future gear logic
console.log('Gear Ratio Drum Machine UI loaded.');

// Gear Ratio Drum Machine - Drag and Drop Logic

const workArea = document.getElementById('work-area');
const gearPalette = document.getElementById('gear-palette');

let draggingGear = null;
let draggingLifter = null;
let offsetX = 0;
let offsetY = 0;
let isFromPalette = false;

// Store placed gears for snapping
const placedGears = [];
const placedLifters = [];

let gearIdCounter = 1;
let lifterIdCounter = 1;
let motorGearId = null;
let isPlaying = true;

// Play/pause button logic
const playPauseBtn = document.getElementById('play-pause-btn');
const playPauseIcon = document.getElementById('play-pause-icon');

function setPlayPauseIcon() {
    if (isPlaying) {
        // Pause icon (two minimal bars)
        playPauseIcon.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="2" width="3" height="8" fill="#000"/><rect x="7" y="2" width="3" height="8" fill="#000"/></svg>`;
    } else {
        // Play icon (simple triangle)
        playPauseIcon.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M4,2 L10,6 L4,10 Z" fill="#000"/></svg>`;
    }
}

playPauseBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    setPlayPauseIcon();
    updateRPMs();
    if (isPlaying) {
        DrumEngine.resume();
    } else {
        // Clear phase memory so resume doesn't fire a stale wrap.
        for (const lifter of placedLifters) {
            lifter._prevPhase = null;
            lifter._wasHigh = false;
        }
    }
});

// Set initial icon
setPlayPauseIcon();

// About modal
const aboutBtn = document.getElementById('about-btn');
const aboutModal = document.getElementById('about-modal');
const aboutCloseBtn = document.getElementById('about-close-btn');

function openAboutModal() {
    aboutModal.hidden = false;
    aboutModal.setAttribute('aria-hidden', 'false');
    aboutCloseBtn.focus();
}

function closeAboutModal() {
    aboutModal.hidden = true;
    aboutModal.setAttribute('aria-hidden', 'true');
    aboutBtn.focus();
}

aboutBtn.addEventListener('click', openAboutModal);
aboutCloseBtn.addEventListener('click', closeAboutModal);
aboutModal.addEventListener('click', (e) => {
    if (e.target.closest('[data-close-modal]')) closeAboutModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !aboutModal.hidden) closeAboutModal();
});

// Animation state
let lastTimestamp = null;

function animateGears(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = (timestamp - lastTimestamp) / 1000; // seconds
    lastTimestamp = timestamp;
    
    if (isPlaying) {
        // First, find all gear chains (connected groups of gears)
        const visited = new Set();
        const gearChains = [];
        
        for (const gear of placedGears) {
            if (visited.has(gear.id)) continue;
            
            // Start a new chain
            const chain = [];
            const queue = [gear];
            visited.add(gear.id);
            
            while (queue.length > 0) {
                const currentGear = queue.shift();
                chain.push(currentGear);
                
                // Add connected gears to the queue
                for (const connId of currentGear.connections) {
                    const connectedGear = placedGears.find(g => g.id === connId);
                    if (connectedGear && !visited.has(connectedGear.id)) {
                        queue.push(connectedGear);
                        visited.add(connectedGear.id);
                    }
                }
            }
            
            if (chain.length > 0) {
                gearChains.push(chain);
            }
        }
        
        // Process each chain
        for (const chain of gearChains) {
            // Find the motor gear in this chain (if any)
            const motorGear = chain.find(g => g.id === motorGearId);
            
            if (motorGear) {
                // Calculate motor rotation
                const motorRpm = Number(document.getElementById('tempo-slider').value);
                const motorDegPerSec = motorRpm * 1; // RPM to degrees per second
                const motorRotation = motorDegPerSec * dt;
                
                // Update motor gear
                if (motorGear.angle === undefined) motorGear.angle = 0;
                motorGear.angle = (motorGear.angle + motorRotation) % 360;
                updateGearRotation(motorGear);
                
                // Propagate rotation through the chain
                const visited = new Set([motorGear.id]);
                const queue = [{ gear: motorGear, angle: motorGear.angle, isStacked: false }];
                
                while (queue.length > 0) {
                    const { gear, angle, isStacked } = queue.shift();
                    
                    // Update connected gears
                    for (const connId of gear.connections) {
                        if (visited.has(connId)) continue;
                        
                        const connectedGear = placedGears.find(g => g.id === connId);
                        if (!connectedGear) continue;
                        
                        visited.add(connId);
                        
                        // Check if this is a stacked gear connection
                        const isStackedConnection = areGearsStacked(gear, connectedGear);
                        
                        if (isStackedConnection) {
                            // Stacked gears rotate at the same angle as their connected gear
                            connectedGear.angle = angle;
                        } else {
                            // Regular meshing: enforce the tooth-interleaving constraint
                            // against the driver every frame. This bakes in both the
                            // opposite rotation direction and the teeth-ratio speed,
                            // and guarantees the teeth stay threaded.
                            connectedGear.angle = computeMeshedAngle(
                                gear, angle,
                                connectedGear.teeth, connectedGear.x, connectedGear.y,
                                connectedGear.angle || 0
                            );
                        }
                        
                        // Update the visual rotation
                        updateGearRotation(connectedGear);
                        
                        // Add to queue for further propagation
                        queue.push({ 
                            gear: connectedGear, 
                            angle: connectedGear.angle,
                            isStacked: isStackedConnection 
                        });
                    }
                }
            } else {
                // If no motor in this chain, all gears should be stationary
                for (const gear of chain) {
                    if (gear.angle === undefined) gear.angle = 0;
                    updateGearRotation(gear);
                }
            }
        }
    }
    
    // Keep a snapped drag preview meshed with its target even while the target
    // keeps rotating, so the dragged gear visibly threads into the running chain.
    if (draggingGear && draggingGear._snapped && !draggingGear._isGearRatio &&
        draggingGear._snapTarget && draggingGear._snapPos) {
        const target = draggingGear._snapTarget;
        const teeth = GEAR_TEETH[Number(draggingGear.dataset.size)];
        const locked = computeMeshedAngle(
            target, target.angle || 0,
            teeth, draggingGear._snapPos.x, draggingGear._snapPos.y,
            draggingGear._lockedAngle || 0
        );
        draggingGear._lockedAngle = locked;
        const svg = draggingGear.querySelector('svg');
        if (svg) {
            svg.style.transition = 'none';
            svg.style.transform = `rotate(${locked}deg)`;
        }
    }

    // Lifters follow their gears and lift/release as teeth pass.
    syncLifterAttachments();
    updateLifterAnimation(dt);
    
    requestAnimationFrame(animateGears);
}

// Tooth-meshing constraint. Given a driver gear (its center position and
// current rotation angle) and the center position of a driven gear, return the
// rotation angle (degrees) for the driven gear so that its teeth interleave
// exactly with the driver's teeth along the line connecting the two centers.
//
// Derivation: the fractional tooth phase of a gear seen at world angle phi is
// p = (phi - angle) * N / 360 (mod 1), since tooth centerlines sit at multiples
// of 360/N in the gear's own frame. Two gears mesh when pA + pB = 0.5 (mod 1):
// a tooth center of one gear points at a gap center of the other. This quantity
// is invariant while the gears rotate at the correct ratio, so enforcing it
// every frame keeps the teeth threaded permanently. Solving for the driven
// angle gives the formula below. The result is then shifted by whole tooth
// periods to land as close as possible to currentAngle, which keeps rotation
// continuous frame-to-frame and picks the smallest visible adjustment when
// snapping a dragged gear into place.
function computeMeshedAngle(driver, driverAngle, drivenTeeth, drivenX, drivenY, currentAngle = 0) {
    const phiAB = Math.atan2(drivenY - driver.y, drivenX - driver.x) * 180 / Math.PI;
    const phiBA = phiAB + 180;
    const toothPeriod = 360 / drivenTeeth;
    let angle = phiBA - toothPeriod / 2 + (phiAB - driverAngle) * (driver.teeth / drivenTeeth);
    angle += Math.round((currentAngle - angle) / toothPeriod) * toothPeriod;
    return angle;
}

// Animation optimization: only update SVG transform if angle changed
function updateGearRotation(gear) {
    const svg = gear.el.querySelector('svg');
    if (svg) {
        if (gear._lastAngle !== gear.angle) {
            svg.style.transform = `rotate(${gear.angle}deg)`;
            svg.style.transition = 'none';
            gear._lastAngle = gear.angle;
        }
    }
}

// All gears share the same tooth size ("module" in gear terminology) so any
// pair of gears can mesh. Pitch radius = MODULE * teeth / 2, which works out to
// exactly the gear's nominal radius (15 + size * 10). Two meshed gears sit at a
// center distance of radius1 + radius2, which is what the snapping code already
// uses.
const MODULE = 5;                            // px of pitch diameter per tooth
const PRESSURE_ANGLE = 20 * Math.PI / 180;   // standard involute pressure angle
const ADDENDUM = MODULE;                     // tooth height above pitch circle
const DEDENDUM = 1.25 * MODULE;              // tooth depth below pitch circle (extra 0.25 = clearance)
const GEAR_PAD = ADDENDUM + 3;               // svg padding beyond pitch radius (tooth tip + stroke)

// Number of teeth for each gear size (index 1-6): teeth = 2 * radius / MODULE
const GEAR_TEETH = [0, 10, 14, 18, 22, 26, 30];

// Color palette for gears (size 1-6)
const GEAR_COLORS = [
    { fill: '#FFD966', stroke: '#B59F00' },  // Size 1: Yellow
    { fill: '#6FA8DC', stroke: '#3D85C6' },  // Size 2: Blue
    { fill: '#93C47D', stroke: '#6AA84F' },  // Size 3: Green
    { fill: '#E06666', stroke: '#CC0000' },  // Size 4: Red
    { fill: '#B4A7D6', stroke: '#8E7CC3' },  // Size 5: Purple
    { fill: '#F6B26B', stroke: '#E69138' }   // Size 6: Orange
];

function gearSVG(radius, teeth, angle = 0, size = 1) {
    // Get colors based on size (default to size 1 if not specified)
    const colors = GEAR_COLORS[Math.min(size - 1, GEAR_COLORS.length - 1)];
    const color = colors.fill;
    const stroke = colors.stroke;

    // Standard involute gear geometry. The same MODULE for every gear means
    // every tooth on every gear is the same size, so any two gears mesh.
    const R = radius;                        // pitch radius (teeth * MODULE / 2)
    const Ra = R + ADDENDUM;                 // tip (addendum) radius
    const Rr = R - DEDENDUM;                 // root (dedendum) radius
    const Rb = R * Math.cos(PRESSURE_ANGLE); // base circle generating the involute

    const pad = GEAR_PAD;
    const svgSize = R * 2 + pad * 2;
    const cx = R + pad, cy = R + pad;

    // Involute function: inv(a) = tan(a) - a. The angular half-width of a tooth
    // at radius r (measured from the tooth centerline) follows from the involute:
    // it is exactly a quarter period at the pitch circle (tooth = gap there),
    // narrows toward the tip and widens toward the root. Below the base circle
    // the flank is drawn radially, which is standard drafting practice.
    const inv = a => Math.tan(a) - a;
    const halfPitch = Math.PI / (2 * teeth) + inv(PRESSURE_ANGLE);
    const halfWidthAt = r => r <= Rb ? halfPitch : halfPitch - inv(Math.acos(Rb / r));

    const pt = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    const flankSteps = 6;

    // Tooth centerlines sit at multiples of 360/teeth starting at 0, which is
    // what the meshing math (computeMeshedAngle) assumes.
    let path = '';
    for (let i = 0; i < teeth; i++) {
        const c = i * 2 * Math.PI / teeth;
        const leadRoot = pt(Rr, c - halfPitch);
        // Root arc across the gap from the previous tooth
        path += i === 0 ? `M${leadRoot}` : `A${Rr} ${Rr} 0 0 1 ${leadRoot}`;
        // Leading flank: radial below the base circle, involute from there to the tip
        for (let k = 0; k <= flankSteps; k++) {
            const r = Rb + (Ra - Rb) * k / flankSteps;
            path += `L${pt(r, c - halfWidthAt(r))}`;
        }
        // Arc across the tooth tip
        path += `A${Ra} ${Ra} 0 0 1 ${pt(Ra, c + halfWidthAt(Ra))}`;
        // Trailing flank back down to the root
        for (let k = flankSteps; k >= 0; k--) {
            const r = Rb + (Ra - Rb) * k / flankSteps;
            path += `L${pt(r, c + halfWidthAt(r))}`;
        }
        path += `L${pt(Rr, c + halfPitch)}`;
    }
    // Final root arc back to the start of the first tooth
    path += `A${Rr} ${Rr} 0 0 1 ${pt(Rr, -halfPitch)}Z`;

    const hub = `<circle cx="${cx}" cy="${cy}" r="${MODULE * 0.9}" fill="${stroke}" fill-opacity="0.3" stroke="${stroke}" stroke-width="1.5"/>`;
    return `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}"><path d="${path}" fill="${color}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>${hub}</svg>`;
}

// Update palette gears to use new size
function updatePaletteGears() {
    document.querySelectorAll('.gear-option').forEach(opt => {
        const size = Number(opt.dataset.size);
        const radius = 15 + size * 10;
        const teeth = GEAR_TEETH[size];
        // Use the same padding calculation as gearSVG
        const svgSize = radius * 2 + GEAR_PAD * 2;
        opt.style.width = `${svgSize}px`;
        opt.style.height = `${svgSize}px`;
        opt.innerHTML = gearSVG(radius, teeth, 0, size);
    });
}
updatePaletteGears();

// ---------------------------------------------------------------------------
// Lifters (levers): small pivoted fingers that lift each time a gear tooth
// passes. Twelve drum voices live in the palette; later each can drive its
// own sample. Timing uses the same tooth-phase model as meshing.
// ---------------------------------------------------------------------------
const LIFTER_VOICES = [
    { abbr: 'BD',  name: 'bass drum',      file: 'sounds/bassdrum-BT3A0D3.WAV' },
    { abbr: 'SD',  name: 'snare drum',     file: 'sounds/snare-ST0TASA.WAV' },
    { abbr: 'CH',  name: 'closed hi hat',  file: 'sounds/closedhihat-HHCD6.WAV' },
    { abbr: 'OH',  name: 'open hi hat',    file: 'sounds/openhihat-HHOD2.WAV' },
    { abbr: 'LT',  name: 'low tom',        file: 'sounds/lowtom-LTAD3.WAV' },
    { abbr: 'MT',  name: 'mid tom',        file: 'sounds/midtom-MTAD3.WAV' },
    { abbr: 'HT',  name: 'hi tom',         file: 'sounds/hitom-HTAD3.WAV' },
    { abbr: 'CLP', name: 'clap',           file: 'sounds/clap-HANDCLP2.WAV' },
    { abbr: 'CNG', name: 'conga',          file: 'sounds/conga-HC-01.wav' },
    { abbr: 'RIM', name: 'rim',            file: 'sounds/rim-RIM63.WAV' },
    { abbr: 'CSH', name: 'crash',          file: 'sounds/crash-CSHD4.WAV' },
    { abbr: 'RID', name: 'ride',           file: 'sounds/ride-RIDED4.WAV' }
];
const LIFTER_VOICE_COUNT = LIFTER_VOICES.length;

// Web Audio drum engine. Samples are decoded once into AudioBuffers, then each
// hit creates a throwaway BufferSource scheduled on the audio clock. Triggers
// come from tooth-phase crossings (same math as meshing); we interpolate the
// crossing time within the animation frame so hits stay locked to gear motion
// instead of rAF jitter. Hats share a choke group so CH cuts off OH and vice versa.
const DrumEngine = {
    ctx: null,
    master: null,
    buffers: Object.create(null),
    ready: false,
    loading: null,
    activeHats: [],

    ensureContext() {
        if (this.ctx) return this.ctx;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.85;
        this.master.connect(this.ctx.destination);
        return this.ctx;
    },

    async resume() {
        const ctx = this.ensureContext();
        if (ctx && ctx.state === 'suspended') {
            try { await ctx.resume(); } catch (_) { /* autoplay policy */ }
        }
        return ctx;
    },

    loadAll() {
        if (this.loading) return this.loading;
        this.loading = (async () => {
            const ctx = this.ensureContext();
            if (!ctx) return false;
            await Promise.all(LIFTER_VOICES.map(async (voice) => {
                try {
                    const res = await fetch(voice.file);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const raw = await res.arrayBuffer();
                    const buffer = await ctx.decodeAudioData(raw.slice(0));
                    this.buffers[voice.abbr] = buffer;
                } catch (err) {
                    console.warn(`Failed to load ${voice.abbr} (${voice.file}):`, err);
                }
            }));
            this.ready = Object.keys(this.buffers).length > 0;
            return this.ready;
        })();
        return this.loading;
    },

    chokeHats(when) {
        for (const src of this.activeHats) {
            try {
                src.stop(when);
            } catch (_) { /* already stopped */ }
        }
        this.activeHats = [];
    },

    // Play voice `abbr` at audio-context time `when` (seconds).
    play(abbr, when) {
        if (!this.ready) return;
        const buffer = this.buffers[abbr];
        const ctx = this.ctx;
        if (!buffer || !ctx) return;

        const startAt = Math.max(when, ctx.currentTime);
        if (abbr === 'CH' || abbr === 'OH') {
            this.chokeHats(startAt);
        }

        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(this.master);
        try {
            src.start(startAt);
        } catch (_) {
            return;
        }

        if (abbr === 'CH' || abbr === 'OH') {
            this.activeHats.push(src);
            src.onended = () => {
                const i = this.activeHats.indexOf(src);
                if (i >= 0) this.activeHats.splice(i, 1);
            };
        }
    }
};

DrumEngine.loadAll();

// Unlock audio on first user gesture (required by autoplay policies).
function unlockAudio() {
    DrumEngine.resume();
    DrumEngine.loadAll();
}
['pointerdown', 'keydown', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { once: true, passive: true });
});

const LIFTER_ARM = 18;          // px from pivot to tip in local SVG
const LIFTER_MAX_LIFT = 32;     // degrees the arm swings when a tooth pushes it
const LIFTER_SNAP_PX = 42;      // how close to a gear tip circle to snap
const LIFTER_SVG_W = 28;
const LIFTER_SVG_H = 36;
const LIFTER_PIVOT_X = 14;      // pivot near bottom-center; arm points up at rest
const LIFTER_PIVOT_Y = 28;

function lifterSVG() {
    // Vertical rest pose: pivot at the bottom, tip straight up. When snapped to
    // a gear the whole graphic is rotated so the tip faces the tooth path.
    const px = LIFTER_PIVOT_X;
    const py = LIFTER_PIVOT_Y;
    const tipY = py - LIFTER_ARM;
    return `<svg width="${LIFTER_SVG_W}" height="${LIFTER_SVG_H}" viewBox="0 0 ${LIFTER_SVG_W} ${LIFTER_SVG_H}" style="overflow:visible">
  <g class="lifter-arm">
    <line class="lifter-shaft" x1="${px}" y1="${tipY + 3}" x2="${px}" y2="${py}" stroke="#5a5a5a" stroke-width="2.5" stroke-linecap="round"/>
    <circle class="lifter-tip" cx="${px}" cy="${tipY}" r="3.2" fill="#7a7a7a" stroke="#3a3a3a" stroke-width="1.2"/>
  </g>
  <circle class="lifter-base" cx="${px}" cy="${py}" r="4.5" fill="#8a8a8a" stroke="#3a3a3a" stroke-width="1.5"/>
</svg>`;
}

function lifterMarkup(voice) {
    const info = LIFTER_VOICES[voice] || LIFTER_VOICES[0];
    return `<div class="lifter-graphic">${lifterSVG()}</div>` +
        `<div class="lifter-label">${info.abbr}</div>`;
}

function updatePaletteLifters() {
    const palette = document.getElementById('lifter-palette');
    if (!palette) return;
    palette.innerHTML = '';
    for (let i = 0; i < LIFTER_VOICE_COUNT; i++) {
        const info = LIFTER_VOICES[i];
        const opt = document.createElement('div');
        opt.className = 'lifter-option';
        opt.dataset.type = 'lifter';
        opt.dataset.voice = String(i);
        opt.dataset.abbr = info.abbr;
        opt.title = `${info.abbr} (${info.name})`;
        opt.innerHTML = lifterMarkup(i);
        palette.appendChild(opt);
    }
}
updatePaletteLifters();

function lifterPivotDist(gear) {
    // Tip rests a few px inside the tip circle so each tooth pushes the arm.
    return gear.radius + ADDENDUM + LIFTER_ARM - 3;
}

// Rest pose is tip-up. Facing a gear at world bearing φ needs rotate(φ - 90°),
// since local -y must align with the inward radial (-cos φ, -sin φ).
function lifterRotationDeg(bearingRad, faceGear) {
    return faceGear ? bearingRad * 180 / Math.PI - 90 : 0;
}

function setLifterWorldPose(lifter, x, y, bearingRad, faceGear = false) {
    lifter.bearing = bearingRad;
    lifter.el.style.left = `${x - LIFTER_PIVOT_X}px`;
    lifter.el.style.top = `${y - LIFTER_PIVOT_Y}px`;
    const graphic = lifter.el.querySelector('.lifter-graphic');
    if (graphic) {
        graphic.style.transform = `rotate(${lifterRotationDeg(bearingRad, faceGear)}deg)`;
    }
}

function getLifterPivot(lifter) {
    return {
        x: parseFloat(lifter.el.style.left) + LIFTER_PIVOT_X,
        y: parseFloat(lifter.el.style.top) + LIFTER_PIVOT_Y
    };
}

function getLifterSnapTarget(x, y) {
    let best = null;
    let minErr = Infinity;
    for (const gear of placedGears) {
        const dx = x - gear.x;
        const dy = y - gear.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) continue;
        const pivotDist = lifterPivotDist(gear);
        const err = Math.abs(dist - pivotDist);
        if (err < LIFTER_SNAP_PX && err < minErr) {
            const bearing = Math.atan2(dy, dx);
            minErr = err;
            best = {
                gear,
                bearing,
                pivotDist,
                pos: {
                    x: gear.x + Math.cos(bearing) * pivotDist,
                    y: gear.y + Math.sin(bearing) * pivotDist
                }
            };
        }
    }
    return best;
}

function createPlacedLifter(voice, x, y, snap = null) {
    const info = LIFTER_VOICES[voice] || LIFTER_VOICES[0];
    const el = document.createElement('div');
    el.className = 'placed-lifter';
    el.dataset.type = 'lifter';
    el.dataset.voice = String(voice);
    el.dataset.abbr = info.abbr;
    el.dataset.id = String(lifterIdCounter);
    el.title = `${info.abbr} (${info.name})`;
    el.style.width = `${LIFTER_SVG_W}px`;
    el.style.height = `${LIFTER_SVG_H}px`;
    el.innerHTML = lifterMarkup(voice);
    workArea.appendChild(el);

    const bearing = snap ? snap.bearing : 0;
    const px = snap ? snap.pos.x : x;
    const py = snap ? snap.pos.y : y;

    const lifter = {
        el,
        id: lifterIdCounter,
        voice: Number(voice),
        abbr: info.abbr,
        name: info.name,
        gearId: snap ? snap.gear.id : null,
        bearing,
        lift: 0,
        _wasHigh: false,
        _prevPhase: null,
        _triggerUntil: 0
    };
    lifterIdCounter++;
    placedLifters.push(lifter);
    setLifterWorldPose(lifter, px, py, bearing, !!snap);
    return lifter;
}

function moveDraggingLifterWithSnap(pageX, pageY) {
    if (!draggingLifter) return;
    const workRect = workArea.getBoundingClientRect();
    const relX = pageX - workRect.left;
    const relY = pageY - workRect.top;
    const snap = getLifterSnapTarget(relX, relY);
    const onBody = draggingLifter.parentElement === document.body;

    const applyPose = (x, y, bearingRad, faceGear) => {
        if (onBody) {
            draggingLifter.style.left = `${workRect.left + window.scrollX + x - LIFTER_PIVOT_X}px`;
            draggingLifter.style.top = `${workRect.top + window.scrollY + y - LIFTER_PIVOT_Y}px`;
        } else {
            draggingLifter.style.left = `${x - LIFTER_PIVOT_X}px`;
            draggingLifter.style.top = `${y - LIFTER_PIVOT_Y}px`;
        }
        const graphic = draggingLifter.querySelector('.lifter-graphic');
        if (graphic) {
            graphic.style.transform = `rotate(${lifterRotationDeg(bearingRad, faceGear)}deg)`;
        }
    };

    if (snap) {
        applyPose(snap.pos.x, snap.pos.y, snap.bearing, true);
        draggingLifter._snapped = true;
        draggingLifter._snap = snap;
        highlightGear(snap.gear, false);
    } else {
        applyPose(relX, relY, 0, false);
        draggingLifter._snapped = false;
        draggingLifter._snap = null;
        clearHighlight();
    }
}

function syncLifterAttachments() {
    for (const lifter of placedLifters) {
        if (draggingLifter && (draggingLifter === lifter.el || draggingLifter._placedRef === lifter.el)) {
            continue;
        }
        if (lifter.gearId == null) continue;
        const gear = placedGears.find(g => g.id === lifter.gearId);
        if (!gear) {
            lifter.gearId = null;
            continue;
        }
        const pivotDist = lifterPivotDist(gear);
        const x = gear.x + Math.cos(lifter.bearing) * pivotDist;
        const y = gear.y + Math.sin(lifter.bearing) * pivotDist;
        setLifterWorldPose(lifter, x, y, lifter.bearing, true);
    }
}

// Fractional tooth phase at world bearing phi: 0 = tooth centerline aimed at
// phi, 0.5 = gap center. Same convention as computeMeshedAngle.
function toothPhaseAtBearing(gear, bearingDeg) {
    let p = ((bearingDeg - (gear.angle || 0)) * gear.teeth / 360) % 1;
    if (p < 0) p += 1;
    return p;
}

function toothLiftAmount(gear, bearingRad) {
    const phase = toothPhaseAtBearing(gear, bearingRad * 180 / Math.PI);
    const d = Math.min(phase, 1 - phase); // 0 at tooth center
    // Tip is narrower than the pitch half-tooth (0.25); ~0.16 matches the
    // involute tip arc well enough for a clean lift/release.
    const halfTip = 0.16;
    if (d >= halfTip) return 0;
    return Math.cos((d / halfTip) * (Math.PI / 2));
}

function lifterArmSwingDeg(lift, gear) {
    // Local +x aligns with the clockwise tangent at the contact point, so a
    // clockwise gear (direction +1) pushes the tip the opposite way in SVG
    // rotation; counterclockwise pushes the other way.
    const dir = gear && gear.direction ? gear.direction : 1;
    return -lift * LIFTER_MAX_LIFT * dir;
}

function onLifterTrigger(lifter, gear, when) {
    lifter._triggerUntil = performance.now() + 90;
    lifter.el.classList.add('triggered');
    DrumEngine.play(lifter.abbr, when);
    lifter.el.dispatchEvent(new CustomEvent('lifter-trigger', {
        bubbles: true,
        detail: {
            voice: lifter.voice,
            abbr: lifter.abbr,
            name: lifter.name,
            lifterId: lifter.id,
            gearId: gear.id,
            teeth: gear.teeth,
            time: when
        }
    }));
}

function updateLifterAnimation(frameDt = 1 / 60) {
    const now = performance.now();
    const ctx = DrumEngine.ctx;
    const audioNow = ctx ? ctx.currentTime : 0;

    for (const lifter of placedLifters) {
        if (draggingLifter && (draggingLifter === lifter.el || draggingLifter._placedRef === lifter.el)) {
            continue;
        }

        let lift = 0;
        let gear = null;
        if (lifter.gearId != null) {
            gear = placedGears.find(g => g.id === lifter.gearId);
            if (gear) {
                lift = toothLiftAmount(gear, lifter.bearing);
            }
        }

        lifter.lift = lift;
        const arm = lifter.el.querySelector('.lifter-arm');
        if (arm) {
            arm.setAttribute(
                'transform',
                `rotate(${lifterArmSwingDeg(lift, gear)} ${LIFTER_PIVOT_X} ${LIFTER_PIVOT_Y})`
            );
        }

        // Schedule audio from tooth-center crossings (phase wrap through 0),
        // not from the visual lift threshold — that keeps hits sample-accurate
        // relative to gear rotation even when rAF stutters.
        if (gear && isPlaying && gear.rpm) {
            const phase = toothPhaseAtBearing(gear, lifter.bearing * 180 / Math.PI);
            const prev = lifter._prevPhase;
            lifter._prevPhase = phase;

            if (prev != null) {
                let fracPast = null; // phase distance past the tooth-center crossing
                if (prev > phase + 0.5) {
                    // Angle increased: phase wrapped 0.9 → 0.1 through 0.
                    fracPast = phase;
                } else if (phase > prev + 0.5) {
                    // Angle decreased: phase wrapped 0.1 → 0.9 through 0.
                    fracPast = 1 - phase;
                }

                if (fracPast != null) {
                    const phasePerSec = Math.abs(gear.rpm) * gear.teeth / 360;
                    const secondsPast = phasePerSec > 1e-6
                        ? Math.min(fracPast / phasePerSec, frameDt)
                        : 0;
                    const when = audioNow - secondsPast;
                    onLifterTrigger(lifter, gear, when);
                }
            }

            lifter._wasHigh = lift > 0.55;
        } else {
            lifter._prevPhase = null;
            if (lift < 0.2) lifter._wasHigh = false;
        }

        if (now >= lifter._triggerUntil) {
            lifter.el.classList.remove('triggered');
        }
    }

    // Live preview while dragging a lifter already snapped to a gear.
    if (draggingLifter && draggingLifter._snapped && draggingLifter._snap) {
        const snap = draggingLifter._snap;
        const lift = toothLiftAmount(snap.gear, snap.bearing);
        const arm = draggingLifter.querySelector('.lifter-arm');
        if (arm) {
            arm.setAttribute(
                'transform',
                `rotate(${lifterArmSwingDeg(lift, snap.gear)} ${LIFTER_PIVOT_X} ${LIFTER_PIVOT_Y})`
            );
        }
    }
}

// Modify createPlacedGear to handle initial meshing
function createPlacedGear(size, x, y) {
    const gear = document.createElement('div');
    gear.className = 'placed-gear';
    gear.dataset.size = size;
    const radius = 15 + size * 10;
    const svgSize = radius * 2 + GEAR_PAD * 2;
    gear.style.width = `${svgSize}px`;
    gear.style.height = `${svgSize}px`;
    gear.style.left = `${x - svgSize/2}px`;
    gear.style.top = `${y - svgSize/2}px`;
    gear.style.position = 'absolute';
    gear.style.zIndex = 2;
    gear.dataset.id = gearIdCounter;
    const teeth = GEAR_TEETH[size];
    gear.innerHTML = gearSVG(radius, teeth, 0, size) + '<div class="gear-rpm-label"></div>';
    workArea.appendChild(gear);
    
    const gearObj = {
        el: gear,
        id: gearIdCounter,
        size: Number(size),
        get x() { 
            return parseFloat(gear.style.left) + svgSize/2;
        },
        get y() { 
            return parseFloat(gear.style.top) + svgSize/2;
        },
        get radius() { return radius; },
        get svgSize() { return svgSize; },
        teeth,
        connections: [],
        rpm: 0,
        direction: 1,
        angle: 0,
        gearRatio: null  // Add gear ratio property
    };
    
    placedGears.push(gearObj);
    gearIdCounter++;
    
    if (motorGearId === null) {
        motorGearId = gearObj.id;
        addMotorLabel(gearObj);
    }
    
    // Update connections and handle meshing
    updateConnections();
    
    // Align teeth to the first meshing (non-stacked) neighbor
    const neighbor = placedGears.find(g =>
        g.id !== gearObj.id &&
        g.connections.includes(gearObj.id) &&
        !areGearsStacked(g, gearObj)
    );
    
    if (neighbor) {
        gearObj.angle = computeMeshedAngle(
            neighbor, neighbor.angle || 0,
            gearObj.teeth, gearObj.x, gearObj.y,
            gearObj.angle || 0
        );
        const svg = gearObj.el.querySelector('svg');
        if (svg) {
            svg.style.transition = 'none';
            svg.style.transform = `rotate(${gearObj.angle}deg)`;
        }
    }
    
    updateRPMs();
    return gear;
}

// Modify areGearsStacked to be more lenient for Gear 1
function areGearsStacked(gear1, gear2) {
    const dx = gear1.x - gear2.x;
    const dy = gear1.y - gear2.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Special case for Gear 1: use a larger threshold when it's involved
    if (gear1.size === 1 || gear2.size === 1) {
        return dist < 15; // Increased threshold for Gear 1
    }
    
    // Regular threshold for other gears
    return dist < 8;
}

// Modify findStackedGears to handle Gear 1 better
function findStackedGears(gear) {
    const stackedGears = [];
    for (const connId of gear.connections) {
        const other = placedGears.find(g => g.id === connId);
        if (other && areGearsStacked(gear, other)) {
            stackedGears.push(other);
        }
    }
    return stackedGears;
}

// Modify getSnappingTarget to handle Gear 1 better
function getSnappingTarget(x, y, radius, excludeEl) {
    let snapTarget = null;
    let snapPos = null;
    let minDist = Infinity;
    let isGearRatio = false;
    
    const draggedSize = Number(excludeEl ? excludeEl.dataset.size : document.querySelector('.dragging')?.dataset.size);
    const draggedRadius = 15 + draggedSize * 10;
    
    for (const gear of placedGears) {
        if (gear.el === excludeEl) continue;
        
        const targetX = gear.x;
        const targetY = gear.y;
        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Special handling for Gear 1
        const isGear1 = gear.size === 1;
        const stackedGears = findStackedGears(gear);
        const isStacked = stackedGears.length > 0;
        
        // Check for stacked placement (gear ratio)
        if ((isGear1 && dist < 15) || (!isGear1 && dist < 12)) {
            // For stacked gears, we want to allow connection to either gear
            if (dist < minDist) {
                minDist = dist;
                snapTarget = gear;
                snapPos = { x: targetX, y: targetY };
                isGearRatio = true;
            }
            continue;
        }
        
        // Check for meshing with this gear. Pitch radii touch exactly at
        // radius1 + radius2, which is the correct center distance for two
        // gears of the same module - no extra spacing fudge, or the teeth
        // would not thread.
        let targetDist = gear.radius + draggedRadius;
        
        // For Gear 1, always use its actual radius
        if (isGear1) {
            targetDist = gear.radius + draggedRadius;
        } else if (isStacked) {
            // For other stacked gears, consider both possibilities
            const otherGear = stackedGears[0];
            const maxRadius = Math.max(gear.radius, otherGear.radius);
            const minRadius = Math.min(gear.radius, otherGear.radius);
            
            // Calculate distances for both possibilities
            const outerDist = Math.abs(dist - (maxRadius + draggedRadius));
            const innerDist = Math.abs(dist - (minRadius + draggedRadius));
            
            // Use whichever distance is closer to the target
            targetDist = outerDist < innerDist ? 
                maxRadius + draggedRadius : 
                minRadius + draggedRadius;
        }
        
        const snapThreshold = isGear1 ? 35 : 30; // More forgiving threshold for Gear 1
        if (Math.abs(dist - targetDist) < snapThreshold && dist !== 0) {
            const angle = Math.atan2(dy, dx);
            const snapX = targetX - Math.cos(angle) * targetDist;
            const snapY = targetY - Math.sin(angle) * targetDist;
            
            if (Math.abs(dist - targetDist) < minDist) {
                minDist = Math.abs(dist - targetDist);
                snapTarget = gear;
                snapPos = { x: snapX, y: snapY };
                isGearRatio = false;
            }
        }
    }
    return snapTarget ? { target: snapTarget, pos: snapPos, isGearRatio } : null;
}

let highlightedGear = null;

// Modify highlightGear to handle gear ratio highlighting
function highlightGear(gear, isGearRatio = false) {
    if (highlightedGear) {
        highlightedGear.el.classList.remove('snap-highlight', 'gear-ratio');
    }
    if (gear) {
        gear.el.classList.add('snap-highlight');
        if (isGearRatio) {
            gear.el.classList.add('gear-ratio');
        }
    }
    highlightedGear = gear;
}

function clearHighlight() {
    if (highlightedGear) {
        highlightedGear.el.classList.remove('snap-highlight', 'gear-ratio');
        highlightedGear = null;
    }
}

// Modify moveDraggingGearWithSnap to handle outer gear meshing feedback
function moveDraggingGearWithSnap(x, y) {
    if (!draggingGear) return;
    
    const size = Number(draggingGear.dataset.size);
    const radius = 15 + size * 10;
    const svgSize = radius * 2 + GEAR_PAD * 2;
    
    // Work area offset
    const workRect = workArea.getBoundingClientRect();
    const relX = x - workRect.left;
    const relY = y - workRect.top;
    
    // Check for snapping
    const snap = getSnappingTarget(relX, relY, radius, draggingGear._placedRef);
    if (snap) {
        // Position the gear so its center is at the snap position
        draggingGear.style.left = `${snap.pos.x - svgSize/2}px`;
        draggingGear.style.top = `${snap.pos.y - svgSize/2}px`;
        
        // Check if we're snapping to an outer gear of a stacked pair
        const isOuterGearSnap = snap.target.el.classList.contains('outer-gear');
        highlightGear(snap.target, snap.isGearRatio || isOuterGearSnap);
        
        draggingGear._snapped = true;
        draggingGear._snapPos = snap.pos;
        draggingGear._snapTarget = snap.target;
        draggingGear._isGearRatio = snap.isGearRatio;
        draggingGear._isOuterGearSnap = isOuterGearSnap;
        
        if (snap.isGearRatio) {
            // For gear ratios (stacked gears), no tooth alignment is needed
            draggingGear._lockedAngle = 0;
            
            // Add outer-gear class if this gear is larger
            const draggedRadius = 15 + size * 10;
            const targetRadius = snap.target.radius;
            if (draggedRadius > targetRadius) {
                draggingGear.classList.add('outer-gear');
            } else {
                draggingGear.classList.remove('outer-gear');
            }
        } else {
            // Regular meshing: rotate the dragged gear so its teeth thread
            // into the target's teeth at the snapped position
            const teeth = GEAR_TEETH[size];
            draggingGear._lockedAngle = computeMeshedAngle(
                snap.target, snap.target.angle || 0,
                teeth, snap.pos.x, snap.pos.y,
                draggingGear._lockedAngle || 0
            );
            draggingGear.classList.remove('outer-gear');
        }
        
        const svg = draggingGear.querySelector('svg');
        if (svg) {
            svg.style.transition = 'none';
            svg.style.transform = `rotate(${draggingGear._lockedAngle}deg)`;
        }
    } else {
        // Position the gear so its center is at the mouse position
        draggingGear.style.left = `${relX - svgSize/2}px`;
        draggingGear.style.top = `${relY - svgSize/2}px`;
        clearHighlight();
        draggingGear._snapped = false;
        draggingGear._snapTarget = null;
        draggingGear._isGearRatio = false;
        draggingGear._lockedAngle = 0;
        draggingGear.classList.remove('outer-gear');
        
        // Reset rotation if not snapped
        const svg = draggingGear.querySelector('svg');
        if (svg) {
            svg.style.transition = 'none';
            svg.style.transform = 'rotate(0deg)';
        }
    }
}

// Block native text selection while a gear/lifter drag is in progress.
document.addEventListener('selectstart', function(e) {
    if (draggingGear || draggingLifter) e.preventDefault();
});

// Drag from palette
gearPalette.addEventListener('mousedown', function(e) {
    const lifterTarget = e.target.closest('.lifter-option');
    if (lifterTarget) {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        isFromPalette = true;
        draggingLifter = lifterTarget.cloneNode(true);
        draggingLifter.dataset.voice = lifterTarget.dataset.voice;
        draggingLifter.dataset.type = 'lifter';
        draggingLifter._placedRef = null;
        draggingLifter.classList.add('dragging');
        draggingLifter.style.position = 'absolute';
        draggingLifter.style.pointerEvents = 'none';
        draggingLifter.style.zIndex = 1000;
        document.body.appendChild(draggingLifter);
        moveDraggingLifterWithSnap(e.pageX, e.pageY);
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
        return;
    }

    const target = e.target.closest('.gear-option');
    if (target) {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        isFromPalette = true;
        draggingGear = target.cloneNode(true);
        // Ensure size is preserved in the dataset
        draggingGear.dataset.size = target.dataset.size;
        draggingGear._placedRef = null;
        draggingGear.classList.add('dragging');
        draggingGear.style.position = 'absolute';
        draggingGear.style.pointerEvents = 'none';
        document.body.appendChild(draggingGear);
        moveDraggingGearWithSnap(e.pageX, e.pageY);
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
    }
});

// Drag placed gears / lifters
workArea.addEventListener('mousedown', function(e) {
    const lifterEl = e.target.closest('.placed-lifter');
    if (lifterEl) {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        isFromPalette = false;
        draggingLifter = lifterEl;
        draggingLifter._placedRef = lifterEl;
        const lifterObj = placedLifters.find(l => l.el === lifterEl);
        const pivot = lifterObj ? getLifterPivot(lifterObj) : null;
        const rect = workArea.getBoundingClientRect();
        if (pivot) {
            offsetX = e.clientX - (rect.left + pivot.x);
            offsetY = e.clientY - (rect.top + pivot.y);
        } else {
            const r = lifterEl.getBoundingClientRect();
            offsetX = e.clientX - (r.left + LIFTER_PIVOT_X);
            offsetY = e.clientY - (r.top + LIFTER_PIVOT_Y);
        }
        draggingLifter.style.zIndex = 10;
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
        return;
    }

    const target = e.target.closest('.placed-gear');
    if (target) {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        isFromPalette = false;
        draggingGear = target;
        draggingGear._placedRef = target;
        const rect = target.getBoundingClientRect();
        const gearObj = placedGears.find(g => g.el === target);
        if (gearObj) {
            offsetX = e.clientX - (rect.left + gearObj.svgSize/2);
            offsetY = e.clientY - (rect.top + gearObj.svgSize/2);
        } else {
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
        }
        draggingGear.style.zIndex = 10;
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
    }
});

// Update drag logic to use snapping
function onDragMove(e) {
    if (draggingLifter) {
        if (isFromPalette) {
            moveDraggingLifterWithSnap(e.pageX, e.pageY);
        } else {
            const workRect = workArea.getBoundingClientRect();
            let x = e.clientX - workRect.left - offsetX;
            let y = e.clientY - workRect.top - offsetY;
            x = Math.max(0, Math.min(x, workArea.offsetWidth));
            y = Math.max(0, Math.min(y, workArea.offsetHeight));
            moveDraggingLifterWithSnap(x + workRect.left, y + workRect.top);
        }
        return;
    }

    if (!draggingGear) return;
    if (isFromPalette) {
        moveDraggingGearWithSnap(e.pageX, e.pageY);
    } else {
        // Move within work area
        const workRect = workArea.getBoundingClientRect();
        let x = e.clientX - workRect.left - offsetX;
        let y = e.clientY - workRect.top - offsetY;
        // Clamp to work area
        x = Math.max(0, Math.min(x, workArea.offsetWidth - draggingGear.offsetWidth));
        y = Math.max(0, Math.min(y, workArea.offsetHeight - draggingGear.offsetHeight));
        // Use snapping
        moveDraggingGearWithSnap(x + workRect.left + offsetX, y + workRect.top + offsetY);
    }
}

// Modify wouldGearsOverlap to handle Gear 1 better
function wouldGearsOverlap(gear1, gear2) {
    const dx = gear1.x - gear2.x;
    const dy = gear1.y - gear2.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Special case for Gear 1: use a larger threshold
    const gear1Obj = placedGears.find(g => g.x === gear1.x && g.y === gear1.y);
    const gear2Obj = placedGears.find(g => g.x === gear2.x && g.y === gear2.y);
    const isGear1Involved = (gear1Obj && gear1Obj.size === 1) || (gear2Obj && gear2Obj.size === 1);
    
    if (isGear1Involved && dist < 15) {
        return false;
    } else if (!isGear1Involved && dist < 12) {
        return false;
    }
    
    // For regular meshing, use the normal overlap check
    let minDist = (gear1.radius + gear2.radius) * 0.85;
    
    // For Gear 1, always use its actual radius
    if (gear1Obj && gear1Obj.size === 1) {
        minDist = (gear1Obj.radius + gear2.radius) * 0.85;
    } else if (gear2Obj && gear2Obj.size === 1) {
        minDist = (gear1.radius + gear2Obj.radius) * 0.85;
    } else if (gear1Obj || gear2Obj) {
        // For other stacked gears, consider both possibilities
        const stackedGears = findStackedGears(gear1Obj || gear2Obj);
        if (stackedGears.length > 0) {
            const otherGear = stackedGears[0];
            const gear = gear1Obj || gear2Obj;
            const maxRadius = Math.max(gear.radius, otherGear.radius);
            const minRadius = Math.min(gear.radius, otherGear.radius);
            
            // Use the appropriate radius based on the current distance
            const outerDist = Math.abs(dist - (maxRadius + (gear1Obj ? gear2.radius : gear1.radius)));
            const innerDist = Math.abs(dist - (minRadius + (gear1Obj ? gear2.radius : gear1.radius)));
            
            minDist = outerDist < innerDist ? 
                (maxRadius + (gear1Obj ? gear2.radius : gear1.radius)) * 0.85 :
                (minRadius + (gear1Obj ? gear2.radius : gear1.radius)) * 0.85;
        }
    }
    
    return dist < minDist;
}

// Modify onDragEnd to properly handle stacking on connected gears
function onDragEnd(e) {
    if (draggingLifter) {
        const workRect = workArea.getBoundingClientRect();
        const inWorkArea =
            e.clientX >= workRect.left &&
            e.clientX <= workRect.right &&
            e.clientY >= workRect.top &&
            e.clientY <= workRect.bottom;

        if (isFromPalette) {
            if (inWorkArea) {
                let x = e.clientX - workRect.left;
                let y = e.clientY - workRect.top;
                let snap = draggingLifter._snapped ? draggingLifter._snap : null;
                if (snap) {
                    x = snap.pos.x;
                    y = snap.pos.y;
                }
                createPlacedLifter(Number(draggingLifter.dataset.voice), x, y, snap);
            }
            draggingLifter.remove();
        } else {
            const lifterObj = placedLifters.find(l => l.el === draggingLifter);
            if (lifterObj) {
                if (draggingLifter._snapped && draggingLifter._snap) {
                    const snap = draggingLifter._snap;
                    lifterObj.gearId = snap.gear.id;
                    lifterObj.bearing = snap.bearing;
                    lifterObj._wasHigh = false;
                    setLifterWorldPose(lifterObj, snap.pos.x, snap.pos.y, snap.bearing, true);
                } else {
                    const pivot = getLifterPivot(lifterObj);
                    lifterObj.gearId = null;
                    lifterObj.bearing = 0;
                    lifterObj._wasHigh = false;
                    setLifterWorldPose(lifterObj, pivot.x, pivot.y, 0, false);
                }
            }
            draggingLifter.style.zIndex = 4;
        }
        clearHighlight();
        draggingLifter = null;
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        return;
    }

    if (!draggingGear) return;
    if (isFromPalette) {
        const workRect = workArea.getBoundingClientRect();
        if (
            e.clientX >= workRect.left &&
            e.clientX <= workRect.right &&
            e.clientY >= workRect.top &&
            e.clientY <= workRect.bottom
        ) {
            const size = Number(draggingGear.dataset.size);
            let x = e.clientX - workRect.left;
            let y = e.clientY - workRect.top;
            if (draggingGear._snapped && draggingGear._snapPos) {
                x = draggingGear._snapPos.x;
                y = draggingGear._snapPos.y;
            }
            
            const tempGear = {
                x: x,
                y: y,
                radius: 15 + size * 10,
                connections: []
            };
            
            // Check for overlaps with existing gears
            let hasOverlap = false;
            for (const existingGear of placedGears) {
                // Skip overlap check if we're snapping to this gear
                if (draggingGear._snapped && draggingGear._snapPos) {
                    // If this is the gear we're snapping to, skip overlap check
                    if (Math.abs(existingGear.x - draggingGear._snapPos.x) < 1 && 
                        Math.abs(existingGear.y - draggingGear._snapPos.y) < 1) {
                        continue;
                    }
                    
                    // If we're trying to stack (gear ratio), skip all overlap checks
                    if (draggingGear._isGearRatio) {
                        continue;
                    }
                    
                    // For regular meshing, only check against gears that aren't our target
                    const dx = existingGear.x - x;
                    const dy = existingGear.y - y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const targetDist = existingGear.radius + tempGear.radius;
                    
                    // Skip overlap check if this gear is at the correct meshing distance
                    if (Math.abs(dist - targetDist) < 25) { // Using same snap threshold
                        continue;
                    }
                }
                
                if (wouldGearsOverlap(tempGear, existingGear)) {
                    hasOverlap = true;
                    break;
                }
            }
            
            if (!hasOverlap) {
                const newGear = createPlacedGear(size, x, y);
                const gearObj = placedGears.find(g => g.el === newGear);
                if (gearObj) {
                    if (draggingGear._snapped) {
                        if (draggingGear._isGearRatio) {
                            gearObj.angle = 0;
                            // Add outer-gear class if this gear is larger
                            const draggedRadius = 15 + size * 10;
                            const targetGear = placedGears.find(g => 
                                Math.abs(g.x - draggingGear._snapPos.x) < 1 && 
                                Math.abs(g.y - draggingGear._snapPos.y) < 1
                            );
                            if (targetGear && draggedRadius > targetGear.radius) {
                                gearObj.el.classList.add('outer-gear');
                            }
                        } else {
                            gearObj.angle = draggingGear._lockedAngle;
                        }
                        const svg = gearObj.el.querySelector('svg');
                        if (svg) {
                            svg.style.transition = 'none';
                            svg.style.transform = `rotate(${gearObj.angle}deg)`;
                        }
                    }
                }
            }
        }
        draggingGear.remove();
    } else {
        const gearObj = placedGears.find(g => g.el === draggingGear);
        if (gearObj) {
            if (draggingGear._snapped && draggingGear._snapPos) {
                const svgSize = gearObj.svgSize;
                draggingGear.style.left = `${draggingGear._snapPos.x - svgSize/2}px`;
                draggingGear.style.top = `${draggingGear._snapPos.y - svgSize/2}px`;
                
                if (draggingGear._isGearRatio) {
                    // For gear ratio, update the outer-gear class
                    const draggedRadius = gearObj.radius;
                    const targetGear = placedGears.find(g => 
                        g.x === draggingGear._snapPos.x && 
                        g.y === draggingGear._snapPos.y && 
                        g.id !== gearObj.id
                    );
                    if (targetGear && draggedRadius > targetGear.radius) {
                        gearObj.el.classList.add('outer-gear');
                    } else {
                        gearObj.el.classList.remove('outer-gear');
                    }
                } else if (draggingGear._lockedAngle !== undefined) {
                    // For regular meshing
                    gearObj.angle = draggingGear._lockedAngle;
                }
                
                const svg = gearObj.el.querySelector('svg');
                if (svg) {
                    svg.style.transition = 'none';
                    svg.style.transform = `rotate(${gearObj.angle}deg)`;
                }
            } else {
                // Check for overlaps in the new position
                const newX = parseFloat(draggingGear.style.left) + gearObj.svgSize/2;
                const newY = parseFloat(draggingGear.style.top) + gearObj.svgSize/2;
                
                let hasOverlap = false;
                for (const otherGear of placedGears) {
                    if (otherGear === gearObj) continue;
                    
                    if (wouldGearsOverlap(
                        { x: newX, y: newY, radius: gearObj.radius },
                        otherGear
                    )) {
                        hasOverlap = true;
                        break;
                    }
                }
                
                if (hasOverlap) {
                    // Reset to original position
                    draggingGear.style.left = `${gearObj.x - gearObj.svgSize/2}px`;
                    draggingGear.style.top = `${gearObj.y - gearObj.svgSize/2}px`;
                } else {
                    gearObj.rpm = null;
                    gearObj.direction = null;
                    gearObj.angle = 0;
                    gearObj.el.classList.remove('outer-gear');
                    const svg = gearObj.el.querySelector('svg');
                    if (svg) {
                        svg.style.transition = 'none';
                        svg.style.transform = 'rotate(0deg)';
                    }
                }
            }
        }
        draggingGear.style.zIndex = 2;
    }
    clearHighlight();
    draggingGear = null;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    setTimeout(afterDragUpdate, 0);
}

// Style for placed gears
const style = document.createElement('style');
style.textContent = `
.placed-gear {
    position: absolute;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    touch-action: none;
    -webkit-touch-callout: none;
    -webkit-user-drag: none;
    -khtml-user-drag: none;
    -moz-user-drag: none;
    -o-user-drag: none;
    transition: box-shadow 0.1s;
}
.placed-gear:active {
    cursor: grabbing;
    box-shadow: 0 2px 12px rgba(0,0,0,0.12);
}
.dragging {
    opacity: 0.7;
    pointer-events: none;
    z-index: 1000;
}
.snap-highlight {
    position: relative;
}
.snap-highlight::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: calc(100% + 8px);
    height: calc(100% + 8px);
    outline: 2px solid #6fa8dc66;
    pointer-events: none;
    z-index: -1;
}
/* Prevent text selection on the entire work area */
#work-area {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
}

.placed-gear.meshing {
    animation: meshing-pulse 0.5s ease-out;
}

@keyframes meshing-pulse {
    0% { filter: brightness(1); }
    50% { filter: brightness(1.2); }
    100% { filter: brightness(1); }
}
`;
document.head.appendChild(style);

// True if `candidate` has a stacked partner whose pitch radius matches the
// center distance to `gear` better than candidate's own radius does.
function stackedPartnerMeshesBetter(gear, candidate) {
    const dist = Math.sqrt((gear.x - candidate.x) ** 2 + (gear.y - candidate.y) ** 2);
    const err = Math.abs(dist - (gear.radius + candidate.radius));
    for (const other of placedGears) {
        if (other.id === candidate.id || other.id === gear.id) continue;
        if (!areGearsStacked(candidate, other)) continue;
        const odist = Math.sqrt((gear.x - other.x) ** 2 + (gear.y - other.y) ** 2);
        if (Math.abs(odist - (gear.radius + other.radius)) < err) return true;
    }
    return false;
}

// Modify updateConnections to handle gear ratios
function updateConnections() {
    // Clear all connections
    for (const gear of placedGears) {
        gear.connections = [];
        gear.gearRatio = null; // Add gear ratio property
    }
    
    // For each pair, check if they are connected
    for (let i = 0; i < placedGears.length; i++) {
        for (let j = i + 1; j < placedGears.length; j++) {
            const g1 = placedGears[i];
            const g2 = placedGears[j];
            
            // Check if gears are stacked (gear ratio)
            if (areGearsStacked(g1, g2)) {
                g1.connections.push(g2.id);
                g2.connections.push(g1.id);
                // Calculate and store gear ratio
                const ratio = g1.teeth / g2.teeth;
                g1.gearRatio = ratio;
                g2.gearRatio = 1/ratio;
                continue;
            }
            
            // Regular meshing logic
            const dx = g1.x - g2.x;
            const dy = g1.y - g2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const targetDist = g1.radius + g2.radius;
            const snapThreshold = 18; // px
            if (Math.abs(dist - targetDist) < snapThreshold && dist !== 0) {
                // If either gear has a stacked partner whose radius matches this
                // center distance better, the mesh belongs to that partner (e.g.
                // a gear touching the outer gear of a stacked pair should not
                // also count as meshing with the inner one).
                if (stackedPartnerMeshesBetter(g1, g2) || stackedPartnerMeshesBetter(g2, g1)) {
                    continue;
                }
                g1.connections.push(g2.id);
                g2.connections.push(g1.id);
            }
        }
    }
}

// Modify updateRPMs to ensure stacked gears ALWAYS share exactly the same RPM
function updateRPMs() {
    // Set all to unknown
    for (const gear of placedGears) {
        gear.rpm = null;
        gear.direction = null;
    }
    
    // Find motor
    const motor = placedGears.find(g => g.id === motorGearId);
    if (!motor) return;
    const motorRpm = Number(document.getElementById('tempo-slider').value);
    
    // If paused, set all RPMs to 0
    if (!isPlaying) {
        for (const gear of placedGears) {
            gear.rpm = 0;
            gear.direction = null;
        }
    } else {
        // First, find all gear chains (connected groups of gears)
        const visited = new Set();
        const gearChains = [];
        
        for (const gear of placedGears) {
            if (visited.has(gear.id)) continue;
            
            const chain = [];
            const queue = [gear];
            visited.add(gear.id);
            
            while (queue.length > 0) {
                const currentGear = queue.shift();
                chain.push(currentGear);
                
                // Add connected gears to the queue
                for (const connId of currentGear.connections) {
                    const connectedGear = placedGears.find(g => g.id === connId);
                    if (connectedGear && !visited.has(connectedGear.id)) {
                        queue.push(connectedGear);
                        visited.add(connectedGear.id);
                    }
                }
            }
            
            if (chain.length > 0) {
                gearChains.push(chain);
            }
        }
        
        // Process each chain
        for (const chain of gearChains) {
            // Find the motor gear in this chain (if any)
            const motorGear = chain.find(g => g.id === motorGearId);
            
            if (motorGear) {
                // First, identify all stacked gear groups in this chain
                const stackedGroups = new Map(); // Maps gear ID to its stacked group
                for (const gear of chain) {
                    if (stackedGroups.has(gear.id)) continue;
                    
                    const stackedGears = findStackedGears(gear);
                    if (stackedGears.length > 0) {
                        // Create a group for these stacked gears
                        const group = [gear, ...stackedGears];
                        for (const g of group) {
                            stackedGroups.set(g.id, group);
                        }
                    }
                }
                
                // Set motor RPM and direction
                motorGear.rpm = motorRpm;
                motorGear.direction = 1;
                
                // If motor is part of a stacked group, set all stacked gears to same RPM
                const motorStackedGroup = stackedGroups.get(motorGear.id);
                if (motorStackedGroup) {
                    for (const stackedGear of motorStackedGroup) {
                        if (stackedGear !== motorGear) {
                            stackedGear.rpm = motorRpm;
                            stackedGear.direction = 1;
                        }
                    }
                }
                
                // BFS to propagate RPMs through the chain
                const queue = [{ gear: motorGear, rpm: motorRpm, direction: 1 }];
                const processed = new Set([motorGear.id]);
                
                // Add all stacked gears of motor to processed set
                if (motorStackedGroup) {
                    for (const stackedGear of motorStackedGroup) {
                        processed.add(stackedGear.id);
                        queue.push({ gear: stackedGear, rpm: motorRpm, direction: 1 });
                    }
                }
                
                while (queue.length) {
                    const { gear, rpm, direction } = queue.shift();
                    
                    // Process all connections for this gear
                    for (const connId of gear.connections) {
                        const other = placedGears.find(g => g.id === connId);
                        if (!other || processed.has(other.id)) continue;
                        
                        processed.add(other.id);
                        
                        // Check if this is a stacked connection
                        if (areGearsStacked(gear, other)) {
                            // Stacked gears MUST have exactly the same RPM and direction
                            other.rpm = rpm;
                            other.direction = direction;
                            
                            // Add to queue to process its connections
                            queue.push({ gear: other, rpm, direction });
                            
                            // Also update any other stacked gears in the same group
                            const stackedGroup = stackedGroups.get(other.id);
                            if (stackedGroup) {
                                for (const stackedGear of stackedGroup) {
                                    if (!processed.has(stackedGear.id)) {
                                        stackedGear.rpm = rpm;  // Same exact RPM
                                        stackedGear.direction = direction;  // Same direction
                                        processed.add(stackedGear.id);
                                        queue.push({ gear: stackedGear, rpm, direction });
                                    }
                                }
                            }
                        } else {
                            // Regular meshing: opposite direction, speed based on radius ratio
                            const radiusRatio = gear.radius / other.radius;
                            other.rpm = rpm * radiusRatio;
                            other.direction = -direction;
                            
                            queue.push({ gear: other, rpm: other.rpm, direction: other.direction });
                        }
                    }
                }
            } else {
                // If no motor in this chain, all gears should be stationary
                for (const gear of chain) {
                    gear.rpm = 0;
                    gear.direction = null;
                }
            }
        }
    }
    
    // Update UI
    for (const gear of placedGears) {
        const label = gear.el.querySelector('.gear-rpm-label');
        if (gear.rpm !== null) {
            label.textContent = `${(gear.rpm / 6).toFixed(1)} rpm`;
            // Add gear-under-motor class if this gear is stacked with the motor
            if (gear.id === motorGearId || (gear.connections.includes(motorGearId) && areGearsStacked(gear, placedGears.find(g => g.id === motorGearId)))) {
                gear.el.classList.add('gear-under-motor');
            } else {
                gear.el.classList.remove('gear-under-motor');
            }
        } else {
            label.textContent = '';
            gear.el.classList.remove('gear-under-motor');
        }
        
        // Update outer-gear class based on connections
        const hasSmallerStackedGear = gear.connections.some(connId => {
            const other = placedGears.find(g => g.id === connId);
            return other && areGearsStacked(gear, other) && gear.radius > other.radius;
        });
        
        if (hasSmallerStackedGear) {
            gear.el.classList.add('outer-gear');
        } else {
            gear.el.classList.remove('outer-gear');
        }
    }
    
    // Add motor label to the motor gear
    addMotorLabel(motor);
}

// Redraw connections and RPMs after drag
function afterDragUpdate() {
    updateConnections();
    updateRPMs();
}

// Listen for tempo slider
const tempoSlider = document.getElementById('tempo-slider');
tempoSlider.addEventListener('input', updateRPMs);

function addMotorLabel(gearObj) {
    // Remove all other motor labels
    for (const g of placedGears) {
        const oldLabel = g.el.querySelector('.motor-label');
        if (oldLabel) oldLabel.remove();
    }
    // Add label to this gear (positioning comes from CSS so it stacks
    // cleanly above the RPM readout on small gears)
    const label = document.createElement('div');
    label.className = 'motor-label';
    label.textContent = 'motor';
    gearObj.el.appendChild(label);
}

requestAnimationFrame(animateGears);

