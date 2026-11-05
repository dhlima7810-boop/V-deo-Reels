# Music bed + SFX (motion-studio's procedural audio) + pm_alex narration, ducked.
import json, sys
S = '/root/.claude/skills/synced/d6609b77-e2a1-4b3e-806d-535b14b5cb42_1bdba0e6-bdf2-44b2-b901-d4d290344d99/motion-studio/scripts'
sys.path.insert(0, S)
import audio
n = json.load(open('narracao.json')); L = {l['id']: l for l in n['lines']}
def W(i, w, k=0):
    ws = [x for x in L[i]['words'] if x['w'].lower().startswith(w)]; return (ws[k] if len(ws) > k else ws[0])['start']
dur = n['duration']
cues = [{'t': L[i]['start'] - .08, 'type': 'whoosh', 'gain': .5} for i in L if i not in ('s1',)]
cues += [{'t': W('s4', 'cava'), 'type': 'impact', 'gain': .6}, {'t': W('s8', 'sem') + .4, 'type': 'swoosh', 'gain': .8},
         {'t': W('s10', 'pegar'), 'type': 'boom', 'gain': .7}, {'t': W('s12', 'gerador'), 'type': 'zap', 'gain': .6},
         {'t': W('s13', 'luz'), 'type': 'chime', 'gain': .8}, {'t': W('s9', 'biog'), 'type': 'pop', 'gain': .8}]
for i, w in [('s3', 'chorume'), ('s4', 'argila'), ('s4', 'manta'), ('s5', 'lagoa'), ('s7', 'camada'), ('s8', 'bact'), ('s9', 'metano'), ('s11', 'tubos'), ('s12', 'usina')]:
    cues.append({'t': W(i, w), 'type': 'pop', 'gain': .5})
scenes = [{'start': L[i]['start'] if i != 's1' else 0, 'end': L[i]['end'] + .22, 'energy': e} for i, e in zip(L, [.7, .6, .7, .8, .6, .8, .8, .5, .6, .9, .8, .8, .7])]
meta = {'duration': dur, 'scenes': scenes, 'cues': cues}
resolved = {'audio': {'music': 'whimsical', 'voiceover': 'assets/narracao.wav', 'sfx': True}, 'style': {'sound': {'bpm': 112, 'key': 'C', 'sfx': 'clean', 'music': 'whimsical'}}, 'bpm': 112, 'seed': 31}
audio.build('.', meta, resolved, 'out/mix.wav')
