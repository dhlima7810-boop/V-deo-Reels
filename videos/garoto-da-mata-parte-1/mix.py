# Som do Garoto da Mata: narração pm_alex + trilha de caixinha de música (padrão terror) + efeitos sintetizados.
# Tempos das cenas e das batidas vêm de out/scenes.json (exportado do scene.js). Saídas:
#   out/mix.wav          (com música)   out/mix_sem_musica.wav (pra usar o som do app na hora de postar)
import json, subprocess, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
SR = 48000; R = np.random.default_rng(1414)
N = json.load(open('narracao.json')); M = json.load(open('out/scenes.json'))
SC = {s['n']: s for s in M['scenes']}; KN = M['knocks']; DUR = N['duration']
L = {l['id']: l for l in N['lines']}
def bp(x, lo=None, hi=None, o=4):
    sos = butter(o, [lo, hi], 'band', fs=SR, output='sos') if lo and hi else butter(o, lo or hi, 'high' if lo else 'low', fs=SR, output='sos'); return sosfilt(sos, x)
def verb(x, sec=.9, wet=.3, seed=1, hi=5000):
    r = np.random.default_rng(seed); n = int(sec * SR); ir = bp(r.standard_normal(n) * np.exp(-np.arange(n) / SR * 6.9 / sec), hi=hi)
    w = fftconvolve(x, ir); w /= np.abs(w).max() + 1e-9; out = np.zeros(len(w)); out[:len(x)] += x * (1 - wet); return out + w * wet * np.abs(x).max()
def lay(buf, x, t, gain=1., pan=0.):
    i = int(t * SR); n = min(len(x), len(buf) - i)
    if n > 0: buf[i:i + n, 0] += x[:n] * gain * np.sqrt(1 - pan); buf[i:i + n, 1] += x[:n] * gain * np.sqrt(1 + pan)
def fade(x, a=.3, b=.3):
    x = x.copy(); na, nb = max(1, int(a * SR)), max(1, int(b * SR)); x[:na] *= np.linspace(0, 1, na); x[-nb:] *= np.linspace(1, 0, nb); return x
dB = lambda d: 10 ** (d / 20)
n_all = int(DUR * SR)
voz = np.zeros((n_all + SR, 2)); fx = np.zeros((n_all + SR, 2))

# ---- narração
for l in N['lines']:
    a, _ = sf.read(f"assets/falas/{l['id']}.wav")
    if l['voice'] == 'whisper': a = verb(bp(a, 250, 3800), 1.6, .5, 3, 3500); lay(voz, a, l['start'], dB(-2), -.2)
    else: lay(voz, verb(a, .4, .08, 2), l['start'])

# ---- efeitos por cena
def noise_bed(t0, t1, lo, hi, lvl, mod=.15, seed=0):
    n = int((t1 - t0) * SR); x = bp(R.standard_normal(n), lo, hi); x /= np.abs(x).max(); tt = np.arange(n) / SR
    x *= (1 - mod) + mod * np.sin(2 * np.pi * tt * .23 + seed); lay(fx, fade(x, .5, .5), t0, dB(lvl))
def crickets(t0, t1, lvl=-34, stop=None):
    n = int((t1 - t0) * SR); tt = np.arange(n) / SR; x = np.sin(2 * np.pi * 4300 * tt) * (np.sin(2 * np.pi * 28 * tt) > .2) * (np.sin(2 * np.pi * 1.6 * tt) > -.3)
    x += .6 * np.sin(2 * np.pi * 5100 * tt + 1) * (np.sin(2 * np.pi * 31 * tt + 2) > .3) * (np.sin(2 * np.pi * 1.1 * tt + 1) > 0)
    if stop: x[int((stop - t0) * SR):] = 0
    lay(fx, fade(x, .4, .05), t0, dB(lvl), .3)
def bark(t, g=-26):
    m = int(.22 * SR); tt = np.arange(m) / SR; f = 440 * (1.15 - .4 * tt / .22); ph = 2 * np.pi * np.cumsum(f) / SR
    x = sum((1 / k) * np.sin(k * ph) for k in range(1, 12)); x = bp(x, 350, 1500) * np.sin(np.pi * np.minimum(tt / .22, 1)) ** .6; lay(fx, verb(x, 1.8, .6, 11, 2000), t, dB(g), -.5)
def boom(t, g=-6, f0=48):
    m = int(2.5 * SR); tt = np.arange(m) / SR; x = np.sin(2 * np.pi * f0 * tt * (1 - .15 * tt / 2.5)) * np.exp(-tt * 1.6) + .3 * bp(R.standard_normal(m), 40, 200) * np.exp(-tt * 4)
    lay(fx, verb(x, 1.5, .35, 5, 1200), t, dB(g))
def riser(t0, dur, g=-20):
    m = int(dur * SR); tt = np.arange(m) / SR; x = bp(R.standard_normal(m), 300, 4000) * (tt / dur) ** 2; lay(fx, x, t0, dB(g))
def knock(t, g=-5):
    m = int(.5 * SR); tt = np.arange(m) / SR; x = np.sin(2 * np.pi * 95 * tt) * np.exp(-tt * 28) + .6 * np.sin(2 * np.pi * 210 * tt) * np.exp(-tt * 45) + .35 * bp(R.standard_normal(m), 600, 4000) * np.exp(-tt * 120)
    lay(fx, verb(x, .9, .35, 15), t, dB(g))
