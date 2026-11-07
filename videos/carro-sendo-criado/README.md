# Como nasce um carro (explicativo 3D low-poly com personagem)

Molde do vídeo do aterro + um personagem (Téo, mecânico com boné roxo zuum.) que fala na tela.

- `roteiro.json`: falas (palavras em amarelo em `hl`; `pre` = pausa antes da fala)
- `tts.py`: narração Kokoro pm_alex, velocidade natural (1.0) -> `assets/narracao.wav` + `narracao.json` (tempos por palavra + `amp` a 100 Hz pra boca do Téo)
- `index.html` + `scene.js`: cena Three.js, tudo função de `t`. Legenda por frase (até 4 palavras), segurada e com fade suave.
- `render.js`: `node render.js stills 1.5,8` ou `node render.js video 60`
- `mix.py`: só efeitos (sem música) + motor/solda/spray sintetizados + voz -> `out/mix.wav`, depois loudnorm -14 LUFS

Final: frames + áudio -> corpo, depois vinheta zuum. no FIM.
