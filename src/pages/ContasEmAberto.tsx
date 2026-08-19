import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { differenceInDays, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Wallet, AlertTriangle, Clock, TrendingDown } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// SPEC-117: universo real de contas a pagar/receber "em aberto" (transacoes
// + negociacoes + empresas/contatos/plano_de_contas). Diferente de
// ConsultarDuplicatas.tsx (que le boletos, so ~43 linhas hoje, quase tudo
// CR). Aqui sao ~2.382 linhas com status_pago = 0 (0=ABERTO, 1=PAGO,
// 2=CANCELADO - nunca considerar 1 nem 2 como aberto).
const PAGE_SIZE_FETCH = 1000
const PAGE_SIZE_TABELA = 50

interface TransacaoAberta {
  id: string
  tipoRaw: string
  tipo: 'Pagar' | 'Receber'
  empresa: string
  categoria: string
  pessoa: string
  descricao: string
  valor: number
  dtEmissao: string | null
  dtVencimento: string | null
  vencimentoValido: boolean
  diasAtraso: number | null
  duplicata: number | null
  parcela: number | null
  totalParcelas: number | null
  perfil: string | null
}

// Ano fora de 2000-2100 = dado corrompido conhecido (import antigo, ex.: ano
// "206" em vez de "2026", ou a "data zero" 1899-12-30 do Excel). Mesma regra
// de scripts/panorama_financeiro/exportar_nao_quitadas.py: nulificar em vez
// de calcular atraso sem sentido.
function isVencimentoValido(dt: string | null): boolean {
  if (!dt) return false
  const ano = Number(dt.slice(0, 4))
  return ano >= 2000 && ano <= 2100
}

function calcDiasAtraso(dt: string | null, hoje: Date): number | null {
  if (!isVencimentoValido(dt)) return null
  const dias = differenceInDays(hoje, parseISO(dt as string))
  return dias > 0 ? dias : 0
}