def tick(t, g=-24):
    m = int(.02 * SR); x = bp(R.standard_normal(m), 2500, 8000) * np.exp(-np.arange(m) / SR * 300); lay(fx, x, t, dB(g), .2)

# 1: vento + grilos + impacto grave no "não piscava"
noise_bed(0, SC[2]['t1'], 150, 900, -32); crickets(0, SC[1]['t1'], -38)
boom(L['s1b']['end'] - .45, -9)
# 2: entardecer, latido distante
for k, t in enumerate([SC[2]['t0'] + 1.2, SC[2]['t0'] + 1.6, SC[2]['t0'] + 3.4]): bark(t, -28 - 2 * k)
# 3: busca: hélice do drone, rádio chiando
m = int((SC[3]['t1'] - SC[3]['t0']) * SR); tt = np.arange(m) / SR
drone = bp(np.sign(np.sin(2 * np.pi * 180 * tt)) * (1 + .3 * np.sin(2 * np.pi * 9 * tt)), 150, 3000); lay(fx, fade(drone, .6, .4), SC[3]['t0'], dB(-36), .4)
rad = bp(R.standard_normal(int(.9 * SR)), 900, 3200) * (np.sin(2 * np.pi * 7 * np.arange(int(.9 * SR)) / SR) > 0); lay(fx, fade(rad, .02, .1), SC[3]['t0'] + .6, dB(-32), -.4)
noise_bed(SC[3]['t0'], SC[4]['t1'], 120, 700, -34)
# 4: lâmpada zumbindo e falhando
m = int((SC[4]['t1'] - SC[4]['t0']) * SR); tt = np.arange(m) / SR; hum = .6 * np.sin(2 * np.pi * 120 * tt) + .3 * np.sin(2 * np.pi * 240 * tt)
k = np.floor((SC[4]['t0'] + tt) * 7).astype(int); gate = np.array([((x * 2654435761) % 1000) / 1000 for x in k]) > .12; lay(fx, fade(hum * gate, .3, .3), SC[4]['t0'], dB(-36))
riser(SC[5]['t0'] - 1.6, 1.6, -24)
# 5: corte seco: impacto + silêncio
boom(SC[5]['t0'], -4, 42)
# 6: sussurro já tem eco; grave contínuo
m = int((SC[6]['t1'] - SC[6]['t0']) * SR); tt = np.arange(m) / SR; lay(fx, fade(.5 * np.sin(2 * np.pi * 41 * tt) * (.6 + .4 * np.sin(2 * np.pi * .3 * tt)), .6, .6), SC[6]['t0'], dB(-26))
# 7: papel
for t in [SC[7]['t0'] + .3, SC[7]['t0'] + 1.1]: m = int(.35 * SR); lay(fx, bp(R.standard_normal(m), 1500, 7000) * np.hanning(m), t, dB(-30))
# 8: batidas na porta
for t in KN: knock(t)
noise_bed(SC[8]['t0'], SC[8]['t1'], 100, 500, -36)
# 9: silêncio da mata (grilos param), bússola tiquetaqueando
crickets(SC[9]['t0'], SC[9]['t1'], -36, stop=SC[9]['t0'] + 1.0)
t = SC[9]['t0'] + 1.2
while t < SC[9]['t1']: tick(t); t += .09 + .03 * np.sin(t * 5)
# 10: zumbido grave da cerca + impacto final
m = int((SC[10]['t1'] - SC[10]['t0']) * SR); tt = np.arange(m) / SR
hz = .5 * np.sin(2 * np.pi * 55 * tt) + .35 * np.sin(2 * np.pi * 110.7 * tt) + .15 * bp(R.standard_normal(m), 2000, 6000); lay(fx, fade(hz * (.5 + .5 * tt / tt[-1]), .8, .3), SC[10]['t0'], dB(-24))
boom(L['s10b']['end'] + .15, -8)

# ---- trilha (caixinha de música, padrão terror), abaixa quando tem voz
subprocess.run(['python3', 'music.py', str(DUR), 'out/musica.wav'], check=True, capture_output=True)
mu, _ = sf.read('out/musica.wav'); mu = np.pad(mu, ((0, len(voz) - len(mu)), (0, 0)))[:len(voz)]
env = np.convolve(np.abs(voz).mean(1), np.ones(9600) / 9600, 'same'); duck = 1 - .5 * np.clip(env / .03, 0, 1)
def finish(buf, out):
    buf = buf[:n_all]; buf /= np.abs(buf).max() / .8; sf.write('out/tmp.wav', buf, SR)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', 'out/tmp.wav', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', out], check=True)
voz_n = voz / np.abs(voz).max()
finish(voz_n * .9 + fx / max(np.abs(fx).max(), 1e-9) * .55 + mu * dB(-15) * duck[:, None], 'out/mix.wav')
finish(voz_n * .9 + fx / max(np.abs(fx).max(), 1e-9) * .55, 'out/mix_sem_musica.wav')
print('ok', DUR)
