import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { estornarParcelas } from '@/lib/financeiro-novo'

interface Props {
  open: boolean
  onClose: () => void
  duplicatas: any[]
  onSuccess: () => void
}

const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

/** SPEC-258 Fase 5: estorna a baixa das duplicatas pagas selecionadas. A baixa NUNCA é apagada: o estorno entra no histórico com o motivo
 *  e a parcela volta a ficar aberta. Se a duplicata tem boleto, o boleto volta para Pendente junto. */
export function EstornarBaixaModal({ open, onClose, duplicatas, onSuccess }: Props) {
  const { toast } = useToast()
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  const total = duplicatas.reduce((s, d) => s + (Number(d.valor_pago) || Number(d.valor) || 0), 0)

  const confirmar = async () => {
    if (!motivo.trim()) {
      toast({ title: 'Informe o motivo do estorno', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const parcelaIds = Array.from(new Set(duplicatas.map((d) => d._parcelaId).filter(Boolean))) as string[]
      const n = await estornarParcelas(parcelaIds, motivo)
      // o que tem boleto: o boleto volta para Pendente (o modelo novo já foi estornado acima)
      const boletoIds = duplicatas.filter((d) => d._fonte !== 'financeiro').map((d) => d.id)
      if (boletoIds.length > 0) {
        const { error } = await supabase
          .from('boletos')
          .update({ status: 'Pendente', valor_pago: null, data_pagamento: null })
          .in('id', boletoIds)
        if (error) throw new Error(`Estorno feito no financeiro, mas o boleto não voltou para Pendente: ${error.message}`)
      }
      toast({
        title: 'Baixa estornada',
        description: `${n} baixa(s) de ${duplicatas.length} duplicata(s) estornada(s). Elas voltaram para a lista de abertas.`,
      })
      setMotivo('')
      onSuccess()
      onClose()
    } catch (e: any) {
      toast({ title: 'Erro ao estornar', description: e?.message ?? String(e), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Estornar baixa</DialogTitle>
          <DialogDescription>
            {duplicatas.length} duplicata(s) paga(s), total {brl(total)}. As duplicatas voltam a ficar abertas e o estorno
            fica registrado no histórico com o motivo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-[10px] text-slate-500 font-medium uppercase">Motivo do estorno *</label>
          <Textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: baixa lançada na conta errada"
            disabled={saving}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" variant="destructive" onClick={confirmar} disabled={saving || !motivo.trim()}>
            {saving ? 'Estornando...' : 'Confirmar estorno'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
