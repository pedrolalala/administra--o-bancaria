import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

// SPEC-258 Fase 4c: onde o Financeiro define o RT (repasse ao arquiteto). Só grava a REGRA; o cálculo/lançamento do RT vem depois.
// Lê vw_financeiro_rt_arquitetos e grava por financeiro_definir_rt (sem gravação direta na tabela).

const BASES: Record<string, string> = {
  recebido: 'Sobre o valor recebido',
  bruto: 'Sobre o valor bruto da venda',
  liquido: 'Sobre o valor líquido',
  sem_frete_imposto: 'Sem frete e sem imposto',
}
const GATILHOS: Record<string, string> = {
  proporcional_recebido: 'Proporcional ao que o cliente paga',
  venda_quitada: 'Só quando a venda estiver 100% recebida',
  aprovacao: 'Na aprovação da venda',
  dia_fixo: 'Em um dia fixo do mês',
}

interface Linha {
  contato_id: string
  nome: string
  tem_regra: boolean
  percentual: string // texto do campo (vírgula ou ponto)
  base_calculo: string
  gatilho: string
  dia_fixo: string
  exige_nf: boolean
  observacao: string
}

const PADRAO_LINHA = { base_calculo: 'recebido', gatilho: 'proporcional_recebido', dia_fixo: '', exige_nf: false, observacao: '' }

