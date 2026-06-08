export interface CnabRecord {
  id: string
  nossoNumero: string
  ocorrencia: string
  data: string
  valor: number
  pagador: string
  tipo: 'Liquidado' | 'Confirmado' | 'Outros'
}

export interface CnabSummary {
  totalLiquidacoes: number
  totalConfirmacoes: number
  valorTotalRecebido: number
}

export interface CnabData {
  records: CnabRecord[]
  summary: CnabSummary
}
