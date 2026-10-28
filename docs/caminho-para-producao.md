# Caminho para produção

O que falta para o TOPA sair do modo demonstração e atender uma loja de verdade, dividido em
fases. Estado de 28/10/2026.

Todo build de produção usa a API publicada na AWS: o site `topa-totem.vercel.app` e o DEV, o
APK e os instaladores da release. Quem decide é `topa/web/src/composition.ts`: com `VITE_API_URL`
no build (o de produção a lê de `topa/web/.env.production`), o app usa a API; sem ela, usa o
cardápio embutido (`topa/web/src/domain/demo-catalog.ts`) e guarda pedidos e esgotados no
`localStorage` de cada aparelho, sem sincronizar. Esse é o **modo demonstração**, que segue no
`npm run dev` e no preview de cada PR, cujo endereço fica fora do CORS da API.

## Fase 1: uma loja de verdade

Objetivo: a Lanchonete Bem-te-vi com dados num servidor, e totem, celular, site e painel vendo
os mesmos pedidos e esgotados. A issue #32 já cobre parte desta fase (itens 1 e 2) junto com
a fase 2.

1. **Publicar a API e o banco.** Feito: a API roda na AWS Lambda (imagem
   `topa/api/Dockerfile.lambda`), atrás de um API Gateway, com o Postgres no Neon, no mesmo
   molde do kbjmodas-api. O deploy (`.github/workflows/api-deploy.yml`) roda
   `alembic upgrade head` antes de cada versão. Falta monitorar pelo `/health/ready`, que já
   existe.
2. **Ligar o site e o app à API.** Feito: o build de produção lê o endereço da API de
   `topa/web/.env.production`, e a API libera CORS para o site (PROD e DEV) e para as origens do
   app (`http://tauri.localhost` no Android e no Windows, `tauri://localhost` no macOS e no
   Linux), em `topa/api/infrastructure/main.tf`. Há um ambiente só: o DEV grava no mesmo banco
   que o PROD.
3. **Partida a frio.** A primeira requisição depois de um tempo parado leva alguns segundos,
   e a pílula de status do servidor desiste em 3 s (`topa/web/src/adapters/http/http-connection.ts`).
   Um agendamento que chama a API a cada poucos minutos a mantém quente.
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
  - dois apps do mesmo código (issue #36): o da loja, com o totem e o painel atrás do login do
    lojista, e o do cliente, que só lê o totem e pede. Hoje um APK só abre como cliente, e 5
    toques rápidos na marca TOPA transformam o celular em totem;
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
