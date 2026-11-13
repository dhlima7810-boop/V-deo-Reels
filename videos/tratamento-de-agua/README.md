# Tratamento de água (explicativo 3D low-poly, diário #1)

Mesmo modelo do aterro/biogás. Rio marrom → bomba → sulfato de alumínio (flocos) → decantação → filtro (pedra, areia, carvão) → cloro e flúor → caixa d'água → gravidade → torneira.

- `roteiro.json` – falas (palavras amarelas em `hl`)
- `tts.py [velocidade]` – Kokoro pm_alex (0.88) -> `assets/narracao.wav` + `narracao.json`; o corpo é completado com silêncio até 58,0 s (+ 2 s de vinheta zuum. = 60 s)
- `scene.js` – cena Three.js, tudo função de `t`
- `render.js` – `node render.js stills 1,5,9` ou `node render.js video 60 k 3` (parte k de 3, em paralelo) -> `out/part_k.mp4`
- `mix.py` – trilha whimsical + efeitos + narração -> `out/mix.wav`, depois loudnorm -14 LUFS
