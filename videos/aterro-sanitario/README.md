# Aterro sanitário e biogás (explicativo 3D low-poly)

Mesmo estilo do "vídeo de exemplo": mundo 3D low-poly, narração em 2ª pessoa, legenda uma palavra por vez.

- `roteiro.json` – falas (e palavras destacadas em amarelo)
- `tts.py` – narração offline Kokoro, voz pm_alex -> `assets/narracao.wav` + `narracao.json` (tempos por palavra, estimados)
- `index.html` + `scene.js` – cena Three.js; tudo é função do tempo `t`
- `render.js` – `node render.js stills 1,5,9` (quadros soltos) ou `node render.js video 30` (MP4 sem som)
- `mix.py` – trilha + efeitos (motion-studio) + narração -> `out/mix.wav`

Final: junta `out/frames.mp4` + `out/mix_norm.wav` em `out/corpo.mp4`, depois concatena corpo + vinheta zuum. no FIM (`/mnt/project-files/branding/intro-zuum-1080x1920.mp4`), re-encode H.264/AAC 48 kHz.
