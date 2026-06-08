import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CnabRecord } from '@/types/cnab'
import { formatCurrency } from '@/lib/mock-data'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface DataTableProps {
  records: CnabRecord[]
}

export function DataTable({ records }: DataTableProps) {
  if (records.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Nenhum registro de detalhe encontrado no arquivo.
      </Card>
    )
  }

  return (
    <div className="rounded-md border bg-card animate-fade-in">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[180px]">Nosso Número</TableHead>
            <TableHead>Pagador</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Tipo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id} className="group hover:bg-slate-50 transition-colors">
              <TableCell className="font-mono text-xs font-medium text-slate-600">
                {record.nossoNumero}
              </TableCell>
              <TableCell className="max-w-[200px] truncate" title={record.pagador}>
                {record.pagador}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatCurrency(record.valor)}
              </TableCell>
              <TableCell className="text-muted-foreground">{record.data}</TableCell>
              <TableCell className="text-right">
                <Badge
                  variant="outline"
                  className={cn(
                    'font-medium border-transparent',
                    record.tipo === 'Liquidado' &&
                      'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
                    record.tipo === 'Confirmado' && 'bg-sky-100 text-sky-800 hover:bg-sky-200',
                    record.tipo === 'Outros' && 'bg-slate-100 text-slate-800 hover:bg-slate-200',
                  )}
                >
                  {record.tipo}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
