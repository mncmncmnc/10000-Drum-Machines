import os
import wave
import struct
import math
import random

SAMPLE_RATE = 44100
AMPLITUDE = 32767
LENGTH_MULTIPLIER = 0.25  # Global duration scaler
OUTPUT_FOLDER = "newdrums"

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

drum_filenames = {
    'BD': 'bassdrum-BT3A0D3.WAV',
    'SD': 'snare-ST0TASA.WAV',
    'CH': 'closedhihat-HHCD6.WAV',
    'OH': 'openhihat-HHOD2.WAV',
    'CP': 'clap-HANDCLP2.WAV',
    'LT': 'lowtom-LTAD3.WAV',
    'MT': 'midtom-MTAD3.WAV',
    'HT': 'hitom-HTAD3.WAV',
    'RS': 'rim-RIM63.WAV',
    'RD': 'ride-RIDED4.WAV',
    'CR': 'crash-CSHD4.WAV'
}

def write_wave(filename, data):
    with wave.open(filename, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(b''.join(data))

def safe_pack(sample):
    value = int(max(-1.0, min(1.0, sample)) * AMPLITUDE)
    return struct.pack('<h', value)

# --- Sound generators with durations scaled ---
def gen_bd():
    duration = 0.15 * LENGTH_MULTIPLIER
    data = []
    for n in range(int(SAMPLE_RATE * duration)):
        t = n / SAMPLE_RATE
        freq = 100 * (1 - t)**2
        val = math.sin(2 * math.pi * freq * t) * (1 - t)**4
        val *= 1.5 - abs(val)
        data.append(safe_pack(val))
    return data

def gen_sd():
    duration = 0.12 * LENGTH_MULTIPLIER
    data = []
    for n in range(int(SAMPLE_RATE * duration)):
        t = n / SAMPLE_RATE
        val = (1 if random.random() > 0.5 else -1) if n % 30 < 15 else 0
        val *= math.exp(-10 * t)
        data.append(safe_pack(val * 0.6))
    return data

def gen_ch():
    duration = 0.05 * LENGTH_MULTIPLIER
    data = []
    state = 1
    for n in range(int(SAMPLE_RATE * duration)):
        if n % 5 == 0:
            state *= -1 if random.random() < 0.8 else 1
        data.append(safe_pack(state * 0.4))
    return data

def gen_oh():
    duration = 0.2 * LENGTH_MULTIPLIER
    data = []
    base = random.uniform(2000, 4000)
    mod = random.uniform(30, 70)
    for n in range(int(SAMPLE_RATE * duration)):
        t = n / SAMPLE_RATE
        env = math.exp(-3 * t)
        val = math.sin(2 * math.pi * base * t) * math.sin(2 * math.pi * mod * t)
        data.append(safe_pack(val * env))
    return data

def gen_cp():
    duration = 0.15 * LENGTH_MULTIPLIER
    data = []
    clicks = [0.01, 0.035, 0.06]
    for n in range(int(SAMPLE_RATE * duration)):
        t = n / SAMPLE_RATE
        val = 0
        for offset in clicks:
            env = math.exp(-400 * abs(t - offset))
            val += random.uniform(-1, 1) * env
        data.append(safe_pack(val * 0.5))
    return data

def gen_tom(freq):
    duration = 0.1 * LENGTH_MULTIPLIER
    mod = freq * 2.1
    data = []
    for n in range(int(SAMPLE_RATE * duration)):
        t = n / SAMPLE_RATE
        carrier = math.sin(2 * math.pi * freq * t + 0.5 * math.sin(2 * math.pi * mod * t))
        env = math.exp(-8 * t)
        data.append(safe_pack(carrier * env))
    return data

def gen_rs():
    duration = 0.05 * LENGTH_MULTIPLIER
    data = []
    for n in range(int(SAMPLE_RATE * duration)):
        t = n / SAMPLE_RATE
        p = 2000
        val = math.sin(2 * math.pi * p * t) * math.exp(-60 * t)
        data.append(safe_pack(val))
    return data

def gen_rd():
    duration = 0.3 * LENGTH_MULTIPLIER
    data = []
    base = random.uniform(250, 600)
    for n in range(int(SAMPLE_RATE * duration)):
        t = n / SAMPLE_RATE
        trem = (1 + math.sin(2 * math.pi * 10 * t)) / 2
        val = math.sin(2 * math.pi * base * t + 0.5 * math.sin(2 * math.pi * 800 * t))
        val *= math.exp(-1.5 * t) * trem
        data.append(safe_pack(val * 0.4))
    return data

def gen_cr():
    duration = 0.4 * LENGTH_MULTIPLIER
    data = []
    for n in range(int(SAMPLE_RATE * duration)):
        t = n / SAMPLE_RATE
        byte_beat = ((n * (n >> 5 | n >> 8)) & 255) / 128.0 - 1
        env = math.exp(-1.8 * t)
        data.append(safe_pack(byte_beat * env * 0.5))
    return data

# --- Drum generator map ---
generators = {
    'BD': gen_bd,
    'SD': gen_sd,
    'CH': gen_ch,
    'OH': gen_oh,
    'CP': gen_cp,
    'LT': lambda: gen_tom(110),
    'MT': lambda: gen_tom(160),
    'HT': lambda: gen_tom(220),
    'RS': gen_rs,
    'RD': gen_rd,
    'CR': gen_cr,
}

# --- Generate and save ---
for key, fname in drum_filenames.items():
    print(f"Generating {fname}...")
    samples = generators[key]()
    write_wave(os.path.join(OUTPUT_FOLDER, fname), samples)

print("✅ All glitchy short drums generated.")
