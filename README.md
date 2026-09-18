# 🪐 Pixel Planetas

Você acorda **sem nada** num planeta redondo e desconhecido. **Sobreviva, evolua, construa um foguete 🚀 e explore outros planetas** — cada um com seus perigos.

Jogo 2D **pixel art** em HTML + CSS + JavaScript puro (Canvas). Sem dependências.

## 🌍 Os planetas (o mundo é redondo!)

Ande em linha reta e você volta ao mesmo lugar — o mundo tem **wrap-around** como um planeta de verdade: minimapa redondo, vinheta de curvatura e atmosfera.

| Planeta | Perigo | Regra especial |
|---|---|---|
| 🌿 Verde | ☠️ | Tranquilo. Aprenda aqui. |
| 🏜️ Kharos | ☠️☠️ | Calor: de dia a fome cai 2x mais rápido. Pouca madeira, muita pedra. |
| ❄️ Glacius | ☠️☠️☠️ | Frio: longe do fogo você congela. Fique perto de fogueira/tocha. |
| 🌑 Noctis | ☠️☠️☠️☠️ | Noite eterna, XP em dobro. O Chefão mora aqui. |

## 🕹️ Controles (mínimos de propósito)

| Tecla | Ação |
|---|---|
| WASD / Setas | mover (Shift = correr) |
| Mouse / Espaço | atacar |
| **E** | **agir**: coletar, pegar loot, abrir 🎁, usar 🗿/🏛️/🔮, embarcar no foguete, **embarcar no ⛵, mergulhar 🏊, lançar a 🎣, fisgar** |
| **R** | jogar a **tarrafa 🕸️** na água (pega cardumes) |
| Q | comer (escolhe sozinho a melhor comida) |
| T | acender/apagar tocha |
| C / B | criar / construir |
| H | ajuda |

Só **2 botões de ação** na barra (🍖 comer, 🔥 tocha) + Criar e Construir no topo. Sem spam de avisos: uma dica fina de contexto diz o que o **E** faz agora, e a missão atual fica numa pílula no topo.

## ✨ Sistemas

- **Comece sem nada**: inventário zerado, missões guiadas (12 passos até o Chefão)
- **Mundo vivo**: 🎁 baús com tesouro, 🔮 cristais de XP, 🌿 ervas/🍄 cogumelos, 🗿 obeliscos com buff (+ataque/velocidade 90s), 🏛️ ruínas com lore, borboletas/pássaros/coelhos/vagalumes, flores, ossos, neve/folhas/areia/esporos no ar
- **Dia ☀️ / noite 🌙**: Abelha, Javali, Escorpião e Golem de dia; Esqueleto, Fantasma (atravessa paredes!), Morcego e Sombra à noite. Mortos queimam ao sol. Noite = mais inimigos, mais fortes.
- **Tocha portátil**: crafte (🪵2+🌾1) e aperte T — sem luz a noite é quase cega.
- **Abrigo** (⛺ tenda / 🏠 cabana): perto dele -40~-50% de dano + cura.
- **Foguete 🚀** (🪵15+🪨10+🌾6): construa, aperte **E** ao lado e viaje. Tudo que você construiu fica guardado em cada planeta.
- **Evolução**: coletar, criar e construir dão XP; cada nível +20 vida, +3 ataque.

## 🌊 Mar

- **Barco ⛵** (🪵10+🌾4 no Criar): **E** na margem para navegar (1.7x rápido), **E** de novo para desembarcar.
- **Deck ⚓** (🪵6 no Construir): píer sobre a água junto à margem — ande por ele e embarque direto.
- **Vara 🎣** (🪵3+🌾2): **E** de frente para a água, espere o ❗ e aperte **E** para fisgar (fundo dá mais peixe e pérolas 🦪).
- **Tarrafa 🕸️** (🌾5+🪵1): **R** (ou botão 🕸️ no celular) mirando a água — pega até 4 peixes/lulas do cardume.
- **Mergulho 🏊**: **E** na água sem barco — explore o fundo (🌿 algas, 🦪 ostras, 🪸 corais) de olho na barra de **fôlego 🌬️** (~25s; sem ar perde vida).
- **Vida marinha**: 🐟 peixes, 🦑 lulas, 🐋 baleias (gentis, esbarram no barco), 🦈 tubarões (caçam quem está na água!) e 🐙 polvo gigante no fundo (forte, dropa pérola).

## ▶️ Como jogar

```bash
python3 -m http.server 8000
# acesse http://localhost:8000
```

Ou ative o GitHub Pages (`Settings → Pages → main → / (root)`).

## 📁 Estrutura

```
pixel-aventura-sobrevivencia/
├── index.html      # UI mínima, HUD, painéis, telas
├── css/style.css   # visual espacial, minimapa redondo
├── js/game.js      # planetas, wrap-around, player, inimigos, crafting, save
```

## 📄 Licença

MIT.
