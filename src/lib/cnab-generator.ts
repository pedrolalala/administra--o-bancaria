export function generateCnab400(boletos: any[], empresaNome: string): string {
  const padStr = (str: string, length: number, padChar = ' ', right = true) => {
    let s = (str || '').toString().substring(0, length)
    if (right) return s.padEnd(length, padChar)
    return s.padStart(length, padChar)
  }

  const padNum = (num: number | string, length: number) => {
    let s = (num || 0).toString().replace(/\D/g, '').substring(0, length)
    return s.padStart(length, '0')
  }

  const formatData = (isoDate: string) => {
    if (!isoDate) return '000000'
    const [y, m, d] = isoDate.split('-')
    return `${d}${m}${y.substring(2, 4)}`
  }

  const linhas: string[] = []

  // Header
  const dataHoje = formatData(new Date().toISOString().split('T')[0])
  const header =
    '0' + // 1 Identificação
    '1' + // 2 Operação
    padStr('REMESSA', 7) + // 3-9
    '01' + // 10-11
    padStr('COBRANCA', 15) + // 12-26
    padStr('', 20) + // 27-46 Cod Empresa
    padStr(empresaNome, 30) + // 47-76 Nome Empresa
    '237' + // 77-79 Bradesco
    padStr('BRADESCO', 15) + // 80-94
    dataHoje + // 95-100
    padStr('', 8) + // 101-108
    'MX' + // 109-110
    padNum(1, 7) + // 111-117 Num Seq Remessa
    padStr('', 277) + // 118-394
    padNum(1, 6) // 395-400 Seq

  linhas.push(header)

  // Details
  boletos.forEach((b, index) => {
    const valorCentavos = Math.round(parseFloat(b.valor) * 100)
    const detail =
      '1' + // 1
      padStr('', 19) + // 2-20 Agencia/Conta
      padStr('', 17) + // 21-37 Identificação Empresa
      padStr(b.numero_documento || '', 25) + // 38-62 Numero Controle
      '237' + // 63-65 Banco
      '0' + // 66 Multa
      padNum(0, 4) + // 67-70 Perc Multa
      padStr(b.nosso_numero, 11) + // 71-81 Nosso Numero
      padStr('', 38) + // 82-119
      formatData(b.vencimento) + // 120-126
      padNum(valorCentavos, 13) + // 127-139
      padStr('', 178) + // 140-317
      padStr(b.nome_pagador, 30) + // 318-347 Pagador
      padStr('', 47) + // 348-394
      padNum(index + 2, 6) // 395-400 Seq

    linhas.push(detail)
  })

  return linhas.join('\r\n')
}
