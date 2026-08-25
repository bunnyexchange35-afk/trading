import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, LockKeyhole, RefreshCcw, Search, ShieldCheck, Users } from 'lucide-react';
import { getAdminUsers, type AdminUser } from './api';

const ADMIN_CODE_KEY = 'mudrexx-admin-code';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminUsersPage() {
  const [code, setCode] = useState(() => localStorage.getItem(ADMIN_CODE_KEY) || '');
  const [draftCode, setDraftCode] = useState(code);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async (adminCode = code) => {
    if (!adminCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await getAdminUsers(adminCode.trim());
      if (!response.success) throw new Error(response.error || 'Unable to load registered users.');
      setUsers(response.users || []);
      localStorage.setItem(ADMIN_CODE_KEY, adminCode.trim());
    } catch (loadError) {
      setUsers([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load registered users.');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (code) void loadUsers(code);
  }, [code, loadUsers]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => [user.name, user.email, user.phone, user.invitedBy].some((value) => value?.toLowerCase().includes(needle)));
  }, [query, users]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextCode = draftCode.trim();
    setCode(nextCode);
    if (nextCode) void loadUsers(nextCode);
  };

  return (
    <main className="admin-page">
      <section className="admin-shell">
        <div className="admin-heading">
          <div>
            <span className="eyebrow">ADMIN CONTROL</span>
            <h1>Registered users</h1>
            <p>Every account created in the Earn desk appears here after registration.</p>
          </div>
          <div className="admin-heading-icon"><Users /></div>
        </div>

        {!code && (
          <form className="admin-access-card" onSubmit={submit}>
            <div className="admin-access-icon"><LockKeyhole /></div>
            <div>
              <h2>Open the user section</h2>
              <p>Enter an administrator invitation code to view account records. User balances and activity are read from the authoritative backend.</p>
              <div className="admin-code-row">
                <input value={draftCode} onChange={(event) => setDraftCode(event.target.value)} placeholder="Administrator code" autoComplete="off" required />
                <button className="btn btn-purple" type="submit">View users <ArrowRight size={16} /></button>
              </div>
            </div>
          </form>
        )}

        {code && (
          <>
            <div className="admin-toolbar">
              <label className="admin-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, phone…" /></label>
              <div className="admin-toolbar-actions">
                <span className="admin-count"><strong>{filteredUsers.length}</strong> of {users.length} users</span>
                <button className="btn btn-soft" type="button" onClick={() => void loadUsers()} disabled={loading}><RefreshCcw size={15} className={loading ? 'spin' : ''} /> Refresh</button>
                <button className="btn btn-ghost" type="button" onClick={() => { localStorage.removeItem(ADMIN_CODE_KEY); setCode(''); setDraftCode(''); setUsers([]); }}>Change code</button>
              </div>
            </div>
            {error && <div className="admin-error"><ShieldCheck size={17} /> {error}</div>}
            <div className="admin-users-card">
              <div className="admin-table-head"><span>User</span><span>Registered</span><span>Invitation source</span><span>Wallet snapshot</span></div>
              {loading && <div className="admin-empty">Loading registered users…</div>}
              {!loading && !error && filteredUsers.length === 0 && <div className="admin-empty"><Users size={24} /><strong>No registered users found</strong><span>New registrations will appear here automatically when you refresh.</span></div>}
              {!loading && filteredUsers.map((user) => (
                <div className="admin-user-row" key={user.email}>
                  <div className="admin-user-identity"><span className="admin-avatar">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.email}{user.phone ? ` · ${user.phone}` : ''}</small></span></div>
                  <div className="admin-cell"><CalendarDays size={15} />{formatDate(user.registeredAt)}</div>
                  <div className="admin-cell"><span className={`source-badge ${user.invitedBy ? '' : 'direct'}`}>{user.invitedBy ? `${user.invitedByType === 'admin' ? 'Admin' : 'Referral'} · ${user.invitedBy}` : 'Direct registration'}</span></div>
                  <div className="admin-wallet"><span>Real <strong>₹{user.realBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span><span>Demo <strong>{user.demoBalance.toLocaleString()}</strong></span></div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
