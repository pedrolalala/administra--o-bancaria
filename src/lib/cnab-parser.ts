import { CnabData, CnabRecord, FileType } from '@/types/cnab'

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

    if (line.length < 350) continue

    const recordType = line.substring(0, 1)

    if (recordType === '1') {
      const nossoNumero = line.substring(73, 83).trim()
      const nf = line.substring(110, 116).trim()

      const rawDate = line.substring(120, 126)
      const day = rawDate.substring(0, 2)
      const month = rawDate.substring(2, 4)
      const year = `20${rawDate.substring(4, 6)}`
      const dataVencimento = rawDate.trim() ? `${day}/${month}/${year}` : ''

      const rawValor = line.substring(126, 139)
      const valor = parseInt(rawValor, 10) / 100

      const pagador = line.substring(318, 348).trim()

      let record: CnabRecord = {
        id: `row-${i}-${nossoNumero}`,
        nossoNumero,
        nf,
        dataVencimento,
        valor,
        pagador,
      }

      totalRegistros++
      valorTotal += valor

      if (fileType === 'RETORNO') {
        const ocorrencia = line.substring(108, 110)
        let tipo: 'Liquidado' | 'Confirmado' | 'Outros' = 'Outros'

        let vrRecebido = 0
        const rawValorRec = line.substring(253, 266)
        if (rawValorRec.trim()) {
          vrRecebido = parseInt(rawValorRec, 10) / 100
        }

        if (ocorrencia === '06') {
          tipo = 'Liquidado'
          totalLiquidacoes++
          valorTotalRecebido += vrRecebido
        } else if (ocorrencia === '02') {
          tipo = 'Confirmado'
          totalConfirmacoes++
        }

        record = {
          ...record,
          ocorrencia,
          valorRecebido: vrRecebido,
          tipo,
        }
      }

      records.push(record)
    }
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
