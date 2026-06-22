import { useState, useMemo } from 'react'
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
import { Save, Search, History } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function RetornoBoletos() {
  const { toast } = useToast()

  const [conta, setConta] = useState('BRADESCO LUCENERA')
  const [caminho, setCaminho] = useState(
    'C:\\CONNECT SYSTEMS\\D64C798E-7857...\\RETORNO\\CB210500.RET',
  )

  const initialRecords = [
    {
      id: '1',
      nosso: '09000004227',
      doc: 'N4644',
      valor: 3000.0,
      juros: 0,
      desconto: 0,
      pago: 3000.0,
      venc: '2026-05-20',
      pagto: '2026-05-20',
      sacado: '21106 CASA AL - ANDR',
      status: '06-Liquidação Normal',
      selected: true,
    },
    {
      id: '2',
      nosso: '09000004663',
      doc: 'N4696',
      valor: 10000.0,
      juros: 0,
      desconto: 0,
      pago: 10000.0,
      venc: '2026-05-20',
      pagto: '2026-05-20',
      sacado: 'JOYCE YURI SILVESTRE',
      status: '06-Liquidação Normal',
      selected: true,
    },
    {
      id: '3',
      nosso: '09000003175',
      doc: '13175',
      valor: 14726.9,
      juros: 0,
      desconto: 0,
      pago: 0,
      venc: '2026-05-20',
      pagto: '2026-05-20',
      sacado: 'CAMILA STRANG DE PAU',
      status: '10-Baixado Conforme instrução',
      selected: true,
    },
    {
      id: '4',
      nosso: '09000004218',
      doc: 'N4641',
      valor: 1091.1,
      juros: 0,
      desconto: 0,
      pago: 0,
      venc: '2026-03-20',
      pagto: '2026-05-20',
      sacado: 'CAMILA STRANG DE PAU',
      status: '10-Baixado Conforme instrução',
      selected: true,
    },
  ]

  const [records, setRecords] = useState(initialRecords)
  const [isProcessing, setIsProcessing] = useState(false)

  const toggleSelect = (id: string) => {
    setRecords(records.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)))
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  const formatDate = (d: string) => {
    if (!d) return ''
    const [year, month, day] = d.split('-')
    return `${day}/${month}/${year}`
  }

  const handleSalvar = async () => {
    setIsProcessing(true)
    const selected = records.filter((r) => r.selected)

    if (selected.length === 0) {
      toast({
        title: 'Atenção',
        description: 'Nenhum registro selecionado.',
        variant: 'destructive',
      })
      setIsProcessing(false)
      return
    }

    try {
      for (const rec of selected) {
        if (rec.pago > 0) {
          const { error } = await supabase
            .from('boletos')
            .update({ status: 'Pago', data_pagamento: rec.pagto, valor_pago: rec.pago })
            .eq('numero_documento', rec.doc)

          if (error) console.error(error)
        } else {
          const { error } = await supabase
            .from('boletos')
            .update({ status: 'Cancelado' })
            .eq('numero_documento', rec.doc)

          if (error) console.error(error)
        }
      }

      toast({
        title: 'Retorno Salvo',
        description: `${selected.length} títulos processados e sincronizados com sucesso.`,
      })
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message })
    }

    setIsProcessing(false)
  }

  const totais = useMemo(() => {
    return records.reduce(
      (acc, curr) => {
        acc.parcelas += curr.valor
        acc.juros += curr.juros
        acc.desconto += curr.desconto
        acc.pago += curr.pago
        return acc
      },
      { parcelas: 0, juros: 0, desconto: 0, pago: 0 },
    )
  }, [records])

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] w-full bg-slate-50 overflow-hidden text-sm">
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="https://img.usecurling.com/i?q=cs-logo&color=red"
            alt="Logo"
            className="h-8 w-8 object-contain"
          />
          <h1 className="text-lg font-semibold text-slate-800">Retorno de Boletos</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
            onClick={handleSalvar}
            disabled={isProcessing}
          >
            <Save className="h-4 w-4" />
            <span className="text-[10px]">Salvar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
          >
            <Search className="h-4 w-4" />
            <span className="text-[10px]">Localizar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
          >
            <History className="h-4 w-4" />
            <span className="text-[10px]">Log</span>
          </Button>
        </div>
      </div>

      <div className="p-4 bg-slate-100/80 border-b shrink-0">
        <div className="font-semibold text-xs mb-3 text-slate-700">Conta</div>
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase block mb-1">
              Código
            </label>
            <Input className="h-8 text-xs bg-white font-mono" value="2" readOnly />
          </div>
          <div className="col-span-3">
            <label className="text-[10px] text-slate-500 font-medium uppercase block mb-1">
              Conta
            </label>
            <Select value={conta} onValueChange={setConta}>
              <SelectTrigger className="h-8 text-xs bg-white font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRADESCO LUCENERA">BRADESCO LUCENERA</SelectItem>
                <SelectItem value="BRADESCO ISLIGHT">BRADESCO ISLIGHT</SelectItem>
                <SelectItem value="BRADESCO SLIDE">BRADESCO SLIDE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-8 flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 font-medium uppercase block mb-1">
                Caminho
              </label>
              <Input
                className="h-8 text-xs bg-white text-slate-500 font-mono tracking-tight"
                value={caminho}
                onChange={(e) => setCaminho(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 bg-white">
              <span className="text-xs font-bold">...</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white relative">
        <Table className="w-full text-xs whitespace-nowrap">
          <TableHeader className="sticky top-0 bg-slate-100 z-10 shadow-sm border-b">
            <TableRow className="h-9">
              <TableHead className="p-2 font-medium">Nosso Nº</TableHead>
              <TableHead className="p-2 font-medium">Nº Doc.</TableHead>
              <TableHead className="p-2 text-right font-medium">VL Parc.</TableHead>
              <TableHead className="p-2 text-right font-medium">Juros</TableHead>
              <TableHead className="p-2 text-right font-medium">Desconto</TableHead>
              <TableHead className="p-2 text-right font-medium">Valor Pagto.</TableHead>
              <TableHead className="p-2 text-center font-medium">Vencimento</TableHead>
              <TableHead className="p-2 text-center font-medium">Pagamento</TableHead>
              <TableHead className="p-2 font-medium">Sacado</TableHead>
              <TableHead className="p-2 font-medium">Status</TableHead>
              <TableHead className="w-10 p-2 text-center font-medium">X</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r, i) => (
              <TableRow
                key={r.id}
                className={`h-8 transition-colors ${i === 0 ? 'bg-cyan-50/50' : 'hover:bg-slate-50'}`}
              >
                <TableCell className="p-2 border-r font-mono text-slate-600">{r.nosso}</TableCell>
                <TableCell className="p-2 border-r font-medium">{r.doc}</TableCell>
                <TableCell className="p-2 text-right border-r font-mono">
                  {formatCurrency(r.valor)}
                </TableCell>
                <TableCell className="p-2 text-right border-r font-mono text-slate-500">
                  {formatCurrency(r.juros)}
                </TableCell>
                <TableCell className="p-2 text-right border-r font-mono text-slate-500">
                  {formatCurrency(r.desconto)}
                </TableCell>
                <TableCell className="p-2 text-right border-r font-mono font-medium">
                  {formatCurrency(r.pago)}
                </TableCell>
                <TableCell className="p-2 text-center border-r">{formatDate(r.venc)}</TableCell>
                <TableCell className="p-2 text-center border-r">{formatDate(r.pagto)}</TableCell>
                <TableCell className="p-2 border-r truncate max-w-[250px] font-medium">
                  {r.sacado}
                </TableCell>
                <TableCell className="p-2 border-r text-slate-600">{r.status}</TableCell>
                <TableCell className="p-2 text-center border-r">
                  <input
                    type="checkbox"
                    checked={r.selected}
                    onChange={() => toggleSelect(r.id)}
                    className="cursor-pointer scale-110 accent-primary"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="bg-slate-100/80 border-t p-4 text-xs shrink-0">
        <div className="grid grid-cols-4 gap-6 max-w-4xl">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
              Total Parcelas
            </span>
            <div className="bg-white border rounded p-2 text-center shadow-sm font-mono text-sm text-slate-700">
              {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(totais.parcelas)}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
              Total Juros
            </span>
            <div className="bg-white border rounded p-2 text-center shadow-sm font-mono text-sm text-slate-700">
              {totais.juros}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
              Total Desconto
            </span>
            <div className="bg-white border rounded p-2 text-center shadow-sm font-mono text-sm text-slate-700">
              {totais.desconto}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
              Total Pago
            </span>
            <div className="bg-white border rounded p-2 text-center shadow-sm font-mono text-sm font-semibold text-primary">
              {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(totais.pago)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
