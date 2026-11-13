import { supabase } from '@/lib/supabase/client'
import { TIPO_OPERACAO } from '@/lib/modo-sistema'

// SPEC-258 (Financeiro) Fase 5: as telas Contas a Pagar / Contas a Receber passam a ler e baixar pelo modelo novo
// (views vw_financeiro_duplicatas e funções financeiro_baixar_lote / financeiro_estornar). As regras ficam no banco; aqui só a chamada.

const PAGE = 1000

/** Parcelas do modelo novo desta tela (CP ou CR) no mesmo formato da grade de Consultar Duplicatas.
 *  Não repete o que a tela já mostra pelo boleto (boleto_id preenchido). Previstas (pedido ainda não entregue) e canceladas ficam de fora. */
export async function buscarDuplicatasNovas(comPagas: boolean): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += PAGE) {
    let q = (supabase as any)
      .from('vw_financeiro_duplicatas')
      .select('*')
      .eq('tipo_operacao', TIPO_OPERACAO)
      .is('boleto_id', null)
      .order('vencimento', { ascending: true })
      .order('parcela_id', { ascending: true })
      .range(from, from + PAGE - 1)
    q = comPagas ? q.in('status', ['Pendente', 'Pago']) : q.eq('status', 'Pendente')
    const { data, error } = await q
    if (error) throw error
    for (const r of data || []) out.push(paraLinhaDaGrade(r))
    if (!data || data.length < PAGE) break
  }
  return out
}

/** Uma linha da view vira uma linha da grade (mesmos nomes de campo que o boleto/transação já usavam). */
export function paraLinhaDaGrade(r: any) {
  return {
    id: `fp:${r.parcela_id}`,
    _fonte: 'financeiro',
    _parcelaId: r.parcela_id as string,
    tipo_operacao: r.tipo_operacao,
    tipo: r.tipo,
    // SPEC-270: 'adiantamento' = antecipação de pagamento (selo na grade)
    especie: r.especie ?? null,
    // SPEC-290: duplicata (ex.: da Connect) já usada para cobrir uma nota de compra do sistema: "Pedido 1985 / NF 11221" (só leitura)
    pago_antecipado: (r.pago_antecipado as string | null) ?? null,
    status: r.status === 'Pago' ? 'Pago' : 'Pendente',
    numero_documento: r.numero_documento || '',
    num_parcela: r.num_parcela,
    total_parcelas: r.total_parcelas,
    venda: r.venda || '',
    fatura: r.fatura || '',
    nome_pagador: r.nome_pagador || '',
    emissao: r.emissao,
    vencimento: r.vencimento,
    data_pagamento: r.data_pagamento,
    valor: r.valor,
    valor_pago: r.valor_pago,
    juros_multa: r.juros_multa,
    desconto: r.desconto,
    forma_pagamento: r.forma_pagamento,
    observacao: r.observacao,
    perfil: r.perfil,
    empresas: r.empresa_nome ? { nome: r.empresa_nome } : null,
    contato_id: r.contato_id ?? null,
    // SPEC-288 (E): a busca por projeto da consulta precisa do projeto da própria parcela (a linha do financeiro novo não traz orcamentos)
    projeto_id: r.projeto_id ?? null,
    orcamentos: null,
    conta_grupo_id: null,
    nosso_numero: null,
  }
}

/** boleto -> parcela do modelo novo (só os boletos que o modelo novo espelha: venda aprovada e nota de entrada). */
export async function mapaBoletoParcela(): Promise<Map<string, string>> {
  const { data, error } = await (supabase as any)
    .from('vw_financeiro_duplicatas')
    .select('boleto_id, parcela_id')
    .eq('tipo_operacao', TIPO_OPERACAO)
    .not('boleto_id', 'is', null)
  if (error) throw error
  return new Map((data || []).map((r: any) => [r.boleto_id as string, r.parcela_id as string]))
}

export interface ContaBancaria {
  id: string
  nome: string
  empresa_id: string | null
}

export async function buscarContasBancarias(): Promise<ContaBancaria[]> {
  const { data, error } = await (supabase as any)
    .from('contas_bancarias')
    .select('id, nome, empresa_id')
    .order('nome', { ascending: true })
  if (error) throw error
  return (data || []) as ContaBancaria[]
}

/** Baixa várias parcelas de uma vez (tudo ou nada). Valor pago = parcela − desconto + juros, igual à tela antiga. */
export async function baixarLote(args: {
  parcelaIds: string[]
  data: string
  forma: string
  contaId: string
  juros: number
  desconto: number
  observacao?: string
}): Promise<{ parcelas: number; dinheiro_total: number }> {
  const { data, error } = await (supabase as any).rpc('financeiro_baixar_lote', {
    p_parcelas: args.parcelaIds,
    p_data: args.data,
    p_forma: args.forma,
    p_conta: args.contaId,
    p_juros: args.juros,
    p_desconto: args.desconto,
    p_comprovante_url: null,
    p_observacao: args.observacao?.trim() || null,
  })
  if (error) throw error
  return data
}

