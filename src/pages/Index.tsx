import { useState } from 'react'
import { UploadZone } from '@/components/cnab/UploadZone'
import { SummaryCards } from '@/components/cnab/SummaryCards'
import { DataTable } from '@/components/cnab/DataTable'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { CnabData } from '@/types/cnab'
import { mockCnabData } from '@/lib/mock-data'
import { parseCnab400 } from '@/lib/cnab-parser'
import { Info, CheckCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function Index() {
  const { toast } = useToast()
  const [data, setData] = useState<CnabData>(mockCnabData)
  const [isDemo, setIsDemo] = useState(true)

  const handleProcessFile = (content: string, fileName: string) => {
    try {
      const parsed = parseCnab400(content)
      setData(parsed)
      setIsDemo(false)

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

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <section className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Retorno Bancário</h2>
        <p className="text-muted-foreground max-w-3xl">
          Faça o upload do arquivo de retorno do Bradesco (CNAB 400) para visualizar as liquidações
          e confirmações de registro. O sistema extrai os dados posicionalmente de forma segura no
          seu navegador.
        </p>
      </section>

      <section className="grid gap-8">
        <UploadZone onFileProcess={handleProcessFile} onError={handleError} />

        {isDemo && (
          <Alert className="bg-sky-50 border-sky-200 text-sky-800 animate-slide-down">
            <Info className="h-4 w-4 text-sky-600" />
            <AlertTitle className="text-sky-900 font-semibold">Modo de Demonstração</AlertTitle>
            <AlertDescription className="text-sky-700/90">
              Os dados exibidos abaixo são um exemplo para demonstrar a interface. Faça o upload de
              um arquivo real para analisar seus dados.
            </AlertDescription>
          </Alert>
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
      </section>

      {/* Action Footer Bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[16rem] p-4 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 flex justify-end">
        <Button size="lg" disabled className="font-semibold shadow-sm w-full sm:w-auto">
          Confirmar Baixa de {data.summary.totalLiquidacoes} Títulos
        </Button>
      </div>
    </div>
  )
}
