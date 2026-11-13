import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { apagarConta } from '@/lib/financeiro-novo'

interface Props {
  open: boolean
  onClose: () => void
  duplicatas: any[]
  onSuccess: () => void
}

const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

/** SPEC-297: apagar contas abertas com justificativa obrigatória. No financeiro a conta é CANCELADA (fica no histórico);
 *  boleto avulso vai para o backup. Conta com baixa: estornar antes. Tudo fica no log. */
export function ApagarContaModal({ open, onClose, duplicatas, onSuccess }: Props) {
  const { toast } = useToast()
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const total = duplicatas.reduce((s, d) => s + (Number(d.valor) || 0), 0)
  const pagas = duplicatas.filter((d) => d.status === 'Pago')

  const confirmar = async () => {
    if (!motivo.trim()) {
      toast({ title: 'Informe a justificativa', variant: 'destructive' })
      return
    }
    setSaving(true)
    let feitas = 0
    try {
      for (const d of duplicatas) {
        await apagarConta({ parcelaId: d._parcelaId ?? null, boletoId: d._fonte === 'financeiro' ? null : d.id, motivo })
        feitas++
      }
      toast({ title: 'Conta(s) apagada(s)', description: `${feitas} conta(s). A justificativa ficou registrada no log.` })
      setMotivo('')
      onSuccess()
      onClose()
    } catch (e: any) {
      toast({
        title: 'Erro ao apagar',
        description: `${feitas > 0 ? `${feitas} já apagada(s) antes do erro. ` : ''}${e?.message ?? String(e)}`,
        variant: 'destructive',
      })
      if (feitas > 0) onSuccess()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apagar conta</DialogTitle>
          <DialogDescription>
            {duplicatas.length} conta(s), total {brl(total)}. A conta sai da lista, mas o cancelamento e a justificativa ficam
            registrados no log. Não dá para apagar conta com baixa (estorne antes).
          </DialogDescription>
        </DialogHeader>
        {pagas.length > 0 && (
          <p className="text-xs text-red-600">Há {pagas.length} conta(s) paga(s) na seleção: estorne a baixa antes de apagar.</p>
        )}
        <div className="max-h-32 overflow-auto text-xs text-slate-600 border rounded p-2">
          {duplicatas.map((d) => (
            <div key={d.id}>
              {d.numero_documento || '—'} · {d.nome_pagador || '—'} · {brl(Number(d.valor))}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-slate-500 font-medium uppercase">Justificativa da exclusão *</label>
          <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={saving} placeholder="Ex.: lançamento duplicado" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" variant="destructive" onClick={confirmar} disabled={saving || !motivo.trim() || pagas.length > 0}>
            {saving ? 'Apagando...' : 'Apagar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
