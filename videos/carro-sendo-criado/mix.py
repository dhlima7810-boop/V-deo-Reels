# SFX only (no music): motion-studio cues + custom layers (weld crackle, spray hiss, oven hum, engine), then pm_alex on top.
import json, sys, numpy as np, soundfile as sf
S = '/root/.claude/skills/synced/d6609b77-e2a1-4b3e-806d-535b14b5cb42_1bdba0e6-bdf2-44b2-b901-d4d290344d99/motion-studio/scripts'
sys.path.insert(0, S)
import audio
from audio import lp, hp, bp
n = json.load(open('narracao.json')); L = {l['id']: l for l in n['lines']}; dur = n['duration']
def W(i, w, k=0):
    ws = [x for x in L[i]['words'] if x['w'].lower().startswith(w)]; return (ws[k] if len(ws) > k else ws[0])['start']
St = lambda i: L[i]['start']; En = lambda i: L[i]['end']
cues = [{'t': St(i) - .1, 'type': 'whoosh', 'gain': .3} for i in L if i not in ('s1', 's8b', 's12')]
for T in [W('s3', 'amassa'), W('s3', 'portas'), W('s3', 'teto'), W('s3', 'capô')]: cues.append({'t': T, 'type': 'impact', 'gain': .7})
for T in [W('s3b', 'batida'), W('s3b', 'toneladas')]: cues += [{'t': T, 'type': 'boom', 'gain': .9}, {'t': T, 'type': 'impact', 'gain': .6}]
A0, A1 = St('s4') - .2, W('s4', 'quatro')
for i in range(9): cues.append({'t': A0 + (A1 - A0) * i / 9 + .42, 'type': 'click', 'gain': .7})
cues += [{'t': St('s6b') - .4, 'type': 'swoosh', 'gain': .6}, {'t': W('s6b', 'forno') + .05, 'type': 'impact', 'gain': .35},
         {'t': St('s7') - .2, 'type': 'riser', 'gain': .35, 'dur': 1.0}, {'t': W('s7', 'motor') + .05, 'type': 'impact', 'gain': .45}, {'t': W('s7', 'câmbio') + .05, 'type': 'click', 'gain': .8},
         {'t': W('s8', 'encaixa') + .05, 'type': 'impact', 'gain': .7}, {'t': W('s8', 'encaixa') + .15, 'type': 'chime', 'gain': .7},
         {'t': W('s9', 'bancos') - .2, 'type': 'swoosh', 'gain': .5}, {'t': W('s9', 'vidros'), 'type': 'ding', 'gain': .5}, {'t': W('s9', 'faróis') + .2, 'type': 'chime', 'gain': .5},
         {'t': W('s10', 'total') - .2, 'type': 'boom', 'gain': .45}, {'t': W('s10', 'trinta'), 'type': 'glitch', 'gain': .3}, {'t': En('s10') + .1, 'type': 'swoosh', 'gain': .6},
         {'t': W('s12', 'desenho'), 'type': 'chime', 'gain': .4}]
for k in range(4): cues.append({'t': W('s9', 'rodas') - .25 + k * .13 + .45, 'type': 'tick', 'gain': .9})
labs = [('s2', 'projeto'), ('s3', 'prensa'), ('s3', 'aço'), ('s4', 'robôs'), ('s4', 'quatro'), ('s5', 'carroceria'), ('s6', 'pintura'), ('s7', 'câmbio'),
        ('s8', 'casamento'), ('s9', 'rodas'), ('s9', 'bancos'), ('s9', 'vidros'), ('s9', 'faróis'), ('s10', 'trinta'), ('s10b', 'termina'), ('s11', 'teste')]
for i, w in labs: cues.append({'t': W(i, w), 'type': 'pop', 'gain': .35})
meta = {'duration': dur, 'scenes': [], 'cues': cues}
resolved = {'audio': {'music': 'none', 'sfx': True}, 'style': {'sound': {'bpm': 110, 'key': 'C', 'sfx': 'clean'}}, 'bpm': 110, 'seed': 17}
audio.build('.', meta, resolved, 'out/sfx.wav')
sfx, SR = sf.read('out/sfx.wav'); sfx = sfx.astype(np.float64)
N = len(sfx); tt = np.arange(N) / SR; rng = np.random.default_rng(5)
def seg(a, b, fade=.08):
    e = np.clip((tt - a) / fade, 0, 1) * np.clip((b - tt) / fade, 0, 1); return e
noise = rng.standard_normal(N)
extra = np.zeros(N)
# weld crackle (s4)
crackle = hp(noise, 3000) * (rng.random(N) < .004).astype(float).cumsum() % 2
extra += hp(noise * (np.abs(np.sin(tt * 37)) > .7), 2500) * seg(A0 + .3, En('s4') + .3) * .05
# spray hiss (s6)
extra += bp(noise, 3000, 9000) * seg(St('s6'), En('s6') + .1, .3) * (.6 + .4 * np.sin(tt * 3)) * .07
# oven hum (s6b)
extra += (np.sin(2 * np.pi * 60 * tt) * .5 + lp(noise, 300) * 2) * seg(W('s6b', 'forno'), En('s6b') + .2, .3) * .06
# engine: starter crank, then idle, then rev when it drives
t0 = W('s11', 'liga'); drive = W('s12', 'anda') - .15
crank = lp(noise, 900) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 11 * tt))) * seg(t0, t0 + .7, .03) * .25
f = np.where(tt < drive, 32 + 6 * np.clip((tt - t0 - .6) / .3, 0, 1) * np.exp(-np.clip(tt - t0 - .8, 0, None) * 2) + 0, 32 + 70 * (1 - np.exp(-np.clip(tt - drive, 0, None) / 1.4)))
ph = 2 * np.pi * np.cumsum(f) / SR
eng = sum(np.sign(np.sin(ph * h)) / h for h in (1, 2, 3)) + .6 * lp(noise, 500)
eng = lp(eng, 650) * seg(t0 + .55, dur, .15) * (1 - np.clip((tt - (dur - 1.8)) / 1.8, 0, 1)) * .35
extra += crank + eng
mix = np.stack([sfx[:, 0] * .55 + extra, sfx[:, 1] * .55 + extra], 1)
vo, vsr = sf.read('assets/narracao.wav'); assert vsr == 24000
import scipy.signal as ss
vo = ss.resample_poly(vo, SR // 1000 if False else SR, 24000) if SR != 24000 else vo
v = np.zeros(N); v[:min(N, len(vo))] = vo[:N]
venv = lp(np.abs(v), 4); venv = np.clip(venv / (venv.max() + 1e-9) * 3, 0, 1)
mix = mix * (1 - .45 * venv)[:, None] + v[:, None] * 1.25
mix /= np.abs(mix).max() / .9
sf.write('out/mix.wav', mix, SR)
print('ok', SR, N / SR)
