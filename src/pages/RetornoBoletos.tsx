import { useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Save, Search, History, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface RetornoRegistro {
  id: string
  nosso_numero: string
  valor_esperado: number | null
  valor_recebido: number | null
  data_pagamento: string | null
  ocorrencia_codigo: string | null
  status_aplicacao: 'aplicado' | 'divergente' | 'nao_encontrado' | 'ja_processado'
  motivo_divergencia: string | null
}

interface RetornoArquivo {
  id: string
  nome_arquivo: string
  processado_em: string
  total_registros: number
  total_aplicados: number
  total_divergentes: number
  total_nao_encontrados: number
  forcado: boolean
}

interface PendenteForcar {
  nomeArquivo: string
  hash: string
  conta: string
  registros: Array<{
    nosso_numero: string
    valor_recebido: number
    data_pagamento: string
    ocorrencia_codigo: string
  }>
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const STATUS_LABEL: Record<RetornoRegistro['status_aplicacao'], string> = {
  aplicado: 'Aplicado',
  divergente: 'Divergente',
  nao_encontrado: 'Não encontrado',
  ja_processado: 'Já processado',
}

export default function RetornoBoletos() {
  const { toast } = useToast()

  const [conta, setConta] = useState('BRADESCO LUCENERA')
  const [caminho, setCaminho] = useState('')

  const [records, setRecords] = useState<RetornoRegistro[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pendenteForcar, setPendenteForcar] = useState<PendenteForcar | null>(null)

  const [logOpen, setLogOpen] = useState(false)
  const [logLoading, setLogLoading] = useState(false)
  const [arquivos, setArquivos] = useState<RetornoArquivo[]>([])
  const [arquivoSelecionado, setArquivoSelecionado] = useState<string | null>(null)
  const [registrosArquivo, setRegistrosArquivo] = useState<RetornoRegistro[]>([])

  const aplicarRetorno = async (
    nomeArquivo: string,
    hash: string,
    registros: PendenteForcar['registros'],
    forcar: boolean,
  ) => {
    const { data, error } = await (supabase as any).rpc('processar_retorno_bancario', {
      p_nome_arquivo: nomeArquivo,
      p_hash: hash,
      p_conta: conta,
      p_registros: registros,
      p_forcar: forcar,
    })

    if (error) {
      if (!forcar && error.message?.includes('já foi processado')) {
        setPendenteForcar({ nomeArquivo, hash, conta, registros })
        return
      }
      toast({
        variant: 'destructive',
        title: 'Erro ao processar retorno',
        description: error.message,
      })
      return
    }

    const { data: registrosData, error: registrosError } = await supabase
      .from('retorno_bancario_registros')
      .select('*')
      .eq('arquivo_id', data.arquivo_id)
      .order('nosso_numero')

    if (registrosError) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar resultado',
        description: registrosError.message,
      })
      return
    }

    setRecords((registrosData || []) as RetornoRegistro[])
    setPendenteForcar(null)

    toast({
      title: 'Retorno processado',
      description: `${data.aplicados} aplicado(s), ${data.divergentes} divergente(s), ${data.nao_encontrados} não encontrado(s).`,
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const files = Array.from(e.target.files)
    setCaminho(files.map((f) => f.name).join('; '))

    try {
      const file = files[0]
      const text = await file.text()
      const { parseCnab400 } = await import('@/lib/cnab-parser')
      const cnabData = parseCnab400(text)

      if (cnabData.summary.fileType !== 'RETORNO') {
        toast({
          variant: 'destructive',
          title: 'Atenção',
          description: 'O arquivo não é de RETORNO.',
        })
        return
      }

      const registros = cnabData.records.map((r) => ({
        nosso_numero: r.nossoNumero,
        valor_recebido: r.valorRecebido ?? r.valor,
        data_pagamento: r.dataVencimento
          ? r.dataVencimento.split('/').reverse().join('-')
          : new Date().toISOString().split('T')[0],
        ocorrencia_codigo: r.ocorrencia,
      }))

      const hash = await sha256Hex(text)

      setIsProcessing(true)
      await aplicarRetorno(file.name, hash, registros, false)
      setIsProcessing(false)
    } catch (err: any) {
      setIsProcessing(false)
      toast({ variant: 'destructive', title: 'Erro de Leitura', description: err.message })
    }
  }

  const handleConfirmarForcar = async () => {
    if (!pendenteForcar) return
    setIsProcessing(true)
    await aplicarRetorno(
      pendenteForcar.nomeArquivo,
      pendenteForcar.hash,
      pendenteForcar.registros,
      true,
    )
    setIsProcessing(false)
  }

  const handleLocalizarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAbrirLog = async () => {
    setLogOpen(true)
    setLogLoading(true)
    setArquivoSelecionado(null)
    setRegistrosArquivo([])

    const { data, error } = await supabase
      .from('retorno_bancario_arquivos')
      .select('*')
      .order('processado_em', { ascending: false })
      .limit(50)

    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao carregar log', description: error.message })
    } else {
      setArquivos((data || []) as RetornoArquivo[])
    }
    setLogLoading(false)
  }

  const handleExpandirArquivo = async (arquivoId: string) => {
    setArquivoSelecionado(arquivoId)
    const { data, error } = await supabase
      .from('retorno_bancario_registros')
      .select('*')
      .eq('arquivo_id', arquivoId)
      .order('nosso_numero')

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar registros',
        description: error.message,
      })
      return
    }
    setRegistrosArquivo((data || []) as RetornoRegistro[])
  }

  const formatCurrency = (val: number | null) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val ?? 0)
  const formatDate = (d: string | null) => {
    if (!d) return ''
    const [year, month, day] = d.split('-')
    return `${day}/${month}/${year}`
  }

  const totais = useMemo(() => {
    return records.reduce(
      (acc, curr) => {
        acc.esperado += curr.valor_esperado ?? 0
        acc.recebido += curr.valor_recebido ?? 0
        return acc
      },
      { esperado: 0, recebido: 0 },
    )
  }, [records])

  const statusBadgeClass: Record<RetornoRegistro['status_aplicacao'], string> = {
    aplicado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    divergente: 'bg-amber-50 text-amber-700 border-amber-200',
    nao_encontrado: 'bg-rose-50 text-rose-700 border-rose-200',
    ja_processado: 'bg-slate-100 text-slate-600 border-slate-200',
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] w-full bg-slate-50 overflow-hidden text-sm">
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-800">Retorno de Boletos</h1>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".RET,.ret"
            onChange={handleFileChange}
          />
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
            onClick={handleLocalizarClick}
            disabled={isProcessing}
          >
            <Search className="h-4 w-4" />
            <span className="text-[10px]">Localizar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2 px-3 text-slate-600 hover:text-primary hover:bg-primary/5"
            onClick={handleAbrirLog}
          >
            <History className="h-4 w-4" />
            <span className="text-[10px]">Log</span>
          </Button>
        </div>
      </div>

      <div className="p-4 bg-slate-100/80 border-b shrink-0">
        <div className="font-semibold text-xs mb-3 text-slate-700">Conta</div>
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-1">
            <label className="text-[10px] text-slate-500 font-medium uppercase block mb-1">
              Código
            </label>
            <Input className="h-8 text-xs bg-white font-mono" value="2" readOnly />
          </div>
          <div className="col-span-3">
            <label className="text-[10px] text-slate-500 font-medium uppercase block mb-1">
              Conta
            </label>
            <Select value={conta} onValueChange={setConta}>
              <SelectTrigger className="h-8 text-xs bg-white font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRADESCO LUCENERA">BRADESCO LUCENERA</SelectItem>
                <SelectItem value="BRADESCO ISLIGHT">BRADESCO ISLIGHT</SelectItem>
                <SelectItem value="BRADESCO SLIDE">BRADESCO SLIDE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-8 flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 font-medium uppercase block mb-1">
                Arquivo
              </label>
              <Input
                className="h-8 text-xs bg-white text-slate-500 font-mono tracking-tight"
                value={caminho}
                readOnly
                placeholder="Nenhum arquivo carregado ainda"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 bg-white"
              onClick={handleLocalizarClick}
              disabled={isProcessing}
            >
              <span className="text-xs font-bold">...</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white relative">
        <Table className="w-full text-xs whitespace-nowrap">
          <TableHeader className="sticky top-0 bg-slate-100 z-10 shadow-sm border-b">
            <TableRow className="h-9">
              <TableHead className="p-2 font-medium">Nosso Nº</TableHead>
              <TableHead className="p-2 text-right font-medium">Valor Esperado</TableHead>
              <TableHead className="p-2 text-right font-medium">Valor Recebido</TableHead>
              <TableHead className="p-2 text-center font-medium">Pagamento</TableHead>
              <TableHead className="p-2 font-medium">Status</TableHead>
              <TableHead className="p-2 font-medium">Divergência</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-8 text-center text-muted-foreground">
                  {isProcessing
                    ? 'Processando arquivo...'
                    : 'Nenhum arquivo de retorno carregado ainda.'}
                </TableCell>
              </TableRow>
            ) : (
              records.map((r) => (
                <TableRow key={r.id} className="h-8 hover:bg-slate-50">
                  <TableCell className="p-2 border-r font-mono text-slate-600">
                    {r.nosso_numero}
                  </TableCell>
                  <TableCell className="p-2 text-right border-r font-mono">
                    {formatCurrency(r.valor_esperado)}
                  </TableCell>
                  <TableCell className="p-2 text-right border-r font-mono font-medium">
                    {formatCurrency(r.valor_recebido)}
                  </TableCell>
                  <TableCell className="p-2 text-center border-r">
                    {formatDate(r.data_pagamento)}
                  </TableCell>
                  <TableCell className="p-2 border-r">
                    <Badge variant="outline" className={statusBadgeClass[r.status_aplicacao]}>
                      {STATUS_LABEL[r.status_aplicacao]}
                    </Badge>
                  </TableCell>
                  <TableCell className="p-2 border-r text-slate-500">
                    {r.motivo_divergencia || '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="bg-slate-100/80 border-t p-4 text-xs shrink-0">
        <div className="grid grid-cols-2 gap-6 max-w-2xl">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
              Total Esperado
            </span>
            <div className="bg-white border rounded p-2 text-center shadow-sm font-mono text-sm text-slate-700">
              {formatCurrency(totais.esperado)}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
              Total Recebido
            </span>
            <div className="bg-white border rounded p-2 text-center shadow-sm font-mono text-sm font-semibold text-primary">
              {formatCurrency(totais.recebido)}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!pendenteForcar} onOpenChange={(open) => !open && setPendenteForcar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Arquivo já processado
            </DialogTitle>
            <DialogDescription>
              O arquivo <span className="font-mono">{pendenteForcar?.nomeArquivo}</span> já foi
              processado anteriormente (mesmo conteúdo). Reprocessar pode gerar baixa duplicada se
              isso não for intencional. Confirme apenas se você sabe que precisa corrigir algo deste
              arquivo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendenteForcar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmarForcar} disabled={isProcessing}>
              <Save className="h-4 w-4 mr-1" />
              Forçar reprocessamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log de arquivos processados</DialogTitle>
            <DialogDescription>Histórico de retornos bancários processados.</DialogDescription>
          </DialogHeader>

          {logLoading ? (
            <p className="text-sm text-muted-foreground py-4">Carregando...</p>
          ) : arquivos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum arquivo processado ainda.</p>
          ) : (
            <div className="space-y-2">
              {arquivos.map((a) => (
                <div key={a.id} className="border rounded">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50"
                    onClick={() => handleExpandirArquivo(a.id)}
                  >
                    <div>
                      <div className="font-medium text-sm">{a.nome_arquivo}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(a.processado_em).toLocaleString('pt-BR')}
                        {a.forcado && (
                          <Badge
                            variant="outline"
                            className="ml-2 bg-amber-50 text-amber-700 border-amber-200"
                          >
                            forçado
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        {a.total_aplicados} aplicado(s)
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-200"
                      >
                        {a.total_divergentes} divergente(s)
                      </Badge>
                      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                        {a.total_nao_encontrados} não encontrado(s)
                      </Badge>
                    </div>
                  </button>
                  {arquivoSelecionado === a.id && (
                    <div className="border-t p-2">
                      <Table className="text-xs">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nosso Nº</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Valor Recebido</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {registrosArquivo.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell className="font-mono">{r.nosso_numero}</TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={statusBadgeClass[r.status_aplicacao]}
                                >
                                  {STATUS_LABEL[r.status_aplicacao]}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(r.valor_recebido)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
