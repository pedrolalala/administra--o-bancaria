import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { EH_PAGAR } from '@/lib/modo-sistema'
import {
  candidatasCompensacao,
  compensar,
  compensarComNovaConta,
  saldoDaParcela,
  type CandidataCompensacao,
} from '@/lib/financeiro-novo'

// SPEC-322: compensação (permuta) = quita uma conta a pagar contra uma a receber da MESMA pessoa/empresa, sem dinheiro.
// Parcial permitida (o saldo continua aberto no lado que sobrou). Fica no log e pode ser estornada nas duas contas de uma vez.
// Aba "Registrar serviço" (só partindo de uma conta a receber): cria a conta a pagar do serviço e já compensa, numa transação.

interface Props {
  open: boolean
  onClose: () => void
  duplicata: any | null
  onSuccess: () => void
}

const brl = (v: number | null | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const num = (s: string) => {
  const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const r2 = (n: number) => Math.round(n * 100) / 100
const fmtData = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '-')

export function CompensarModal({ open, onClose, duplicata, onSuccess }: Props) {
  const { toast } = useToast()
  const hoje = new Date().toISOString().slice(0, 10)
  const parcelaId: string | null = duplicata?._parcelaId ?? null
  const [aba, setAba] = useState<'existente' | 'nova'>('existente')
  const [saldoOrigem, setSaldoOrigem] = useState(0)
  const [candidatas, setCandidatas] = useState<CandidataCompensacao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [marcadas, setMarcadas] = useState<Record<string, string>>({}) // parcela_id -> valor
  const [data, setData] = useState(hoje)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  // aba "Registrar serviço"
  const [plano, setPlano] = useState<any[]>([])
  const [planoId, setPlanoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [documento, setDocumento] = useState('')
  const [valorConta, setValorConta] = useState('')
  const [valorComp, setValorComp] = useState('')
  const [vencimento, setVencimento] = useState(hoje)

  useEffect(() => {
    if (!open || !parcelaId) return
    let cancelado = false
    setCarregando(true)
    setMarcadas({})
    setMotivo('')
    setData(hoje)
    setAba('existente')
    setPlanoId('')
    setDescricao('')
    setDocumento('')
    setValorConta('')
    setValorComp('')
    setVencimento(hoje)
    Promise.all([saldoDaParcela(parcelaId), candidatasCompensacao(parcelaId)])
      .then(([saldo, cands]) => {
        if (cancelado) return
        setSaldoOrigem(saldo)
        setCandidatas(cands)
        // sem nada para compensar e partindo de uma conta a receber: já abre a aba de registrar o serviço
        if (cands.length === 0 && !EH_PAGAR) setAba('nova')
      })
      .catch((e: any) => toast({ title: 'Erro ao buscar as contas', description: e?.message, variant: 'destructive' }))
      .finally(() => !cancelado && setCarregando(false))
    if (!EH_PAGAR) {
      supabase
        .from('plano_de_contas')
        .select('id, nome, nivel, parent_id, tipo')
        .eq('ativo', true)
        .order('nome')
        .then(({ data: d }) => !cancelado && setPlano(d || []))
    }
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, parcelaId])

  // Apropriações (nível 3) de grupos de despesa, com o caminho completo no rótulo
  const apropriacoes = useMemo(() => {
    const porId = new Map(plano.map((p) => [p.id, p]))
    return plano
      .filter((p) => p.nivel === 3)
      .map((p) => {
        const sub = porId.get(p.parent_id)
        const grupo = sub ? porId.get(sub.parent_id) : null
        return { id: p.id as string, tipo: grupo?.tipo as string | undefined, rotulo: [grupo?.nome, sub?.nome, p.nome].filter(Boolean).join(' › ') }
      })
      .filter((a) => a.tipo === 'despesa')
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo))
  }, [plano])

  const totalMarcado = r2(Object.values(marcadas).reduce((s, v) => s + num(v), 0))
  const restante = r2(saldoOrigem - totalMarcado)

  const alternar = (c: CandidataCompensacao) => {
    setMarcadas((prev) => {
      const novo = { ...prev }
      if (c.parcela_id in novo) {
        delete novo[c.parcela_id]
      } else {
        const usado = r2(Object.values(prev).reduce((s, v) => s + num(v), 0))
        const sugestao = Math.max(0, Math.min(c.saldo, r2(saldoOrigem - usado)))
        novo[c.parcela_id] = String(sugestao).replace('.', ',')
      }
      return novo
    })
  }

  const confirmarExistente = async () => {
    if (!parcelaId) return
    const itens = candidatas.filter((c) => c.parcela_id in marcadas).map((c) => ({ c, valor: r2(num(marcadas[c.parcela_id])) }))
    if (itens.length === 0) return toast({ title: 'Marque ao menos uma conta', variant: 'destructive' })
    if (itens.some((i) => i.valor <= 0 || i.valor > i.c.saldo + 0.001))
      return toast({ title: 'Valor inválido', description: 'Cada valor deve ser maior que zero e no máximo o saldo da conta.', variant: 'destructive' })
    if (totalMarcado > saldoOrigem + 0.001)
      return toast({ title: 'Passou do saldo', description: `Esta conta tem ${brl(saldoOrigem)} em aberto.`, variant: 'destructive' })
    if (!motivo.trim()) return toast({ title: 'Informe o motivo da compensação', variant: 'destructive' })
    setSaving(true)
    let feitas = 0
    try {
      for (const i of itens) {
        await compensar({
          parcelaPagar: EH_PAGAR ? parcelaId : i.c.parcela_id,
          parcelaReceber: EH_PAGAR ? i.c.parcela_id : parcelaId,
          valor: i.valor,
          motivo,
          data,
        })
        feitas++
      }
      toast({ title: 'Compensação registrada', description: `${feitas} compensação(ões), ${brl(totalMarcado)}. Ficou no log e pode ser estornada.` })
      onSuccess()
      onClose()
    } catch (e: any) {
      toast({
        title: 'Erro ao compensar',
        description: `${e?.message || e}${feitas > 0 ? ` (${feitas} já foram registradas antes do erro; confira na consulta)` : ''}`,
        variant: 'destructive',
      })
      if (feitas > 0) onSuccess()
    } finally {
      setSaving(false)
    }
  }

  const confirmarNova = async () => {
    if (!parcelaId) return
    const vConta = r2(num(valorConta))
    const vComp = r2(num(valorComp))
    if (!planoId) return toast({ title: 'Escolha a apropriação do serviço', variant: 'destructive' })
    if (vConta <= 0 || vComp <= 0 || vComp > vConta) return toast({ title: 'Valores inválidos', description: 'O valor compensado deve ser maior que zero e no máximo o valor do serviço.', variant: 'destructive' })
    if (vComp > saldoOrigem + 0.001) return toast({ title: 'Passou do saldo a receber', description: `Esta conta tem ${brl(saldoOrigem)} em aberto.`, variant: 'destructive' })
    if (!motivo.trim()) return toast({ title: 'Informe o motivo da compensação', variant: 'destructive' })
    setSaving(true)
    try {
      await compensarComNovaConta({
        parcelaReceber: parcelaId,
        valorConta: vConta,
        valorCompensado: vComp,
        planoContasId: planoId,
        descricao,
        documento,
        vencimento,
        motivo,
        data,
      })
      toast({
        title: 'Serviço registrado e compensado',
        description: `Conta a pagar de ${brl(vConta)} criada e ${brl(vComp)} compensado.${vConta > vComp ? ` Restam ${brl(r2(vConta - vComp))} a pagar.` : ''}`,
      })
      onSuccess()
      onClose()
    } catch (e: any) {
      toast({ title: 'Erro ao registrar', description: e?.message || String(e), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compensar (permuta)</DialogTitle>
          <DialogDescription>
            {duplicata ? (
              <>
                {duplicata.nome_pagador} — {EH_PAGAR ? 'conta a pagar' : 'conta a receber'} com <b>{brl(saldoOrigem)}</b> em aberto. A compensação quita as duas contas sem
                movimentar dinheiro.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {!EH_PAGAR && (
          <div className="flex gap-2">
            <Button size="sm" variant={aba === 'existente' ? 'default' : 'outline'} onClick={() => setAba('existente')}>
              Contas a pagar existentes
            </Button>
            <Button size="sm" variant={aba === 'nova' ? 'default' : 'outline'} onClick={() => setAba('nova')}>
              Registrar o serviço e compensar
            </Button>
          </div>
        )}

        {aba === 'existente' ? (
          <div className="space-y-2">
            <div className="max-h-56 overflow-auto rounded-md border">
              {carregando ? (
                <div className="p-4 text-center text-xs text-slate-500">Buscando...</div>
              ) : candidatas.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Nenhuma conta {EH_PAGAR ? 'a receber' : 'a pagar'} em aberto desta mesma pessoa e empresa.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-1.5 w-8" />
                      <th className="p-1.5 text-left">Documento</th>
                      <th className="p-1.5 text-center">Vencimento</th>
                      <th className="p-1.5 text-right">Saldo</th>
                      <th className="p-1.5 text-right w-32">Compensar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidatas.map((c) => (
                      <tr key={c.parcela_id} className="border-t">
                        <td className="p-1.5 text-center">
                          <input type="checkbox" checked={c.parcela_id in marcadas} onChange={() => alternar(c)} />
                        </td>
                        <td className="p-1.5">
                          {c.documento || c.descricao || '-'} <span className="text-slate-400">({c.numero})</span>
                        </td>
                        <td className="p-1.5 text-center">{fmtData(c.vencimento)}</td>
                        <td className="p-1.5 text-right">{brl(c.saldo)}</td>
                        <td className="p-1.5">
                          <Input
                            className="h-7 text-xs text-right"
                            disabled={!(c.parcela_id in marcadas)}
                            value={marcadas[c.parcela_id] ?? ''}
                            onChange={(e) => setMarcadas((p) => ({ ...p, [c.parcela_id]: e.target.value }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex justify-between text-xs">
              <span>
                Total a compensar: <b>{brl(totalMarcado)}</b>
              </span>
              <span className={restante < 0 ? 'text-red-600' : 'text-slate-500'}>Saldo desta conta depois: {brl(restante)}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] text-slate-500 font-medium uppercase">Apropriação do serviço (despesa)</label>
              <Select value={planoId} onValueChange={setPlanoId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {apropriacoes.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-slate-500 font-medium uppercase">Descrição do serviço</label>
              <Input className="h-8 text-xs" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: serviço prestado em permuta" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-medium uppercase">NF / Documento</label>
              <Input className="h-8 text-xs" value={documento} onChange={(e) => setDocumento(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-medium uppercase">Vencimento</label>
              <Input type="date" className="h-8 text-xs" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-medium uppercase">Valor do serviço (R$)</label>
              <Input
                className="h-8 text-xs text-right"
                value={valorConta}
                onChange={(e) => {
                  setValorConta(e.target.value)
                  setValorComp(String(Math.min(saldoOrigem, num(e.target.value))).replace('.', ','))
                }}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-medium uppercase">Valor a compensar (R$)</label>
              <Input className="h-8 text-xs text-right" value={valorComp} onChange={(e) => setValorComp(e.target.value)} />
            </div>
            <p className="col-span-2 text-[11px] text-slate-500">
              Se o serviço for maior que o a receber, o que sobrar fica como conta a pagar em aberto. Se for menor, o a receber continua com o saldo.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 font-medium uppercase">Data da compensação</label>
            <Input type="date" className="h-8 text-xs" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="col-span-3">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Motivo *</label>
            <Textarea rows={2} className="text-xs" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: permuta — serviço prestado pelo fornecedor" />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" disabled={saving || carregando} onClick={aba === 'existente' ? confirmarExistente : confirmarNova}>
            {saving ? 'Salvando...' : aba === 'existente' ? 'Compensar' : 'Registrar e compensar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
