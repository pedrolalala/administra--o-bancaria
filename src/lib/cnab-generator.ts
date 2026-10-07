// SPEC-165: remessa CNAB 400 no layout Bradesco de cobrança. A versão
// anterior deixava em branco código da empresa, agência/conta/carteira,
// ocorrência, espécie, emissão e CPF/CNPJ/endereço/CEP do pagador, punha o
// nome do pagador na posição 317 e mandava o nosso número sem dígito --
// o banco rejeitaria o arquivo. Posições abaixo são 1-based como no manual.
//
// CONFIRMAR com o manual da carteira contratada antes da 1ª remessa real
// (o Bradesco pode pedir ajustes de instrução/espécie por contrato).

export interface CnabValidationIssue {
  boletoId?: string
  field: string
  message: string
}

export interface ContaCobranca {
  nome: string
  agencia: string | null
  agencia_digito: string | null
  conta: string | null
  conta_digito: string | null
  carteira: string | null
  codigo_empresa_banco: string | null
}

export interface PagadorCobranca {
  nome: string
  documento: string // CPF (11) ou CNPJ (14), só dígitos
  endereco: string
  cep: string // 8 dígitos
}

export interface BoletoRemessa {
  id: string
  nosso_numero_banco: string | null // 11 dígitos, atribuído por reservar_remessa_cnab
  numero_documento: string | null
  vencimento: string | null // AAAA-MM-DD
  emissao: string | null // AAAA-MM-DD
  valor: number | string | null
  pagador: PagadorCobranca | null
}

const normalizeText = (value: string | number | null | undefined) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s./-]/g, ' ')
    .toUpperCase()

const alfa = (str: string | number | null | undefined, length: number) =>
  normalizeText(str).substring(0, length).padEnd(length, ' ')

const num = (value: number | string | null | undefined, length: number) =>
  String(value ?? '')
    .replace(/\D/g, '')
    .slice(-length)
    .padStart(length, '0')

const soDigitos = (v: string | null | undefined) => (v || '').replace(/\D/g, '')

const dataDDMMAA = (iso: string | null | undefined) => {
  if (!iso) return '000000'
  const [y, m, d] = iso.split('T')[0].split('-')
  if (!y || !m || !d) return '000000'
  return `${d}${m}${y.substring(2, 4)}`
}

const centavos = (valor: number | string | null | undefined, length: number) =>
  num(Math.round(Number(valor || 0) * 100), length)

const linha400 = (line: string) => {
  if (line.length !== 400) {
    // Defesa: cada campo acima tem tamanho fixo; se a soma não der 400 é bug.
    throw new Error(`Linha CNAB com ${line.length} posições (esperado 400).`)
  }
  return line
}

/**
 * Dígito do nosso número Bradesco: módulo 11, base 7, sobre
 * carteira (2) + nosso número (11). Resto 0 -> "0"; resto 1 -> "P".
 */
export function dvNossoNumeroBradesco(carteira: string, nossoNumero: string): string {
  const base = num(carteira, 2) + num(nossoNumero, 11)
  let peso = 2
  let soma = 0
  for (let i = base.length - 1; i >= 0; i--) {
    soma += Number(base[i]) * peso
    peso = peso === 7 ? 2 : peso + 1
  }
  const resto = soma % 11
  if (resto === 0) return '0'
  if (resto === 1) return 'P'
  return String(11 - resto)
}

export function validateContaCobranca(conta: ContaCobranca | null): string[] {
  if (!conta) return ['Selecione a conta de cobrança.']
  const faltando: string[] = []
  if (!soDigitos(conta.agencia)) faltando.push('agência')
  if (!soDigitos(conta.conta)) faltando.push('conta')
  if (!(conta.conta_digito || '').trim()) faltando.push('dígito da conta')
  if (!soDigitos(conta.carteira)) faltando.push('carteira')
  if (!soDigitos(conta.codigo_empresa_banco)) faltando.push('código da empresa no banco')
  return faltando.length
    ? [`Conta ${conta.nome}: preencha ${faltando.join(', ')} em "Dados de cobrança".`]
    : []
}

export function validateCnab400Boletos(boletos: BoletoRemessa[]): CnabValidationIssue[] {
  const issues: CnabValidationIssue[] = []

  boletos.forEach((b) => {
    const ref = b.numero_documento || b.id.slice(0, 8)
    const add = (field: string, message: string) =>
      issues.push({ boletoId: b.id, field, message: `Boleto ${ref}: ${message}` })

    if (!b.numero_documento) add('numero_documento', 'informe o número do documento.')
    if (!b.vencimento) add('vencimento', 'informe o vencimento.')
    if (!b.valor || Number(b.valor) <= 0) add('valor', 'informe um valor maior que zero.')

    const p = b.pagador
    if (!p || !p.nome.trim()) add('pagador', 'pagador sem nome.')
    const doc = soDigitos(p?.documento)
    if (doc.length !== 11 && doc.length !== 14)
      add('documento', `pagador "${p?.nome || '-'}" sem CPF/CNPJ válido no cadastro.`)
    if (!p?.endereco.trim())
      add('endereco', `pagador "${p?.nome || '-'}" sem endereço no cadastro.`)
    if (soDigitos(p?.cep).length !== 8)
      add('cep', `pagador "${p?.nome || '-'}" sem CEP válido no cadastro.`)
  })

  return issues
}

