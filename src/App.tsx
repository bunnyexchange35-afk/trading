import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider } from './app-context';
import { MarketProvider } from './market-context';
import { AuthModal, ContactButton, EntryExperience, SiteFooter, SiteHeader, ToastStack } from './components';
import Home from './Home';
import Market from './Market';
import InstantOrder from './InstantOrder';
import Deposit from './Deposit';
import { CommunityPage, ProfilePage, SupportPage, WalletPage } from './AccountPages';

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [location.pathname]);
  return null;
}

function AppRoutes() {
  return <>
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <SiteFooter />
    <ContactButton />
    <AuthModal />
    <ToastStack />
  </>;
}

export default function App() {
  return <BrowserRouter><AppProvider><MarketProvider><AppRoutes /></MarketProvider></AppProvider></BrowserRouter>;
}
