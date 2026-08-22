import { useEffect, useState } from 'react';
import { UserCog, SlidersHorizontal, Plus, Save, ShieldCheck } from 'lucide-react';
import { PageHeader, Card, TableShell, Modal, Field, Input, Select, Loading, Toggle, Empty } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { badge, fmtDateTime, roleTone } from '../lib/format';

interface StaffRow { id: number; username: string; email: string; full_name: string; role: string; active: number; mfa_enabled: number; last_login_at: string | null }
interface Setting { key: string; value: string }

const ROLES = [
  ['master_admin', 'Master Admin — full control'],
  ['admin', 'Admin — manages everything except master-only actions'],
  ['support', 'Support — users, chats, leads, emails'],
  ['viewer', 'Viewer — read-only access'],
];

export default function Settings() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [form, setForm] = useState({ username: '', email: '', full_name: '', role: 'admin', password: '' });
  const [settingDraft, setSettingDraft] = useState<Record<string, string>>({});
  const toast = useToast();
  const { can } = useAuth();

  const load = () => {
    const jobs: Promise<unknown>[] = [];
    if (can('staff.manage')) {
      jobs.push(api.get<{ data: StaffRow[] }>('/system/staff').then((r) => setStaff(r.data)));
    }
    jobs.push(api.get<{ data: Setting[] }>('/system/settings').then((r) => {
      setSettings(r.data);
      setSettingDraft(Object.fromEntries(r.data.map((s) => [s.key, s.value])));
    }));
    Promise.all(jobs)
      .catch((e) => toast.push('error', e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ username: '', email: '', full_name: '', role: 'admin', password: '' });
    setOpen(true);
  };
  const openEdit = (s: StaffRow) => {
    setEditing(s);
    setForm({ username: s.username, email: s.email, full_name: s.full_name, role: s.role, password: '' });
    setOpen(true);
  };

  const saveStaff = async () => {
    try {
      if (editing) {
        await api.patch(`/system/staff/${editing.id}`, { ...form, password: form.password || undefined });
        toast.push('success', 'Staff updated');
      } else {
        await api.post('/system/staff', form);
        toast.push('success', 'Staff created');
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const toggleActive = async (s: StaffRow) => {
    try {
      await api.patch(`/system/staff/${s.id}`, { active: s.active ? 0 : 1 });
      toast.push('success', s.active ? 'Staff disabled' : 'Staff enabled');
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const saveSetting = async (key: string) => {
    try {
      await api.patch('/system/settings', { key, value: settingDraft[key] });
      toast.push('success', `${key} updated`);
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="fade-up">
      <PageHeader
        title="Settings"
        subtitle="Role-based access control, staff management and system configuration"
        actions={can('staff.manage') && (
          <button className="hcc-btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> New staff</button>
        )}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Roles */}
          <Card title="Roles & permissions" subtitle="RBAC model" actions={<ShieldCheck className="h-4 w-4 text-neon-green" />}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ROLES.map(([role, desc]) => (
                <div key={role} className="rounded-lg border border-ink-600 bg-ink-950/50 p-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${roleTone[role]}`}>{role.replace('_', ' ')}</span>
                  <p className="mt-1.5 text-xs text-slate-500">{desc}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Staff */}
          {can('staff.manage') && (
            <Card title="Staff accounts" subtitle={`${staff.length} accounts`}>
              <TableShell>
                <thead className="bg-ink-850/80">
                  <tr>
                    <th className="th">Name</th>
                    <th className="th">Role</th>
                    <th className="th">MFA</th>
                    <th className="th">Last login</th>
                    <th className="th">Status</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700/70">
                  {staff.map((s) => (
                    <tr key={s.id} className="hover:bg-ink-800/40">
                      <td className="td">
                        <span className="block font-medium text-slate-100">{s.full_name}</span>
                        <span className="block text-xs text-slate-500">@{s.username}</span>
                      </td>
                      <td className="td"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${roleTone[s.role]}`}>{s.role.replace('_', ' ')}</span></td>
                      <td className="td text-xs">{s.mfa_enabled ? <span className="text-neon-green">Enabled</span> : <span className="text-slate-500">—</span>}</td>
                      <td className="td text-xs text-slate-500">{s.last_login_at ? fmtDateTime(s.last_login_at) : 'never'}</td>
                      <td className="td"><span className={badge(s.active ? 'active' : 'blocked')}>{s.active ? 'active' : 'disabled'}</span></td>
                      <td className="td text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(s)} className="text-xs font-semibold text-neon-cyan hover:underline">Edit</button>
                          <Toggle checked={!!s.active} onChange={() => toggleActive(s)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </Card>
          )}
        </div>

        {/* System settings */}
        <Card title="System configuration" subtitle="Master only · stored in env-secure settings" actions={<SlidersHorizontal className="h-4 w-4 text-slate-500" />}>
          {can('settings.manage') ? (
            <div className="space-y-3">
              {settings.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <Field label={s.key.replace(/_/g, ' ')}>
                    <Input value={settingDraft[s.key] ?? ''} onChange={(e) => setSettingDraft({ ...settingDraft, [s.key]: e.target.value })} />
                  </Field>
                  <button onClick={() => saveSetting(s.key)} className="hcc-btn-ghost mt-5 shrink-0 !p-2" title="Save"><Save className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          ) : (
            <Empty label="No permission" hint="Only the master admin can change system settings" />
          )}
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.full_name}` : 'New staff account'}>
        <div className="space-y-4">
          <Field label="Full name"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username"><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
            <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          </div>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="admin">Admin</option>
              <option value="support">Support</option>
              <option value="viewer">Viewer</option>
              <option value="master_admin">Master Admin</option>
            </Select>
          </Field>
          <Field label={editing ? 'Reset password (leave blank to keep)' : 'Password'}>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <button onClick={saveStaff} className="hcc-btn-primary w-full"><UserCog className="h-4 w-4" /> {editing ? 'Save changes' : 'Create staff'}</button>
        </div>
      </Modal>
    </div>
  );
}
