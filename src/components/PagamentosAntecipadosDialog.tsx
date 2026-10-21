import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// SPEC-215: pagamento ao fornecedor antes da nota (sinal ou 100%). Lançado aqui pelo financeiro; quando a
// nota chega, a Entrada de Nota Fiscal (Compras) mostra o saldo e vincula — a nota desconta o valor usado.
// Aparece no Contas a Pagar do Dashboard como pago (DESPESAS › PAGAMENTO ANTECIPADO).

interface PagamentoAntecipado {
  id: string
  fornecedor_nome: string
  empresa_nome: string
  pedido_numero: string | null
  valor: number
  data_pagamento: string
  observacao: string | null
  criado_por_nome: string | null
  valor_aplicado: number
  saldo: number
  notas_vinculadas: string
  situacao: 'disponivel' | 'usado_em_parte' | 'usado' | 'cancelado'
  motivo_cancelamento: string | null
}

const SITUACAO: Record<PagamentoAntecipado['situacao'], { texto: string; cor: string }> = {
  disponivel: { texto: 'Disponível', cor: 'bg-emerald-100 text-emerald-800' },
  usado_em_parte: { texto: 'Usado em parte', cor: 'bg-amber-100 text-amber-800' },
  usado: { texto: 'Usado', cor: 'bg-slate-200 text-slate-700' },
  cancelado: { texto: 'Cancelado', cor: 'bg-red-100 text-red-700' },
}

const brl = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
const dia = (d: string) => d.split('-').reverse().join('/')
const lerValor = (v: string) => {
  const t = v.trim()
  return parseFloat(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t) || 0
}