function paraNumero(t: string): number | null {
  const v = t.trim().replace(',', '.')
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function deLinhaBanco(r: any): Linha {
  return {
    contato_id: r.contato_id,
    nome: r.nome || '(sem nome)',
    tem_regra: !!r.tem_regra,
    percentual: r.percentual != null ? String(Number(r.percentual)).replace('.', ',') : '',
    base_calculo: r.base_calculo || PADRAO_LINHA.base_calculo,
    gatilho: r.gatilho || PADRAO_LINHA.gatilho,
    dia_fixo: r.dia_fixo != null ? String(r.dia_fixo) : '',
    exige_nf: !!r.exige_nota_fiscal,
    observacao: r.observacao || '',
  }
}

export default function RegrasRT() {
  const { toast } = useToast()
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [originais, setOriginais] = useState<Record<string, string>>({})
  const [padrao, setPadrao] = useState<Linha | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'sem' | 'com'>('todos')
  const [limite, setLimite] = useState(100)
  const [salvando, setSalvando] = useState<string | null>(null)

  const assinatura = (l: Linha) => JSON.stringify([l.percentual.trim(), l.base_calculo, l.gatilho, l.dia_fixo.trim(), l.exige_nf, l.observacao.trim()])

  async function carregar() {
    setCarregando(true)
    try {
      const todas: any[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase as any)
          .from('vw_financeiro_rt_arquitetos')
          .select('*')
          .order('nome', { ascending: true })
          .order('contato_id', { ascending: true })
          .range(from, from + 999)
        if (error) throw error
        todas.push(...(data || []))
        if (!data || data.length < 1000) break
      }
      const ls = todas.map(deLinhaBanco)
      setLinhas(ls)
      setOriginais(Object.fromEntries(ls.map((l) => [l.contato_id, assinatura(l)])))

      const { data: pad, error: e2 } = await (supabase as any)
        .from('financeiro_regras_repasse')
        .select('percentual, base_calculo, gatilho, dia_fixo, exige_nota_fiscal, observacao')
        .eq('tipo', 'rt_arquiteto')
        .eq('escopo', 'padrao')
        .eq('ativo', true)
        .order('vigencia_inicio', { ascending: false })
        .limit(1)
      if (e2) throw e2
      const p = (pad || [])[0]
      setPadrao(
        deLinhaBanco({ contato_id: 'padrao', nome: 'RT padrão', tem_regra: !!p, ...(p || {}), exige_nota_fiscal: p?.exige_nota_fiscal }),
      )
    } catch (e: any) {
      toast({ title: 'Erro ao carregar os arquitetos', description: e?.message || String(e), variant: 'destructive' })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return linhas.filter((l) => {
      if (filtro === 'sem' && l.tem_regra) return false
      if (filtro === 'com' && !l.tem_regra) return false
      return !q || l.nome.toLowerCase().includes(q)
    })
  }, [linhas, busca, filtro])

  const totalComRegra = linhas.filter((l) => l.tem_regra).length

  function mudar(id: string, campo: keyof Linha, valor: any) {
    if (id === 'padrao') setPadrao((p) => (p ? { ...p, [campo]: valor } : p))
    else setLinhas((ls) => ls.map((l) => (l.contato_id === id ? { ...l, [campo]: valor } : l)))
  }

  async function salvar(l: Linha, remover = false) {
    const pct = remover ? null : paraNumero(l.percentual)
    if (!remover) {
      if (pct === null || Number.isNaN(pct) || pct < 0 || pct > 100) {
        toast({ title: 'Percentual inválido', description: 'Informe um número entre 0 e 100 (ex.: 6,5).', variant: 'destructive' })
        return
      }
      if (l.gatilho === 'dia_fixo') {
        const d = Number(l.dia_fixo)
        if (!Number.isInteger(d) || d < 1 || d > 31) {
          toast({ title: 'Informe o dia do mês (1 a 31)', variant: 'destructive' })
          return
        }
      }
    }
    setSalvando(l.contato_id)
    try {
      const { error } = await (supabase as any).rpc('financeiro_definir_rt', {
        p_contato: l.contato_id === 'padrao' ? null : l.contato_id,
        p_percentual: pct,
        p_base: l.base_calculo,
        p_gatilho: l.gatilho,
        p_dia_fixo: l.gatilho === 'dia_fixo' ? Number(l.dia_fixo) : null,
        p_exige_nf: l.exige_nf,
        p_obs: l.observacao.trim() || null,
      })
      if (error) throw error
      const novo: Linha = remover ? { ...l, tem_regra: false, percentual: '', ...PADRAO_LINHA, exige_nf: false } : { ...l, tem_regra: true }
      if (l.contato_id === 'padrao') setPadrao(novo)
      else setLinhas((ls) => ls.map((x) => (x.contato_id === l.contato_id ? novo : x)))
      setOriginais((o) => ({ ...o, [l.contato_id]: assinatura(novo) }))
      toast({ title: remover ? 'RT removido' : 'RT salvo', description: l.nome })
    } catch (e: any) {
      toast({ title: 'Não foi possível salvar o RT', description: e?.message || String(e), variant: 'destructive' })
    } finally {
      setSalvando(null)
    }
  }

  const linhaEditor = (l: Linha, compacto = false) => {
    const sujo = originais[l.contato_id] !== assinatura(l)
    return (
      <>
        <TableCell className="w-28">
          <Input
            className="h-8 text-right"
            inputMode="decimal"
            placeholder="%"
            value={l.percentual}
            onChange={(e) => mudar(l.contato_id, 'percentual', e.target.value)}
          />
        </TableCell>
        <TableCell className="min-w-[210px]">
          <Select value={l.base_calculo} onValueChange={(v) => mudar(l.contato_id, 'base_calculo', v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(BASES).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="min-w-[250px]">
          <div className="flex items-center gap-2">
            <Select value={l.gatilho} onValueChange={(v) => mudar(l.contato_id, 'gatilho', v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(GATILHOS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {l.gatilho === 'dia_fixo' && (
              <Input
                className="h-8 w-16 text-right"
                inputMode="numeric"
                placeholder="dia"
                value={l.dia_fixo}
                onChange={(e) => mudar(l.contato_id, 'dia_fixo', e.target.value)}
              />
            )}
          </div>
        </TableCell>
        <TableCell className="text-center w-24">
          <Checkbox checked={l.exige_nf} onCheckedChange={(v) => mudar(l.contato_id, 'exige_nf', v === true)} />
        </TableCell>
        {!compacto && (
          <TableCell className="min-w-[160px]">
            <Input
              className="h-8 text-xs"
              placeholder="Observação"
              value={l.observacao}
              onChange={(e) => mudar(l.contato_id, 'observacao', e.target.value)}
            />
          </TableCell>
        )}
        <TableCell className="whitespace-nowrap text-right">
          <Button size="sm" className="h-8" disabled={!sujo || salvando === l.contato_id} onClick={() => salvar(l)}>
            {salvando === l.contato_id ? 'Salvando...' : 'Salvar'}
          </Button>
          {l.tem_regra && (
            <Button size="sm" variant="ghost" className="h-8 ml-1 text-slate-500" disabled={salvando === l.contato_id} onClick={() => salvar(l, true)}>
              Remover
            </Button>
          )}
        </TableCell>
      </>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Regras de RT dos arquitetos</h1>
        <p className="text-sm text-slate-500 mt-1">
          Defina aqui quanto cada arquiteto recebe de RT, sobre qual valor e quando. Esta tela só guarda a regra; o lançamento do RT a pagar vem em uma
          etapa seguinte. Cada troca fica no histórico.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">RT padrão (vale para o arquiteto sem regra própria)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {padrao && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RT (%)</TableHead>
                  <TableHead>Base de cálculo</TableHead>
                  <TableHead>Quando paga</TableHead>
                  <TableHead className="text-center">Arquiteto emite NF</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>{linhaEditor(padrao, true)}</TableRow>
              </TableBody>
            </Table>
          )}
          {!padrao?.tem_regra && <p className="text-xs text-amber-700 mt-2">Ainda não há RT padrão definido.</p>}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Input className="h-9 w-72" placeholder="Buscar arquiteto..." value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(100) }} />
        <Select value={filtro} onValueChange={(v) => { setFiltro(v as any); setLimite(100) }}>
          <SelectTrigger className="h-9 w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os arquitetos</SelectItem>
            <SelectItem value="sem">Sem RT definido</SelectItem>
            <SelectItem value="com">Com RT definido</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">
          {totalComRegra} de {linhas.length} com RT definido · mostrando {Math.min(limite, filtradas.length)} de {filtradas.length}
        </span>
      </div>

      <div className="rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">Arquiteto</TableHead>
              <TableHead>RT (%)</TableHead>
              <TableHead>Base de cálculo</TableHead>
              <TableHead>Quando paga</TableHead>
              <TableHead className="text-center">Emite NF</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!carregando && filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                  Nenhum arquiteto encontrado.
                </TableCell>
              </TableRow>
            )}
            {filtradas.slice(0, limite).map((l) => (
              <TableRow key={l.contato_id} className={l.tem_regra ? '' : 'bg-amber-50/40'}>
                <TableCell className="font-medium text-sm">{l.nome}</TableCell>
                {linhaEditor(l)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {filtradas.length > limite && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setLimite((n) => n + 100)}>
            Mostrar mais 100
          </Button>
        </div>
      )}
    </div>
  )
}
