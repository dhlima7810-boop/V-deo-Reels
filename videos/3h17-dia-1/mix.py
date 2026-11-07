# Som do Dia 1: narração pm_alex + efeitos sintetizados (numpy, semente fixa), sem música.
# Mesmos tempos do scene.js (lidos de narracao.json). Saída: out/mix.wav (48 kHz estéreo, -14 LUFS).
import json, subprocess, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
SR = 48000; R = np.random.default_rng(317)
N = json.load(open('narracao.json')); L = {l['id']: l for l in N['lines']}
S = lambda i: L[i]['start']; E = lambda i: L[i]['end']
DUR = N['duration']
mix = np.zeros((int(DUR * SR) + SR, 2))
def bp(x, lo=None, hi=None, o=4):
    if lo and hi: sos = butter(o, [lo, hi], 'band', fs=SR, output='sos')
    elif lo: sos = butter(o, lo, 'high', fs=SR, output='sos')
    else: sos = butter(o, hi, 'low', fs=SR, output='sos')
    return sosfilt(sos, x)
def ir(sec, damp=3.0, seed=1):
    r = np.random.default_rng(seed); n = int(sec * SR); return r.standard_normal(n) * np.exp(-np.arange(n) / SR * damp / sec * 2.3)
def verb(x, sec=0.9, wet=0.3, seed=1, hi=5000):
    w = fftconvolve(x, bp(ir(sec, seed=seed), hi=hi))[:len(x) + int(sec * SR)]; w /= (np.abs(w).max() + 1e-9)
    out = np.zeros(len(w)); out[:len(x)] += x * (1 - wet); out += w * wet * np.abs(x).max(); return out
def add(x, t, gain=1.0, pan=0.0):
    i = int(t * SR); x = x * gain; n = min(len(x), len(mix) - i)
    if n <= 0: return
    mix[i:i + n, 0] += x[:n] * np.sqrt((1 - pan) / 2) * 1.414; mix[i:i + n, 1] += x[:n] * np.sqrt((1 + pan) / 2) * 1.414
def env(n, a=0.005, d=None):
    e = np.ones(n); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na)
    if d: e *= np.exp(-np.arange(n) / SR / d)
    return e
def fade(x, a=0.5, b=0.5):
    x = x.copy(); na, nb = int(a * SR), int(b * SR); x[:na] *= np.linspace(0, 1, na); x[-nb:] *= np.linspace(1, 0, nb); return x
dB = lambda d: 10 ** (d / 20)

# ---- tempos dos planos (iguais ao scene.js)
tB, tC, tC2, tD, tE, tF, tX = S('l4') - .5, S('l7') - .4, S('l9') - .3, S('l10') - .6, S('l14') - .5, S('l18') - .4, S('l22') - .45
KNOCKS = [E('l20') + .6, E('l20') + .95, E('l20') + 1.3]

# ---- narração (fala normal = Caio contando; whisper = áudio no celular; corridor = voz no corredor)
for l in N['lines']:
    a, sr = sf.read(f"assets/falas/{l['id']}.wav"); assert sr == SR
    if l['voice'] == 'whisper':
        a = bp(a, 280, 3600); a = verb(a, .5, .22, 3); add(a, l['start'], dB(-3), .1)
    elif l['voice'] == 'corridor':
        a = bp(a, 200, 2200); a = verb(a, 1.4, .5, 4, 3000); add(a, l['start'], dB(-4), -.55)
    else:
        a = verb(a, .45, .1, 2); add(a, l['start'], 1.0)

# ---- ambiente de quarto (zumbido baixo) com o silêncio total antes das batidas
def roomtone(t0, t1, lvl=-44):
    n = int((t1 - t0) * SR); b = np.cumsum(R.standard_normal(n)); b = bp(b - np.convolve(b, np.ones(4801) / 4801, 'same'), 40, 400)
    b /= np.abs(b).max(); hum = 0.25 * np.sin(2 * np.pi * 60 * np.arange(n) / SR); add(fade((b + hum) * dB(lvl), .3, .3), t0)
roomtone(0, tC); roomtone(tE, E('l20') + .2, -42); roomtone(KNOCKS[-1] + .3, tX, -44)

# ---- celular vibrando + bip suave
def vibra(t, dur=.38, gain=-14):
    n = int(dur * SR); tt = np.arange(n) / SR; x = np.sign(np.sin(2 * np.pi * 172 * tt)) * 0.5 + 0.5 * np.sin(2 * np.pi * 344 * tt)
    x = bp(x, 80, 1200) * env(n, .01) * np.linspace(1, .7, n); add(fade(x, .01, .05), t, dB(gain))
def bip(t, gain=-24):
    n = int(.5 * SR); tt = np.arange(n) / SR; x = (np.sin(2 * np.pi * 880 * tt) + .5 * np.sin(2 * np.pi * 1320 * tt)) * env(n, .004, .12); add(verb(x, .6, .3, 7), t, dB(gain))
