export const LANDING_NAV = [
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#planos', label: 'Planos' },
  { href: '#perguntas', label: 'Perguntas' },
]

export const PRODUCT_STEPS = [
  {
    id: 'totem',
    label: 'No totem',
    number: '01',
    title: 'O cliente escolhe. O pedido ganha forma.',
    description:
      'Fotos, categorias e sugestões para completar o pedido. Seu cliente escolhe com calma, enquanto sua equipe cuida do preparo.',
    image: 'kiosk.webp',
    alt: 'Cardápio do TOPA no totem',
    detail: 'Cardápio, sacola e pagamento no mesmo fluxo.',
  },
  {
    id: 'phone',
    label: 'No celular',
    number: '02',
    title: 'Totem ocupado? Tem outro caminho.',
    description:
      'Um QR Code ou uma aproximação por NFC abre o cardápio no navegador do cliente. Sem baixar aplicativo. O balcão continua sendo o ponto de retirada.',
    image: 'phone.webp',
    alt: 'Cardápio do TOPA no navegador do celular',
    detail: 'O próprio celular vira mais um ponto de pedido.',
  },
  {
    id: 'dashboard',
    label: 'Na sua gestão',
    number: '03',
    title: 'Do pedido recebido ao balcão. Tudo à vista.',
    description:
      'Acompanhe os pedidos, avance o preparo e avise quando estiverem prontos. No mesmo painel, atualize seu cardápio e marque o que esgotou.',
    image: 'dashboard.webp',
    alt: 'Painel do TOPA com pedidos de demonstração',
    detail: 'Recebidos, em preparo e prontos, cada um no seu lugar.',
  },
]

export const PLANS = [
  {
    id: 'digital',
    name: 'Digital',
    category: 'O seu aparelho, com TOPA',
    description: 'Para conhecer o autoatendimento usando um dispositivo da própria loja.',
    priceCents: null,
    priceNote: 'Conforme a sua operação',
    featured: false,
    features: [
      'Cardápio digital com fotos',
      'Pedidos pelo celular via QR Code',
      'Painel de pedidos e produtos',
      'Avaliação do aparelho no piloto',
    ],
  },
  {
    id: 'complete',
    name: 'Completo',
    category: 'Equipamento + software',
    description: 'O formato pensado para transformar um espaço do balcão em autoatendimento.',
    priceCents: 24900,
    priceNote: 'por terminal / mês',
    featured: true,
    features: [
      'Dispositivo e suporte antifurto',
      'Cardápio, pedidos e painel',
      'Acesso por QR Code e NFC',
      'Suporte incluído na proposta',
      'Equipamento por assinatura',
    ],
  },
  {
    id: 'stores',
    name: 'Redes',
    category: 'Uma proposta para cada unidade',
    description: 'Para planejar a implantação em mais de um balcão ou estabelecimento.',
    priceCents: null,
    priceNote: 'Dimensionado para a sua rede',
    featured: false,
    features: [
      'Configuração por estabelecimento',
      'Cardápio próprio em cada loja',
      'Planejamento dos terminais',
      'Implantação por etapas',
    ],
  },
]

export const QUESTIONS = [
  {
    question: 'O que é o TOPA?',
    answer:
      'É o Totem por Assinatura: uma proposta de autoatendimento para pequenos e médios estabelecimentos de alimentação e comércio de bairro. O cliente monta o pedido no totem ou no celular, e a loja acompanha o preparo pelo painel.',
  },
  {
    question: 'Meu cliente precisa baixar um aplicativo?',
    answer:
      'Não. O QR Code ou a etiqueta NFC abre o cardápio direto no navegador do celular. O aplicativo do cliente é uma alternativa, não uma exigência para pedir.',
  },
  {
    question: 'Preciso comprar um totem?',
    answer:
      'No formato Completo, o equipamento faz parte da assinatura. Para quem já tem um aparelho, o formato Digital prevê a avaliação da compatibilidade durante o piloto.',
  },
  {
    question: 'Posso alterar meu cardápio?',
    answer:
      'Sim. O painel permite cadastrar e editar produtos, organizar categorias, adicionar fotos e indicar o que está disponível. Assim, o cliente vê as opções da sua loja.',
  },
  {
    question: 'Os valores dos planos já estão definidos?',
    answer:
      'Os planos são propostas para o piloto. R$ 249 por terminal ao mês é a referência do formato Completo no projeto. A proposta comercial confirma compatibilidade, equipamento, implantação e condições para cada loja.',
  },
  {
    question: 'O que posso conhecer na demonstração?',
    answer:
      'Você pode explorar o cardápio e conhecer a experiência de pedido do cliente. O vídeo também apresenta o totem e o painel, que exige autenticação. A demonstração não realiza a contratação de um plano.',
  },
]
