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
import { Badge } from '@/components/ui/badge'
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
import { Pencil, Trash2, Plus } from 'lucide-react'
import { format } from 'date-fns'

export default function BoletosPage() {
  const { toast } = useToast()
  const [boletos, setBoletos] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [projetos, setProjetos] = useState<any[]>([])
  const [parcelas, setParcelas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterEmpresa, setFilterEmpresa] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterTipo, setFilterTipo] = useState('all')
  const [filterProjeto, setFilterProjeto] = useState('all')
  const [filterDataInicio, setFilterDataInicio] = useState('')
  const [filterDataFim, setFilterDataFim] = useState('')
  const [filterValorMin, setFilterValorMin] = useState('')
  const [filterValorMax, setFilterValorMax] = useState('')

  // Form
  const [openModal, setOpenModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    id: '',
    nosso_numero: '',
    numero_documento: '',
    nome_pagador: '',
    valor: '',
    vencimento: '',
    status: 'Pendente',
    tipo: 'Normal',
    empresa_id: '',
    projeto_id: '',
    parcela_id: '',
  })

  useEffect(() => {
    fetchAuxData()
    fetchBoletos()
  }, [])

  const fetchAuxData = async () => {
    const [empRes, projRes, parcRes] = await Promise.all([
      supabase.from('empresas').select('id, nome').order('nome'),
      supabase.from('projetos').select('id, nome').order('nome'),
      supabase.from('projeto_parcelas').select('id, projeto_id, numero_parcela, valor'),
    ])
    if (empRes.data) setEmpresas(empRes.data)
    if (projRes.data) setProjetos(projRes.data)
    if (parcRes.data) setParcelas(parcRes.data)
  }

  const fetchBoletos = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('boletos')
      .select(`
        *,
        empresas(nome),
        projetos(nome),
        projeto_parcelas(numero_parcela)
      `)
      .order('vencimento', { ascending: false })

    if (data) setBoletos(data)
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este boleto?')) return
    const { error } = await supabase.from('boletos').delete().eq('id', id)
    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message })
    } else {
      toast({ title: 'Sucesso', description: 'Boleto excluído.' })
      fetchBoletos()
    }
  }

  const handleSave = async () => {
    try {
      const payload = {
        nosso_numero: formData.nosso_numero,
        numero_documento: formData.numero_documento || null,
        nome_pagador: formData.nome_pagador,
        valor: parseFloat(formData.valor),
        vencimento: formData.vencimento || null,
        status: formData.status,
        tipo: formData.tipo,
        empresa_id: formData.empresa_id || null,
        projeto_id: formData.projeto_id || null,
        parcela_id: formData.parcela_id || null,
      }

      if (isEditing) {
        await supabase.from('boletos').update(payload).eq('id', formData.id)
        toast({ title: 'Sucesso', description: 'Boleto atualizado.' })
      } else {
        await supabase.from('boletos').insert([payload])
        toast({ title: 'Sucesso', description: 'Boleto criado.' })
      }
      setOpenModal(false)
      fetchBoletos()
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message })
    }
  }

  const openEdit = (boleto: any) => {
    setFormData({
      id: boleto.id,
      nosso_numero: boleto.nosso_numero || '',
      numero_documento: boleto.numero_documento || '',
      nome_pagador: boleto.nome_pagador || '',
      valor: boleto.valor?.toString() || '',
      vencimento: boleto.vencimento || '',
      status: boleto.status || 'Pendente',
      tipo: boleto.tipo || 'Normal',
      empresa_id: boleto.empresa_id || '',
      projeto_id: boleto.projeto_id || '',
      parcela_id: boleto.parcela_id || '',
    })
    setIsEditing(true)
    setOpenModal(true)
  }

  const openCreate = () => {
    setFormData({
      id: '',
      nosso_numero: '',
      numero_documento: '',
      nome_pagador: '',
      valor: '',
      vencimento: '',
      status: 'Pendente',
      tipo: 'Normal',
      empresa_id: '',
      projeto_id: '',
      parcela_id: '',
    })
    setIsEditing(false)
    setOpenModal(true)
  }

  const filteredBoletos = useMemo(() => {
    return boletos.filter((b) => {
      if (filterEmpresa !== 'all' && b.empresa_id !== filterEmpresa) return false
      if (filterStatus !== 'all' && b.status !== filterStatus) return false
      if (filterTipo !== 'all' && b.tipo !== filterTipo) return false
      if (filterProjeto !== 'all' && b.projeto_id !== filterProjeto) return false

      if (filterDataInicio && (!b.vencimento || b.vencimento < filterDataInicio)) return false
      if (filterDataFim && (!b.vencimento || b.vencimento > filterDataFim)) return false

      if (filterValorMin && b.valor < parseFloat(filterValorMin)) return false
      if (filterValorMax && b.valor > parseFloat(filterValorMax)) return false

      return true
    })
  }, [
    boletos,
    filterEmpresa,
    filterStatus,
    filterTipo,
    filterProjeto,
    filterDataInicio,
    filterDataFim,
    filterValorMin,
    filterValorMax,
  ])

  const availableParcelas = parcelas.filter((p) => p.projeto_id === formData.projeto_id)

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20 w-full mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Controle de Boletos</h2>
          <p className="text-muted-foreground">Gerencie todos os títulos da empresa.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Boleto
        </Button>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Empresa</Label>
          <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Registrado">Registrado</SelectItem>
              <SelectItem value="Pago">Pago</SelectItem>
              <SelectItem value="Cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Normal">Normal</SelectItem>
              <SelectItem value="Nota Fiscal">Nota Fiscal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Projeto</Label>
          <Select value={filterProjeto} onValueChange={setFilterProjeto}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {projetos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Vencimento Inicial</Label>
          <Input
            type="date"
            value={filterDataInicio}
            onChange={(e) => setFilterDataInicio(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Vencimento Final</Label>
          <Input
            type="date"
            value={filterDataFim}
            onChange={(e) => setFilterDataFim(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Valor Min</Label>
          <Input
            type="number"
            placeholder="R$"
            value={filterValorMin}
            onChange={(e) => setFilterValorMin(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Valor Max</Label>
          <Input
            type="number"
            placeholder="R$"
            value={filterValorMax}
            onChange={(e) => setFilterValorMax(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Nosso Número</TableHead>
                <TableHead>Nº Doc.</TableHead>
                <TableHead>Pagador</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead className="text-right">Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Tipo</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredBoletos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    Nenhum boleto encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredBoletos.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.nosso_numero}</TableCell>
                    <TableCell className="text-xs">{b.numero_documento || '-'}</TableCell>
                    <TableCell className="font-medium truncate max-w-[150px]">
                      {b.nome_pagador}
                    </TableCell>
                    <TableCell className="text-slate-600 truncate max-w-[120px]">
                      {b.empresas?.nome || '-'}
                    </TableCell>
                    <TableCell className="text-slate-600 truncate max-w-[120px]">
                      {b.projetos?.nome || '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {b.vencimento ? format(new Date(b.vencimento), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(b.valor)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          b.tipo === 'Nota Fiscal'
                            ? 'bg-purple-50 text-purple-700'
                            : 'bg-slate-50 text-slate-700'
                        }
                      >
                        {b.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          b.status === 'Pago'
                            ? 'bg-emerald-50 text-emerald-700'
                            : b.status === 'Registrado'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-amber-50 text-amber-700'
                        }
                      >
                        {b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500"
                        onClick={() => openEdit(b)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(b.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Boleto' : 'Novo Boleto'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Nosso Número</Label>
              <Input
                value={formData.nosso_numero}
                onChange={(e) => setFormData({ ...formData, nosso_numero: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nº Documento / NF</Label>
              <Input
                value={formData.numero_documento}
                onChange={(e) => setFormData({ ...formData, numero_documento: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Pagador</Label>
              <Input
                value={formData.nome_pagador}
                onChange={(e) => setFormData({ ...formData, nome_pagador: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Input
                type="date"
                value={formData.vencimento}
                onChange={(e) => setFormData({ ...formData, vencimento: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Registrado">Registrado</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formData.tipo}
                onValueChange={(v) => setFormData({ ...formData, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Nota Fiscal">Nota Fiscal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select
                value={formData.empresa_id}
                onValueChange={(v) => setFormData({ ...formData, empresa_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Projeto</Label>
              <Select
                value={formData.projeto_id}
                onValueChange={(v) => setFormData({ ...formData, projeto_id: v, parcela_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {projetos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Parcela</Label>
              <Select
                value={formData.parcela_id}
                onValueChange={(v) => setFormData({ ...formData, parcela_id: v })}
                disabled={!formData.projeto_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {availableParcelas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Parcela {p.numero_parcela}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
