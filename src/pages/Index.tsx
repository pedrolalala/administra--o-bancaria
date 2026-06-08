import { useState } from 'react'
import { UploadZone } from '@/components/cnab/UploadZone'
import { SummaryCards } from '@/components/cnab/SummaryCards'
import { DataTable } from '@/components/cnab/DataTable'
import { BoletosTable } from '@/components/cnab/BoletosTable'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { CnabData } from '@/types/cnab'
import { mockCnabData } from '@/lib/mock-data'
import { parseCnab400 } from '@/lib/cnab-parser'
import { Info, CheckCircle, AlertCircle, Database } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import useDatabaseStore from '@/stores/main'

export default function Index() {
  const { toast } = useToast()
  const db = useDatabaseStore()

  const [data, setData] = useState<CnabData>(mockCnabData)
  const [isDemo, setIsDemo] = useState(true)
  const [currentFileName, setCurrentFileName] = useState<string | null>('RETORNO_DEMO_01.RET')

  const [exceptions, setExceptions] = useState<{ nossoNumero: string; tipo: string }[]>([])
  const [processSuccess, setProcessSuccess] = useState<{
    liquidacoes: number
    confirmacoes: number
  } | null>(null)

  const isAlreadyProcessed = currentFileName ? db.checkArquivoProcessado(currentFileName) : false
  const canProcess = !isAlreadyProcessed && !processSuccess

  const handleProcessFile = (content: string, fileName: string) => {
    try {
      const parsed = parseCnab400(content)
      setData(parsed)
      setIsDemo(false)
      setCurrentFileName(fileName)
      setExceptions([])
      setProcessSuccess(null)

      toast({
        title: 'Arquivo processado',
        description: `${parsed.records.length} registros encontrados em ${fileName}.`,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro de Processamento',
        description:
          'Não foi possível extrair os dados. Verifique se o arquivo segue o layout Bradesco CNAB 400.',
      })
    }
  }

  const handleError = (msg: string) => {
    toast({
      variant: 'destructive',
      title: 'Erro no Arquivo',
      description: msg,
    })
  }

  const handleConfirmarBaixa = () => {
    if (!currentFileName || isAlreadyProcessed) return

    let liquidacoesProcessed = 0
    let confirmacoesProcessed = 0
    const newExceptions: { nossoNumero: string; tipo: string }[] = []

    for (const record of data.records) {
      if (record.tipo === 'Liquidado') {
        const success = db.updateBoleto(record.nossoNumero, {
          status: 'Pago',
          data_liquidacao: record.data,
          valor_recebido: record.valor,
        })
        if (success) {
          liquidacoesProcessed++
        } else {
          newExceptions.push({ nossoNumero: record.nossoNumero, tipo: 'Liquidação' })
        }
      } else if (record.tipo === 'Confirmado') {
        const success = db.updateBoleto(record.nossoNumero, {
          status: 'Registrado',
        })
        if (success) {
          confirmacoesProcessed++
        } else {
          newExceptions.push({ nossoNumero: record.nossoNumero, tipo: 'Confirmação' })
        }
      }
    }

    db.addRetorno({
      id: crypto.randomUUID(),
      nome_arquivo: currentFileName,
      data_upload: new Date().toISOString(),
      empresa_id: 'emp1',
      quantidade_liquidacoes: liquidacoesProcessed,
      quantidade_confirmacoes: confirmacoesProcessed,
      processado: true,
    })

    setProcessSuccess({ liquidacoes: liquidacoesProcessed, confirmacoes: confirmacoesProcessed })
    setExceptions(newExceptions)

    toast({
      title: 'Baixa concluída',
      description: `Processamento finalizado com sucesso.`,
    })
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-20">
      <section className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Retorno Bancário</h2>
        <p className="text-muted-foreground max-w-3xl">
          Faça o upload do arquivo de retorno do Bradesco (CNAB 400) para visualizar as liquidações
          e confirmações de registro. O sistema sincroniza automaticamente os status dos boletos no
          banco de dados.
        </p>
      </section>

      <Tabs defaultValue="process" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="process" className="flex gap-2">
            <CheckCircle className="h-4 w-4" /> Processar Retorno
          </TabsTrigger>
          <TabsTrigger value="database" className="flex gap-2">
            <Database className="h-4 w-4" /> Banco de Dados (Boletos)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="process" className="space-y-8">
          <UploadZone onFileProcess={handleProcessFile} onError={handleError} />

          {isDemo && (
            <Alert className="bg-sky-50 border-sky-200 text-sky-800 animate-slide-down">
              <Info className="h-4 w-4 text-sky-600" />
              <AlertTitle className="text-sky-900 font-semibold">Modo de Demonstração</AlertTitle>
              <AlertDescription className="text-sky-700/90">
                Os dados exibidos abaixo são um exemplo para demonstrar a interface. Você pode
                testar a "Confirmação de Baixa" agora mesmo para ver como o banco de dados é
                atualizado e as exceções são tratadas.
              </AlertDescription>
            </Alert>
          )}

          {isAlreadyProcessed && (
            <Alert variant="destructive" className="animate-slide-down">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Arquivo já processado</AlertTitle>
              <AlertDescription>
                O arquivo <strong>{currentFileName}</strong> já foi processado anteriormente. A
                baixa de títulos não pode ser realizada novamente para o mesmo arquivo.
              </AlertDescription>
            </Alert>
          )}

          {processSuccess && (
            <div className="space-y-4 animate-fade-in-up">
              <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <AlertTitle className="text-emerald-900 font-semibold">
                  Processamento Concluído
                </AlertTitle>
                <AlertDescription className="text-emerald-700/90">
                  Baixa confirmada com {processSuccess.liquidacoes} liquidações e{' '}
                  {processSuccess.confirmacoes} confirmações.
                </AlertDescription>
              </Alert>

              {exceptions.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Exceções Encontradas ({exceptions.length})</AlertTitle>
                  <AlertDescription className="mt-2">
                    <p className="mb-2">
                      Os seguintes títulos foram encontrados no arquivo, mas não existem no banco de
                      dados:
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
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

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                Resumo Financeiro
              </h3>
              <SummaryCards summary={data.summary} />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Detalhamento de Títulos</h3>
              <DataTable records={data.records} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
            <h3 className="text-lg font-semibold">Tabela de Boletos</h3>
            <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
              Simulação de banco de dados em tempo real
            </span>
          </div>
          <BoletosTable />
        </TabsContent>
      </Tabs>

      {/* Action Footer Bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[16rem] p-4 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 flex justify-end">
        <Button
          size="lg"
          disabled={!canProcess}
          onClick={handleConfirmarBaixa}
          className="font-semibold shadow-sm w-full sm:w-auto"
        >
          Confirmar Baixa de {data.summary.totalLiquidacoes} Títulos
        </Button>
      </div>
    </div>
  )
}
