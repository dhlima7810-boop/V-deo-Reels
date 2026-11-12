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
cues += [{'t': L['s5']['start'], 'type': 'swoosh', 'gain': .8}, {'t': L['s8']['start'], 'type': 'swoosh', 'gain': .8},
         {'t': W('s8', 'mata'), 'type': 'boom', 'gain': .5}, {'t': W('s12', 'sai'), 'type': 'chime', 'gain': .7},
         {'t': W('s13', 'tudo'), 'type': 'chime', 'gain': .6}, {'t': W('s9', 'dentes'), 'type': 'zap', 'gain': .5}]
for i, w in [('s1', 'água'), ('s2', 'micr'), ('s3', 'estação'), ('s4', 'sulfato'), ('s5', 'flocos'), ('s6', 'decanta'), ('s7', 'pedra'), ('s7', 'areia'), ('s7', 'carv'),
             ('s8', 'cloro'), ('s9', 'flúor'), ('s10', 'caixa'), ('s11', 'gravidade'), ('s12', 'limpinha')]:
    cues.append({'t': W(i, w), 'type': 'pop', 'gain': .5})
scenes = [{'start': L[i]['start'] if i != 's1' else 0, 'end': (L[i]['end'] + .4) if i != 's13' else dur, 'energy': e} for i, e in zip(L, [.7, .6, .7, .7, .6, .6, .7, .8, .6, .7, .8, .8, .7])]
meta = {'duration': dur, 'scenes': scenes, 'cues': cues}
resolved = {'audio': {'music': 'whimsical', 'voiceover': 'assets/narracao.wav', 'sfx': True}, 'style': {'sound': {'bpm': 112, 'key': 'C', 'sfx': 'clean', 'music': 'whimsical'}}, 'bpm': 112, 'seed': 37}
audio.build('.', meta, resolved, 'out/mix.wav')
