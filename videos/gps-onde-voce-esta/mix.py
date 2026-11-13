# Music bed + SFX (motion-studio's procedural audio) + pm_alex narration, ducked.
import json, sys
S = '/root/.claude/skills/synced/d6609b77-e2a1-4b3e-806d-535b14b5cb42_1bdba0e6-bdf2-44b2-b901-d4d290344d99/motion-studio/scripts'
sys.path.insert(0, S)
import audio
n = json.load(open('narracao.json')); L = {l['id']: l for l in n['lines']}
def W(i, w, k=0):
    ws = [x for x in L[i]['words'] if x['w'].lower().startswith(w)]; return (ws[k] if len(ws) > k else ws[0])['start']
dur = n['duration']
whips = [L[i]['start'] for i in ['s3', 's4', 's5', 's6', 's8', 's9', 's10', 's12', 's13']]
dives = [L[i]['start'] for i in ['s2', 's7', 's11']]
cues = [{'t': x - .1, 'type': 'whoosh', 'gain': .55} for x in whips] + [{'t': x - .15, 'type': 'swoosh', 'gain': .7} for x in dives]
cues += [{'t': W('s1', 'bolinha'), 'type': 'pop', 'gain': .6}, {'t': W('s3', 'gritando'), 'type': 'impact', 'gain': .45}, {'t': W('s4', 'viaja'), 'type': 'swoosh', 'gain': .5},
         {'t': W('s5', 'chave'), 'type': 'chime', 'gain': .5}, {'t': W('s7', 'esfera'), 'type': 'boom', 'gain': .4}, {'t': W('s8', 'círculo'), 'type': 'zap', 'gain': .5},
         {'t': W('s9', 'dois'), 'type': 'pop', 'gain': .6}, {'t': W('s10', 'certinho'), 'type': 'chime', 'gain': .7}, {'t': W('s12', 'escuta'), 'type': 'pop', 'gain': .5},
         {'t': W('s13', 'perder'), 'type': 'chime', 'gain': .6}]
for i, w in [('s2', 'satélites'), ('s3', 'relógio'), ('s4', 'velocidade'), ('s5', 'atraso'), ('s6', 'distância'), ('s7', 'esfera'), ('s8', 'círculo'), ('s9', 'espaço'), ('s12', 'escuta')]:
    cues.append({'t': W(i, w), 'type': 'pop', 'gain': .45})
scenes = [{'start': L[i]['start'] if i != 's1' else 0, 'end': (L[i]['end'] + .4) if i != 's13' else dur, 'energy': e} for i, e in zip(L, [.7, .6, .7, .7, .6, .6, .7, .8, .6, .7, .8, .8, .7])]
meta = {'duration': dur, 'scenes': scenes, 'cues': cues}
resolved = {'audio': {'music': 'whimsical', 'voiceover': 'assets/narracao.wav', 'sfx': True}, 'style': {'sound': {'bpm': 112, 'key': 'C', 'sfx': 'clean', 'music': 'whimsical'}}, 'bpm': 112, 'seed': 37}
audio.build('.', meta, resolved, 'out/mix.wav')
