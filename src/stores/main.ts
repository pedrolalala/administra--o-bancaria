import { useSyncExternalStore } from 'react'

export type BoletoStatus = 'Pendente' | 'Registrado' | 'Pago' | 'Cancelado'

export interface Boleto {
  id: string
  nosso_numero: string
  nome_pagador: string
  valor: number
  vencimento: string
  status: BoletoStatus
  data_liquidacao?: string
  valor_recebido?: number
  empresa_id: string
  projeto_parcela_id: string
}

export interface RetornoProcessado {
  id: string
  nome_arquivo: string
  data_upload: string
  empresa_id: string
  quantidade_liquidacoes: number
  quantidade_confirmacoes: number
  processado: boolean
}

// Seed data that matches our mockCnabData to test full flow
const initialBoletos: Boleto[] = [
  {
    id: 'b1',
    nosso_numero: '000012345678',
    nome_pagador: 'João Silva Oliveira',
    valor: 1500.0,
    vencimento: '15/06/2026',
    status: 'Pendente',
    empresa_id: 'emp1',
    projeto_parcela_id: 'p1',
  },
  {
    id: 'b2',
    nosso_numero: '000012345679',
    nome_pagador: 'Maria Souza Ramos',
    valor: 850.5,
    vencimento: '15/06/2026',
    status: 'Pendente',
    empresa_id: 'emp1',
    projeto_parcela_id: 'p2',
  },
  // Omitimos o 000012345680 de propósito para testar a exceção de título não encontrado
  {
    id: 'b4',
    nosso_numero: '000012345681',
    nome_pagador: 'Empresa Fictícia LTDA',
    valor: 2850.5,
    vencimento: '16/06/2026',
    status: 'Registrado',
    empresa_id: 'emp1',
    projeto_parcela_id: 'p4',
  },
  {
    id: 'b5',
    nosso_numero: '000012345682',
    nome_pagador: 'Ana Paula Ferreira',
    valor: 1200.0,
    vencimento: '17/06/2026',
    status: 'Pendente',
    empresa_id: 'emp1',
    projeto_parcela_id: 'p5',
  },
]

const store = {
  boletos: [...initialBoletos],
  retornos: [] as RetornoProcessado[],
  listeners: new Set<() => void>(),
  _snapshot: {
    boletos: [...initialBoletos],
    retornos: [] as RetornoProcessado[],
  },

  subscribe(listener: () => void) {
    store.listeners.add(listener)
    return () => store.listeners.delete(listener)
  },

  getSnapshot() {
    return store._snapshot
  },

  updateSnapshot() {
    store._snapshot = {
      boletos: store.boletos,
      retornos: store.retornos,
    }
  },

  updateBoleto(nosso_numero: string, updates: Partial<Boleto>) {
    const index = store.boletos.findIndex((b) => b.nosso_numero === nosso_numero)
    if (index !== -1) {
      const newBoletos = [...store.boletos]
      newBoletos[index] = { ...newBoletos[index], ...updates }
      store.boletos = newBoletos
      store.updateSnapshot()
      store.emitChange()
      return true
    }
    return false
  },

  addRetorno(retorno: RetornoProcessado) {
    store.retornos = [...store.retornos, retorno]
    store.updateSnapshot()
    store.emitChange()
  },

  checkArquivoProcessado(nome_arquivo: string) {
    return store.retornos.some((r) => r.nome_arquivo === nome_arquivo)
  },

  emitChange() {
    store.listeners.forEach((l) => l())
  },
}

export default function useDatabaseStore() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)

  return {
    ...state,
    updateBoleto: store.updateBoleto,
    addRetorno: store.addRetorno,
    checkArquivoProcessado: store.checkArquivoProcessado,
  }
}
