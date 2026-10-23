// SPEC-225: a Administração Bancária virou 2 sistemas (Contas a Pagar e
// Contas a Receber) gerados deste mesmo código. O modo vem da variável de
// build VITE_MODO_SISTEMA ('pagar' | 'receber') e trava o tipo em todas as
// telas -- não existe mais seletor Pagar/Receber. Build sem a variável vira
// só a página de escolha (endereço antigo adm-bancaria-lucenera).
export type ModoSistema = 'pagar' | 'receber'

const bruto = import.meta.env.VITE_MODO_SISTEMA as string | undefined

export const MODO: ModoSistema | null = bruto === 'pagar' || bruto === 'receber' ? bruto : null

export const EH_PAGAR = MODO === 'pagar'

// boletos.tipo_operacao / notas_fiscais.tipo_operacao
export const TIPO_OPERACAO: 'CP' | 'CR' = EH_PAGAR ? 'CP' : 'CR'
// transacoes.tipo
export const TIPO_TRANSACAO: 'despesa' | 'receita' = EH_PAGAR ? 'despesa' : 'receita'
// rótulo curto usado nas telas ("Pagar" / "Receber")
export const TIPO_ROTULO: 'Pagar' | 'Receber' = EH_PAGAR ? 'Pagar' : 'Receber'

export const NOME_SISTEMA = EH_PAGAR ? 'Contas a Pagar' : 'Contas a Receber'
export const NOME_OUTRO_SISTEMA = EH_PAGAR ? 'Contas a Receber' : 'Contas a Pagar'

// slug do card no Hub (systems.slug). A permissão de dados continua sendo
// 'financeiro' (RLS, hub_pode_executar) -- os 3 slugs têm o mesmo acesso.
export const SLUG_HUB = EH_PAGAR ? 'contas-pagar' : 'contas-receber'

export const URL_CONTAS_PAGAR = 'https://contas-pagar-lucenera.pages.dev'
export const URL_CONTAS_RECEBER = 'https://contas-receber-lucenera.pages.dev'
