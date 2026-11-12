# Music bed + SFX (motion-studio's procedural audio) + pm_alex narration, ducked.
import json, sys
S = '/root/.claude/skills/synced/d6609b77-e2a1-4b3e-806d-535b14b5cb42_1bdba0e6-bdf2-44b2-b901-d4d290344d99/motion-studio/scripts'
sys.path.insert(0, S)
import audio
n = json.load(open('narracao.json')); L = {l['id']: l for l in n['lines']}
def W(i, w, k=0):
    ws = [x for x in L[i]['words'] if x['w'].lower().startswith(w)]; return (ws[k] if len(ws) > k else ws[0])['start']
dur = n['duration']
T_TUN = L['s3']['start'] + .55; T_REV = W('s3', 'até') + .15
whips = [L['s2']['start'], T_REV, L['s4']['start'], L['s7']['start'], L['s10']['start'], L['s11']['start'], L['s12']['start'], L['s13']['start']]
dives = [T_TUN, L['s5']['start'], L['s6']['start'], L['s8']['start'], L['s9']['start']]
cues = [{'t': x - .1, 'type': 'whoosh', 'gain': .55} for x in whips] + [{'t': x - .15, 'type': 'swoosh', 'gain': .7} for x in dives]
cues += [{'t': L['s2']['start'] + .25, 'type': 'pop', 'gain': .7}, {'t': T_REV + .55, 'type': 'impact', 'gain': .5}, {'t': W('s8', 'mata'), 'type': 'boom', 'gain': .45},
         {'t': W('s9', 'dentes'), 'type': 'zap', 'gain': .5}, {'t': W('s12', 'sai') + .35, 'type': 'pop', 'gain': .7}, {'t': W('s12', 'limpinha'), 'type': 'chime', 'gain': .7},
         {'t': W('s13', 'passou'), 'type': 'chime', 'gain': .6}, {'t': W('s9', 'proteger') + .3, 'type': 'impact', 'gain': .4}]
for i, w in [('s1', 'cidade'), ('s2', 'micr'), ('s3', 'estação'), ('s4', 'sulfato'), ('s5', 'flocos'), ('s6', 'decanta'), ('s7', 'pedra'), ('s7', 'areia'), ('s7', 'carv'),
             ('s8', 'cloro'), ('s9', 'flúor'), ('s10', 'caixa'), ('s11', 'gravidade'), ('s12', 'limpinha')]:
    cues.append({'t': W(i, w), 'type': 'pop', 'gain': .45})
scenes = [{'start': L[i]['start'] if i != 's1' else 0, 'end': (L[i]['end'] + .4) if i != 's13' else dur, 'energy': e} for i, e in zip(L, [.7, .6, .7, .7, .6, .6, .7, .8, .6, .7, .8, .8, .7])]
meta = {'duration': dur, 'scenes': scenes, 'cues': cues}
resolved = {'audio': {'music': 'whimsical', 'voiceover': 'assets/narracao.wav', 'sfx': True}, 'style': {'sound': {'bpm': 112, 'key': 'C', 'sfx': 'clean', 'music': 'whimsical'}}, 'bpm': 112, 'seed': 37}
audio.build('.', meta, resolved, 'out/mix.wav')
