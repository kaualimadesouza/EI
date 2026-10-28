# Caminho para produção

O que falta para o TOPA sair do modo demonstração e atender uma loja de verdade, dividido em
fases. Estado de 28/10/2026, versão `topa 0.1.1`.

## Onde estamos

Todos os builds rodam em **modo demonstração**: o APK, os instaladores da release e o site
`topa-totem.vercel.app`. Quem decide o modo é `topa/web/src/composition.ts`: com `VITE_API_URL`
no build, o app usa a API; sem ela, usa dados embutidos. Nenhum build recebe essa variável.

| Peça | Estado hoje |
|---|---|
| Telas (totem, celular, painel) | Prontas. O mesmo código React vai dentro do app (Tauri) e no site |
| Dados | Cardápio embutido no app (`src/domain/demo-catalog.ts`); pedidos e esgotados ficam no `localStorage` de cada aparelho, sem sincronizar |
| API | FastAPI + Postgres com cardápio, esgotados, pedidos e status (`topa/api/README.md`). Roda só na máquina local, com `make run` |
| NFC | O totem Android responde como etiqueta NFC com o link da loja. O identificador da loja é fixo no código (`DEMO_STORE_SLUG` em `src/domain/store.ts`) |
| Pagamento | Simulado: o QR do Pix é `TOPA-PIX-DEMO-…` e o cartão por aproximação não cobra nada |
| Sugestões | Regras fixas por horário e pelo carrinho (`src/domain/suggest.ts`) |
| Deploy | A release do GitHub anexa os instaladores e o APK. O site de produção é publicado à mão pela Vercel CLI |

## Fase 1: uma loja de verdade

Objetivo: a Lanchonete Bem-te-vi com dados num servidor, e totem, celular, site e painel vendo
os mesmos pedidos e esgotados.

1. **Publicar a API e o banco.** Um servidor para a API e um Postgres gerenciado (a escolha do
   provedor está em aberto). O deploy roda `alembic upgrade head`, `TOPA_DATABASE_URL` vira
   secret e o `/health/ready`, que já existe, serve para monitorar.
2. **Ligar o site à API.** Um rewrite na Vercel de `/api/*` para a API e `VITE_API_URL=/api` no
   build. O site e a API ficam na mesma origem, então a API continua sem precisar de CORS.
3. **Ligar o app à API.** As telas do app rodam em outra origem (`http://tauri.localhost` no
   Android e no Windows, `tauri://localhost` no macOS e no Linux), e hoje a API não envia
   cabeçalhos de CORS. Duas saídas: a API libera CORS só para essas origens, ou o app faz as
   chamadas pelo plugin HTTP do Tauri. O build do APK recebe `VITE_API_URL` com o endereço
   completo da API.
4. **Autenticação.** A API não tem login: quem souber o endereço marca produto esgotado
   (`PATCH /products/{id}`) ou muda o status de um pedido (`PATCH /orders/{id}`). O mínimo:
   - login do lojista no painel, exigido nessas duas rotas;
   - um token por totem;
   - `POST /orders` anônimo, com limite de requisições.
5. **Cardápio real.** O cardápio de hoje é o de demonstração, gravado pela primeira migration
   (`topa/api/migrations/versions/20261026_36d9f509b9ec_products_and_orders.py`). Falta o
   lojista cadastrar o dele no painel: produto, preço, foto e categoria. As regras de sugestão
   apontam para produtos do cardápio de demonstração (`SUGGESTION_RULES`) e precisam virar dado
   configurável.

Pronto quando: um pedido feito no celular aparece no painel de outro aparelho, um esgotado
marcado no painel aparece esgotado no celular, e ninguém sem login altera o cardápio.

## Fase 2: várias lojas

Coberta em parte pela issue #32.

- **Banco:** uma tabela de lojas. Produtos, pedidos e a numeração diária dos pedidos passam a
  pertencer a uma loja.
- **API:** rotas por loja (o #32 propõe `GET /menu?loja=<slug>`) e pedidos gravados com a loja.
- **Totem:** configurado com a sua loja no primeiro uso. Ele anuncia o próprio identificador no
  NFC e no QR, e o `DEMO_STORE_SLUG` sai do código.
- **Celular:** carrega o cardápio da loja lida, acompanha o status do pedido e mostra textos de
  pagamento próprios do celular (hoje ele reaproveita os do totem).
- **Painel:** cada lojista vê só a sua loja.

## Fase 3: pagamento de verdade

É a fase mais longa, porque depende de contrato e não só de código. Antes de programar, é
preciso escolher a credenciadora (Stone, PagBank, Mercado Pago, Cielo ou outra), comparando
taxas, contrato e o SDK para Android.

- **Pix:** o provedor gera um QR dinâmico por pedido e avisa a API por webhook quando o
  pagamento cai. O pedido só entra na fila depois de pago. Falta também o fluxo de cancelamento
  e de estorno.
- **Cartão por aproximação (Tap on Phone):** só existe com o SDK da credenciadora, que cuida do
  credenciamento e da certificação de segurança de cartão (PCI). O código de etiqueta NFC do
  TOPA não serve para aceitar cartão. A etiqueta já fica desligada na tela de pagamento, para
  não disputar o NFC com o cartão do cliente.

## Fase 4: operação

- **APK:**
  - uma keystore fixa guardada como secret. Hoje cada build do CI assina com uma chave nova, e
    o Android recusa instalar um APK por cima de outro assinado com chave diferente;
  - build de release em vez de debug;
  - `versionCode` subindo a cada versão (hoje fixo em 1 no `tauri.conf.json`);
  - distribuição pela Play Store ou por instalação gerenciada;
  - modo quiosque, para o cliente não sair do app no totem. Até lá, a fixação de app do
    próprio Android resolve na demonstração.
- **Deploy automático:**
  - os secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` no repo. Sem eles o job de
    deploy do `web.yml` é pulado;
  - o secret `RP_TOKEN`, para o PR de release rodar o CI antes do merge;
  - o deploy da API a cada release.
- **Monitoramento:** logs, rastreamento de erros e alerta de queda no `/health/ready`.
- **Backup** do banco.
- **LGPD:** política de privacidade se o app passar a coletar dados do cliente (nome,
  telefone). Hoje os pedidos são anônimos.

## Depois: apostas do pitch que ainda não começaram

- **Vender sem internet (edge computing):** o totem guarda os pedidos e sincroniza quando a
  conexão volta. Exige uma numeração de pedidos que não colida entre aparelhos offline.
- **Recomendação por visão computacional:** as sugestões de hoje são as regras fixas de
  `src/domain/suggest.ts`.

## Ordem sugerida

1. A fase 1 inteira, com uma loja só.
2. A fase 2.
3. Da fase 4, o APK assinado e o modo quiosque, antes de qualquer piloto numa loja.
4. A fase 3 corre em paralelo desde o começo, porque a escolha da credenciadora e o contrato
   levam mais tempo que o código.

Cada fase vira issues no board (projeto 5) quando começar, no formato do
`.claude/skills/card-workflow`.
