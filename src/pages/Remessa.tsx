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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Download, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { generateCnab400 } from '@/lib/cnab-generator'

export default function RemessaPage() {
  const { toast } = useToast()
  const [boletos, setBoletos] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [filterEmpresa, setFilterEmpresa] = useState('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [previewContent, setPreviewContent] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    fetchAuxData()
    fetchBoletos()
  }, [])

  const fetchAuxData = async () => {
    const { data } = await supabase.from('empresas').select('id, nome').order('nome')
    if (data) setEmpresas(data)
  }

  const fetchBoletos = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('boletos')
      .select(`*, empresas(nome)`)
      .eq('status', 'Pendente')
      .order('vencimento', { ascending: true })

    if (data) setBoletos(data)
    setLoading(false)
  }

  const filteredBoletos = useMemo(() => {
    if (filterEmpresa === 'all') return boletos
    return boletos.filter((b) => b.empresa_id === filterEmpresa)
  }, [boletos, filterEmpresa])

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredBoletos.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredBoletos.map((b) => b.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleGerar = () => {
    const selectedBoletos = filteredBoletos.filter((b) => selectedIds.includes(b.id))
    if (selectedBoletos.length === 0) return

    const empresaNome = selectedBoletos[0].empresas?.nome || 'EMPRESA PADRÃO'

    const content = generateCnab400(selectedBoletos, empresaNome)
    setPreviewContent(content)
    setShowPreview(true)
  }

  const handleDownload = () => {
    const blob = new Blob([previewContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `CB${format(new Date(), 'ddMMyy')}.REM`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({ title: 'Download Concluído', description: 'Arquivo de remessa gerado com sucesso.' })
    setShowPreview(false)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20 p-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gerar Remessa</h2>
          <p className="text-muted-foreground">
            Selecione os boletos pendentes para gerar o arquivo CNAB 400.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="w-full sm:w-1/3 space-y-2">
          <Label>Filtrar por Empresa</Label>
          <Select
            value={filterEmpresa}
            onValueChange={(v) => {
              setFilterEmpresa(v)
              setSelectedIds([])
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Empresas</SelectItem>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={toggleSelectAll}>
            {selectedIds.length === filteredBoletos.length && filteredBoletos.length > 0
              ? 'Desmarcar Todos'
              : 'Selecionar Todos'}
          </Button>
          <Button onClick={handleGerar} disabled={selectedIds.length === 0} className="gap-2">
            <FileText className="h-4 w-4" /> Gerar Arquivo
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Nosso Número</TableHead>
              <TableHead>Pagador</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead className="text-center">Tipo</TableHead>
              <TableHead className="text-right">Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredBoletos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Nenhum boleto pendente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredBoletos.map((b) => (
                <TableRow key={b.id} className={selectedIds.includes(b.id) ? 'bg-primary/5' : ''}>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={selectedIds.includes(b.id)}
                      onCheckedChange={() => toggleSelect(b.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{b.nosso_numero}</TableCell>
                  <TableCell className="font-medium">{b.nome_pagador}</TableCell>
                  <TableCell className="text-slate-600">{b.empresas?.nome || '-'}</TableCell>
                  <TableCell className="text-center text-xs text-slate-500">{b.tipo}</TableCell>
                  <TableCell className="text-right text-sm">
                    {b.vencimento ? format(new Date(b.vencimento), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      b.valor,
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização do Arquivo de Remessa</DialogTitle>
          </DialogHeader>
          <div className="bg-slate-900 text-green-400 font-mono text-xs p-4 rounded-md overflow-x-auto whitespace-pre h-64 overflow-y-auto">
            {previewContent}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" /> Baixar .REM
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
