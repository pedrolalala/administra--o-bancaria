import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { baixarLote, buscarContasBancarias, type ContaBancaria } from '@/lib/financeiro-novo'

interface ExecutarBaixaModalProps {
  open: boolean
  onClose: () => void
  duplicatas: any[]
  onSuccess: () => void
}

// SPEC-073 sinalizava este botão como "não implementado, aguardando
// definição do fluxo" (P-1) -- usuário definiu em 2026-08-20: dar baixa
// (marcar como Pago) direto nas duplicatas selecionadas, sem precisar
// navegar até a tela "Baixar Duplicata". Mesmos campos/cálculo de
// valor_pago que BaixarDuplicata.tsx usa, só que num modal inline.
export function ExecutarBaixaModal({
  open,
  onClose,
  duplicatas,
  onSuccess,
}: ExecutarBaixaModalProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [formaPagamento, setFormaPagamento] = useState('')
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10))
  const [jurosMulta, setJurosMulta] = useState('0')
  const [desconto, setDesconto] = useState('0')
  // SPEC-258 Fase 5: a baixa também entra no financeiro novo, que exige a conta bancária do dinheiro
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [contaId, setContaId] = useState('')
  const precisaConta = duplicatas.some((d) => d._parcelaId)

  useEffect(() => {
    if (!open) return
    buscarContasBancarias()
      .then(setContas)
      .catch((e) => toast({ title: 'Não foi possível carregar as contas bancárias', description: e?.message, variant: 'destructive' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const formatCurrency = (v: number | null | undefined) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

  const handleConfirmar = async () => {
    if (!formaPagamento) {
      toast({ title: 'Informe a Forma de pagamento', variant: 'destructive' })
      return
    }
    if (precisaConta && !contaId) {
      toast({ title: 'Informe a conta bancária', description: 'O dinheiro entra (ou sai) por uma conta.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const jurosVal = parseFloat(jurosMulta) || 0
      const descontoVal = parseFloat(desconto) || 0

      // financeiro novo primeiro (tudo ou nada): se o banco recusar, nada foi baixado
      const parcelaIds = Array.from(new Set(duplicatas.map((d) => d._parcelaId).filter(Boolean))) as string[]
      if (parcelaIds.length > 0) {
        await baixarLote({
          parcelaIds,
          data: dataPagamento,
          forma: formaPagamento,
          contaId,
          juros: jurosVal,
          desconto: descontoVal,
        })
      }
      // o que tem boleto: o boleto também vira Pago (remessa/retorno olham o boleto)
      const soBoletos = duplicatas.filter((d) => d._fonte !== 'financeiro')

      const results = await Promise.all(
        soBoletos.map((d) => {
          const valorPago = (Number(d.valor) || 0) + jurosVal - descontoVal
          return supabase
            .from('boletos')
            .update({
              status: 'Pago',
              forma_pagamento: formaPagamento,
              data_pagamento: dataPagamento,
              juros_multa: jurosVal,
              desconto: descontoVal,
              valor_pago: valorPago,
              ...(contaId ? { conta_bancaria_id: contaId } : {}),
            })
            .eq('id', d.id)
        }),
      )

      const falhas = results.filter((r) => r.error)
      if (falhas.length > 0) {
        throw new Error(falhas.map((f) => f.error?.message).join('; '))
      }

      toast({
        title: 'Baixa executada',
        description: `${duplicatas.length} duplicata(s) marcada(s) como Pago.`,
      })
      onSuccess()
      onClose()
    } catch (e: any) {
      toast({ title: 'Erro ao executar baixa', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const total = duplicatas.reduce((s, d) => s + (Number(d.valor) || 0), 0)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Executar baixa</DialogTitle>
          <DialogDescription>
            {duplicatas.length} duplicata(s) selecionada(s), total {formatCurrency(total)} — serão
            marcadas como <strong>Pago</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-slate-500 font-medium uppercase">
              Forma de pagamento *
            </label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger className="h-8 text-sm">
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
          </div>
          {precisaConta && (
            <div>
              <label className="text-[10px] text-slate-500 font-medium uppercase">
                Conta bancária *
              </label>
              <Select value={contaId} onValueChange={setContaId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-[10px] text-slate-500 font-medium uppercase">
              Data pagamento
            </label>
            <Input
              type="date"
              className="h-8 text-sm"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 font-medium uppercase">
                Juros e multas
              </label>
              <Input
                type="number"
                step="0.01"
                className="h-8 text-sm"
                value={jurosMulta}
                onChange={(e) => setJurosMulta(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-medium uppercase">Desconto</label>
              <Input
                type="number"
                step="0.01"
                className="h-8 text-sm"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Juros/multas e desconto são aplicados a cada duplicata individualmente (valor pago =
            valor da parcela + juros − desconto). A baixa fica no histórico e pode ser estornada.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirmar} disabled={saving}>
            {saving ? 'Executando...' : 'Confirmar baixa'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
