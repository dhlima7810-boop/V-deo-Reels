# O Garoto da Mata · Parte 1 (terror, estilo quadrinho)

60 s no total: 58 s de história + 2 s da vinheta zuum. no fim. Plano: https://claude.ai/artifact/9S9qAHaEgw921q2fPR3eNi

- `roteiro.json` + `tts.py` – narração Kokoro pm_alex grave; pausas escaladas pra fechar 58 s
- `desenhos.html` + `desenhar.js` – as 10 cenas desenhadas em SVG (contorno preto, cores chapadas, textura suja) -> `imagens/NN.png`
- `cenas.json` + `scene.js` + `index.html` – animação em Canvas 2D: zoom/pan, olhos vermelhos, lanternas, lâmpada falhando, bússola girando, neblina, grão; legenda uma palavra por vez
- `music.py` – trilha padrão de terror (caixinha de música original). `mix.py` – voz + efeitos + trilha -> `out/mix.wav` e `out/mix_sem_musica.wav`
- `render.js` – `node render.js frames 60 <i> <n>` (4 workers ~2 min)
