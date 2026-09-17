/**
 * Documents.
 *
 * The catalog comes from `GET /api/documents`; each entry names the endpoint
 * that produces its data. Those endpoints return JSON, so the PDF is composed
 * in `utils/pdf.ts` from that data. Nothing is fabricated: if the backend
 * returns an empty clause list or no invoice line items, the PDF says so.
 *
 * Verified catalog ids: account-statement, proof-of-account, account-agreement,
 * payout-agreement (`/api/account/agreement?type=payout`), account-invoice.
 */

import { useState } from 'react';
import {
  Download,
  FileCheck2,
  FileText,
  Receipt,
  Scale,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import { getAgreement, getDocuments, getInvoice, getProof, getStatement } from '../../api';
import { errorMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { agreementPdf, invoicePdf, proofPdf, statementPdf } from '../../utils/pdf';
import { Alert, Badge, Button, Card, EmptyState, Modal, Skeleton } from '../../components/ui';
import { dateLabel, money, whenLabel } from '../../utils/format';

type Preview =
  | { kind: 'statement'; title: string; rows: Array<[string, string]> }
  | { kind: 'proof'; title: string; rows: Array<[string, string]> }
  | { kind: 'agreement'; title: string; rows: Array<[string, string]> }
  | { kind: 'invoice'; title: string; rows: Array<[string, string]> }
  | null;

const ICONS: Record<string, React.ReactNode> = {
  statement: <ScrollText size={18} />,
  proof: <ShieldCheck size={18} />,
  agreement: <Scale size={18} />,
  'payout-agreement': <FileCheck2 size={18} />,
  invoice: <Receipt size={18} />,
};

export default function DocumentsPage() {
  const documents = useAsync(() => getDocuments().then((r) => r.documents), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview>(null);

  if (documents.unavailable) {
    return (
      <div className="page">
        <Head />
        <Card>
          <EmptyState icon={<FileText size={20} />} title="Documents unavailable here" body="This deployment does not serve the documents API." />
        </Card>
      </div>
    );
  }

  /** Loads the real document, previews key facts, and offers the PDF. */
  const open = async (id: string, title: string, endpoint: string) => {
    setBusyId(id);
    setError(null);
    try {
      if (endpoint.includes('/statement')) {
        const response = await getStatement();
        const s = response.statement;
        setPreview({
          kind: 'statement',
          title,
          rows: [
            ['Statement id', s.statementId],
            ['Generated', whenLabel(s.generatedAt)],
            ['Account holder', s.accountHolder.name],
            ['Available (INR)', money(s.balances.realBalance)],
            ['Frozen (INR)', money(s.balances.frozenBalance)],
            ['Available (USDT)', `₮${s.balances.realUsdtBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}`],
            ['Credits', s.balances.demoBalance.toLocaleString('en-IN')],
            ['Ledger entries', String(s.transactions.length)],
            ['Held items', String(s.frozenItems.length)],
          ],
        });
      } else if (endpoint.includes('/proof')) {
        const response = await getProof();
        const p = response.proof;
        setPreview({
          kind: 'proof',
          title,
          rows: [
            ['Proof id', p.proofId],
            ['Issued', whenLabel(p.issuedAt)],
            ['Valid until', dateLabel(p.validUntil)],
            ['Platform', p.platform],
            ['Account holder', p.accountHolder.name],
            ['Email', p.accountHolder.email],
            ['Status', p.status ?? 'recorded as active'],
          ],
        });
      } else if (endpoint.includes('/invoice')) {
        const response = await getInvoice();
        const i = response.invoice;
        setPreview({
          kind: 'invoice',
          title,
          rows: [
            ['Invoice id', i.invoiceId],
            ['Issued', whenLabel(i.issuedAt)],
            ['Period', `${dateLabel(i.periodStart)} – ${dateLabel(i.periodEnd)}`],
            ['Billed to', i.billTo.name],
            ['User id', i.billTo.userId],
            ['Line items', String(i.items?.length ?? 0)],
            ['Subtotal (INR)', money(i.totals.subtotalInr)],
          ],
        });
      } else if (endpoint.includes('/agreement')) {
        const isPayout = endpoint.includes('payout');
        const response = await getAgreement(isPayout ? 'payout' : 'account');
        const a = response.agreement;
        const clauses = a.clauses ?? a.sections ?? [];
        setPreview({
          kind: 'agreement',
          title,
          rows: [
            ['Agreement id', a.agreementId ?? '—'],
            ['Type', a.type ?? (isPayout ? 'payout' : 'account')],
            ['Issued', a.issuedAt ? whenLabel(a.issuedAt) : '—'],
            ['Party', a.party ? `${a.party.name} (${a.party.email})` : '—'],
            ['Clauses', String(clauses.length)],
          ],
        });
      } else {
        setError(`No renderer is wired for ${endpoint}. The catalog lists it, but its shape was not verified.`);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const download = async () => {
    if (!preview) return;
    setBusyId('download');
    setError(null);
    try {
      if (preview.kind === 'statement') await statementPdf(await getStatement());
      else if (preview.kind === 'proof') await proofPdf(await getProof());
      else if (preview.kind === 'invoice') await invoicePdf(await getInvoice());
      else await agreementPdf(await getAgreement(preview.title.toLowerCase().includes('payout') ? 'payout' : 'account'));
      setPreview(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page">
      <Head />

      {error && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <div style={{ marginBottom: 'var(--sp-4)' }}>
        <Alert tone="info" title="Generated from your live account data">
          Each document is built from the backend's own records at the moment you open it, then
          rendered to PDF in your browser. Statements show pending deposits as pending, and no
          document claims a payout was executed.
        </Alert>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
        {documents.loading && !documents.data && (
          <>
            <Skeleton className="sk-block" style={{ height: 130 }} />
            <Skeleton className="sk-block" style={{ height: 130 }} />
            <Skeleton className="sk-block" style={{ height: 130 }} />
          </>
        )}

        {documents.error && !documents.unavailable && (
          <Card style={{ gridColumn: '1 / -1' }}>
            <EmptyState icon={<FileText size={20} />} title="Could not load documents" body={documents.error.message} />
          </Card>
        )}

        {(documents.data ?? []).map((doc) => (
          <Card key={doc.id} className="feature" pad>
            <div className="feature-icon">{ICONS[doc.type] ?? <FileText size={18} />}</div>
            <div className="row-tight" style={{ justifyContent: 'space-between' }}>
              <h3 className="card-title">{doc.title}</h3>
              <Badge tone="neutral">{doc.type}</Badge>
            </div>
            <p className="small muted" style={{ margin: 'var(--sp-2) 0 var(--sp-4)', lineHeight: 'var(--lh-body)' }}>
              {doc.description}
            </p>
            <div className="row">
              <Button variant="outline" size="sm" onClick={() => open(doc.id, doc.title, doc.endpoint)} loading={busyId === doc.id}>
                View details
              </Button>
              <span className="xs faint mono">{doc.endpoint}</span>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={Boolean(preview)} onClose={() => busyId !== 'download' && setPreview(null)} title={preview?.title ?? 'Document'}>
        {preview && (
          <div className="stack">
            <div className="panel">
              {preview.rows.map(([key, value]) => (
                <div className="kv" key={key}>
                  <span className="kv-key">{key}</span>
                  <span className="kv-val">{value}</span>
                </div>
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setPreview(null)} disabled={busyId === 'download'}>
                Close
              </Button>
              <Button variant="primary" onClick={download} loading={busyId === 'download'}>
                {busyId !== 'download' && <Download size={15} />} Download PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Head() {
  return (
    <header className="page-head">
      <div>
        <span className="eyebrow">Documents</span>
        <h1 className="page-title" style={{ marginTop: 6 }}>
          Account documents
        </h1>
        <p className="page-sub">
          Statement, proof of account, agreements and invoice — generated on demand from your real
          account data.
        </p>
      </div>
    </header>
  );
}
