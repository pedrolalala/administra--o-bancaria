import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Plus, Trash2 } from 'lucide-react'

interface ParcelaLinha {
  parcela: number
  valor: string
  vencimento: string
  linhaDigitavel: string
}

const Field = ({
  label,
  children,
  span = 2,
}: {
  label: string
  children: React.ReactNode
  span?: number
}) => (
  <div className={`col-span-${span}`}>
    <label className="text-[10px] text-slate-500 font-medium uppercase">{label}</label>
    {children}
  </div>
)

export default function CadastrarDuplicata() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const contaGrupoId = searchParams.get('id')
  const isEditing = !!contaGrupoId

  const [saving, setSaving] = useState(false)
  const [empresas, setEmpresas] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [contatos, setContatos] = useState<any[]>([])
  const [contasBancarias, setContasBancarias] = useState<any[]>([])
  const [planoContas, setPlanoContas] = useState<any[]>([])

  // Gerar Conta
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().slice(0, 10))
  const [tipo, setTipo] = useState<'CP' | 'CR'>('CP')
  const [operacao, setOperacao] = useState('Todas')
  const [empresaId, setEmpresaId] = useState('')
  const [perfilEmpresa, setPerfilEmpresa] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [nf, setNf] = useState('')
  const [referencia, setReferencia] = useState('')
  const [tipoPessoa, setTipoPessoa] = useState<'fornecedor' | 'cliente'>('fornecedor')
  const [pessoaId, setPessoaId] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [subGrupoId, setSubGrupoId] = useState('')
  const [apropriacaoId, setApropriacaoId] = useState('')
  const [situacao, setSituacao] = useState('Pendente')
  const [contaBancariaId, setContaBancariaId] = useState('')
  const [observacao, setObservacao] = useState('')

  // Gerar Parcelas
  const [numParc, setNumParc] = useState('1')
  const [dia, setDia] = useState('10')
  const [vencPrimeiraParc, setVencPrimeiraParc] = useState('')
  const [parcelas, setParcelas] = useState<ParcelaLinha[]>([])

  useEffect(() => {
    Promise.all([
      supabase.from('empresas').select('id, nome').order('nome'),
      supabase.from('usuarios').select('id, nome').order('nome'),
      supabase.from('contas_bancarias').select('id, nome').order('nome'),
      supabase.from('plano_de_contas').select('id, nome, nivel, parent_id').eq('ativo', true).order('nome'),
    ]).then(([emp, usr, contas, plano]) => {
      if (emp.data) setEmpresas(emp.data)
      if (usr.data) setUsuarios(usr.data)
      if (contas.data) setContasBancarias(contas.data)
      if (plano.data) setPlanoContas(plano.data)
    })
  }, [])

  useEffect(() => {
    supabase
      .from('contatos')
      .select('id, nome, razao_social')
      .eq('tipo', tipoPessoa)
      .order('nome')
      .then(({ data }) => setContatos(data || []))
  }, [tipoPessoa])

  // Carrega uma conta existente pra edicao (todas as parcelas com o mesmo
  // conta_grupo_id compartilham os dados de "Gerar Conta").
  useEffect(() => {
    if (!contaGrupoId) return
    supabase
      .from('boletos')
      .select('*')
      .eq('conta_grupo_id', contaGrupoId)
      .order('num_parcela')
      .then(({ data }) => {
        if (!data || data.length === 0) return
        const first = data[0]
        setDataEmissao(first.emissao || new Date().toISOString().slice(0, 10))
        setTipo((first.tipo_operacao as 'CP' | 'CR') || 'CP')
        setEmpresaId(first.empresa_id || '')
        setPerfilEmpresa(first.perfil || '')
        setResponsavelId(first.responsavel_id || '')
        setNf(first.numero_documento || '')
        setReferencia(first.referencia || '')
        setApropriacaoId(first.apropriacao_id || '')
        setSituacao(first.status || 'Pendente')
        setContaBancariaId(first.conta_bancaria_id || '')
        setObservacao(first.observacao || '')
        setParcelas(
          data.map((b: any) => ({
            parcela: b.num_parcela || 1,
            valor: String(b.valor ?? ''),
            vencimento: b.vencimento || '',
            linhaDigitavel: b.linha_digitavel || '',
          })),
        )
      })
  }, [contaGrupoId])

  // Apropriacao (plano_de_contas) e hierarquico em 3 niveis: 1=Grupo,
  // 2=Sub Grupo, 3=Apropriacao (folha). Os selects de Grupo/Sub Grupo
  // filtram as opcoes do nivel seguinte pelo parent_id escolhido.
  const gruposNivel1 = useMemo(() => planoContas.filter((p) => p.nivel === 1), [planoContas])
  const subGruposNivel2 = useMemo(
    () => planoContas.filter((p) => p.nivel === 2 && p.parent_id === grupoId),
    [planoContas, grupoId],
  )
  const apropriacoesNivel3 = useMemo(
    () => planoContas.filter((p) => p.nivel === 3 && p.parent_id === subGrupoId),
    [planoContas, subGrupoId],
  )

  const proximaParcela = parcelas.length + 1
  const totalParcAtingido = parcelas.length >= (parseInt(numParc, 10) || 0)

  const calcularVencimento = (numeroParcela: number) => {
    if (!vencPrimeiraParc) return ''
    const base = new Date(vencPrimeiraParc + 'T12:00:00')
    if (numeroParcela === 1) return vencPrimeiraParc
    const diaNum = parseInt(dia, 10) || base.getDate()
    const venc = new Date(base.getFullYear(), base.getMonth() + (numeroParcela - 1), diaNum)
    return venc.toISOString().slice(0, 10)
  }

  const handleAdicionarParcela = () => {
    if (!vencPrimeiraParc) {
      toast({ title: 'Informe o Venc. 1° Parc.', variant: 'destructive' })
      return
    }
    if (totalParcAtingido) {
      toast({ title: `N° Parc já atingido (${numParc})`, variant: 'destructive' })
      return
    }
    setParcelas((prev) => [
      ...prev,
      {
        parcela: proximaParcela,
        valor: '',
        vencimento: calcularVencimento(proximaParcela),
        linhaDigitavel: '',
      },
    ])
  }

  const handleRemoverParcela = (parcela: number) => {
    setParcelas((prev) =>
      prev.filter((p) => p.parcela !== parcela).map((p, idx) => ({ ...p, parcela: idx + 1 })),
    )
  }

  const updateParcela = (parcela: number, field: keyof ParcelaLinha, value: string) => {
    setParcelas((prev) =>
      prev.map((p) => (p.parcela === parcela ? { ...p, [field]: value } : p)),
    )
  }

  const valorTotal = parcelas.reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0)

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const handleSalvar = async () => {
    if (!empresaId) {
      toast({ title: 'Selecione a Empresa', variant: 'destructive' })
      return
    }
    if (parcelas.length === 0) {
      toast({ title: 'Adicione ao menos uma parcela', variant: 'destructive' })
      return
    }
    if (parcelas.some((p) => !p.valor || !p.vencimento)) {
      toast({ title: 'Preencha valor e vencimento de todas as parcelas', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const grupoId = contaGrupoId || crypto.randomUUID()
      const pessoa = contatos.find((c) => c.id === pessoaId)
      const totalParcelas = parcelas.length

      if (isEditing) {
        // Remove as parcelas antigas e recria -- mais simples e seguro do
        // que tentar casar linha a linha (usuario pode adicionar/remover
        // parcelas ao editar).
        await supabase.from('boletos').delete().eq('conta_grupo_id', grupoId)
      }

      const rows = parcelas.map((p) => ({
        nosso_numero: `DUP${Date.now()}${p.parcela}`,
        nome_pagador: pessoa?.razao_social || pessoa?.nome || '',
        valor: parseFloat(p.valor),
        vencimento: p.vencimento,
        status: situacao,
        empresa_id: empresaId,
        numero_documento: nf || null,
        tipo: 'Normal',
        tipo_operacao: tipo,
        num_parcela: p.parcela,
        total_parcelas: totalParcelas,
        emissao: dataEmissao,
        perfil: perfilEmpresa || null,
        apropriacao_id: apropriacaoId || null,
        conta_bancaria_id: contaBancariaId || null,
        linha_digitavel: p.linhaDigitavel || null,
        responsavel_id: responsavelId || null,
        referencia: referencia || null,
        conta_grupo_id: grupoId,
        observacao: observacao || null,
      }))

      const { error } = await supabase.from('boletos').insert(rows)
      if (error) throw error

      toast({ title: 'Sucesso', description: `${totalParcelas} parcela(s) salva(s).` })
      navigate('/duplicatas')
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] w-full bg-slate-50 overflow-hidden text-sm">
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between shadow-sm z-10 shrink-0">
        <h1 className="text-lg font-semibold text-slate-800">
          {isEditing ? 'Editar Duplicata' : 'Cadastrar Duplicatas'}
        </h1>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <div className="font-semibold text-xs mb-2 text-slate-700">Gerar Conta</div>
          <div className="grid grid-cols-12 gap-3">
            <Field label="Data emissão">
              <Input
                type="date"
                className="h-7 text-xs bg-slate-50"
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
              />
            </Field>
            <Field label="Tipo">
              <Select value={tipo} onValueChange={(v) => setTipo(v as 'CP' | 'CR')}>
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CP">Pagar</SelectItem>
                  <SelectItem value="CR">Receber</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Operação">
              <Select value={operacao} onValueChange={setOperacao}>
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todas">Todas</SelectItem>
                  <SelectItem value="Venda">Venda</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Empresa">
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Perfil Empresa">
              <Select value={perfilEmpresa} onValueChange={setPerfilEmpresa}>
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ribeirao">Ribeirão</SelectItem>
                  <SelectItem value="sao_paulo">São Paulo</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Código">
              <Input
                readOnly
                disabled
                className="h-7 text-xs bg-slate-100 text-slate-400"
                value={isEditing ? contaGrupoId!.slice(0, 8) : 'gerado ao salvar'}
              />
            </Field>

            <Field label="Responsável">
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="NF">
              <Input
                className="h-7 text-xs bg-slate-50"
                value={nf}
                onChange={(e) => setNf(e.target.value)}
              />
            </Field>
            <Field label="Referência" span={3}>
              <Input
                className="h-7 text-xs bg-slate-50"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
              />
            </Field>
            <Field label="Tipo pessoa">
              <Select
                value={tipoPessoa}
                onValueChange={(v) => {
                  setTipoPessoa(v as 'fornecedor' | 'cliente')
                  setPessoaId('')
                }}
              >
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Código">
              <Input
                readOnly
                disabled
                className="h-7 text-xs bg-slate-100 text-slate-400"
                value={pessoaId ? pessoaId.slice(0, 8) : '-'}
              />
            </Field>
            <Field label={tipoPessoa === 'fornecedor' ? 'Fornecedor' : 'Cliente'} span={3}>
              <Select value={pessoaId} onValueChange={setPessoaId}>
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {contatos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.razao_social || c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Grupo">
              <Select
                value={grupoId}
                onValueChange={(v) => {
                  setGrupoId(v)
                  setSubGrupoId('')
                  setApropriacaoId('')
                }}
              >
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  {gruposNivel1.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Sub grupo">
              <Select
                value={subGrupoId}
                onValueChange={(v) => {
                  setSubGrupoId(v)
                  setApropriacaoId('')
                }}
              >
                <SelectTrigger className="h-7 text-xs bg-slate-50" disabled={!grupoId}>
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  {subGruposNivel2.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Apropriação">
              <Select value={apropriacaoId} onValueChange={setApropriacaoId}>
                <SelectTrigger className="h-7 text-xs bg-slate-50" disabled={!subGrupoId}>
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  {apropriacoesNivel3.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Situação">
              <Select value={situacao} onValueChange={setSituacao}>
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="pendente_registro">Pendente Registro</SelectItem>
                  <SelectItem value="Remessa Enviada">Remessa Enviada</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Conta">
              <Select value={contaBancariaId} onValueChange={setContaBancariaId}>
                <SelectTrigger className="h-7 text-xs bg-slate-50">
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  {contasBancarias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Observação" span={4}>
              <Textarea
                className="text-xs bg-slate-50 h-7 min-h-7 py-1"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <div className="font-semibold text-xs mb-2 text-slate-700">Gerar Parcelas</div>
          <div className="grid grid-cols-12 gap-3 items-end mb-3">
            <Field label="N° Parc" span={2}>
              <Input
                type="number"
                min={1}
                className="h-7 text-xs bg-slate-50"
                value={numParc}
                onChange={(e) => setNumParc(e.target.value)}
              />
            </Field>
            <Field label="Parcela" span={2}>
              <Input
                readOnly
                disabled
                className="h-7 text-xs bg-slate-100 text-slate-400"
                value={totalParcAtingido ? '-' : `${proximaParcela}/${numParc}`}
              />
            </Field>
            <Field label="Dia" span={2}>
              <Input
                type="number"
                min={1}
                max={31}
                className="h-7 text-xs bg-slate-50"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
              />
            </Field>
            <Field label="Venc 1° Parc" span={3}>
              <Input
                type="date"
                className="h-7 text-xs bg-slate-50"
                value={vencPrimeiraParc}
                onChange={(e) => setVencPrimeiraParc(e.target.value)}
              />
            </Field>
            <div className="col-span-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 w-full"
                onClick={handleAdicionarParcela}
                disabled={totalParcAtingido}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Parcela
              </Button>
            </div>
          </div>

          <div className="border rounded-md overflow-hidden">
            <Table className="text-xs">
              <TableHeader className="bg-slate-50">
                <TableRow className="h-8">
                  <TableHead className="p-1 text-center">Parcela</TableHead>
                  <TableHead className="p-1 text-right">Valor da Parcela</TableHead>
                  <TableHead className="p-1 text-center">Data Vencimento</TableHead>
                  <TableHead className="p-1">Linha Digitável</TableHead>
                  <TableHead className="p-1 w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-slate-400 italic">
                      Nenhuma parcela adicionada.
                    </TableCell>
                  </TableRow>
                ) : (
                  parcelas.map((p) => (
                    <TableRow key={p.parcela} className="h-9">
                      <TableCell className="p-1 text-center font-medium">
                        {p.parcela}/{parcelas.length}
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-7 text-xs text-right"
                          value={p.valor}
                          onChange={(e) => updateParcela(p.parcela, 'valor', e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="date"
                          className="h-7 text-xs"
                          value={p.vencimento}
                          onChange={(e) => updateParcela(p.parcela, 'vencimento', e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-7 text-xs font-mono"
                          value={p.linhaDigitavel}
                          onChange={(e) =>
                            updateParcela(p.parcela, 'linhaDigitavel', e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500"
                          onClick={() => handleRemoverParcela(p.parcela)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <div className="bg-slate-200 border-t px-4 py-2 flex items-center justify-between shrink-0">
        <div className="text-sm font-bold text-slate-700">
          Valor Total: <span className="text-primary">{formatCurrency(valorTotal)}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/duplicatas')}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSalvar} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
