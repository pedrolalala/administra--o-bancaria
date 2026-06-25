export interface CnabValidationIssue {
  boletoId?: string
  field: string
  message: string
}

const normalizeText = (value: string | number | null | undefined) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s./-]/g, '')
    .toUpperCase()

const padStr = (
  str: string | number | null | undefined,
  length: number,
  padChar = ' ',
  right = true,
) => {
  const value = normalizeText(str).substring(0, length)
  return right ? value.padEnd(length, padChar) : value.padStart(length, padChar)
}

const padNum = (num: number | string | null | undefined, length: number) => {
  const value = String(num || 0)
    .replace(/\D/g, '')
    .substring(0, length)
  return value.padStart(length, '0')
}

const formatData = (isoDate: string) => {
  if (!isoDate) return '000000'
  const [y, m, d] = isoDate.split('-')
  if (!y || !m || !d) return '000000'
  return `${d}${m}${y.substring(2, 4)}`
}

const ensureCnab400Line = (line: string) => line.substring(0, 400).padEnd(400, ' ')

export function validateCnab400Boletos(boletos: any[]): CnabValidationIssue[] {
  const issues: CnabValidationIssue[] = []

  boletos.forEach((boleto) => {
    const prefix = boleto.numero_documento || boleto.nosso_numero || boleto.id

    if (!boleto.nosso_numero) {
      issues.push({
        boletoId: boleto.id,
        field: 'nosso_numero',
        message: `Boleto ${prefix}: informe o nosso número antes de gerar a remessa.`,
      })
    }

    if (!boleto.numero_documento) {
      issues.push({
        boletoId: boleto.id,
        field: 'numero_documento',
        message: `Boleto ${prefix}: informe o número do documento/NF.`,
      })
    }

    if (!boleto.nome_pagador) {
      issues.push({
        boletoId: boleto.id,
        field: 'nome_pagador',
        message: `Boleto ${prefix}: informe o pagador.`,
      })
    }

    if (!boleto.vencimento) {
      issues.push({
        boletoId: boleto.id,
        field: 'vencimento',
        message: `Boleto ${prefix}: informe o vencimento.`,
      })
    }

    if (!boleto.valor || Number(boleto.valor) <= 0) {
      issues.push({
        boletoId: boleto.id,
        field: 'valor',
        message: `Boleto ${prefix}: informe um valor maior que zero.`,
      })
    }

    if (!boleto.empresa_id) {
      issues.push({
        boletoId: boleto.id,
        field: 'empresa_id',
        message: `Boleto ${prefix}: informe a empresa emissora.`,
      })
    }
  })

  return issues
}

export function generateCnab400(boletos: any[], empresaNome: string): string {
  const linhas: string[] = []

  const dataHoje = formatData(new Date().toISOString().split('T')[0])
  const header = ensureCnab400Line(
    '0' + // 1 Identificação
      '1' + // 2 Operação
      padStr('REMESSA', 7) + // 3-9
      '01' + // 10-11 Serviço
      padStr('COBRANCA', 15) + // 12-26
      padStr('', 20) + // 27-46 Código da empresa no banco
      padStr(empresaNome, 30) + // 47-76 Nome da empresa
      '237' + // 77-79 Bradesco
      padStr('BRADESCO', 15) + // 80-94
      dataHoje + // 95-100
      padStr('', 8) + // 101-108
      'MX' + // 109-110
      padNum(1, 7) + // 111-117 Nº sequencial da remessa
      padStr('', 277) + // 118-394
      padNum(1, 6), // 395-400 Sequencial do registro
  )

  linhas.push(header)

  boletos.forEach((boleto, index) => {
    const valorCentavos = Math.round(Number(boleto.valor || 0) * 100)
    const numeroDocumento = boleto.numero_documento || boleto.id

    const detail = ensureCnab400Line(
      '1' + // 1 Identificação detalhe
        padStr('', 19) + // 2-20 Agência/conta: parametrizar por empresa
        padStr('', 17) + // 21-37 Identificação empresa no banco
        padStr(numeroDocumento, 25) + // 38-62 Controle do participante
        '237' + // 63-65 Banco
        '0' + // 66 Multa
        padNum(0, 4) + // 67-70 Percentual multa
        padStr(boleto.nosso_numero, 11) + // 71-81 Nosso número
        padStr('', 38) + // 82-119 Uso banco/empresa
        formatData(boleto.vencimento) + // 120-125 Vencimento
        padNum(valorCentavos, 13) + // 126-138 Valor
        padStr('', 178) + // 139-316 Dados bancários complementares
        padStr(boleto.nome_pagador, 30) + // 317-346 Pagador
        padStr('', 48) + // 347-394 Complemento
        padNum(index + 2, 6), // 395-400 Sequencial do registro
    )

    linhas.push(detail)
  })

  const trailer = ensureCnab400Line(
    '9' + padStr('', 393) + padNum(boletos.length + 2, 6),
  )

  linhas.push(trailer)

  return `${linhas.join('\r\n')}\r\n`
}
