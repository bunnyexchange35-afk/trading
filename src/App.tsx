import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppProvider, useApp } from './app-context';
import { MarketProvider } from './market-context';
import {
  AuthModal,
  ContactButton,
  ConversionModal,
  EntryExperience,
  SiteFooter,
  SiteHeader,
  ToastStack,
} from './components';
import Home from './Home';
import Market from './Market';
import InstantOrder from './InstantOrder';
import Deposit from './Deposit';
import { CommunityPage, ProfilePage, SupportPage, WalletPage } from './AccountPages';
import AdminUsersPage from './AdminUsersPage';

function SpaceBackdrop() {
  return (
    <div className="space-backdrop" aria-hidden="true">
      <span className="stars stars-a" />
      <span className="stars stars-b" />
      <span className="nebula nebula-a" />
      <span className="nebula nebula-b" />
    </div>
  );
}

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);
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

function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <EntryExperience />
      <SiteHeader />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/market" element={<Market />} />
        <Route path="/instant-order" element={<InstantOrder />} />
        <Route path="/deposit" element={<Deposit />} />
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
      <SiteFooter />
      <ContactButton />
      <AuthModal />
      <ConversionModal />
      <ToastStack />
    </>
  );
}

export default function App() {
  return (
    <div className="space-app">
      <SpaceBackdrop />
      <div className="space-content">
        <BrowserRouter>
          <AppProvider>
            <MarketProvider>
              <AppRoutes />
            </MarketProvider>
          </AppProvider>
        </BrowserRouter>
      </div>
    </div>
  );
}
