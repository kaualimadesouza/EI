# Entrevistas de validação do protótipo

ACH2008 - Empreendedorismo em Informática, Prof. Luciano Vieira de Araújo, turma T94.
Produto: **TOPA (Totem por Assinatura)**, contexto em `../docs/`.

## A tarefa

Passada em aula em 21/09/2026:

- Cada integrante, **individualmente**, entrevista **15 pessoas** mostrando o protótipo de telas
  (5 integrantes, 75 entrevistas no total).
- Entrevistar o **usuário final**, quem faz o pedido, mesmo que o nosso cliente seja o restaurante ou
  o mercado.
- Roteiro do Victor, aprovado no grupo em 28/09: 3 telas, 3 perguntas por tela, cerca de 5 minutos por
  pessoa. Mostrar uma tela por vez e fazer as perguntas antes de avançar.
- Respostas em `respostas/respostas-entrevistas.xlsx` (dá para subir no Google Drive e preencher em
  conjunto). Sem nome, telefone ou e-mail do entrevistado: o repositório é público.
- Prazo de entrega: **a definir**.

## Estrutura

| Caminho | O que é |
| --- | --- |
| `entrevistas_EI_2026.tex` / `.pdf` | Documento no modelo LaTeX do grupo: produto, método, hipóteses por tela, roteiro e análise |
| `telas/` | Capturas completas do protótipo, com as perguntas ao lado (para usar na entrevista) |
| `figuras/` | Recortes das telas e o logo, usados no PDF |
| `respostas/respostas-entrevistas.xlsx` | Instruções, uma linha por entrevista (15 por integrante) e um resumo calculado por fórmulas |

Recompilar: `pdflatex entrevistas_EI_2026.tex` duas vezes (a segunda resolve as referências).

## Pendências

- [ ] Confirmar o prazo e o formato de entrega
- [ ] Trocar os recortes em `figuras/` se o Victor gerar as telas maiores
- [ ] Fazer as entrevistas e preencher a planilha
- [ ] Depois das 75 entrevistas, escrever a seção de resultados no documento
