# O Esquema Vorcaro — Dia 1/4

Série explicativa sobre o caso Banco Master, em 4 vídeos. Visual de documentário investigativo, narração pm_alex, sem música, vinheta zuum. no fim.
Plano de produção: https://claude.ai/artifact/1WW7E9HUYcduFAQ48ATB8S

- `roteiro.json`: falas (`say` = como a voz lê; `hl` = palavras em vermelho na legenda; `pre` = pausa antes)
- `tts.py [velocidade]`: Kokoro pm_alex (0.95) -> `assets/narracao.wav` + `narracao.json`
- `lib.js`: kit visual (papel, carimbo, silhueta sem rosto, banco, cédula, pasta, legenda). Tudo é função de t; ruído só com semente fixa.
- `scene.js`: cenas do episódio, cada uma presa a uma fala da narração
- `render.js`: `node render.js stills 2,10` ou `node render.js video 60` (Playwright, quadro a quadro, 60 fps)
- `cues.py` + `mix.py`: efeitos sonoros presos às palavras + voz -> `out/mix.wav`
- `final.sh vorcaro-dia-1`: junta vídeo + áudio, normaliza em -14 LUFS e coloca a vinheta zuum. no FIM

Fontes: Playfair Display e Oswald (OFL), JetBrains Mono do sistema.
