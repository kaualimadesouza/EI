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