/** Estorna todas as baixas que ainda estão de pé nas parcelas (a baixa nunca é apagada: o estorno fica no histórico). */
export async function estornarParcelas(parcelaIds: string[], motivo: string): Promise<number> {
  if (!motivo.trim()) throw new Error('Informe o motivo do estorno.')
  const { data, error } = await (supabase as any)
    .from('financeiro_baixas')
    .select('id, parcela_id, tipo, estorno_de, criado_em')
    .in('parcela_id', parcelaIds)
  if (error) throw error
  const linhas = (data || []) as any[]
  const jaEstornadas = new Set(linhas.filter((b) => b.estorno_de).map((b) => b.estorno_de as string))
  const ativas = linhas
    .filter((b) => b.tipo !== 'estorno' && !jaEstornadas.has(b.id))
    .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)))
  for (const b of ativas) {
    const { error: e2 } = await (supabase as any).rpc('financeiro_estornar', { p_baixa: b.id, p_motivo: motivo.trim() })
    if (e2) throw e2
  }
  return ativas.length
}

/** SPEC-270 Fase 1 (só Contas a Receber): lança uma antecipação de pagamento já recebida na data (título adiantamento + baixa). */
export async function lancarAntecipacao(args: {
  empresaId: string
  perfil: string | null
  clienteId: string
  responsavelId: string
  emissao: string
  dataPagamento: string
  valor: number
  planoContasId: string
  contaBancariaId: string
  forma: string | null
  observacao: string | null
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc('financeiro_lancar_antecipacao', {
    p_natureza: 'receber',
    p_empresa_id: args.empresaId,
    p_perfil: args.perfil,
    p_contato_id: args.clienteId,
    p_responsavel_id: args.responsavelId,
    p_emissao: args.emissao,
    p_data_pagamento: args.dataPagamento,
    p_valor: args.valor,
    p_plano_contas_id: args.planoContasId,
    p_conta_bancaria_id: args.contaBancariaId,
    p_forma: args.forma,
    p_observacao: args.observacao,
  })
  if (error) throw error
  return data as string
}

export interface ParcelaDoAcordo {
  vencimento: string // aaaa-mm-dd
  valor: number
  forma?: string
}

/** SPEC-287: acordo (renegociação). As parcelas de origem ficam 'renegociadas' (nunca apagadas) e nasce um título novo; tudo numa transação no banco. */
export async function criarAcordo(
  parcelaIds: string[],
  plano: ParcelaDoAcordo[],
  desconto: number,
  motivo: string,
): Promise<{ grupo_acordo: number; titulo_id: string; parcelas_novas: number; parcelas_origem: number; com_boleto_emitido: number }> {
  const { data, error } = await (supabase as any).rpc('financeiro_criar_acordo', {
    p_parcelas: parcelaIds,
    p_novo_plano: plano,
    p_desconto: desconto || 0,
    p_motivo: motivo.trim(),
  })
  if (error) throw error
  return data
}

/** SPEC-297: edita vencimento/valor/descrição de uma parcela aberta do financeiro (e do boleto ligado). Justificativa obrigatória; fica na auditoria. */
export async function editarParcela(args: {
  parcelaId: string
  vencimento: string
  valor: number
  descricao: string
  motivo: string
}): Promise<void> {
  if (!args.motivo.trim()) throw new Error('Informe a justificativa da alteração.')
  const { error } = await (supabase as any).rpc('financeiro_editar_parcela', {
    p_parcela: args.parcelaId,
    p_vencimento: args.vencimento,
    p_valor: args.valor,
    p_descricao: args.descricao,
    p_motivo: args.motivo.trim(),
  })
  if (error) throw error
}

/** SPEC-297: apaga (cancela) uma conta aberta. Com parcela no financeiro cancela a parcela (e o título, se for a última); boleto avulso vai para o backup.
 *  Justificativa obrigatória; fica na auditoria. Conta com baixa: estornar antes. */
export async function apagarConta(args: { parcelaId?: string | null; boletoId?: string | null; motivo: string }): Promise<void> {
  if (!args.motivo.trim()) throw new Error('Informe a justificativa da exclusão.')
  const { error } = args.parcelaId
    ? await (supabase as any).rpc('financeiro_apagar_parcela', { p_parcela: args.parcelaId, p_motivo: args.motivo.trim() })
    : await (supabase as any).rpc('boleto_apagar_avulso', { p_boleto: args.boletoId, p_motivo: args.motivo.trim() })
  if (error) throw error
}
