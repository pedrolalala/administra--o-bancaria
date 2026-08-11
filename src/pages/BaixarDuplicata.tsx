import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { differenceInDays, parseISO } from 'date-fns'

const Field = ({
  label,
  children,
  span = 2,
}: {
  label: string
  children: React.ReactNode
  span?: number
}) => (
  <div className={`col-span-${span}`}>
    <label className="text-[10px] text-slate-500 font-medium uppercase">{label}</label>
    {children}
  </div>
)

export default function BaixarDuplicata() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const idsIniciais: string[] = (location.state as any)?.ids || []

  const [saving, setSaving] = useState(false)
  const [duplicatas, setDuplicatas] = useState<any[]>([])
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set(idsIniciais))
  const [baixadas, setBaixadas] = useState<any[]>([])

  const [empresas, setEmpresas] = useState<any[]>([])
  const [contasBancarias, setContasBancarias] = useState<any[]>([])
  const [planoContas, setPlanoContas] = useState<any[]>([])

  // Filtros de localizacao (mesma logica de ConsultarDuplicatas.tsx)
  const [filtroTipo, setFiltroTipo] = useState<'CP' | 'CR'>('CP')
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [filtroFatura, setFiltroFatura] = useState('')
  const [filtroBoleto, setFiltroBoleto] = useState('')
  const [filtroTipoSituacao, setFiltroTipoSituacao] = useState('Aberto')

  // Dados da baixa (aplicados a todas as duplicatas selecionadas)
  const [apropriacaoId, setApropriacaoId] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [subGrupoId, setSubGrupoId] = useState('')
  const [situacao, setSituacao] = useState('Pago')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [bandeira, setBandeira] = useState('')
  const [contaBancariaId, setContaBancariaId] = useState('')
  const [linhaDigitavel, setLinhaDigitavel] = useState('')
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10))
  const [jurosMulta, setJurosMulta] = useState('0')
  const [desconto, setDesconto] = useState('0')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('empresas').select('id, nome').order('nome'),
      supabase.from('contas_bancarias').select('id, nome').order('nome'),
      supabase.from('plano_de_contas').select('id, nome, nivel, parent_id').eq('ativo', true).order('nome'),
    ]).then(([emp, contas, plano]) => {
      if (emp.data) setEmpresas(emp.data)
      if (contas.data) setContasBancarias(contas.data)
      if (plano.data) setPlanoContas(plano.data)
    })
  }, [])

  const fetchDuplicatas = async () => {
    const { data, error } = await supabase.from('boletos').select('*').eq('tipo_operacao', filtroTipo)
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
      return
    }
    setDuplicatas(data || [])
  }

  useEffect(() => {
    fetchDuplicatas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTipo])

  const filtradas = useMemo(() => {
    return duplicatas.filter((d) => {
      if (filtroTipoSituacao === 'Aberto' && d.status === 'Pago') return false
      if (filtroTipoSituacao === 'Pago' && d.status !== 'Pago') return false
      if (filtroEmpresa && d.empresa_id !== filtroEmpresa) return false
      if (
        filtroBoleto &&
        !d.nosso_numero?.toLowerCase().includes(filtroBoleto.toLowerCase())
      )
        return false
      if (
        filtroFatura &&
        !d.numero_documento?.toLowerCase().includes(filtroFatura.toLowerCase())
      )
        return false
      return true
    })
  }, [duplicatas, filtroTipoSituacao, filtroEmpresa, filtroBoleto, filtroFatura])

  const gruposNivel1 = useMemo(() => planoContas.filter((p) => p.nivel === 1), [planoContas])
  const subGruposNivel2 = useMemo(
    () => planoContas.filter((p) => p.nivel === 2 && p.parent_id === grupoId),
    [planoContas, grupoId],
  )
  const apropriacoesNivel3 = useMemo(
    () => planoContas.filter((p) => p.nivel === 3 && p.parent_id === subGrupoId),
    [planoContas, subGrupoId],
  )

  const toggleSelecionada = (id: string) => {
    setSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const formatCurrency = (v: number | null | undefined) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
  const formatDate = (d: string) => {
    if (!d) return '-'
    const [year, month, day] = d.split('T')[0].split('-')
    return `${day}/${month}/${year}`
  }
  const getAtraso = (venc: string) => {
    if (!venc) return ''
    const days = differenceInDays(new Date(), parseISO(venc))
    return days > 0 ? days : ''
  }

  const handleSalvar = async () => {
    if (selecionadas.size === 0) {
      toast({ title: 'Selecione ao menos uma duplicata', variant: 'destructive' })
      return
    }
    if (!formaPagamento) {
      toast({ title: 'Informe a Forma de pagamento', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const jurosVal = parseFloat(jurosMulta) || 0
      const descontoVal = parseFloat(desconto) || 0
      const selecionadasArr = duplicatas.filter((d) => selecionadas.has(d.id))

      const results = await Promise.all(
        selecionadasArr.map((d) => {
          const valorPago = (Number(d.valor) || 0) + jurosVal - descontoVal
          return supabase
            .from('boletos')
            .update({
              status: situacao,
              apropriacao_id: apropriacaoId || null,
              forma_pagamento: formaPagamento,
              bandeira: bandeira || null,
              conta_bancaria_id: contaBancariaId || null,
              linha_digitavel: linhaDigitavel || d.linha_digitavel || null,
              data_pagamento: dataPagamento,
              juros_multa: jurosVal,
              desconto: descontoVal,
              valor_pago: valorPago,
              observacao: observacoes || d.observacao || null,
            })
            .eq('id', d.id)
            .select()
            .single()
        }),
      )

      const falhas = results.filter((r) => r.error)
      if (falhas.length > 0) {
        throw new Error(falhas.map((f) => f.error?.message).join('; '))
      }

      const baixadasAgora = results.map((r) => r.data)
      setBaixadas((prev) => [...baixadasAgora, ...prev])
      toast({
        title: 'Sucesso',
        description: `${selecionadasArr.length} duplicata(s) baixada(s).`,
      })
      setSelecionadas(new Set())
      fetchDuplicatas()
    } catch (e: any) {
      toast({ title: 'Erro ao baixar', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] w-full bg-slate-50 overflow-hidden text-sm">
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between shadow-sm z-10 shrink-0">
        <h1 className="text-lg font-semibold text-slate-800">Baixar Duplicata</h1>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <div className="font-semibold text-xs mb-2 text-slate-700">Localizar Duplicatas</div>
          <div className="grid grid-cols-12 gap-3 mb-2">
            <Field label="Tipo">
              <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as 'CP' | 'CR')}>
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CP">Pagar</SelectItem>
                  <SelectItem value="CR">Receber</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Empresa">
              <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fatura">
              <Input
                className="h-7 text-xs bg-slate-50"
                value={filtroFatura}
                onChange={(e) => setFiltroFatura(e.target.value)}
              />
            </Field>
            <Field label="Boleto">
              <Input
                className="h-7 text-xs bg-slate-50"
                value={filtroBoleto}
                onChange={(e) => setFiltroBoleto(e.target.value)}
              />
            </Field>
            <Field label="Tipo situação">
              <Select value={filtroTipoSituacao} onValueChange={setFiltroTipoSituacao}>
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  <SelectItem value="Aberto">Aberto</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="col-span-3 flex items-end">
              <Button variant="outline" size="sm" className="h-7 w-full" onClick={fetchDuplicatas}>
                Localizar
              </Button>
            </div>
          </div>

          <div className="border rounded-md overflow-hidden max-h-40 overflow-y-auto">
            <Table className="text-xs">
              <TableHeader className="bg-slate-50 sticky top-0">
                <TableRow className="h-7">
                  <TableHead className="w-8 p-1 text-center">Sel.</TableHead>
                  <TableHead className="p-1">Duplicata</TableHead>
                  <TableHead className="p-1">Pessoa</TableHead>
                  <TableHead className="p-1 text-center">Vencimento</TableHead>
                  <TableHead className="p-1 text-right">Valor</TableHead>
                  <TableHead className="p-1 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-slate-400 italic">
                      Nenhuma duplicata encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtradas.map((d) => (
                    <TableRow
                      key={d.id}
                      className="h-7 hover:bg-primary/5 cursor-pointer"
                      onClick={() => toggleSelecionada(d.id)}
                    >
                      <TableCell className="p-1 text-center">
                        <input
                          type="checkbox"
                          checked={selecionadas.has(d.id)}
                          onChange={() => toggleSelecionada(d.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="p-1 font-mono">{d.nosso_numero}</TableCell>
                      <TableCell className="p-1 truncate max-w-[160px]">{d.nome_pagador}</TableCell>
                      <TableCell className="p-1 text-center">{formatDate(d.vencimento)}</TableCell>
                      <TableCell className="p-1 text-right font-mono">
                        {formatCurrency(d.valor)}
                      </TableCell>
                      <TableCell className="p-1 text-center">{d.status}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {selecionadas.size} duplicata(s) selecionada(s) para baixa.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <div className="font-semibold text-xs mb-2 text-slate-700">Dados da Baixa</div>
          <div className="grid grid-cols-12 gap-3">
            <Field label="Grupo">
              <Select
                value={grupoId}
                onValueChange={(v) => {
                  setGrupoId(v)
                  setSubGrupoId('')
                  setApropriacaoId('')
                }}
              >
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  {gruposNivel1.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Sub grupo">
              <Select
                value={subGrupoId}
                onValueChange={(v) => {
                  setSubGrupoId(v)
                  setApropriacaoId('')
                }}
              >
                <SelectTrigger className="h-7 text-xs bg-slate-50" disabled={!grupoId}>
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  {subGruposNivel2.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Apropriação">
              <Select value={apropriacaoId} onValueChange={setApropriacaoId}>
                <SelectTrigger className="h-7 text-xs bg-slate-50" disabled={!subGrupoId}>
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  {apropriacoesNivel3.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Situação">
              <Select value={situacao} onValueChange={setSituacao}>
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Forma de pgto.">
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Cartão">Cartão</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Bandeira">
              <Input
                className="h-7 text-xs bg-slate-50"
                value={bandeira}
                onChange={(e) => setBandeira(e.target.value)}
                disabled={formaPagamento !== 'Cartão'}
              />
            </Field>
            <Field label="Conta">
              <Select value={contaBancariaId} onValueChange={setContaBancariaId}>
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  {contasBancarias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Linha Digitável">
              <Input
                className="h-7 text-xs bg-slate-50 font-mono"
                value={linhaDigitavel}
                onChange={(e) => setLinhaDigitavel(e.target.value)}
              />
            </Field>

            <Field label="Data Pagamento">
              <Input
                type="date"
                className="h-7 text-xs bg-slate-50"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
              />
            </Field>
            <Field label="Juros e multas">
              <Input
                type="number"
                step="0.01"
                className="h-7 text-xs bg-slate-50"
                value={jurosMulta}
                onChange={(e) => setJurosMulta(e.target.value)}
              />
            </Field>
            <Field label="Descontos">
              <Input
                type="number"
                step="0.01"
                className="h-7 text-xs bg-slate-50"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
              />
            </Field>
            <Field label="Observações" span={6}>
              <Textarea
                className="text-xs bg-slate-50 h-7 min-h-7 py-1"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </Field>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Juros/multas e descontos são aplicados a cada duplicata selecionada individualmente
            (valor do pgto. = valor da parcela + juros − desconto).
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold text-slate-700 border-b">
            Duplicatas baixadas nesta sessão
          </div>
          <Table className="text-xs">
            <TableHeader className="bg-slate-50">
              <TableRow className="h-7">
                <TableHead className="p-1">Duplicata</TableHead>
                <TableHead className="p-1 text-center">Pagamento</TableHead>
                <TableHead className="p-1 text-center">Atraso</TableHead>
                <TableHead className="p-1 text-right">Valor Parcela</TableHead>
                <TableHead className="p-1 text-right">Juros</TableHead>
                <TableHead className="p-1 text-right">Desconto</TableHead>
                <TableHead className="p-1 text-right">Valor Pago</TableHead>
                <TableHead className="p-1">Conta</TableHead>
                <TableHead className="p-1">Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {baixadas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-4 text-slate-400 italic">
                    Nenhuma baixa realizada ainda.
                  </TableCell>
                </TableRow>
              ) : (
                baixadas.map((b) => (
                  <TableRow key={b.id} className="h-7">
                    <TableCell className="p-1 font-mono">{b.nosso_numero}</TableCell>
                    <TableCell className="p-1 text-center">{formatDate(b.data_pagamento)}</TableCell>
                    <TableCell className="p-1 text-center">{getAtraso(b.vencimento)}</TableCell>
                    <TableCell className="p-1 text-right font-mono">
                      {formatCurrency(b.valor)}
                    </TableCell>
                    <TableCell className="p-1 text-right font-mono">
                      {formatCurrency(b.juros_multa)}
                    </TableCell>
                    <TableCell className="p-1 text-right font-mono">
                      {formatCurrency(b.desconto)}
                    </TableCell>
                    <TableCell className="p-1 text-right font-mono">
                      {formatCurrency(b.valor_pago)}
                    </TableCell>
                    <TableCell className="p-1">
                      {contasBancarias.find((c) => c.id === b.conta_bancaria_id)?.nome || '-'}
                    </TableCell>
                    <TableCell className="p-1 truncate max-w-[160px]">
                      {b.observacao || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="bg-slate-200 border-t px-4 py-2 flex justify-end gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={() => navigate('/duplicatas')}>
          Fechar
        </Button>
        <Button size="sm" onClick={handleSalvar} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}
