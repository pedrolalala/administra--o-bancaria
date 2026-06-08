import { useEffect, useState } from 'react'
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
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export function BoletosTable() {
  const [boletos, setBoletos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBoletos = async () => {
      const { data } = await supabase
        .from('boletos')
        .select(`
          *,
          empresas ( nome )
        `)
        .order('vencimento', { ascending: false })
      if (data) setBoletos(data)
      setLoading(false)
    }

    fetchBoletos()

    const channel = supabase
      .channel('boletos_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boletos' }, () => {
        fetchBoletos()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return <Card className="p-8 text-center text-muted-foreground">Carregando...</Card>
  }

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
            <TableHead className="w-[120px]">Nosso Número</TableHead>
            <TableHead>Pagador</TableHead>
            <TableHead>Empresa</TableHead>
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
              <TableCell className="max-w-[150px] truncate font-medium" title={boleto.nome_pagador}>
                {boleto.nome_pagador}
              </TableCell>
              <TableCell className="max-w-[150px] truncate text-slate-600">
                {boleto.empresas?.nome || '-'}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  boleto.valor || 0,
                )}
              </TableCell>
              <TableCell className="text-right text-muted-foreground text-sm">
                {boleto.vencimento
                  ? new Date(boleto.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                  : '-'}
              </TableCell>
              <TableCell className="text-right text-muted-foreground text-sm">
                {boleto.data_pagamento
                  ? new Date(boleto.data_pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                  : '-'}
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
