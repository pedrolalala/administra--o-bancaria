import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CnabSummary } from '@/types/cnab'
import { formatCurrency } from '@/lib/mock-data'
import { CheckCircle2, Info, Wallet } from 'lucide-react'

interface SummaryCardsProps {
  summary: CnabSummary
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total de Liquidações
          </CardTitle>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalLiquidacoes}</div>
          <p className="text-xs text-muted-foreground mt-1">Títulos pagos com sucesso</p>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total de Confirmações
          </CardTitle>
          <Info className="h-4 w-4 text-sky-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalConfirmacoes}</div>
          <p className="text-xs text-muted-foreground mt-1">Títulos registrados no banco</p>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Valor Total Recebido
          </CardTitle>
          <Wallet className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            {formatCurrency(summary.valorTotalRecebido)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Soma de todas as liquidações</p>
        </CardContent>
      </Card>
    </div>
  )
}
