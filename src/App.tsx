import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import Index from './pages/Index'
import BoletosPage from './pages/Boletos'
import RemessaPage from './pages/Remessa'
import NotasFiscaisPage from './pages/NotasFiscais'
import ConsultarDuplicatas from './pages/ConsultarDuplicatas'
import BaixarDuplicata from './pages/BaixarDuplicata'
import CadastrarDuplicata from './pages/CadastrarDuplicata'
import RetornoBoletos from './pages/RetornoBoletos'
import NotFound from './pages/NotFound'
import Login from './pages/Login'
import Layout from './components/Layout'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, hasAccess, loading } = useAuth()
  if (loading)
    return <div className="h-screen w-screen flex items-center justify-center">Carregando...</div>
  if (!user) return <Navigate to="/login" replace />
  if (hasAccess === false) {
    return (
      <div className="h-screen w-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-3">
          <h1 className="text-lg font-semibold">Acesso negado</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta não tem permissão para acessar a Administração Bancária. Fale com um
            administrador se acredita que isso é um engano.
          </p>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/duplicatas" replace />} />
        <Route path="/duplicatas" element={<ConsultarDuplicatas />} />
        <Route path="/baixar-duplicata" element={<BaixarDuplicata />} />
        <Route path="/cadastrar-duplicata" element={<CadastrarDuplicata />} />
        <Route path="/retorno-boletos" element={<RetornoBoletos />} />
        <Route path="/antigo-retorno" element={<Index />} />
        <Route path="/boletos" element={<BoletosPage />} />
        <Route path="/remessa" element={<RemessaPage />} />
        <Route path="/notas-fiscais" element={<NotasFiscaisPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

const App = () => (
  <AuthProvider>
    <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppRoutes />
      </TooltipProvider>
    </BrowserRouter>
  </AuthProvider>
)

export default App
