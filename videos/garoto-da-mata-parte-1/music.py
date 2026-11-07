# Trilha original de terror (padrão do canal): caixinha de música antiga, lenta, levemente desafinada,
# com chiado de vinil e um drone grave. Melodia própria em lá menor, compasso 3/4. Semente fixa.
import numpy as np, soundfile as sf, sys
SR = 48000; R = np.random.default_rng(1926)
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 60.0
OUT = sys.argv[2] if len(sys.argv) > 2 else 'assets/musica-terror.wav'
BPM = 66; beat = 60 / BPM
def hz(n): return 440 * 2 ** ((n - 69) / 12)
# melodia (nota MIDI, batidas). 8 compassos de 3/4, repetidos com variação
A = [(76,1),(72,1),(69,1), (71,2),(68,1), (72,1),(69,1),(64,1), (65,3),
     (64,1),(69,1),(72,1), (76,2),(77,1), (76,1),(75,1),(71,1), (69,3)]
B = [(81,1),(76,1),(72,1), (74,2),(71,1), (72,1),(69,1),(65,1), (64,3),
     (65,1),(68,1),(71,1), (72,2),(71,1), (68,1),(64,1),(68,1), (69,3)]
BASS = [45, 52, 45, 41, 45, 52, 47, 45]   # uma nota grave por compasso
def box(f, dur, amp):
    n = int(dur * SR); t = np.arange(n) / SR
    wow = 1 + 0.004 * np.sin(2 * np.pi * 0.5 * t + R.uniform(0, 6))       # fita/mecanismo cansado
    det = 2 ** (R.normal(0, 0.12) / 12)                                    # desafinado de leve
    x = np.zeros(n)
    for k, (p, a, d) in enumerate([(1, 1, 2.2), (2.76, .35, 5), (5.40, .18, 9), (8.9, .06, 14)]):
        x += a * np.sin(2 * np.pi * f * det * p * np.cumsum(wow) / SR) * np.exp(-t * d)
    x[:96] *= np.linspace(0, 1, 96); return x * amp
out = np.zeros(int(DUR * SR) + SR * 4)
t = 1.2; bar = 0; phrase = 0
while t < DUR - 1:
    mel = A if phrase % 2 == 0 else B
    for i, (n, b) in enumerate(mel):
        if t >= DUR - 1: break
        i0 = int(t * SR); x = box(hz(n), 3.0, .32 * (0.85 + 0.15 * R.random())); out[i0:i0 + len(x)] += x
        if i % 3 == 0 or b == 3:  # baixo no início do compasso
            xb = box(hz(BASS[bar % 8] + 12), 3.5, .18); j = i0 + int(0.01 * SR); out[j:j + len(xb)] += xb; bar += 1
        t += b * beat * (1 + 0.03 * np.sin(t))                             # rubato leve, mecanismo arrastado
    phrase += 1
    t += beat
out = out[:int(DUR * SR)]
# reverb de sala grande (IR de ruído decaindo)
n = int(2.8 * SR); ir = R.standard_normal(n) * np.exp(-np.arange(n) / SR * 2.2)
from scipy.signal import fftconvolve, butter, sosfilt
wet = fftconvolve(out, ir)[:len(out)]; wet /= np.abs(wet).max(); out = 0.7 * out / np.abs(out).max() + 0.45 * wet
# drone grave + chiado de vinil
tt = np.arange(len(out)) / SR
drone = 0.10 * (np.sin(2 * np.pi * 55 * tt) + 0.6 * np.sin(2 * np.pi * 55.4 * tt) + 0.3 * np.sin(2 * np.pi * 82.6 * tt)) * (0.6 + 0.4 * np.sin(2 * np.pi * tt / 9))
hiss = sosfilt(butter(2, [1500, 9000], 'band', fs=SR, output='sos'), R.standard_normal(len(out))) * 0.012
crack = np.zeros(len(out)); idx = R.integers(0, len(out), int(DUR * 6)); crack[idx] = R.uniform(.05, .25, len(idx)) * R.choice([-1, 1], len(idx))
crack = sosfilt(butter(2, 2500, 'high', fs=SR, output='sos'), crack)
mix = out + drone + hiss + crack
lp = sosfilt(butter(2, 5200, 'low', fs=SR, output='sos'), mix)          # som de gravação antiga
lp[:SR] *= np.linspace(0, 1, SR); lp[-2 * SR:] *= np.linspace(1, 0, 2 * SR)
lp /= np.abs(lp).max() / 0.8
st = np.stack([lp, np.roll(lp, 480)], 1)                                  # leve abertura estéreo
sf.write(OUT, st, SR); print('ok', OUT, DUR)
