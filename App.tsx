import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './lib/toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import Balances from './pages/Balances';
import Orders from './pages/Orders';
import Leads from './pages/Leads';
import Campaigns from './pages/Campaigns';
import Social from './pages/Social';
import Segments from './pages/Segments';
import Chat from './pages/Chat';
import EmailCenter from './pages/EmailCenter';
import Popups from './pages/Popups';
import Website from './pages/Website';
import Agreements from './pages/Agreements';
import AIAssistant from './pages/AIAssistant';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import { Spinner } from './components/ui';

function Protected({ children }: { children: React.ReactNode }) {
  const { staff, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-950">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }
  if (!staff) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <Protected>
                  <Layout />
                </Protected>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/users" element={<Users />} />
              <Route path="/users/:id" element={<UserDetail />} />
              <Route path="/balances" element={<Balances />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/social" element={<Social />} />
              <Route path="/segments" element={<Segments />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/email" element={<EmailCenter />} />
              <Route path="/popups" element={<Popups />} />
              <Route path="/website" element={<Website />} />
              <Route path="/agreements" element={<Agreements />} />
              <Route path="/ai" element={<AIAssistant />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
