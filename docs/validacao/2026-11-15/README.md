# Validação do primeiro expediente do TOPA

Solicitação: avaliar a aplicação como um dono de restaurante tradicional sem
totem, corrigir impedimentos e comparar a experiência com sistemas do setor.
Card: [#81](https://github.com/kaualimadesouza/EI/issues/81).

## Método e resultado

Um agente iniciado sem o histórico recebeu somente a URL pública e a persona.
Primeiro navegou sem ler código ou documentação. Depois operou em um banco local
descartável, com lojista e cliente em contextos distintos do Chromium. A primeira
rodada foi preservada; o mesmo agente repetiu o percurso após as correções.

O [relatório da persona](dono-restaurante.md) contém os achados, o reteste e seis
capturas portáteis. Isso é uma simulação automatizada, não uma entrevista com
pessoas reais nem comprovação de aceitação comercial. Não ocorreram cadastros,
pedidos ou alterações de loja na produção durante a avaliação.

O reteste percorreu cadastro próprio, cardápio, abertura, pedido, confirmação
controlada de Pix, preparo, aviso de pronto, entrega, esgotamento e pausa no fim
do dia. Nenhum pagamento real foi efetuado. A confirmação do provedor foi uma
fixture local explicitamente separada da navegação do lojista.

## Problemas corrigidos

| Antes | Comportamento corrigido |
| --- | --- |
| Sem cadastro de lojista; cadastro de consumidor confundia o dono | Cadastro cria loja e proprietário em uma transação, com senha protegida e sessão persistente |
| Gestão não aparecia no menu móvel | Menu móvel oferece painel e criação de loja |
| Login sem loja podia apontar para a loja de exemplo | O painel usa a loja do proprietário autenticado; acesso explícito a outra loja continua recusado |
| Nenhuma orientação para começar | Loja nova inicia pausada; painel orienta primeiro produto, abertura e compartilhamento |
| `1.234,56` virava R$ 1,23 | Valores brasileiros são preservados; entradas incompletas ou ambíguas são recusadas |
| Pix pendente entrava na cozinha e no faturamento | Listagem operacional e mudança de status exigem pagamento confirmado no servidor |
| Código fictício quando pagamento não estava configurado | API recusa cobrança sem configuração; demonstração exige modo explícito; navegador aguarda cobrança real ou mostra erro |
| Cobrança tentava usar identificador de demonstração | A tela espera o pedido persistido e usa seu identificador e seu total calculado no servidor |
| Abrir totem levava à landing | `/totem?loja=...` abre o totem correto; QR/link apontam para a mesma loja |
| Não havia pausa de vendas | Estado persistente bloqueia novos pedidos na API; cliente novo vê loja fechada; pedidos anteriores podem ser concluídos |
| Ações e pedidos fora da vista no celular | Etapas empilhadas e linhas de produto adaptadas para manter nome, preço e ações próximos |
| Erro de rede em inglês e retorno ao cadastro após sair | Mensagens orientam nova tentativa; sair volta ao login, inclusive após restaurar a sessão |

## Referências e decisões

Pesquisa em fontes dos próprios produtos, em 15/11/2026. A comparação identifica
práticas úteis; não estabelece ranking de mercado nem prova impacto em conversão.

| Referência | Prática observada | Decisão para o TOPA |
| --- | --- | --- |
| [iFood: ferramentas](https://parceiros.ifood.com.br/restaurante/como-funciona/ferramentas) e [Gestor de Pedidos](https://blog-parceiros.ifood.com.br/gestor-de-pedidos-ifood/) | Pedidos, disponibilidade, status da loja e operação móvel | Tornar entrada, disponibilidade e pausa fáceis de encontrar |
| [Goomer: pausa](https://ajuda.goomer.com.br/goomergo/extras/como-desativar-meu-cardapio-para-as-ferias-e-festas-de-fim-de-ano) e [link público](https://ajuda.goomer.com.br/goomergo/painel/goomergo/sobre/meu-link-goomergo) | Controle de novos pedidos e compartilhamento por link/QR | Dar ao lojista link próprio e controle de abertura/pausa |
| [Consumer: primeiros passos](https://ajuda.programaconsumer.com.br/primeiros-passos-no-programa-consumer/) | Cadastro, cardápio, equipamento, operação e caixa | Guiar o início; separar resumo de vendas de fechamento contábil |
| [Saipos: restaurante](https://saipos.com/sistema/restaurante) | Visão operacional de pedidos e gestão financeira ampla | Manter preparo e resumo acessíveis; não prometer PDV/caixa completo |

Não foram adicionados delivery, estoque de ingredientes, ficha técnica, CMV,
folha de pagamento ou integração fiscal homologada apenas porque concorrentes
os oferecem. A escolha priorizou impedimentos demonstrados na jornada do TOPA.

## Como reproduzir

Requisitos: Docker, Node, uv e Chromium do Playwright. Nunca usar pip. Comandos
abaixo partem da raiz; use terminais separados para API e frontend. O banco tem
dados fictícios em memória e é removido quando o contêiner para.

```bash
docker run --detach --rm --name topa-validation-db \
  --publish 127.0.0.1:5446:5432 --tmpfs /var/lib/postgresql/data \
  --env POSTGRES_USER=topa --env POSTGRES_PASSWORD=topa \
  --env POSTGRES_DB=topa_validation postgres:16
```

Após o Postgres estar pronto:

```bash
TOPA_DATABASE_URL=postgresql+psycopg://topa:topa@127.0.0.1:5446/topa_validation \
  uv run --locked --project topa/api alembic -c topa/api/alembic.ini upgrade head
```

Inicie a API no primeiro terminal:

```bash
cd topa/api
TOPA_DATABASE_URL=postgresql+psycopg://topa:topa@127.0.0.1:5446/topa_validation \
  uv run --locked python -m scripts.validation_api
```

No segundo:

```bash
cd topa/web
VITE_API_URL=/api API_PROXY_TARGET=http://127.0.0.1:8022 \
  npm run dev -- --host 127.0.0.1 --port 5192 --strictPort
```

No terceiro, na raiz:

```bash
uv run --locked --project video playwright install chromium
uv run --locked --project video python topa/web/scripts/check-merchant-day.py
```

`TOPA_VIDEO_CHROMIUM` seleciona Chromium já instalado. JSON e capturas ficam em
`topa/web/.playwright-mcp/merchant-day/`, ignorados pelo Git. O script recusa hosts
públicos. A API de validação exige banco local `topa_validation`, escuta somente
em `127.0.0.1:8022` e não é o entrypoint de produção. Sua confirmação fictícia
existe apenas nesse processo local.

Remova os dados do ensaio ao terminar:

```bash
docker stop topa-validation-db
```

## Cobertura da jornada e limites

A automação percorre descoberta móvel, confirmação de senha, cadastro, recarga,
categoria própria, preços válidos/inválidos, quatro larguras de tela, abertura,
pagamento pendente, confirmação do provedor fictício, preparo, aviso ao cliente,
entrega, esgotamento/reposição, falha de rede, pausa, recusa no servidor,
isolamento entre lojas, cadastro duplicado e novo login. As suítes complementam
limites, falhas, autenticação, concorrência de cadastro, migração e contratos das
camadas. Isso não representa todos os testes possíveis.

Pendências que continuam exigindo trabalho e validação:

- Recuperação de senha, verificação de e-mail e canal de suporte operacional.
- Configuração e conciliação de recebimentos reais por estabelecimento. Criar
  conta não contrata plano nem habilita uma conta bancária. Pagamentos reais,
  estornos, vencimentos bancários e homologação de cartão não foram validados;
  cartão não é oferecido como cobrança real no navegador.
- Envio de foto por arquivo; o formulário atual aceita URL.
- Atalhos para reduzir rolagem na operação móvel com muitos pedidos.
- Impressão física, NFC/Android, leitor por aproximação, tecnologia assistiva e
  operação prolongada em hardware real.
- Volume, queda prolongada de rede, fechamento completo e passagem da meia-noite
  em fusos diferentes.
- Entrevistas presenciais com donos, atendentes, cozinha e clientes.

O resumo é operacional e usa pedidos confirmados pelo provedor; não equivale a
saldo bancário, lucro, conciliação, caixa fiscal ou garantia de repasse.
