import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { cancelarConta } from '@/lib/financeiro-novo'

interface Props {
  open: boolean
  onClose: () => void
  duplicatas: any[]
  onSuccess: () => void
}

const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

/** SPEC-297: cancelar contas abertas com justificativa obrigatória. Nada é apagado: a conta fica Cancelada (filtro Canceladas)
 *  e o motivo, quem e quando ficam no log. Conta com baixa: estornar antes. */
export function CancelarContaModal({ open, onClose, duplicatas, onSuccess }: Props) {
  const { toast } = useToast()
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const total = duplicatas.reduce((s, d) => s + (Number(d.valor) || 0), 0)
  const pagas = duplicatas.filter((d) => d.status === 'Pago')
  const jaCanceladas = duplicatas.filter((d) => String(d.status ?? '').toLowerCase() === 'cancelado')

  const confirmar = async () => {
    if (!motivo.trim()) {
      toast({ title: 'Informe a justificativa', variant: 'destructive' })
      return
    }
    setSaving(true)
    let feitas = 0
    try {
      for (const d of duplicatas) {
        await cancelarConta({ parcelaId: d._parcelaId ?? null, boletoId: d._fonte === 'financeiro' ? null : d.id, motivo })
        feitas++
      }
      toast({ title: 'Conta(s) cancelada(s)', description: `${feitas} conta(s). Elas continuam no filtro Canceladas; a justificativa ficou no log.` })
      setMotivo('')
      onSuccess()
      onClose()
    } catch (e: any) {
      toast({
        title: 'Erro ao cancelar',
        description: `${feitas > 0 ? `${feitas} já cancelada(s) antes do erro. ` : ''}${e?.message ?? String(e)}`,
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
          <DialogTitle>Cancelar conta</DialogTitle>
          <DialogDescription>
            {duplicatas.length} conta(s), total {brl(total)}. Nada é apagado: a conta sai das abertas e passa para o filtro
            Canceladas, e o motivo, quem cancelou e quando ficam no log. Conta com baixa não cancela (estorne antes).
          </DialogDescription>
        </DialogHeader>
        {(pagas.length > 0 || jaCanceladas.length > 0) && (
          <p className="text-xs text-red-600">
            {pagas.length > 0 ? `Há ${pagas.length} conta(s) paga(s): estorne a baixa antes de cancelar. ` : ''}
            {jaCanceladas.length > 0 ? `Há ${jaCanceladas.length} conta(s) já cancelada(s) na seleção.` : ''}
          </p>
        )}
        <div className="max-h-32 overflow-auto text-xs text-slate-600 border rounded p-2">
          {duplicatas.map((d) => (
            <div key={d.id}>
              {d.numero_documento || '—'} · {d.nome_pagador || '—'} · {brl(Number(d.valor))}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-slate-500 font-medium uppercase">Justificativa do cancelamento *</label>
          <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={saving} placeholder="Ex.: lançamento duplicado" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Voltar
          </Button>
          <Button size="sm" variant="destructive" onClick={confirmar} disabled={saving || !motivo.trim() || pagas.length > 0 || jaCanceladas.length > 0}>
            {saving ? 'Cancelando...' : 'Cancelar conta'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