vibra(.12); vibra(.62); bip(.15)
vibra(S('l17') - .25); vibra(S('l17') + .25)
# relógio de parede (tic) na cena E
def tick(t, g=-30):
    n = int(.03 * SR); x = bp(R.standard_normal(n), 2000, 7000) * env(n, .0005, .004); add(x, t, dB(g), .4)
for k in range(int(tE) + 1, int(tF)): tick(k, -30 if k % 2 else -33)

# ---- cozinha: água da torneira, louça, copo escorregando, vidro quebrando
n = int((tC2 - tC) * SR); w = bp(R.standard_normal(n), 900, 6000) * (0.8 + 0.2 * np.sin(np.arange(n) / SR * 7)); add(fade(w, .3, .05), tC, dB(-34))
for k, tt in enumerate([tC + 1.2, tC + 2.9]):
    m = int(.25 * SR); x = sum(np.sin(2 * np.pi * f * np.arange(m) / SR) for f in (2210, 3170, 4400)) * env(m, .001, .05); add(x, tt, dB(-36 - 3 * k), .2)
slip = S('l8') + .55; m = int(.45 * SR); add(bp(R.standard_normal(m), 1500, 5000) * env(m, .02) * np.linspace(.3, 1, m), slip, dB(-38), .3)
def shatter(t):
    m = int(1.6 * SR); tt = np.arange(m) / SR; x = R.standard_normal(m) * np.exp(-tt * 9)
    x = bp(x, 1800, 12000) * 0.8 + bp(R.standard_normal(m), 60, 300) * np.exp(-tt * 30) * 1.5
    for _ in range(40):
        f = R.uniform(2500, 9000); t0 = R.uniform(0, .5); i = int(t0 * SR); k = m - i
        x[i:] += 0.25 * np.sin(2 * np.pi * f * tt[:k]) * np.exp(-tt[:k] * R.uniform(15, 40))
    for _ in range(12):  # cacos quicando
        t0 = R.uniform(.15, 1.1); i = int(t0 * SR); k = int(.02 * SR); x[i:i + k] += bp(R.standard_normal(k), 3000, 9000) * np.exp(-np.arange(k) / SR * 200) * .5
    add(verb(x, .7, .25, 9), t, dB(-6), .15)
shatter(tC2)

# ---- quintal: vento, latido distante que para no meio
n = int((tE - tD) * SR); wnd = bp(R.standard_normal(n), 120, 900) * (0.6 + 0.4 * np.sin(np.arange(n) / SR * .9) ** 2); add(fade(wnd, .5, .5), tD, dB(-34))
def bark(t, f0=430, g=-16, cut=1.0):
    m = int(.22 * SR); tt = np.arange(m) / SR; f = f0 * (1.15 - .4 * tt / .22); ph = 2 * np.pi * np.cumsum(f) / SR
    x = sum((1 / k) * np.sin(k * ph) for k in range(1, 12)); x = bp(x, 350, 1900) * np.sin(np.pi * np.minimum(tt / .22, 1)) ** .6
    x += .3 * bp(R.standard_normal(m), 500, 2500) * np.exp(-tt * 18); x = x[:int(m * cut)]; x = bp(x, hi=1500); add(verb(x, 1.6, .55, 11, 2500), t, dB(g), .45)
stop = S('l12') - .05; tt = tD + .3; k = 0
while tt < stop:
    cut = 1.0 if tt + .22 < stop else max(.2, (stop - tt) / .22)
    bark(tt, 430 + 30 * (k % 3), -17 - 2 * (k % 2), cut); tt += [.38, .45, 1.1, .4, .9][k % 5]; k += 1

# ---- corredor: passos chegando, depois 3 batidas secas
for i, tt in enumerate(np.linspace(S('l19') + 1.0, E('l20') + .2, 5)):
    m = int(.18 * SR); x = bp(R.standard_normal(m), 80, 700) * env(m, .004, .05); add(verb(x, .8, .4, 13), tt, dB(-30 + i * 1.5), -.35)
def knock(t, g=-4):
    m = int(.5 * SR); tt = np.arange(m) / SR; x = np.sin(2 * np.pi * 95 * tt) * np.exp(-tt * 28) + .6 * np.sin(2 * np.pi * 210 * tt) * np.exp(-tt * 45)
    x += .35 * bp(R.standard_normal(m), 600, 4000) * np.exp(-tt * 120); add(verb(x, .9, .35, 15), t, dB(g), -.15)
for k in KNOCKS: knock(k)

mix = mix[:int(DUR * SR)]
mix /= np.abs(mix).max() / .7
sf.write('out/mix_raw.wav', mix, SR)
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', 'out/mix_raw.wav', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', 'out/mix.wav'], check=True)
print('mix ok', round(DUR, 3))
