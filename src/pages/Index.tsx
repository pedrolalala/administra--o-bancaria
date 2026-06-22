import { useState, useCallback, useMemo, useEffect } from 'react'
import { UploadZone } from '@/components/cnab/UploadZone'
import { SummaryCards } from '@/components/cnab/SummaryCards'
import { DataTable } from '@/components/cnab/DataTable'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { CnabData } from '@/types/cnab'
import { parseCnab400 } from '@/lib/cnab-parser'
import { CheckCircle, AlertCircle, FileUp } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase/client'

export default function Index() {
  const { toast } = useToast()

  const [data, setData] = useState<CnabData | null>(null)
  const [currentFileName, setCurrentFileName] = useState<string | null>(null)

  const [empresas, setEmpresas] = useState<any[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')

  const selectedCompany = useMemo(
    () => empresas.find((e) => e.id === selectedCompanyId) || null,
    [empresas, selectedCompanyId],
  )

  const [validationError, setValidationError] = useState<string | null>(null)

  const [exceptions, setExceptions] = useState<{ nossoNumero: string; tipo: string }[]>([])
  const [processSuccess, setProcessSuccess] = useState<{
    liquidacoes: number
    confirmacoes: number
    importados?: number
  } | null>(null)

  const [isAlreadyProcessedState, setIsAlreadyProcessedState] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    supabase
      .from('empresas')
      .select('id, nome, cnpj')
      .order('nome')
      .then(({ data }) => {
        if (data) setEmpresas(data)
      })
  }, [])

  useEffect(() => {
    if (currentFileName && selectedCompany) {
      supabase
        .from('retornos_processados')
        .select('id')
        .eq('nome_arquivo', currentFileName)
        .eq('empresa_id', selectedCompany.id)
        .maybeSingle()
        .then(({ data }) => {
          setIsAlreadyProcessedState(!!data)
        })
    } else {
      setIsAlreadyProcessedState(false)
    }
  }, [currentFileName, selectedCompany])

  const canProcess = useMemo(() => {
    return (
      !isAlreadyProcessedState &&
      !processSuccess &&
      selectedCompany &&
      !validationError &&
      data &&
      !isProcessing
    )
  }, [
    isAlreadyProcessedState,
    processSuccess,
    selectedCompany,
    validationError,
    data,
    isProcessing,
  ])

  const handleProcessFile = useCallback(
    (content: string, fileName: string) => {
      try {
        const parsed = parseCnab400(content)
        setData(parsed)
        setCurrentFileName(fileName)
        setExceptions([])
        setProcessSuccess(null)
        setValidationError(null)

        if (selectedCompany) {
          toast({
            title: 'Arquivo lido com sucesso',
            description: `${selectedCompany.nome} - ${parsed.records.length} registros (${parsed.summary.fileType}).`,
          })
        }
      } catch (error: any) {
        setValidationError(error.message || 'Erro ao processar o arquivo CNAB.')
        setData(null)
        setProcessSuccess(null)
        setExceptions([])
        setCurrentFileName(null)
      }
    },
    [toast, selectedCompany],
  )

  const handleError = useCallback(
    (msg: string) => {
      toast({
        variant: 'destructive',
        title: 'Atenção',
        description: msg,
      })
    },
    [toast],
  )

  const formatToDateDb = (d: string) => {
    if (!d || d.length !== 10) return null
    const [day, month, year] = d.split('/')
    if (day && month && year) return `${year}-${month}-${day}`
    return null
  }

  const handleImportarRemessa = useCallback(async () => {
    if (!currentFileName || isAlreadyProcessedState || !selectedCompany || !data) return
    setIsProcessing(true)

    try {
      const recordsToInsert = data.records.map((r) => ({
        nosso_numero: r.nossoNumero,
        numero_documento: r.nf || null,
        valor: r.valor,
        vencimento: formatToDateDb(r.dataVencimento),
        nome_pagador: r.pagador,
        status: 'Pendente',
        tipo: 'Normal',
        empresa_id: selectedCompany.id,
      }))

      const { error } = await supabase
        .from('boletos')
        .upsert(recordsToInsert, { onConflict: 'nosso_numero', ignoreDuplicates: true })

      if (error) {
        throw error
      }

      await supabase.from('retornos_processados').insert([
        {
          nome_arquivo: currentFileName,
          empresa_id: selectedCompany.id,
          processado: true,
        },
      ])

      setProcessSuccess({ liquidacoes: 0, confirmacoes: 0, importados: recordsToInsert.length })
      setIsAlreadyProcessedState(true)

      toast({
        title: 'Importação concluída',
        description: `Foram importados os títulos da remessa com sucesso.`,
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao importar remessa',
        description: err.message || 'Erro inesperado.',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [currentFileName, isAlreadyProcessedState, data, selectedCompany, toast])

  const handleConfirmarBaixa = useCallback(async () => {
    if (!currentFileName || isAlreadyProcessedState || !selectedCompany || !data) return
    setIsProcessing(true)
    try {
      let liquidacoesProcessed = 0
      let confirmacoesProcessed = 0
      const newExceptions: { nossoNumero: string; tipo: string }[] = []

      const { data: existingBoletos } = await supabase
        .from('boletos')
        .select('id, nosso_numero')
        .eq('empresa_id', selectedCompany.id)

      for (const record of data.records) {
        const boleto = existingBoletos?.find((b) => b.nosso_numero === record.nossoNumero)

        if (record.tipo === 'Liquidado') {
          if (boleto) {
            await supabase
              .from('boletos')
              .update({
                status: 'Pago',
                data_pagamento: new Date().toISOString().split('T')[0],
                valor_pago: record.valorRecebido,
              })
              .eq('id', boleto.id)
            liquidacoesProcessed++
          } else {
            newExceptions.push({ nossoNumero: record.nossoNumero, tipo: 'Liquidação' })
          }
        } else if (record.tipo === 'Confirmado') {
          if (boleto) {
            await supabase
              .from('boletos')
              .update({
                status: 'Registrado',
              })
              .eq('id', boleto.id)
            confirmacoesProcessed++
          } else {
            newExceptions.push({ nossoNumero: record.nossoNumero, tipo: 'Confirmação' })
          }
        }
      }

      await supabase.from('retornos_processados').insert([
        {
          nome_arquivo: currentFileName,
          empresa_id: selectedCompany.id,
          quantidade_liquidacoes: liquidacoesProcessed,
          quantidade_confirmacoes: confirmacoesProcessed,
          processado: true,
        },
      ])

      setProcessSuccess({ liquidacoes: liquidacoesProcessed, confirmacoes: confirmacoesProcessed })
      setExceptions(newExceptions)
      setIsAlreadyProcessedState(true)

      toast({
        title: 'Baixa concluída',
        description: `Processamento finalizado com sucesso.`,
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao processar retorno',
        description: err.message || 'Erro inesperado.',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [currentFileName, isAlreadyProcessedState, data, selectedCompany, toast])

  const isRemessa = data?.summary.fileType === 'REMESSA'
  const handleProcessAction = isRemessa ? handleImportarRemessa : handleConfirmarBaixa

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-20 p-6 w-full max-w-4xl mx-auto">
      <section className="flex flex-col gap-2 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Retorno Bancário Bradesco</h2>
        <p className="text-muted-foreground mx-auto max-w-2xl">
          Selecione a empresa e faça o upload do arquivo de remessa ou retorno do Bradesco (CNAB
          400).
        </p>
      </section>

      <div className="space-y-8 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col gap-3">
          <Label htmlFor="company-select" className="text-sm font-semibold text-slate-700">
            Empresa <span className="text-red-500">*</span>
          </Label>
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger id="company-select" className="w-full">
              <SelectValue placeholder="Selecione uma empresa" />
            </SelectTrigger>
            <SelectContent>
              {empresas.map((empresa) => (
                <SelectItem key={empresa.id} value={empresa.id}>
                  {empresa.nome} - {empresa.cnpj || 'Sem CNPJ'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <UploadZone
          onFileProcess={handleProcessFile}
          onError={handleError}
          companySelected={!!selectedCompanyId}
        />

        {validationError && (
          <Alert
            variant="destructive"
            className="animate-slide-down border-red-200 bg-red-50 text-red-900"
          >
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle>Erro no Arquivo</AlertTitle>
            <AlertDescription className="text-red-800">{validationError}</AlertDescription>
          </Alert>
        )}

        {isAlreadyProcessedState && selectedCompany && !processSuccess && (
          <Alert variant="destructive" className="animate-slide-down">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Arquivo já processado</AlertTitle>
            <AlertDescription>
              O arquivo <strong>{currentFileName}</strong> já foi processado anteriormente para a
              empresa selecionada. A ação não pode ser realizada novamente para o mesmo arquivo.
            </AlertDescription>
          </Alert>
        )}

        {processSuccess && (
          <div className="space-y-4 animate-fade-in-up">
            <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="text-emerald-900 font-semibold">Operação Concluída</AlertTitle>
              <AlertDescription className="text-emerald-700/90">
                {isRemessa
                  ? `Foram importados os títulos da remessa com sucesso.`
                  : `Baixa confirmada com ${processSuccess.liquidacoes} liquidações e ${processSuccess.confirmacoes} confirmações.`}
              </AlertDescription>
            </Alert>

            {exceptions.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Exceções Encontradas ({exceptions.length})</AlertTitle>
                <AlertDescription className="mt-2">
                  <p className="mb-2">
                    Os seguintes títulos foram encontrados no arquivo, mas não existem no banco de
                    dados para a empresa selecionada:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    {exceptions.map((ex, i) => (
                      <li key={i}>
                        Título <strong>{ex.nossoNumero}</strong> - {ex.tipo}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {data && !validationError && (
          <div className="space-y-6 animate-fade-in-up pt-4">
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileUp className="h-5 w-5 text-primary" />
                Resumo do Arquivo {selectedCompany ? `- ${selectedCompany.nome}` : ''}
              </h3>
              <SummaryCards summary={data.summary} />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Detalhamento de Títulos</h3>
              <DataTable
                records={data.records}
                empresaNome={selectedCompany?.nome}
                fileType={data.summary.fileType}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Footer Bar */}
      {data && !validationError && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
          <div className="max-w-4xl mx-auto w-full flex justify-end">
            <Button
              size="lg"
              disabled={!canProcess}
              onClick={handleProcessAction}
              className="font-semibold shadow-sm w-full sm:w-auto"
            >
              {isProcessing
                ? 'Processando...'
                : isRemessa
                  ? `Importar Remessa (${data.summary.totalRegistros} Títulos)`
                  : `Confirmar Baixa de ${data.summary.totalLiquidacoes} Títulos`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
