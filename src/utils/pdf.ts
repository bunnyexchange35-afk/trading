/**
 * PDF rendering for account documents.
 *
 * The document endpoints return JSON, not files — so the PDF is composed here
 * from that data. Every value written into a document comes from the backend
 * response; nothing is invented, and no financial claim is added that the data
 * does not support (audit F8/F9 apply to documents too: a statement must not
 * imply a payout was executed or that a deposit was collected by a gateway).
 *
 * jspdf + jspdf-autotable are already production dependencies. They are loaded
 * dynamically so this stays out of the main bundle.
 */

import type {
  AgreementResponse,
  InvoiceResponse,
  ProofResponse,
  StatementResponse,
} from '../api';
import { dateLabel, money, whenLabel } from './format';

const BRAND = { name: 'MUDREXX EARN', tagline: 'A Way to Earn in Real Life' } as const;
const INK: [number, number, number] = [16, 20, 28];
const GOLD: [number, number, number] = [194, 144, 47];
const MUTED: [number, number, number] = [110, 118, 132];

type PdfBundle = {
  jsPDF: typeof import('jspdf').jsPDF;
  autoTable: typeof import('jspdf-autotable').default;
};

async function loadPdf(): Promise<PdfBundle> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  return { jsPDF, autoTable: autoTableModule.default };
}

function header(doc: InstanceType<PdfBundle['jsPDF']>, title: string, reference: string) {
  doc.setFillColor(...INK);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(238, 194, 104);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(BRAND.name, 14, 12);
  doc.setTextColor(190, 196, 206);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(BRAND.tagline, 14, 18);
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, 14, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(reference, 14, 44);
  doc.setTextColor(...INK);
}

function footer(doc: InstanceType<PdfBundle['jsPDF']>, note: string) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const height = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(14, height - 18, 196, height - 18);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(note, 14, height - 13, { maxWidth: 150 });
    doc.text(`Page ${page} of ${pages}`, 196, height - 13, { align: 'right' });
  }
}

/** Account Statement — balances, frozen items and the full ledger. */
export async function statementPdf(response: StatementResponse): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF();
  const statement = response.statement;

  header(doc, 'Account Statement', `Statement ${statement.statementId} · generated ${whenLabel(statement.generatedAt)}`);

  autoTable(doc, {
    startY: 52,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2.5 },
    body: [
      ['Account holder', statement.accountHolder.name],
      ['Email', statement.accountHolder.email],
      ['Phone', statement.accountHolder.phone || '—'],
      ['Member since', dateLabel(statement.accountHolder.registeredAt)],
      ['Invitation code', statement.accountHolder.inviteCode || '—'],
    ],
  });

  const balances = statement.balances;
  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
    head: [['Balance', 'Amount']],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: INK, textColor: [238, 194, 104], fontStyle: 'bold' },
    body: [
      ['Available (INR)', money(balances.realBalance)],
      ['Frozen (INR)', money(balances.frozenBalance)],
      ['Total (INR)', money(balances.totalRealBalance)],
      ['Available (USDT)', `₮${balances.realUsdtBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}`],
      ['Frozen (USDT)', `₮${balances.frozenUsdtBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}`],
      ['Credits', balances.demoBalance.toLocaleString('en-IN')],
      ['Converted to date', money(balances.totalConverted)],
    ],
  });

  if (statement.frozenItems.length) {
    autoTable(doc, {
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
      head: [['Held item', 'Category', 'Status', 'Amount']],
      styles: { fontSize: 8.5, cellPadding: 2.2 },
      headStyles: { fillColor: INK, textColor: [238, 194, 104], fontStyle: 'bold' },
      body: statement.frozenItems.map((item) => [
        item.title,
        item.category,
        item.status,
        money(item.amount, item.currency),
      ]),
    });
  }

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
    head: [['When', 'Entry', 'Type', 'Status', 'Amount']],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: INK, textColor: [238, 194, 104], fontStyle: 'bold' },
    body: statement.transactions.map((tx) => [
      whenLabel(tx.time),
      tx.title,
      tx.type,
      tx.status,
      `${tx.tone === 'up' ? '+' : tx.tone === 'down' ? '-' : ''}${money(tx.amount, tx.currency)}`,
    ]),
  });

  footer(
    doc,
    'Generated from live account data. Deposits shown as pending have not been verified or credited, and withdrawal requests are reviewed by support rather than executed automatically.',
  );
  doc.save(`${statement.statementId}.pdf`);
}

