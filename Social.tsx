import { useEffect, useState } from 'react';
import { Plus, CalendarClock, Unplug, Heart, MessageCircle, Share2 } from 'lucide-react';
import { PageHeader, Card, Modal, Field, Input, Select, Textarea, Loading } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { fmtNum, platformIcon, timeAgo } from '../lib/format';

interface Account { id: number; platform: string; handle: string; status: string; followers: number; engagement: Record<string, number> }
interface Post { id: number; account_id: number; content: string; scheduled_at: string; status: string; likes: number; comments: number; shares: number; platform?: string; handle?: string }

const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877f2', instagram: '#e1306c', tiktok: '#22ff9a', linkedin: '#0a66c2', x: '#94a3b8',
};

export default function Social() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [conn, setConn] = useState({ platform: 'instagram', handle: '' });
  const [post, setPost] = useState({ account_id: '', content: '' });
  const toast = useToast();
  const { can } = useAuth();

  const load = () => {
    Promise.all([
      api.get<{ data: Account[] }>('/social/accounts'),
      api.get<{ data: Post[] }>('/social/posts'),
    ])
      .then(([a, p]) => {
        setAccounts(a.data);
        setPosts(p.data);
      })
      .catch((e) => toast.push('error', e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const connect = async () => {
    try {
      await api.post('/social/accounts', conn);
      toast.push('success', 'Account connected (mock)');
      setConnectOpen(false);
      setConn({ platform: 'instagram', handle: '' });
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const schedule = async () => {
    try {
      await api.post('/social/posts', { ...post, account_id: Number(post.account_id), scheduled_at: new Date(Date.now() + 86400000).toISOString() });
      toast.push('success', 'Post scheduled');
      setPostOpen(false);
      setPost({ account_id: '', content: '' });
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const disconnect = async (id: number) => {
    try {
      await api.del(`/social/accounts/${id}`);
      toast.push('success', 'Account disconnected');
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="fade-up">
      <PageHeader
        title="Social Media"
        subtitle="Connect accounts, schedule posts and watch engagement"
        actions={can('social.manage') && (
          <>
            <button className="hcc-btn-ghost" onClick={() => setPostOpen(true)}><CalendarClock className="h-4 w-4" /> Schedule post</button>
            <button className="hcc-btn-primary" onClick={() => setConnectOpen(true)}><Plus className="h-4 w-4" /> Connect account</button>
          </>
        )}
      />

      {/* Accounts */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {accounts.map((a) => (
          <div key={a.id} className="glass card-pad">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: PLATFORM_COLORS[a.platform] ?? '#22ff9a' }}>
                  {platformIcon[a.platform]?.[0] ?? '?'}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-100">{platformIcon[a.platform] ?? a.platform}</p>
                  <p className="text-xs text-slate-500">{a.handle}</p>
                </div>
              </div>
              {can('social.manage') && (
                <button onClick={() => disconnect(a.id)} className="text-slate-600 hover:text-neon-red"><Unplug className="h-4 w-4" /></button>
              )}
            </div>
            <p className="mt-3 font-display text-lg font-bold text-slate-50">{fmtNum(a.followers)} <span className="text-xs font-normal text-slate-500">followers</span></p>
            <div className="mt-2 flex gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-neon-red" /> {fmtNum(a.engagement.likes)}</span>
              <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-neon-cyan" /> {fmtNum(a.engagement.comments)}</span>
              <span className="flex items-center gap-1"><Share2 className="h-3 w-3 text-neon-purple" /> {fmtNum(a.engagement.shares)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Posts */}
      <Card title="Scheduled & published posts" subtitle={`${posts.length} posts`}>
        <div className="divide-y divide-ink-700/70">
          {posts.map((p) => (
            <div key={p.id} className="flex items-center gap-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: PLATFORM_COLORS[p.platform ?? 'x'] ?? '#22ff9a' }}>
                {(p.platform ?? 'x')[0].toUpperCase()}
              </span>
              <p className="flex-1 text-sm text-slate-200">{p.content}</p>
              <span className="text-[11px] text-slate-500">
                {p.status === 'scheduled' ? `scheduled · ${timeAgo(p.scheduled_at)}` : `published · ${timeAgo(p.scheduled_at)}`}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.status === 'published' ? 'bg-neon-green/10 text-neon-green' : 'bg-ink-700 text-slate-300'}`}>
                {p.status}
              </span>
              {p.status === 'published' && (
                <span className="flex gap-2 text-[11px] text-slate-500">
                  <span className="flex items-center gap-0.5"><Heart className="h-3 w-3 text-neon-red" />{fmtNum(p.likes)}</span>
                  <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3 text-neon-cyan" />{fmtNum(p.comments)}</span>
                  <span className="flex items-center gap-0.5"><Share2 className="h-3 w-3 text-neon-purple" />{fmtNum(p.shares)}</span>
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Modal open={connectOpen} onClose={() => setConnectOpen(false)} title="Connect account">
        <div className="space-y-4">
          <Field label="Platform">
            <Select value={conn.platform} onChange={(e) => setConn({ ...conn, platform: e.target.value })}>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="linkedin">LinkedIn</option>
              <option value="x">X (Twitter)</option>
            </Select>
          </Field>
          <Field label="Handle"><Input value={conn.handle} onChange={(e) => setConn({ ...conn, handle: e.target.value })} placeholder="@yourhandle" /></Field>
          <button onClick={connect} className="hcc-btn-primary w-full">Connect (mock OAuth)</button>
        </div>
      </Modal>

      <Modal open={postOpen} onClose={() => setPostOpen(false)} title="Schedule a post">
        <div className="space-y-4">
          <Field label="Account">
            <Select value={post.account_id} onChange={(e) => setPost({ ...post, account_id: e.target.value })}>
              <option value="">Choose account…</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{platformIcon[a.platform]} — {a.handle}</option>)}
            </Select>
          </Field>
          <Field label="Content"><Textarea value={post.content} onChange={(e) => setPost({ ...post, content: e.target.value })} placeholder="What's happening? Include hashtags…" /></Field>
          <button onClick={schedule} className="hcc-btn-cyan w-full">Schedule</button>
        </div>
      </Modal>
    </div>
  );
}
