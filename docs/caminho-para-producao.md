# Caminho para produção

O que falta para o TOPA atender uma loja de verdade, dividido em fases. Estado de 29/10/2026.

Todo build de produção (site, previews e apps) usa a API publicada na AWS. O **modo
demonstração**, com o cardápio embutido (`topa/web/src/domain/demo-catalog.ts`) e os pedidos
guardados só no aparelho, fica para o `npm run dev`. Os detalhes estão em `topa/web/README.md`.

## Fase 1: uma loja de verdade

Objetivo: a Lanchonete Bem-te-vi com dados num servidor, e totem, celular, site e painel vendo
os mesmos pedidos e esgotados. A issue #32 entregou parte desta fase (itens 1 e 2) junto com
a fase 2.

1. **Publicar a API e o banco.** Feito: a API roda na AWS Lambda (imagem
   `topa/api/Dockerfile.lambda`), atrás de um API Gateway, com o Postgres no Neon, no mesmo
   molde do kbjmodas-api. O deploy (`.github/workflows/api-deploy.yml`) roda
   `alembic upgrade head` antes de cada versão. O monitoramento contínuo pelo `/health/ready`
   está ativo via workflow agendado (`.github/workflows/health-monitor.yml`).
2. **Ligar o site e o app à API.** Feito: todo build de produção lê o endereço da API de
   `topa/web/.env.production`, e a API libera CORS para as URLs do projeto na Vercel e para os
   apps (`topa/api/infrastructure/main.tf`). Há um ambiente só: DEV, previews e apps gravam no
   mesmo banco que o PROD.
3. **Partida a frio.** Feito: o workflow agendado (`.github/workflows/health-monitor.yml`)
   chama `/health/ready` a cada 10 minutos para manter a Lambda e o banco aquecidos. No cliente
   web (`topa/web/src/adapters/http/http-connection.ts`), a checagem de prontidão tolera até
   6 s com retry imediato antes de reportar o servidor como inacessível.
4. **Autenticação.** Feito: autenticação por token Bearer (HMAC-SHA256) com senhas em scrypt e
   tabela `merchants` vinculada por loja. Rotas protegidas (`PATCH /products/{id}`, `PATCH /orders/{id}`,
   `GET /orders`) exigem login e validam o `store_slug`. Rota `POST /orders` com rate limit em memória
   (10 requisições por minuto por IP) e cabeçalho `Retry-After`. Frontend com tela de login, aviso LGPD
   e ação de logout. Política de privacidade documentada em `docs/privacidade.md`.
5. **Cardápio real.** Feito: rotas para criar (`POST /products`) e editar (`PUT /products/{id}`)
   produtos com validação de loja e autenticação de lojista; coluna `photo_url` no banco com fallback
   para `/photos/<id>.jpg`; categorias dinâmicas sem restrição fixa no banco; sugestões dinâmicas no
   totem baseadas no cardápio carregado da loja; interface no painel administrativo com formulário
   modal para cadastro e edição de produtos por lojistas autenticados.

