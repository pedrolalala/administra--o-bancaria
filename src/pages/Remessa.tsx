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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { AlertTriangle, Download, FileText, Landmark } from 'lucide-react'
import { format } from 'date-fns'
import {
  generateCnab400,
  validateCnab400Boletos,
  validateContaCobranca,
  type BoletoRemessa,
  type ContaCobranca,
  type PagadorCobranca,
} from '@/lib/cnab-generator'

// SPEC-165: remessa por CONTA de cobrança (cada conta Bradesco tem agência,
// conta, carteira e código da empresa próprios). O sequencial do arquivo e
// o nosso número bancário são reservados de forma atômica no banco
// (reservar_remessa_cnab) -- nunca dois arquivos com o mesmo número.

interface ContaBancaria extends ContaCobranca {
  id: string
  empresa_id: string | null
  banco: string | null
  proximo_nosso_numero: number
  sequencial_remessa: number
  empresas?: { nome: string } | null
}

const CONTATO_CAMPOS = 'nome, razao_social, cpf_cnpj, cnpj, cpf, endereco, numero, bairro, cidade, estado, cep'

function montarPagador(c: any, nomeFallback: string | null): PagadorCobranca | null {
  if (!c) return nomeFallback ? { nome: nomeFallback, documento: '', endereco: '', cep: '' } : null
  // ~240 contatos importados vieram com o número grudado no começo do
  // endereço ("1400AVENIDA ...") e `numero` vazio -- separa para o endereço
  // do boleto sair legível ("AVENIDA ... 1400").
  let logradouro = String(c.endereco || '').trim()
  let numero = String(c.numero || '').trim()
  const grudado = /^(\d+)\s*([^\d\s].*)$/.exec(logradouro)
  if (!numero && grudado) {
    numero = grudado[1]
    logradouro = grudado[2]
  }
  const endereco = [logradouro, numero, c.bairro, [c.cidade, c.estado].filter(Boolean).join('/')]
    .filter((p) => p && String(p).trim())
    .join(' ')
  return {
    nome: c.razao_social || c.nome || nomeFallback || '',
    documento: (c.cpf_cnpj || c.cnpj || c.cpf || '').replace(/\D/g, ''),
    endereco,
    cep: (c.cep || '').replace(/\D/g, ''),
  }
}

