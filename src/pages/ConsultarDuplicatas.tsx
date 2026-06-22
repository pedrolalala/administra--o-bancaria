import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { differenceInDays, parseISO } from 'date-fns'
import { Pencil, Search, Play, Handshake, Download, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function ConsultarDuplicatas() {
  const { toast } = useToast()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [filtros, setFiltros] = useState({
    tipo: 'Pagar',
    operacao: 'Todas',
    empresa: 'ISLIGHT',
    perfilEmpresa: 'RIBEIRAO PRETO',
    tipoSituacao: 'Todos',
    tipoData: 'Vencimento',
    dataInicio: '2026-06-01',
    dataFinal: '2026-06-30',
    venda: '',
    fatura: '',
    duplicata: '',
    boleto: '',
    pessoa: '',
    funcionario: 'Funcionario',
    codigo: '430',
  })

  const fetchData = async () => {
    setLoading(true)
    const { data: result, error } = await supabase.from('boletos').select(`
      *,
      empresas (nome)
    `)

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    } else {
      setData(result || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredData = useMemo(() => {
    return data.filter((d) => {
      if (filtros.tipoSituacao !== 'Todos') {
        if (filtros.tipoSituacao === 'Aberto' && d.status !== 'Pendente') return false
        if (filtros.tipoSituacao === 'Pago' && d.status !== 'Pago') return false
        if (
          filtros.tipoSituacao === 'Vencido' &&
          d.status === 'Pendente' &&
          d.vencimento &&
          new Date(d.vencimento) < new Date()
        )
          return false
      }
      if (filtros.pessoa && !d.nome_pagador?.toLowerCase().includes(filtros.pessoa.toLowerCase()))
        return false
      if (
        filtros.duplicata &&
        !d.numero_documento?.toLowerCase().includes(filtros.duplicata.toLowerCase())
      )
        return false

      if (filtros.empresa && filtros.empresa !== 'Todas') {
        if (d.empresas?.nome !== filtros.empresa) return false
      }
      return true
    })
  }, [data, filtros])

  const totais = useMemo(() => {
    return filteredData.reduce(
      (acc, curr) => {
        const isVencido =
          curr.status === 'Pendente' && curr.vencimento && new Date(curr.vencimento) < new Date()
        if (isVencido) acc.vencido += Number(curr.valor || 0)
        if (curr.status === 'Pendente' && !isVencido) acc.aVencer += Number(curr.valor || 0)
        if (curr.status === 'Pendente') acc.aberto += Number(curr.valor || 0)
        if (curr.status === 'Pago') acc.pago += Number(curr.valor_pago || curr.valor || 0)
        acc.total += Number(curr.valor || 0)
        return acc
      },
      { vencido: 0, aVencer: 0, aberto: 0, pago: 0, total: 0 },
    )
  }, [filteredData])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  const formatDate = (d: string) => {
    if (!d) return ''
    const [year, month, day] = d.split('T')[0].split('-')
    return `${day}/${month}/${year}`
  }

  const getAtraso = (venc: string, status: string) => {
    if (status === 'Pago' || !venc) return ''
    const days = differenceInDays(new Date(), parseISO(venc))
    return days > 0 ? days : ''
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] w-full bg-slate-50 overflow-hidden text-sm">
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-800">Consultar Duplicatas</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
          >
            <Pencil className="h-4 w-4" />
            <span className="text-[10px]">Editar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
            onClick={fetchData}
          >
            <Search className="h-4 w-4" />
            <span className="text-[10px]">Localizar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
          >
            <Play className="h-4 w-4" />
            <span className="text-[10px]">Executar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
          >
            <Handshake className="h-4 w-4" />
            <span className="text-[10px]">Acordo</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
          >
            <Download className="h-4 w-4" />
            <span className="text-[10px]">Exportar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
          >
            <Info className="h-4 w-4" />
            <span className="text-[10px]">Info</span>
          </Button>
        </div>
      </div>

      <div className="p-3 border-b bg-slate-100/80 shrink-0">
        <div className="font-semibold text-xs mb-2 text-slate-700">Informações da Conta</div>
        <div className="grid grid-cols-12 gap-3 mb-3">
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Tipo</label>
            <Select value={filtros.tipo} onValueChange={(v) => setFiltros({ ...filtros, tipo: v })}>
              <SelectTrigger className="h-7 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pagar">Pagar</SelectItem>
                <SelectItem value="Receber">Receber</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Operação</label>
            <Select
              value={filtros.operacao}
              onValueChange={(v) => setFiltros({ ...filtros, operacao: v })}
            >
              <SelectTrigger className="h-7 text-xs bg-white">
                <SelectValue placeholder="-" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas</SelectItem>
                <SelectItem value="Venda">Venda</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Empresa</label>
            <Select
              value={filtros.empresa}
              onValueChange={(v) => setFiltros({ ...filtros, empresa: v })}
            >
              <SelectTrigger className="h-7 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas</SelectItem>
                <SelectItem value="ISLIGHT">ISLIGHT</SelectItem>
                <SelectItem value="SLIDE">SLIDE</SelectItem>
                <SelectItem value="FOC">FOC</SelectItem>
                <SelectItem value="LUCENERA">LUCENERA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-slate-500 font-medium uppercase">
              Perfil Empresa
            </label>
            <Select
              value={filtros.perfilEmpresa}
              onValueChange={(v) => setFiltros({ ...filtros, perfilEmpresa: v })}
            >
              <SelectTrigger className="h-7 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RIBEIRAO PRETO">RIBEIRAO PRETO</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-slate-500 font-medium uppercase">
              Tipo situação
            </label>
            <Select
              value={filtros.tipoSituacao}
              onValueChange={(v) => setFiltros({ ...filtros, tipoSituacao: v })}
            >
              <SelectTrigger className="h-7 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="Aberto">Aberto</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="Vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Tipo data</label>
            <Select
              value={filtros.tipoData}
              onValueChange={(v) => setFiltros({ ...filtros, tipoData: v })}
            >
              <SelectTrigger className="h-7 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Vencimento">Vencimento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Data início</label>
            <Input
              type="date"
              className="h-7 text-xs px-1 bg-white"
              value={filtros.dataInicio}
              onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
            />
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Data final</label>
            <Input
              type="date"
              className="h-7 text-xs px-1 bg-white"
              value={filtros.dataFinal}
              onChange={(e) => setFiltros({ ...filtros, dataFinal: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Venda</label>
            <Input
              className="h-7 text-xs bg-white"
              value={filtros.venda}
              onChange={(e) => setFiltros({ ...filtros, venda: e.target.value })}
            />
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Fatura</label>
            <Input
              className="h-7 text-xs bg-white"
              value={filtros.fatura}
              onChange={(e) => setFiltros({ ...filtros, fatura: e.target.value })}
            />
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Duplicata</label>
            <Input
              className="h-7 text-xs bg-white"
              value={filtros.duplicata}
              onChange={(e) => setFiltros({ ...filtros, duplicata: e.target.value })}
            />
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Boleto</label>
            <Input
              className="h-7 text-xs bg-white"
              value={filtros.boleto}
              onChange={(e) => setFiltros({ ...filtros, boleto: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Pessoa</label>
            <Select
              value={filtros.funcionario}
              onValueChange={(v) => setFiltros({ ...filtros, funcionario: v })}
            >
              <SelectTrigger className="h-7 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Funcionario">Funcionário</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
            <Input
              className="h-7 text-xs bg-white"
              value={filtros.codigo}
              onChange={(e) => setFiltros({ ...filtros, codigo: e.target.value })}
            />
          </div>
          <div className="col-span-5 flex gap-2">
            <Input
              className="h-7 text-xs bg-white w-full"
              placeholder="Buscar por pessoa..."
              value={filtros.pessoa}
              onChange={(e) => setFiltros({ ...filtros, pessoa: e.target.value })}
            />
            <Button variant="outline" size="icon" className="h-7 w-7 shrink-0 bg-white">
              <span className="text-[10px]">...</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white relative">
        <Table className="w-full text-xs whitespace-nowrap">
          <TableHeader className="sticky top-0 bg-slate-100 z-10 shadow-sm border-b">
            <TableRow className="h-8">
              <TableHead className="w-8 p-1 text-center font-medium">X</TableHead>
              <TableHead className="w-8 p-1 text-center font-medium">T</TableHead>
              <TableHead className="w-8 p-1 text-center font-medium">O</TableHead>
              <TableHead className="w-8 p-1 text-center font-medium">A</TableHead>
              <TableHead className="p-1 font-medium">Duplicata</TableHead>
              <TableHead className="p-1 text-right font-medium">Par.</TableHead>
              <TableHead className="p-1 text-right font-medium">Tot.</TableHead>
              <TableHead className="p-1 text-right font-medium">Venda</TableHead>
              <TableHead className="p-1 text-right font-medium">Fatura</TableHead>
              <TableHead className="p-1 font-medium">Pessoa</TableHead>
              <TableHead className="p-1 text-center font-medium">Emissão</TableHead>
              <TableHead className="p-1 text-center font-medium">Vencimento</TableHead>
              <TableHead className="p-1 text-center font-medium">Atraso</TableHead>
              <TableHead className="p-1 text-center font-medium">Pagamento</TableHead>
              <TableHead className="p-1 text-right font-medium">Vl. Parcela</TableHead>
              <TableHead className="p-1 text-right font-medium">Vl. Pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={16} className="text-center py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={16} className="text-center py-8 text-muted-foreground">
                  Nenhum registro encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((d) => (
                <TableRow key={d.id} className="h-7 hover:bg-primary/5 transition-colors group">
                  <TableCell className="p-1 text-center border-r">
                    <input type="checkbox" className="cursor-pointer" />
                  </TableCell>
                  <TableCell className="p-1 text-center border-r text-slate-500">A</TableCell>
                  <TableCell className="p-1 text-center border-r text-slate-500">N</TableCell>
                  <TableCell className="p-1 text-center border-r font-medium text-slate-700">
                    {d.status === 'Pago' ? 'P' : 'A'}
                  </TableCell>
                  <TableCell className="p-1 border-r font-mono">
                    {d.numero_documento || '-'}
                  </TableCell>
                  <TableCell className="p-1 text-right border-r">1</TableCell>
                  <TableCell className="p-1 text-right border-r">1</TableCell>
                  <TableCell className="p-1 text-right border-r">0</TableCell>
                  <TableCell className="p-1 text-right border-r">-</TableCell>
                  <TableCell className="p-1 border-r truncate max-w-[200px] font-medium">
                    {d.nome_pagador}
                  </TableCell>
                  <TableCell className="p-1 text-center border-r bg-teal-50/30 group-hover:bg-teal-50/50 transition-colors">
                    {formatDate(d.created_at || d.vencimento)}
                  </TableCell>
                  <TableCell className="p-1 text-center border-r">
                    {formatDate(d.vencimento)}
                  </TableCell>
                  <TableCell className="p-1 text-center border-r font-mono text-red-600">
                    {getAtraso(d.vencimento, d.status)}
                  </TableCell>
                  <TableCell className="p-1 text-center border-r">
                    {formatDate(d.data_pagamento)}
                  </TableCell>
                  <TableCell className="p-1 text-right border-r font-mono">
                    {formatCurrency(d.valor)}
                  </TableCell>
                  <TableCell className="p-1 text-right border-r font-mono">
                    {formatCurrency(d.valor_pago || 0)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="bg-slate-200 border-t border-b flex justify-between p-2 px-4 text-[11px] font-semibold text-slate-700 shrink-0">
        <div className="flex gap-8">
          <div className="flex gap-2 items-center">
            <span className="text-slate-500 uppercase tracking-wider">Vencido:</span>
            <span className="text-red-600 bg-white px-2 py-0.5 rounded shadow-sm border border-red-100">
              {formatCurrency(totais.vencido)}
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-slate-500 uppercase tracking-wider">À Vencer:</span>
            <span className="bg-white px-2 py-0.5 rounded shadow-sm border">
              {formatCurrency(totais.aVencer)}
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-slate-500 uppercase tracking-wider">Aberto:</span>
            <span className="bg-white px-2 py-0.5 rounded shadow-sm border">
              {formatCurrency(totais.aberto)}
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-slate-500 uppercase tracking-wider">Pago:</span>
            <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded shadow-sm border border-emerald-100">
              {formatCurrency(totais.pago)}
            </span>
          </div>
        </div>
        <div className="flex gap-2 items-center text-sm font-bold">
          <span className="text-slate-500 uppercase text-[11px] tracking-wider">
            Total Parcela:
          </span>
          <span className="text-primary">{formatCurrency(totais.total)}</span>
        </div>
      </div>

      <div className="h-44 flex flex-col bg-slate-50 shrink-0">
        <div className="flex border-b">
          <div className="px-4 py-1.5 text-xs font-semibold bg-white border-r text-primary border-t-2 border-t-primary shadow-sm z-10">
            Baixado
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-white">
          <Table className="w-full text-xs">
            <TableHeader className="bg-slate-100/80 sticky top-0">
              <TableRow className="h-7 border-b">
                <TableHead className="p-1 font-medium">Duplicata</TableHead>
                <TableHead className="p-1 text-center font-medium">Pagamento</TableHead>
                <TableHead className="p-1 text-center font-medium">Atraso</TableHead>
                <TableHead className="p-1 text-right font-medium">Valor Parcela</TableHead>
                <TableHead className="p-1 text-right font-medium">Juros</TableHead>
                <TableHead className="p-1 text-right font-medium">Desconto</TableHead>
                <TableHead className="p-1 text-right font-medium">Valor Pago</TableHead>
                <TableHead className="p-1 font-medium">Pagamento</TableHead>
                <TableHead className="p-1 font-medium">Conta</TableHead>
                <TableHead className="p-1 font-medium">Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={10} className="p-4 text-center text-slate-400 italic">
                  Selecione uma duplicata para ver os detalhes da baixa
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