export function PagamentosAntecipadosDialog({
  open,
  onOpenChange,
  empresas,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  empresas: { id: string; nome: string }[]
}) {
  const { toast } = useToast()
  const [lista, setLista] = useState<PagamentoAntecipado[]>([])
  const [carregando, setCarregando] = useState(false)
  const [lancando, setLancando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const [buscaForn, setBuscaForn] = useState('')
  const [resultados, setResultados] = useState<{ id: string; nome: string }[]>([])
  const [fornecedor, setFornecedor] = useState<{ id: string; nome: string } | null>(null)
  const [pedidos, setPedidos] = useState<{ id: string; numero: string; valor_total: number | null; status: string }[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [pedidoId, setPedidoId] = useState('nenhum')
  const [valor, setValor] = useState('')
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().slice(0, 10))
  const [observacao, setObservacao] = useState('')

  const [cancelandoId, setCancelandoId] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await (supabase as any)
      .from('vw_pagamentos_antecipados')
      .select('*')
      .order('data_pagamento', { ascending: false })
      .limit(300)
    setCarregando(false)
    if (error) {
      toast({ title: 'Erro ao carregar pagamentos antecipados', description: error.message, variant: 'destructive' })
      return
    }
    setLista(
      ((data ?? []) as any[]).map((r) => ({
        ...r,
        valor: Number(r.valor) || 0,
        valor_aplicado: Number(r.valor_aplicado) || 0,
        saldo: Number(r.saldo) || 0,
      })),
    )
  }, [toast])

  useEffect(() => {
    if (open) carregar()
  }, [open, carregar])

  useEffect(() => {
    if (!buscaForn.trim() || fornecedor) {
      setResultados([])
      return
    }
    const t = setTimeout(async () => {
      const { data } = await (supabase as any).rpc('buscar_fornecedores_fuzzy', { p_termo: buscaForn.trim() })
      setResultados(((data ?? []) as any[]).slice(0, 15))
    }, 300)
    return () => clearTimeout(t)
  }, [buscaForn, fornecedor])

  // Pedidos em aberto do fornecedor: ligar o sinal ao pedido tira esse valor da previsão do pedido.
  useEffect(() => {
    setPedidoId('nenhum')
    if (!fornecedor) {
      setPedidos([])
      return
    }
    ;(supabase as any)
      .from('pedidos_compra')
      .select('id, numero, valor_total, status, empresa_id')
      .eq('fornecedor_id', fornecedor.id)
      .in('status', ['aguardando_aprovar', 'aprovado', 'parcialmente_recebido'])
      .not('numero', 'like', 'PC-LEGADO-%')
      .order('criado_em', { ascending: false })
      .then(({ data }: any) => setPedidos(data ?? []))
  }, [fornecedor])

  function limpar() {
    setLancando(false)
    setBuscaForn('')
    setFornecedor(null)
    setEmpresaId('')
    setPedidoId('nenhum')
    setValor('')
    setDataPagamento(new Date().toISOString().slice(0, 10))
    setObservacao('')
  }

  async function lancar() {
    if (!fornecedor || !empresaId || lerValor(valor) <= 0 || !dataPagamento) return
    setSalvando(true)
    const { error } = await (supabase as any).rpc('lancar_pagamento_antecipado', {
      p_fornecedor_id: fornecedor.id,
      p_empresa_id: empresaId,
      p_valor: lerValor(valor),
      p_data_pagamento: dataPagamento,
      p_pedido_compra_id: pedidoId === 'nenhum' ? null : pedidoId,
      p_observacao: observacao || null,
    })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao lançar pagamento antecipado', description: error.message, variant: 'destructive' })
      return
    }
    toast({
      title: 'Pagamento antecipado lançado',
      description: 'Vai aparecer na Entrada de Nota Fiscal deste fornecedor para vincular.',
    })
    limpar()
    carregar()
  }

  async function cancelar(id: string) {
    setSalvando(true)
    const { error } = await (supabase as any).rpc('cancelar_pagamento_antecipado', {
      p_id: id,
      p_motivo: motivo || null,
    })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao cancelar', description: error.message, variant: 'destructive' })
      return
    }
    setCancelandoId(null)
    setMotivo('')
    carregar()
  }

  const podeLancar = !!fornecedor && !!empresaId && lerValor(valor) > 0 && !!dataPagamento

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pagamentos antecipados</DialogTitle>
          <DialogDescription>
            Valor pago ao fornecedor antes da nota fiscal (sinal ou 100%). Quando a nota chegar, a Entrada
            de Nota Fiscal mostra o saldo para vincular: a nota desconta o valor usado.
          </DialogDescription>
        </DialogHeader>

        {!lancando ? (
          <div>
            <Button size="sm" onClick={() => setLancando(true)}>
              <Plus className="w-4 h-4 mr-1" /> Lançar pagamento antecipado
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="space-y-1 relative sm:col-span-2">
              <Label>Fornecedor *</Label>
              {fornecedor ? (
                <div className="flex items-center justify-between rounded-md border bg-slate-50 px-3 py-1.5">
                  <span className="font-medium">{fornecedor.nome}</span>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setFornecedor(null)}>
                    Trocar
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Buscar fornecedor..."
                    value={buscaForn}
                    onChange={(e) => setBuscaForn(e.target.value)}
                  />
                  {resultados.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-lg max-h-52 overflow-auto">
                      {resultados.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-0"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setFornecedor(f)
                            setBuscaForn('')
                          }}
                        >
                          {f.nome}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="space-y-1">
              <Label>Empresa que pagou *</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
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
            <div className="space-y-1">
              <Label>Valor pago (R$) *</Label>
              <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data do pagamento *</Label>
              <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Pedido de compra (opcional)</Label>
              <Select value={pedidoId} onValueChange={setPedidoId} disabled={!fornecedor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem pedido</SelectItem>
                  {pedidos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.numero}
                      {p.valor_total != null ? ` — ${brl(Number(p.valor_total))}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-3">
              <Label>Observação</Label>
              <Textarea
                rows={2}
                className="resize-none"
                placeholder="Ex.: sinal de 50% do pedido"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
            <div className="sm:col-span-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={limpar} disabled={salvando}>
                Cancelar
              </Button>
              <Button size="sm" onClick={lancar} disabled={!podeLancar || salvando}>
                {salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Lançar
              </Button>
            </div>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Pago em</TableHead>
              <TableHead className="text-xs">Fornecedor</TableHead>
              <TableHead className="text-xs">Empresa</TableHead>
              <TableHead className="text-xs">Pedido</TableHead>
              <TableHead className="text-xs text-right">Valor</TableHead>
              <TableHead className="text-xs text-right">Saldo</TableHead>
              <TableHead className="text-xs">Notas</TableHead>
              <TableHead className="text-xs">Situação</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-6 text-slate-400">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : lista.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-6 text-slate-400">
                  Nenhum pagamento antecipado lançado.
                </TableCell>
              </TableRow>
            ) : (
              lista.map((p) => (
                <TableRow key={p.id} className={p.situacao === 'cancelado' ? 'opacity-60' : ''}>
                  <TableCell className="text-xs">{dia(p.data_pagamento)}</TableCell>
                  <TableCell className="text-xs">
                    {p.fornecedor_nome}
                    {p.observacao && <span className="block text-[11px] text-slate-500">{p.observacao}</span>}
                  </TableCell>
                  <TableCell className="text-xs">{p.empresa_nome}</TableCell>
                  <TableCell className="text-xs">{p.pedido_numero ?? '—'}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{brl(p.valor)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums font-semibold">
                    {p.situacao === 'cancelado' ? '—' : brl(p.saldo)}
                  </TableCell>
                  <TableCell className="text-xs">{p.notas_vinculadas || '—'}</TableCell>
                  <TableCell>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded ${SITUACAO[p.situacao].cor}`}>
                      {SITUACAO[p.situacao].texto}
                    </span>
                    {p.motivo_cancelamento && (
                      <span className="block text-[11px] text-slate-500">{p.motivo_cancelamento}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.situacao === 'disponivel' &&
                      (cancelandoId === p.id ? (
                        <div className="flex flex-col gap-1 items-end">
                          <Input
                            className="h-7 w-40 text-xs"
                            placeholder="Motivo"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                          />
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setCancelandoId(null)}>
                              Voltar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-6 text-xs"
                              disabled={salvando}
                              onClick={() => cancelar(p.id)}
                            >
                              Confirmar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-red-600"
                          onClick={() => {
                            setCancelandoId(p.id)
                            setMotivo('')
                          }}
                        >
                          Cancelar
                        </Button>
                      ))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  )
}
