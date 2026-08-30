const INSTRUMENTS = ["BD", "SD", "CH", "OH", "CP"];
const STEPS = 16;
const ROWS = [
    { color: "red", instrument: "BD" },
    { color: "green", instrument: "CH" },
    { color: "blue", instrument: "SD" },
];
const SOUND_FILES = {
    BD: "sounds/bassdrum-BT3A0D3.WAV",
    SD: "sounds/snare-ST0TASA.WAV",
    CH: "sounds/closedhihat-HHCD6.WAV",
    OH: "sounds/openhihat-HHOD2.WAV",
    CP: "sounds/clap-HANDCLP2.WAV",
};
const GAIN_DB = {
    BD: 4,
    CP: 4,
};
const EXP_K = 2;

const sequencer = document.getElementById("sequencer");
const playButton = document.getElementById("play");
const bpmInput = document.getElementById("bpm");

const rows = ROWS.map((spec) => createRow(spec));
const buffers = {};

let audioCtx = null;
let loadSoundsPromise = null;
let playing = false;
let playGen = 0;
let origin = 0;
let raf = 0;
let scheduleTimer = 0;
let scheduledUntil = 0;

function createRow(spec) {
    const row = document.createElement("div");
    row.className = "row";
    row.dataset.color = spec.color;

    const select = document.createElement("select");
    select.className = "row-select";
    select.setAttribute("aria-label", spec.color + " instrument");
    for (const name of INSTRUMENTS) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        if (name === spec.instrument) option.selected = true;
        select.appendChild(option);
    }

    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "row-slider";
    slider.min = "-8";
    slider.max = "8";
    slider.step = "0.01";
    slider.value = "0";
    slider.setAttribute("aria-label", spec.color + " offset");

    const curve = document.createElement("select");
    curve.className = "row-curve";
    curve.setAttribute("aria-label", spec.color + " curve");
    for (const name of ["LIN", "EXP"]) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        curve.appendChild(option);
    }

    const strip = document.createElement("div");
    strip.className = "steps";

    const steps = [];
    const pattern = Array(STEPS).fill(false);

    for (let i = 0; i < STEPS; i++) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "step";
        button.setAttribute("aria-label", "step " + (i + 1));
        button.addEventListener("click", () => {
            pattern[i] = !pattern[i];
            button.classList.toggle("on", pattern[i]);
        });
        strip.appendChild(button);
        steps.push(button);
    }

    const record = { select, slider, curve, steps, pattern, last: -1 };
    slider.addEventListener("input", () => applyDisp(record));
    curve.addEventListener("change", () => applyDisp(record));

    row.append(select, slider, strip, curve);
    sequencer.appendChild(row);
    applyDisp(record);

    return record;
}

function expCurve(i) {
    return (Math.exp(EXP_K * i / (STEPS - 1)) - 1) / (Math.exp(EXP_K) - 1);
}

function displacement(i, offset, mode) {
    if (mode !== "EXP") return offset;
    const t = offset >= 0 ? i : STEPS - 1 - i;
    return offset * expCurve(t);
}

function wrapSteps(value) {
    return ((value % STEPS) + STEPS) % STEPS;
}

function cycleInfo(offset, mode) {
    if (mode !== "EXP") {
        return {
            period: STEPS,
            pos(i) {
                return wrapSteps(i + offset);
            },
        };
    }

    const times = [];
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < STEPS; i++) {
        const t = i + displacement(i, offset, mode);
        times.push(t);
        if (t < min) min = t;
        if (t > max) max = t;
    }

    return {
        period: Math.max(STEPS, max - min + 1 / STEPS),
        pos(i) {
            return times[i] - min;
        },
    };
}

function applyDisp(row) {
    const offset = Number(row.slider.value);
    const mode = row.curve.value;
    row.steps.forEach((step, i) => {
        step.style.setProperty("--disp", String(displacement(i, offset, mode)));
    });
}

