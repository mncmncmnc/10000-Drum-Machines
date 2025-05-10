import os
import wave
import struct
import math
import random

SAMPLE_RATE = 44100
DURATION = 0.25  # seconds
AMPLITUDE = 32767

# Ensure output folder exists
os.makedirs("newdrums", exist_ok=True)

# Filename mapping from your drum machine
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

def synth_bass_drum():
    data = []
    for n in range(int(SAMPLE_RATE * DURATION)):
        t = n / SAMPLE_RATE
        freq = 100 * (1 - t)  # pitch drop
        value = math.sin(2 * math.pi * freq * t) * math.exp(-10 * t)
        packed = struct.pack('<h', int(value * AMPLITUDE))
        data.append(packed)
    return data

def synth_snare():
    data = []
    for n in range(int(SAMPLE_RATE * DURATION)):
        t = n / SAMPLE_RATE
        noise = random.uniform(-1, 1) * (1 - t)
        tone = math.sin(2 * math.pi * 180 * t) * math.exp(-12 * t)
        sample = (0.4 * tone + 0.6 * noise) * math.exp(-6 * t)
        data.append(struct.pack('<h', int(sample * AMPLITUDE)))
    return data

def synth_hi_hat(open=False):
    data = []
    decay = 2 if open else 25
    for n in range(int(SAMPLE_RATE * DURATION)):
        t = n / SAMPLE_RATE
        noise = random.choice([-1, 1])  # bitcrushed white noise
        sample = noise * math.exp(-decay * t)
        data.append(struct.pack('<h', int(sample * AMPLITUDE * 0.3)))
    return data

def synth_clap():
    data = []
    for n in range(int(SAMPLE_RATE * DURATION)):
        t = n / SAMPLE_RATE
        value = sum(random.uniform(-1, 1) for _ in range(3)) / 3
        burst = 1 if 0.02 < t < 0.05 or 0.07 < t < 0.10 else 0
        value *= burst * math.exp(-20 * t)
        data.append(struct.pack('<h', int(value * AMPLITUDE * 0.8)))
    return data

def synth_tom(freq):
    data = []
    for n in range(int(SAMPLE_RATE * DURATION)):
        t = n / SAMPLE_RATE
        value = math.sin(2 * math.pi * freq * t) * math.exp(-8 * t)
        data.append(struct.pack('<h', int(value * AMPLITUDE)))
    return data

def synth_rim():
    data = []
    for n in range(int(SAMPLE_RATE * DURATION)):
        t = n / SAMPLE_RATE
        if t < 0.01:
            value = math.sin(2 * math.pi * 1000 * t)
        else:
            value = 0
        data.append(struct.pack('<h', int(value * AMPLITUDE)))
    return data

def synth_ride_crash(freq=4000):
    data = []
    for n in range(int(SAMPLE_RATE * DURATION * 2)):
        t = n / SAMPLE_RATE
        noise = random.uniform(-1, 1)
        mod = math.sin(2 * math.pi * freq * t)
        value = noise * mod * math.exp(-2 * t)
        data.append(struct.pack('<h', int(value * AMPLITUDE * 0.4)))
    return data

# Mapping drum types to synthesis functions
generators = {
    'BD': synth_bass_drum,
    'SD': synth_snare,
    'CH': lambda: synth_hi_hat(open=False),
    'OH': lambda: synth_hi_hat(open=True),
    'CP': synth_clap,
    'LT': lambda: synth_tom(100),
    'MT': lambda: synth_tom(160),
    'HT': lambda: synth_tom(220),
    'RS': synth_rim,
    'RD': lambda: synth_ride_crash(3000),
    'CR': lambda: synth_ride_crash(1500),
}

# Generate and save each drum
for key, filename in drum_filenames.items():
    data = generators[key]()
    write_wave(os.path.join("newdrums", filename), data)
    print(f"✔ Saved {filename}")
