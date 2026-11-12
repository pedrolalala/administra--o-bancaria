import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { criarAcordo, type ParcelaDoAcordo } from '@/lib/financeiro-novo'

// SPEC-287 (Reunião 47): acordo = refazer as parcelas selecionadas (ex.: 30% de entrada no Pix + o resto igual em boleto,
// com ou sem desconto). As parcelas originais não são apagadas: ficam "renegociadas" e ligadas ao acordo.

interface Props {
  open: boolean
  onClose: () => void
  duplicatas: any[]
  onSuccess: () => void
}

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const num = (s: string) => {
  const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const r2 = (n: number) => Math.round(n * 100) / 100
const FORMAS = ['boleto', 'pix', 'cartao', 'deposito', 'carteira', 'cheque', 'outro']

function somaDias(iso: string, dias: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function AcordoModal({ open, onClose, duplicatas, onSuccess }: Props) {
  const { toast } = useToast()
  const hoje = new Date().toISOString().slice(0, 10)
  const total = r2(duplicatas.reduce((s, d) => s + (Number(d.valor) || 0), 0))
  const [desconto, setDesconto] = useState('')
  const [qtd, setQtd] = useState('3')
  const [entradaPct, setEntradaPct] = useState('')
  const [primeira, setPrimeira] = useState(hoje)
  const [intervalo, setIntervalo] = useState('30')
  const [formaEntrada, setFormaEntrada] = useState('pix')
  const [formaResto, setFormaResto] = useState('boleto')
  const [motivo, setMotivo] = useState('')
  const [linhas, setLinhas] = useState<{ vencimento: string; valor: string; forma: string }[]>([])
  const [saving, setSaving] = useState(false)

  const descontoNum = r2(num(desconto))
  const liquido = r2(total - descontoNum)

  // monta a sugestão sempre que os parâmetros mudam (o usuário ainda pode ajustar cada linha)
  useEffect(() => {
    if (!open) return
    const n = Math.max(1, Math.min(60, Math.floor(num(qtd)) || 1))
    const pct = Math.min(100, Math.max(0, num(entradaPct)))
    const valores: number[] = []
    if (pct > 0 && n > 1) {
      const e = r2((liquido * pct) / 100)
      valores.push(e)
      const resto = r2(liquido - e)
      const base = r2(resto / (n - 1))
      for (let i = 1; i < n; i++) valores.push(i < n - 1 ? base : r2(resto - base * (n - 2)))
    } else {
      const base = r2(liquido / n)
      for (let i = 0; i < n; i++) valores.push(i < n - 1 ? base : r2(liquido - base * (n - 1)))
    }
    setLinhas(
      valores.map((v, i) => ({
        vencimento: somaDias(primeira, i === 0 ? 0 : (num(intervalo) || 30) * i),
        valor: v.toFixed(2).replace('.', ','),
        forma: i === 0 && pct > 0 ? formaEntrada : formaResto,
      })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, qtd, entradaPct, primeira, intervalo, formaEntrada, formaResto, liquido])

  const somaNova = useMemo(() => r2(linhas.reduce((s, l) => s + num(l.valor), 0)), [linhas])
  const confere = Math.abs(somaNova - liquido) <= 0.01 && liquido > 0
  const semDatas = linhas.some((l) => !l.vencimento || num(l.valor) <= 0)
  const comBoleto = duplicatas.filter((d) => d.boleto_id).length

  const confirmar = async () => {
    if (!motivo.trim()) return toast({ title: 'Informe o motivo do acordo', variant: 'destructive' })
    if (!confere || semDatas)
      return toast({
        title: 'Confira as parcelas novas',
        description: 'A soma precisa fechar com o total menos o desconto.',
        variant: 'destructive',
      })
    setSaving(true)
    try {
      const plano: ParcelaDoAcordo[] = linhas.map((l) => ({ vencimento: l.vencimento, valor: num(l.valor), forma: l.forma }))
      const ids = Array.from(new Set(duplicatas.map((d) => d._parcelaId).filter(Boolean))) as string[]
      const r = await criarAcordo(ids, plano, descontoNum, motivo)
      toast({
        title: `Acordo ${r.grupo_acordo} criado`,
        description:
          `${r.parcelas_origem} parcela(s) renegociada(s) em ${r.parcelas_novas} nova(s).` +
          (r.com_boleto_emitido > 0
            ? ` Atenção: ${r.com_boleto_emitido} tinha(m) boleto emitido; cancele no banco e emita os novos.`
            : ''),
      })
      setMotivo('')
      onSuccess()
      onClose()
    } catch (e: any) {
      toast({ title: 'Erro ao criar o acordo', description: e?.message ?? String(e), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const campo = 'text-[10px] text-slate-500 font-medium uppercase'
  const atualiza = (i: number, parte: Partial<{ vencimento: string; valor: string; forma: string }>) =>
    setLinhas(linhas.map((x, j) => (j === i ? { ...x, ...parte } : x)))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Acordo (renegociar parcelas)</DialogTitle>
          <DialogDescription>
            {duplicatas.length} parcela(s), total {brl(total)}. As parcelas originais não são apagadas: ficam
            "renegociadas" e ligadas ao acordo.
          </DialogDescription>
        </DialogHeader>

        {comBoleto > 0 && (
          <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
            Há parcela com boleto emitido: o acordo não cancela o boleto no banco. Cancele lá e emita os novos.
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className={campo}>Desconto (R$)</label>
            <Input inputMode="decimal" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <label className={campo}>Nº de parcelas</label>
            <Input inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value)} />
          </div>
          <div>
            <label className={campo}>1ª parcela em % (entrada)</label>
            <Input inputMode="decimal" value={entradaPct} onChange={(e) => setEntradaPct(e.target.value)} placeholder="ex.: 30" />
          </div>
          <div>
            <label className={campo}>Dias entre parcelas</label>
            <Input inputMode="numeric" value={intervalo} onChange={(e) => setIntervalo(e.target.value)} />
          </div>
          <div>
            <label className={campo}>Data da 1ª parcela</label>
            <Input type="date" value={primeira} onChange={(e) => setPrimeira(e.target.value)} />
          </div>
          <div>
            <label className={campo}>Forma da entrada</label>
            <select className="h-9 w-full rounded border px-2 text-sm" value={formaEntrada} onChange={(e) => setFormaEntrada(e.target.value)}>
              {FORMAS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={campo}>Forma das demais</label>
            <select className="h-9 w-full rounded border px-2 text-sm" value={formaResto} onChange={(e) => setFormaResto(e.target.value)}>
              {FORMAS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className={campo}>Parcelas novas (pode ajustar cada uma)</label>
          {linhas.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-8 text-xs text-slate-500">{i + 1}ª</span>
              <Input type="date" className="w-40" value={l.vencimento} onChange={(e) => atualiza(i, { vencimento: e.target.value })} />
              <Input inputMode="decimal" className="w-32 text-right" value={l.valor} onChange={(e) => atualiza(i, { valor: e.target.value })} />
              <select className="h-9 rounded border px-2 text-sm" value={l.forma} onChange={(e) => atualiza(i, { forma: e.target.value })}>
                {FORMAS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
          ))}
          <p className={`text-xs ${confere ? 'text-emerald-700' : 'font-medium text-red-600'}`}>
            Antes {brl(total)} − desconto {brl(descontoNum)} = {brl(liquido)} · parcelas novas {brl(somaNova)}
            {confere ? ' ✓' : ' — a soma precisa fechar.'}
          </p>
        </div>

        <div className="space-y-1">
          <label className={campo}>Motivo do acordo *</label>
          <Textarea
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: cliente adiantou 30% no Pix; resto em 2 boletos iguais"
            disabled={saving}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={confirmar} disabled={saving || !motivo.trim() || !confere || semDatas}>
            {saving ? 'Criando...' : 'Confirmar acordo'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
