# Music bed + SFX (motion-studio's procedural audio) + pm_alex narration, ducked.
import json, sys
S = '/root/.claude/skills/synced/d6609b77-e2a1-4b3e-806d-535b14b5cb42_1bdba0e6-bdf2-44b2-b901-d4d290344d99/motion-studio/scripts'
sys.path.insert(0, S)
import audio
n = json.load(open('narracao.json')); L = {l['id']: l for l in n['lines']}
def W(i, w, k=0):
    ws = [x for x in L[i]['words'] if x['w'].lower().startswith(w)]; return (ws[k] if len(ws) > k else ws[0])['start']
dur = n['duration']
whips = [L[i]['start'] for i in ['s4', 's5', 's6', 's8', 's10', 's11', 's13']]
dives = [L[i]['start'] for i in ['s2', 's3', 's7', 's9', 's12']]
cues = [{'t': x - .1, 'type': 'whoosh', 'gain': .55} for x in whips] + [{'t': x - .15, 'type': 'swoosh', 'gain': .7} for x in dives]
cues += [{'t': W('s1', 'cortou'), 'type': 'swoosh', 'gain': .5}, {'t': W('s1', 'sangue'), 'type': 'pop', 'gain': .5}, {'t': W('s2', 'aperta'), 'type': 'impact', 'gain': .45},
         {'t': W('s4', 'grudentas'), 'type': 'zap', 'gain': .5}, {'t': W('s4', 'tampão'), 'type': 'impact', 'gain': .5}, {'t': W('s5', 'fibrina'), 'type': 'zap', 'gain': .45},
         {'t': W('s6', 'coágulo'), 'type': 'impact', 'gain': .5}, {'t': W('s8', 'engolem') + .3, 'type': 'boom', 'gain': .4}, {'t': W('s12', 'cai') + .1, 'type': 'pop', 'gain': .7},
         {'t': W('s12', 'inteira'), 'type': 'chime', 'gain': .7}, {'t': W('s13', 'sozinho'), 'type': 'chime', 'gain': .6}]
for i, w in [('s2', 'vaso'), ('s3', 'plaquetas'), ('s5', 'fibrina'), ('s7', 'bactérias'), ('s8', 'glóbulos'), ('s9', 'casquinha'), ('s10', 'células'), ('s11', 'colágeno'), ('s12', 'inteira')]:
    cues.append({'t': W(i, w), 'type': 'pop', 'gain': .45})
scenes = [{'start': L[i]['start'] if i != 's1' else 0, 'end': (L[i]['end'] + .4) if i != 's13' else dur, 'energy': e} for i, e in zip(L, [.7, .6, .7, .7, .6, .6, .7, .8, .6, .7, .8, .8, .7])]
meta = {'duration': dur, 'scenes': scenes, 'cues': cues}
resolved = {'audio': {'music': 'whimsical', 'voiceover': 'assets/narracao.wav', 'sfx': True}, 'style': {'sound': {'bpm': 112, 'key': 'C', 'sfx': 'clean', 'music': 'whimsical'}}, 'bpm': 112, 'seed': 37}
audio.build('.', meta, resolved, 'out/mix.wav')
