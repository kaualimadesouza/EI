# TOPA: da fila ao fluxo

Roteiro para um vídeo de produto de 30 segundos, em quatro cards animados.
Entregas: horizontal em 1920 × 1080 e vertical em 1080 × 1920, com composição
própria para cada formato, narração em pt-BR, legendas e trilha instrumental.

## Público e objetivo

Lojistas de pequenos e médios estabelecimentos de alimentação. O objetivo é
gerar identificação com a fila no horário de pico, apresentar o autoatendimento
por assinatura e convidar a conhecer a experiência do cliente no cardápio público do TOPA.

## Conceito visual

Uma fila de pequenas comandas se acumula. A mesma linha que representa a espera
se transforma no caminho do pedido: totem, celular e painel da loja. O filme
termina com esse caminho apontando para a chamada para ação. O celular aparece
como um novo canal de atendimento: um novo cliente abre o cardápio e inicia seu
pedido ali.

A identidade vem do app: tipografia Lexend, verde-petróleo, creme e sálvia,
marca original e fotografias já usadas no cardápio. A demonstração usa capturas
do código deste repositório. A animação deve evidenciar ações e relações entre
as telas, com títulos grandes e poucos elementos por vez.

## Quatro cards

| Tempo | Função | Texto principal na tela | Imagem e movimento | Narração |
| --- | --- | --- | --- | --- |
| 0–5 s | Gancho e identificação | **Seu negócio cresceu. A fila também?** | Comandas entram, acumulam-se e formam uma fila. A marca TOPA está presente desde a abertura. | “Seu negócio cresceu. A fila também?” |
| 5–13 s | Produto e proposta | **Autoatendimento por assinatura.** | A fila se abre para revelar o totem com o app real. Mostrar escolha de produto, montagem do pedido e sugestões complementares. Assinatura visual: **TOPA · Totem por assinatura**. | “Com TOPA, seu balcão ganha autoatendimento por assinatura. O cliente escolhe e monta o próprio pedido.” |
| 13–23 s | Demonstração do diferencial | **Totem ocupado? Peça pelo celular.** | Um novo cliente abre o cardápio no navegador do celular, com os sinais de QR Code e NFC. Depois, revelar o painel do lojista com pedidos de demonstração. Apresentar cada etapa em sequência. Primeiro destaque: **Sem baixar aplicativo.** Depois: **Pedidos no painel da loja.** | “Totem ocupado? Seu cliente pede pelo celular, por QR Code ou NFC, sem baixar aplicativo. Você acompanha no painel.” |
| 23–30 s | Marca e CTA | **Topa transformar seu atendimento?** | A linha se resolve na marca. Botão **Explore o cardápio**, apoio **Conheça a experiência do cliente**, endereço **topa-totem.vercel.app** e QR Code funcional para o mesmo endereço. Manter a chamada estável nos segundos finais. | “TOPA. Totem por assinatura. Topa transformar seu atendimento? Acesse e explore o cardápio.” |

## Ritmo, som e adaptação

- Abertura compreensível nos primeiros dois segundos. O produto aparece no
  segundo card, a partir de 5 s.
- Transições por continuidade do caminho da comanda; evitar efeitos que
  atrapalhem a leitura. Movimentos de entrada desaceleram e assentam.
- Trilha instrumental original, discreta sob a voz, com pequenos sons de papel,
  toque e confirmação associados às ações.
- Legendas abertas sincronizadas com a narração, com contraste e margem para
  interfaces de redes sociais. O vídeo também deve funcionar sem áudio.
- Horizontal: texto e demonstração lado a lado. Vertical: título acima,
  demonstração ao centro e legenda em uma faixa reservada. Sem recortar a
  versão horizontal para produzir a vertical.
- CTA com pelo menos cinco segundos de leitura integral. QR Code sem movimento
  durante esse intervalo, com margem branca e URL também escrita.

## Fidelidade ao produto

- O modelo por assinatura e o foco em pequenos e médios estabelecimentos vêm
  de `docs/situacoes_EI_2026.tex`, do pitch e do README.
- O cardápio, a sacola e as sugestões existem em
  `topa/web/src/ui/kiosk/`; as recomendações demonstradas são baseadas em regras.
- A passagem para o celular por QR Code ou NFC, sem instalação, está em
  `EndScreens.tsx`, nos adaptadores NFC e na documentação do app.
- O painel e o acompanhamento de pedidos existem em
  `topa/web/src/ui/painel/` e na API. As capturas usam somente dados locais
  de demonstração e não criam pedidos no servidor publicado.
- Identificar as capturas como **Demonstração do produto**. Não prometer
  resultados numéricos, aumento garantido de vendas, visão computacional já
  entregue, pagamentos offline ou integração universal com sistemas de gestão.
- O CTA leva à experiência pública do cliente, que usa a API publicada. O painel
  continua sendo uma área autenticada. Não anunciar contratação, preço,
  teste gratuito ou canal comercial que o repositório não oferece.

## Validação antes da montagem

1. Revisão do roteiro por um agente sem contexto desta conversa, confrontando
   os requisitos e as fontes do produto.
2. Pesquisa de referências públicas e orientações de criação de vídeos de
   produto, incluindo exemplos com resultados documentados quando disponíveis.
3. Ajuste final de direção visual e ritmo com base na revisão e na pesquisa.
4. Renderização dos dois MP4s e conferência de duração, áudio, legibilidade,
   proporção, legendas e destino do QR Code.

## Revisão independente

O revisor aprovou o conceito e o timing e solicitou ajustes antes da montagem.
Foram incorporados: CTA específico para explorar o cardápio público; encenação
de um novo pedido no celular; e narração do terceiro card dirigida ao lojista.
A revisão também confirmou o fluxo QR/NFC pelo navegador sem instalação.

Parecer após os ajustes: **aprovado para montagem**. A pesquisa e as escolhas
que informaram a execução estão em `referencias.md`.
