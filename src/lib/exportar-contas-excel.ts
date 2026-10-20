// SPEC-210: exporta para Excel (.xlsx) as contas em aberto que estão na tela,
// com exatamente as 11 colunas da tabela, na mesma ordem e com os mesmos títulos.
// A biblioteca (exceljs) só é carregada no clique, para não pesar a tela.

export interface LinhaContaExportar {
  empresa: string
  tipo: 'Pagar' | 'Receber'
  categoria: string
  pessoa: string
  descricao: string
  dtEmissao: string | null
  dtVencimento: string | null
  diasAtraso: number | null
  valor: number
  duplicata: number | null
  parcela: number | null
  totalParcelas: number | null
}

// Data 'AAAA-MM-DD' (ou com hora) como data de verdade no Excel, sem fuso.
function paraData(d: string | null): Date | null {
  if (!d) return null
  const [ano, mes, dia] = d.split('T')[0].split('-').map(Number)
  if (!ano || !mes || !dia) return null
  return new Date(Date.UTC(ano, mes - 1, dia))
}

export async function exportarContasExcel(tipo: 'Pagar' | 'Receber', linhas: LinhaContaExportar[]) {
  const ExcelJS = (await import('exceljs')).default
  const titulo = tipo === 'Pagar' ? 'Contas a Pagar' : 'Contas a Receber'

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(titulo, { views: [{ state: 'frozen', ySplit: 1 }] })

  ws.columns = [
    { header: 'Empresa', key: 'empresa', width: 22 },
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'Categoria', key: 'categoria', width: 28 },
    { header: 'Pessoa', key: 'pessoa', width: 36 },
    { header: 'Descrição', key: 'descricao', width: 44 },
    { header: 'Emissão', key: 'emissao', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Vencimento', key: 'vencimento', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Dias em Atraso', key: 'dias', width: 15, style: { numFmt: '0' } },
    { header: 'Valor', key: 'valor', width: 16, style: { numFmt: '"R$" #,##0.00' } },
    { header: 'Nº Duplicata', key: 'duplicata', width: 14 },
    { header: 'Parcela/Total', key: 'parcela', width: 14 },
  ]

  for (const l of linhas) {
    ws.addRow({
      empresa: l.empresa,
      tipo: l.tipo,
      categoria: l.categoria,
      pessoa: l.pessoa,
      descricao: l.descricao,
      emissao: paraData(l.dtEmissao),
      vencimento: paraData(l.dtVencimento),
      // como na tela: vazio quando não está em atraso
      dias: l.diasAtraso && l.diasAtraso > 0 ? l.diasAtraso : null,
      valor: Math.round(l.valor * 100) / 100,
      duplicata: l.duplicata ?? '-',
      // texto, para o Excel não transformar "2/5" em data
      parcela: `${l.parcela ?? '-'}/${l.totalParcelas ?? '-'}`,
    })
  }

  const cabecalho = ws.getRow(1)
  cabecalho.font = { bold: true }
  cabecalho.alignment = { vertical: 'middle' }
  cabecalho.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
  })
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 11 } }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const hoje = new Date()
  const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(
    hoje.getDate(),
  ).padStart(2, '0')}`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${titulo.replace(/ /g, '_')}_${data}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
