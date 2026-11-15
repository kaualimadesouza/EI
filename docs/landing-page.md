# Landing page do TOPA

A página de apresentação fica em `/conheca`, no frontend existente. O cardápio
continua em `/`; os links de loja e o painel mantêm os caminhos anteriores.

Prévia da composição: [desktop](landing-topa-desktop.png) e
[celular](landing-topa-mobile.png).

## Direção visual e referências

- [Perssua](https://perssua.com/pt): mensagem direta, demonstração do produto e
  uma chamada clara para a próxima ação.
- [AbacatePay](https://www.abacatepay.com/pricing): navegação leve, respiro entre
  as seções e apresentação legível de preços e condições.
- [Clacky](https://clackyapp.pages.dev/): destaque visual do produto, vídeo,
  planos e perguntas frequentes na mesma jornada.
- A landing do Argumenta no projeto `argumenta-web` serviu como referência de
  organização: conteúdo separado da interface, demonstração, planos, FAQ e
  chamada final. A implementação do TOPA usa seus próprios componentes e tokens.

A identidade é a do TOPA: Lexend, creme, verde-petróleo e sálvia. As telas e as
fotos são as do produto. A composição do topo mostra o totem, o celular e um
pedido de exemplo. A demonstração interativa permite explorar os três fluxos.

Os vídeos v2 fornecidos são preservados em `video/`. A página usa cópias
otimizadas para a web, carregadas apenas ao abrir o vídeo. O navegador escolhe
a versão vertical para telas de até 600 px e a horizontal nas demais.

## Planos e decisões de conteúdo

| Plano proposto | Referência | Escopo apresentado |
| --- | --- | --- |
| Digital | Sob consulta | Uso de aparelho da própria loja, sujeito a avaliação no piloto |
| Completo | R$ 249 por terminal/mês | Dispositivo, software, suporte e suporte antifurto |
| Redes | Sob consulta | Planejamento e configuração para mais de um estabelecimento |

Os formatos são propostas, não contratos disponíveis para contratação imediata.
O valor de R$ 249 vem do rascunho `pipe/pipe_EI_2026.tex`, que registra a decisão
de preço como pendente de validação. Isso aparece junto aos planos e no FAQ.

Os botões comerciais podem receber uma URL de contato real através de
`VITE_COMMERCIAL_CONTACT_URL`. Sem essa configuração, levam à demonstração.
Não há cadastro fictício, formulário sem destino nem confirmação de contratação.

A página apresenta funcionalidades existentes e não promete visão computacional
já entregue, aceitação de cartão por aproximação pronta, pagamentos offline ou
resultados numéricos de vendas.

## Código e manutenção

`topa/web/src/ui/landing/` contém a página, o conteúdo, o diálogo de vídeo, os
estilos e os testes. O encaminhamento da rota está em `src/App.tsx`.

`scripts/prepare-landing-assets.py` recria as imagens e os vídeos otimizados a
partir dos arquivos versionados. `scripts/check-landing.py` confere a interface
em 1440, 768, 390 e 320 px, sem criar pedidos na API publicada. Os comandos estão
no [README do frontend](../topa/web/README.md#product-landing-page).

A implementação inicial passou em lint, TypeScript, build e 543 testes, com
100% de cobertura. A conferência no Chromium validou os quatro tamanhos,
reprodução horizontal e vertical, fechamento do vídeo por Escape, menu,
demonstração, FAQ e acesso aos fluxos existentes de loja e painel.
