import { CnabData, CnabRecord, FileType } from '@/types/cnab'

// SPEC-165: leitura CNAB 400 no layout Bradesco de cobrança. As posições
// abaixo são 1-based como no manual do banco; `campo(line, 71, 82)` lê da
// posição 71 até a 82, inclusive. Antes o nosso número era lido em 74-83,
// a "data de pagamento" num trecho que é o nº do documento e o valor do
// título em 127-139 -- nada batia com o arquivo real do banco.
//
// Retorno (registro tipo 1):
//   071-082 nosso número (11 + DV)   109-110 ocorrência   111-116 data ocorrência
//   117-126 nº documento             147-152 vencimento   153-165 valor do título
//   254-266 valor pago               296-301 data crédito 319-328 motivos
// Remessa (registro tipo 1), lida só para conferência na tela antiga:
//   071-081 nosso número   111-120 nº documento   121-126 vencimento
//   127-139 valor          235-274 nome do pagador

const campo = (line: string, inicio: number, fim: number) => line.substring(inicio - 1, fim)

const valorCentavos = (raw: string) => {
  const n = parseInt(raw.trim() || '0', 10)
  return Number.isNaN(n) ? 0 : n / 100
}

// DDMMAA -> AAAA-MM-DD ('' quando vazio/zerado)
export const dataCnabParaIso = (raw: string) => {
  const v = raw.trim()
  if (!v || /^0+$/.test(v) || v.length !== 6) return ''
  return `20${v.substring(4, 6)}-${v.substring(2, 4)}-${v.substring(0, 2)}`
}

const isoParaBr = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '')

const LIQUIDACOES = new Set(['06', '15', '17'])

export function parseCnab400(content: string): CnabData {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const records: CnabRecord[] = []

  let fileType: FileType = 'RETORNO'
  let isHeaderParsed = false

  let totalRegistros = 0
  let valorTotal = 0
  let totalLiquidacoes = 0
  let totalConfirmacoes = 0
  let valorTotalRecebido = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.substring(0, 1) === '0' && !isHeaderParsed) {
      const typeId = line.substring(0, 2)
      const keyword = line.substring(2, 9)

      if (typeId === '01' && keyword === 'REMESSA') {
        fileType = 'REMESSA'
      } else if (typeId === '02' && keyword === 'RETORNO') {
        fileType = 'RETORNO'
      } else {
        throw new Error('Tipo de arquivo não suportado (Não é REMESSA nem RETORNO válido).')
      }
      isHeaderParsed = true
      continue
    }

    if (line.length < 350 || line.substring(0, 1) !== '1') continue

    let record: CnabRecord

    if (fileType === 'RETORNO') {
      const nossoNumero = campo(line, 71, 81).trim()
      const ocorrencia = campo(line, 109, 110)
      const dataOcorrencia = dataCnabParaIso(campo(line, 111, 116))
      const dataCredito = dataCnabParaIso(campo(line, 296, 301))
      const vencimento = dataCnabParaIso(campo(line, 147, 152))
      const valor = valorCentavos(campo(line, 153, 165))
      const valorRecebido = valorCentavos(campo(line, 254, 266))

      let tipo: CnabRecord['tipo'] = 'Outros'
      if (LIQUIDACOES.has(ocorrencia)) {
        tipo = 'Liquidado'
        totalLiquidacoes++
        valorTotalRecebido += valorRecebido
      } else if (ocorrencia === '02') {
        tipo = 'Confirmado'
        totalConfirmacoes++
      } else if (ocorrencia === '03') {
        tipo = 'Rejeitado'
      }

      record = {
        id: `row-${i}-${nossoNumero}`,
        nossoNumero,
        nf: campo(line, 117, 126).trim(),
        dataVencimento: isoParaBr(vencimento),
        valor,
        pagador: '',
        ocorrencia,
        valorRecebido,
        tipo,
        dataOcorrencia,
        dataCredito,
        motivos: campo(line, 319, 328).trim(),
      }
    } else {
      const nossoNumero = campo(line, 71, 81).trim()
      record = {
        id: `row-${i}-${nossoNumero}`,
        nossoNumero,
        nf: campo(line, 111, 120).trim(),
        dataVencimento: isoParaBr(dataCnabParaIso(campo(line, 121, 126))),
        valor: valorCentavos(campo(line, 127, 139)),
        pagador: campo(line, 235, 274).trim(),
      }
    }

    totalRegistros++
    valorTotal += record.valor
    records.push(record)
  }

  if (!isHeaderParsed) {
    throw new Error('Arquivo sem header válido.')
  }

  return {
    records,
    summary: {
      fileType,
      totalRegistros,
      valorTotal,
      totalLiquidacoes: fileType === 'RETORNO' ? totalLiquidacoes : undefined,
      totalConfirmacoes: fileType === 'RETORNO' ? totalConfirmacoes : undefined,
      valorTotalRecebido: fileType === 'RETORNO' ? valorTotalRecebido : undefined,
    },
  }
}
