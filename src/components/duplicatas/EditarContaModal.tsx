import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { editarParcela } from '@/lib/financeiro-novo'

interface Props {
  open: boolean
  onClose: () => void
  duplicata: any | null
  onSuccess: () => void
}

/** SPEC-297: editar uma conta aberta (vencimento, valor, descrição) com justificativa obrigatória. Fica registrado na auditoria. */
export function EditarContaModal({ open, onClose, duplicata, onSuccess }: Props) {
  const { toast } = useToast()
  const [vencimento, setVencimento] = useState('')
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && duplicata) {
      setVencimento(String(duplicata.vencimento ?? '').slice(0, 10))
      setValor(String(duplicata.valor ?? ''))
      setDescricao(duplicata.observacao ?? '')
      setMotivo('')
    }
  }, [open, duplicata])

  const confirmar = async () => {
    const v = Number(String(valor).replace(',', '.'))
    if (!duplicata?._parcelaId) return
    if (!vencimento || !Number.isFinite(v) || v === 0) {
      toast({ title: 'Confira o vencimento e o valor', variant: 'destructive' })
      return
    }
    if (!motivo.trim()) {
      toast({ title: 'Informe a justificativa', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await editarParcela({ parcelaId: duplicata._parcelaId, vencimento, valor: v, descricao, motivo })
      toast({ title: 'Conta alterada', description: 'A alteração e a justificativa ficaram registradas no log.' })
      onSuccess()
      onClose()
    } catch (e: any) {
      toast({ title: 'Erro ao alterar', description: e?.message ?? String(e), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar conta</DialogTitle>
          <DialogDescription>
            {duplicata?.numero_documento || '—'} · {duplicata?.nome_pagador || '—'}. Só conta aberta e sem baixa; a alteração e a
            justificativa ficam registradas no log.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 font-medium uppercase">Vencimento *</label>
            <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} disabled={saving} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-medium uppercase">Valor *</label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} disabled={saving} inputMode="decimal" />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Descrição</label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={saving} />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Justificativa da alteração *</label>
            <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={saving} placeholder="Ex.: vencimento combinado com o cliente" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={confirmar} disabled={saving || !motivo.trim()}>
            {saving ? 'Salvando...' : 'Salvar alteração'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
