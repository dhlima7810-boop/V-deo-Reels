# 3h17 · Dia 1 (terror, 3D realista)

Série de terror zuum. Caio, 16 anos, recebe toda noite às 3h17 um áudio do próprio número, com a própria voz.
Plano de produção: https://claude.ai/artifact/Q5Xs2aGoWskmdJcdcmZCNv

Duração: 58 s de história + 2 s da vinheta zuum. no fim = **60 s no total** (regra do projeto).

- `roteiro.json` – falas, cena de cada uma e pausa depois (`voice`: `whisper` = áudio do celular, `corridor` = voz no corredor)
- `tts.py` – narração offline Kokoro `pm_alex` (speed 0.89, tom ~2 semitons abaixo). Escala as pausas pra história fechar em 58 s. Gera `assets/falas/*.wav` + `narracao.json`
- `index.html` + `scene.js` – Three.js: quarto, cozinha e quintal em PBR, luz motivada (celular, poste, corredor), neblina, pós com ACES, grão, vinheta e aberração. Tudo é função do tempo `t`
- `render.js` – `node render.js stills 1,5,9` ou `node render.js frames 60 <i> <n>` (worker i de n, quadros JPEG em `out/frames/`)
- `mix.py` – narração + efeitos sintetizados com semente (vibração, vidro, latido, vento, passos, batidas), sem música, -14 LUFS -> `out/mix.wav`

Montagem:
```
python3 tts.py && python3 mix.py
for i in 0 1 2 3; do node render.js frames 60 $i 4 & done; wait
ffmpeg -framerate 60 -i out/frames/f_%06d.jpg -i out/mix.wav -c:v libx264 -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest out/corpo.mp4
# depois concatena corpo + /mnt/project-files/branding/intro-zuum-1080x1920.mp4 (vinheta no FIM)
```
