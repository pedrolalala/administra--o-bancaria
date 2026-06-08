import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/mock-data'
import useDatabaseStore from '@/stores/main'
import { cn } from '@/lib/utils'

export function BoletosTable() {
  const { boletos } = useDatabaseStore()

  if (boletos.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Nenhum boleto encontrado no banco de dados.
      </Card>
    )
  }

  return (
    <Card className="rounded-md border bg-card animate-fade-in overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[150px]">Nosso Número</TableHead>
            <TableHead>Pagador</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Vencimento</TableHead>
            <TableHead className="text-right">Pagamento</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {boletos.map((boleto) => (
            <TableRow key={boleto.id} className="group hover:bg-slate-50 transition-colors">
              <TableCell className="font-mono text-xs font-medium text-slate-600">
                {boleto.nosso_numero}
              </TableCell>
              <TableCell className="max-w-[200px] truncate font-medium" title={boleto.nome_pagador}>
                {boleto.nome_pagador}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatCurrency(boleto.valor)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground text-sm">
                {boleto.vencimento}
              </TableCell>
              <TableCell className="text-right text-muted-foreground text-sm">
                {boleto.data_liquidacao || '-'}
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant="outline"
                  className={cn(
                    'font-medium border-transparent',
                    boleto.status === 'Pago' &&
                      'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
                    boleto.status === 'Registrado' && 'bg-sky-100 text-sky-800 hover:bg-sky-200',
                    boleto.status === 'Pendente' &&
                      'bg-amber-100 text-amber-800 hover:bg-amber-200',
                    boleto.status === 'Cancelado' && 'bg-rose-100 text-rose-800 hover:bg-rose-200',
                  )}
                >
                  {boleto.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
