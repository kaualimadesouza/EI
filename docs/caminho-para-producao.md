# Caminho para produção

O que falta para o TOPA sair do modo demonstração e atender uma loja de verdade, dividido em
fases. Estado de 28/10/2026, versão `topa 0.1.1`.

Hoje todo build publicado roda em **modo demonstração**: o APK, os instaladores da release e o
site `topa-totem.vercel.app`. Quem decide é `topa/web/src/composition.ts`: com `VITE_API_URL`
no build, o app usa a API; sem ela, usa o cardápio embutido (`topa/web/src/domain/demo-catalog.ts`)
e guarda pedidos e esgotados no `localStorage` de cada aparelho, sem sincronizar. Só o
`make run` local liga a web à API.

## Fase 1: uma loja de verdade

Objetivo: a Lanchonete Bem-te-vi com dados num servidor, e totem, celular, site e painel vendo
os mesmos pedidos e esgotados. A issue #32 já cobre parte desta fase (itens 1 a 3) junto com
a fase 2.

1. **Publicar a API e o banco.** A API roda só na máquina local, e o `topa/api/Dockerfile` é
   uma imagem de desenvolvimento (`uvicorn --reload`), não de produção. Falta:
   - uma imagem de produção da API;
   - um servidor para ela e um Postgres gerenciado (a escolha do provedor está em aberto);
   - rodar `alembic upgrade head` a cada deploy, com `TOPA_DATABASE_URL` como secret;
   - monitorar pelo `/health/ready`, que já existe.
2. **Ligar o site à API.** Um rewrite na Vercel de `/api/*` para a API, tirando o prefixo
   `/api` (as rotas da API ficam na raiz, como mostra o proxy em `topa/web/vite.config.ts`).
   Ele precisa vir antes do rewrite que manda tudo para `index.html` em
   `topa/web/vercel.json`: hoje `/api/health` responde 200 com a página do app, e o app
   acharia que a API está no ar. `VITE_API_URL=/api` entra nas variáveis do projeto na Vercel.
   Como o site e a API ficam na mesma origem, a API continua sem precisar de CORS.
3. **Ligar o app à API.** As telas do app rodam em outra origem (`http://tauri.localhost` no
   Android e no Windows, `tauri://localhost` no macOS e no Linux), e a API não envia cabeçalhos
   de CORS. Duas saídas: a API libera CORS só para essas origens, ou o app faz as chamadas pelo
   plugin HTTP do Tauri. O build do APK recebe `VITE_API_URL` com o endereço completo da API.
4. **Autenticação.** A API não tem login. Quem souber o endereço:
   - marca produto esgotado (`PATCH /products/{id}`);
   - muda o status de um pedido (`PATCH /orders/{id}`);
   - lê todos os pedidos do dia com os totais, ou seja, o faturamento (`GET /orders`).

   O mínimo é um login do lojista exigido nessas três rotas, e `POST /orders` anônimo com
   limite de requisições. O login guarda dado pessoal do lojista, então a LGPD já entra aqui:
   política de privacidade e base legal.
5. **Cardápio real.** O cardápio de hoje é o de demonstração, gravado pela primeira migration
   (`topa/api/migrations/versions/20261026_36d9f509b9ec_products_and_orders.py`). Para o
   lojista cadastrar o dele, falta:
   - rotas para criar e editar produtos (hoje a API só muda a disponibilidade);
   - onde guardar as fotos: hoje são arquivos fixos do app (`topa/web/public/photos/<id>.jpg`,
     via `topa/web/src/ui/kiosk/photo.ts`), e o banco não tem coluna de foto;
   - categorias editáveis: hoje são uma lista fixa (`Category` em
     `topa/api/src/topa_api/domain/catalog.py`, com uma restrição no banco);
   - sugestões configuráveis: as regras de `topa/web/src/domain/suggest.ts` citam produtos do
     cardápio de demonstração pelo id, e um texto depende dos preços dele ("Sai R$ 1,90 mais
     barato que separado").

Pronto quando: um pedido feito no celular aparece no painel de outro aparelho; um esgotado
marcado no painel aparece esgotado no celular; o lojista cadastra um produto e ele aparece no
totem; e, sem login, ninguém altera o cardápio nem lê os pedidos.

## Fase 2: várias lojas

A issue #32 cobre o cardápio por loja e os ajustes do celular.

- **Banco:** uma tabela de lojas. Produtos, pedidos e a numeração diária dos pedidos passam a
  pertencer a uma loja.
- **API:** rotas por loja (a issue #32 propõe `GET /menu?loja=<slug>`) e pedidos gravados com a
  loja.
- **Totem:** configurado com a sua loja no primeiro uso, com um token que o vincula a ela.
  Anuncia no NFC e no QR o próprio endereço e identificador. Hoje os dois são fixos em
  `topa/web/src/domain/store.ts` (`PUBLIC_ORIGIN` e `DEMO_STORE_SLUG`).
- **Celular:** carrega o cardápio da loja lida e acompanha o status do pedido. Na loja aberta
  no celular, a tela de pagamento deixa de mandar encostar o cartão no totem, e a pílula de
  status do servidor e o reinício por inatividade do totem somem.
- **Painel:** cada lojista vê só a sua loja.

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
  - uma keystore fixa guardada como secret. Hoje cada build do CI assina com uma chave de debug
    nova, e o Android recusa instalar um APK por cima de outro assinado com chave diferente;
  - build de release em vez de debug. O debug usa o id `...topa.debug`, então o de release se
    instala ao lado dele, não por cima;
  - `versionCode` subindo a cada versão: hoje está fixo em 1 no `tauri.conf.json`, e o
    `topa/web/README.md` já diz para tirar essa trava depois da primeira release;
  - distribuição pela Play Store ou por instalação gerenciada;
  - modo quiosque, para o cliente não sair do app no totem. Até lá, a fixação de app do
    próprio Android resolve na demonstração.
- **Deploy automático:**
  - os secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` no repo. Sem eles o job de
    deploy do `web.yml` é pulado e a produção sai à mão pela Vercel CLI;
  - o secret `RP_TOKEN`, para o PR de release rodar o CI antes do merge;
  - o deploy da API a cada release.
- **Monitoramento:** logs, rastreamento de erros e alerta de queda no `/health/ready`.
- **Backup** do banco.

## Depois: o que o pitch e a proposta prometem e ainda não começou

- **Fiscal e ERP:** a proposta (seção III de `docs/situacoes_EI_2026.pdf`) aponta a integração
  com os sistemas de gestão das lojas e a unificação fiscal como o principal risco técnico.
  Antes da primeira venda real, é preciso decidir com a loja como cada venda do totem entra no
  fiscal dela (a emissão da NFC-e).
- **Vender sem internet (edge computing):** o totem guarda os pedidos e sincroniza quando a
  conexão volta. Exige uma numeração de pedidos que não colida entre aparelhos offline.
- **Recomendação por visão computacional:** as sugestões de hoje são regras fixas (fase 1,
  item 5).

## Antes do primeiro piloto numa loja

1. A fase 1 inteira.
2. Da fase 4: o APK assinado com a keystore fixa, o modo quiosque, o monitoramento e o backup.
   Um piloto já guarda pedidos reais.
3. A decisão fiscal com a loja do piloto.

A fase 3 começa já pela escolha da credenciadora, que leva mais tempo que o código. A fase 2 só
é necessária quando entrar a segunda loja. Cada fase vira issues no board (projeto 5) quando
começar, no formato de `.claude/skills/card-workflow`.
