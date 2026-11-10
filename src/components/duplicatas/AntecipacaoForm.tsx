import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { lancarAntecipacao } from '@/lib/financeiro-novo'

// SPEC-270 Fase 1 (só Contas a Receber): lançar uma "Antecipação de pagamento" — não é duplicata.
// Campos da reunião 48 (Carol, 10/11): data de emissão, empresa, responsável (equipe do orçamento, nunca quem lança),
// grupo / subgrupo / apropriação (os mesmos da duplicata), data do pagamento no lugar do vencimento, observação.
// Nasce já recebida na data do pagamento (por isso pede a conta bancária onde o valor entrou) e não entra em "em aberto".

const hoje = () => new Date().toISOString().slice(0, 10)

const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="col-span-12 sm:col-span-6 lg:col-span-3 space-y-1">
    <label className="text-[10px] text-slate-500 font-medium uppercase">{label}</label>
    {children}
  </div>
)

export default function AntecipacaoForm() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [empresas, setEmpresas] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [contas, setContas] = useState<any[]>([])
  const [plano, setPlano] = useState<any[]>([])

  const [emissao, setEmissao] = useState(hoje())
  const [dataPagamento, setDataPagamento] = useState(hoje())
  const [empresaId, setEmpresaId] = useState('')
  const [perfil, setPerfil] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [subGrupoId, setSubGrupoId] = useState('')
  const [apropriacaoId, setApropriacaoId] = useState('')
  const [contaId, setContaId] = useState('')
  const [forma, setForma] = useState('')
  const [valor, setValor] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('empresas').select('id, nome').order('nome'),
      supabase.from('usuarios').select('id, nome').order('nome'),
      supabase.from('contatos').select('id, nome, razao_social').eq('tipo', 'cliente').order('nome'),
      supabase.from('contas_bancarias').select('id, nome').order('nome'),
      supabase.from('plano_de_contas').select('id, nome, nivel, parent_id, tipo').eq('ativo', true).order('nome'),
    ]).then(([emp, usr, cli, cb, pl]) => {
      setEmpresas(emp.data || [])
      setUsuarios(usr.data || [])
      setClientes(cli.data || [])
      setContas(cb.data || [])
      setPlano(pl.data || [])
    })
  }, [])

  // Plano de contas em 3 níveis: 1 = Grupo, 2 = Sub grupo, 3 = Apropriação (a que o banco grava).
  const grupos = useMemo(() => plano.filter((p) => p.nivel === 1), [plano])
  const subGrupos = useMemo(() => plano.filter((p) => p.nivel === 2 && p.parent_id === grupoId), [plano, grupoId])
  const apropriacoes = useMemo(() => plano.filter((p) => p.nivel === 3 && p.parent_id === subGrupoId), [plano, subGrupoId])

  // O responsável é a equipe do orçamento, nunca quem está lançando (o banco também recusa).
  const responsaveis = useMemo(() => usuarios.filter((u) => u.id !== user?.id), [usuarios, user?.id])

  const salvar = async () => {
    const v = parseFloat(valor.replace(',', '.'))
    const falta =
      !empresaId ? 'a Empresa'
      : !clienteId ? 'o Cliente'
      : !responsavelId ? 'o Responsável'
      : !apropriacaoId ? 'a Apropriação (grupo, subgrupo e apropriação)'
      : !contaId ? 'a Conta bancária em que o valor entrou'
      : !(v > 0) ? 'o Valor'
      : null
    if (falta) {
      toast({ title: `Informe ${falta}`, variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      await lancarAntecipacao({
        empresaId,
        perfil: perfil || null,
        clienteId,
        responsavelId,
        emissao,
        dataPagamento,
        valor: v,
        planoContasId: apropriacaoId,
        contaBancariaId: contaId,
        forma: forma || null,
        observacao: observacao || null,
      })
      toast({ title: 'Antecipação lançada', description: 'Ela aparece na aba Antecipações e em Consultar Duplicatas (selo AT).' })
      navigate('/antecipacoes')
    } catch (e: any) {
      toast({ title: 'Não foi possível lançar', description: e?.message || String(e), variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-3">
        <div className="font-semibold text-xs mb-1 text-slate-700">Antecipação de pagamento</div>
        <p className="text-[11px] text-slate-500 mb-3">
          Valor que o cliente já pagou antes da venda. Não é duplicata: entra como já recebido, aparece como antecipada em Consultar
          Duplicatas e pode ser usado na aprovação financeira do orçamento do cliente.
        </p>
        <div className="grid grid-cols-12 gap-3">
          <Campo label="Data emissão (operação recebida)">
            <Input type="date" className="h-7 text-xs bg-slate-50" value={emissao} onChange={(e) => setEmissao(e.target.value)} />
          </Campo>
          <Campo label="Data do pagamento">
            <Input type="date" className="h-7 text-xs bg-slate-50" max={hoje()} value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
          </Campo>
          <Campo label="Empresa">
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger className="h-7 text-xs bg-slate-50"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Campo>
          <Campo label="Perfil Empresa">
            <Select value={perfil} onValueChange={setPerfil}>
              <SelectTrigger className="h-7 text-xs bg-slate-50"><SelectValue placeholder="-" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ribeirao">Ribeirão</SelectItem>
                <SelectItem value="sao_paulo">São Paulo</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Cliente">
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger className="h-7 text-xs bg-slate-50"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.razao_social || c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Campo>
          <Campo label="Responsável (equipe do orçamento)">
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger className="h-7 text-xs bg-slate-50"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{responsaveis.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Campo>
          <Campo label="Valor (R$)">
            <Input inputMode="decimal" className="h-7 text-xs bg-slate-50" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
          </Campo>
          <Campo label="Conta bancária (onde entrou)">
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger className="h-7 text-xs bg-slate-50"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Campo>
          <Campo label="Grupo">
            <Select value={grupoId} onValueChange={(v) => { setGrupoId(v); setSubGrupoId(''); setApropriacaoId('') }}>
              <SelectTrigger className="h-7 text-xs bg-slate-50"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{grupos.map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Campo>
          <Campo label="Sub grupo">
            <Select value={subGrupoId} onValueChange={(v) => { setSubGrupoId(v); setApropriacaoId('') }} disabled={!grupoId}>
              <SelectTrigger className="h-7 text-xs bg-slate-50"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{subGrupos.map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Campo>
          <Campo label="Apropriação">
            <Select value={apropriacaoId} onValueChange={setApropriacaoId} disabled={!subGrupoId}>
              <SelectTrigger className="h-7 text-xs bg-slate-50"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{apropriacoes.map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Campo>
          <Campo label="Forma de pagamento (opcional)">
            <Input className="h-7 text-xs bg-slate-50" placeholder="Pix, TED, boleto..." value={forma} onChange={(e) => setForma(e.target.value)} />
          </Campo>
          <div className="col-span-12 space-y-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase">Observação (opcional)</label>
            <Textarea className="text-xs bg-slate-50 min-h-[60px]" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          Situação: não se preenche — a antecipação fica em carteira como recebida na data do pagamento.
        </p>
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/antecipacoes')} disabled={salvando}>Cancelar</Button>
          <Button size="sm" onClick={salvar} disabled={salvando}>{salvando ? 'Lançando...' : 'Lançar antecipação'}</Button>
        </div>
      </div>
    </div>
  )
}
