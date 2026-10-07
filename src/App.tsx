import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import Layout from './components/Layout'

// SPEC-123: code-splitting por rota (mesmo padrão já em produção no RH,
// dashboard-rh-lucenera-5fe9c/src/App.tsx).
const Index = lazy(() => import('./pages/Index'))
const BoletosPage = lazy(() => import('./pages/Boletos'))
const RemessaPage = lazy(() => import('./pages/Remessa'))
const NotasFiscaisPage = lazy(() => import('./pages/NotasFiscais'))
const ConsultarDuplicatas = lazy(() => import('./pages/ConsultarDuplicatas'))
const ContasEmAberto = lazy(() => import('./pages/ContasEmAberto'))
const BaixarDuplicata = lazy(() => import('./pages/BaixarDuplicata'))
const CadastrarDuplicata = lazy(() => import('./pages/CadastrarDuplicata'))
const RetornoBoletos = lazy(() => import('./pages/RetornoBoletos'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Login = lazy(() => import('./pages/Login'))

const LoadingFallback = () => (
  <div className="h-screen w-screen flex items-center justify-center">
    <div className="animate-pulse text-muted-foreground">Carregando...</div>
  </div>
)

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
    <Suspense fallback={<LoadingFallback />}>
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
          <Route path="/contas-em-aberto" element={<ContasEmAberto />} />
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
    </Suspense>
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
