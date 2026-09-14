/**
 * Route tree.
 *
 * The previous SPA mounted `/admin/users` inside the user bundle (audit F12).
 * This app has NO admin surface at all — no route, no link, no admin API
 * import — so nothing admin-related ships to a user's browser.
 *
 * The `/a/:code` and `/s/:code` access-link routes belonged to the retired
 * "v2" compatibility contract (F16) and are intentionally absent.
 */

import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SessionProvider, useSession } from './session';
import { UserShell } from '../layouts/UserShell';
import { AuthShell, PublicShell } from '../layouts/PublicShell';
import { Spinner } from '../components/ui';

const Landing = lazy(() => import('../features/landing/LandingPage'));
const LoginPage = lazy(() => import('../features/auth/LoginPage'));
const RegisterPage = lazy(() => import('../features/auth/RegisterPage'));
const Dashboard = lazy(() => import('../features/dashboard/DashboardPage'));
const Markets = lazy(() => import('../features/markets/MarketsPage'));
const MarketDetail = lazy(() => import('../features/markets/MarketDetailPage'));
const Trade = lazy(() => import('../features/trading/TradePage'));
const Orders = lazy(() => import('../features/orders/OrdersPage'));
const Positions = lazy(() => import('../features/positions/PositionsPage'));
const Wallet = lazy(() => import('../features/wallet/WalletPage'));
const Earn = lazy(() => import('../features/earn/EarnPage'));
const Tasks = lazy(() => import('../features/tasks/TasksPage'));
const Credit = lazy(() => import('../features/credit/CreditPage'));
const Notifications = lazy(() => import('../features/notifications/NotificationsPage'));
const Support = lazy(() => import('../features/support/SupportPage'));
const Documents = lazy(() => import('../features/documents/DocumentsPage'));
const Nova = lazy(() => import('../features/nova/NovaPage'));
const Account = lazy(() => import('../features/account/AccountPage'));
const Settings = lazy(() => import('../features/account/SettingsPage'));

function RouteFallback() {
  return (
    <div className="empty" style={{ minHeight: '50dvh' }}>
      <Spinner size={22} />
      <span className="xs faint">Loading…</span>
    </div>
  );
}

/** Redirects to sign-in when there is no session, preserving the target. */
function RequireSession({ children }: { children: ReactNode }) {
  const { token, booting } = useSession();
  const location = useLocation();

  if (booting) return <RouteFallback />;
  if (!token) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <UserShell>{children}</UserShell>;
}

function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { token, booting } = useSession();
  if (booting) return <RouteFallback />;
  if (token) return <Navigate to="/dashboard" replace />;
  return <AuthShell>{children}</AuthShell>;
}

export function AppRouter() {
  return (
    <SessionProvider>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            path="/"
            element={
              <PublicShell>
                <Landing />
              </PublicShell>
            }
          />

          <Route
            path="/auth/login"
            element={
              <RedirectIfSignedIn>
                <LoginPage />
              </RedirectIfSignedIn>
            }
          />
          <Route
            path="/auth/register"
            element={
              <RedirectIfSignedIn>
                <RegisterPage />
              </RedirectIfSignedIn>
            }
          />

          <Route path="/dashboard" element={<RequireSession><Dashboard /></RequireSession>} />
          <Route path="/markets" element={<RequireSession><Markets /></RequireSession>} />
          <Route path="/markets/:symbol" element={<RequireSession><MarketDetail /></RequireSession>} />
          <Route path="/trade" element={<RequireSession><Trade /></RequireSession>} />
          <Route path="/trade/:symbol" element={<RequireSession><Trade /></RequireSession>} />
          <Route path="/orders" element={<RequireSession><Orders /></RequireSession>} />
          <Route path="/positions" element={<RequireSession><Positions /></RequireSession>} />
          <Route path="/wallet" element={<RequireSession><Wallet /></RequireSession>} />
          <Route path="/earn" element={<RequireSession><Earn /></RequireSession>} />
          <Route path="/tasks" element={<RequireSession><Tasks /></RequireSession>} />
          <Route path="/credit" element={<RequireSession><Credit /></RequireSession>} />
          <Route path="/notifications" element={<RequireSession><Notifications /></RequireSession>} />
          <Route path="/support" element={<RequireSession><Support /></RequireSession>} />
          <Route path="/documents" element={<RequireSession><Documents /></RequireSession>} />
          <Route path="/nova" element={<RequireSession><Nova /></RequireSession>} />
          <Route path="/account" element={<RequireSession><Account /></RequireSession>} />
          <Route path="/settings" element={<RequireSession><Settings /></RequireSession>} />

          {/* Legacy paths from the previous SPA, redirected rather than 404'd. */}
          <Route path="/login" element={<Navigate to="/auth/login" replace />} />
          <Route path="/market" element={<Navigate to="/markets" replace />} />
          <Route path="/trading" element={<Navigate to="/trade" replace />} />
          <Route path="/instant-order" element={<Navigate to="/trade" replace />} />
          <Route path="/deposit" element={<Navigate to="/wallet" replace />} />
          <Route path="/profile" element={<Navigate to="/account" replace />} />
          <Route path="/community" element={<Navigate to="/support" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </SessionProvider>
  );
}
