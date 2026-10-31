# Diagrama entidade-relacionamento (DER) do banco

O esquema do Postgres da API. A fonte da verdade é o código: os modelos em
`topa/api/src/topa_api/adapters/db/models.py` e as migrations em `topa/api/migrations/versions/`;
se este desenho divergir deles, vale o código. O teste de migrations (`alembic check`) não
compara as restrições `CHECK`: mudar `Category`, `OrderStatus` ou `PaymentMethod` pede uma
migration escrita à mão, como a `7db80bf0a5ff`.

```mermaid
%%{init: {"htmlLabels": false}}%%
%% htmlLabels off: labels render as SVG text, not HTML boxes that can clip
erDiagram
    stores ||--o{ products : "vende"
    stores ||--o{ orders : "recebe"
    stores ||--o{ merchants : "possui"
    customers ||--o{ orders : "realiza"
    products ||--o{ order_items : "aparece em"
    orders ||--o{ order_items : "contém"

    stores {
        text slug PK "identificador, como lanchonete-bem-te-vi"
        text name
    }

    merchants {
        uuid id PK "gerado pela API"
        text email UK "e-mail de acesso do lojista"
        text password_hash "hash scrypt com salt"
        text store_slug FK "loja vinculada"
        timestamptz created_at
    }

    customers {
        uuid id PK "gerado pela API"
        text name "nome do cliente"
        text email UK "e-mail de acesso do cliente"
        text password_hash "hash scrypt com salt"
        timestamptz created_at
    }

    products {
        text store_slug PK, FK, UK "par único com position"
        text id PK "slug, como xsalada"
        integer position UK "ordem no cardápio da loja"
        text name
        text description
        text category "categoria textual configurável (ex: combos, lanches, bebidas)"
        integer price_cents "preço em centavos, 0 ou mais"
        text photo_url "URL opcional da foto do produto (nullable)"
        boolean available "false quando esgotado"
    }

    orders {
        uuid id PK, UK "gerado pela API; par único com store_slug"
        text store_slug FK, UK "loja do pedido"
        date business_date UK "único na loja com number"
        integer number UK "único na loja com business_date"
        text status "received, preparing, ready ou delivered"
        boolean dine_in "true para comer no local"
        text payment_method "card ou pix"
        integer total_cents "total cobrado, gravado no pedido"
        timestamptz created_at
        uuid customer_id FK "cliente autenticado (nullable)"
        uuid client_order_id UK "chave de idempotencia gerada pelo cliente (nullable)"
    }

    order_items {
        uuid order_id PK, FK
        text store_slug FK "mesma loja do pedido e do produto"
        text product_id PK, FK
        integer quantity "1 ou mais"
        integer unit_price_cents "preço pago, 0 ou mais"
    }
```

## O que o desenho não mostra

- Quase todas as colunas são `NOT NULL`, exceto `photo_url` em `products` que é opcional (`nullable`).
  O banco recusa, por `CHECK`, `status` e `payment_method` fora das listas acima, `price_cents` e
  `unit_price_cents` negativos e `quantity` menor que 1. A restrição `CHECK` de `category` foi
  removida na migration `20261029_f6a7b8c9d0e1` para permitir categorias dinâmicas criadas pelo lojista.
  `total_cents` não tem `CHECK`.
- `store_slug` tem valor padrão `'lanchonete-bem-te-vi'` em `products`, `orders` e `order_items`
  para manter compatibilidade com a versão anterior (v0.1.3) da Lambda durante o rolling deploy;
  quando o cadastro de novas lojas for implementado, o `server_default` será retirado por migration.
- `orders` declara `(id, store_slug)` como par único para que `order_items` referencie tanto
  `(order_id, store_slug)` quanto `(store_slug, product_id)` por chave estrangeira composta,
  impedindo no banco que um pedido aponte para produto de outra loja.
- Quando `photo_url` estiver preenchida, o frontend utiliza essa URL direta para a imagem do produto.
  Caso contrário, utiliza como fallback local o padrão `topa/web/public/photos/<id>.jpg`.
- `position` dá a ordem do cardápio de cada loja e também a dos itens que a API devolve em cada
  pedido; a ordem em que o cliente tocou nos produtos não é guardada.
- `business_date` é a data de `created_at` em São Paulo, e `number`, o número que o cliente vê,
  recomeça em 1 a cada `business_date` em cada loja.
- `unit_price_cents` é uma cópia do preço na hora da compra: mudar o preço do produto não altera
  pedidos antigos.
- Como a chave de `order_items` é o par (`order_id`, `product_id`), a API junta as repetições
  de um produto num item só, somando a `quantity`.
- Apagar um pedido apaga os itens (`ON DELETE CASCADE`); apagar um produto que já foi pedido ou
  uma loja que já possui produtos ou pedidos vinculados é recusado pelo banco.
- A tabela `merchants` guarda as contas de acesso dos lojistas ao painel administrativo. O hash da senha
  utiliza scrypt com salt aleatório (`scrypt$N$r$p$salt$hash`). O e-mail é único no sistema e vinculado
  por chave estrangeira à loja correspondente.
- A tabela `customers` guarda as contas dos clientes finais para acesso via navegador e histórico de pedidos.
  O hash da senha utiliza scrypt com salt aleatório. O e-mail é único no sistema. Na tabela `orders`,
  a coluna `customer_id` é opcional (`nullable`), permitindo pedidos anônimos via totem e QR code, bem como
  pedidos vinculados à conta do cliente no navegador.
- Não há estado de pagamento: o pagamento ainda é simulado, e o app grava o pedido ao pagar.
- O Alembic mantém também a tabela `alembic_version`, com a revisão aplicada.

Só a API, e não o banco, impõe estas regras (detalhes em
[`topa/api/README.md`](../topa/api/README.md)):

- recusa pedido sem itens e produto esgotado;
- limita as unidades de cada produto por pedido;
- tira o preço do cardápio, nunca do corpo da requisição;
- move o status um passo por vez, para a frente ou para trás.

O que muda no esquema nas próximas fases está em
[`caminho-para-producao.md`](caminho-para-producao.md).
