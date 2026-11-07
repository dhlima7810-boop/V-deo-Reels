# Efeitos do Dia 1 (tipo, tempo). Tipos: impact boom whoosh swoosh riser click pop tick ding chime glitch type
def CUES(W, St, En):
    c = [{'t': St(i) - .3, 'type': 'whoosh', 'gain': .25} for i in ['a2','a3','a4','a5','a6','a7','a8','a9','a10','a11','a12','a13']]
    c += [{'t': St('a1') + .3 + k * .045, "type": "type", 'gain': .35} for k in range(14)]
    c += [{'t': W('a1', 'bandido'), 'type': 'impact', 'gain': .9}, {'t': W('a1', 'bandido'), 'type': 'boom', 'gain': .5},
          {'t': W('a2', 'gênio') - .1, 'type': 'chime', 'gain': .5},
          {'t': St('a3') + .3, 'type': 'swoosh', 'gain': .5}, {'t': W('a3', 'esquema'), 'type': 'impact', 'gain': .9},
          {'t': W('a4', 'não'), 'type': 'impact', 'gain': .85}, {'t': W('a4', 'emprestar'), 'type': 'swoosh', 'gain': .4},
          {'t': W('a5', 'mil'), 'type': 'pop', 'gain': .5}, {'t': W('a5', 'dez'), 'type': 'riser', 'gain': .3, 'dur': .6},
          {'t': W('a6', 'entrar'), 'type': 'swoosh', 'gain': .5}, {'t': W('a6', 'sai'), 'type': 'click', 'gain': .5},
          {'t': St('a7') + .2, 'type': 'tick', 'gain': .6}, {'t': St('a7') + .6, 'type': 'tick', 'gain': .6}, {'t': St('a7') + 1.0, 'type': 'tick', 'gain': .6},
          {'t': W('a7', 'basileia') - .2, 'type': 'pop', 'gain': .6},
          {'t': W('a8', 'vira'), 'type': 'impact', 'gain': .8},
          {'t': W('a9', 'patrimônio'), 'type': 'riser', 'gain': .3, 'dur': 1.2},
          {'t': St('a10') + .1, 'type': 'glitch', 'gain': .35},
          {'t': W('a11', 'master') - .7, 'type': 'swoosh', 'gain': .6}, {'t': W('a11', 'master'), 'type': 'shimmer', 'gain': .5},
          {'t': W('a12', 'juros') - .2, 'type': 'riser', 'gain': .45, 'dur': .9}, {'t': W('a12', 'juros') + .65, 'type': 'boom', 'gain': .7},
          {'t': W('a13', 'malandragem'), 'type': 'boom', 'gain': .5}]
    c += [{'t': St('a3') + 1.2 + k * .07, 'type': 'type', 'gain': .3} for k in range(16)]
    return c
