import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppProvider, useApp } from './app-context';
import { MarketProvider } from './market-context';
import {
  AuthModal,
  ContactButton,
  ConversionModal,
  SiteFooter,
  SiteHeader,
  ToastStack,
} from './components';
import Home from './Home';
// NOVA is intentionally not a polling surface: it fetches its status the
// first time the panel is opened and answers only on user messages.
import { NovaChat } from './NovaChat';

// ---- Perf: route-level code splitting -------------------------------------
// The initial bundle ships only the landing/login/dashboard shell. Every
// student route below (and the jsPDF stack it carries) is a lazy chunk that
// the browser fetches when the route is actually opened.
const Market = lazy(() => import('./Market'));
const InstantOrder = lazy(() => import('./InstantOrder'));
const Deposit = lazy(() => import('./Deposit'));
const TasksPage = lazy(() => import('./TasksPage'));
const OrdersPage = lazy(() => import('./OrdersPage'));
const ProfilePage = lazy(() => import('./AccountPages').then((m) => ({ default: m.ProfilePage })));
const WalletPage = lazy(() => import('./AccountPages').then((m) => ({ default: m.WalletPage })));
const SupportPage = lazy(() => import('./AccountPages').then((m) => ({ default: m.SupportPage })));
const CommunityPage = lazy(() => import('./AccountPages').then((m) => ({ default: m.CommunityPage })));
const AdminUsersPage = lazy(() => import('./AdminUsersPage'));

function RouteFallback() {
  return (
    <main className="route-fallback" role="status" aria-label="Loading page">
      <span className="route-fallback-dot" />
    </main>
  );
}

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);
  return null;
}

/**
 * Warm the cache for the pages a student is most likely to open next, but
 * only when the main thread is idle — parsing these chunks must never
 * compete with the first paint of the landing page.
 */
function IdleRoutePrefetch() {
  useEffect(() => {
    const prefetch = () => {
      // Only the two most-likely next destinations are warmed. The heavy
      // chunks (AccountPages + the jsPDF stack) are fetched on demand so a
      // first visit never competes with rendering for bandwidth.
      void import('./Market');
      void import('./InstantOrder');
    };
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) {
      const id = ric(prefetch, { timeout: 4000 });
      return () => (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(prefetch, 2500);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}

function AccessLinkPage({ kind }: { kind: 'access' | 'source' }) {
  const { code = '' } = useParams();
  const { redeemAccess, syncing } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    (async () => {
      if (!code) {
        navigate('/', { replace: true });
        return;
      }
      await redeemAccess(`${kind === 'source' ? '/s/' : '/a/'}${code}`);
      if (active) navigate('/', { replace: true });
    })();
    return () => {
      active = false;
    };
  }, [code, kind, navigate, redeemAccess]);

  return (
    <main className="access-link-page">
      <p>{syncing ? 'Redeeming access…' : 'Opening private desk…'}</p>
    </main>
  );
}

function LoginPage() {
  const { user, openAuth } = useApp();

  useEffect(() => {
    if (!user) openAuth('signin');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <main className="access-link-page">
      <p>Sign in to continue to your desk.</p>
      <button type="button" className="btn btn-purple" onClick={() => openAuth('signin')}>
        Open sign in
      </button>
    </main>
  );
}

function NormalizeRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const path = decodeURI(location.pathname).toLowerCase();
    if (path === '/instant order' || path === '/instant%20order') {
      navigate('/instant-order', { replace: true });
    }
  }, [location.pathname, navigate]);
  return null;
}

function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <NormalizeRoute />
      <IdleRoutePrefetch />
      <SiteHeader />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Home />} />
          <Route path="/trading" element={<Market />} />
          <Route path="/market" element={<Market />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/instant-order" element={<InstantOrder />} />
          <Route path="/deposit" element={<Deposit />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/a/:code" element={<AccessLinkPage kind="access" />} />
          <Route path="/s/:code" element={<AccessLinkPage kind="source" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <SiteFooter />
      <ContactButton />
      <NovaChat />
      <AuthModal />
      <ConversionModal />
      <ToastStack />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <MarketProvider>
          <AppRoutes />
        </MarketProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
