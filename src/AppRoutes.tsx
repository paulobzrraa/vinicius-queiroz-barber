import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'

import { App } from '@/App'
import { DevEnvBanner } from '@/components/DevEnvBanner'
import { InstallPrompt } from '@/components/InstallPrompt'

// O admin (formulários, upload, etc.) só é baixado por quem visita /admin —
// a landing page não carrega esse código à toa (ver aviso de chunk grande).
const AdminDashboard = lazy(() =>
  import('@/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
)
const AdminLogin = lazy(() => import('@/admin/AdminLogin').then((m) => ({ default: m.AdminLogin })))
const RequireAuth = lazy(() =>
  import('@/admin/RequireAuth').then((m) => ({ default: m.RequireAuth })),
)

// O fluxo de agendamento próprio (BL-064) também é code-split: só quem
// realmente vai marcar um horário baixa esse bundle.
const BookingPage = lazy(() =>
  import('@/booking/BookingPage').then((m) => ({ default: m.BookingPage })),
)
const AppointmentLookupPage = lazy(() =>
  import('@/booking/AppointmentLookupPage').then((m) => ({ default: m.AppointmentLookupPage })),
)

const BookingConfirmedPage = lazy(() =>
  import('@/booking/BookingConfirmedPage').then((m) => ({ default: m.BookingConfirmedPage })),
)
const MyAppointmentsPage = lazy(() =>
  import('@/booking/MyAppointmentsPage').then((m) => ({ default: m.MyAppointmentsPage })),
)

function RouteFallback() {
  return <div className="flex min-h-dvh items-center justify-center text-muted">Carregando…</div>
}

export function AppRoutes() {
  const { pathname } = useLocation()

  return (
    <>
      <DevEnvBanner />
      {/* Convite para a tela inicial no celular, em todo o site público (o painel do admin fica de fora). */}
      {!pathname.startsWith('/admin') && <InstallPrompt />}
      <Routes>
        <Route path="/" element={<App />} />
        <Route
          path="/agendar"
          element={
            <Suspense fallback={<RouteFallback />}>
              <BookingPage />
            </Suspense>
          }
        />
        <Route
          path="/agendar/confirmado/:token"
          element={
            <Suspense fallback={<RouteFallback />}>
              <BookingConfirmedPage />
            </Suspense>
          }
        />
        <Route
          path="/agendamento/:token"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AppointmentLookupPage />
            </Suspense>
          }
        />
        <Route
          path="/meus-agendamentos"
          element={
            <Suspense fallback={<RouteFallback />}>
              <MyAppointmentsPage />
            </Suspense>
          }
        />
        <Route
          path="/admin/login"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AdminLogin />
            </Suspense>
          }
        />
        <Route
          element={
            <Suspense fallback={<RouteFallback />}>
              <RequireAuth />
            </Suspense>
          }
        >
          <Route
            path="/admin"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AdminDashboard />
              </Suspense>
            }
          />
          <Route
            path="/admin/:section"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AdminDashboard />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </>
  )
}
