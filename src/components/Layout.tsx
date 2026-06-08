import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { ArrowLeftRight, LayoutDashboard, FileUp, Settings } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function Layout() {
  const location = useLocation()

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50">
        <Sidebar variant="sidebar" className="border-r border-slate-200">
          <SidebarHeader className="h-16 flex items-center px-6 border-b border-slate-200">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <div className="bg-primary text-white p-1.5 rounded-md">
                <ArrowLeftRight className="h-4 w-4" />
              </div>
              <span>SkipBank Pro</span>
            </div>
          </SidebarHeader>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b bg-white flex items-center justify-between px-4 sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-lg font-semibold tracking-tight text-slate-800">
                Sistema de Conciliação Bancária
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm text-right hidden sm:block">
                <p className="font-medium text-slate-700 leading-none">Financeiro Admin</p>
                <p className="text-xs text-muted-foreground mt-1">Conta Principal</p>
              </div>
              <Avatar className="h-9 w-9 border border-slate-200 shadow-sm">
                <AvatarImage
                  src="https://img.usecurling.com/ppl/thumbnail?gender=female&seed=1"
                  alt="Usuário"
                />
                <AvatarFallback>FA</AvatarFallback>
              </Avatar>
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden p-6 pb-24 max-w-7xl mx-auto w-full">
            <Outlet />
          </main>

          <footer className="h-14 border-t bg-white flex items-center justify-between px-6 text-xs text-muted-foreground mt-auto">
            <p>© 2026 SkipBank SA. Todos os direitos reservados.</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span>Sistema Operacional v0.0.1</span>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  )
}
