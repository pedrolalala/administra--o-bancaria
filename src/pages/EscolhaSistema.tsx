import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import logoUrl from '@/assets/logotipo-verticalv1preto-b4de9.png'
import { URL_CONTAS_PAGAR, URL_CONTAS_RECEBER } from '@/lib/modo-sistema'

// SPEC-225: endereço antigo da Administração Bancária (build sem
// VITE_MODO_SISTEMA). Não tem login nem dados -- só leva para um dos 2
// sistemas novos.
export default function EscolhaSistema() {
  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border rounded-lg shadow-sm p-6 space-y-5 text-center">
        <img src={logoUrl} alt="Lucenera" className="h-12 mx-auto object-contain" />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-slate-800">
            A Administração Bancária foi separada
          </h1>
          <p className="text-sm text-muted-foreground">
            Contas a Pagar e Contas a Receber agora são sistemas diferentes. Escolha qual abrir.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href={URL_CONTAS_PAGAR}
            className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-orange-50 hover:border-orange-300 transition-colors"
          >
            <ArrowUpCircle className="h-7 w-7 text-orange-600" />
            <span className="font-medium text-slate-800">Contas a Pagar</span>
          </a>
          <a
            href={URL_CONTAS_RECEBER}
            className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-sky-50 hover:border-sky-300 transition-colors"
          >
            <ArrowDownCircle className="h-7 w-7 text-sky-600" />
            <span className="font-medium text-slate-800">Contas a Receber</span>
          </a>
        </div>
      </div>
    </div>
  )
}
