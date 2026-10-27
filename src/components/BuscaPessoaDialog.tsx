// SPEC-231 E1 (reunião 26/10): dois cliques no campo "Pessoa" abrem a busca do cadastro (como no sistema antigo)
// para filtrar SÓ aquele cliente/fornecedor — há vários cadastros com o mesmo nome (Estância Santa Clara com
// CNPJs diferentes, cliente com 2–3 casas/projetos, vários "Vinícius").
//   Contas a Receber: código do projeto, cliente (razão social), nome do projeto, CPF/CNPJ.
//   Contas a Pagar:  nome fantasia, razão social, CNPJ (fornecedores).
import { useEffect, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { EH_PAGAR } from '@/lib/modo-sistema'

export interface PessoaSelecionada {
  contatoId: string
  /** Contas a Receber: um projeto específico do cliente (null = todos os projetos dele). */
  projetoId: string | null
  /** Nome do cadastro, para casar duplicatas antigas que só têm o nome. */
  nome: string
  /** Texto do filtro na tela. */
  rotulo: string
}

interface Linha {
  chave: string
  contatoId: string
  projetoId: string | null
  colunas: string[]
  nome: string
  rotulo: string
}

// vírgula e parênteses quebram o filtro .or() do PostgREST
const limpar = (t: string) => t.replace(/[,()*%]/g, ' ').trim()
// o documento pode estar em cpf_cnpj ou separado em cnpj / cpf
const doc = (c: any) => c?.cpf_cnpj || c?.cnpj || c?.cpf || ''

async function buscar(termo: string): Promise<Linha[]> {
  const t = limpar(termo)
  const filtroContato = `nome.ilike.*${t}*,razao_social.ilike.*${t}*,nome_empresa.ilike.*${t}*,cpf_cnpj.ilike.*${t}*,cnpj.ilike.*${t}*,cpf.ilike.*${t}*`

  if (EH_PAGAR) {
    const { data, error } = await supabase
      .from('contatos')
      .select('id, nome, nome_empresa, razao_social, cpf_cnpj, cnpj, cpf')
      .eq('tipo', 'fornecedor')
      .or(filtroContato)
      .order('nome')
      .limit(50)
    if (error) throw error
    return ((data as any[]) || []).map((c) => ({
      chave: c.id,
      contatoId: c.id,
      projetoId: null,
      colunas: [c.nome_empresa || c.nome || '-', c.razao_social || c.nome || '-', doc(c) || '-'],
      nome: c.nome || c.razao_social || '',
      rotulo: `${c.nome_empresa || c.razao_social || c.nome}${doc(c) ? ` · ${doc(c)}` : ''}`,
    }))
  }

  // Contas a Receber: projetos que batem pelo código/nome + clientes que batem pelo nome/CPF/CNPJ (com os projetos)
  const [porProjeto, porCliente] = await Promise.all([
    supabase
      .from('projetos')
      .select('id, codigo, nome, cliente:contatos!projetos_cliente_id_fkey(id, nome, razao_social, cpf_cnpj, cnpj, cpf)')
      .or(`codigo.ilike.*${t}*,nome.ilike.*${t}*`)
      .limit(40),
    supabase
      .from('contatos')
      .select('id, nome, razao_social, cpf_cnpj, cnpj, cpf, projetos:projetos!projetos_cliente_id_fkey(id, codigo, nome)')
      .neq('tipo', 'fornecedor')
      .or(filtroContato)
      .order('nome')
      .limit(40),
  ])
  if (porProjeto.error) throw porProjeto.error
  if (porCliente.error) throw porCliente.error

  const linhas = new Map<string, Linha>()
  const addProjeto = (p: any, c: any) => {
    if (!c) return
    linhas.set(p.id, {
      chave: p.id,
      contatoId: c.id,
      projetoId: p.id,
      colunas: [p.codigo || '-', c.razao_social || c.nome || '-', p.nome || '-', doc(c) || '-'],
      nome: c.nome || c.razao_social || '',
      rotulo: `${p.codigo ? p.codigo + ' · ' : ''}${c.razao_social || c.nome}${p.nome ? ` · ${p.nome}` : ''}`,
    })
  }
  for (const p of (porProjeto.data as any[]) || []) addProjeto(p, Array.isArray(p.cliente) ? p.cliente[0] : p.cliente)
  for (const c of (porCliente.data as any[]) || []) {
    const projetos = (c.projetos as any[]) || []
    // o cliente inteiro (todos os projetos) e cada projeto dele
    linhas.set(`c:${c.id}`, {
      chave: `c:${c.id}`,
      contatoId: c.id,
      projetoId: null,
      colunas: ['(todos)', c.razao_social || c.nome || '-', projetos.length ? `${projetos.length} projeto(s)` : '-', doc(c) || '-'],
      nome: c.nome || c.razao_social || '',
      rotulo: `${c.razao_social || c.nome}${doc(c) ? ` · ${doc(c)}` : ''} (todos os projetos)`,
    })
    for (const p of projetos) addProjeto(p, c)
  }
  return Array.from(linhas.values())
}

export function BuscaPessoaDialog({
  open,
  onClose,
  onSelect,
  termoInicial,
}: {
  open: boolean
  onClose: () => void
  onSelect: (p: PessoaSelecionada) => void
  termoInicial?: string
}) {
  const [termo, setTermo] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (open) setTermo(termoInicial ?? '')
  }, [open, termoInicial])

  useEffect(() => {
    if (!open) return
    if (limpar(termo).length < 2) {
      setLinhas([])
      return
    }
    let cancelado = false
    setCarregando(true)
    setErro('')
    const t = setTimeout(() => {
      buscar(termo)
        .then((r) => !cancelado && setLinhas(r))
        .catch((e) => !cancelado && setErro(e?.message ?? 'Erro na busca'))
        .finally(() => !cancelado && setCarregando(false))
    }, 300)
    return () => {
      cancelado = true
      clearTimeout(t)
    }
  }, [termo, open])

  const cabecalho = EH_PAGAR
    ? ['Nome fantasia', 'Razão social', 'CNPJ']
    : ['Cód. projeto', 'Cliente (razão social)', 'Projeto', 'CPF/CNPJ']

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{EH_PAGAR ? 'Buscar fornecedor' : 'Buscar cliente / projeto'}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
          <Input
            autoFocus
            className="pl-8"
            placeholder={
              EH_PAGAR ? 'Nome, razão social ou CNPJ...' : 'Nome, razão social, CPF/CNPJ, código ou nome do projeto...'
            }
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-auto border rounded-md min-h-[200px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                {cabecalho.map((h) => (
                  <th key={h} className="text-left font-medium p-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr
                  key={l.chave}
                  className="border-t cursor-pointer hover:bg-sky-50"
                  title="Clique para filtrar só este cadastro"
                  onClick={() => {
                    onSelect({ contatoId: l.contatoId, projetoId: l.projetoId, nome: l.nome, rotulo: l.rotulo })
                    onClose()
                  }}
                >
                  {l.colunas.map((c, i) => (
                    <td key={i} className={i === 0 ? 'p-2 font-mono' : 'p-2'}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {carregando && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}
          {!carregando && erro && <p className="p-3 text-xs text-red-600">{erro}</p>}
          {!carregando && !erro && linhas.length === 0 && (
            <p className="p-3 text-xs text-slate-500">
              {limpar(termo).length < 2 ? 'Digite ao menos 2 letras.' : 'Nada encontrado.'}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Campo "Pessoa" das telas: digitar filtra pelo nome (como antes); dois cliques ou a lupa abrem a busca do cadastro. */
export function CampoPessoa({
  texto,
  onTexto,
  selecionada,
  onSelecionada,
  placeholder,
}: {
  texto: string
  onTexto: (v: string) => void
  selecionada: PessoaSelecionada | null
  onSelecionada: (p: PessoaSelecionada | null) => void
  placeholder?: string
}) {
  const [aberta, setAberta] = useState(false)
  return (
    <>
      {selecionada ? (
        <div className="h-7 flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-2 text-xs text-sky-900">
          <span className="truncate flex-1" title={selecionada.rotulo}>
            Só: {selecionada.rotulo}
          </span>
          <button
            type="button"
            className="text-sky-700 hover:text-red-600"
            title="Tirar o filtro"
            onClick={() => onSelecionada(null)}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex gap-1">
          <Input
            className="h-7 text-xs bg-white w-full"
            placeholder={placeholder ?? 'Digite para buscar, ou dois cliques para escolher no cadastro...'}
            title="Dois cliques: buscar no cadastro e filtrar só um cliente/fornecedor"
            value={texto}
            onChange={(e) => onTexto(e.target.value)}
            onDoubleClick={() => setAberta(true)}
          />
          <button
            type="button"
            className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-md border bg-white text-slate-500 hover:bg-slate-50"
            title="Buscar no cadastro"
            onClick={() => setAberta(true)}
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <BuscaPessoaDialog
        open={aberta}
        onClose={() => setAberta(false)}
        termoInicial={texto}
        onSelect={(p) => {
          onTexto('')
          onSelecionada(p)
        }}
      />
    </>
  )
}