Pronto quando: o pedido feito no celular aparece no painel da loja; um esgotado marcado no
painel aparece esgotado no celular (ambos entregues na issue #32); o lojista cadastra um produto
e ele aparece no totem; e, sem login, ninguém altera o cardápio nem lê os pedidos.

## Fase 2: várias lojas

A issue #32 entregou o banco por loja, o cardápio por loja na API e os ajustes do celular.

- **Banco:** feito na migration `20261029_a4c8e190b7d2`: tabela `stores`, com produtos, pedidos,
  itens e numeração diária escopados por `store_slug`.
- **API:** feito: `GET /menu?loja=<slug>`, escopo por loja em `/products` e `/orders`, e pedidos
  gravados com `store_slug`. Falta o cadastro de novas lojas.
- **Totem:** anuncia o endereço com o identificador da loja no NFC e no QR. Falta configurar a
  loja no primeiro uso com um token que vincule o aparelho a ela; hoje o totem parte de
  `PUBLIC_ORIGIN` e `DEMO_STORE_SLUG` em `topa/web/src/domain/store.ts`.
- **Celular:** feito (issue #32): carrega o cardápio da loja lida e acompanha o status do pedido.
  Na loja aberta no celular, o pagamento é só por Pix, com botão para copiar o código e sem mandar
  encostar o cartão no totem, e a pílula de status do servidor e o reinício por inatividade do
  totem não aparecem.
- **Painel:** já filtra por `?loja=<slug>`, mas falta vincular cada lojista autenticado à sua
  própria loja.

## Fase 3: pagamento de verdade

É a fase mais longa, porque depende de contrato e não só de código. Antes de programar, é
preciso escolher a credenciadora (Stone, PagBank, Mercado Pago, Cielo ou outra), comparando
taxas, contrato e o SDK para Android. Hoje o pagamento é simulado: o QR do Pix é
`TOPA-PIX-DEMO-…` e a aproximação do cartão não cobra nada.

- **Pix:** o provedor gera um QR dinâmico por pedido e avisa a API por webhook quando o
  pagamento cai. O pedido só entra na fila depois de pago. Falta também o fluxo de cancelamento
  e de estorno, e o webhook traz dados de quem pagou, que entram na política de privacidade.
- **Cartão por aproximação (Tap on Phone):** só existe com o SDK da credenciadora, que cuida do
  credenciamento e da certificação de segurança de cartão (PCI). O código de etiqueta NFC do
  TOPA não serve para aceitar cartão. A etiqueta já fica desligada na tela de pagamento, para
  não disputar o NFC com o cartão do cliente.

## Fase 4: operação

- **APK:**
  - dois apps do mesmo código (feito na issue #36): `io.github.kaualimadesouza.topa` (app do
    cliente, que abre direto em pedidos pelo celular, sem gesto de troca e sem HCE) e
    `io.github.kaualimadesouza.topa.loja` (app da loja, com o totem e o painel alternáveis por
    gesto de 5 toques ou botão no painel, e emulação de tag NFC via HCE);
  - `versionCode` dinâmico (feito na issue #36): calculado no Gradle a partir do semver
    (`major * 100000 + minor * 1000 + patch`), garantindo valor estritamente crescente > 1;
  - uma keystore fixa guardada como secret. Hoje cada build do CI assina com uma chave de debug
    nova, e o Android recusa instalar um APK por cima de outro assinado com chave diferente;
  - build de release em vez de debug. O debug usa o id `...topa.debug`, então o de release se
    instala ao lado dele, não por cima;
  - distribuição pela Play Store ou por instalação gerenciada;
  - modo quiosque, para o cliente não sair do app no totem. Até lá, a fixação de app do
    próprio Android resolve na demonstração.
- **Deploy automático:**
  - os secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` no repo. Sem eles o job de
    deploy do `web.yml` é pulado e a produção sai à mão pela Vercel CLI;
  - o secret `RP_TOKEN`, para o PR de release rodar o CI antes do merge.
- **Monitoramento:** logs, rastreamento de erros e alerta de queda no `/health/ready`.
- **Backup** do banco.

## Depois: o que o pitch e a proposta prometem e ainda não começou

- **Fiscal e ERP:** a proposta (seção III de `docs/situacoes_EI_2026.pdf`) aponta a integração
  com os sistemas de gestão das lojas e a unificação fiscal como o principal risco técnico.
  Antes da primeira venda real, é preciso decidir com a loja como cada venda do totem entra no
  fiscal dela (a emissão da NFC-e).
- **Recomendação por visão computacional:** as sugestões de hoje são regras fixas (fase 1,
  item 5).

### Vender sem internet

O pitch promete continuidade de venda, e o README lista a operação offline como diferencial. Este
é o desenho que o grupo propõe para isso. Hoje o app publicado depende da API para tudo; só o
modo demonstração, que não usa servidor, funciona sem internet.

1. **O totem trabalha sempre sobre uma cópia local** do cardápio, dos preços e dos esgotados, com
   ou sem internet. A sincronização com o servidor roda por trás, então a queda da internet não
   muda nada para quem pede.
2. **Os pedidos entram numa fila local** no aparelho, e a sincronização os envia ao servidor. Sem
   internet, eles esperam na fila até a conexão voltar.
3. **A loja se comunica pela rede interna** (o *edge*). O totem e o painel do lojista, ou a tela
   da cozinha, conversam direto pelo roteador da loja, sem passar pela nuvem. Se a internet cai e
   o roteador continua ligado, o pedido chega à cozinha do mesmo jeito.
4. **O painel também sincroniza com o servidor.** Com internet, ele faz o login do lojista,
   recebe os pedidos feitos pelo celular e envia as mudanças de cardápio e de esgotados. Sem
   internet, essas mudanças esperam a conexão voltar. Fora da loja, o painel fala só com o
   servidor.
5. **Numeração dos pedidos sem repetir.** Cada totem numera com um prefixo próprio (A01, A02 num
   totem; B01, B02 no outro), sempre, e não só sem internet, para a cozinha não ver duas
   numerações no mesmo dia. Hoje a API numera os pedidos do dia a partir de 001.
6. **Pagamento**, a parte difícil:
   - a saída mais segura é um chip 4G de reserva no aparelho, que combina com o modelo de
     aluguel (HaaS): se a internet da loja cai, o totem continua conectado pelo 4G, com cartão,
     Pix e sincronização;
   - sem nenhuma conexão, o cartão por aproximação só funciona se a credenciadora permitir
     transação offline, normalmente com limite de valor. É preciso confirmar com ela, porque o
     Tap on Phone costuma exigir autorização online;
   - o Pix precisa de internet para confirmar o pagamento, então o totem o esconde até a conexão
     voltar.
7. **Celular do cliente:** usa a internet do próprio cliente e alcança o servidor, mas a loja só
   recebe o pedido quando voltar a ter internet. Esconder "Peça pelo celular" no totem não basta:
   o adesivo NFC continua na loja, e quem já abriu o cardápio segue pedindo. Por isso o servidor
   recusa pedidos pelo celular de uma loja cujo totem parou de sincronizar.

## Antes do primeiro piloto numa loja

1. A fase 1 inteira.
2. Da fase 4: o APK assinado com a keystore fixa, o modo quiosque, o monitoramento e o backup.
   Um piloto já guarda pedidos reais.
3. A decisão fiscal com a loja do piloto.

A fase 3 começa já pela escolha da credenciadora, que leva mais tempo que o código. A fase 2 só
é necessária quando entrar a segunda loja. Cada fase vira issues no board (projeto 5) quando
começar, no formato de `.claude/skills/card-workflow`.
