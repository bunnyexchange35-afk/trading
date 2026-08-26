# Account Documents Feature Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                           │
├─────────────────────────────────────────────────────────────────┤
│  Profile Page                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Account Documents Section                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │  Statement  │  │    Proof    │  │  Agreement  │    │   │
│  │  │   Card      │  │    Card     │  │    Card     │    │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │   │
│  │         │                │                │            │   │
│  │         ▼                ▼                ▼            │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │           Download Buttons                      │   │   │
│  │  │  [Download Statement] [Download Proof] [Download]│   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API CLIENT (api.ts)                        │
├─────────────────────────────────────────────────────────────────┤
│  Functions:                                                     │
│  • getAccountStatement(email)                                   │
│  • getAccountProof(email)                                       │
│  • getAccountAgreement(email)                                   │
│                                                                 │
│  Types:                                                         │
│  • AccountStatement                                             │
│  • AccountProof                                                 │
│  • AccountAgreement                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND API (server.mjs)                     │
├─────────────────────────────────────────────────────────────────┤
│  Endpoints:                                                     │
│  GET /api/account/statement?email=...                           │
│  GET /api/account/proof?email=...                               │
│  GET /api/account/agreement?email=...                           │
│                                                                 │
│  Authentication: Required (Bearer token)                        │
│  Data Source: In-memory user database (JSON)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PDF GENERATION (pdf-utils.ts)                │
├─────────────────────────────────────────────────────────────────┤
│  Functions:                                                     │
│  • generateStatementPDF(statement)                              │
│  • generateProofPDF(proof)                                      │
│  • generateAgreementPDF(agreement)                              │
│  • downloadPDF(doc, filename)                                   │
│                                                                 │
│  Library: jsPDF + jspdf-autotable                               │
│  Output: Professional PDF documents                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      USER'S DEVICE                              │
├─────────────────────────────────────────────────────────────────┤
│  Downloads Folder:                                              │
│  • account-statement-{ID}.pdf                                   │
│  • proof-of-account-{ID}.pdf                                    │
│  • account-agreement-{ID}.pdf                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User clicks "Download Statement"
         │
         ▼
┌─────────────────┐
│  Frontend       │
│  Component      │
│  (AccountPages) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Client     │
│  (api.ts)       │
│  getAccount     │
│  Statement()    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  HTTP Request   │
│  GET /api/      │
│  account/       │
│  statement      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Backend        │
│  (server.mjs)   │
│  /api/account/  │
│  statement      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Database  │
│  (In-memory     │
│   JSON store)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Generate       │
│  Statement      │
│  Data           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Return JSON    │
│  Response       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Frontend       │
│  Receives Data  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PDF Generation │
│  (pdf-utils.ts) │
│  generate       │
│  StatementPDF() │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Download PDF   │
│  (browser       │
│   download)     │
└─────────────────┘
```

## Component Structure

```
AccountDocumentsSection
├── Document Cards
│   ├── Account Statement Card
│   │   ├── Icon (History)
│   │   ├── Title & Description
│   │   ├── Features List
│   │   └── Download Button
│   │
│   ├── Proof of Account Card
│   │   ├── Icon (ShieldCheck)
│   │   ├── Title & Description
│   │   ├── Features List
│   │   └── Download Button
│   │
│   └── Account Agreement Card
│       ├── Icon (BookOpen)
│       ├── Title & Description
│       ├── Features List
│       └── Download Button
│
├── Document History
│   ├── Statement History Item
│   ├── Proof History Item
│   └── Agreement History Item
│
└── Information Banner
    └── About Account Documents
