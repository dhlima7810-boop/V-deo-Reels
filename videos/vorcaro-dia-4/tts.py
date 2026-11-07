# Narração pm_alex (Kokoro offline) -> assets/narracao.wav + narracao.json (tempos por frase e por palavra)
import json, re, os, sys, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
SPEED = float(sys.argv[1]) if len(sys.argv) > 1 else 0.95
k = Kokoro(os.path.expanduser('~/kokoro/kokoro-v1.0.int8.onnx'), os.path.expanduser('~/kokoro/voices-v1.0.bin'))
lines = json.load(open('roteiro.json'))
sr = 24000; GAP = 0.38; LEAD = 0.12
out = [np.zeros(int(LEAD*sr), dtype=np.float32)]; t = LEAD; res = []
syl = lambda w: 2 * len(re.findall(r'\d', w)) + (2 if '%' in w else 0) if re.search(r'\d', w) else max(1, len(re.findall(r'[aeiouáéíóúâêôãõà]+', w.lower())))
strip = lambda w: re.sub(r'[.,:!?;"]', '', w)
for ln in lines:
    if ln.get('pre'):
        out.append(np.zeros(int(ln['pre']*sr), dtype=np.float32)); t += ln['pre']
    a, _ = k.create(ln.get('say', ln['text']), voice='pm_alex', speed=SPEED, lang='pt-br')
    a = a.astype(np.float32); idx = np.where(np.abs(a) > 0.01)[0]
    a = a[max(0, idx[0]-240): idx[-1]+480]; dur = len(a)/sr
    words = ln['text'].split()
    w = [syl(x) + (1.2 if re.search(r'[.,:!?]$', x) else 0) for x in words]
    tot = sum(w); cur = t; wl = []
    hl = [h.lower() for h in ln.get('hl', [])]
    for word, ww in zip(words, w):
        d = dur*ww/tot
        wl.append({'w': word, 'start': round(cur, 3), 'end': round(cur+d, 3), 'hl': strip(word).lower() in hl})
        cur += d
    res.append({'id': ln['id'], 'text': ln['text'], 'start': round(t, 3), 'end': round(t+dur, 3), 'words': wl})
    out.append(a); t += dur
    out.append(np.zeros(int(GAP*sr), dtype=np.float32)); t += GAP
out.append(np.zeros(int(0.9*sr), dtype=np.float32)); t += 0.9
sf.write('assets/narracao.wav', np.concatenate(out), sr)
json.dump({'duration': round(t, 3), 'lines': res}, open('narracao.json', 'w'), ensure_ascii=False, indent=1)
for r in res: print(r['id'], r['start'], r['end'])
print('total', round(t, 2))
