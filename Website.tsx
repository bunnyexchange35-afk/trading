import { useEffect, useMemo, useState } from 'react';
import { Save, Rocket, History, Plus, RotateCcw, Eye, LayoutPanelTop } from 'lucide-react';
import { PageHeader, Card, Modal, Field, Input, Loading, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { fmtDateTime } from '../lib/format';

type Section = { id: string; type: string; [k: string]: unknown };
interface Page { id: number; slug: string; name: string; sections: Section[]; published: boolean; version: number }
interface Version { id: number; version: number; note: string; created_at: string; author: string | null }

export default function Website() {
  const [pages, setPages] = useState<Page[]>([]);
  const [page, setPage] = useState<Page | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [selected, setSelected] = useState<Section | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const toast = useToast();
  const { can } = useAuth();

  const loadPages = () => {
    api.get<{ data: Page[] }>('/website/pages')
      .then((r) => {
        setPages(r.data);
        if (r.data[0]) selectPage(r.data[0].id);
      })
      .catch((e) => toast.push('error', e.message))
      .finally(() => setLoading(false));
  };
  useEffect(loadPages, []);

  const selectPage = (id: number) => {
    setLoading(true);
    api.get<{ data: Page & { versions: Version[] } }>(`/website/pages/${id}`)
      .then((r) => {
        setPage(r.data);
        setSections(r.data.sections);
        setVersions(r.data.versions);
        setSelected(r.data.sections[0] ?? null);
        setDirty(false);
      })
      .catch((e) => toast.push('error', e.message))
      .finally(() => setLoading(false));
  };

  const updateSection = (id: string, patch: Partial<Section>) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setSelected((s) => (s && s.id === id ? { ...s, ...patch } : s));
    setDirty(true);
  };

  const addSection = () => {
    const s: Section = { id: `section-${Date.now()}`, type: 'banner', title: 'New section', cta: 'Learn more', color: '#00e5ff', order: sections.length + 1 };
    setSections((prev) => [...prev, s]);
    setSelected(s);
    setDirty(true);
  };

  const removeSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
    setSelected(null);
    setDirty(true);
  };

  const save = async () => {
    if (!page) return;
    setSaving(true);
    try {
      await api.patch(`/website/pages/${page.id}`, { sections });
      toast.push('success', 'Draft saved (new version created)');
      setDirty(false);
      selectPage(page.id);
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!page) return;
    setSaving(true);
    try {
      await api.post(`/website/pages/${page.id}/publish`);
      toast.push('success', 'Page published 🚀');
      selectPage(page.id);
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const rollback = async (version: number) => {
    if (!page) return;
    try {
      await api.post(`/website/pages/${page.id}/rollback`, { version });
      toast.push('success', `Rolled back to v${version}`);
      setHistOpen(false);
      selectPage(page.id);
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const scalarKeys = useMemo(() => {
    if (!selected) return [];
    return Object.entries(selected).filter(([k, v]) => !['id', 'type', 'items', 'links', 'order'].includes(k) && (typeof v === 'string' || typeof v === 'number'));
  }, [selected]);

  if (loading && !page) return <Loading />;

  return (
    <div className="fade-up">
      <PageHeader
        title="Website Editor"
        subtitle="Edit pages and sections, preview, version and publish"
        actions={page && can('website.manage') && (
          <>
            <button className="hcc-btn-ghost" onClick={() => setHistOpen(true)}><History className="h-4 w-4" /> Versions</button>
            <button className="hcc-btn-ghost" onClick={save} disabled={!dirty || saving}>{saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />} Save draft</button>
            <button className="hcc-btn-primary" onClick={publish} disabled={saving}><Rocket className="h-4 w-4" /> Publish</button>
          </>
        )}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {/* Pages + sections */}
        <Card title="Pages & sections" className="xl:col-span-1">
          <div className="mb-3 space-y-1">
            {pages.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPage(p.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${page?.id === p.id ? 'bg-neon-green/10 text-neon-green ring-1 ring-inset ring-neon-green/30' : 'text-slate-300 hover:bg-ink-800'}`}
              >
                <span className="flex items-center gap-2"><LayoutPanelTop className="h-3.5 w-3.5" /> {p.name}</span>
                <span className="text-[10px] opacity-70">{p.published ? 'live' : `v${p.version}`}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-ink-700 pt-3">
            <p className="hcc-label">Sections</p>
            <div className="space-y-1">
              {sections.map((s, i) => (
                <div key={s.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setSelected(s)}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-left text-sm transition ${selected?.id === s.id ? 'bg-neon-cyan/10 text-neon-cyan ring-1 ring-inset ring-neon-cyan/30' : 'text-slate-300 hover:bg-ink-800'}`}
                  >
                    <span className="text-[10px] font-bold uppercase opacity-60">{i + 1}. {s.type}</span> {String(s.title ?? '').slice(0, 22) || ''}
                  </button>
                  {can('website.manage') && (
                    <button onClick={() => removeSection(s.id)} className="text-xs text-slate-600 hover:text-neon-red">✕</button>
                  )}
                </div>
              ))}
              {can('website.manage') && (
                <button onClick={addSection} className="hcc-btn-ghost mt-2 w-full text-xs"><Plus className="h-3.5 w-3.5" /> Add section</button>
              )}
            </div>
          </div>
        </Card>

        {/* Editor */}
        <Card title="Edit section" subtitle={selected ? `${selected.type} · ${selected.id}` : 'Select a section'} className="xl:col-span-1">
          {selected ? (
            <div className="space-y-3">
              {scalarKeys.map(([k]) => (
                <Field key={k} label={k}>
                  <Input
                    value={String(selected[k] ?? '')}
                    onChange={(e) => updateSection(selected.id, { [k]: k === 'color' ? e.target.value : e.target.value })}
                  />
                </Field>
              ))}
              {Boolean(selected.items || selected.links) && (
                <Field label={selected.items ? 'items (JSON)' : 'links (JSON)'}>
                  <textarea
                    className="hcc-input min-h-[120px] font-mono text-xs"
                    value={JSON.stringify(selected.items ?? selected.links, null, 2)}
                    onChange={(e) => {
                      try {
                        updateSection(selected.id, selected.items ? { items: JSON.parse(e.target.value) } : { links: JSON.parse(e.target.value) });
                      } catch {
                        /* invalid JSON while typing — ignored */
                      }
                    }}
                  />
                </Field>
              )}
              {selected.type === 'hero' && selected.color !== undefined && (
                <Field label="Accent color"><input type="color" value={String(selected.color ?? '#22ff9a')} onChange={(e) => updateSection(selected.id, { color: e.target.value })} className="h-10 w-full cursor-pointer rounded-lg border border-ink-600 bg-ink-900" /></Field>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No section selected</p>
          )}
        </Card>

        {/* Preview */}
        <Card title="Live preview" subtitle="How this section renders" actions={<Eye className="h-4 w-4 text-slate-500" />} className="xl:col-span-2">
          <div className="rounded-xl border border-ink-600 bg-ink-950/80 p-6">
            {selected ? <SectionPreview section={selected} /> : <p className="py-10 text-center text-sm text-slate-600">Select a section to preview</p>}
          </div>
        </Card>
      </div>

      {/* Versions modal */}
      <Modal open={histOpen} onClose={() => setHistOpen(false)} title="Version history">
        <div className="space-y-2">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-lg border border-ink-600 bg-ink-950/50 px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-slate-100">v{v.version} {v.version === page?.version ? <span className="text-[10px] text-neon-green">(current)</span> : ''}</p>
                <p className="text-xs text-slate-500">{v.note} · {fmtDateTime(v.created_at)} · {v.author ?? '—'}</p>
              </div>
              {can('website.manage') && v.version !== page?.version && (
                <button onClick={() => rollback(v.version)} className="hcc-btn-ghost text-xs"><RotateCcw className="h-3.5 w-3.5" /> Rollback</button>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function SectionPreview({ section }: { section: Section }) {
  const s = section as Record<string, any>;
  switch (s.type) {
    case 'hero':
      return (
        <div className="py-8 text-center">
          {s.image && <img src={String(s.image)} alt="" className="mx-auto mb-4 h-32 rounded-lg object-cover opacity-80" />}
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">{s.title}</h2>
          {s.subtitle && <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">{s.subtitle}</p>}
          {(s.cta || s.cta2) && (
            <div className="mt-4 flex justify-center gap-2">
              {s.cta && <button className="rounded-lg bg-neon-green px-4 py-2 text-sm font-semibold text-ink-950">{s.cta}</button>}
              {s.cta2 && <button className="rounded-lg border border-ink-500 px-4 py-2 text-sm text-slate-200">{s.cta2}</button>}
            </div>
          )}
        </div>
      );
    case 'banner':
      return (
        <div className="rounded-xl p-5 text-center" style={{ background: `${s.color ?? '#a855f7'}22`, border: `1px solid ${s.color ?? '#a855f7'}55` }}>
          <p className="font-display text-lg font-bold" style={{ color: s.color ?? '#a855f7' }}>{s.title}</p>
          {s.cta && <button className="mt-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-950" style={{ background: s.color ?? '#a855f7' }}>{s.cta}</button>}
        </div>
      );
    case 'stats':
      return (
        <div>
          {s.title && <p className="mb-3 text-center text-sm font-semibold text-slate-300">{s.title}</p>}
          <div className="grid grid-cols-3 gap-3">
            {(s.items ?? []).map((it: any, i: number) => (
              <div key={i} className="rounded-lg bg-ink-800 p-3 text-center">
                <p className="font-display text-xl font-bold text-neon-cyan">{it.value}</p>
                <p className="text-xs text-slate-500">{it.label}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case 'cards':
      return (
        <div>
          {s.title && <p className="mb-3 text-sm font-semibold text-slate-300">{s.title}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(s.items ?? []).map((it: any, i: number) => (
              <div key={i} className="rounded-lg border border-ink-600 p-3">
                <p className="text-2xl">{it.icon === 'zap' ? '⚡' : it.icon === 'shield' ? '🛡️' : '✨'}</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{it.title}</p>
                <p className="text-xs text-slate-500">{it.desc}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case 'footer':
      return (
        <div className="flex items-center justify-between border-t border-ink-700 pt-3 text-xs text-slate-500">
          <span>{s.text}</span>
          <div className="flex gap-3">
            {(s.links ?? []).map((l: any, i: number) => <span key={i} className="text-neon-cyan">{l.label}</span>)}
          </div>
        </div>
      );
    default:
      return <div className="text-sm text-slate-300">{s.title ?? s.text ?? s.id}</div>;
  }
}
