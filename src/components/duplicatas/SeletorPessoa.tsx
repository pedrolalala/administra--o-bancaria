import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

export interface PessoaOpcao {
  id: string
  nome: string
  razao_social?: string | null
  cpf_cnpj?: string | null
}

const rotuloPessoa = (c: PessoaOpcao) => c.razao_social || c.nome

// Busca de cliente/fornecedor: consulta o servidor a cada digitação (nome, razão social ou CPF/CNPJ),
// em vez de carregar a lista inteira (o limite de 1.000 linhas cortava os contatos).
export default function SeletorPessoa({
  tipo,
  valor,
  onChange,
}: {
  tipo: 'fornecedor' | 'cliente'
  valor: PessoaOpcao | null
  onChange: (c: PessoaOpcao | null) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [opcoes, setOpcoes] = useState<PessoaOpcao[]>([])
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    let cancelado = false
    setCarregando(true)
    const t = setTimeout(async () => {
      let q = supabase
        .from('contatos')
        .select('id, nome, razao_social, cpf_cnpj')
        .eq('tipo', tipo)
        .eq('ativo', true)
        .is('canonical_id', null)
      const termo = busca.trim().replace(/[,()%*]/g, ' ')
      if (termo) {
        const digitos = termo.replace(/\D/g, '')
        const filtros = [`nome.ilike.%${termo}%`, `razao_social.ilike.%${termo}%`, `nome_empresa.ilike.%${termo}%`]
        if (digitos.length >= 3) filtros.push(`cpf_cnpj.ilike.%${digitos}%`)
        q = q.or(filtros.join(','))
      }
      const { data } = await q.order('nome').limit(50)
      if (!cancelado) {
        setOpcoes((data as PessoaOpcao[]) || [])
        setCarregando(false)
      }
    }, 250)
    return () => {
      cancelado = true
      clearTimeout(t)
    }
  }, [aberto, busca, tipo])

  return (
    <Popover
      open={aberto}
      onOpenChange={(o) => {
        setAberto(o)
        if (!o) setBusca('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="h-7 w-full justify-between bg-slate-50 px-3 text-xs font-normal"
        >
          <span className="truncate">{valor ? rotuloPessoa(valor) : 'Selecione...'}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Buscar ${tipo} por nome ou CPF/CNPJ...`}
            value={busca}
            onValueChange={setBusca}
          />
          <CommandList>
            {carregando ? (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando...
              </div>
            ) : opcoes.length === 0 ? (
              <CommandEmpty>Nenhum {tipo} encontrado.</CommandEmpty>
            ) : (
              <CommandGroup heading={opcoes.length === 50 ? 'Mostrando os 50 primeiros — digite para filtrar' : undefined}>
                {opcoes.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      onChange(c)
                      setAberto(false)
                    }}
                  >
                    <Check className={`mr-2 h-3.5 w-3.5 ${valor?.id === c.id ? 'opacity-100' : 'opacity-0'}`} />
                    <span className="truncate">{rotuloPessoa(c)}</span>
                    {c.cpf_cnpj && <span className="ml-auto pl-2 text-[10px] text-slate-400">{c.cpf_cnpj}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
