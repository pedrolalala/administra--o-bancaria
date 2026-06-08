import { CnabData, CnabRecord } from '@/types/cnab'

export function parseCnab400(content: string): CnabData {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const records: CnabRecord[] = []

  let totalLiquidacoes = 0
  let totalConfirmacoes = 0
  let valorTotalRecebido = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Header record (Type 0)
    if (line.substring(0, 1) === '0') {
      continue
    }

    // Skip if line is too short, but be somewhat forgiving for trailing spaces
    if (line.length < 390) continue

    const recordType = line.substring(0, 1)

    // We only care about Detail records (Type 1)
    if (recordType === '1') {
      const nossoNumero = line.substring(70, 82).trim()
      const ocorrencia = line.substring(108, 110)

      const rawDate = line.substring(110, 116)
      const day = rawDate.substring(0, 2)
      const month = rawDate.substring(2, 4)
      const year = `20${rawDate.substring(4, 6)}` // Assuming 2000+
      const data = `${day}/${month}/${year}`

      const rawValor = line.substring(253, 266)
      const valor = parseInt(rawValor, 10) / 100

      const pagador = line.substring(324, 354).trim()

      let tipo: 'Liquidado' | 'Confirmado' | 'Outros' = 'Outros'

      if (ocorrencia === '06') {
        tipo = 'Liquidado'
        totalLiquidacoes++
        valorTotalRecebido += valor
      } else if (ocorrencia === '02') {
        tipo = 'Confirmado'
        totalConfirmacoes++
      }

      records.push({
        id: `row-${i}-${nossoNumero}`,
        nossoNumero,
        ocorrencia,
        data,
        valor,
        pagador,
        tipo,
      })
    }
  }

  return {
    records,
    summary: {
      totalLiquidacoes,
      totalConfirmacoes,
      valorTotalRecebido,
    },
  }
}
