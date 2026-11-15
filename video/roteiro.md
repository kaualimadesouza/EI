# TOPA: da fila ao fluxo

Roteiro do vídeo de produto de 30 segundos, em seis cenas com corte seco.
Entregas: horizontal em 1920 × 1080 e vertical em 1080 × 1920, cada uma com
composição própria, narração em pt-BR, efeitos sonoros e a frase principal
sempre escrita na tela.

## Público e objetivo

Donos de restaurantes, lanchonetes e outros pequenos e médios negócios de
alimentação. O vídeo segue a estrutura de pitch: problema, solução, diferencial,
operação, modelo de negócio e chamada. A mensagem que precisa ficar é que o
TOPA resolve a fila **e diminui o risco de quem empreende**, porque o totem é
assinado, não comprado.

## Direção

- **Vídeo editado, não slides.** Cada cena é uma ação: algo cai, é tocado, voa
  ou é riscado. A câmera aproxima de cada toque nas telas reais do app.
- **Uma frase por vez**, grande e centralizada embaixo, com o trecho de destaque
  em itálico serifado. Ela substitui título e legenda, então o vídeo funciona
  sem som.
- **Identidade do app:** creme e verde-petróleo de `topa/web/src/index.css`,
  Lexend, marca original e capturas das telas deste repositório.
- **Cortes a cada 2 segundos ou múltiplo disso**, sem transição entre cenas.
- **Narração sem trilha de fundo.** Ficam só os efeitos: comandas caindo,
  toques, o cardápio passando para o celular, o risco na compra.

## Cenas

| Tempo | Função no pitch | Frase na tela | O que acontece | Narração |
| --- | --- | --- | --- | --- |
| 0–4 s | Gancho e problema | Seu restaurante cresceu. *A fila também.* | Comandas "Em espera" caem uma a uma e formam uma fila que cresce para fora do quadro. | "Seu restaurante cresceu. A fila também." |
| 4–10 s | Solução | No TOPA, o cliente *pede sozinho.* → E o totem sugere *o complemento.* | O totem sobe. Toque em "Comer aqui", toque no X-salada, a sugestão de suco aparece e é aceita, o total chega a R$ 32,80 e o pedido abre. Etiquetas saltam a cada passo. | "No TOPA, o cliente pede sozinho. E o totem ainda sugere o complemento." |
| 10–16 s | Diferencial | Totem ocupado? *Encosta o celular.* → No navegador, *sem baixar aplicativo.* | Com o totem mostrando "A fila está grande", um celular encosta nele. O cardápio sai da tela do totem, encolhe e pousa no celular. A câmera aproxima e o cliente adiciona um X-salada. | "Totem ocupado? Encosta o celular e pede no navegador, sem baixar aplicativo." |
| 16–20 s | Operação | Cada pedido cai *no seu painel.* | Painel do lojista. O cursor clica em "Começar preparo" e o pedido 001 passa de Recebidos para Em preparo. | "Cada pedido cai direto no seu painel." |
| 20–24 s | Modelo e risco | Menos risco *para quem empreende.* | Dois cartões: "Comprar o totem / Investimento inicial" é riscado e sai; "Assinar o totem / Serviço mensal" vai para o centro e ganha "Sem investimento inicial" e "Roda em tablet ou celular". | "Sem investimento inicial: menos risco para quem empreende." |
| 24–30 s | Marca e chamada | Topa transformar *seu atendimento?* | Marca TOPA grande, "Totem por assinatura", botão **Assine o TOPA** e QR Code com "Aponte a câmera e veja os planos". Fica parado a partir de 27 s para dar tempo de escanear. | "TOPA. Totem por assinatura. Topa transformar o seu atendimento?" |

## Narração

- Voz `pt-BR-FranciscaNeural`, a mesma do primeiro vídeo.
- **A marca se pronuncia "TÓPA".** No texto enviado à voz ela é escrita "Tópa",
  com acento, só para forçar a pronúncia. Na tela continua "TOPA".
- Cada fala começa de 0,2 a 0,5 s depois do corte e termina antes do corte
  seguinte. A mais apertada é a do celular (5,7 s em uma cena de 6 s).
- Arquivo: `narracao.wav`, 30 s, estéreo, 48 kHz, nivelado em -16 LUFS.

## Adaptação por formato

- **Horizontal:** aparelho ao centro, etiquetas nas laterais, encerramento em
  duas colunas (marca e chamada à esquerda, QR à direita).
- **Vertical:** aparelhos maiores, frase acima da faixa que Reels e TikTok
  cobrem embaixo, encerramento empilhado. O selo da marca some nas cenas com
  aparelho para não cobrir a tela.
- Nunca recortar um formato para gerar o outro.

## Fidelidade ao produto

- Assinatura mensal, sem investimento inicial, em tablet ou celular: README e
  `docs/situacoes_EI_2026.tex`.
- Cardápio, sacola e sugestão de complemento: `topa/web/src/ui/kiosk/`. A
  sugestão mostrada é baseada em regras.
- Pedido pelo celular por NFC ou QR Code, no navegador e sem instalar nada: tela
  "A fila está grande" do próprio totem e `EndScreens.tsx`.
- Painel do lojista: `topa/web/src/ui/painel/`, com dados locais de
  demonstração.
- Não prometer números, aumento de vendas, visão computacional já entregue,
  pagamento offline nem preço de plano. Nada disso aparece no vídeo.

## Pendências

1. **Página de planos.** O encerramento chama para assinar e ver os planos, mas
   o QR Code ainda aponta para `https://topa-totem.vercel.app`, o cardápio do
   cliente. Quando a página existir, gerar o QR novo e trocar nos dois formatos.
2. **Ouvir a narração.** Conferir se a marca saiu como "TÓPA" e se o ritmo das
   falas acompanha as cenas.
3. **Ritmo do meio.** O totem faz quatro toques em 6 s. Se parecer corrido, a
   troca mais limpa é tirar a cena do painel e devolver os 4 s ao totem e à
   cena de risco.

## Versões anteriores

O primeiro corte (quatro cards, com trilha e a chamada "Explore o cardápio")
está em `topa-horizontal.mp4` e `topa-vertical.mp4`. As decisões de pesquisa que
o embasaram continuam em `referencias.md`.
