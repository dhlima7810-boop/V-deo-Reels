# Efeitos do Dia 3
def CUES(W, St, En):
    c = [{'t': St(i) - .3, 'type': 'whoosh', 'gain': .25} for i in ['c2','c4','c5','c6','c7','c9','c10','c11','c12']]
    c += [{'t': W('c1', 'público'), 'type': 'impact', 'gain': .9}]
    c += [{'t': W('c2', 'comprou') + k * .3, 'type': 'swoosh', 'gain': .3} for k in range(8)]
    c += [{'t': W('c2', '12'), 'type': 'pop', 'gain': .6}, {'t': W('c3', 'vento'), 'type': 'impact', 'gain': .85}, {'t': W('c3', 'nega'), 'type': 'click', 'gain': .5},
          {'t': W('c4', 'supor') - .4, 'type': 'pop', 'gain': .6},
          {'t': W('c5', 'jantar'), 'type': 'pop', 'gain': .4}, {'t': W('c5', 'drink'), 'type': 'pop', 'gain': .4}, {'t': W('c5', 'champanhe'), 'type': 'ding', 'gain': .6}, {'t': W('c5', 'amigos'), 'type': 'pop', 'gain': .4},
          {'t': W('c6', '20') - .3, 'type': 'riser', 'gain': .25, 'dur': .7},
          {'t': W('c7', 'noronha') - .3, 'type': 'swoosh', 'gain': .5}, {'t': W('c7', 'cartão') - .3, 'type': 'swoosh', 'gain': .5}, {'t': W('c7', 'senha'), 'type': 'pop', 'gain': .5},
          {'t': W('c8', 'imagina'), 'type': 'impact', 'gain': .7},
          {'t': W('c9', 'palestrinha'), 'type': 'pop', 'gain': .5}, {'t': W('c9', 'festa'), 'type': 'pop', 'gain': .5}, {'t': W('c9', 'jantar'), 'type': 'pop', 'gain': .5}, {'t': W('c9', 'meninas'), 'type': 'pop', 'gain': .5}, {'t': W('c9', 'meninas') + .3, 'type': 'glitch', 'gain': .35},
          {'t': W('c11', 'investiga'), 'type': 'impact', 'gain': .7},
          {'t': W('c12', 'banqueiros') - .6, 'type': 'riser', 'gain': .35, 'dur': .8}, {'t': W('c12', 'banqueiros'), 'type': 'boom', 'gain': .6}]
    c += [{'t': W('c10', w), 'type': 'click', 'gain': .7} for w in ['deputado', 'senador', 'prefeito', 'pastor', 'comediante', 'influencer']]
    c += [{'t': St('c4') + k * .05, 'type': 'type', 'gain': .3} for k in range(28)]
    c += [{'t': W('c6', 'fiscal') - .4 + k * .06, 'type': 'type', 'gain': .3} for k in range(10)]
    return c
