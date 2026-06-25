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
import { AlertTriangle, Download, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { generateCnab400, validateCnab400Boletos } from '@/lib/cnab-generator'

export default function RemessaPage() {
  const { toast } = useToast()
  const [boletos, setBoletos] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [filterEmpresa, setFilterEmpresa] = useState('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [previewContent, setPreviewContent] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [validationMessages, setValidationMessages] = useState<string[]>([])

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
      .select(`
        *,
        empresas(nome),
        orcamentos(
          numero,
          cliente:contatos!orcamentos_cliente_id_fkey(nome),
          projeto:projetos(nome, codigo)
        )
      `)
      .in('status', ['Pendente', 'pendente_registro'])
      .order('vencimento', { ascending: true })

    if (data) {
      setBoletos(data)
      if (data.length > 0) {
        toast({
          title: 'Boletos Pendentes',
          description: `${data.length} Boleto(s) gerado(s), mas não registrado(s) no banco.`,
        })
      }
    }
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

    const empresasSelecionadas = new Set(selectedBoletos.map((b) => b.empresa_id || 'sem-empresa'))
    if (empresasSelecionadas.size > 1) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma empresa por remessa',
        description: 'O arquivo CNAB deve ser gerado separadamente para cada empresa emissora.',
      })
      return
    }

    const issues = validateCnab400Boletos(selectedBoletos)
    if (issues.length > 0) {
      setValidationMessages(issues.map((issue) => issue.message))
      toast({
        variant: 'destructive',
        title: 'Revise os boletos antes da remessa',
        description: `${issues.length} pendência(s) encontrada(s).`,
      })
      return
    }

    setValidationMessages([])
    const empresaNome = selectedBoletos[0].empresas?.nome || 'EMPRESA PADRÃO'

    const content = generateCnab400(selectedBoletos, empresaNome)
    setPreviewContent(content)
    setShowPreview(true)
  }

  const handleDownload = async () => {
    const blob = new Blob([previewContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `CB${format(new Date(), 'ddMMyy')}.REM`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    const selectedBoletos = filteredBoletos.filter((b) => selectedIds.includes(b.id))
    const ids = selectedBoletos.map((b) => b.id)
    await supabase.from('boletos').update({ status: 'Remessa Enviada' }).in('id', ids)

    toast({
      title: 'Download Concluído',
      description: 'Arquivo de remessa gerado com sucesso e status atualizado.',
    })
    setShowPreview(false)
    fetchBoletos()
    setSelectedIds([])
  }

  const getOrcamentoFromBoleto = (boleto: any) =>
    Array.isArray(boleto.orcamentos) ? boleto.orcamentos[0] : boleto.orcamentos

  const getProjetoLabel = (boleto: any) => {
    const orcamento = getOrcamentoFromBoleto(boleto)
    const projeto = Array.isArray(orcamento?.projeto) ? orcamento.projeto[0] : orcamento?.projeto
    if (!projeto) return '-'
    return projeto.codigo ? `${projeto.codigo} — ${projeto.nome}` : projeto.nome
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20 p-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gerar Remessa</h2>
          <p className="text-muted-foreground">
            Selecione os boletos pendentes para gerar manualmente o arquivo CNAB 400.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <div className="flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Fluxo manual: o responsável seleciona os títulos, gera a prévia,
            baixa o arquivo .REM e envia ao banco. O status só muda para
            “Remessa Enviada” após o download.
          </p>
        </div>
      </div>

      {validationMessages.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium mb-2">Pendências para gerar a remessa:</p>
          <ul className="list-disc pl-5 space-y-1">
            {validationMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

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
        <div className="flex flex-wrap gap-4 justify-end">
          <Button variant="outline" onClick={toggleSelectAll}>
            {selectedIds.length === filteredBoletos.length && filteredBoletos.length > 0
              ? 'Desmarcar Todos'
              : 'Selecionar Todos'}
          </Button>
          <Button onClick={handleGerar} disabled={selectedIds.length === 0} className="gap-2">
            <FileText className="h-4 w-4" /> Gerar Selecionados
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Nosso Número</TableHead>
              <TableHead>Orçamento / Projeto</TableHead>
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
                <TableCell colSpan={8} className="text-center py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredBoletos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
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
                  <TableCell className="text-xs text-slate-600">
                    <div className="flex flex-col">
                      <span className="font-mono">
                        {getOrcamentoFromBoleto(b)?.numero || b.orcamento_id || '-'}
                      </span>
                      <span>{getProjetoLabel(b)}</span>
                    </div>
                  </TableCell>
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
