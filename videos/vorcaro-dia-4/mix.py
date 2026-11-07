# Áudio: só voz + efeitos (sem música). Efeitos do kit motion-studio presos às palavras da narração.
import json, sys, numpy as np, soundfile as sf
sys.path.insert(0, '/root/.claude/skills/synced/d6609b77-e2a1-4b3e-806d-535b14b5cb42_1bdba0e6-bdf2-44b2-b901-d4d290344d99/motion-studio/scripts')
import audio
from audio import lp
n = json.load(open('narracao.json')); L = {l['id']: l for l in n['lines']}; dur = n['duration']
def W(i, w, k=0):
    import re; ws = [x for x in L[i]['words'] if re.sub(r'[^\wÀ-ú]', '', x['w'].lower()).startswith(w)]; return (ws[k] if len(ws) > k else ws[0])['start']
St = lambda i: L[i]['start']; En = lambda i: L[i]['end']
from cues import CUES
cues = CUES(W, St, En)
meta = {'duration': dur, 'scenes': [], 'cues': cues}
resolved = {'audio': {'music': 'none', 'sfx': True}, 'style': {'sound': {'bpm': 90, 'key': 'A', 'sfx': 'clean'}}, 'bpm': 90, 'seed': 11}
audio.build('.', meta, resolved, 'out/sfx.wav')
sfx, SR = sf.read('out/sfx.wav'); N = len(sfx)
vo, vsr = sf.read('assets/narracao.wav')
import scipy.signal as ss
if vsr != SR: vo = ss.resample_poly(vo, SR // 1000, vsr // 1000)
v = np.zeros(N); v[:min(N, len(vo))] = vo[:N]
venv = lp(np.abs(v), 4); venv = np.clip(venv / (venv.max() + 1e-9) * 3, 0, 1)
mix = sfx * .5 * (1 - .4 * venv)[:, None] + v[:, None] * 1.25
mix /= np.abs(mix).max() / .9
sf.write('out/mix.wav', mix, SR); print('ok', SR, N / SR)
