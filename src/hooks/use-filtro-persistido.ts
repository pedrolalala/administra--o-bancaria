import { useCallback, useEffect, useRef, useState } from 'react'
import { MODO } from '@/lib/modo-sistema'

// SPEC-288 (Reunião 51): os filtros da consulta não podem se perder quando a pessoa vai para outra aba do sistema
// (ex.: Antecipações) e volta. Guarda na sessão do navegador (some ao fechar a aba), separado por sistema (pagar/receber).
// Se o armazenamento do navegador estiver bloqueado, funciona como um useState comum.

export function useFiltroPersistido<T>(chave: string, inicial: T): [T, (v: T | ((anterior: T) => T)) => void, () => void] {
  const chaveCompleta = `filtro:${MODO ?? 'sem-modo'}:${chave}`
  const [valor, setValor] = useState<T>(() => {
    try {
      const bruto = sessionStorage.getItem(chaveCompleta)
      if (bruto) {
        const lido = JSON.parse(bruto)
        // mescla com o inicial para não quebrar se um campo novo de filtro foi criado depois
        if (inicial && typeof inicial === 'object' && !Array.isArray(inicial) && lido && typeof lido === 'object') {
          return { ...(inicial as object), ...lido } as T
        }
        return lido as T
      }
    } catch {
      /* armazenamento bloqueado ou JSON inválido: usa o inicial */
    }
    return inicial
  })

  const primeiro = useRef(true)
  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false
      return
    }
    try {
      sessionStorage.setItem(chaveCompleta, JSON.stringify(valor))
    } catch {
      /* sem armazenamento: segue só em memória */
    }
  }, [chaveCompleta, valor])

  const limpar = useCallback(() => {
    try {
      sessionStorage.removeItem(chaveCompleta)
    } catch {
      /* ignora */
    }
    setValor(inicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveCompleta])

  return [valor, setValor, limpar]
}