export default function RemessaPage() {
  const { toast } = useToast()
  const [boletos, setBoletos] = useState<any[]>([])
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [loading, setLoading] = useState(true)

  const [contaId, setContaId] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [previewContent, setPreviewContent] = useState('')
  const [previewSequencial, setPreviewSequencial] = useState<number | null>(null)
  const [previewIds, setPreviewIds] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [validationMessages, setValidationMessages] = useState<string[]>([])
  const [gerando, setGerando] = useState(false)

  const [showConta, setShowConta] = useState(false)
  const [contaForm, setContaForm] = useState({
    agencia: '',
    agencia_digito: '',
    conta: '',
    conta_digito: '',
    carteira: '',
    codigo_empresa_banco: '',
    proximo_nosso_numero: '1',
  })
  const [salvandoConta, setSalvandoConta] = useState(false)

  useEffect(() => {
    fetchContas()
    fetchBoletos()
  }, [])

  const fetchContas = async () => {
    const { data, error } = await (supabase as any)
      .from('contas_bancarias')
      .select(
        'id, nome, banco, empresa_id, agencia, agencia_digito, conta, conta_digito, carteira, codigo_empresa_banco, proximo_nosso_numero, sequencial_remessa, empresas(nome)',
      )
      .ilike('banco', '%bradesco%')
      .order('nome')
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao carregar contas', description: error.message })
      return
    }
    setContas((data || []) as ContaBancaria[])
    if (!contaId && data?.length) setContaId(data[0].id)
  }

  const fetchBoletos = async () => {
    setLoading(true)
    const { data, error } = await (supabase as any)
      .from('boletos')
      .select(
        `
        *,
        empresas(nome),
        contato:contatos!boletos_contato_id_fkey(${CONTATO_CAMPOS}),
        orcamentos(
          numero,
          numero_venda,
          cliente:contatos!orcamentos_cliente_id_fkey(${CONTATO_CAMPOS}),
          projeto:projetos(nome, codigo)
        )
      `,
      )
      .eq('tipo_operacao', 'CR')
      .in('status', ['Pendente', 'pendente_registro'])
      .order('vencimento', { ascending: true })

    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao carregar boletos', description: error.message })
    } else {
      setBoletos(data || [])
    }
    setLoading(false)
  }

  const conta = contas.find((c) => c.id === contaId) || null

  // Só boletos da empresa dona da conta (a remessa é por conta/cedente).
  const filteredBoletos = useMemo(() => {
    if (!conta) return []
    return boletos.filter((b) => !conta.empresa_id || b.empresa_id === conta.empresa_id)
  }, [boletos, conta])

  const getOrcamento = (b: any) => (Array.isArray(b.orcamentos) ? b.orcamentos[0] : b.orcamentos)

  const getPagador = (b: any): PagadorCobranca | null => {
    const contato = Array.isArray(b.contato) ? b.contato[0] : b.contato
    const cliente = getOrcamento(b)?.cliente
    return montarPagador(contato || (Array.isArray(cliente) ? cliente[0] : cliente), b.nome_pagador)
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredBoletos.length) setSelectedIds([])
    else setSelectedIds(filteredBoletos.map((b) => b.id))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toBoletoRemessa = (b: any, nossoNumero?: string | null): BoletoRemessa => ({
    id: b.id,
    nosso_numero_banco: nossoNumero ?? b.nosso_numero_banco ?? null,
    numero_documento: b.numero_documento || getOrcamento(b)?.numero_venda || null,
    vencimento: b.vencimento,
    emissao: b.emissao,
    valor: b.valor,
    pagador: getPagador(b),
  })

  const handleGerar = async () => {
    const selecionados = filteredBoletos.filter((b) => selectedIds.includes(b.id))
    if (!conta || selecionados.length === 0) return

    const issues = [
      ...validateContaCobranca(conta),
      ...validateCnab400Boletos(selecionados.map((b) => toBoletoRemessa(b))).map((i) => i.message),
    ]
    if (issues.length > 0) {
      setValidationMessages(issues)
      toast({
        variant: 'destructive',
        title: 'Revise antes de gerar a remessa',
        description: `${issues.length} pendência(s) encontrada(s).`,
      })
      return
    }

    setValidationMessages([])
    setGerando(true)
    try {
      const { data, error } = await (supabase as any).rpc('reservar_remessa_cnab', {
        p_conta_bancaria_id: conta.id,
        p_boleto_ids: selecionados.map((b) => b.id),
      })
      if (error) throw error

      const numeros = new Map<string, string>(
        (data.boletos || []).map((x: any) => [x.id, x.nosso_numero_banco]),
      )
      const content = generateCnab400(
        selecionados.map((b) => toBoletoRemessa(b, numeros.get(b.id))),
        conta,
        conta.empresas?.nome || conta.nome,
        data.sequencial,
      )
      setPreviewContent(content)
      setPreviewSequencial(data.sequencial)
      setPreviewIds(selecionados.map((b) => b.id))
      setShowPreview(true)
      fetchContas()
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao gerar remessa', description: e.message })
    } finally {
      setGerando(false)
    }
  }

  const handleDownload = async () => {
    const blob = new Blob([previewContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // Padrão Bradesco: CBDDMM + 2 caracteres de sequência no dia.
    a.download = `CB${format(new Date(), 'ddMM')}${String(previewSequencial ?? 1).slice(-2).padStart(2, '0')}.REM`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    const { error } = await supabase
      .from('boletos')
      .update({ status: 'Remessa Enviada' })
      .in('id', previewIds)
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Arquivo baixado, mas o status não foi atualizado',
        description: error.message,
      })
    } else {
      toast({
        title: `Remessa nº ${previewSequencial} gerada`,
        description: 'Envie o arquivo ao banco. Os boletos ficaram como "Remessa Enviada".',
      })
    }
    setShowPreview(false)
    setSelectedIds([])
    fetchBoletos()
  }

  const abrirDadosConta = () => {
    if (!conta) return
    setContaForm({
      agencia: conta.agencia || '',
      agencia_digito: conta.agencia_digito || '',
      conta: conta.conta || '',
      conta_digito: conta.conta_digito || '',
      carteira: conta.carteira || '',
      codigo_empresa_banco: conta.codigo_empresa_banco || '',
      proximo_nosso_numero: String(conta.proximo_nosso_numero || 1),
    })
    setShowConta(true)
  }

  const salvarDadosConta = async () => {
    if (!conta) return
    const proximo = parseInt(contaForm.proximo_nosso_numero, 10)
    if (!proximo || proximo < 1) {
      toast({ variant: 'destructive', title: 'Próximo nosso número inválido' })
      return
    }
    setSalvandoConta(true)
    const { error } = await (supabase as any)
      .from('contas_bancarias')
      .update({
        agencia: contaForm.agencia.replace(/\D/g, '') || null,
        agencia_digito: contaForm.agencia_digito.trim() || null,
        conta: contaForm.conta.replace(/\D/g, '') || null,
        conta_digito: contaForm.conta_digito.trim() || null,
        carteira: contaForm.carteira.replace(/\D/g, '') || null,
        codigo_empresa_banco: contaForm.codigo_empresa_banco.replace(/\D/g, '') || null,
        proximo_nosso_numero: proximo,
      })
      .eq('id', conta.id)
    setSalvandoConta(false)
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao salvar dados de cobrança', description: error.message })
      return
    }
    toast({ title: 'Dados de cobrança salvos' })
    setShowConta(false)
    fetchContas()
  }

  const getProjetoLabel = (b: any) => {
    const orc = getOrcamento(b)
    const projeto = Array.isArray(orc?.projeto) ? orc.projeto[0] : orc?.projeto
    if (!projeto) return '-'
    return projeto.codigo ? `${projeto.codigo} — ${projeto.nome}` : projeto.nome
  }

  const contaIssues = validateContaCobranca(conta)

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20 p-6 w-full max-w-7xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Gerar Remessa</h2>
        <p className="text-muted-foreground">
          Selecione a conta de cobrança e os boletos pendentes para gerar o arquivo CNAB 400 (Bradesco).
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <div className="flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Fluxo manual: gere a prévia, baixe o arquivo .REM e envie ao banco. Cada prévia reserva o
            próximo número de remessa e o nosso número dos boletos. O status só muda para “Remessa
            Enviada” após o download. O registro de fato é confirmado pelo arquivo de retorno.
          </p>
        </div>
      </div>

      {validationMessages.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium mb-2">Pendências para gerar a remessa:</p>
          <ul className="list-disc pl-5 space-y-1">
            {validationMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col lg:flex-row gap-4 justify-between lg:items-end">
        <div className="w-full lg:w-1/3 space-y-2">
          <Label htmlFor="conta-cobranca">Conta de cobrança</Label>
          <Select
            value={contaId}
            onValueChange={(v) => {
              setContaId(v)
              setSelectedIds([])
              setValidationMessages([])
            }}
          >
            <SelectTrigger id="conta-cobranca">
              <SelectValue placeholder="Selecione a conta" />
            </SelectTrigger>
            <SelectContent>
              {contas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                  {c.empresas?.nome ? ` · ${c.empresas.nome}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {conta && (
            <p className={`text-xs ${contaIssues.length ? 'text-red-600' : 'text-slate-500'}`}>
              {contaIssues.length
                ? 'Dados de cobrança incompletos.'
                : `Ag. ${conta.agencia} · C/C ${conta.conta}-${conta.conta_digito} · Carteira ${conta.carteira} · última remessa nº ${conta.sequencial_remessa}`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3 justify-end">
          <Button variant="outline" onClick={abrirDadosConta} disabled={!conta} className="gap-2">
            <Landmark className="h-4 w-4" /> Dados de cobrança
          </Button>
          <Button variant="outline" onClick={toggleSelectAll} disabled={filteredBoletos.length === 0}>
            {selectedIds.length === filteredBoletos.length && filteredBoletos.length > 0
              ? 'Desmarcar Todos'
              : 'Selecionar Todos'}
          </Button>
          <Button
            onClick={handleGerar}
            disabled={selectedIds.length === 0 || gerando}
            className="gap-2"
          >
            <FileText className="h-4 w-4" /> {gerando ? 'Gerando...' : 'Gerar Selecionados'}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Venda / Projeto</TableHead>
              <TableHead>Pagador</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead className="text-right">Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredBoletos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Nenhum boleto pendente para a empresa desta conta.
                </TableCell>
              </TableRow>
            ) : (
              filteredBoletos.map((b) => {
                const pagador = getPagador(b)
                const orc = getOrcamento(b)
                return (
                  <TableRow key={b.id} className={selectedIds.includes(b.id) ? 'bg-primary/5' : ''}>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={selectedIds.includes(b.id)}
                        onCheckedChange={() => toggleSelect(b.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {b.numero_documento || '-'}
                      {b.nosso_numero_banco && (
                        <div className="text-slate-400">NN {b.nosso_numero_banco}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      <div className="flex flex-col">
                        <span className="font-mono">{orc?.numero_venda || orc?.numero || '-'}</span>
                        <span>{getProjetoLabel(b)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{pagador?.nome || b.nome_pagador}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {pagador?.documento || <span className="text-red-600">sem documento</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {b.vencimento ? b.vencimento.split('-').reverse().join('/') : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        b.valor,
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Remessa nº {previewSequencial} — pré-visualização</DialogTitle>
            <DialogDescription>
              {previewIds.length} boleto(s). Cada linha tem 400 posições no layout Bradesco.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-slate-900 text-green-400 font-mono text-xs p-4 rounded-md overflow-x-auto whitespace-pre h-64 overflow-y-auto">
            {previewContent}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" /> Baixar .REM
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConta} onOpenChange={setShowConta}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dados de cobrança — {conta?.nome}</DialogTitle>
            <DialogDescription>
              Informados pelo Bradesco no contrato de cobrança. Sem eles o banco rejeita a remessa.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="cb-agencia">Agência</Label>
              <Input
                id="cb-agencia"
                value={contaForm.agencia}
                onChange={(e) => setContaForm({ ...contaForm, agencia: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cb-agencia-dv">Dígito</Label>
              <Input
                id="cb-agencia-dv"
                value={contaForm.agencia_digito}
                onChange={(e) => setContaForm({ ...contaForm, agencia_digito: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="cb-conta">Conta corrente</Label>
              <Input
                id="cb-conta"
                value={contaForm.conta}
                onChange={(e) => setContaForm({ ...contaForm, conta: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cb-conta-dv">Dígito</Label>
              <Input
                id="cb-conta-dv"
                value={contaForm.conta_digito}
                onChange={(e) => setContaForm({ ...contaForm, conta_digito: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cb-carteira">Carteira</Label>
              <Input
                id="cb-carteira"
                placeholder="09"
                value={contaForm.carteira}
                onChange={(e) => setContaForm({ ...contaForm, carteira: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="cb-codigo">Código da empresa no banco</Label>
              <Input
                id="cb-codigo"
                value={contaForm.codigo_empresa_banco}
                onChange={(e) =>
                  setContaForm({ ...contaForm, codigo_empresa_banco: e.target.value })
                }
              />
            </div>
            <div className="col-span-3 space-y-1">
              <Label htmlFor="cb-proximo">Próximo nosso número</Label>
              <Input
                id="cb-proximo"
                type="number"
                min={1}
                value={contaForm.proximo_nosso_numero}
                onChange={(e) =>
                  setContaForm({ ...contaForm, proximo_nosso_numero: e.target.value })
                }
              />
              <p className="text-[11px] text-slate-500">
                Continue a numeração da faixa liberada pelo banco. Nunca repita um número já usado.
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={salvarDadosConta} disabled={salvandoConta}>
              {salvandoConta ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
