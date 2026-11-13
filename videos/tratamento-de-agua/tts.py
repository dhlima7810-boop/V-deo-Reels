import json, re, numpy as np, soundfile as sf, os
from kokoro_onnx import Kokoro
k = Kokoro(os.path.expanduser('~/kokoro/kokoro-v1.0.int8.onnx'), os.path.expanduser('~/kokoro/voices-v1.0.bin'))
lines = json.load(open('roteiro.json'))
import sys
SPEED = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
TARGET = 58.0  # body length; + 2 s zuum. closing = 60 s exactly
sr = 24000; GAP = 0.4; LEAD = 0.15
out = [np.zeros(int(LEAD*sr), dtype=np.float32)]; t = LEAD; res = []
def syl(w):
    return max(1, len(re.findall(r'[aeiouáéíóúâêôãõà]+', w.lower())))
for ln in lines:
    a, _ = k.create(ln['text'], voice='pm_alex', speed=SPEED, lang='pt-br')
    a = a.astype(np.float32)
    # trim silence
    thr = 0.01; idx = np.where(np.abs(a) > thr)[0]
    a = a[max(0, idx[0]-240): idx[-1]+480]
    dur = len(a)/sr
    words = ln['text'].split()
    # weights: syllables + pause after punctuation
    w = [syl(x) + (1.2 if re.search(r'[.,:]$', x) else 0) for x in words]
    tot = sum(w); cur = t; wl = []
    for word, ww in zip(words, w):
        d = dur*ww/tot
        wl.append({'w': re.sub(r'[.,:]', '', word), 'start': round(cur,3), 'end': round(cur+d,3),
                   'hl': re.sub(r'[.,:]','',word).lower() in [h.lower() for h in ln['hl']]})
        cur += d
    res.append({'id': ln['id'], 'text': ln['text'], 'start': round(t,3), 'end': round(t+dur,3), 'words': wl})
    out.append(a); t += dur
    out.append(np.zeros(int(GAP*sr), dtype=np.float32)); t += GAP
pad = TARGET - t
assert pad >= 0.3, f'narration too long: {t:.2f}s'
out.append(np.zeros(int(round(pad*sr)), dtype=np.float32)); t = TARGET
sf.write('assets/narracao.wav', np.concatenate(out), sr)
json.dump({'duration': round(t,3), 'lines': res}, open('narracao.json','w'), ensure_ascii=False, indent=1)
for r in res: print(r['id'], r['start'], r['end'])
print('total', t)
