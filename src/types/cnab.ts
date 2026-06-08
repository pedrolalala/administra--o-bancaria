export type FileType = 'REMESSA' | 'RETORNO'

export interface CnabRecord {
  id: string
  nossoNumero: string
  nf: string
  dataVencimento: string
  valor: number
  pagador: string
  tipo?: 'Liquidado' | 'Confirmado' | 'Outros'
  ocorrencia?: string
  valorRecebido?: number
}

export interface CnabSummary {
  fileType: FileType
  totalRegistros: number
  valorTotal: number
  totalLiquidacoes?: number
  totalConfirmacoes?: number
  valorTotalRecebido?: number
}

export interface CnabData {
  records: CnabRecord[]
  summary: CnabSummary
}
