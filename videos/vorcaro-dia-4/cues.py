# Efeitos do Dia 4
def CUES(W, St, En):
    c = [{'t': St(i) - .3, 'type': 'whoosh', 'gain': .25} for i in ['d2','d3','d4','d5','d6','d7','d8','d9','d10','d11']]
    c += [{'t': W('d1', 'privado') - .6, 'type': 'swoosh', 'gain': .5}, {'t': W('d1', 'privado'), 'type': 'impact', 'gain': .85},
          {'t': W('d2', 'farra'), 'type': 'shimmer', 'gain': .5},
          {'t': W('d3', 'rombo'), 'type': 'riser', 'gain': .4, 'dur': 1.6}, {'t': W('d3', 'porra'), 'type': 'impact', 'gain': 1.0}, {'t': W('d3', 'porra'), 'type': 'boom', 'gain': .6},
          {'t': W('d4', 'pedrinha'), 'type': 'tick', 'gain': .9}, {'t': W('d4', 'galípolo') - .2, 'type': 'pop', 'gain': .6},
          {'t': W('d5', 'barrou'), 'type': 'impact', 'gain': .9},
          {'t': W('d6', 'real'), 'type': 'ding', 'gain': .5},
          {'t': St('d7') + .2, 'type': 'notify', 'gain': .4}, {'t': St('d7') + 1.4, 'type': 'notify', 'gain': .4}, {'t': St('d7') + 2.6, 'type': 'notify', 'gain': .4},
          {'t': W('d7', 'merda'), 'type': 'impact', 'gain': 1.0}, {'t': W('d7', 'merda'), 'type': 'boom', 'gain': .6},
          {'t': W('d8', 'prendeu'), 'type': 'impact', 'gain': .95},
          {'t': W('d9', 'fechou') + .05, 'type': 'glitch', 'gain': .4}, {'t': W('d9', 'fechou') + .5, 'type': 'impact', 'gain': .85}, {'t': W('d9', '41') - .6, 'type': 'riser', 'gain': .4, 'dur': 1.2}, {'t': W('d9', '41') + .7, 'type': 'boom', 'gain': .55},
          {'t': W('d10', 'que') + .6, 'type': 'impact', 'gain': .6}, {'t': W('d10', 'golpezinho'), 'type': 'impact', 'gain': .85},
          {'t': W('d11', 'barato'), 'type': 'impact', 'gain': .85}, {'t': W('d11', 'barato') + .1, 'type': 'boom', 'gain': .5}]
    c += [{'t': St('d8') + .2 + k * .1, 'type': 'type', 'gain': .35} for k in range(10)]
    c += [{'t': St('d11') + .3 + k * .06, 'type': 'type', 'gain': .3} for k in range(20)]
    return c