```

## PDF Document Structure

### Account Statement PDF

```
┌─────────────────────────────────────────┐
│  HEADER                                 │
│  Mudrexx Earn                           │
│  Account Statement                      │
│  Statement ID: STMT-...                 │
├─────────────────────────────────────────┤
│  ACCOUNT HOLDER INFORMATION             │
│  Name: John Doe                         │
│  Email: john@example.com                │
│  Phone: +1234567890                     │
│  Registered: Jan 15, 2024               │
├─────────────────────────────────────────┤
│  BALANCE SUMMARY                        │
│  ┌─────────────────┬─────────────────┐  │
│  │ Description     │ Amount          │  │
│  ├─────────────────┼─────────────────┤  │
│  │ Real Balance    │ ₹50,000.00      │  │
│  │ Frozen Balance  │ ₹10,000.00      │  │
│  │ Demo Balance    │ 10,000 Credits  │  │
│  └─────────────────┴─────────────────┘  │
├─────────────────────────────────────────┤
│  TRANSACTION SUMMARY                    │
│  ┌─────────────────┬─────────────────┐  │
│  │ Category        │ Count           │  │
│  ├─────────────────┼─────────────────┤  │
│  │ Total           │ 25              │  │
│  │ Deposits        │ 5               │  │
│  │ Withdrawals     │ 2               │  │
│  └─────────────────┴─────────────────┘  │
├─────────────────────────────────────────┤
│  RECENT TRANSACTIONS                    │
│  ┌─────────┬─────────┬─────────┬─────┐  │
│  │ Title   │ Desc    │ Time    │ Amt │  │
│  ├─────────┼─────────┼─────────┼─────┤  │
│  │ Deposit │ UPI...  │ Today   │ ₹5K │  │
│  │ Trade   │ BTC...  │ Today   │ ₹1K │  │
│  └─────────┴─────────┴─────────┴─────┘  │
├─────────────────────────────────────────┤
│  FOOTER                                 │
│  Generated: Aug 26, 2026 10:30 AM       │
│  Mudrexx Earn - Secure Trading          │
│  Page 1 of 1                            │
└─────────────────────────────────────────┘
```

### Proof of Account PDF

```
┌─────────────────────────────────────────┐
│  HEADER                                 │
│  Mudrexx Earn                           │
│  Proof of Account                       │
│  Document ID: PROOF-...                 │
├─────────────────────────────────────────┤
│  DOCUMENT INFORMATION                   │
│  Document ID: PROOF-1234567890-XYZ789   │
│  Issued At: Aug 26, 2026 10:30 AM       │
│  Valid Until: Sep 25, 2026              │
├─────────────────────────────────────────┤
│  ACCOUNT HOLDER DETAILS                 │
│  Full Name: John Doe                    │
│  Email: john@example.com                │
│  Phone: +1234567890                     │
│  Registered: Jan 15, 2024               │
├─────────────────────────────────────────┤
│  ACCOUNT STATUS                         │
│  ┌─────────────────┬─────────────────┐  │
│  │ Property        │ Status          │  │
│  ├─────────────────┼─────────────────┤  │
│  │ Account Active  │ Yes             │  │
│  │ Verified        │ Yes             │  │
│  │ KYC Status      │ Completed       │  │
│  └─────────────────┴─────────────────┘  │
├─────────────────────────────────────────┤
│  CURRENT BALANCES                       │
│  ┌─────────────────┬─────────────────┐  │
│  │ Description     │ Amount          │  │
│  ├─────────────────┼─────────────────┤  │
│  │ Real Balance    │ ₹50,000.00      │  │
│  │ Frozen Balance  │ ₹10,000.00      │  │
│  │ Demo Balance    │ 10,000 Credits  │  │
│  └─────────────────┴─────────────────┘  │
├─────────────────────────────────────────┤
│  DISCLAIMER                             │
│  This document serves as proof of       │
│  account existence and status...        │
├─────────────────────────────────────────┤
│  FOOTER                                 │
│  Generated: Aug 26, 2026 10:30 AM       │
│  Mudrexx Earn - Secure Trading          │
│  Page 1 of 1                            │
└─────────────────────────────────────────┘
```

### Account Agreement PDF

```
┌─────────────────────────────────────────┐
│  HEADER                                 │
│  Mudrexx Earn                           │
│  Account Agreement                      │
│  Agreement ID: AGR-...                  │
├─────────────────────────────────────────┤
│  AGREEMENT INFORMATION                  │
│  Agreement ID: AGR-1234567890-DEF456    │
│  Issued At: Aug 26, 2026 10:30 AM       │
│  Terms Version: 1.0                     │
├─────────────────────────────────────────┤
│  ACCOUNT HOLDER                         │
│  Name: John Doe                         │
│  Email: john@example.com                │
│  Registered: Jan 15, 2024               │
├─────────────────────────────────────────┤
│  TERMS AND CONDITIONS                   │
│                                         │
│  1. Account Terms                       │
│  Your account is subject to the         │
│  platform rules and regulations...      │
│                                         │
│  2. Trading Risks                       │
│  Trading involves risk of loss...       │
│                                         │
│  3. Demo Account                        │
│  Demo credits are for practice...       │
│                                         │
│  4. Fees and Charges                    │
│  The platform may charge fees...        │
│                                         │
│  5. Privacy Policy                      │
│  Your personal information is...        │
├─────────────────────────────────────────┤
│  USER ACCEPTANCE                        │
│  ┌─────────────────┬─────────────────┐  │
│  │ Field           │ Value           │  │
│  ├─────────────────┼─────────────────┤  │
│  │ Has Accepted    │ Yes             │  │
│  │ Accepted At     │ Jan 15, 2024    │  │
│  │ IP Address      │ Recorded        │  │
│  └─────────────────┴─────────────────┘  │
├─────────────────────────────────────────┤
│  IMPORTANT NOTICE                       │
│  This agreement is between you and      │
│  Mudrexx Earn...                        │
├─────────────────────────────────────────┤
│  SIGNATURE                              │
│  Account Holder Signature: ___________  │
│  Date: ___________                      │
├─────────────────────────────────────────┤
│  FOOTER                                 │
│  Generated: Aug 26, 2026 10:30 AM       │
│  Mudrexx Earn - Secure Trading          │
│  Page 1 of 1                            │
└─────────────────────────────────────────┘
```

## State Management

```
AccountDocumentsSection State
├── loading: string | null
│   ├── 'statement' - Generating statement
│   ├── 'proof' - Generating proof
│   ├── 'agreement' - Generating agreement
│   └── null - Not loading
│
├── statement: AccountStatement | null
│   └── Generated statement data
│
├── proof: AccountProof | null
│   └── Generated proof data
│
└── agreement: AccountAgreement | null
    └── Generated agreement data
