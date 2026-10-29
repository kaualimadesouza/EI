# Política de Privacidade e Conformidade com a LGPD (Lei 13.709/2018)

Este documento descreve as práticas de tratamento de dados pessoais realizadas pela plataforma
TOPA (Totem por Assinatura), em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD).

## 1. Papéis dos agentes de tratamento

De acordo com as definições do Artigo 5º da LGPD:

- **Controlador:** O estabelecimento comercial (lojista contratante do serviço TOPA), a quem
  competem as decisões referentes ao tratamento de dados pessoais no âmbito de sua atividade comercial.
- **Operador:** A plataforma TOPA, que realiza o tratamento de dados pessoais em nome e sob as
  diretrizes do controlador, provendo a infraestrutura de software, autenticação e armazenamento.

## 2. Dados pessoais tratados

O TOPA adota o princípio da minimização da coleta (Art. 6º, III da LGPD), restringindo o tratamento
ao estritamente necessário para a operação do sistema:

### 2.1 Dados do lojista (operador do painel)
- **E-mail de acesso:** Utilizado como credencial primária de identificação.
- **Senha criptografada:** Armazenada exclusivamente sob forma de hash criptográfico com salt aleatório
  (algoritmo scrypt, conforme RFC 7914). A senha em texto plano nunca é persistida.

### 2.2 Dados dos clientes finais (consumidores)
- Os totens de autoatendimento e os pedidos via celular não exigem cadastro prévio de pessoa física.
- Não há coleta de nome, CPF, telefone, endereço ou dados sensíveis (Art. 5º, II da LGPD) do consumidor.
- Os pedidos registram apenas itens selecionados, método de pagamento (cartão ou Pix), modalidade
  (consumo local ou viagem), data e horário.

## 3. Finalidades do tratamento

Os dados pessoais coletados destinam-se exclusivamente às seguintes finalidades:

1. **Autenticação e controle de acesso:** Garantir que apenas usuários autorizados acessem a gestão,
   relatórios e cardápio de sua respectiva loja.
2. **Segurança e auditoria:** Prevenir acessos indevidos e proteger a integridade dos dados da operação.
3. **Gestão operacional:** Permitir a visualização de métricas de vendas e atualização de disponibilidade
   de produtos pelo próprio lojista.

## 4. Bases legais (Art. 7º da LGPD)

O tratamento dos dados pessoais fundamenta-se nas seguintes bases legais:

- **Execução de contrato (Art. 7º, V):** O tratamento dos dados cadastrais do lojista é indispensável
  para a execução do contrato de prestação de serviços e fornecimento da solução de software.
- **Legítimo interesse (Art. 7º, IX):** Garantia da segurança da informação, controle de autenticidade,
  prevenção a fraudes e limitação de taxa de requisições (rate limiting).

## 5. Medidas técnicas e de segurança da informação

Em observância ao Art. 46 da LGPD, a plataforma adota salvaguardas técnicas adequadas:

- **Criptografia de senhas:** Função de derivação de chave scrypt com parâmetros de alta memória e CPU
  (N=16384, r=8, p=1) e salt criptográfico individual de 16 bytes.
- **Tokens assinados:** Emissão de tokens de sessão temporários assinados com HMAC-SHA256, contendo tempo
  de expiração configurável e vinculação estrita ao identificador da loja (`store_slug`).
- **Controle de acesso por loja (multi-tenant):** Acesso a rotas administrativas condicionado à validação
  de que a loja do lojista autenticado corresponde à loja alvo da requisição.
- **Proteção contra abusos (Rate Limiting):** Janela deslizante de controle de requisições por endereço IP
  na criação de pedidos para conter ataques de negação de serviço e tentativas de força bruta.
- **Trânsito criptografado:** Comunicação realizada integralmente através de conexões protegidas por TLS (HTTPS).

## 6. Retenção e eliminação dos dados

Os dados de acesso do lojista permanecem armazenados enquanto durar a relação contratual ou até que haja
solicitação expressa de exclusão pelo titular, respeitados eventuais prazos legais de guarda documental.
Após o encerramento da conta, os registros de acesso são excluídos com segurança ou anonimizados.

## 7. Direitos do titular (Art. 18 da LGPD)

O lojista, na qualidade de titular de dados pessoais, tem o direito de solicitar a qualquer momento:

1. Confirmação da existência de tratamento de seus dados.
2. Acesso aos dados pessoais armazenados.
3. Correção de dados incompletos, inexatos ou desatualizados.
4. Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos.
5. Eliminação dos dados pessoais tratados mediante consentimento ou término da relação contratual.
6. Informação sobre eventuais entidades públicas ou privadas com as quais houve compartilhamento.

Para exercer seus direitos de titular ou esclarecer dúvidas sobre esta política, o lojista pode entrar em
contato através do canal de atendimento do projeto TOPA ou com o responsável pela administração da plataforma.
