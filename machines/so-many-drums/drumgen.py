import numpy as np
import os
import wave
import shutil

SR = 44100
MAX_DUR = 0.75
NUM_ENGINES = 16
SAMPLES_PER_ENGINE = 64
OUTPUT_DIR = "drum_sounds"
FAVOR_BASS_TREBLE = True

def biased_freq(p, low=30, high=5000, curve=2.5):
    if not FAVOR_BASS_TREBLE:
        return low + p * (high - low)
    midpoint = 0.5
    if p < midpoint:
        scaled = (p / midpoint) ** curve * midpoint
    else:
        scaled = 1 - ((1 - p) / midpoint) ** curve * midpoint
    return low + scaled * (high - low)

def write_wav(filename, waveform, sr=SR):
    waveform = np.clip(waveform, -1.0, 1.0)
    audio_int16 = np.int16(waveform * 32767)
    with wave.open(filename, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(audio_int16.tobytes())



# 1. Noise Burst (Filtered Noise)
def engine_noise_burst(p1, p2, p3, p4):
    # p1: brightness (0=very lowpassed, 1=no filtering)
    # p2: decay speed (0=slow decay, 1=fast decay)
    # p3: saturation amount (0=clean, 1=heavy distortion)
    # p4: length factor (0=0.001s, 1=0.25s)
    dur = 0.001 + p4 * (0.25 - 0.001)
    N = int(SR * dur)
    if N < 1: 
        N = 1
    noise = np.random.uniform(-1.0, 1.0, N)
    # One-pole low-pass filter for brightness control
    if p1 < 1.0:
        c = 0.99 * (1.0 - p1)   # smoothing factor: p1=0 -> c=0.99 (heavy LPF), p1=1 -> c=0 (no filtering)
        out = np.empty(N)
        prev = 0.0
        for i in range(N):
            prev = c * prev + (1 - c) * noise[i]
            out[i] = prev
    else:
        out = noise
    # Exponential decay amplitude envelope
    t = np.linspace(0, 1, N, endpoint=False)
    decay_rate = 1.0 + 10.0 * p2   # p2=0 -> slow decay, p2=1 -> fast decay
    env = np.exp(-decay_rate * t)
    out *= env
    # Saturation (tanh distortion) for harsher sound if p3 > 0
    if p3 > 0:
        gain = 1.0 + p3 * 10.0    # increase gain -> more distortion
        out = np.tanh(gain * out) / np.tanh(gain)
    return np.clip(out, -1.0, 1.0)

# 2. Sine Drop (Decaying sine wave kick)
def engine_sine_drop(p1, p2, p3, p4):
    # p1: initial frequency
    # p2: pitch drop amount (0=no drop, 1=maximum drop)
    # p3: amplitude decay (0=long, 1=short)
    # p4: length factor
    dur = 0.001 + p4 * (0.25 - 0.001)
    N = int(SR * dur)
    if N < 1:
        N = 1
    t = np.linspace(0, 1, N, endpoint=False)
    f0 = 30.0 + p1 * (1000.0 - 30.0)        # initial freq from 30 Hz up to ~1 kHz
    # Determine frequency curve: exponential decay from f0 to f0*0.1 (if p2=1) or no drop (if p2=0)
    end_ratio = 0.1 + 0.9 * (1 - p2)        # p2=1 -> end_ratio=0.1, p2=0 -> 1.0
    if abs(end_ratio - 1.0) < 1e-6:
        freq = np.full(N, f0)
    else:
        # exponential frequency decay over time
        freq = f0 * (end_ratio ** t)
    phase = 2 * np.pi * np.cumsum(freq) / SR   # integrate freq to get phase
    y = np.sin(phase)
    # Amplitude envelope (exponential)
    amp_decay = 5.0 + 15.0 * p3             # p3=0 -> slower decay, p3=1 -> very fast
    env = np.exp(-amp_decay * t)
    y *= env
    return np.clip(y, -1.0, 1.0)

# 3. Tone+Noise Drum (Snare-like synthesis)
def engine_tone_noise(p1, p2, p3, p4):
    # p1: tone frequency
    # p2: tone vs noise mix (0=all noise, 1=all tone)
    # p3: noise brightness (0=dark noise, 1=bright noise)
    # p4: length factor
    dur = 0.001 + p4 * (0.25 - 0.001)
    N = int(SR * dur)
    if N < 1:
        N = 1
    t = np.linspace(0, 1, N, endpoint=False)
    # Tone component (sine wave)
    freq = 50.0 + p1 * (1000.0 - 50.0)          # e.g. 50 Hz to 1000 Hz
    tone = np.sin(2 * np.pi * freq * t)
    # Noise component (filtered noise)
    noise = np.random.uniform(-1.0, 1.0, N)
    if p3 < 1.0:
        c = 0.99 * (1.0 - p3)                   # low-pass filter coefficient for noise
        filtered = np.empty(N)
        prev = 0.0
        for i in range(N):
            prev = c * prev + (1 - c) * noise[i]
            filtered[i] = prev
        noise = filtered
    # Separate decay envelopes for tone and noise
    # e.g., allow tone to ring slightly longer than noise
    tone_decay = 5.0 + 10.0 * (1 - p2)          # if tone is dominant, decay slower
    noise_decay = 5.0 + 10.0 * p2              # if noise is dominant, decay slower (when p2 small)
    tone_env = np.exp(-tone_decay * t)
    noise_env = np.exp(-noise_decay * t)
    tone *= tone_env
    noise *= noise_env
    # Mix tone and noise
    mix = p2
    out = tone * mix + noise * (1 - mix)
    return np.clip(out, -1.0, 1.0)

# 4. Cymbal Synth (inharmonic oscillator cluster)
def engine_cymbal(p1, p2, p3, p4):
    # p1: number of oscillators (density)
    # p2: base frequency
    # p3: inharmonicity (1 = very inharmonic)
    # p4: length factor
    dur = 0.001 + p4 * (0.25 - 0.001)
    N = int(SR * dur)
    if N < 1:
        N = 1
    t = np.linspace(0, dur, N, endpoint=False)
    # Number of partials (2 to 10 oscillators)
    count = int(2 + p1 * 8)
    if count < 2: 
        count = 2
    if count > 10:
        count = 10
    base_freq = 100.0 + p2 * (10000.0 - 100.0)   # base frequency for partials
    exponent = 1.0 + p3 * 1.0                    # partial frequency exponent (1 = harmonic, 2 = quadratic inharmonic)
    y = np.zeros(N)
    # Use random phase for each oscillator for a more complex sum
    phases = 2 * np.pi * np.random.rand(count)
    for i in range(count):
        partial_freq = base_freq * ((i + 1) ** exponent)
        if partial_freq > SR / 2:
            continue  # skip inaudible partials above Nyquist
        phase = phases[i]
        y += np.sin(2 * np.pi * partial_freq * t + phase)
    # Normalize sum by number of oscillators
    if count > 0:
        y /= count
    # Decay envelope: more partials => faster overall decay (to mimic shorter noise-like burst)
    decay_rate = 5.0 + (count - 2) * 1.0  # base 5, up to ~13 for 10 partials
    env = np.exp(-decay_rate * (t / dur))
    y *= env
    return np.clip(y, -1.0, 1.0)

# 5. FM Metallic (carrier-modulator synthesis)
def engine_fm(p1, p2, p3, p4):
    # p1: carrier frequency
    # p2: modulator ratio (relative to carrier)
    # p3: modulation index (depth)
    # p4: length factor
    dur = 0.001 + p4 * (0.25 - 0.001)
    N = int(SR * dur)
    if N < 1:
        N = 1
    t = np.linspace(0, dur, N, endpoint=False)
    fc = 20.0 + p1 * (5000.0 - 20.0)         # carrier freq
    ratio = 0.1 + p2 * 9.9                  # modulator frequency ratio (0.1 to ~10)
    fm = fc * ratio                         # modulator frequency
    I = p3 * 20.0                           # modulation index (0 to 20)
    # Modulation index envelope: decay to zero (makes attack bright, then purer tone)
    mod_env = np.exp(-10.0 * t)
    mod_signal = np.sin(2 * np.pi * fm * t)
    # FM synthesis: carrier with time-varying phase modulation
    y = np.sin(2 * np.pi * fc * t + I * mod_env * mod_signal)
    # Amplitude envelope
    amp_env = np.exp(-8.0 * t)
    y *= amp_env
    return np.clip(y, -1.0, 1.0)

# 6. AM Ring Modulation
def engine_am(p1, p2, p3, p4):
    # p1: frequency 1 (carrier)
    # p2: frequency 2 (modulator)
    # p3: modulation depth (0=ring mod (no carrier), 1=carrier only)
    # p4: length factor
    dur = 0.001 + p4 * (0.25 - 0.001)
    N = int(SR * dur)
    if N < 1:
        N = 1
    t = np.linspace(0, dur, N, endpoint=False)
    f1 = 20.0 + p1 * (5000.0 - 20.0)
    f2 = 20.0 + p2 * (5000.0 - 20.0)
    carrier = np.sin(2 * np.pi * f1 * t)
    # Modulator with DC offset controlled by p3:
    # p3=0 -> pure ring mod (offset 0), p3=1 -> modulator is DC 1 (no modulation)
    mod = (1.0 - p3) * np.sin(2 * np.pi * f2 * t) + p3
    y = carrier * mod
    # Amplitude envelope (decay)
    env = np.exp(-8.0 * t)
    y *= env
    return np.clip(y, -1.0, 1.0)

# 7. Modal Additive (multiple decaying partials)
def engine_additive(p1, p2, p3, p4):
    # p1: base frequency
    # p2: inharmonicity (0 = harmonic, 1 = more inharmonic)
    # p3: brightness (partial amplitude falloff)
    # p4: length factor
    dur = 0.001 + p4 * (0.25 - 0.001)
    N = int(SR * dur)
    if N < 1:
        N = 1
    t = np.linspace(0, 1, N, endpoint=False)
    base_freq = 50.0 + p1 * (2000.0 - 50.0)
    exponent = 1.0 + p2 * 1.0               # power for partial frequencies
    partial_count = 4
    # Compute partial frequencies and amplitude weights
    freqs = []
    amps = []
    for i in range(partial_count):
        freq = base_freq * ((i + 1) ** exponent)
        if freq > SR / 2:
            break
        freqs.append(freq)
        # Brightness control: if p3 is low (dark), higher partials much weaker
        # Simple model: amplitude = exp(-X * (partial_index)), where X depends on p3
        X = (1.0 - p3) * 2.0   # more falloff when p3 is low
        amps.append(np.exp(-X * i))
    # Generate waveform by summing partials with individual decay
    y = np.zeros(N)
    for i, f in enumerate(freqs):
        phase = 2 * np.pi * f * t
        # Each partial decays faster as i increases
        partial_env = np.exp(-(i + 1) * 3.0 * t)
        y += amps[i] * np.sin(phase) * partial_env
    if len(freqs) > 0:
        y /= len(freqs)  # normalize by number of partials
    # Global amplitude envelope to ensure fade-out by end
    global_env = np.exp(-3.0 * t)
    y *= global_env
    return np.clip(y, -1.0, 1.0)

# 8. Resonant Ping (impulse into resonant filter)
def engine_resonant(p1, p2, p3, p4):
    # p1: resonance frequency
    # p2: resonance decay (0=fast decay, 1=slow decay)
    # p3: excitation mix (0=noise impulse, 1=pure impulse)
    # p4: length factor
    dur = 0.001 + p4 * (0.25 - 0.001)
    N = int(SR * dur)
    if N < 1:
        N = 1
    t = np.linspace(0, 1, N, endpoint=False)
    f = 50.0 + p1 * (10000.0 - 50.0)    # resonant frequency
    # Create decaying sinusoid (the resonant mode)
    damping = 2.0 + (1.0 - p2) * 8.0   # p2=1 -> slow decay (2), p2=0 -> fast decay (10)
    tone = np.sin(2 * np.pi * f * t) * np.exp(-damping * t)
    # Create a short noise burst (same length, but decays quickly)
    noise = np.random.uniform(-1.0, 1.0, N) * np.exp(-4.0 * damping * t)
    # Mix tone vs noise in excitation
    mix = p3
    out = tone * mix + noise * (1.0 - mix)
    return np.clip(out, -1.0, 1.0)

# 9. Karplus-Strong Physical Model
def engine_karplus_strong(p1, p2, p3, p4):
    # p1: pitch (frequency)
    # p2: decay factor (damping in feedback)
    # p3: excitation noise level (0 = pure impulse, 1 = full noise burst)
    # p4: length factor
    dur = 0.001 + p4 * (0.25 - 0.001)
    N = int(SR * dur)
    if N < 1:
        N = 1
    freq = 20.0 + p1 * (10000.0 - 20.0)
    if freq < 1.0:
        freq = 1.0
    # Determine delay line length (period in samples)
    delay = int(SR / freq)
    if delay < 2:
        delay = 2
    # Initialize delay buffer
    buffer = np.zeros(delay)
    if p3 <= 0.001:
        # small p3: mostly an impulse excitation
        buffer[0] = 1.0
    else:
        # fill with noise
        buffer[:] = np.random.uniform(-1.0, 1.0, delay) * p3
        if p3 < 1.0:
            # if partial noise, blend with an impulse for the remaining energy
            buffer[0] += (1.0 - p3)
    decay = 0.90 + 0.099 * p2   # feedback decay (0.90 for p2=0 up to ~0.999 for p2=1)
    out = np.empty(N)
    idx = 0
    for i in range(N):
        out[i] = buffer[idx]
        # Average the current sample and the next sample, then apply decay
        next_idx = (idx + 1) % delay
        new_val = decay * 0.5 * (buffer[idx] + buffer[next_idx])
        buffer[idx] = new_val
        idx = next_idx
    # Apply linear fade-out to zero towards the end to avoid abrupt end
    fade = np.linspace(1.0, 0.0, N)
    out *= fade
    return np.clip(out, -1.0, 1.0)

# 10. Grain Cluster (multi-impulse clap)
def engine_grain_cluster(p1, p2, p3, p4):
    # p1: number of pulses (1-5)
    # p2: time spread of pulses (0 = very tight, 1 = spread across length)
    # p3: pulse tone (0=noise pulse, 1=tonal pulse)
    # p4: length factor
    dur = 0.001 + p4 * (0.25 - 0.001)
    N = int(SR * dur)
    if N < 1:
        N = 1
    M = int(1 + p1 * 4)               # number of pulses
    if M < 1:
        M = 1
    if M > 5:
        M = 5
    # fraction of total duration to span the pulses
    min_frac = 0.05
    spread_frac = min_frac + (1.0 - min_frac) * p2
    # time difference between pulses in samples
    d = spread_frac * N / max(1, M - 1) if M > 1 else 0
    # Create one pulse shape (brief envelope)
    pulse_len = 20 + int(p3 * 40)     # make tonal pulse slightly longer
    if pulse_len > N:
        pulse_len = N
    ts = np.linspace(0, 1, pulse_len, endpoint=False)
    pulse_env = np.exp(-5.0 * ts)
    # Pulse content: noise or sine depending on p3
    if p3 < 1.0:
        pulse_wave = np.random.uniform(-1.0, 1.0, pulse_len) * (1.0 - p3)
    else:
        pulse_wave = np.zeros(pulse_len)
    if p3 > 0.0:
        # add sine component if p3 > 0
        freq = 200.0 + p3 * 1000.0  # choose a high-ish frequency for tonal component
        sine_comp = np.sin(2 * np.pi * freq * ts) * p3
        pulse_wave += sine_comp
    pulse_wave *= pulse_env
    # Synthesize multiple pulses
    out = np.zeros(N)
    for j in range(M):
        start = int(j * d)
        if start >= N:
            break
        end = min(N, start + pulse_len)
        out[start:end] += pulse_wave[:end - start]
    out = np.clip(out, -1.0, 1.0)
    return out

# 11. Logistic Chaos oscillator
def engine_logistic(p1, p2, p3, p4):
    # p1: chaos parameter (r in [0.1, 4.0])
    # p2: initial value x0
    # p3: output mode (0 = raw, 1 = high-pass/differentiated)
    # p4: length factor
    dur = 0.001 + p4 * (0.25 - 0.001)
    N = int(SR * dur)
    if N < 1:
        N = 1
    # Map p1 to logistic 'r' parameter (avoid <0.1 to prevent trivial zero output)
    r = 0.1 + 3.9 * p1
    x = 0.0001 + p2 * 0.9998   # initial x (avoid exactly 0 or 1)
    out = np.empty(N)
    last_x = x
    for i in range(N):
        # logistic map iteration
        x = r * x * (1.0 - x)
        # either output centered value or difference
        if p3 < 1.0:
            # mix raw and diff depending on p3
            centered = (x - 0.5) * 2.0                    # center around 0
            diff = (x - last_x) * 2.0                     # scaled difference
            out_val = centered * (1.0 - p3) + diff * p3
        else:
            out_val = (x - last_x) * 2.0                  # pure difference
        out[i] = out_val
        last_x = x
    # Remove any DC offset at end by linear fade of final value to zero
    end_val = out[-1]
    if abs(end_val) > 1e-6:
        out -= end_val * np.linspace(1.0, 0.0, N)
    return np.clip(out, -1.0, 1.0)

# 12. Bytebeat bitwise synthesis
def engine_bytebeat(p1, p2, p3, p4):
    # p1, p2, p3: control integers A, B, C in formula
    # p4: length factor
    dur = 0.001 + p4 * (0.25 - 0.001)
    N = int(SR * dur)
    if N < 1:
        N = 1
    A = int(1 + p1 * 15)    # 1 to 16
    B = int(p2 * 15)        # 0 to 15
    C = int(p3 * 15)        # 0 to 15
    out = np.empty(N)
    for t in range(N):
        # Bytebeat formula: ((t*A) & (t >> B)) | (t >> C)
        val = ((t * A) & (t >> B)) | (t >> C)
        byte = val & 0xFF             # take 8-bit value
        out[t] = (byte - 128) / 128.0 # normalize to -1..1
    # Apply a slight decay to avoid abrupt stop (fade to 50% amplitude)
    out *= np.linspace(1.0, 0.5, N)
    return np.clip(out, -1.0, 1.0)

# 13. LFSR digital noise
def engine_lfsr(p1, p2, p3, p4):
    # p1: noise bandwidth (inverse of hold length)
    # p2: initial seed 1
    # p3: blend second noise source
    # p4: length factor
    dur = 0.001 + p4 * (0.25 - 0.001)
    N = int(SR * dur)
    if N < 1:
        N = 1
    # 16-bit LFSR (maximal) using taps 16,14,13,11 (mask 0xB400 for Galois feedback)
    state1 = int(p2 * 65534) + 1
    state2 = int(p3 * 65534) + 1
    if state1 == 0:
        state1 = 1
    if state2 == 0:
        state2 = 1
    hold = int((1.0 - p1) * 15) + 1   # hold each bit for this many samples (1 to 16)
    out = np.empty(N)
    bit1 = 0
    bit2 = 0
    for i in range(N):
        if i % hold == 0:
            # advance LFSR1 one step
            lsb1 = state1 & 1
            state1 >>= 1
            if lsb1:
                state1 ^= 0xB400
            bit1 = lsb1
            # advance LFSR2 one step
            lsb2 = state2 & 1
            state2 >>= 1
            if lsb2:
                state2 ^= 0xB400
            bit2 = lsb2
        # Linear blend of two noise bits (if p3=0, only bit1; if p3=1, only bit2)
        val = bit1 * (1.0 - p3) + bit2 * p3
        out[i] = 2.0 * val - 1.0    # convert 0/1 to -1/+1
    # Slight overall fade (to avoid click if sequence doesn't end at zero)
    out *= np.linspace(1.0, 0.8, N)
    return np.clip(out, -1.0, 1.0)

# 14. Wavefolding distortion
def engine_wavefold(p1, p2, p3, p4):
    # p1: base frequency
    # p2: fold intensity (gain)
    # p3: waveform offset (asymmetry)
    # p4: length factor
    dur = 0.001 + p4 * (0.25 - 0.001)
    N = int(SR * dur)
    if N < 1:
        N = 1
    t = np.linspace(0, dur, N, endpoint=False)
    freq = 20.0 + p1 * (1000.0 - 20.0)
    wave = np.sin(2 * np.pi * freq * t)
    # Apply DC offset (bias) to wave
    offset = (p3 - 0.5) * 1.0    # range -0.5 to +0.5
    wave = wave + offset
    # Apply gain for folding
    gain = 1.0 + p2 * 9.0
    wave *= gain
    # Wavefolding: reflect waveform within [-1,1] bounds
    out = wave.copy()
    # Iteratively fold any parts outside [-1,1]
    for _ in range(10):  # up to 10 folds (more than enough for our range)
        too_high = out > 1.0
        too_low = out < -1.0
        if not (too_high.any() or too_low.any()):
            break
        out = np.where(too_high, 2.0 - out, out)
        out = np.where(too_low, -2.0 - out, out)
    # Apply an amplitude decay envelope
    env = np.exp(-5.0 * (t / dur))
    out *= env
    return np.clip(out, -1.0, 1.0)

# 15. Feedback FM (self-modulating oscillator)
def engine_feedback_fm(p1, p2, p3, p4):
    # p1: base frequency
    # p2: feedback amount
    # p3: feedback decay (0 = none, 1 = feedback reduces over time)
    # p4: length factor
    dur = 0.001 + p4 * (0.25 - 0.001)
    N = int(SR * dur)
    if N < 1:
        N = 1
    f = 20.0 + p1 * (1000.0 - 20.0)
    feedback = p2 * 5.0             # feedback coefficient (higher => more chaos)
    # Feedback envelope: if p3=1, feedback starts high and decays; if 0, constant feedback
    fb_env = np.exp(-5.0 * p3 * np.linspace(0, 1, N, endpoint=False))
    out = np.empty(N)
    phase = 0.0
    for i in range(N):
        out[i] = np.sin(phase)
        # feedback: add fraction of output to phase increment
        phase += 2 * np.pi * f / SR + feedback * fb_env[i] * out[i]
        # keep phase in a reasonable range to avoid precision issues
        if phase > 2 * np.pi:
            phase -= 2 * np.pi * np.floor(phase / (2 * np.pi))
    # Amplitude envelope
    amp_env = np.exp(-3.0 * np.linspace(0, 1, N, endpoint=False))
    out *= amp_env
    return np.clip(out, -1.0, 1.0)

# 16. Wavetable Morph (random waveform oscillator)
def engine_wavetable(p1, p2, p3, p4):
    # p1: waveform seed
    # p2: frequency (pitch)
    # p3: waveform smoothing (0 = very smooth, 1 = raw)
    # p4: length factor
    dur = 0.001 + p4 * (0.25 - 0.001)
    N = int(SR * dur)
    if N < 1:
        N = 1
    # Generate a random wavetable using seed p1
    table_size = 64
    seed = int(p1 * 1000)  # use p1 to pick a seed
    rng = np.random.RandomState(seed)
    wavetable = rng.uniform(-1.0, 1.0, table_size)
    # Smooth the wavetable according to p3 (low-pass filtering the shape)
    iterations = int((1.0 - p3) * 10)  # more smoothing when p3 is low
    for _ in range(iterations):
        wavetable = 0.5 * (wavetable + np.roll(wavetable, 1))
    # Set playback frequency
    freq = 50.0 + p2 * (2000.0 - 50.0)
    phase_inc = freq * table_size / SR
    phase = 0.0
    out = np.empty(N)
    for i in range(N):
        # Table lookup with linear interpolation
        idx = int(phase) % table_size
        frac = phase - np.floor(phase)
        nxt = (idx + 1) % table_size
        sample = wavetable[idx] * (1 - frac) + wavetable[nxt] * frac
        out[i] = sample
        phase += phase_inc
    # Amplitude decay envelope
    env = np.exp(-3.0 * np.linspace(0, 1, N, endpoint=False))
    out *= env
    return np.clip(out, -1.0, 1.0)

# List of engines with names for reference
engines = [
    ("noise", engine_noise_burst),
    ("sine_drop", engine_sine_drop),
    ("tone_noise", engine_tone_noise),
    ("cymbal", engine_cymbal),
    ("fm", engine_fm),
    ("am", engine_am),
    ("additive", engine_additive),
    ("resonant", engine_resonant),
    ("karplus", engine_karplus_strong),
    ("grain", engine_grain_cluster),
    ("logistic", engine_logistic),
    ("bytebeat", engine_bytebeat),
    ("lfsr", engine_lfsr),
    ("wavefold", engine_wavefold),
    ("feedback_fm", engine_feedback_fm),
    ("wavetable", engine_wavetable)
]

# Generate all sounds
if os.path.exists(OUTPUT_DIR):
    shutil.rmtree(OUTPUT_DIR)
os.makedirs(OUTPUT_DIR, exist_ok=True)

for eng_name, eng_func in engines:
    folder = os.path.join(OUTPUT_DIR, eng_name)
    os.makedirs(folder, exist_ok=True)
    for i in range(SAMPLES_PER_ENGINE):
        p = np.random.rand(4)
        y = eng_func(p[0], p[1], p[2], p[3])
        fname = f"drum_{i+1:03d}_{eng_name}.wav"
        write_wav(os.path.join(folder, fname), y)

print("✅ 1024 drum sounds generated across 16 engines.")
