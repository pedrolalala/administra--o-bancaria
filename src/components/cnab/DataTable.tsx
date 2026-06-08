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
import { CnabRecord, FileType } from '@/types/cnab'
import { cn } from '@/lib/utils'

interface DataTableProps {
  records: CnabRecord[]
  empresaNome?: string
  fileType: FileType
}

export function DataTable({ records, empresaNome, fileType }: DataTableProps) {
  if (records.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Nenhum registro encontrado no arquivo.
      </Card>
    )
  }

  return (
    <Card className="rounded-md border bg-card animate-fade-in overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[120px]">Nosso Número</TableHead>
            <TableHead className="w-[80px]">NF</TableHead>
            <TableHead>Pagador</TableHead>
            <TableHead className="text-right">Vencimento</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            {fileType === 'RETORNO' && (
              <>
                <TableHead className="text-right">Val. Recebido</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id} className="group hover:bg-slate-50 transition-colors">
              <TableCell className="font-mono text-xs font-medium text-slate-600">
                {record.nossoNumero}
              </TableCell>
              <TableCell className="text-xs text-slate-600">{record.nf || '-'}</TableCell>
              <TableCell className="max-w-[200px] truncate font-medium" title={record.pagador}>
                {record.pagador || '-'}
              </TableCell>
              <TableCell className="text-right text-muted-foreground text-sm">
                {record.dataVencimento || '-'}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  record.valor,
                )}
              </TableCell>
              {fileType === 'RETORNO' && (
                <>
                  <TableCell className="text-right font-mono text-sm text-slate-500">
                    {record.valorRecebido != null
                      ? new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(record.valorRecebido)
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="outline"
                      className={cn(
                        'font-medium border-transparent',
                        record.tipo === 'Liquidado' && 'bg-emerald-100 text-emerald-800',
                        record.tipo === 'Confirmado' && 'bg-sky-100 text-sky-800',
                        record.tipo === 'Outros' && 'bg-slate-100 text-slate-800',
                      )}
                    >
                      {record.tipo || 'Outros'}
                    </Badge>
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
