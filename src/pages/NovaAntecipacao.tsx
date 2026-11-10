import AntecipacaoForm from '@/components/duplicatas/AntecipacaoForm'

// SPEC-270: tela "Nova antecipação" (Contas a Receber), aberta pelo botão da aba Antecipações.
export default function NovaAntecipacao() {
  return (
    <div className="flex flex-col h-[calc(100vh-56px)] w-full bg-slate-50 overflow-hidden text-sm">
      <div className="bg-white border-b px-4 py-2 shadow-sm z-10 shrink-0">
        <h1 className="text-lg font-semibold text-slate-800">Nova antecipação de pagamento</h1>
      </div>
      <AntecipacaoForm />
    </div>
  )
}