function sixteenth() {
    const bpm = Number(bpmInput.value) || 120;
    return (60 / bpm) / 4;
}

function timeInSteps() {
    if (!audioCtx) return 0;
    return (audioCtx.currentTime - origin) / sixteenth();
}

function activeStep(row) {
    const info = cycleInfo(Number(row.slider.value), row.curve.value);
    const rel = timeInSteps() % info.period;
    let current = -1;
    let best = Infinity;
    for (let i = 0; i < STEPS; i++) {
        const past = rel - info.pos(i);
        if (past >= 0 && past < best) {
            best = past;
            current = i;
        }
    }
    return current;
}

function bump(step) {
    step.classList.remove("bump");
    void step.offsetWidth;
    step.classList.add("bump");
}

function paint() {
    for (const row of rows) {
        const current = playing ? activeStep(row) : -1;
        if (current !== row.last && current !== -1 && row.pattern[current]) {
            bump(row.steps[current]);
        }
        row.last = current;
        row.steps.forEach((step, i) => {
            step.classList.toggle("now", i === current);
        });
    }
}

function tick() {
    paint();
    raf = requestAnimationFrame(tick);
}

async function loadSounds() {
    await Promise.all(Object.entries(SOUND_FILES).map(async ([name, url]) => {
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        buffers[name] = await audioCtx.decodeAudioData(data);
    }));
}

async function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
        loadSoundsPromise = loadSounds();
    }
    await loadSoundsPromise;
    if (audioCtx.state === "suspended") await audioCtx.resume();
}

function trigger(name, time) {
    const buffer = buffers[name];
    if (!buffer) return;
    if (time < audioCtx.currentTime - 0.02) return;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    if (GAIN_DB[name]) {
        const gain = audioCtx.createGain();
        gain.gain.value = 10 ** (GAIN_DB[name] / 20);
        source.connect(gain);
        gain.connect(audioCtx.destination);
    } else {
        source.connect(audioCtx.destination);
    }
    source.start(Math.max(time, audioCtx.currentTime));
}

function scheduleAhead() {
    if (!playing || !audioCtx) return;
    const stepDur = sixteenth();
    const horizon = audioCtx.currentTime + 0.12;
    const start = Math.max(scheduledUntil, origin);

    for (const row of rows) {
        const offset = Number(row.slider.value);
        const mode = row.curve.value;
        const name = row.select.value;
        const info = cycleInfo(offset, mode);
        const loopDur = info.period * stepDur;

        for (let i = 0; i < STEPS; i++) {
            if (!row.pattern[i]) continue;
            const hitInLoop = info.pos(i) * stepDur;

            let n = Math.ceil((start - origin - hitInLoop) / loopDur - 1e-9);
            if (n < 0) n = 0;
            let time = origin + n * loopDur + hitInLoop;
            while (time < horizon) {
                if (time >= start - 1e-6) trigger(name, time);
                time += loopDur;
            }
        }
    }

    scheduledUntil = horizon;
}

function stopTransport() {
    playGen += 1;
    playing = false;
    playButton.textContent = "play";
    clearInterval(scheduleTimer);
    scheduleTimer = 0;
    cancelAnimationFrame(raf);
    raf = 0;
    for (const row of rows) row.last = -1;
    paint();
}

async function startTransport() {
    const gen = ++playGen;
    playButton.textContent = "stop";
    await ensureAudio();
    if (gen !== playGen) return;

    playing = true;
    origin = audioCtx.currentTime + 0.02;
    scheduledUntil = audioCtx.currentTime;
    scheduleAhead();
    clearInterval(scheduleTimer);
    scheduleTimer = setInterval(scheduleAhead, 25);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
}

function togglePlay() {
    if (playing || playButton.textContent === "stop") stopTransport();
    else startTransport();
}

playButton.addEventListener("click", togglePlay);

document.addEventListener("keydown", (event) => {
    if (event.code !== "Space") return;
    const tag = event.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "BUTTON") return;
    event.preventDefault();
    togglePlay();
});