```

## Error Handling

```
User Action
    │
    ▼
┌─────────────────┐
│  Try to         │
│  generate       │
│  document       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Call       │
│  Success?       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐  ┌───────┐
│  Yes  │  │  No   │
└───┬───┘  └───┬───┘
    │          │
    ▼          ▼
┌───────┐  ┌───────┐
│Generate│  │Show   │
│  PDF   │  │Error  │
└───┬───┘  │Toast  │
    │      └───────┘
    ▼
┌───────┐
│Download│
│  PDF   │
└───┬───┘
    │
    ▼
┌───────┐
│Show   │
│Success│
│Toast  │
└───────┘
```

## Performance Considerations

### Generation Time

- **Small accounts** (< 100 transactions): 1-2 seconds
- **Medium accounts** (100-1000 transactions): 2-4 seconds
- **Large accounts** (> 1000 transactions): 4-8 seconds

### File Sizes

- **Account Statement**: 50-200 KB
- **Proof of Account**: 30-100 KB
- **Account Agreement**: 40-150 KB

### Optimization Tips

1. **Cache recent documents** - Store in component state
2. **Lazy loading** - Only generate when requested
3. **Progress indicators** - Show loading state
4. **Error recovery** - Allow retry on failure

## Security Measures

### Authentication

- All API endpoints require Bearer token
- Users can only access their own documents
- Tokens are validated on each request

### Data Protection

- No documents stored on server
- Data encrypted in transit (HTTPS)
- Sensitive data masked in logs

### Privacy

- Documents contain only user's data
- No third-party data included
- User controls document distribution

## Future Enhancements

### Planned Features

1. **Document History** - Store and retrieve past documents
2. **Email Delivery** - Send documents via email
3. **Custom Date Ranges** - Select specific time periods
4. **Multiple Formats** - CSV, Excel support
5. **Scheduled Generation** - Automatic monthly statements
6. **Digital Signatures** - Cryptographic signatures
7. **Multi-language** - Support multiple languages
8. **Branding** - Customizable document branding

### Technical Improvements

1. **Web Workers** - Generate PDFs in background
2. **Streaming** - Stream large documents
3. **Compression** - Reduce file sizes
4. **Caching** - Cache generated documents
5. **CDN** - Serve documents from CDN
