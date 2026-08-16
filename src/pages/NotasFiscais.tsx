import { useState, useEffect, useMemo } from 'react'
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
    // Pedido do usuario (06/08/2026): antes nao tinha como determinar se a
    // nota fiscal registrada era de Contas a Pagar ou a Receber, nem qual
    // perfil (Ribeirao/Sao Paulo) -- mesma convencao ja usada em
    // boletos.tipo_operacao/perfil.
    tipo_operacao: 'CR',
    perfil: '',
  })

  // Linking Modal
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [selectedNFId, setSelectedNFId] = useState('')
  const [selectedBoletoId, setSelectedBoletoId] = useState('')

  // SPEC-114: busca por cliente/venda nos dois seletores de boleto (form de
  // registro e modal de vínculo) — reunião Vinícius 14/08, ele mesmo
  // confundiu qual parcela (P1/P2/P3) era qual quando os valores eram
  // parecidos. Não existe campo de "número de parcela" em boletos, então
  // deriva-se agrupando por orcamento_id e ordenando por vencimento.
  const [boletoSearchForm, setBoletoSearchForm] = useState('')
  const [boletoSearchModal, setBoletoSearchModal] = useState('')

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
        tipo_operacao: formData.tipo_operacao,
        perfil: formData.perfil || null,
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
        tipo_operacao: 'CR',
        perfil: '',
      })
      fetchNotas()
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message })
    }
  }

  const openLinkModal = (nfId: string) => {
    setSelectedNFId(nfId)
    setSelectedBoletoId('')
    setBoletoSearchModal('')
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
    nota ? (Array.isArray(nota.orcamentos) ? nota.orcamentos[0] : nota.orcamentos) : null

  const formatCurrency = (value: number | string | null | undefined) =>
    value
      ? new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(Number(value))
      : '-'

  const formatVencimento = (value: string | null | undefined) =>
    value ? format(new Date(value), 'dd/MM/yyyy') : '-'

  // SPEC-114: não existe campo de "número de parcela" em boletos — deriva
  // um rótulo P1/P2/P3 agrupando por orcamento_id e ordenando por
  // vencimento crescente. Só serve pra diferenciar visualmente parcelas da
  // mesma venda, não é um dado gravado em lugar nenhum.
  const parcelaPorBoletoId = useMemo(() => {
    const grupos = new Map<string, any[]>()
    for (const b of boletosNF) {
      const chave = b.orcamento_id || 'sem-orcamento'
      if (!grupos.has(chave)) grupos.set(chave, [])
      grupos.get(chave)!.push(b)
    }
    const map: Record<string, number> = {}
    grupos.forEach((itens) => {
      if (itens.length < 2) return
      const ordenado = [...itens].sort((a, b) => {
        const va = a.vencimento ? new Date(a.vencimento).getTime() : 0
        const vb = b.vencimento ? new Date(b.vencimento).getTime() : 0
        return va - vb
      })
      ordenado.forEach((item, idx) => {
        map[item.id] = idx + 1
      })
    })
    return map
  }, [boletosNF])

  const boletoLabel = (b: any) => {
    const parcela = parcelaPorBoletoId[b.id]
    const partes = [
      parcela ? `P${parcela}` : null,
      b.nome_pagador || 'Sem nome',
      `venc. ${formatVencimento(b.vencimento)}`,
      formatCurrency(b.valor),
    ].filter(Boolean)
    return partes.join(' · ')
  }

  const filtrarBoletos = (lista: any[], termo: string) => {
    const t = termo.trim().toLowerCase()
    if (!t) return lista
    return lista.filter((b) =>
      [b.nome_pagador, b.nosso_numero, b.numero_documento]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(t)),
    )
  }

  const boletosFormFiltrados = filtrarBoletos(boletosNF, boletoSearchForm)
  const boletosModalFiltrados = filtrarBoletos(boletosNF, boletoSearchModal)

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
            <Label>
              Tipo <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.tipo_operacao}
              onValueChange={(v) => setFormData({ ...formData, tipo_operacao: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CR">Contas a Receber</SelectItem>
                <SelectItem value="CP">Contas a Pagar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Perfil</Label>
            <Select
              value={formData.perfil}
              onValueChange={(v) => setFormData({ ...formData, perfil: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Não informado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ribeirao">Ribeirão</SelectItem>
                <SelectItem value="sao_paulo">São Paulo</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
            <Input
              placeholder="Buscar por cliente ou número..."
              value={boletoSearchForm}
              onChange={(e) => setBoletoSearchForm(e.target.value)}
              className="mb-1 text-sm"
            />
            <Select
              value={formData.boleto_id}
              onValueChange={(v) => setFormData({ ...formData, boleto_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o boleto" />
              </SelectTrigger>
              <SelectContent>
                {boletosFormFiltrados.length === 0 ? (
                  <div className="px-2 py-4 text-center text-xs text-slate-500">
                    Nenhum boleto encontrado.
                  </div>
                ) : (
                  boletosFormFiltrados.map((boleto) => (
                    <SelectItem key={boleto.id} value={boleto.id}>
                      {boletoLabel(boleto)}
                    </SelectItem>
                  ))
                )}
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
              <TableHead className="text-center">Tipo</TableHead>
              <TableHead className="text-center">Perfil</TableHead>
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
                <TableCell colSpan={9} className="text-center py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : notas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
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
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={
                        nf.tipo_operacao === 'CP'
                          ? 'bg-orange-50 text-orange-700'
                          : 'bg-sky-50 text-sky-700'
                      }
                    >
                      {nf.tipo_operacao === 'CP' ? 'Pagar' : 'Receber'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-xs text-slate-500">
                    {nf.perfil === 'ribeirao'
                      ? 'Ribeirão'
                      : nf.perfil === 'sao_paulo'
                        ? 'São Paulo'
                        : '-'}
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
              <Input
                placeholder="Buscar por cliente ou número..."
                value={boletoSearchModal}
                onChange={(e) => setBoletoSearchModal(e.target.value)}
                className="text-sm"
              />
              <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
                {boletosModalFiltrados.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">
                    {boletosNF.length === 0
                      ? 'Nenhum boleto tipo "Nota Fiscal" disponível.'
                      : 'Nenhum boleto encontrado pra essa busca.'}
                  </div>
                ) : (
                  boletosModalFiltrados.map((b) => {
                    const parcela = parcelaPorBoletoId[b.id]
                    return (
                      <div
                        key={b.id}
                        className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors flex justify-between items-center gap-3 ${selectedBoletoId === b.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                        onClick={() => setSelectedBoletoId(b.id)}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {parcela && (
                              <Badge
                                variant="outline"
                                className="bg-violet-50 text-violet-700 text-[10px] px-1.5 py-0"
                              >
                                P{parcela}
                              </Badge>
                            )}
                            <span className="font-mono text-sm font-medium truncate">
                              {b.nosso_numero}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 font-medium truncate">
                            {b.nome_pagador || 'Sem nome'}
                          </div>
                          <div className="text-xs text-slate-400">
                            Venc. {formatVencimento(b.vencimento)} · NF ref:{' '}
                            {b.numero_documento || 'S/N'}
                          </div>
                        </div>
                        <div className="font-mono text-sm shrink-0">{formatCurrency(b.valor)}</div>
                      </div>
                    )
                  })
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
