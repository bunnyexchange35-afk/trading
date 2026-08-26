# Account Documents Feature

This document describes the implementation of the Account Documents feature, which allows users to generate and download official account documents in PDF format.

## Features

### 1. Account Statement
- **Description**: Comprehensive transaction history and balance snapshot
- **Contents**:
  - Account holder information
  - Balance summary (Real, Frozen, Demo)
  - Transaction history (last 20 transactions)
  - Frozen funds details
  - Asset holdings summary
  - Transaction statistics

### 2. Proof of Account
- **Description**: Official verification document for account status
- **Contents**:
  - Document information (ID, issued date, validity)
  - Account holder details
  - Account status (active, verified, KYC)
  - Current balance snapshot
  - Verification details (email, phone, 2FA)
  - Account age and activity

### 3. Account Agreement
- **Description**: Terms and conditions with user acceptance record
- **Contents**:
  - Agreement information (ID, version, dates)
  - Account holder details
  - Terms and conditions sections:
    - Account Terms
    - Trading Risks
    - Demo Account
    - Fees and Charges
    - Privacy Policy
  - User acceptance record
  - Signature lines

## Implementation Details

### Backend (server.mjs)

#### New API Endpoints

1. **GET /api/account/statement**
   - Returns comprehensive account statement data
   - Requires authentication
   - Query parameter: `email`

2. **GET /api/account/proof**
   - Returns proof of account verification
   - Requires authentication
   - Query parameter: `email`

3. **GET /api/account/agreement**
   - Returns account agreement with terms
   - Requires authentication
   - Query parameter: `email`

#### Data Structure

All endpoints return JSON data that can be used to generate PDF documents.

### Frontend

#### API Client (src/api.ts)

Added new types and functions:
- `AccountStatement`, `AccountProof`, `AccountAgreement` types
- `getAccountStatement()`, `getAccountProof()`, `getAccountAgreement()` functions

#### PDF Generation (src/pdf-utils.ts)

Utility functions for generating professional PDF documents:
- `generateStatementPDF()` - Creates account statement PDF
- `generateProofPDF()` - Creates proof of account PDF
- `generateAgreementPDF()` - Creates account agreement PDF
- `downloadPDF()` - Triggers PDF download

#### UI Components (src/AccountPages.tsx)

Added `AccountDocumentsSection` component with:
- Three document cards (Statement, Proof, Agreement)
- Download buttons with loading states
- Document history section
- Information banner

#### Styles (src/styles.css)

Added CSS styles for:
- Document cards grid layout
- Document icons and info sections
- History items
- Loading animations
- Responsive design

### Database (database/migrations/)

Created migration file `001_add_account_documents.sql` with:
- `account_statements` table
- `account_proofs` table
- `account_agreements` table
- `document_generation_log` table
- Views for easy querying
- Indexes for performance

## Usage

### For Users

1. **Login** to your account
2. **Navigate** to Profile page
3. **Scroll down** to "Account Documents" section
4. **Click** the download button for desired document
5. **PDF** will be generated and downloaded automatically

### For Developers

#### Starting the Server

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or start production server
npm start
```

#### Testing the Feature

```bash
# Run the test script
node test-account-documents.js
```

#### Database Migration

```bash
# PostgreSQL
psql -U your_username -d your_database -f database/migrations/001_add_account_documents.sql

