export type FileType = 'REMESSA' | 'RETORNO'

export interface CnabRecord {
  id: string
  nossoNumero: string
  nf: string
  dataVencimento: string
  valor: number
  pagador: string
  tipo?: 'Liquidado' | 'Confirmado' | 'Rejeitado' | 'Outros'
  ocorrencia?: string
  valorRecebido?: number
  // SPEC-165: data da ocorrência (111-116) e do crédito (296-301) no
  // retorno Bradesco, em ISO (AAAA-MM-DD), e os motivos de rejeição
  // (319-328).
  dataOcorrencia?: string
  dataCredito?: string
  motivos?: string
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
