<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/topa-logo-dark.png">
    <img src="assets/topa-logo.png" alt="TOPA, Totem por Assinatura" width="260">
  </picture>
</p>

# TOPA: Totem por Assinatura

Trabalho semestral do grupo T94 em **ACH2008 - Empreendedorismo em Informática** (EACH/USP),
Prof. Luciano Vieira de Araújo, 2º semestre de 2026.

## O produto

Autoatendimento para pequenos e médios estabelecimentos de alimentação e comércio de proximidade,
entregue como serviço mensal (*Hardware-as-a-Service*), sem investimento inicial para o lojista. Roda em
tablet na vertical ou smartphone com *Tap on Phone*: Pix e cartão por aproximação no próprio aparelho,
sem maquininha externa. O pedido vai direto para a produção.

Diferenciais:

- **Recomendação por visão computacional**, que reordena a oferta conforme o contexto do cliente para
  aumentar o ticket médio.
- **Transbordo de fila** por QR Code ou NFC: no pico, o cardápio abre no celular do cliente, sem baixar
  aplicativo.
- **Operação offline** com *edge computing*, aceitando pagamentos mesmo quando a internet da loja cai.

## Entregas

| Entrega | Onde está |
| --- | --- |
| Cenários de mercado que favorecem ou desfavorecem o trabalho | [`docs/situacoes_EI_2026.pdf`](docs/situacoes_EI_2026.pdf) |
| Pitch | [`docs/Logo - Startup TOPA.pdf`](docs/Logo%20-%20Startup%20TOPA.pdf) |
| Entrevistas de validação do protótipo (em andamento) | [`entrevistas-prototipo/`](entrevistas-prototipo/) |

As tarefas do grupo estão no [GitHub Project](https://github.com/users/kaualimadesouza/projects/5).

## MVP

O MVP do totem fica em [`topa/`](topa/): [`topa/web/`](topa/web/) (Vite, React, TypeScript e
Tailwind) e [`topa/api/`](topa/api/) (FastAPI e Postgres). Os dois seguem arquitetura hexagonal. Para subir tudo na sua
máquina (precisa de Docker):

```bash
cd topa
make run    # postgres + api + web; o totem abre em http://localhost:5180
make test   # testes do web e da api
make lint
```

`make test` e `make lint` rodam direto na sua máquina (no Docker, só o Postgres dos testes da API):
precisam do Node 24 (em Node mais antigo, instale as dependências do front com `npx -y npm@11 ci`
dentro de `topa/web`) e do [uv](https://docs.astral.sh/uv/) para a API.

O front encontra a API por `VITE_API_URL`: na sua máquina é `/api`, repassado pelo servidor do Vite;
publicado, é o endereço completo da API, que libera CORS só para o site e para o app. Sem essa
variável, o front abre em modo demonstração.

Na nuvem, o front ainda está publicado em modo demonstração em
[topa-totem.vercel.app](https://topa-totem.vercel.app). A API sobe para a AWS a cada push na `main`
que mexa nela ([`topa/api/infrastructure/README.md`](topa/api/infrastructure/README.md)).

## Arquitetura final

Como o sistema fica no fim, depois de todas as fases e apostas, do usuário até o banco de dados.
O caminho até lá, fase por fase, está em [`docs/caminho-para-producao.md`](docs/caminho-para-producao.md).

```mermaid
%%{init: {"htmlLabels": false, "flowchart": {"htmlLabels": false}}}%%
flowchart TB
    %% SVG labels on purpose: GitHub clips the default HTML labels
    lojista(["Lojista"])
    cliente(["Cliente"])

    subgraph loja["Na loja"]
        painel["Painel do lojista<br/>pedidos e cardápio"]
        totem["Totem<br/>pedido, pagamento,<br/>recomendação<br/>e cópia local"]
    end

    celular["Celular do cliente<br/>navegador ou app"]

    servidor["Servidor TOPA<br/>cardápio, pedidos<br/>e pagamentos"]
    banco["Banco de dados"]

    pagamentos["Pagamentos<br/>cartão e Pix"]

    lojista --> painel
    cliente -- "pede no totem" --> totem
    cliente -- "fila grande" --> celular
    totem -. "link da loja por<br/>NFC ou QR Code" .-> celular

    painel <-- "direto, sem internet" --> totem
    painel <-- "sincroniza quando<br/>há internet" --> servidor
    totem <-- "sincroniza quando<br/>há internet" --> servidor
    celular -- "internet do celular" --> servidor
    servidor --> banco

    servidor -- "Pix" --> pagamentos
    totem -- "cartão" --> pagamentos
```

Sem internet, a loja continua vendendo: o totem e o painel trabalham sobre uma cópia local e
sincronizam com o servidor quando a conexão volta. O desenho está em
[Vender sem internet](docs/caminho-para-producao.md#vender-sem-internet).

## Como compilar os documentos

Os documentos são escritos em LaTeX e compilados com `pdflatex` (TeX Live). Rode duas vezes para
resolver as referências cruzadas:

```bash
cd entrevistas-prototipo
pdflatex entrevistas_EI_2026.tex
pdflatex entrevistas_EI_2026.tex
```

Todo documento novo parte do modelo em [`docs/situacoes_EI_2026.tex`](docs/situacoes_EI_2026.tex):
mesmo preâmbulo, cabeçalho e bloco de integrantes; mudam só o título e o conteúdo.

## Integrantes

- Kauã Lima de Souza
- Kevin Rodrigues Nunes
- Luiz Felipe Couto de Souza
- Renan Biruel Uema
- Victor Yodono