# SQLite (for development)
sqlite3 your_database.db < database/migrations/001_add_account_documents.sql
```

## File Structure

```
trading/
├── server.mjs                          # Backend API endpoints
├── src/
│   ├── api.ts                          # Frontend API client
│   ├── pdf-utils.ts                    # PDF generation utilities
│   ├── AccountPages.tsx                # UI components
│   └── styles.css                      # CSS styles
├── database/
│   ├── migrations/
│   │   └── 001_add_account_documents.sql
│   └── README.md
├── test-account-documents.js           # Test script
└── ACCOUNT_DOCUMENTS_README.md         # This file
```

## API Response Examples

### Account Statement Response

```json
{
  "success": true,
  "statement": {
    "statementId": "STMT-1234567890-ABC123",
    "generatedAt": "2026-08-26T10:30:00.000Z",
    "accountHolder": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "registeredAt": "2024-01-15T08:00:00.000Z",
      "inviteCode": "MUD-ABC12345"
    },
    "balances": {
      "realBalance": 50000,
      "realUsdtBalance": 0,
      "frozenBalance": 10000,
      "frozenUsdtBalance": 0,
      "demoBalance": 10000,
      "totalRealBalance": 60000,
      "totalUsdtBalance": 0,
      "totalConverted": 5000
    },
    "transactions": [...],
    "frozenItems": [...],
    "assetHoldings": {...},
    "summary": {
      "totalTransactions": 25,
      "totalDeposits": 5,
      "totalWithdrawals": 2,
      "totalConversions": 3,
      "totalTrades": 15
    }
  }
}
```

### Account Proof Response

```json
{
  "success": true,
  "proof": {
    "proofId": "PROOF-1234567890-XYZ789",
    "issuedAt": "2026-08-26T10:30:00.000Z",
    "validUntil": "2026-09-25T10:30:00.000Z",
    "platform": "Mudrexx Earn",
    "accountHolder": {...},
    "accountStatus": {
      "isActive": true,
      "isVerified": true,
      "kycStatus": "completed",
      "accountType": "standard"
    },
    "balances": {...},
    "verification": {
      "emailVerified": true,
      "phoneVerified": true,
      "twoFactorEnabled": false,
      "lastLogin": "2026-08-26T10:30:00.000Z",
      "accountAge": 589
    },
    "disclaimer": "This document serves as proof of account existence..."
  }
}
```

### Account Agreement Response

```json
{
  "success": true,
  "agreement": {
    "agreementId": "AGR-1234567890-DEF456",
    "issuedAt": "2026-08-26T10:30:00.000Z",
    "platform": "Mudrexx Earn",
    "accountHolder": {...},
    "terms": {
      "version": "1.0",
      "acceptedAt": "2024-01-15T08:00:00.000Z",
      "lastUpdated": "2024-01-01T00:00:00.000Z",
      "sections": [
        {
          "title": "Account Terms",
          "content": "Your account is subject to the platform rules..."
        },
        ...
      ]
    },
    "userAcceptance": {
      "hasAccepted": true,
      "acceptedAt": "2024-01-15T08:00:00.000Z",
      "ipAddress": "Recorded at registration",
      "userAgent": "Recorded at registration"
    },
    "disclaimer": "This agreement is between you and Mudrexx Earn..."
  }
}
```

## PDF Document Features

### Professional Design
- Company branding with purple theme
- Clean, readable layout
- Professional typography
- Consistent styling across all documents

### Content Organization
- Clear section headers
- Structured data tables
- Proper spacing and margins
- Footer with generation timestamp

### Document Elements
- **Header**: Platform name, document title, ID
- **Sections**: Clearly labeled sections with content
- **Tables**: Formatted data tables for balances, transactions
- **Footer**: Generation date, platform info, page numbers
- **Disclaimers**: Important notices and legal text

### File Naming
- Statements: `account-statement-{ID}.pdf`
- Proofs: `proof-of-account-{ID}.pdf`
- Agreements: `account-agreement-{ID}.pdf`

## Security Considerations

1. **Authentication Required**: All endpoints require valid authentication
2. **User Isolation**: Users can only access their own documents
3. **Data Validation**: All input data is validated
4. **Error Handling**: Proper error messages without sensitive info
5. **Rate Limiting**: Consider implementing rate limiting for production

## Future Enhancements

1. **Document Storage**: Store generated documents for later access
2. **Email Delivery**: Send documents via email
3. **Custom Date Ranges**: Allow users to select date ranges for statements
4. **Multiple Formats**: Support for CSV, Excel formats
5. **Scheduled Generation**: Automatic monthly statements
6. **Digital Signatures**: Add digital signature support
7. **Multi-language**: Support for multiple languages
8. **Branding Customization**: Allow platform branding customization

## Troubleshooting

### Common Issues

1. **PDF not downloading**
   - Check browser popup blocker
   - Ensure JavaScript is enabled
   - Check browser console for errors

2. **API errors**
   - Verify server is running
   - Check authentication token
   - Verify email parameter

3. **TypeScript errors**
   - Run `npm run typecheck` to identify issues
   - Ensure all types are properly defined

### Debug Mode

Enable debug logging in the browser console:
```javascript
localStorage.setItem('debug', 'true');
```

## Support

For issues or questions:
1. Check the browser console for errors
2. Review the server logs
3. Test with the provided test script
4. Check API responses for error messages

## License

This feature is part of the Mudrexx Earn platform and follows the same licensing terms.
