---
name: portuguese-copy
description: Write correct, short pt-BR for the TOPA kiosk and the merchant dashboard - full accentuation, crase, sentence case, imperative CTAs and prices as "R$ 12,90". Use when writing or editing UI copy, button labels, empty states, error messages, order statuses, seed product names, or any Portuguese prose.
---

# Portuguese copy

Two readers. The **cliente** stands at the kiosk, maybe with a queue behind
them, reading at arm's length: one idea per screen, a few words per line. The
**lojista** glances at `/painel` between orders: labels must be scannable.
Every string either of them reads is orthographically correct pt-BR (Acordo
Ortográfico de 1990): diacritics, crase and hyphens included. A kiosk that says
`"Voce nao tem itens"` looks broken, and a broken-looking kiosk does not get
paid.

## Voice and form

- **CTAs are short commands, verb first**, one to three words: "Adicionar",
  "Ver sacola", "Finalizar pedido", "Pagar com Pix". Instructions use the
  imperative: "Toque para começar", "Aproxime o cartão ou o celular",
  "Escaneie o QR Code com a câmera".
- **Sentence case** everywhere: "Finalizar pedido", "Ticket médio", never
  "Finalizar Pedido". No uppercase in source. Proper nouns keep their
  capitals: TOPA, Pix (never PIX), QR Code.
- Talk to the customer as "você", or drop the pronoun. No jargon on the kiosk:
  "sugestão", not "upsell"; "pagamento", not "checkout".
- Errors say what happened and what to do next, never a code:
  "Não foi possível concluir o pagamento. Tente de novo ou chame um atendente."

## Numbers

- **Prices: "R$ 12,90"**, "R$ 1.234,50": comma for decimals, dot for
  thousands, a space after `R$`. Always through one formatter
  (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`),
  never string concatenation. It emits a non-breaking space, which
  Testing Library's default normalizer matches as a plain space.
- Times "14h30", dates "26/10/2026". Prices, totals and order numbers use
  `tabular-nums`.

## Where it does NOT apply

Identifiers stay ASCII and unaccented: route paths (`/painel`; a menu route
would be `/cardapio`, never `/cardápio`),
enum values on the wire (`recebido`, `preparando`, `pronto`, `entregue`),
slugs, SKUs, test ids, file and branch names, code and comments (English). The
accented form belongs in the label, not in the key.

## Traps for a food kiosk

> você, não, é, já, só, até, também, então, cardápio, sugestão, sugestões,
> opção, opções, observação, porção, pão, pães, limão, maçã, açaí, café,
> sanduíche, hambúrguer, açúcar, água, médio, número, preço, crédito, débito,
> cartão, aproximação, confirmação, conexão, código, disponível,
> indisponível, horário, métricas, último, câmera, atenção, promoção, início

- **crase**: "Adicionar **à** sacola", "Voltar **à** tela inicial",
  "**às** 14h". But "Voltar ao início" (masculine, no crase).
- **hyphen in enclisis**: "adicioná-lo", "retire-o no balcão", never
  `adiciona-lo`.

## Check before committing

From the repo root, grep the strings you touched:

```bash
grep -rnE --include='*.ts' --include='*.tsx' --include='*.py' \
  '\b(voce|nao|tambem|entao|ate|cardapio|sugestao|sugestoes|opcao|opcoes|observacao|porcao|pao|paes|limao|maca|acai|cafe|sanduiche|hamburguer|acucar|agua|medio|numero|preco|precos|credito|debito|cartao|aproximacao|confirmacao|conexao|codigo|disponivel|indisponivel|horario|metricas|ultimo|camera|atencao|promocao|inicio)\b' \
  topa/web/src topa/api/src topa/api/tests
```

Hits in route paths, enum values or English comments are fine. Hits inside a
Portuguese string are bugs. Product names in seeds are copy too: fix them in
the seed, and once a database holds them, with a data migration.
