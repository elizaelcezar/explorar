# 🚀 Colono Espacial — Missão Sistema Solar

Ano 2150. A nave-mãe **Esperança** levou 1000 colonos dormindo até o Sistema
Solar. **Você**, cadete, foi acordado pela IA **ARIA**: desça aos planetas,
**aprenda os segredos reais de cada um** e prepare abrigo, comida e energia
para os colonos chegarem!

Jogo **educativo** 2D em HTML + CSS + JavaScript puro (Canvas).
Sem dependências. Feito para crianças curiosas por **história e ciências**.

## 🪐 Os 8 planetas (fatos de verdade!)

| Planeta | Pouso | Desafio | Curiosidade |
|---|---|---|---|
| ⚪ Mercúrio | superfície | ☀️ 430°C de dia, ❄️ -180°C à noite | Dia dura 176 dias terrestres! |
| 🟠 Vênus | superfície | 🔥 465°C sempre (efeito estufa!) | O dia dura mais que o ano! |
| 🔴 Marte | superfície | ❄️ frio + 🌪️ tempestades de poeira | Vermelho de ferrugem! |
| 🟤 Júpiter | Europa, lua de gelo | 💨 ventos + frio | Cabem 1300 Terras dentro! |
| 🪐 Saturno | Titã, lua de lagos | ❄️ frio + vento | Flutuaria na água! |
| 🩵 Urano | Ariel, lua de gelo | ❄️❄️ -200°C | Gira deitado de lado! |
| 🔷 Netuno | Tritão, lua gelada | 💨💨 ventos de 2100 km/h | Descoberto pela matemática! |
| ❄️ Plutão (secreto!) | superfície | ❄️❄️ -230°C | Tem um coração de gelo! |

Botão **🪐** abre a ficha real: distância, temperatura, gravidade,
dia/ano, luas, ar e **do que cada planeta é feito**.

## 🕹️ Controles

| Tecla | Ação |
|---|---|
| WASD / Setas | mover (Shift = correr) |
| **E** | agir: coletar, escanear bichinhos 👽, usar console/antena |
| Q | comer cultivo 🍎 |
| T | lanterna do traje 🔦 |
| C / B | criar / construir |
| M | missões e mensagens 📻 |

## ✨ Sistemas

- **Traje espacial**: 🌬️ oxigênio cai fora da base (módulo, abrigo e estufa recarregam); 🔋 energia cai à noite/no frio (abrigo, painel e módulo recarregam); sem O₂ você desmaia e acorda no módulo.
- **Missão por planeta**: colete 3 🧪 amostras, construa 🛖 abrigo + 🌱 estufa + 🔆 painel, escaneie 2 bichinhos, responda o **quiz da ARIA** 🛰️ e ligue a 📡 antena para chamar os colonos!
- **Comunicação**: ARIA e a Capitã Duarte mandam mensagens; 📦 suprimentos a cada 90s.
- **Progressão**: cada colônia pronta libera o próximo planeta. Complete os 8 para revelar **Plutão secreto** e vencer!

## ▶️ Como jogar

```bash
python3 -m http.server 8000
# acesse http://localhost:8000
```

Ou ative o GitHub Pages (`Settings → Pages → main → / (root)`).

## 📁 Estrutura

```
explorar/
├── index.html      # UI: HUD do traje, painéis, telas
├── css/style.css   # visual espacial
├── js/game.js      # nave-mãe, planetas, missões, quiz, save
```

## 📄 Licença

MIT.
