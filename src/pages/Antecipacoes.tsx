import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { EH_PAGAR } from '@/lib/modo-sistema'
import { PagamentosAntecipadosPainel } from '@/components/PagamentosAntecipadosDialog'

// SPEC-270: aba "Antecipações" nos dois sistemas.
//  - Contas a Pagar: o pagamento antecipado de fornecedor (SPEC-215) — o mesmo painel que existia só dentro de Contas em Aberto.
//    Continua na tabela pagamentos_antecipados porque a Entrada de Nota Fiscal (Compras) lê dali.
//  - Contas a Receber: as antecipações de clientes (título 'adiantamento' do modelo novo), com lançar e cancelar.

const brl = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
const dia = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—')

function AntecipacoesPagar() {
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([])
  useEffect(() => {
    supabase.from('empresas').select('id, nome').order('nome').then(({ data }) => setEmpresas(data || []))
  }, [])
  return <PagamentosAntecipadosPainel empresas={empresas} />
}

interface LinhaReceber {
  titulo_id: string
  nome_pagador: string
  empresa_nome: string | null
  emissao: string | null
  data_pagamento: string | null
  valor: number
  observacao: string | null
  plano_contas_nome: string | null
  status: string
  responsavel: string
}

function AntecipacoesReceber() {
  const { toast } = useToast()
  const [linhas, setLinhas] = useState<LinhaReceber[]>([])
  const [carregando, setCarregando] = useState(true)
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await (supabase as any)
      .from('vw_financeiro_duplicatas')
      .select('titulo_id, status, nome_pagador, empresa_nome, emissao, data_pagamento, valor, observacao, plano_contas_nome')
      .eq('especie', 'adiantamento')
      .eq('natureza', 'receber')
      .order('data_pagamento', { ascending: false })
      .limit(500)
    if (error) {
      setCarregando(false)
      toast({ title: 'Erro ao carregar as antecipações', description: error.message, variant: 'destructive' })
      return
    }
    const ids = ((data ?? []) as any[]).map((r) => r.titulo_id)
    const resp = new Map<string, string>()
    if (ids.length > 0) {
      const [{ data: tits }, { data: usr }] = await Promise.all([
        (supabase as any).from('financeiro_titulos').select('id, responsavel_id').in('id', ids),
        supabase.from('usuarios').select('id, nome'),
      ])
      const nomes = new Map<string, string>((usr || []).map((u: any) => [u.id, u.nome]))
      for (const t of tits || []) if (t.responsavel_id) resp.set(t.id, nomes.get(t.responsavel_id) || '—')
    }
    setLinhas(((data ?? []) as any[]).map((r) => ({ ...r, valor: Number(r.valor) || 0, responsavel: resp.get(r.titulo_id) || '—' })))
    setCarregando(false)
  }, [toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function cancelar(tituloId: string) {
    if (!motivo.trim()) {
      toast({ title: 'Informe o motivo do cancelamento', variant: 'destructive' })
      return
    }
    setSalvando(true)
    const { error } = await (supabase as any).rpc('financeiro_cancelar_antecipacao', { p_titulo: tituloId, p_motivo: motivo.trim() })
    setSalvando(false)
    if (error) {
      toast({ title: 'Não foi possível cancelar', description: error.message, variant: 'destructive' })
      return
    }
    setCancelando(null)
    setMotivo('')
    carregar()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 max-w-3xl">
          Valores que o cliente já pagou antes da venda. Entram como já recebidos e ficam com saldo a compensar. Aparecem também em
          Consultar Duplicatas (filtro Todos ou Pago) com o selo AT.
        </p>
        <Button size="sm" asChild>
          <Link to="/antecipacoes/nova">
            <Plus className="w-4 h-4 mr-1" /> Nova antecipação
          </Link>
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Pago em</TableHead>
            <TableHead className="text-xs">Emissão</TableHead>
            <TableHead className="text-xs">Cliente</TableHead>
            <TableHead className="text-xs">Empresa</TableHead>
            <TableHead className="text-xs">Apropriação</TableHead>
            <TableHead className="text-xs">Responsável</TableHead>
            <TableHead className="text-xs text-right">Valor</TableHead>
            <TableHead className="text-xs text-right">Saldo a compensar</TableHead>
            <TableHead className="text-xs">Situação</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {carregando ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-6 text-slate-400">
                <Loader2 className="w-4 h-4 inline mr-1 animate-spin" /> Carregando...
              </TableCell>
            </TableRow>
          ) : linhas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-6 text-slate-400">
                Nenhuma antecipação lançada.
              </TableCell>
            </TableRow>
          ) : (
            linhas.map((l) => {
              const cancelada = l.status === 'Cancelado'
              return (
                <TableRow key={l.titulo_id} className={cancelada ? 'opacity-60' : ''}>
                  <TableCell className="text-xs">{dia(l.data_pagamento)}</TableCell>
                  <TableCell className="text-xs">{dia(l.emissao)}</TableCell>
                  <TableCell className="text-xs">
                    {l.nome_pagador}
                    {l.observacao && <span className="block text-[11px] text-slate-500">{l.observacao}</span>}
                  </TableCell>
                  <TableCell className="text-xs">{l.empresa_nome ?? '—'}</TableCell>
                  <TableCell className="text-xs">{l.plano_contas_nome ?? '—'}</TableCell>
                  <TableCell className="text-xs">{l.responsavel}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{brl(l.valor)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums font-semibold">{cancelada ? '—' : brl(l.valor)}</TableCell>
                  <TableCell>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded ${cancelada ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                      {cancelada ? 'Cancelada' : 'Disponível'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {!cancelada &&
                      (cancelando === l.titulo_id ? (
                        <div className="flex flex-col gap-1 items-end">
                          <Input className="h-7 w-40 text-xs" placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setCancelando(null)}>
                              Voltar
                            </Button>
                            <Button size="sm" variant="destructive" className="h-6 text-xs" disabled={salvando} onClick={() => cancelar(l.titulo_id)}>
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
                            setCancelando(l.titulo_id)
                            setMotivo('')
                          }}
                        >
                          Cancelar
                        </Button>
                      ))}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default function Antecipacoes() {
  return (
    <div className="flex flex-col h-[calc(100vh-56px)] w-full bg-slate-50 overflow-hidden text-sm">
      <div className="bg-white border-b px-4 py-2 shadow-sm z-10 shrink-0">
        <h1 className="text-lg font-semibold text-slate-800">
          {EH_PAGAR ? 'Antecipações — pagamentos antecipados a fornecedores' : 'Antecipações de pagamento de clientes'}
        </h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          {EH_PAGAR ? (
            <>
              <p className="text-sm text-slate-500 mb-3 max-w-3xl">
                Valor pago ao fornecedor antes da nota fiscal (sinal ou 100%). Quando a nota chegar, a Entrada de Nota Fiscal (Compras)
                mostra o saldo para vincular: a nota desconta o valor usado.
              </p>
              <AntecipacoesPagar />
            </>
          ) : (
            <AntecipacoesReceber />
          )}
        </div>
      </div>
    </div>
  )
}
