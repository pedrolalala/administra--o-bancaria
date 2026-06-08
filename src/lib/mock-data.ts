import { CnabData } from '@/types/cnab'

export const mockCnabData: CnabData = {
  summary: {
    totalLiquidacoes: 3,
    totalConfirmacoes: 2,
    valorTotalRecebido: 4550.75,
  },
  records: [
    {
      id: 'mock-1',
      nossoNumero: '000012345678',
      ocorrencia: '06',
      data: '15/06/2026',
      valor: 1500.0,
      pagador: 'João Silva Oliveira',
      tipo: 'Liquidado',
    },
    {
      id: 'mock-2',
      nossoNumero: '000012345679',
      ocorrencia: '02',
      data: '15/06/2026',
      valor: 850.5,
      pagador: 'Maria Souza Ramos',
      tipo: 'Confirmado',
    },
    {
      id: 'mock-3',
      nossoNumero: '000012345680',
      ocorrencia: '06',
      data: '16/06/2026',
      valor: 200.25,
      pagador: 'Carlos Eduardo Santos',
      tipo: 'Liquidado',
    },
    {
      id: 'mock-4',
      nossoNumero: '000012345681',
      ocorrencia: '06',
      data: '16/06/2026',
      valor: 2850.5,
      pagador: 'Empresa Fictícia LTDA',
      tipo: 'Liquidado',
    },
    {
      id: 'mock-5',
      nossoNumero: '000012345682',
      ocorrencia: '02',
      data: '17/06/2026',
      valor: 1200.0,
      pagador: 'Ana Paula Ferreira',
      tipo: 'Confirmado',
    },
  ],
}

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
