import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Link2, Upload, FileText, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'

export default function NotasFiscaisPage() {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const orcamentoId = searchParams.get('orcamento_id')
  const [notas, setNotas] = useState<any[]>([])
  const [boletosNF, setBoletosNF] = useState<any[]>([])
  const [orcamentoContext, setOrcamentoContext] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  // Form Registration
  const [formData, setFormData] = useState({
    numero_nf: '',
    serie: '',
    data_emissao: '',
    valor: '',
    fornecedor: '',
    arquiteto: '',
    orcamento_id: '',
    boleto_id: '',
    arquivo: null as File | null,
  })

  // Linking Modal
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [selectedNFId, setSelectedNFId] = useState('')
  const [selectedBoletoId, setSelectedBoletoId] = useState('')

  useEffect(() => {
    fetchOrcamentoContext()
    fetchNotas()
    fetchBoletosNF()
  }, [orcamentoId])

  const fetchOrcamentoContext = async () => {
    if (!orcamentoId) {
      setOrcamentoContext(null)
      return
    }

    const { data } = await supabase
      .from('orcamentos')
      .select(`
        id,
        numero,
        valor_total,
        forma_pagamento,
        condicoes_pagamento,
        empresa:empresas(nome),
        cliente:contatos!orcamentos_cliente_id_fkey(nome),
        projeto:projetos(nome, codigo)
      `)
      .eq('id', orcamentoId)
      .single()

    if (data) {
      setOrcamentoContext(data)
      setFormData((current) => ({
        ...current,
        orcamento_id: current.orcamento_id || orcamentoId,
        valor: current.valor || String(data.valor_total || ''),
        fornecedor: current.fornecedor || data.empresa?.nome || '',
      }))
    }
  }

  const fetchNotas = async () => {
    setLoading(true)
    let query: any = supabase
      .from('notas_fiscais')
      .select(`
        *,
        boletos(nosso_numero, nome_pagador, valor),
        orcamentos(
          numero,
          cliente:contatos!orcamentos_cliente_id_fkey(nome),
          projeto:projetos(nome, codigo)
        )
      `)
      .order('created_at', { ascending: false })

    if (orcamentoId) {
      query = query.eq('orcamento_id', orcamentoId)
    }

    const { data } = await query

    if (data) setNotas(data)
    setLoading(false)
  }

  const fetchBoletosNF = async () => {
    let query: any = supabase
      .from('boletos')
      .select(
        'id, nosso_numero, numero_documento, nome_pagador, valor, vencimento, orcamento_id, status',
      )
      .eq('tipo', 'Nota Fiscal')
      .order('vencimento', { ascending: false })

    if (orcamentoId) {
      query = query.eq('orcamento_id', orcamentoId)
    }

    const { data } = await query

    if (data) setBoletosNF(data)
  }

  const uploadNotaFiscal = async (file: File | null) => {
    if (!file) return null

    const safeName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
    const prefix = formData.orcamento_id || orcamentoId || 'sem-orcamento'
    const filePath = `notas-fiscais/${prefix}/${Date.now()}-${safeName}`

    const { error } = await supabase.storage.from('notas_fiscais').upload(filePath, file, {
      contentType: file.type || 'application/pdf',
      upsert: false,
    })

    if (error) throw error

    const { data } = supabase.storage.from('notas_fiscais').getPublicUrl(filePath)
    return data.publicUrl
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const arquivoUrl = await uploadNotaFiscal(formData.arquivo)
      const payload = {
        numero_nf: formData.numero_nf,
        serie: formData.serie,
        data_emissao: formData.data_emissao || null,
        valor: formData.valor ? parseFloat(formData.valor) : null,
        fornecedor: formData.fornecedor,
        arquiteto: formData.arquiteto,
        orcamento_id: formData.orcamento_id || orcamentoId || null,
        boleto_id: formData.boleto_id || null,
        arquivo_url: arquivoUrl,
      } as any

      const { error } = await supabase.from('notas_fiscais').insert([payload])
      if (error) throw error

      toast({ title: 'Nota Fiscal Registrada' })
      setFormData({
        numero_nf: '',
        serie: '',
        data_emissao: '',
        valor: '',
        fornecedor: '',
        arquiteto: '',
        orcamento_id: orcamentoId || '',
        boleto_id: '',
        arquivo: null,
      })
      fetchNotas()
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message })
    }
  }

  const openLinkModal = (nfId: string) => {
    setSelectedNFId(nfId)
    setSelectedBoletoId('')
    setShowLinkModal(true)
  }

  const handleLink = async () => {
    if (!selectedBoletoId || !selectedNFId) return
    try {
      const { error } = await supabase
        .from('notas_fiscais')
        .update({ boleto_id: selectedBoletoId })
        .eq('id', selectedNFId)

      if (error) throw error
      toast({ title: 'Sucesso', description: 'Nota vinculada ao boleto.' })
      setShowLinkModal(false)
      fetchNotas()
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message })
    }
  }

  const getOrcamentoFromNota = (nota: any) =>
    Array.isArray(nota.orcamentos) ? nota.orcamentos[0] : nota.orcamentos

  const formatCurrency = (value: number | string | null | undefined) =>
    value
      ? new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(Number(value))
      : '-'

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-20 p-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Notas Fiscais</h2>
          <p className="text-muted-foreground">
            Registre notas e vincule com os boletos do sistema.
          </p>
        </div>
      </div>

      {orcamentoId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          NF filtrada pelo orçamento{' '}
          <span className="font-mono font-semibold">
            {orcamentoContext?.numero || getOrcamentoFromNota(notas[0])?.numero || orcamentoId}
          </span>
          . Se ainda não houver nota registrada, mantenha este estado como “NF pendente” até emissão
          real/manual ou futura API.
        </div>
      )}

      {orcamentoContext && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-xl border bg-white p-4 text-sm shadow-sm">
          <div>
            <p className="text-slate-500">Orçamento</p>
            <p className="font-semibold">{orcamentoContext.numero || orcamentoContext.id}</p>
          </div>
          <div>
            <p className="text-slate-500">Projeto</p>
            <p className="font-semibold">
              {orcamentoContext.projeto?.codigo
                ? `${orcamentoContext.projeto.codigo} — ${orcamentoContext.projeto.nome}`
                : orcamentoContext.projeto?.nome || '-'}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Cliente</p>
            <p className="font-semibold">{orcamentoContext.cliente?.nome || '-'}</p>
          </div>
          <div>
            <p className="text-slate-500">Valor</p>
            <p className="font-semibold">{formatCurrency(orcamentoContext.valor_total)}</p>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Registrar Nova Nota
        </h3>
        <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Número da NF</Label>
            <Input
              required
              value={formData.numero_nf}
              onChange={(e) => setFormData({ ...formData, numero_nf: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Série</Label>
            <Input
              value={formData.serie}
              onChange={(e) => setFormData({ ...formData, serie: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Data de Emissão</Label>
            <Input
              type="date"
              value={formData.data_emissao}
              onChange={(e) => setFormData({ ...formData, data_emissao: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Valor</Label>
            <Input
              type="number"
              step="0.01"
              required
              value={formData.valor}
              onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Input
              value={formData.fornecedor}
              onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Arquiteto</Label>
            <Input
              value={formData.arquiteto}
              onChange={(e) => setFormData({ ...formData, arquiteto: e.target.value })}
            />
          </div>
          {orcamentoId && (
            <div className="space-y-2">
              <Label>Orçamento vinculado</Label>
              <Input value={orcamentoId} disabled className="font-mono text-xs" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Boleto vinculado</Label>
            <Select
              value={formData.boleto_id}
              onValueChange={(v) => setFormData({ ...formData, boleto_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o boleto" />
              </SelectTrigger>
              <SelectContent>
                {boletosNF.map((boleto) => (
                  <SelectItem key={boleto.id} value={boleto.id}>
                    {boleto.nosso_numero} — {formatCurrency(boleto.valor)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Arquivo PDF</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => setFormData({ ...formData, arquivo: e.target.files?.[0] || null })}
                className="cursor-pointer"
              />
            </div>
          </div>
          <div className="flex items-end md:col-span-1">
            <Button type="submit" className="w-full gap-2">
              <Upload className="h-4 w-4" /> Registrar NF
            </Button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Nº NF / Série</TableHead>
              <TableHead>Orçamento / Projeto</TableHead>
              <TableHead>Emissão</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Boleto Vinculado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : notas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  {orcamentoId
                    ? 'NF pendente de emissão para este orçamento.'
                    : 'Nenhuma NF registrada.'}
                </TableCell>
              </TableRow>
            ) : (
              notas.map((nf) => (
                <TableRow key={nf.id}>
                  <TableCell className="font-medium">
                    {nf.numero_nf} {nf.serie ? `- ${nf.serie}` : ''}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    <div className="flex flex-col">
                      <span className="font-mono">{getOrcamentoFromNota(nf)?.numero || '-'}</span>
                      <span>{getOrcamentoFromNota(nf)?.projeto?.nome || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {nf.data_emissao ? format(new Date(nf.data_emissao), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell className="truncate max-w-[200px]">{nf.fornecedor || '-'}</TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(nf.valor)}
                  </TableCell>
                  <TableCell className="text-center">
                    {nf.boletos ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 gap-1 font-mono text-xs"
                      >
                        <CheckCircle2 className="h-3 w-3" /> {nf.boletos.nosso_numero}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-400">Não vinculado</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:bg-primary/5 h-8 gap-2"
                      onClick={() => openLinkModal(nf.id)}
                    >
                      <Link2 className="h-4 w-4" /> Vincular
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showLinkModal} onOpenChange={setShowLinkModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular a um Boleto</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione um boleto do tipo "Nota Fiscal" para vincular a esta NF.
            </p>
            <div className="space-y-2">
              <Label>Boleto Disponível</Label>
              <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
                {boletosNF.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">
                    Nenhum boleto tipo "Nota Fiscal" disponível.
                  </div>
                ) : (
                  boletosNF.map((b) => (
                    <div
                      key={b.id}
                      className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors flex justify-between items-center ${selectedBoletoId === b.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                      onClick={() => setSelectedBoletoId(b.id)}
                    >
                      <div>
                        <div className="font-mono text-sm font-medium">{b.nosso_numero}</div>
                        <div className="text-xs text-slate-500">
                          {b.nome_pagador} (NF ref: {b.numero_documento || 'S/N'})
                        </div>
                      </div>
                      <div className="font-mono text-sm">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(b.valor)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleLink} disabled={!selectedBoletoId}>
              Confirmar Vínculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