/** Proof of Account. */
export async function proofPdf(response: ProofResponse): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF();
  const proof = response.proof;

  header(doc, 'Proof of Account', `${proof.proofId} · issued ${whenLabel(proof.issuedAt)} · valid until ${dateLabel(proof.validUntil)}`);

  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(
    [
      `This document confirms that the account described below is registered on ${proof.platform}.`,
      'It is issued from live account records and is valid until the date shown above.',
    ],
    14,
    56,
    { maxWidth: 182 },
  );

  autoTable(doc, {
    startY: 74,
    styles: { fontSize: 9.5, cellPadding: 3 },
    body: [
      ['Platform', proof.platform],
      ['Account holder', proof.accountHolder.name],
      ['Email', proof.accountHolder.email],
      ['Phone', proof.accountHolder.phone || '—'],
      ['Member since', dateLabel(proof.accountHolder.registeredAt)],
      ['Invitation code', proof.accountHolder.inviteCode || '—'],
      ['Account status', proof.status ?? 'recorded as active'],
      ['Proof reference', proof.proofId],
    ],
  });

  footer(doc, 'Proof of account only. This is not a bank statement, a tax document, or evidence of any payment having been made or received.');
  doc.save(`${proof.proofId}.pdf`);
}

/** Account Agreement / Payout Agreement. */
export async function agreementPdf(response: AgreementResponse): Promise<void> {
  const { jsPDF } = await loadPdf();
  const doc = new jsPDF();
  const agreement = response.agreement;
  const clauses = agreement.clauses ?? agreement.sections ?? [];
  const isPayout = agreement.type === 'payout';

  header(
    doc,
    isPayout ? 'Agreement / Payout Terms' : 'Account Agreement',
    `${agreement.agreementId ?? 'Account agreement'} · issued ${whenLabel(agreement.issuedAt ?? new Date().toISOString())}`,
  );

  let y = 54;
  doc.setFontSize(10);
  if (agreement.party) {
    doc.setTextColor(...MUTED);
    doc.text(`Between ${agreement.party.name} (${agreement.party.email}) and Mudrexx Earn.`, 14, y, {
      maxWidth: 182,
    });
    y += 12;
  }

  clauses.forEach((clause, index) => {
    const heading = clause.heading ?? clause.title ?? `Clause ${index + 1}`;
    const body = clause.body ?? clause.text ?? '';
    if (y > 262) {
      doc.addPage();
      y = 24;
    }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    doc.setFontSize(10.5);
    doc.text(`${index + 1}. ${heading}`, 14, y, { maxWidth: 182 });
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(70, 76, 88);
    const lines = doc.splitTextToSize(body || 'No further detail was provided for this clause.', 182);
    doc.text(lines, 14, y);
    y += lines.length * 4.6 + 6;
  });

  if (!clauses.length) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.setFontSize(10);
    doc.text(
      'The backend returned this agreement without clause content. No terms have been invented here.',
      14,
      y,
      { maxWidth: 182 },
    );
  }

  footer(doc, 'Trading involves risk. Nothing in this agreement guarantees profit, returns, or the automatic execution of any payout.');
  doc.save(`mudrexx-${isPayout ? 'payout' : 'account'}-agreement.pdf`);
}

/** Invoice. */
export async function invoicePdf(response: InvoiceResponse): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF();
  const invoice = response.invoice;

  header(doc, 'Invoice', `${invoice.invoiceId} · issued ${whenLabel(invoice.issuedAt)} · period ${dateLabel(invoice.periodStart)} to ${dateLabel(invoice.periodEnd)}`);

  autoTable(doc, {
    startY: 52,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2.5 },
    body: [
      ['Billed to', invoice.billTo.name],
      ['Email', invoice.billTo.email],
      ['User id', invoice.billTo.userId],
      ['Invitation code', invoice.billTo.inviteCode || '—'],
    ],
  });

  const items = invoice.items ?? [];
  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
    head: [['Description', 'Amount']],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: INK, textColor: [238, 194, 104], fontStyle: 'bold' },
    body: items.length
      ? items.map((item) => {
          const record = item as Record<string, unknown>;
          return [
            String(record.description ?? record.title ?? record.label ?? 'Line item'),
            String(record.amount ?? record.value ?? '—'),
          ];
        })
      : [['No billable line items in this period', '—']],
  });

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
    theme: 'plain',
    styles: { fontSize: 9.5, cellPadding: 2.5, fontStyle: 'bold' },
    body: [
      ['Subtotal (INR)', money(invoice.totals.subtotalInr)],
      ['Total (INR)', money(invoice.totals.totalInr ?? invoice.totals.subtotalInr)],
      ...(typeof invoice.totals.subtotalUsdt === 'number'
        ? ([['Subtotal (USDT)', `₮${invoice.totals.subtotalUsdt.toLocaleString('en-US')}`]] as string[][])
        : []),
    ],
  });

  footer(doc, 'Generated from live account data. Amounts reflect recorded activity and are not a tax invoice unless your jurisdiction treats them as one.');
  doc.save(`${invoice.invoiceId}.pdf`);
}
