import { useState, useEffect, useMemo } from 'react'
import { useFiltroPersistido } from '@/hooks/use-filtro-persistido'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Pencil, Search, Play, Handshake, Download, Info, Undo2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ExecutarBaixaModal } from '@/components/duplicatas/ExecutarBaixaModal'
import { InfoDuplicataModal } from '@/components/duplicatas/InfoDuplicataModal'
import { NOME_SISTEMA, TIPO_OPERACAO, EH_PAGAR } from '@/lib/modo-sistema'
import { CampoPessoa, type PessoaSelecionada } from '@/components/BuscaPessoaDialog'
import { buscarDuplicatasNovas, mapaBoletoParcela } from '@/lib/financeiro-novo'
import { EstornarBaixaModal } from '@/components/duplicatas/EstornarBaixaModal'
import { AcordoModal } from '@/components/duplicatas/AcordoModal'

// SPEC-248: na Contas a Pagar, duplicata "Cancelado" (DPL errada ou que mudou) não conta como aberta nem some do banco.
// (a Contas a Receber não mudou). Aceita "cancelado" minúsculo, que é como o banco grava em alguns fluxos.
const ehCancelada = (status: unknown) => EH_PAGAR && String(status ?? '').toLowerCase() === 'cancelado'

export default function ConsultarDuplicatas() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [showExecutar, setShowExecutar] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showEstornar, setShowEstornar] = useState(false)
  const [showAcordo, setShowAcordo] = useState(false) // SPEC-287
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([])

  // SPEC-288: os filtros ficam guardados na sessão: ao ir para Antecipações e voltar, não se perdem
  const [filtros, setFiltros] = useFiltroPersistido('consulta', {
    // Achado 2026-08-20: filtro de empresa vinha travado em 'ISLIGHT' por
    // padrão -- qualquer duplicata de outra empresa (FOCO, SLIDE, LUCENERA)
    // ficava invisível na primeira tela ("Nenhum registro encontrado"),
    // parecendo bug de dado ausente sem ser.
    empresa: 'Todas',
    // Pedido do usuario (06/08/2026): "RIBEIRAO PRETO" era um valor fixo
    // que nunca batia com boletos.perfil de verdade ('ribeirao'/
    // 'sao_paulo', SPEC-064) — o filtro nunca filtrava nada. Corrigido
    // pra usar os valores reais.
    perfilEmpresa: 'todos',
    // SPEC-245: nasce em "Aberto" (é o que se confere todo dia e é leve); Todos/Pago carregam as pagas da Connect sob demanda.
    tipoSituacao: 'Aberto',
    tipoData: 'Vencimento',
    // Achado 2026-08-20: Data início/Data final nunca filtravam nada de
    // verdade (não eram lidos em filteredData) -- e o valor padrão era um
    // intervalo fixo de junho/2026, que já teria escondido tudo assim que
    // o filtro passasse a funcionar de fato. Corrigido pra filtrar por
    // vencimento e nascer vazio (sem filtro nenhum por padrão).
    dataInicio: '',
    dataFinal: '',
    venda: '',
    fatura: '',
    duplicata: '',
    boleto: '',
    pessoa: '',
  })
  // SPEC-231 E1: cadastro escolhido na busca (dois cliques no campo Pessoa)
  const [pessoaSel, setPessoaSel] = useFiltroPersistido<PessoaSelecionada | null>('consulta-pessoa', null)

  const [pagasCarregadas, setPagasCarregadas] = useState(false)
  // a grade desenha no máximo `limite` linhas (milhares de linhas travavam a página); os totais continuam somando tudo
  const [limite, setLimite] = useState(500)

  const fetchData = async (comPagas: boolean = false) => {
    setLoading(true)
    const PAGE = 1000
    let all: any[] = []
    for (let from = 0; ; from += PAGE) {
      const { data: page, error } = await (supabase as any)
        .from('boletos')
        .select('*, empresas (nome), orcamentos (numero, numero_venda, projeto_id, cliente_id)')
        // SPEC-225: cada sistema só lê o próprio tipo (CP ou CR).
        .eq('tipo_operacao', TIPO_OPERACAO)
        .order('vencimento', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' })
        setLoading(false)
        return
      }
      all = all.concat(page || [])
      if (!page || page.length < PAGE) break
    }
    // SPEC-258 (Financeiro) Fase 5: as contas do modelo novo (legado da Connect + nativas) vêm de vw_financeiro_duplicatas e PODEM ser baixadas aqui
    // (a carga da Connect de 05/11 foi a última; antes a baixa vinha da planilha do dia). O que tem boleto segue vindo do boleto
    // (remessa/retorno/cobrança); o mapa liga o boleto à parcela do modelo novo para a baixa e o estorno atualizarem os dois.
    let doFinanceiro: any[] = []
    let mapaBoleto = new Map<string, string>()
    try {
      mapaBoleto = await mapaBoletoParcela()
      doFinanceiro = await buscarDuplicatasNovas(comPagas)
    } catch (e: any) {
      toast({ title: 'Erro ao carregar as duplicatas do financeiro', description: e?.message || String(e), variant: 'destructive' })
    }
    const boletosComParcela = all.map((b: any) => ({ ...b, _parcelaId: mapaBoleto.get(b.id) ?? null }))
    const todas = [...boletosComParcela, ...doFinanceiro].sort((a, b) => String(a.vencimento || '').localeCompare(String(b.vencimento || '')))
    setData(todas)
    setLoading(false)
  }

  // Todos/Pago precisam das pagas da Connect (milhares): carrega uma vez, só quando pedido
  useEffect(() => {
    if ((filtros.tipoSituacao === 'Todos' || filtros.tipoSituacao === 'Pago') && !pagasCarregadas) {
      setPagasCarregadas(true)
      fetchData(true)
    }
    setLimite(500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.tipoSituacao])

  useEffect(() => {
    setLimite(500)
  }, [filtros, pessoaSel])

  useEffect(() => {
    fetchData()
    supabase
      .from('empresas')
      .select('id, nome')
      .order('nome')
      .then(({ data: emp }) => setEmpresas(emp || []))
  }, [])

  const getOrcamento = (d: any) => (Array.isArray(d.orcamentos) ? d.orcamentos[0] : d.orcamentos)
  const getVenda = (d: any) => getOrcamento(d)?.numero_venda || d.venda || ''

  const filteredData = useMemo(() => {
    return data.filter((d) => {
      if (d.tipo_operacao !== TIPO_OPERACAO) return false
      if (filtros.tipoSituacao !== 'Todos') {
        // Achado 2026-08-20: RPC aprovar_orcamento_financeiro cria todo
        // boleto novo com status='pendente_registro' (26 dos 44 boletos
        // reais hoje), e a remessa avança pra 'Remessa Enviada' (9) -- só
        // 'Pago' é de fato encerrado. O filtro "Aberto" aqui só reconhecia
        // o status legado 'Pendente' (7 registros), escondendo a maioria
        // das duplicatas realmente em aberto. Mesmo critério que a coluna
        // "A"/"P" da grade já usava (d.status === 'Pago' ? 'P' : 'A').
        const isAberto = d.status !== 'Pago' && !ehCancelada(d.status)
        if (filtros.tipoSituacao === 'Aberto' && !isAberto) return false
        if (filtros.tipoSituacao === 'Pago' && d.status !== 'Pago') return false
        if (filtros.tipoSituacao === 'Cancelado' && !ehCancelada(d.status)) return false
        if (
          filtros.tipoSituacao === 'Vencido' &&
          !(isAberto && d.vencimento && new Date(d.vencimento) < new Date())
        )
          return false
      }
      // SPEC-116: campo "Pessoa" passa a aceitar múltiplos termos em
      // qualquer ordem, sem distinção de acento (ex.: "silva joao" acha
      // "João da Silva") — antes era a frase inteira, sensível a acento.
      if (filtros.pessoa) {
        const normalize = (v: string) =>
          v
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase()
        const terms = normalize(filtros.pessoa.trim()).split(/\s+/).filter(Boolean)
        const haystack = normalize(d.nome_pagador || '')
        if (!terms.every((t) => haystack.includes(t))) return false
      }
      // SPEC-231 E1: só o cadastro escolhido (projeto específico, ou o cliente/fornecedor; duplicata antiga sem
      // vínculo casa pelo nome)
      if (pessoaSel) {
        const orc = getOrcamento(d)
        if (pessoaSel.projetoId) {
          if ((orc?.projeto_id ?? d.projeto_id) !== pessoaSel.projetoId) return false
        } else if (
          d.contato_id !== pessoaSel.contatoId &&
          orc?.cliente_id !== pessoaSel.contatoId &&
          (d.nome_pagador || '').trim().toLowerCase() !== pessoaSel.nome.trim().toLowerCase()
        ) {
          return false
        }
      }
      if (
        filtros.duplicata &&
        !d.numero_documento?.toLowerCase().includes(filtros.duplicata.toLowerCase())
      )
        return false
      // SPEC-165: Venda / Fatura / Boleto antes não filtravam nada.
      const contem = (valor: any, termo: string) =>
        String(valor || '')
          .toLowerCase()
          .includes(termo.trim().toLowerCase())
      if (
        filtros.venda &&
        !contem(getVenda(d), filtros.venda) &&
        !contem(getOrcamento(d)?.numero, filtros.venda)
      )
        return false
      if (filtros.fatura && !contem(d.fatura, filtros.fatura)) return false
      if (
        filtros.boleto &&
        !contem(d.nosso_numero, filtros.boleto) &&
        !contem(d.nosso_numero_banco, filtros.boleto)
      )
        return false

      if (filtros.empresa && filtros.empresa !== 'Todas') {
        if (d.empresas?.nome !== filtros.empresa) return false
      }
      if (filtros.perfilEmpresa !== 'todos' && d.perfil !== filtros.perfilEmpresa) return false

      // Único "Tipo data" disponível hoje é Vencimento -- filtra por
      // d.vencimento quando início/final estiverem preenchidos.
      if (filtros.dataInicio && (!d.vencimento || d.vencimento < filtros.dataInicio)) return false
      if (filtros.dataFinal && (!d.vencimento || d.vencimento > filtros.dataFinal)) return false

      return true
    })
  }, [data, filtros, pessoaSel])

  const totais = useMemo(() => {
    return filteredData.reduce(
      (acc, curr) => {
        // Mesmo achado do filtro "Aberto" acima -- 'pendente_registro' e
        // 'Remessa Enviada' também são situações em aberto, não só 'Pendente'.
        const isAberto = curr.status !== 'Pago' && !ehCancelada(curr.status)
        const isVencido = isAberto && curr.vencimento && new Date(curr.vencimento) < new Date()
        if (isVencido) acc.vencido += Number(curr.valor || 0)
        if (isAberto && !isVencido) acc.aVencer += Number(curr.valor || 0)
        if (isAberto) acc.aberto += Number(curr.valor || 0)
        if (curr.status === 'Pago') acc.pago += Number(curr.valor_pago || curr.valor || 0)
        acc.total += Number(curr.valor || 0)
        return acc
      },
      { vencido: 0, aVencer: 0, aberto: 0, pago: 0, total: 0 },
    )
  }, [filteredData])

  // SPEC-165: painel "Baixado" mostra a baixa das duplicatas selecionadas.
  const baixadasSelecionadas = data.filter((d) => selecionadas.has(d.id) && d.status === 'Pago')

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  const formatDate = (d: string) => {
    if (!d) return ''
    const [year, month, day] = d.split('T')[0].split('-')
    return `${day}/${month}/${year}`
  }

  const getAtraso = (venc: string, status: string) => {
    if (status === 'Pago' || !venc) return ''
    const days = differenceInDays(new Date(), parseISO(venc))
    return days > 0 ? days : ''
  }

  const toggleSelecionada = (id: string) => {
    setSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // "Exportar" abre a tela "Baixar Duplicata" com as duplicatas
  // selecionadas (ou vazio, pra localizar de la mesmo) -- fluxo pedido
  // explicitamente pelo usuario (SPEC-073).
  const handleExportar = () => {
    // SPEC-258: as do financeiro novo (sem boleto) são baixadas pelo botão Executar; a tela Baixar Duplicata trabalha com boletos
    const ids = Array.from(selecionadas).filter((id) => !String(id).startsWith('fp:'))
    if (selecionadas.size > 0 && ids.length === 0) {
      toast({ title: 'Use o botão Executar', description: 'Estas duplicatas não têm boleto: dê a baixa pelo botão Executar.', variant: 'destructive' })
      return
    }
    navigate('/baixar-duplicata', { state: { ids } })
  }

  // "Executar": definido pelo usuário em 2026-08-20 (SPEC-073 P-1) -- dar
  // baixa direto nas duplicatas selecionadas, num modal inline, sem
  // precisar navegar até "Baixar Duplicata".
  const handleExecutar = () => {
    if (selecionadas.size === 0) {
      toast({
        title: 'Selecione ao menos uma duplicata',
        variant: 'destructive',
      })
      return
    }
    // SPEC-165: não baixa de novo o que já está pago.
    const jaPagas = data.filter((d) => selecionadas.has(d.id) && d.status === 'Pago')
    if (jaPagas.length > 0) {
      toast({
        title: 'Há duplicata já paga na seleção',
        description: `${jaPagas.map((d) => d.numero_documento || d.nosso_numero).join(', ')} já tem baixa. Desmarque para continuar.`,
        variant: 'destructive',
      })
      return
    }
    setShowExecutar(true)
  }

  // SPEC-258: estorno de baixa (a baixa nunca é apagada; o estorno fica no histórico com o motivo)
  const handleEstornar = () => {
    const sel = data.filter((d) => selecionadas.has(d.id))
    if (sel.length === 0) {
      toast({ title: 'Selecione ao menos uma duplicata paga', variant: 'destructive' })
      return
    }
    const naoPagas = sel.filter((d) => d.status !== 'Pago')
    if (naoPagas.length > 0) {
      toast({ title: 'Há duplicata sem baixa na seleção', description: 'Só dá para estornar o que já está pago. Desmarque as abertas.', variant: 'destructive' })
      return
    }
    const semModeloNovo = sel.filter((d) => !d._parcelaId)
    if (semModeloNovo.length > 0) {
      toast({ title: 'Estorno indisponível para esta duplicata', description: 'Ela não existe no financeiro novo (boleto antigo). Desmarque para continuar.', variant: 'destructive' })
      return
    }
    setShowEstornar(true)
  }

  // SPEC-287 (Reunião 47): acordo = renegociar as parcelas selecionadas (só as abertas do financeiro novo, da mesma pessoa)
  const handleAcordo = () => {
    const sel = data.filter((d) => selecionadas.has(d.id))
    if (sel.length === 0) {
      toast({ title: 'Selecione as parcelas do acordo', description: 'Marque as duplicatas abertas que serão renegociadas.', variant: 'destructive' })
      return
    }
    if (sel.some((d) => d.status === 'Pago')) {
      toast({ title: 'Há duplicata paga na seleção', description: 'Só entram no acordo as parcelas abertas. Desmarque as pagas.', variant: 'destructive' })
      return
    }
    if (sel.some((d) => !d._parcelaId)) {
      toast({ title: 'Acordo indisponível para esta duplicata', description: 'Ela não existe no financeiro novo (boleto antigo). Desmarque para continuar.', variant: 'destructive' })
      return
    }
    const pessoas = new Set(sel.map((d) => d.contato_id ?? d.nome_pagador))
    if (pessoas.size > 1) {
      toast({ title: 'Pessoas diferentes na seleção', description: 'Um acordo junta parcelas de um só cliente (ou fornecedor).', variant: 'destructive' })
      return
    }
    setShowAcordo(true)
  }

  // "Info": definido pelo usuário em 2026-08-20 (SPEC-073 P-2) -- detalhes
  // completos da duplicata selecionada, exige exatamente 1.
  const handleInfo = () => {
    if (selecionadas.size !== 1) {
      toast({
        title: 'Selecione uma duplicata',
        description: 'Marque exatamente uma linha na grade para ver os detalhes.',
        variant: 'destructive',
      })
      return
    }
    setShowInfo(true)
  }

  // "Editar" so faz sentido com exatamente 1 duplicata selecionada -- abre
  // Cadastrar Duplicatas no modo edicao da "conta" (grupo de parcelas) dela.
  const handleEditar = () => {
    if (selecionadas.size !== 1) {
      toast({
        title: 'Selecione uma duplicata',
        description: 'Marque exatamente uma linha na grade para editar.',
        variant: 'destructive',
      })
      return
    }
    const id = Array.from(selecionadas)[0]
    const duplicata = data.find((d) => d.id === id)
    if (duplicata?._fonte === 'financeiro') {
      toast({
        title: 'Duplicata do financeiro: sem edição por aqui',
        description: 'Ela pode ser baixada (Executar) e estornada; a edição dos dados vem em outra etapa.',
        variant: 'destructive',
      })
      return
    }
    if (!duplicata?.conta_grupo_id) {
      toast({
        title: 'Duplicata sem grupo de conta',
        description:
          'Este registro foi criado antes da SPEC-073 e não tem edição estruturada disponível ainda.',
        variant: 'destructive',
      })
      return
    }
    navigate(`/cadastrar-duplicata?id=${duplicata.conta_grupo_id}`)
  }

  // "Acordo": sem especificacao clara do que deve fazer ainda (nao ha
  // equivalente identificavel no restante do sistema nem na spec
  // fornecida) -- sinalizado como pendente em vez de adivinhar regra de
  // negocio nova (SPEC-073, secao "Pendências").
  const handleNaoImplementado = (nome: string) => {
    toast({
      title: `"${nome}" ainda não implementado`,
      description: 'Aguardando definição do fluxo.',
    })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] w-full bg-slate-50 overflow-y-auto text-sm">
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-slate-800">{NOME_SISTEMA}</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
            onClick={handleEditar}
          >
            <Pencil className="h-4 w-4" />
            <span className="text-[10px]">Editar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
            onClick={() => fetchData(pagasCarregadas)}
          >
            <Search className="h-4 w-4" />
            <span className="text-[10px]">Localizar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
            onClick={handleExecutar}
          >
            <Play className="h-4 w-4" />
            <span className="text-[10px]">Executar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
            onClick={handleEstornar}
          >
            <Undo2 className="h-4 w-4" />
            <span className="text-[10px]">Estornar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
            onClick={handleAcordo}
          >
            <Handshake className="h-4 w-4" />
            <span className="text-[10px]">Acordo</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
            onClick={handleExportar}
          >
            <Download className="h-4 w-4" />
            <span className="text-[10px]">Exportar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
            onClick={handleInfo}
          >
            <Info className="h-4 w-4" />
            <span className="text-[10px]">Info</span>
          </Button>
        </div>
      </div>

      <div className="p-3 border-b bg-slate-100/80 shrink-0">
        <div className="font-semibold text-xs mb-2 text-slate-700">Informações da Conta</div>
        <div className="grid grid-cols-12 gap-3 mb-3">
          <div className="col-span-5">
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
              value={filtros.perfilEmpresa}
              onValueChange={(v) => setFiltros({ ...filtros, perfilEmpresa: v })}
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
            <label className="text-[10px] text-slate-500 font-medium uppercase">
              Tipo situação
            </label>
            <Select
              value={filtros.tipoSituacao}
              onValueChange={(v) => setFiltros({ ...filtros, tipoSituacao: v })}
            >
              <SelectTrigger className="h-7 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* SPEC-245 (reunião 04, Filippo): Contas a Pagar mostra SÓ o que falta pagar; o que já foi pago fica num histórico separado
                    (sem "Todos", para não misturar). Contas a Receber segue com todas as situações. */}
                {!EH_PAGAR && <SelectItem value="Todos">Todos</SelectItem>}
                <SelectItem value="Aberto">{EH_PAGAR ? 'A pagar (em aberto)' : 'Aberto'}</SelectItem>
                <SelectItem value="Vencido">Vencido</SelectItem>
                <SelectItem value="Pago">{EH_PAGAR ? 'Pagas (histórico)' : 'Pago'}</SelectItem>
                {EH_PAGAR && <SelectItem value="Cancelado">Canceladas</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Tipo data</label>
            <Select
              value={filtros.tipoData}
              onValueChange={(v) => setFiltros({ ...filtros, tipoData: v })}
            >
              <SelectTrigger className="h-7 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Vencimento">Vencimento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Data início</label>
            <Input
              type="date"
              className="h-7 text-xs px-1 bg-white"
              value={filtros.dataInicio}
              onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
            />
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Data final</label>
            <Input
              type="date"
              className="h-7 text-xs px-1 bg-white"
              value={filtros.dataFinal}
              onChange={(e) => setFiltros({ ...filtros, dataFinal: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Venda</label>
            <Input
              className="h-7 text-xs bg-white"
              value={filtros.venda}
              onChange={(e) => setFiltros({ ...filtros, venda: e.target.value })}
            />
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Fatura</label>
            <Input
              className="h-7 text-xs bg-white"
              value={filtros.fatura}
              onChange={(e) => setFiltros({ ...filtros, fatura: e.target.value })}
            />
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Duplicata</label>
            <Input
              className="h-7 text-xs bg-white"
              value={filtros.duplicata}
              onChange={(e) => setFiltros({ ...filtros, duplicata: e.target.value })}
            />
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Boleto</label>
            <Input
              className="h-7 text-xs bg-white"
              value={filtros.boleto}
              onChange={(e) => setFiltros({ ...filtros, boleto: e.target.value })}
            />
          </div>
          <div className="col-span-8">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Pessoa</label>
            <CampoPessoa
              texto={filtros.pessoa}
              onTexto={(v) => setFiltros({ ...filtros, pessoa: v })}
              selecionada={pessoaSel}
              onSelecionada={setPessoaSel}
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-1 text-[11px] text-slate-500 bg-slate-50 border-b shrink-0">
        {EH_PAGAR
          ? filtros.tipoSituacao === 'Pago'
            ? 'HISTÓRICO: contas já pagas (a lista de Contas a Pagar mostra só o que ainda falta pagar).'
            : 'Contas a Pagar: só o que ainda falta pagar (legado da Connect, compras do sistema e as cadastradas aqui). Selecione e use Executar para dar baixa; Estornar desfaz uma baixa. As já pagas estão em "Pagas (histórico)".'
          : 'Esta lista mostra o que ainda falta receber (legado da Connect, vendas do sistema e as cadastradas aqui). Selecione e use Executar para dar baixa; Estornar desfaz uma baixa.'}
      </div>
      <div className="flex-1 min-h-[280px] overflow-auto bg-white relative">
        <Table className="w-full text-xs whitespace-nowrap">
          <TableHeader className="sticky top-0 bg-slate-100 z-10 shadow-sm border-b">
            <TableRow className="h-8">
              <TableHead className="w-8 p-1 text-center font-medium">X</TableHead>
              <TableHead className="w-8 p-1 text-center font-medium" title="Receber / Pagar">
                T
              </TableHead>
              <TableHead className="w-8 p-1 text-center font-medium" title="Normal / Nota Fiscal">
                O
              </TableHead>
              <TableHead className="w-8 p-1 text-center font-medium" title="Aberto / Pago">
                A
              </TableHead>
              <TableHead className="p-1 font-medium">Duplicata</TableHead>
              <TableHead className="p-1 text-right font-medium">Par.</TableHead>
              <TableHead className="p-1 text-right font-medium">Tot.</TableHead>
              <TableHead className="p-1 text-right font-medium">Venda</TableHead>
              <TableHead className="p-1 text-right font-medium">Fatura</TableHead>
              <TableHead className="p-1 font-medium">Pessoa</TableHead>
              <TableHead className="p-1 text-center font-medium">Emissão</TableHead>
              <TableHead className="p-1 text-center font-medium">Vencimento</TableHead>
              <TableHead className="p-1 text-center font-medium">Atraso</TableHead>
              <TableHead className="p-1 text-center font-medium">Pagamento</TableHead>
              <TableHead className="p-1 text-right font-medium">Vl. Parcela</TableHead>
              <TableHead className="p-1 text-right font-medium">Vl. Pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={16} className="text-center py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={16} className="text-center py-8 text-muted-foreground">
                  Nenhum registro encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredData.slice(0, limite).map((d) => (
                <TableRow
                  key={d.id}
                  className={`h-7 hover:bg-primary/5 transition-colors group cursor-pointer ${
                    selecionadas.has(d.id) ? 'bg-primary/10' : ''
                  }`}
                  onClick={() => toggleSelecionada(d.id)}
                  onDoubleClick={() => {
                    if (d._fonte === 'financeiro') {
                      toast({ title: 'Duplicata do financeiro', description: 'Use Executar para dar baixa ou Estornar para desfazer.' })
                      return
                    }
                    if (!d.conta_grupo_id) {
                      toast({
                        title: 'Duplicata sem grupo de conta',
                        description:
                          'Este registro foi criado antes da SPEC-073 e não tem edição estruturada disponível ainda.',
                        variant: 'destructive',
                      })
                      return
                    }
                    navigate(`/cadastrar-duplicata?id=${d.conta_grupo_id}`)
                  }}
                >
                  <TableCell className="p-1 text-center border-r">
                    <input
                      type="checkbox"
                      className="cursor-pointer"
                      checked={selecionadas.has(d.id)}
                      onChange={() => toggleSelecionada(d.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell
                    className="p-1 text-center border-r text-slate-500"
                    title={d.tipo_operacao === 'CP' ? 'Pagar' : 'Receber'}
                  >
                    {d.tipo_operacao === 'CP' ? 'P' : 'R'}
                  </TableCell>
                  <TableCell
                    className="p-1 text-center border-r text-slate-500"
                    title={`${d.tipo}${d._fonte === 'financeiro' ? ' — financeiro (legado da Connect ou venda/compra do sistema)' : ' — com boleto neste sistema'}`}
                  >
                    {d.especie === 'adiantamento' ? (
                      <span className="font-semibold text-amber-700" title="Antecipação de pagamento (SPEC-270)">AT</span>
                    ) : d.tipo === 'Nota Fiscal' ? 'F' : 'N'}
                  </TableCell>
                  <TableCell className="p-1 text-center border-r font-medium text-slate-700">
                    {d.status === 'Pago' ? 'P' : ehCancelada(d.status) ? 'C' : 'A'}
                  </TableCell>
                  <TableCell className="p-1 border-r font-mono">
                    {d.numero_documento || '-'}
                  </TableCell>
                  <TableCell className="p-1 text-right border-r">{d.num_parcela || 1}</TableCell>
                  <TableCell className="p-1 text-right border-r">{d.total_parcelas || 1}</TableCell>
                  <TableCell className="p-1 text-right border-r font-mono">
                    {getVenda(d) || '-'}
                  </TableCell>
                  <TableCell className="p-1 text-right border-r">{d.fatura || '-'}</TableCell>
                  <TableCell className="p-1 border-r truncate max-w-[200px] font-medium">
                    {d.nome_pagador}
                  </TableCell>
                  <TableCell className="p-1 text-center border-r bg-teal-50/30 group-hover:bg-teal-50/50 transition-colors">
                    {formatDate(d.emissao || d.created_at)}
                  </TableCell>
                  <TableCell className="p-1 text-center border-r">
                    {formatDate(d.vencimento)}
                  </TableCell>
                  <TableCell className="p-1 text-center border-r font-mono text-red-600">
                    {getAtraso(d.vencimento, d.status)}
                  </TableCell>
                  <TableCell className="p-1 text-center border-r">
                    {formatDate(d.data_pagamento)}
                  </TableCell>
                  <TableCell className="p-1 text-right border-r font-mono">
                    {formatCurrency(d.valor)}
                  </TableCell>
                  <TableCell className="p-1 text-right border-r font-mono">
                    {formatCurrency(d.valor_pago || 0)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {filteredData.length > limite && (
          <div className="flex items-center justify-center gap-3 py-3 text-xs text-slate-600">
            <span>
              Mostrando {limite} de {filteredData.length} (os totais abaixo somam todas).
            </span>
            <Button variant="outline" size="sm" onClick={() => setLimite((l) => l + 500)}>
              Mostrar mais 500
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLimite(filteredData.length)}>
              Mostrar todas
            </Button>
          </div>
        )}
      </div>

      <div className="bg-slate-200 border-t border-b flex justify-between p-2 px-4 text-[11px] font-semibold text-slate-700 shrink-0">
        <div className="flex gap-8">
          <div className="flex gap-2 items-center">
            <span className="text-slate-500 uppercase tracking-wider">Vencido:</span>
            <span className="text-red-600 bg-white px-2 py-0.5 rounded shadow-sm border border-red-100">
              {formatCurrency(totais.vencido)}
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-slate-500 uppercase tracking-wider">À Vencer:</span>
            <span className="bg-white px-2 py-0.5 rounded shadow-sm border">
              {formatCurrency(totais.aVencer)}
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-slate-500 uppercase tracking-wider">Aberto:</span>
            <span className="bg-white px-2 py-0.5 rounded shadow-sm border">
              {formatCurrency(totais.aberto)}
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-slate-500 uppercase tracking-wider">Pago:</span>
            <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded shadow-sm border border-emerald-100">
              {formatCurrency(totais.pago)}
            </span>
          </div>
        </div>
        <div className="flex gap-2 items-center text-sm font-bold">
          <span className="text-slate-500 uppercase text-[11px] tracking-wider">
            Total Parcela:
          </span>
          <span className="text-primary">{formatCurrency(totais.total)}</span>
        </div>
      </div>

      <div className="h-44 flex flex-col bg-slate-50 shrink-0">
        <div className="flex border-b">
          <div className="px-4 py-1.5 text-xs font-semibold bg-white border-r text-primary border-t-2 border-t-primary shadow-sm z-10">
            Baixado
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-white">
          <Table className="w-full text-xs">
            <TableHeader className="bg-slate-100/80 sticky top-0">
              <TableRow className="h-7 border-b">
                <TableHead className="p-1 font-medium">Duplicata</TableHead>
                <TableHead className="p-1 text-center font-medium">Pagamento</TableHead>
                <TableHead className="p-1 text-center font-medium">Atraso</TableHead>
                <TableHead className="p-1 text-right font-medium">Valor Parcela</TableHead>
                <TableHead className="p-1 text-right font-medium">Juros</TableHead>
                <TableHead className="p-1 text-right font-medium">Desconto</TableHead>
                <TableHead className="p-1 text-right font-medium">Valor Pago</TableHead>
                <TableHead className="p-1 font-medium">Pagamento</TableHead>
                <TableHead className="p-1 font-medium">Conta</TableHead>
                <TableHead className="p-1 font-medium">Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {baixadasSelecionadas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="p-4 text-center text-slate-400 italic">
                    {selecionadas.size === 0
                      ? 'Selecione uma duplicata para ver os detalhes da baixa'
                      : 'A duplicata selecionada ainda não tem baixa.'}
                  </TableCell>
                </TableRow>
              ) : (
                baixadasSelecionadas.map((d) => (
                  <TableRow key={d.id} className="h-7">
                    <TableCell className="p-1 font-mono">
                      {d.numero_documento || d.nosso_numero}
                    </TableCell>
                    <TableCell className="p-1 text-center">
                      {formatDate(d.data_pagamento)}
                    </TableCell>
                    <TableCell className="p-1 text-center">
                      {d.data_pagamento && d.vencimento
                        ? Math.max(
                            0,
                            differenceInDays(parseISO(d.data_pagamento), parseISO(d.vencimento)),
                          ) || ''
                        : ''}
                    </TableCell>
                    <TableCell className="p-1 text-right font-mono">
                      {formatCurrency(d.valor)}
                    </TableCell>
                    <TableCell className="p-1 text-right font-mono">
                      {formatCurrency(Number(d.juros_multa || 0))}
                    </TableCell>
                    <TableCell className="p-1 text-right font-mono">
                      {formatCurrency(Number(d.desconto || 0))}
                    </TableCell>
                    <TableCell className="p-1 text-right font-mono">
                      {formatCurrency(Number(d.valor_pago || 0))}
                    </TableCell>
                    <TableCell className="p-1">{d.forma_pagamento || '-'}</TableCell>
                    <TableCell className="p-1">-</TableCell>
                    <TableCell className="p-1 truncate max-w-[200px]">
                      {d.observacao || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ExecutarBaixaModal
        open={showExecutar}
        onClose={() => setShowExecutar(false)}
        duplicatas={data.filter((d) => selecionadas.has(d.id))}
        onSuccess={() => {
          setSelecionadas(new Set())
          fetchData(pagasCarregadas)
        }}
      />
      <EstornarBaixaModal
        open={showEstornar}
        onClose={() => setShowEstornar(false)}
        duplicatas={data.filter((d) => selecionadas.has(d.id))}
        onSuccess={() => {
          setSelecionadas(new Set())
          fetchData(pagasCarregadas)
        }}
      />
      <AcordoModal
        open={showAcordo}
        onClose={() => setShowAcordo(false)}
        duplicatas={data.filter((d) => selecionadas.has(d.id))}
        onSuccess={() => {
          setSelecionadas(new Set())
          fetchData(pagasCarregadas)
        }}
      />
      <InfoDuplicataModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        duplicata={data.find((d) => selecionadas.has(d.id)) || null}
      />
    </div>
  )
}
