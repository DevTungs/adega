// Aliases de produtos: carregados do banco de dados (tabela product_aliases)
// O proprietário cadastra os aliases pelo painel admin

// Mapa vazio — aliases são carregados dinamicamente do banco
export const PRODUCT_ALIASES: Record<string, string> = {};

// Sugestões de categoria: carregadas dinamicamente do banco (tabela categories + products)
export const CATEGORY_SUGGESTIONS: Record<string, string[]> = {};

// Palavras que devem ser ignoradas ao processar (stopwords)
export const STOP_WORDS = [
  'de', 'do', 'da', 'dos', 'das', 'um', 'uma', 'uns', 'umas',
  'o', 'a', 'os', 'as', 'para', 'por', 'com', 'sem', 'em',
  'no', 'na', 'nos', 'nas', 'ao', 'à', 'e', 'ou', 'mas',
  'que', 'se', 'eu', 'me', 'minha', 'meu', 'te', 'ti',
  'quero', 'queria', 'queres', 'quer', 'pedir', 'pedido',
  'me vê', 'me da', 'pode ser', 'vou querer', 'vou levar',
  'também', 'tbm', 'mais', 'outro', 'outra', 'outros', 'outras',
  'o que', 'qual', 'quais', 'quanto', 'quanta',
];

// Frases de intenção
export const INTENT_KEYWORDS: Record<string, string[]> = {
  cardapio: ['cardápio', 'cardapio', 'menu', 'produtos', 'o que tem', 'oque tem'],
  acompanhar: ['meu pedido', 'status', 'acompanhar', 'onde está', 'onde esta', 'tá pronto', 'ta pronto'],
  cancelar: ['cancelar', 'cancela', 'desistir', 'desisto'],
  promocao: ['promoção', 'promocao', 'promo', 'oferta', 'desconto', 'promoções', 'promocoes'],
  ajuda: ['ajuda', 'help', 'como funciona', 'como faço'],
  pedir: ['quero', 'pedir', 'pedido', 'me vê', 'me da', 'vou querer', 'vou levar', 'queria'],
};
