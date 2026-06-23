import { useState, useEffect } from 'react'
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
  const [notas, setNotas] = useState<any[]>([])
  const [boletosNF, setBoletosNF] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  // Form Registration
  const [formData, setFormData] = useState({
    numero_nf: '',
    serie: '',
    data_emissao: '',
    valor: '',
    fornecedor: '',
    arquiteto: '',
    arquivo: null as File | null,
  })

  // Linking Modal
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [selectedNFId, setSelectedNFId] = useState('')
  const [selectedBoletoId, setSelectedBoletoId] = useState('')

  useEffect(() => {
    fetchNotas()
    fetchBoletosNF()
  }, [])

  const fetchNotas = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('notas_fiscais')
      .select(`*, boletos(nosso_numero, nome_pagador, valor)`)
      .order('created_at', { ascending: false })

    if (data) setNotas(data)
    setLoading(false)
  }

  const fetchBoletosNF = async () => {
    const { data } = await supabase
      .from('boletos')
      .select('id, nosso_numero, numero_documento, nome_pagador, valor, vencimento')
      .eq('tipo', 'Nota Fiscal')
      .order('vencimento', { ascending: false })

    if (data) setBoletosNF(data)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Simulate file upload logic if a file was selected...
      const payload = {
        numero_nf: formData.numero_nf,
        serie: formData.serie,
        data_emissao: formData.data_emissao || null,
        valor: formData.valor ? parseFloat(formData.valor) : null,
        fornecedor: formData.fornecedor,
        arquiteto: formData.arquiteto,
        arquivo_url: formData.arquivo
          ? `https://simulated-bucket.com/${formData.arquivo.name}`
          : null,
      }

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
        arquivo: null,
      })
      fetchNotas()
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message })
    }
  }

  const handleSimulateAutomation = async () => {
    setIsProcessing(true)
    try {
      const { data: orcamento } = await supabase
        .from('orcamentos')
        .select('id')
        .eq('status', 'aguardando_aprovacao')
        .limit(1)
        .single()

      if (!orcamento) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Nenhum orçamento pendente para testar.',
        })
        setIsProcessing(false)
        return
      }

      await supabase.from('orcamentos').update({ status: 'Aprovado' }).eq('id', orcamento.id)

      const { data, error } = await supabase.functions.invoke('process-billing-automation', {
        body: { orcamento_id: orcamento.id },
      })

      if (error) throw error
      if (data.error) throw new Error(data.error)

      toast({
        title: 'Faturamento Automatizado Concluído',
        description: `NF Gerada, ${data.boletos_gerados} boletos criados na fila de remessa. RT Calculado: R$ ${data.rt_calculado}.`,
      })
      fetchNotas()
      fetchBoletosNF()
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro na Automação', description: err.message })
    }
    setIsProcessing(false)
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

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-20 p-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Notas Fiscais</h2>
          <p className="text-muted-foreground">
            Registre notas e vincule com os boletos do sistema.
          </p>
        </div>
        <Button
          onClick={handleSimulateAutomation}
          disabled={isProcessing}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          Simular Automação (Aprovar Orçamento)
        </Button>
      </div>

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
                <TableCell colSpan={6} className="text-center py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : notas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Nenhuma NF registrada.
                </TableCell>
              </TableRow>
            ) : (
              notas.map((nf) => (
                <TableRow key={nf.id}>
                  <TableCell className="font-medium">
                    {nf.numero_nf} {nf.serie ? `- ${nf.serie}` : ''}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {nf.data_emissao ? format(new Date(nf.data_emissao), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell className="truncate max-w-[200px]">{nf.fornecedor || '-'}</TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {nf.valor
                      ? new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(nf.valor)
                      : '-'}
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
