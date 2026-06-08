import { Outlet } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { FileUp, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'

export default function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-screen w-full bg-slate-50 flex-col">
      <header className="h-16 border-b bg-white flex items-center justify-center px-6 sticky top-0 z-10 shadow-sm relative">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <FileUp className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Lucenera</h1>
        </div>

        <div className="absolute right-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden p-6 pb-24 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>

      <footer className="h-14 border-t bg-white flex items-center justify-between px-6 text-xs text-muted-foreground mt-auto">
        <p>© {new Date().getFullYear()} Lucenera. Todos os direitos reservados.</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span>Sistema Operacional</span>
        </div>
      </footer>
    </div>
  )
}