export function generateCnab400(
  boletos: BoletoRemessa[],
  conta: ContaCobranca,
  empresaNome: string,
  sequencialRemessa: number,
  hoje: Date = new Date(),
): string {
  const linhas: string[] = []
  const dataHoje = dataDDMMAA(hoje.toISOString().slice(0, 10))
  const carteira = num(conta.carteira, 3)

  // Header (tipo 0)
  linhas.push(
    linha400(
      '0' + // 001
        '1' + // 002 operação: remessa
        'REMESSA' + // 003-009
        '01' + // 010-011 serviço: cobrança
        alfa('COBRANCA', 15) + // 012-026
        num(conta.codigo_empresa_banco, 20) + // 027-046 código da empresa
        alfa(empresaNome, 30) + // 047-076
        '237' + // 077-079
        alfa('BRADESCO', 15) + // 080-094
        dataHoje + // 095-100
        alfa('', 8) + // 101-108
        'MX' + // 109-110
        num(sequencialRemessa, 7) + // 111-117 sequencial da remessa
        alfa('', 277) + // 118-394
        num(1, 6), // 395-400
    ),
  )

  boletos.forEach((b, index) => {
    const p = b.pagador as PagadorCobranca
    const doc = soDigitos(p.documento)
    const cep = soDigitos(p.cep)
    const nossoNumero = num(b.nosso_numero_banco, 11)

    linhas.push(
      linha400(
        '1' + // 001
          num(0, 5) + // 002-006 agência de débito (sem débito automático)
          '0' + // 007
          num(0, 5) + // 008-012 razão da conta de débito
          num(0, 7) + // 013-019
          '0' + // 020
          '0' + // 021-037 identificação da empresa: 0 + carteira(3) + agência(5) + conta(7) + DV(1)
          carteira +
          num(conta.agencia, 5) +
          num(conta.conta, 7) +
          alfa(conta.conta_digito, 1) +
          alfa(b.id, 25) + // 038-062 nº de controle do participante (volta no retorno)
          '000' + // 063-065 banco do débito automático (não usa)
          '0' + // 066 multa: sem multa
          num(0, 4) + // 067-070
          nossoNumero + // 071-081
          dvNossoNumeroBradesco(carteira.slice(-2), nossoNumero) + // 082
          num(0, 10) + // 083-092 desconto bonificação/dia
          '2' + // 093 emissão do boleto: cliente emite, banco processa
          'N' + // 094 débito automático: não
          alfa('', 10) + // 095-104
          ' ' + // 105 rateio
          '2' + // 106 aviso de débito: não emite
          alfa('', 2) + // 107-108
          '01' + // 109-110 ocorrência: remessa (registro)
          alfa(b.numero_documento, 10) + // 111-120 nº do documento
          dataDDMMAA(b.vencimento) + // 121-126
          centavos(b.valor, 13) + // 127-139
          '000' + // 140-142 banco encarregado
          num(0, 5) + // 143-147 agência depositária
          '01' + // 148-149 espécie: duplicata mercantil
          'N' + // 150 aceite
          dataDDMMAA(b.emissao || hoje.toISOString().slice(0, 10)) + // 151-156 emissão
          '00' + // 157-158 1ª instrução
          '00' + // 159-160 2ª instrução
          num(0, 13) + // 161-173 juros/dia de atraso
          num(0, 6) + // 174-179 data limite desconto
          num(0, 13) + // 180-192 valor do desconto
          num(0, 13) + // 193-205 IOF
          num(0, 13) + // 206-218 abatimento
          (doc.length === 14 ? '02' : '01') + // 219-220 tipo de inscrição do pagador
          num(doc, 14) + // 221-234
          alfa(p.nome, 40) + // 235-274
          alfa(p.endereco, 40) + // 275-314
          alfa('', 12) + // 315-326 1ª mensagem
          cep.substring(0, 5) + // 327-331
          cep.substring(5, 8) + // 332-334
          alfa('', 60) + // 335-394 sacador avalista / 2ª mensagem
          num(index + 2, 6), // 395-400
      ),
    )
  })

  // Trailer (tipo 9)
  linhas.push(linha400('9' + alfa('', 393) + num(boletos.length + 2, 6)))

  return `${linhas.join('\r\n')}\r\n`
}
