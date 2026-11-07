# Efeitos do Dia 2
def CUES(W, St, En):
    ids = ['b3','b4','b6','b7','b8','b9','b12','b14','b15','b16']
    c = [{'t': St(i) - .3, 'type': 'whoosh', 'gain': .25} for i in ids]
    c += [{'t': W('b1', '140'), 'type': 'impact', 'gain': .8}, {'t': W('b1', 'absurdos'), 'type': 'impact', 'gain': .7}, {'t': W('b1', '20'), 'type': 'pop', 'gain': .5},
          {'t': W('b3', 'juros'), 'type': 'ding', 'gain': .5},
          {'t': W('b4', 'fgc') - .4, 'type': 'swoosh', 'gain': .5}, {'t': W('b4', 'fgc') + .15, 'type': 'boom', 'gain': .6},
          {'t': W('b5', '250') - .2, 'type': 'pop', 'gain': .6},
          {'t': W('b6', 'merda'), 'type': 'impact', 'gain': .9}, {'t': W('b6', 'paga'), 'type': 'pop', 'gain': .5},
          {'t': W('b7', 'montava'), 'type': 'swoosh', 'gain': .4}, {'t': W('b7', 'em'), 'type': 'pop', 'gain': .6},
          {'t': W('b10', 'dez') - .1, 'type': 'click', 'gain': .8}, {'t': W('b11', 'cem') - .1, 'type': 'impact', 'gain': .8}, {'t': W('b11', 'mão'), 'type': 'glitch', 'gain': .35},
          {'t': W('b12', 'viram') - .2, 'type': 'riser', 'gain': .4, 'dur': 1.4}, {'t': W('b12', 'duzentos') + .5, 'type': 'boom', 'gain': .5},
          {'t': W('b15', 'cem') - .1, 'type': 'impact', 'gain': .8}, {'t': W('b16', 'amigos'), 'type': 'boom', 'gain': .55}]
    c += [{'t': St('b4') + k * .045, 'type': 'type', 'gain': .3} for k in range(24)]
    c += [{'t': St('b8') + k * .05, 'type': 'type', 'gain': .3} for k in range(18)]
    c += [{'t': St('b13') + .2 + k * .12, 'type': 'tick', 'gain': .4} for k in range(12)]
    c += [{'t': St('b14') + k * .16, 'type': 'click', 'gain': .45} for k in range(14)]
    return c
