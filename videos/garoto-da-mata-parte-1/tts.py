# Narração offline Kokoro pm_alex, grave e lenta. Cada fala vira um wav separado (com o filtro da voz)
# e o tempo de cada uma vai pra narracao.json. A mixagem (mix.py) põe cada fala no seu tempo.
import json, os, subprocess, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro(os.path.expanduser('~/kokoro/kokoro-v1.0.int8.onnx'), os.path.expanduser('~/kokoro/voices-v1.0.bin'))
lines = json.load(open('roteiro.json'))
os.makedirs('assets/falas', exist_ok=True)
PITCH = 'asetrate=24000*0.89,aresample=24000,atempo=1.124'
FX = {None: PITCH,
      'whisper': PITCH + ',highpass=f=180,volume=0.8',
      'corridor': PITCH + ',lowpass=f=2600,highpass=f=200,volume=0.75'}
VOICE = 'pm_alex'
TARGET = 58.0   # história; + 2 s da vinheta = 60 s no total (regra do Dheryck)
SPEED = {None: 0.89, 'whisper': 0.8, 'corridor': 0.78}
LEAD, TAIL = 0.25, 0.9
clips = []
for ln in lines:
    v = ln.get('voice')
    a, sr = k.create(ln['text'], voice=VOICE, speed=SPEED[v], lang='pt-br')
    idx = np.where(np.abs(a) > 0.01)[0]; a = a[max(0, idx[0]-240): idx[-1]+600]
    raw = f"assets/falas/{ln['id']}_raw.wav"; out = f"assets/falas/{ln['id']}.wav"
    sf.write(raw, a, sr)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', raw, '-af', FX[v], '-ar', '48000', out], check=True)
    clips.append((ln, v, sf.info(out).duration))
speech = sum(c[2] for c in clips); gaps = sum(c[0]['gap'] for c in clips[:-1])
k = (TARGET - LEAD - TAIL - speech) / gaps
print('speech', round(speech, 2), 'gap scale', round(k, 3))
assert k > 0.45, 'falas longas demais pra 58 s'
t = LEAD; res = []
for i, (ln, v, dur) in enumerate(clips):
    res.append({'id': ln['id'], 'scene': ln['scene'], 'text': ln['text'], 'voice': v, 'start': round(t, 3), 'end': round(t+dur, 3)})
    t += dur + (ln['gap'] * k if i < len(clips) - 1 else 0)
t += TAIL
json.dump({'duration': round(t, 3), 'lines': res}, open('narracao.json', 'w'), ensure_ascii=False, indent=1)
for r in res: print(r['id'], r['scene'], r['start'], r['end'])
print('total', round(t, 3))