export default function ContasEmAberto() {
  const { toast } = useToast()
  const [rawData, setRawData] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(1)

  const [filtros, setFiltros] = useState({
    tipo: 'Pagar' as 'Pagar' | 'Receber',
    empresa: 'Todas',
    perfil: 'todos',
    situacao: 'Todos',
    dataInicio: '',
    dataFinal: '',
    pessoa: '',
  })

  const fetchData = async () => {
    setLoading(true)
    try {
      let all: any[] = []
      let from = 0
      // Cap silencioso de 1000 linhas do PostgREST (achado SPEC-081) -- com
      // ~2.382 linhas de status_pago = 0, e obrigatorio paginar em lotes.
      while (true) {
        const { data: page, error } = await supabase
          .from('transacoes')
          .select(
            `
            id,
            tipo,
            descricao,
            valor,
            dt_emissao,
            dt_vencimento,
            num_parc,
            perfil,
            negociacoes (
              cod_duplicata,
              total_parc,
              empresas ( nome ),
              contatos ( nome ),
              plano_de_contas ( nome )
            )
          `,
          )
          .eq('status_pago', 0)
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE_FETCH - 1)

        if (error) throw error
        all = all.concat(page || [])
        if (!page || page.length < PAGE_SIZE_FETCH) break
        from += PAGE_SIZE_FETCH
      }
      setRawData(all)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar contas em aberto',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    supabase
      .from('empresas')
      .select('id, nome')
      .order('nome')
      .then(({ data }) => {
        if (data) setEmpresas(data)
      })
  }, [])

  // "Hoje" congelado (sem hora) uma vez por sessao de dados, pra nao recalcular
  // atraso a cada render.
  const hoje = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // Achata o embed negociacoes(*) uma unica vez, quando os dados brutos
  // mudam -- filtros/paginacao/aging trabalham em cima disso.
  const processedData = useMemo<TransacaoAberta[]>(() => {
    return rawData.map((t) => {
      const neg = Array.isArray(t.negociacoes) ? t.negociacoes[0] : t.negociacoes
      const empresaRel = neg?.empresas
        ? Array.isArray(neg.empresas)
          ? neg.empresas[0]
          : neg.empresas
        : null
      const contatoRel = neg?.contatos
        ? Array.isArray(neg.contatos)
          ? neg.contatos[0]
          : neg.contatos
        : null
      const planoRel = neg?.plano_de_contas
        ? Array.isArray(neg.plano_de_contas)
          ? neg.plano_de_contas[0]
          : neg.plano_de_contas
        : null

      const vencimentoValido = isVencimentoValido(t.dt_vencimento)
      return {
        id: t.id,
        tipoRaw: t.tipo,
        tipo: t.tipo === 'despesa' ? 'Pagar' : 'Receber',
        empresa: empresaRel?.nome || '(sem empresa)',
        categoria: planoRel?.nome || 'Sem categoria',
        pessoa: contatoRel?.nome || '(sem contato vinculado)',
        descricao: t.descricao || '',
        valor: Number(t.valor || 0),
        dtEmissao: t.dt_emissao,
        dtVencimento: vencimentoValido ? t.dt_vencimento : null,
        vencimentoValido,
        diasAtraso: calcDiasAtraso(t.dt_vencimento, hoje),
        duplicata: neg?.cod_duplicata ?? null,
        parcela: t.num_parc,
        totalParcelas: neg?.total_parc ?? null,
        perfil: t.perfil ?? null,
      }
    })
  }, [rawData, hoje])

  // Normalizacao de acento pra busca de pessoa (SPEC-116, mesmo padrao de
  // ConsultarDuplicatas.tsx): multi-termo, qualquer ordem, sem distincao de
  // acento.
  const normalize = (v: string) =>
    v
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()

  // Todos os filtros MENOS o toggle Pagar/Receber -- usado pelas duas
  // colunas do aging e pelos dois KPIs de topo (Total a Pagar / Total a
  // Receber), que precisam mostrar os dois lados juntos independente do
  // toggle selecionado.
  const dadosBase = useMemo(() => {
    return processedData.filter((d) => {
      if (filtros.empresa !== 'Todas' && d.empresa !== filtros.empresa) return false
      if (filtros.perfil !== 'todos' && d.perfil !== filtros.perfil) return false

      if (filtros.situacao === 'Aberto' && d.diasAtraso && d.diasAtraso > 0) return false
      if (filtros.situacao === 'Vencido' && !(d.diasAtraso && d.diasAtraso > 0)) return false

      if (filtros.dataInicio && (!d.dtVencimento || d.dtVencimento < filtros.dataInicio))
        return false
      if (filtros.dataFinal && (!d.dtVencimento || d.dtVencimento > filtros.dataFinal)) return false

      if (filtros.pessoa) {
        const terms = normalize(filtros.pessoa.trim()).split(/\s+/).filter(Boolean)
        const haystack = normalize(d.pessoa)
        if (!terms.every((t) => haystack.includes(t))) return false
      }

      return true
    })
  }, [processedData, filtros])

  // Recorte pelo tipo (Pagar/Receber) selecionado no topo -- alimenta a
  // tabela detalhada.
  const filteredData = useMemo(
    () => dadosBase.filter((d) => d.tipo === filtros.tipo),
    [dadosBase, filtros.tipo],
  )

  const kpis = useMemo(() => {
    const totalPagar = dadosBase
      .filter((d) => d.tipo === 'Pagar')
      .reduce((acc, d) => acc + d.valor, 0)
    const totalReceber = dadosBase
      .filter((d) => d.tipo === 'Receber')
      .reduce((acc, d) => acc + d.valor, 0)
    const vencido = filteredData
      .filter((d) => d.diasAtraso && d.diasAtraso > 0)
      .reduce((acc, d) => acc + d.valor, 0)
    const aVencer = filteredData
      .filter((d) => !(d.diasAtraso && d.diasAtraso > 0))
      .reduce((acc, d) => acc + d.valor, 0)
    return { totalPagar, totalReceber, vencido, aVencer }
  }, [dadosBase, filteredData])

  // Aging por faixa de atraso, separado por Pagar/Receber -- sobre
  // dadosBase (respeita todos os filtros exceto o toggle de tipo, ja que as
  // duas colunas precisam aparecer juntas).
  const aging = useMemo(() => {
    const faixas = [
      { label: '0-30 dias', min: 1, max: 30 },
      { label: '31-90 dias', min: 31, max: 90 },
      { label: '91-365 dias', min: 91, max: 365 },
      { label: '+365 dias', min: 366, max: Infinity },
    ]
    return faixas.map((faixa) => {
      const doFaixa = (tipo: 'Pagar' | 'Receber') =>
        dadosBase.filter(
          (d) =>
            d.tipo === tipo &&
            d.diasAtraso !== null &&
            d.diasAtraso >= faixa.min &&
            d.diasAtraso <= faixa.max,
        )
      const pagar = doFaixa('Pagar')
      const receber = doFaixa('Receber')
      return {
        label: faixa.label,
        qtdPagar: pagar.length,
        valorPagar: pagar.reduce((acc, d) => acc + d.valor, 0),
        qtdReceber: receber.length,
        valorReceber: receber.reduce((acc, d) => acc + d.valor, 0),
      }
    })
  }, [dadosBase])

  useEffect(() => {
    setPagina(1)
  }, [filtros])

  const totalPaginas = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE_TABELA))
  const pageData = filteredData.slice((pagina - 1) * PAGE_SIZE_TABELA, pagina * PAGE_SIZE_TABELA)

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const formatDate = (d: string | null) => {
    if (!d) return '-'
    const [year, month, day] = d.split('T')[0].split('-')
    return `${day}/${month}/${year}`
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] w-full bg-slate-50 overflow-hidden text-sm">
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-slate-800">Contas em Aberto</h1>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
            <button
              type="button"
              onClick={() => setFiltros({ ...filtros, tipo: 'Pagar' })}
              className={
                filtros.tipo === 'Pagar'
                  ? 'px-3 py-1.5 bg-primary text-primary-foreground'
                  : 'px-3 py-1.5 bg-white text-slate-600 hover:bg-slate-50'
              }
            >
              Pagar
            </button>
            <button
              type="button"
              onClick={() => setFiltros({ ...filtros, tipo: 'Receber' })}
              className={
                filtros.tipo === 'Receber'
                  ? 'px-3 py-1.5 bg-primary text-primary-foreground border-l border-slate-200'
                  : 'px-3 py-1.5 bg-white text-slate-600 hover:bg-slate-50 border-l border-slate-200'
              }
            >
              Receber
            </button>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          {loading ? 'Carregando...' : 'Atualizar'}
        </Button>
      </div>

      <div className="overflow-y-auto flex-1">
        {/* KPIs */}
        <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total a Pagar (aberto)
              </CardTitle>
              <Wallet className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg font-bold text-orange-700">
                {formatCurrency(kpis.totalPagar)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total a Receber (aberto)
              </CardTitle>
              <Wallet className="h-4 w-4 text-sky-500" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg font-bold text-sky-700">
                {formatCurrency(kpis.totalReceber)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Vencido ({filtros.tipo})
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg font-bold text-red-700">{formatCurrency(kpis.vencido)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                A Vencer ({filtros.tipo})
              </CardTitle>
              <Clock className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg font-bold text-emerald-700">
                {formatCurrency(kpis.aVencer)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Aging */}
        <div className="px-3 pb-3">
          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b bg-slate-50 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Aging por faixa de atraso
              </span>
            </div>
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="h-7">
                  <TableHead className="p-1">Faixa</TableHead>
                  <TableHead className="p-1 text-right">Qtd. Pagar</TableHead>
                  <TableHead className="p-1 text-right">Valor Pagar</TableHead>
                  <TableHead className="p-1 text-right">Qtd. Receber</TableHead>
                  <TableHead className="p-1 text-right">Valor Receber</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aging.map((faixa) => (
                  <TableRow key={faixa.label} className="h-7">
                    <TableCell className="p-1 font-medium">{faixa.label}</TableCell>
                    <TableCell className="p-1 text-right">{faixa.qtdPagar}</TableCell>
                    <TableCell className="p-1 text-right font-mono text-orange-700">
                      {formatCurrency(faixa.valorPagar)}
                    </TableCell>
                    <TableCell className="p-1 text-right">{faixa.qtdReceber}</TableCell>
                    <TableCell className="p-1 text-right font-mono text-sky-700">
                      {formatCurrency(faixa.valorReceber)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Filtros */}
        <div className="p-3 border-t border-b bg-slate-100/80">
          <div className="font-semibold text-xs mb-2 text-slate-700">Filtros</div>
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-2">
              <label className="text-[10px] text-slate-500 font-medium uppercase">Empresa</label>
              <Select
                value={filtros.empresa}
                onValueChange={(v) => setFiltros({ ...filtros, empresa: v })}
              >
                <SelectTrigger className="h-7 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todas">Todas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.nome}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-slate-500 font-medium uppercase">
                Perfil Empresa
              </label>
              <Select
                value={filtros.perfil}
                onValueChange={(v) => setFiltros({ ...filtros, perfil: v })}
              >
                <SelectTrigger className="h-7 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ribeirao">Ribeirão</SelectItem>
                  <SelectItem value="sao_paulo">São Paulo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-slate-500 font-medium uppercase">Situação</label>
              <Select
                value={filtros.situacao}
                onValueChange={(v) => setFiltros({ ...filtros, situacao: v })}
              >
                <SelectTrigger className="h-7 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  <SelectItem value="Aberto">Aberto (a vencer)</SelectItem>
                  <SelectItem value="Vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1">
              <label className="text-[10px] text-slate-500 font-medium uppercase">
                Venc. início
              </label>
              <Input
                type="date"
                className="h-7 text-xs px-1 bg-white"
                value={filtros.dataInicio}
                onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
              />
            </div>
            <div className="col-span-1">
              <label className="text-[10px] text-slate-500 font-medium uppercase">
                Venc. final
              </label>
              <Input
                type="date"
                className="h-7 text-xs px-1 bg-white"
                value={filtros.dataFinal}
                onChange={(e) => setFiltros({ ...filtros, dataFinal: e.target.value })}
              />
            </div>
            <div className="col-span-4">
              <label className="text-[10px] text-slate-500 font-medium uppercase">
                Pessoa / Fornecedor
              </label>
              <Input
                className="h-7 text-xs bg-white w-full"
                placeholder="Buscar por pessoa (múltiplos termos, sem acento)..."
                value={filtros.pessoa}
                onChange={(e) => setFiltros({ ...filtros, pessoa: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Tabela detalhada */}
        <div className="bg-white">
          <Table className="w-full text-xs whitespace-nowrap">
            <TableHeader className="sticky top-0 bg-slate-100 z-10 shadow-sm border-b">
              <TableRow className="h-8">
                <TableHead className="p-1 font-medium">Empresa</TableHead>
                <TableHead className="p-1 font-medium">Tipo</TableHead>
                <TableHead className="p-1 font-medium">Categoria</TableHead>
                <TableHead className="p-1 font-medium">Pessoa</TableHead>
                <TableHead className="p-1 font-medium">Descrição</TableHead>
                <TableHead className="p-1 text-center font-medium">Emissão</TableHead>
                <TableHead className="p-1 text-center font-medium">Vencimento</TableHead>
                <TableHead className="p-1 text-center font-medium">Dias em Atraso</TableHead>
                <TableHead className="p-1 text-right font-medium">Valor</TableHead>
                <TableHead className="p-1 font-medium">Nº Duplicata</TableHead>
                <TableHead className="p-1 text-center font-medium">Parcela/Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : pageData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Nenhuma conta em aberto encontrada com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                pageData.map((d) => (
                  <TableRow key={d.id} className="h-7 hover:bg-primary/5 transition-colors">
                    <TableCell className="p-1 border-r truncate max-w-[140px]">
                      {d.empresa}
                    </TableCell>
                    <TableCell className="p-1 border-r">{d.tipo}</TableCell>
                    <TableCell className="p-1 border-r truncate max-w-[140px]">
                      {d.categoria}
                    </TableCell>
                    <TableCell className="p-1 border-r truncate max-w-[180px] font-medium">
                      {d.pessoa}
                    </TableCell>
                    <TableCell className="p-1 border-r truncate max-w-[220px]">
                      {d.descricao}
                    </TableCell>
                    <TableCell className="p-1 text-center border-r">
                      {formatDate(d.dtEmissao)}
                    </TableCell>
                    <TableCell className="p-1 text-center border-r">
                      {formatDate(d.dtVencimento)}
                    </TableCell>
                    <TableCell className="p-1 text-center border-r font-mono text-red-600">
                      {d.diasAtraso && d.diasAtraso > 0 ? d.diasAtraso : ''}
                    </TableCell>
                    <TableCell className="p-1 text-right border-r font-mono">
                      {formatCurrency(d.valor)}
                    </TableCell>
                    <TableCell className="p-1 border-r font-mono">{d.duplicata ?? '-'}</TableCell>
                    <TableCell className="p-1 text-center">
                      {d.parcela ?? '-'}/{d.totalParcelas ?? '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between px-3 py-2 bg-white border-t text-xs text-slate-600">
          <span>
            {filteredData.length} registro(s) — página {pagina} de {totalPaginas}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Rodapé com totais (mesmo padrao de totais.vencido/aVencer/aberto/pago
          ja existente em ConsultarDuplicatas.tsx -- aqui "pago" nao se aplica,
          pois esta tela mostra somente status_pago = 0). */}
      <div className="bg-slate-200 border-t flex justify-between p-2 px-4 text-[11px] font-semibold text-slate-700 shrink-0">
        <div className="flex gap-8">
          <div className="flex gap-2 items-center">
            <span className="text-slate-500 uppercase tracking-wider">Vencido:</span>
            <span className="text-red-600 bg-white px-2 py-0.5 rounded shadow-sm border border-red-100">
              {formatCurrency(kpis.vencido)}
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-slate-500 uppercase tracking-wider">À Vencer:</span>
            <span className="bg-white px-2 py-0.5 rounded shadow-sm border">
              {formatCurrency(kpis.aVencer)}
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-slate-500 uppercase tracking-wider">
              Aberto ({filtros.tipo}):
            </span>
            <span className="bg-white px-2 py-0.5 rounded shadow-sm border">
              {formatCurrency(kpis.vencido + kpis.aVencer)}
            </span>
          </div>
        </div>
        <div className="flex gap-2 items-center text-sm font-bold">
          <span className="text-slate-500 uppercase text-[11px] tracking-wider">
            Pagar + Receber (aberto):
          </span>
          <span className="text-primary">
            {formatCurrency(kpis.totalPagar + kpis.totalReceber)}
          </span>
        </div>
      </div>
    </div>
  )
}
