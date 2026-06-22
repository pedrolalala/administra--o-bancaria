import { Outlet, Link, useLocation } from 'react-router-dom'
import { FileUp, LogOut, Menu } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

export default function Layout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const pathname = location.pathname

  const navLinks = [
    { name: 'Retorno Bancário', path: '/' },
    { name: 'Controle de Boletos', path: '/boletos' },
    { name: 'Gerar Remessa', path: '/remessa' },
    { name: 'Notas Fiscais', path: '/notas-fiscais' },
  ]

  return (
    <div className="flex min-h-screen w-full bg-slate-50 flex-col">
      <header className="h-16 border-b bg-white flex items-center px-6 sticky top-0 z-10 shadow-sm relative">
        <div className="flex items-center gap-3 md:w-auto w-full justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <FileUp className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Lucenera</h1>
          </div>
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[240px] sm:w-[300px]">
                <nav className="flex flex-col gap-4 mt-8">
                  {navLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={cn(
                        'text-sm font-medium transition-colors hover:text-primary',
                        pathname === link.path ? 'text-primary font-semibold' : 'text-slate-500',
                      )}
                    >
                      {link.name}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 ml-10">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                pathname === link.path
                  ? 'text-primary font-semibold border-b-2 border-primary h-16 flex items-center'
                  : 'text-slate-500',
              )}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        <div className="absolute right-6 flex items-center gap-4 hidden md:flex">
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
