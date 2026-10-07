import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface InfoDuplicataModalProps {
  open: boolean
  onClose: () => void
  duplicata: any | null
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-slate-500">{label}</span>
    <span className="font-medium text-right">{value ?? '-'}</span>
  </div>
)

// SPEC-073 sinalizava este botão como "não implementado, aguardando
// definição do fluxo" (P-2) -- usuário definiu em 2026-08-20: mostrar os
// detalhes completos da duplicata selecionada.
export function InfoDuplicataModal({ open, onClose, duplicata }: InfoDuplicataModalProps) {
  if (!duplicata) return null

  const formatCurrency = (v: number | null | undefined) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
  const formatDate = (d: string | null) => {
    if (!d) return '-'
    const [year, month, day] = d.split('T')[0].split('-')
    return `${day}/${month}/${year}`
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Duplicata {duplicata.numero_documento || duplicata.nosso_numero}
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm">
          <Row label="Pessoa" value={duplicata.nome_pagador} />
          <Row label="Empresa" value={duplicata.empresas?.nome} />
          <Row
            label="Tipo"
            value={duplicata.tipo_operacao === 'CP' ? 'Contas a Pagar' : 'Contas a Receber'}
          />
          <Row label="Status" value={duplicata.status} />
          <Row label="Valor" value={formatCurrency(duplicata.valor)} />
          <Row label="Emissão" value={formatDate(duplicata.emissao)} />
          <Row label="Vencimento" value={formatDate(duplicata.vencimento)} />
          <Row
            label="Parcela"
            value={
              duplicata.num_parcela && duplicata.total_parcelas
                ? `${duplicata.num_parcela}/${duplicata.total_parcelas}`
                : '-'
            }
          />
          <Row label="Nosso número" value={duplicata.nosso_numero} />
          <Row label="Forma de pagamento" value={duplicata.forma_pagamento} />
          <Row label="Data pagamento" value={formatDate(duplicata.data_pagamento)} />
          <Row
            label="Valor pago"
            value={duplicata.valor_pago ? formatCurrency(duplicata.valor_pago) : '-'}
          />
          <Row
            label="Juros/multa"
            value={duplicata.juros_multa ? formatCurrency(duplicata.juros_multa) : '-'}
          />
          <Row
            label="Desconto"
            value={duplicata.desconto ? formatCurrency(duplicata.desconto) : '-'}
          />
          <Row label="Observação" value={duplicata.observacao} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
