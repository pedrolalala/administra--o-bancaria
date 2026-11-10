import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

// SPEC-269: emitir/configurar LT e comissão (RT) exige o acesso 'financeiro-rt-comissao'
// em Acesso a Sistemas, além do 'financeiro'. A trava de verdade está no banco
// (financeiro_exige_rt e as views de RT); isto só evita mostrar tela/botão que daria erro.
// null = ainda carregando; em caso de erro da consulta, false (esconde).
export function usePodeEmitirRT(): boolean | null {
  const { user } = useAuth()
  const [pode, setPode] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user?.id) {
      setPode(null)
      return
    }
    let ativo = true
    ;(supabase as any)
      .rpc('pode_acessar_sistema', { p_slug: 'financeiro-rt-comissao' })
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (ativo) setPode(error ? false : Boolean(data))
      })
    return () => {
      ativo = false
    }
  }, [user?.id])

  return pode
}
