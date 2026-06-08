import { useState, useRef, ChangeEvent, DragEvent } from 'react'
import { UploadCloud, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadZoneProps {
  onFileProcess: (content: string, fileName: string) => void
  onError: (msg: string) => void
  companySelected: boolean
}

export function UploadZone({ onFileProcess, onError, companySelected }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const checkCompanySelected = () => {
    if (!companySelected) {
      onError('Selecione uma empresa antes de enviar o arquivo')
      return false
    }
    return true
  }

  const handleFile = (file: File) => {
    if (!checkCompanySelected()) return

    const upperName = file.name.toUpperCase()
    if (!upperName.endsWith('.RET') && !upperName.endsWith('.TXT') && !upperName.endsWith('.REM')) {
      onError('Formato de arquivo inválido. Por favor, envie um arquivo .RET, .TXT ou .REM.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      if (!content || content.length < 400) {
        onError('O arquivo não parece ser um padrão CNAB 400 válido.')
        return
      }
      setFileName(file.name)
      onFileProcess(content, file.name)
    }
    reader.onerror = () => onError('Erro ao ler o arquivo.')
    reader.readAsText(file, 'ISO-8859-1') // Most Brazilian bank files use ISO-8859-1
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0])
    }
    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    if (!checkCompanySelected()) return
    fileInputRef.current?.click()
  }

  return (
    <div
      className={cn(
        'relative group cursor-pointer flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-all duration-300 bg-card',
        isDragging
          ? 'border-primary bg-primary/5 scale-[1.01]'
          : 'border-border hover:border-primary/50 hover:bg-slate-50',
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={handleClick}
    >
      <input
        type="file"
        accept=".ret,.txt,.rem"
        className="hidden"
        ref={fileInputRef}
        onChange={onInputChange}
      />

      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform duration-300">
        {fileName ? <FileText className="h-8 w-8" /> : <UploadCloud className="h-8 w-8" />}
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-1 text-center">
        {fileName ? `Arquivo: ${fileName}` : 'Clique ou arraste um arquivo'}
      </h3>

      <p className="text-sm text-muted-foreground text-center max-w-sm">
        {fileName
          ? 'Clique para carregar um arquivo diferente'
          : 'Selecione um arquivo de retorno Bradesco CNAB 400 (.RET, .TXT ou .REM)'}
      </p>
    </div>
  )
}
