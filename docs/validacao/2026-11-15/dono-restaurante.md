# Simulação de uso: dono de restaurante

Data: 15/11/2026. Persona: dono de restaurante tradicional brasileiro, acostumado a papel e WhatsApp, sem experiência com totem e querendo operar sozinho.

**Resultado mais recente:** no [reteste local após as correções](#reteste-após-as-correções-loja-nova), consegui criar minha loja e operar até a pausa de encerramento. Preço brasileiro e separação entre Pix pendente e venda confirmada passaram no percurso controlado. A visita pública e a primeira rodada abaixo permanecem como histórico. Pagamento real não foi testado.

**Este é um exercício de simulação por agente, não uma entrevista nem pesquisa com um restaurante real.** Não representa evidência de frequência dos problemas entre usuários.

## Evidências portáteis

Estas seis capturas são cópias integrais dos PNG originais, sem edição. Não contêm dados de pessoas reais, credenciais ou tokens. O restaurante e os pratos do reteste são fictícios.

1. [Antes: menu público no celular sem acesso à gestão ou cadastro da loja](evidencias/dono-01-menu-publico-mobile.png).
2. [Antes: travessa publicada como R$ 1,23 após digitar 1.234,56](evidencias/dono-02-preco-incorreto-antes.png).
3. [Reteste: preço de R$ 1.234,56 correto no painel móvel](evidencias/dono-03-preco-corrigido.png).
4. [Reteste: cozinha vazia e faturamento zerado enquanto o Pix aguardava confirmação](evidencias/dono-04-pix-pendente-sem-faturamento.png).
5. [Reteste: expediente pausado, pedido entregue e resumo do dia](evidencias/dono-05-expediente-pausado.png).
6. [Reteste: cliente novo impedido de pedir após a pausa da loja](evidencias/dono-06-cliente-loja-fechada.png).

**Artefatos temporários:** as demais capturas, transcrições, medições e scripts citados ao longo do relatório pertencem a `/tmp/topa-persona/dono-restaurante/`. Não foram incorporados ao repositório, podem desaparecer e não são anexos portáteis. Nenhuma resposta de rede ou cabeçalho foi copiada para a pasta de evidências.

**Alterações posteriores ao reteste:** a equipe informou ter removido o pequeno excesso de largura da tabela móvel e ajustado a volta ao login após Sair, com cobertura por automação. Não naveguei novamente nessas alterações e não afirmo tê-las retestado pessoalmente. A medição e a pendência de largura registradas abaixo descrevem a versão que efetivamente observei.

## Como foi avaliado

A primeira avaliação começou exclusivamente na interface de <https://topa-totem.vercel.app/>, sem leitura de código ou documentação do produto. Navegação real com Playwright e Chromium, em tela de computador de 1440 × 1000 e celular de 390 × 844. Foram percorridos apresentação, planos, perguntas frequentes, vídeo, acesso ao painel e entrada do cardápio. A interface do pedido exibiu v0.1.7.

Em produção foram feitas somente navegação e inspeção. Não foram criados conta, loja ou pedido, nem submetido login ou alterado qualquer dado. A primeira impressão está preservada em `/tmp/topa-persona/dono-restaurante/primeira-avaliacao.txt`. A habilidade de redação em português do projeto foi consultada somente depois dessa primeira avaliação.

**Observado** significa algo que a interface efetivamente mostrou durante o percurso. **Expectativa/dúvida** significa o que eu precisaria entender como dono; não prova que a função exista ou falte.

## Meu veredito depois da primeira visita

“Entendi a ideia: o freguês faz o pedido na tela ou no próprio celular e minha equipe acompanha o preparo. Gostei de saber que não preciso comprar o equipamento. Mas não descobri como colocar o meu restaurante nisso. No meu celular nem encontrei onde entrar na gestão. Se eu tivesse que começar amanhã sem ajuda, continuaria no papel.”

A operação diária ainda não pôde ser avaliada na versão pública: encontrei uma barreira de credenciais antes de chegar ao painel. A ausência de um caminho público não permite concluir que cadastrar cardápio, esgotar produto ou consultar vendas sejam funções inexistentes.

## O que consegui entender

| Pergunta do dono | O que a interface demonstrou | O que continuo querendo saber |
| --- | --- | --- |
| “O que vocês vendem?” | Assinatura de autoatendimento com equipamento, software e suporte; pedido no totem ou no celular; gestão pelo painel. | “Quem instala e me ensina a usar?” |
| “Quanto pago?” | Plano Completo: **R$ 249,00 por terminal/mês**. Digital e Redes: sob consulta. O texto qualifica os valores como proposta para piloto e separa as taxas de pagamento. | “Qual é meu custo total para começar? Tem implantação, prazo mínimo e taxa por venda? Com quem confirmo?” |
| “Tenho que comprar um totem?” | FAQ informa equipamento incluído no Completo; aparelho próprio pode ser avaliado no Digital. Completo lista dispositivo e suporte antifurto. | “Meu celular serve? Preciso de outro aparelho para a cozinha? O que é um terminal? Preciso de impressora, tomada e internet no balcão?” |
| “Meu cliente precisa instalar aplicativo?” | FAQ diz que QR Code ou etiqueta NFC abre o navegador; aplicativo é alternativa. | “Como imprimo ou consigo a plaquinha do QR Code para minha loja?” |
| “Dá para trocar os pratos?” | FAQ afirma cadastrar/editar produtos, organizar categorias, adicionar fotos e indicar disponibilidade. Aba de apresentação “Na sua gestão” fala em marcar o que esgotou. | “Como começo com meu arroz, feijão e prato do dia? Quem faz o primeiro cadastro?” |
| “Como os pedidos chegam?” | Vídeo mostra colunas Recebidos, Em preparo e Prontos, com ações de preparo e entrega. | “Toca algum aviso? Preciso ficar olhando a tela? Como o cozinheiro vê o pedido?” |
| “Consigo ver as vendas?” | Vídeo mostra uma entrada “Resumo do dia” e cartões de valores. | “Isso é o que vendi, recebi ou entreguei? Consigo fechar o dia e conferir com o Pix?” |

O vídeo reproduziu normalmente. As telas exibidas no vídeo são demonstração; não executei aquelas ações na aplicação.

## Achados por impacto

### 1. No celular, não encontro a gestão da minha loja

**Impacto:** impede o acesso diário de quem usa o celular como ferramenta principal.

**Observado:** no computador, o cabeçalho oferece “Acessar painel”. Em 390 × 844, esse acesso não aparece. Abri o menu do celular: ele contém “Como funciona”, “Planos” e “Perguntas”. “Abrir cardápio” permanece visível e leva à jornada de comprar comida. Percorri a página até o rodapé e não encontrei outro acesso à gestão.

**Na voz do dono:** “Quero olhar os pedidos no celular, mas aqui só me deixa pedir comida. Cadê a entrada da minha loja?”

**Expectativa:** conseguir encontrar “Painel da minha loja” também no celular, sem decorar um endereço.

**Evidência:** `public-home.png` e `public-mobile-menu.png` em `/tmp/topa-persona/dono-restaurante/`.

### 2. Entendo a oferta, mas não consigo começar com meu restaurante

**Impacto:** impede a adoção por um lojista novo que queira seguir sozinho.

**Observado:** visitei os planos e as perguntas frequentes. Todos os planos oferecem “Ver na prática”, que aponta para a demonstração. O convite final abre o cardápio do consumidor. Não encontrei ação visível para cadastrar loja, solicitar implantação ou conversar com alguém. A FAQ informa que a demonstração não contrata um plano, mas não oferece o próximo caminho.

Ao abrir o cardápio, encontrei “Praça de Alimentação”, estabelecimentos EACH-USP e “Entrar / Cadastrar”. Abri esse cadastro: a tela diz “Peça no seu restaurante favorito direto pelo navegador”. É um caminho de cliente, não uma orientação para cadastrar meu restaurante.

**Na voz do dono:** “Vi os R$ 249,00 e quero saber como contratar. Clico e volto para vídeo ou cardápio de outras lojas. O cadastro é para eu pedir almoço ou para vender o meu?”

**Expectativa:** um próximo passo explícito para o lojista, incluindo quem fornece acesso e como cadastrar sua própria loja. Não executei nem tentei concluir o cadastro do consumidor.

**Evidência:** `public-faq-gestao.json`, `faqs.json`, `public-cardapio.json` e `public-cadastro-consumidor.png`.

### 3. O login do lojista não ajuda quem ainda não tem acesso ou esqueceu a senha

**Impacto:** impede iniciar ou retomar a operação sem assistência externa.

**Observado:** “Acessar painel” abre `/painel`, com título “Painel do lojista”, instrução para informar credenciais, campos E-mail e Senha e botão Entrar. Não encontrei nessa tela criar loja, obter acesso, recuperar senha, contato de suporte ou voltar à apresentação. Não submeti credenciais em produção.

**Na voz do dono:** “Quem me dá esse e-mail e essa senha? Se o funcionário que cadastrou sair ou eu esquecer, para quem ligo?”

**Expectativa:** orientação de primeiro acesso e recuperação. Não foi testado erro de autenticação em produção; não atribuo falha à validação do login.

**Evidência:** `public-painel.png` e `public-painel.json`.

### 4. Não consigo avaliar como manter a venda se algo der errado

**Impacto potencial:** alto durante almoço e jantar; ainda não demonstrado na aplicação.

**Observado:** apresentação e FAQ consultadas não orientam a rotina de queda da internet, pedido que não aparece ou pagamento com dúvida. O painel está protegido por credenciais, então não examinei mensagens de erro ou comportamento de reconexão.

**Na voz do dono:** “Se a internet cair no almoço, eu paro de vender? E se o cliente pagou e o pedido não apareceu? Eu faço de novo e corro o risco de cobrar duas vezes?”

**Expectativa:** estado de conexão compreensível, confirmação de recebimento do pedido e orientação prática para continuar ou buscar ajuda. Isso é uma necessidade a verificar no ambiente local, não uma conclusão de que o sistema perca pedidos.

### 5. Preço e equipamento ajudam a entender a ideia, mas faltam as respostas para decidir a instalação

**Impacto:** dificulta decidir quando e como começar; menos imediato que o acesso à operação.

**Observado:** o preço de referência e a inclusão do equipamento estão claros depois de ler planos e FAQ. Os limites do piloto também estão informados. Não há ali especificação do aparelho, requisitos básicos de funcionamento, prazo ou canal de implantação.

**Na voz do dono:** “O valor cabe na conta, mas eu não sei o que preciso comprar ou separar no balcão para funcionar. Quero uma lista simples e alguém para confirmar.”

**Expectativa:** saber o que vem na assinatura, o que minha loja precisa ter e qual é o custo de entrada confirmado. “Terminal” e “NFC” precisam de explicação ligada ao uso concreto.

## Tentativas de rotina

| Tarefa | Resultado na versão pública | Limite da conclusão |
| --- | --- | --- |
| Entender a proposta | Consegui lendo página, planos, FAQ e assistindo ao vídeo. | Entendimento simulado; não é teste com pessoa real. |
| Identificar preço e equipamento | Consegui o preço de referência do Completo e inclusão de equipamento; Digital depende de avaliação. | Custo total e compatibilidade da minha loja continuam abertos. |
| Cadastrar minha loja | Não encontrei caminho visível. Cadastro encontrado era para consumidor. | Não prova que não exista processo externo. |
| Entrar na gestão | Encontrei o login no computador; no celular o link não aparece. | Sem credenciais e sem submissão em produção. |
| Configurar meu cardápio | Prometido na FAQ; não executado. | Painel protegido. |
| Abrir expediente | Não demonstrado no percurso público. | Não concluir que falte; verificar localmente. |
| Receber, preparar e entregar | Apresentado em vídeo; não executado. | Vídeo não valida recebimento real ou atualização entre aparelhos. |
| Esgotar produto | Citado na apresentação; não executado. | Verificar se o cliente deixa de comprar o produto. |
| Tratar erro e internet | Não executado em produção. | Verificar localmente. |
| Conferir resultado do dia | “Resumo do dia” aparece no vídeo; não operado. | Não verifiquei cálculo, recorte de data ou fechamento. |

## Evidências e próximos testes

Além dos seis PNG portáteis vinculados no início, capturas, transcrições e scripts permanecem como artefatos temporários em `/tmp/topa-persona/dono-restaurante/`. Não foram registrados dados de pessoas reais. Um erro transitório `ERR_NETWORK_CHANGED` do navegador ocorreu em uma navegação e a repetição abriu a página; ele não foi tratado como defeito do produto.

Na conclusão da primeira visita pública, a operação local e o reteste ainda estavam pendentes. A rodada local autorizada está documentada a seguir. Serão separados da primeira impressão pública. Prioridades: obter acesso legítimo da loja; montar um cardápio próprio; receber um pedido em outro aparelho; avançar preparo e entrega; esgotar item e conferir o cardápio do cliente; simular queda/retorno de conexão; conferir o resultado do dia e descobrir a abertura e o encerramento do expediente.

## Primeira rodada local: operação

Ambiente: `http://127.0.0.1:5190/`, com banco dedicado, descartável e separado da produção. A conta de teste do lojista foi fornecida pelo suporte do exercício. **Não descobri como obter essa conta pela interface.** No celular, também precisei receber o endereço direto `/painel`, pois o caminho público de acesso não estava disponível nessa largura. Não foram usados dados pessoais reais.

Cliente e lojista navegaram em contextos independentes de navegador, compartilhando somente o servidor local. Não foi realizado pagamento bancário, não foi usada conta bancária e não houve pagamento externo. A interface do produto permaneceu estável durante esta rodada. Não li código para descobrir as operações.

### Prioridades depois de operar

| Prioridade | Problema observado | Consequência na linguagem do dono |
| --- | --- | --- |
| 1 | Abrir o Pix do cliente produziu pedido recebido e faturamento, sem que eu pagasse. | “Posso mandar fazer e entregar uma comida que ninguém pagou. Meu resumo já diz que entrou dinheiro.” |
| 2 | Preço brasileiro `1.234,56` foi salvo como **R$ 1,23**, sem aviso. | “Digitei o valor da minha travessa e o sistema vende quase de graça.” |
| 3 | No celular, acesso ao painel ausente da apresentação; dentro dele, ações e pedidos ficam fora da largura visível. | “Preciso adivinhar onde entrar e arrastar para descobrir o que está pronto ou qual prato estou desligando.” |
| 4 | Minha loja só pôde operar depois de suporte fornecer conta e endereço. | “Eu não consigo cadastrar meu restaurante e começar sozinho.” |
| 5 | “Abrir o totem” levou à apresentação; não encontrei abertura/encerramento de expediente. | “Como deixo a tela certa para o freguês? E como aviso que fechei?” |
| 6 | Esgotar funciona para novo cliente, mas um cardápio já aberto ainda permitiu chegar ao Pix. | “O prato acabou; por que quem já estava na tela ainda consegue ir pagar?” A conclusão de venda desse item não foi testada. |

### Pedido sem pagamento e resumo do dia

**Observado:** em outro contexto, abri a loja Bem-te-vi, escolhi Comer aqui, entrei em “Pratos do dia”, adicionei “Prato feito de teste” por R$ 32,90, abri Ver pedido e toquei em Pagar. A tela exibiu “Pague com Pix”, QR/código e contagem de aproximadamente cinco minutos. Não paguei. Depois disso, o painel mostrou pedido **001**, Recebidos = 1, Faturamento = **R$ 32,90**, Pedidos = 1, Ticket médio = R$ 32,90 e uma unidade vendida do prato.

O responsável pelo ambiente confirmou que não inseriu esse pedido nem confirmou o Pix. Portanto, ele veio da própria interação da aplicação, e não de uma preparação manual do teste. No cartão do pedido observado, não encontrei aviso de pagamento pendente.

**Na voz do dono:** “Recebido para mim é comida para fazer. Faturamento para mim é dinheiro de venda. Como sei se esse cliente pagou?”

Avancei esse pedido de teste sem pagamento confirmado, com autorização para a simulação local. **Começar preparo → Marcar como pronto → Entregar** funcionou. O pedido mudou de coluna e apareceu em “Entregues hoje (1)”, com item, horário e R$ 32,90. A interface exibiu confirmação de mudança e “Desfazer” durante as transições. Isso valida a operação dos estados na simulação; não valida a confirmação de pagamento ou conciliação bancária.

**Evidências:** `local-client-payment.json`, `local-mobile-order-before.json`, `local-mobile-order-preparando.json`, `local-mobile-order-pronto.json`, `local-mobile-order-entregue.json` e respectivas capturas.

### Cadastro com categoria e preço do meu restaurante

**Observado:** encontrei Novo produto depois de percorrer o painel. Cadastrei no celular:

| Nome fictício | Categoria digitada | Preço digitado | Preço exibido após salvar |
| --- | --- | --- | --- |
| Prato feito de teste | Pratos do dia | `32,90` | R$ 32,90 |
| Travessa de teste | Pratos do dia | `1.234,56` | **R$ 1,23** |

A categoria própria apareceu no painel e no cardápio de outro contexto. Nome, descrição e preço do prato de R$ 32,90 também apareceram para o cliente. O valor errado da Travessa foi publicado no cardápio como R$ 1,23, não apenas mostrado no formulário.

**Na voz do dono:** “A categoria e o prato eu consegui. Mas tenho que conferir cada preço depois de salvar, porque um valor que escrevo do jeito brasileiro foi reduzido sem me perguntar.”

Não testei upload de foto: o formulário oferece “URL da foto (opcional)”, exigindo um endereço. **Expectativa/dúvida:** “Tenho a foto na galeria do WhatsApp. Como coloco aqui sem saber o que é URL?” Isso é uma barreira provável de compreensão desta persona, não uma falha de upload demonstrada.

**Evidências:** `local-mobile-product-form.png`, `local-product-32-90.txt`, `local-product-1234-56.txt`, `local-client-own-category.json` e capturas.

### Uso diário no celular

**Observado:** o painel móvel manteve os quatro indicadores em sequência antes dos pedidos. A navegação lateral do computador não apareceu no celular. Precisei rolar a página para alcançar o cardápio e rolar horizontalmente as áreas de pedidos e produtos.

No início da tabela, vejo nome e preço do produto, mas não À venda e Editar. Ao alcançar À venda e Editar, o nome do produto fica fora da tela. A captura após esgotar o prato mostra vários interruptores e botões Editar sem os respectivos nomes visíveis. Isso torna difícil conferir se mexi no prato certo.

Depois de Começar preparo, o pedido passa para outra coluna. Depois de Marcar como pronto, o cartão estava cortado na lateral direita da tela capturada. Consegui continuar com rolagem horizontal; as ações funcionaram. Não encontrei indicação textual convidando a arrastar ou uma forma de ver todas as etapas ao mesmo tempo nessa largura.

**Na voz do dono:** “No almoço, vou achar que o pedido sumiu. E se eu desligar o prato da linha errada porque o nome ficou lá do outro lado?”

**Expectativa:** priorizar pedidos no celular e manter identificação junto das ações. Isso é necessidade de uso, não preferência de cor ou acabamento.

**Evidências:** `local-mobile-painel-inicial.png`, `local-mobile-order-pronto.png` e `local-mobile-stock-off.png`.

### Esgotar e repor produto

**Observado:** desliguei “Prato feito de teste à venda”. O painel exibiu “Esgotados no totem: Prato feito de teste”. Um novo contexto de cliente mostrou o prato com “Esgotado”. Ao religar o interruptor, outro cliente novo voltou a vê-lo disponível. A mudança de disponibilidade no servidor e a leitura por novos clientes foram demonstradas.

O cliente que já estava com o cardápio aberto antes de esgotar continuou vendo o prato disponível após esperar mais de quatro segundos. Nesse cliente, ainda consegui adicionar, ver a sacola e chegar à tela Pix depois de esgotar. Não paguei; não observei um segundo pedido recebido. **Não está demonstrado que uma compra indisponível seria concluída.** O problema demonstrado é permitir avançar até uma cobrança aparente sem orientar que o prato acabou.

O painel avisa que o esgotamento vale “a partir do próximo cliente”. Isso descreve o comportamento, mas deixa uma decisão de balcão sem resposta para quem já estava comprando.

**Na voz do dono:** “Acabou o bife agora. Preciso que pare de vender para quem já está olhando também, ou que avise antes de pedir Pix.”

**Evidências:** `local-mobile-stock-off.json`, `local-client-stale-menu-stock.json`, `local-client-fresh-esgotado.json`, `local-client-stale-checkout.json`, `local-mobile-stock-on.json` e `local-client-fresh-disponivel.json`.

### Internet e erro ao mudar estoque

**Observado:** com o painel aberto, desliguei a rede do contexto do lojista por mais de seis segundos. Apareceu “O servidor não responde. Os números abaixo podem estar desatualizados”. Os dados anteriores permaneceram visíveis. Tentei esgotar o prato sem rede: apareceu “Não foi possível mudar Prato feito de teste. Tente de novo”, e o interruptor voltou ao estado à venda. Ao restabelecer a rede e esperar mais de seis segundos, o aviso do servidor desapareceu e o prato continuou à venda. A mensagem da tentativa anterior permaneceu, distinguindo aquela operação que falhou.

**Ponto positivo:** a alteração não pareceu concluída e depois se perdeu silenciosamente. O nome do prato veio na mensagem de erro.

**Na voz do dono:** “Entendi que a mudança não foi. Mas continuo sem saber se devo voltar para o papel, tirar o totem de uso ou chamar alguém. Se o cliente estiver pagando enquanto isso, para onde olho?”

**Expectativa:** orientação operacional e suporte. Não foi validada venda offline, recuperação de pedido em pagamento ou reconciliação após desconexão do cliente. A simulação foi de interrupção de rede no painel já carregado; não representa desligamento de equipamento ou queda física prolongada.

**Evidências:** `local-mobile-offline.json`, `local-mobile-offline-stock.json` e `local-mobile-reconnected.json`.

### Abrir, encerrar e conferir o expediente

**Observado:** consegui ver o resumo do dia, contagem por hora, unidades vendidas e pedidos entregues. Na tela de computador, explorei os acessos Pedidos, Resumo do dia, Cardápio e Abrir o totem. Não encontrei nessa interface abrir loja, pausar pedidos, definir horário, fechar o dia, fechamento de caixa ou uma orientação do que fazer ao terminar o expediente.

Cliquei em “Abrir o totem”: abriu a página de apresentação em `/`, com planos e vídeo. Não abriu diretamente a tela de pedido da minha loja. Para chegar ao pedido, usei o caminho do consumidor e selecionei a Bem-te-vi na praça de alimentação. No celular, o link Abrir o totem também não está disponível na navegação exibida.

**Na voz do dono:** “É hora de fechar. Basta eu sair? O freguês ainda consegue pedir pelo QR Code de casa? Amanhã preciso ligar alguma coisa? E esses R$ 32,90, que ninguém pagou, entram na minha conta do dia?”

**Limite:** a conclusão é ausência de caminho e orientação visíveis no percurso. Não foi simulada uma virada real de data, nem conferido extrato bancário. Não há evidência para afirmar que algum fechamento externo não exista.

**Evidências:** `local-desktop-endday.json` e `local-open-totem-from-panel.json`.

### Resultado das tarefas após a primeira rodada local

| Tarefa | Resultado observado |
| --- | --- |
| Cadastrar minha própria loja | Bloqueado; suporte precisou fornecer conta já existente. |
| Entrar no painel pelo celular | Funcionou com credenciais e endereço recebidos de fora da interface. |
| Criar categoria e prato | Funcionou; publicado em outro contexto. |
| Digitar preço brasileiro | `32,90` funcionou; `1.234,56` virou R$ 1,23. |
| Receber pedido de outro contexto | Funcionou sem confirmar pagamento; risco crítico observado. |
| Preparar, marcar pronto e entregar | Funcionou no pedido de teste 001, com rolagem horizontal no celular. |
| Esgotar e repor | Funcionou para cliente novo; cliente com cardápio aberto avançou até Pix do produto esgotado. |
| Alterar estoque sem internet | Não concluiu; estado revertido e erro nominal visível. |
| Reconectar painel | Voltou a atualizar e retirou o alerta de servidor. |
| Abrir totem pelo painel | Levou à apresentação; não ao autoatendimento direto da loja. |
| Ver resultado do dia | Indicadores e entregues visíveis; incluíram pedido não pago. |
| Abrir/encerrar expediente | Não encontrei ação nem instrução na interface avaliada. |

A primeira rodada foi concluída e comunicada antes das mudanças de interface. O reteste será registrado abaixo sem substituir as observações originais.

## Reteste após as correções: loja nova

**Ambiente local de reteste:** `http://127.0.0.1:5192/`, ainda em 15/11/2026. Novo contexto de navegador, começando pela apresentação, sem ler código, documentação ou instruções de uso. A única instrução técnica recebida foi a de confirmação do provedor fictício de pagamento, descrita separadamente abaixo. A produção não foi alterada nem usada para pedidos.

Criei pela interface a loja fictícia **Restaurante Panela da Vila Teste**, usando e-mail `@example.com`. Todos os produtos e mudanças deste reteste ficaram nessa loja. Não usei a conta Bem-te-vi nem alterei lojas de outros testes. Ao terminar, deixei a loja **pausada**, sem pedidos na cozinha e com o prato reposto.

### O que o dono conseguiu fazer sozinho

“No celular, agora encontrei Criar minha loja e Acessar painel no menu. Cadastrei meu restaurante, entrei no painel e ele explicou que primeiro preciso cadastrar um produto, depois abrir a loja e compartilhar o cardápio. Consegui seguir isso. O botão de abrir o totem levou à tela da minha loja. No fim, usei Pausar pedidos e vi que um cliente novo não podia pedir.”

| Achado original | Reteste demonstrado | Resultado neste ambiente |
| --- | --- | --- |
| Cadastro da minha loja bloqueado | Menu móvel e planos oferecem Criar minha loja; formulário pede nome da loja, e-mail, senha e confirmação. Minha conta e loja foram criadas sem auxílio de acesso. | Resolvido no percurso testado. |
| Acesso ao painel sumia no celular | Abri o menu móvel e encontrei Acessar painel; o login distingue conta de lojista, oferece cadastro e volta ao site. | Resolvido no percurso testado. |
| `1.234,56` virava R$ 1,23 | Cadastrei “Travessa para família de teste” por `1.234,56`; painel e cliente exibiram **R$ 1.234,56**. “Prato executivo de teste” por `32,90` exibiu R$ 32,90. Ambos ficaram na categoria própria “Almoço da casa”. | Resolvido nos dois valores testados. |
| Abrir o totem voltava à apresentação | O link abriu nova aba `/totem?loja=...` com o nome da minha loja, opções Comer aqui/Levar para viagem e conexão do servidor. | Resolvido no percurso testado. |
| Não havia abertura/pausa e orientação de fim do dia | Nova loja começou com Pedidos pausados. Abri por Abrir loja; no fim, usei Pausar pedidos. A orientação manda pausar, concluir pedidos e conferir o resumo, e distingue esse resumo do fechamento do caixa. | Resolvido para abertura e pausa manual testadas. |
| Não sabia como compartilhar minha loja | Painel oferece QR Code e campo com link específico. Usei esse link em outro contexto e ele abriu diretamente meu restaurante. | Compartilhamento por link demonstrado; QR exibido, sem leitura física por câmera. |
| Pedido e faturamento apareciam sem pagamento | Dois Pix pendentes mantiveram cozinha vazia, Pedidos 0 e Faturamento R$ 0,00. Só o confirmado pela fixture entrou no painel. | Resolvido com o provedor fictício controlado; banco real não testado. |
| Colunas móveis escondiam o pedido | Recebidos, Em preparo e Prontos aparecem em sequência vertical. Preparei, marquei pronto e entreguei com os botões visíveis na largura do celular. | Bloqueio lateral resolvido; ainda exige rolar a página. |
| Ação de estoque ficava distante do nome | Na tabela móvel, nome, preço, interruptor e Editar aparecem juntos em 390 px. Esgotado também aparece junto do nome. | Operável no teste; pequeno excesso de largura descrito nas pendências. |
| Cliente com cardápio antigo chegava a um Pix do item esgotado | Novo cliente viu item esgotado e botão desabilitado. Cliente que já estava com cardápio aberto recebeu “Prato executivo de teste esgotou” ao tentar pagar, sem QR, com Voltar ao pedido. | Bloqueio antes do Pix demonstrado. O retorno pela ação não foi executado. |

O cadastro avisa que cria conta e cardápio, sem contratar um plano nem confirmar pagamentos. Isso evita confundir o cadastro operacional com a assinatura comercial. Contratação, entrega do equipamento e implantação física não foram simuladas.

### Separação entre Pix pendente e pedido pago

O cliente navegou por outro contexto de navegador, independente do lojista, usando o link que o painel mostrou. Escolhi Levar para viagem e o prato de R$ 32,90.

1. Na primeira tentativa, a rede mostrou `pix_fake_45d2e717`, estado **PENDING**, criado por `POST /api/payments/pix`. O cliente permaneceu na tela Pix. Depois de cinco segundos, o painel manteve Faturamento R$ 0,00, Pedidos 0 e todas as etapas da cozinha vazias. Essa tentativa não foi confirmada.
2. Para acompanhar também a atualização da tela do cliente ao vivo, repeti a tentativa em novo contexto. O pagamento foi `pix_fake_9027228d`. Antes de confirmá-lo, esperei cinco segundos e registrei novamente painel sem faturamento nem pedido.
3. **Auxílio técnico exclusivo do teste:** acionei `POST http://127.0.0.1:8022/__validation/payments/pix_fake_9027228d/confirm`, autorizado para o provedor fictício. A resposta foi HTTP 200, estado PAID, provedor `local-test-fixture`. Esse endpoint não é parte da experiência descoberta pelo dono. Não houve transferência de dinheiro, aplicativo de banco, conta bancária ou pagamento externo.
4. Depois da confirmação, o cliente exibiu “Preparando seu pedido”, número **002** e Total pago R$ 32,90. O painel passou a Recebidos = 1, Faturamento R$ 32,90, Pedidos = 1, Ticket médio R$ 32,90 e Para viagem = 100%. A tentativa pendente anterior não inflou os números.
5. Executei Começar preparo → Marcar como pronto → Entregar. O cliente exibiu “Seu pedido está pronto” e “Retire no balcão”. O painel terminou com Entregues hoje (1) e etapas vazias. Não houve conferência bancária real.

A captura do estado pendente antes da confirmação é importante: o resultado não foi inferido somente do texto novo que promete separar pagamento e cozinha.

**Evidências:** `retest-pix-pending-client.json`, `retest-pix-pending-staff.json`, `retest-second-pix-pending-staff.json`, `retest-payment-network.json`, `retest-confirmed-payment-network.json`, `retest-fixture-confirmation.json`, `retest-client-confirmed.json`, `retest-staff-paid-received.json`, `retest-mobile-preparando.json`, `retest-mobile-pronto.json`, `retest-client-ready.json` e `retest-mobile-entregue-summary.json`.

### Esgotamento e encerramento

Desliguei o prato no painel móvel. Um cliente novo viu “Esgotado” e não pôde adicioná-lo. O cliente que mantinha o cardápio aberto ainda viu o item antigo e conseguiu adicioná-lo à sacola, mas, ao tentar pagar, recebeu o aviso específico de esgotamento e nenhum código Pix. Isso é uma melhora observada em relação à primeira rodada.

Religuei o interruptor e o painel voltou a mostrar o prato à venda. Depois, pausei os pedidos. Um novo contexto, aberto pelo mesmo link compartilhado, exibiu **“Loja fechada para pedidos”**, explicou que a loja pausou e ofereceu Atualizar cardápio. Não criou pedido.

**Na voz do dono:** “Agora sei onde ligar as vendas e onde parar. Quando o prato acabou, o cliente foi avisado antes de receber um Pix. E o resumo do dia contou só o pedido que o teste confirmou como pago.”

**Evidências:** `retest-mobile-esgotado.json`, `retest-fresh-esgotado.json`, `retest-stale-esgotado-checkout.json`, `retest-mobile-disponivel.json`, `retest-mobile-endday-paused.json` e `retest-new-client-paused.json`.

### O que ainda merece atenção, por impacto

1. **Recuperação de acesso continua sem caminho visível.** Reabri o login em contexto novo: agora consigo cadastrar loja e voltar ao site, mas não encontrei recuperar senha ou pedir ajuda. “Se eu esquecer a senha na hora do almoço, ainda não sei como volto a entrar.” Não testei nenhuma recuperação externa.
2. **O celular ainda exige rolagem longa para chegar aos pedidos.** Status da loja, compartilhamento e indicadores vêm antes da cozinha. As etapas deixaram de ficar escondidas de lado, o que resolveu o bloqueio principal; no uso corrido, ainda preciso descer para acompanhar a fila. Não foi simulado um pico com muitos pedidos.
3. **Foto ainda exige URL.** Reabri Novo produto e confirmei “URL da foto (opcional)”. Não vi seleção da galeria. “Minha foto está no WhatsApp; eu não sei qual endereço pôr.” A dificuldade de compreensão é uma inferência desta persona; não foi feito teste de upload.
4. **Na versão retestada, a tabela chegava ao limite da largura quando o prato estava esgotado.** Em 390 px, medi cerca de 365 px de tabela em área de 356 px. Nome e ação permaneceram reconhecíveis e consegui operar; é uma sobra pequena, não o bloqueio de identificação anterior. Evidência: `retest-mobile-esgotado-width.png` e `retest-mobile-width.json`.

As condições comerciais e os equipamentos continuam dependentes de proposta e avaliação; o reteste não verificou contratação. Impressão de QR Code, leitura NFC, equipamento físico, internet durante pagamento, virada de data e conciliação com banco real não foram testados. O teste de queda de rede do painel descrito na primeira rodada não foi repetido nesta versão; não considero automaticamente validada uma regressão completa desse comportamento.

### Veredito da persona após o reteste

“Agora eu consigo cadastrar meu restaurante, pôr os pratos, abrir as vendas, passar o link e seguir o pedido até entregar. Consigo parar de receber pedido ao fechar. Os dois sustos maiores: valor errado e pedido entrando antes de pagar: não se repetiram neste teste controlado. Para depender disso sozinho todo dia, ainda preciso saber como recuperar meu acesso e como colocar as fotos que tenho no celular.”

O percurso operacional local terminou com êxito dentro das limitações descritas. **Isso não transforma a simulação em pesquisa com usuários reais nem comprova pagamento bancário ou funcionamento em equipamento de restaurante.** Os achados da visita pública e da primeira rodada local foram mantidos acima como histórico, não como descrição da interface corrigida.
