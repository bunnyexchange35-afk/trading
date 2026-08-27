/**
 * PDF Generation Utilities for Account Documents
 * Generates professional PDF documents for account statements, proof, and agreements
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { AccountStatement, AccountProof, AccountAgreement, AccountInvoice } from './api';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const PLATFORM_NAME = 'Mudrexx Earn';
const PLATFORM_TAGLINE = 'Secure Trading Platform';
const PRIMARY_COLOR = '#7c3aed'; // Purple
const SECONDARY_COLOR = '#1e1b4b'; // Dark purple
const ACCENT_COLOR = '#059669'; // Green
const TEXT_COLOR = '#1f2937';
const LIGHT_TEXT_COLOR = '#6b7280';
const BORDER_COLOR = '#e5e7eb';

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  // Header background
  doc.setFillColor(PRIMARY_COLOR);
  doc.rect(0, 0, 210, 45, 'F');
  
  // Platform name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(PLATFORM_NAME, 15, 15);
  
  // Title
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 15, 28);
  
  // Subtitle
  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 15, 36);
  }
  
  // Reset text color
  doc.setTextColor(TEXT_COLOR);
}

function addFooter(doc: jsPDF, pageNumber: number) {
  const pageHeight = doc.internal.pageSize.height;
  
  // Footer line
  doc.setDrawColor(BORDER_COLOR);
  doc.setLineWidth(0.5);
  doc.line(15, pageHeight - 20, 195, pageHeight - 20);
  
  // Footer text
  doc.setFontSize(8);
  doc.setTextColor(LIGHT_TEXT_COLOR);
  doc.text(`Generated on ${new Date().toLocaleString()}`, 15, pageHeight - 12);
  doc.text(`${PLATFORM_NAME} - ${PLATFORM_TAGLINE}`, 105, pageHeight - 12, { align: 'center' });
  doc.text(`Page ${pageNumber}`, 195, pageHeight - 12, { align: 'right' });
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(SECONDARY_COLOR);
  doc.text(title, 15, y);
  
  // Underline
  doc.setDrawColor(PRIMARY_COLOR);
  doc.setLineWidth(0.5);
  doc.line(15, y + 2, 195, y + 2);
  
  return y + 10;
}

function addKeyValue(doc: jsPDF, key: string, value: string, x: number, y: number, maxWidth = 80): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(LIGHT_TEXT_COLOR);
  doc.text(key, x, y);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(TEXT_COLOR);
  const lines = doc.splitTextToSize(value, maxWidth);
  doc.text(lines, x + 45, y);
  
  return y + (lines.length * 5) + 3;
}

export function generateStatementPDF(statement: AccountStatement): jsPDF {
  const doc = new jsPDF();
  
  // Header
  addHeader(doc, 'Account Statement', `Statement ID: ${statement.statementId}`);
  
  let y = 55;
  
  // Account Holder Information
  y = addSectionTitle(doc, 'Account Holder Information', y);
  y = addKeyValue(doc, 'Name:', statement.accountHolder.name, 15, y);
  y = addKeyValue(doc, 'Email:', statement.accountHolder.email, 15, y);
  y = addKeyValue(doc, 'Phone:', statement.accountHolder.phone || 'Not provided', 15, y);
  y = addKeyValue(doc, 'Registered:', new Date(statement.accountHolder.registeredAt).toLocaleDateString(), 15, y);
  y = addKeyValue(doc, 'Invite Code:', statement.accountHolder.inviteCode || 'N/A', 15, y);
  
  y += 5;
  
  // Balance Summary
  y = addSectionTitle(doc, 'Balance Summary', y);
  
  const balanceData = [
    ['Real Balance (INR)', `₹${statement.balances.realBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
    ['Real Balance (USDT)', `₮${statement.balances.realUsdtBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
    ['Frozen Balance (INR)', `₹${statement.balances.frozenBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
    ['Frozen Balance (USDT)', `₮${statement.balances.frozenUsdtBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
    ['Demo Balance', `${statement.balances.demoBalance.toLocaleString()} Credits`],
    ['Total Real Balance', `₹${statement.balances.totalRealBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
    ['Total Converted', `${statement.balances.totalConverted.toLocaleString()} Credits`],
  ];
  
  doc.autoTable({
    startY: y,
    head: [['Description', 'Amount']],
    body: balanceData,
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  
  y = (doc as any).lastAutoTable.finalY + 10;
  
  // Transaction Summary
  y = addSectionTitle(doc, 'Transaction Summary', y);
  
  const summaryData = [
    ['Total Transactions', statement.summary.totalTransactions.toString()],
    ['Deposits', statement.summary.totalDeposits.toString()],
    ['Withdrawals', statement.summary.totalWithdrawals.toString()],
    ['Conversions', statement.summary.totalConversions.toString()],
    ['Trades', statement.summary.totalTrades.toString()],
  ];
  
  doc.autoTable({
    startY: y,
    head: [['Category', 'Count']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: ACCENT_COLOR, textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  
  y = (doc as any).lastAutoTable.finalY + 10;
  
  // Recent Transactions (last 20)
  if (statement.transactions.length > 0) {
    // Check if we need a new page
    if (y > 250) {
      addFooter(doc, 1);
      doc.addPage();
      y = 20;
    }
    
    y = addSectionTitle(doc, 'Recent Transactions', y);
    
    const transactionData = statement.transactions.slice(0, 20).map(tx => [
      tx.title,
      tx.description.substring(0, 40) + (tx.description.length > 40 ? '...' : ''),
      tx.time,
      `${tx.currency === 'INR' ? '₹' : tx.currency === 'USDT' ? '₮' : ''}${tx.amount.toLocaleString('en-IN', { minimumFractionDigits: tx.currency === 'CREDITS' ? 0 : 2 })}`,
      tx.status,
    ]);
    
    doc.autoTable({
      startY: y,
      head: [['Title', 'Description', 'Time', 'Amount', 'Status']],
      body: transactionData,
      theme: 'grid',
      headStyles: { fillColor: SECONDARY_COLOR, textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 50 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
      },
      margin: { left: 15, right: 15 },
    });
    
    y = (doc as any).lastAutoTable.finalY + 10;
  }
  
  // Frozen Items
  if (statement.frozenItems.length > 0) {
    // Check if we need a new page
    if (y > 250) {
      addFooter(doc, doc.getNumberOfPages());
      doc.addPage();
      y = 20;
    }
    
    y = addSectionTitle(doc, 'Frozen Funds', y);
    
    const frozenData = statement.frozenItems.map(item => [
      item.title,
      item.category,
      `${item.currency === 'INR' ? '₹' : '₮'}${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      item.status,
      item.date,
    ]);
    
    doc.autoTable({
      startY: y,
      head: [['Title', 'Category', 'Amount', 'Status', 'Date']],
      body: frozenData,
      theme: 'grid',
      headStyles: { fillColor: '#dc2626', textColor: 255 },
      styles: { fontSize: 8 },
      margin: { left: 15, right: 15 },
    });
  }
  
  // Add footer to all pages
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i);
    addFooter(doc, i);
  }
  
  return doc;
}

export function generateProofPDF(proof: AccountProof): jsPDF {
  const doc = new jsPDF();
  
  // Header
  addHeader(doc, 'Proof of Account', `Document ID: ${proof.proofId}`);
  
  let y = 55;
  
  // Document Information
  y = addSectionTitle(doc, 'Document Information', y);
  y = addKeyValue(doc, 'Document ID:', proof.proofId, 15, y);
  y = addKeyValue(doc, 'Issued At:', new Date(proof.issuedAt).toLocaleString(), 15, y);
  y = addKeyValue(doc, 'Valid Until:', new Date(proof.validUntil).toLocaleDateString(), 15, y);
  y = addKeyValue(doc, 'Platform:', proof.platform, 15, y);
  
  y += 5;
  
  // Account Holder
  y = addSectionTitle(doc, 'Account Holder Details', y);
  y = addKeyValue(doc, 'Full Name:', proof.accountHolder.name, 15, y);
  y = addKeyValue(doc, 'Email:', proof.accountHolder.email, 15, y);
  y = addKeyValue(doc, 'Phone:', proof.accountHolder.phone || 'Not provided', 15, y);
  y = addKeyValue(doc, 'Registered:', new Date(proof.accountHolder.registeredAt).toLocaleDateString(), 15, y);
  y = addKeyValue(doc, 'Invite Code:', proof.accountHolder.inviteCode || 'N/A', 15, y);
  y = addKeyValue(doc, 'Invited By:', proof.accountHolder.invitedBy || 'Direct registration', 15, y);
  
  y += 5;
  
  // Account Status
  y = addSectionTitle(doc, 'Account Status', y);
  
  const statusData = [
    ['Account Active', proof.accountStatus.isActive ? 'Yes' : 'No'],
    ['Account Verified', proof.accountStatus.isVerified ? 'Yes' : 'No'],
    ['KYC Status', proof.accountStatus.kycStatus],
    ['Account Type', proof.accountStatus.accountType],
  ];
  
  doc.autoTable({
    startY: y,
    head: [['Property', 'Status']],
    body: statusData,
    theme: 'grid',
    headStyles: { fillColor: ACCENT_COLOR, textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  
  y = (doc as any).lastAutoTable.finalY + 10;
  
  // Balance Information
  y = addSectionTitle(doc, 'Current Balances', y);
  
  const balanceData = [
    ['Real Balance (INR)', `₹${proof.balances.realBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
    ['Real Balance (USDT)', `₮${proof.balances.realUsdtBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
    ['Frozen Balance (INR)', `₹${proof.balances.frozenBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
    ['Frozen Balance (USDT)', `₮${proof.balances.frozenUsdtBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
    ['Demo Balance', `${proof.balances.demoBalance.toLocaleString()} Credits`],
    ['Total Real Balance', `₹${proof.balances.totalRealBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
  ];
  
  doc.autoTable({
    startY: y,
    head: [['Description', 'Amount']],
    body: balanceData,
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  
  y = (doc as any).lastAutoTable.finalY + 10;
  
  // Verification Details
  y = addSectionTitle(doc, 'Verification Details', y);
  
  const verificationData = [
    ['Email Verified', proof.verification.emailVerified ? 'Yes' : 'No'],
    ['Phone Verified', proof.verification.phoneVerified ? 'Yes' : 'No'],
    ['2FA Enabled', proof.verification.twoFactorEnabled ? 'Yes' : 'No'],
    ['Account Age', `${proof.verification.accountAge} days`],
    ['Last Login', new Date(proof.verification.lastLogin).toLocaleString()],
  ];
  
  doc.autoTable({
    startY: y,
    head: [['Verification', 'Status']],
    body: verificationData,
    theme: 'grid',
    headStyles: { fillColor: '#2563eb', textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  
  y = (doc as any).lastAutoTable.finalY + 15;
  
  // Disclaimer
  if (y > 250) {
    addFooter(doc, 1);
    doc.addPage();
    y = 20;
  }
  
  doc.setFillColor('#fef3c7');
  doc.roundedRect(15, y, 180, 25, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#92400e');
  doc.text('DISCLAIMER', 20, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const disclaimerLines = doc.splitTextToSize(proof.disclaimer, 170);
  doc.text(disclaimerLines, 20, y + 13);
  
  // Add footer to all pages
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i);
    addFooter(doc, i);
  }
  
  return doc;
}

export function generateAgreementPDF(agreement: AccountAgreement, titleOverride?: string): jsPDF {
  const doc = new jsPDF();

  // Header
  addHeader(doc, titleOverride || 'Account Agreement', `Agreement ID: ${agreement.agreementId}`);
  
  let y = 55;
  
  // Agreement Information
  y = addSectionTitle(doc, 'Agreement Information', y);
  y = addKeyValue(doc, 'Agreement ID:', agreement.agreementId, 15, y);
  y = addKeyValue(doc, 'Issued At:', new Date(agreement.issuedAt).toLocaleString(), 15, y);
  y = addKeyValue(doc, 'Platform:', agreement.platform, 15, y);
  y = addKeyValue(doc, 'Terms Version:', agreement.terms.version, 15, y);
  y = addKeyValue(doc, 'Accepted At:', new Date(agreement.terms.acceptedAt).toLocaleString(), 15, y);
  
  y += 5;
  
  // Account Holder
  y = addSectionTitle(doc, 'Account Holder', y);
  y = addKeyValue(doc, 'Name:', agreement.accountHolder.name, 15, y);
  y = addKeyValue(doc, 'Email:', agreement.accountHolder.email, 15, y);
  y = addKeyValue(doc, 'Registered:', new Date(agreement.accountHolder.registeredAt).toLocaleDateString(), 15, y);
  
  y += 5;
  
  // Terms and Conditions
  y = addSectionTitle(doc, 'Terms and Conditions', y);
  
  for (const section of agreement.terms.sections) {
    // Check if we need a new page
    if (y > 260) {
      addFooter(doc, doc.getNumberOfPages());
      doc.addPage();
      y = 20;
    }
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(SECONDARY_COLOR);
    doc.text(section.title, 15, y);
    y += 6;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_COLOR);
    const contentLines = doc.splitTextToSize(section.content, 180);
    doc.text(contentLines, 15, y);
    y += contentLines.length * 5 + 8;
  }
  
  // User Acceptance
  if (y > 250) {
    addFooter(doc, doc.getNumberOfPages());
    doc.addPage();
    y = 20;
  }
  
  y = addSectionTitle(doc, 'User Acceptance', y);
  
  const acceptanceData = [
    ['Has Accepted', agreement.userAcceptance.hasAccepted ? 'Yes' : 'No'],
    ['Accepted At', new Date(agreement.userAcceptance.acceptedAt).toLocaleString()],
    ['IP Address', agreement.userAcceptance.ipAddress],
    ['User Agent', agreement.userAcceptance.userAgent],
  ];
  
  doc.autoTable({
    startY: y,
    head: [['Field', 'Value']],
    body: acceptanceData,
    theme: 'grid',
    headStyles: { fillColor: ACCENT_COLOR, textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  
  y = (doc as any).lastAutoTable.finalY + 15;
  
  // Disclaimer
  if (y > 250) {
    addFooter(doc, doc.getNumberOfPages());
    doc.addPage();
    y = 20;
  }
  
  doc.setFillColor('#fef3c7');
  doc.roundedRect(15, y, 180, 25, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#92400e');
  doc.text('IMPORTANT NOTICE', 20, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const disclaimerLines = doc.splitTextToSize(agreement.disclaimer, 170);
  doc.text(disclaimerLines, 20, y + 13);
  
  // Signature line
  y += 35;
  if (y > 260) {
    addFooter(doc, doc.getNumberOfPages());
    doc.addPage();
    y = 20;
  }
  
  doc.setDrawColor(TEXT_COLOR);
  doc.setLineWidth(0.5);
  doc.line(15, y, 90, y);
  doc.line(120, y, 195, y);
  
  doc.setFontSize(8);
  doc.setTextColor(LIGHT_TEXT_COLOR);
  doc.text('Account Holder Signature', 15, y + 5);
  doc.text('Date', 120, y + 5);
  
  // Add footer to all pages
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i);
    addFooter(doc, i);
  }
  
  return doc;
}

/** Invoice PDF — every figure comes from the backend invoice payload. */
export function generateInvoicePDF(invoice: AccountInvoice): jsPDF {
  const doc = new jsPDF();

  addHeader(doc, 'Invoice', `Invoice ID: ${invoice.invoiceId}`);

  let y = 55;

  // Invoice information
  y = addSectionTitle(doc, 'Invoice Information', y);
  y = addKeyValue(doc, 'Invoice ID:', invoice.invoiceId, 15, y);
  y = addKeyValue(doc, 'Issued At:', new Date(invoice.issuedAt).toLocaleString(), 15, y);
  y = addKeyValue(doc, 'Period:', `${new Date(invoice.periodStart).toLocaleDateString()} – ${new Date(invoice.periodEnd).toLocaleDateString()}`, 15, y);

  y += 5;

  // Bill To
  y = addSectionTitle(doc, 'Bill To', y);
  y = addKeyValue(doc, 'Name:', invoice.billTo.name, 15, y);
  y = addKeyValue(doc, 'Email:', invoice.billTo.email, 15, y);
  if (invoice.billTo.phone) y = addKeyValue(doc, 'Phone:', invoice.billTo.phone, 15, y);
  y = addKeyValue(doc, 'User ID:', invoice.billTo.userId || '—', 15, y);
  y = addKeyValue(doc, 'Invite Code:', invoice.billTo.inviteCode || '—', 15, y);

  y += 5;

  // Line items
  y = addSectionTitle(doc, 'Line Items', y);

  if (invoice.items.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(LIGHT_TEXT_COLOR);
    doc.text('No credited funds were recorded in this period.', 15, y);
    y += 10;
  } else {
    doc.autoTable({
      startY: y,
      head: [['#', 'Description', 'Date', 'Amount']],
      body: invoice.items.map((item) => [
        String(item.position),
        item.description,
        String(item.date),
        `${item.currency === 'USDT' ? '₮ ' : '₹ '}${item.amount.toLocaleString('en-IN')}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: PRIMARY_COLOR, textColor: 255 },
      styles: { fontSize: 8 },
      margin: { left: 15, right: 15 },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Totals
  if (y > 240) {
    addFooter(doc, doc.getNumberOfPages());
    doc.addPage();
    y = 20;
  }
  y = addSectionTitle(doc, 'Totals', y);
  doc.autoTable({
    startY: y,
    head: [['Field', 'Value']],
    body: [
      ['Subtotal (INR)', `₹ ${invoice.totals.subtotalInr.toLocaleString('en-IN')}`],
      ['Subtotal (USDT)', `₮ ${invoice.totals.subtotalUsdt.toLocaleString('en-IN')}`],
      ['Platform Fee', `₹ ${invoice.totals.platformFee.toLocaleString('en-IN')}`],
      ['Tax', `₹ ${invoice.totals.tax.toLocaleString('en-IN')}`],
      ['Total (INR)', `₹ ${invoice.totals.totalInr.toLocaleString('en-IN')}`],
      ['Balance Due', `₹ ${invoice.totals.balanceDue.toLocaleString('en-IN')}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: ACCENT_COLOR, textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Notes
  if (y > 235) {
    addFooter(doc, doc.getNumberOfPages());
    doc.addPage();
    y = 20;
  }
  doc.setFillColor('#eef2ff');
  doc.roundedRect(15, y, 180, 22, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(SECONDARY_COLOR);
  doc.text('NOTES', 20, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const noteLines = doc.splitTextToSize(invoice.notes, 170);
  doc.text(noteLines, 20, y + 11);

  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i);
    addFooter(doc, i);
  }

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(filename);
}
