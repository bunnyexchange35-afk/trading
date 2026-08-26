# Database Migrations

This directory contains database migration files for the Mudrexx Earn platform.

## Migration Files

### 001_add_account_documents.sql

This migration adds support for account documents including:

1. **Account Statements** - Comprehensive transaction history and balance snapshots
2. **Account Proofs** - Official verification documents for account status
3. **Account Agreements** - Terms and conditions with user acceptance records
4. **Document Generation Log** - Audit trail for all generated documents

## Tables Created

### account_statements
Stores generated account statements with:
- Account holder information
- Balance snapshots (Real, USDT, Frozen, Demo)
- Transaction summaries
- Full transaction and frozen items data (JSONB)

### account_proofs
Stores proof of account documents with:
- Account holder details
- Account status and verification info
- Balance snapshots
- Verification details (email, phone, 2FA)

### account_agreements
Stores account agreements with:
- Account holder information
- Terms and conditions (stored as JSONB)
- User acceptance records
- IP address and user agent for audit

### document_generation_log
Audit trail for document generation:
- User email
- Document type (statement, proof, agreement)
- Document ID
- Generation timestamp
- IP address and user agent

## Views

### user_recent_statements
Shows statements generated in the last 30 days per user.

### active_account_proofs
Shows proofs that are still valid (not expired).

### document_generation_stats
Shows statistics about document generation per user and type.

## Running Migrations

### PostgreSQL
```bash
psql -U your_username -d your_database -f database/migrations/001_add_account_documents.sql
```

### MySQL
Note: The migration is written for PostgreSQL. For MySQL, you'll need to:
1. Replace `SERIAL` with `INT AUTO_INCREMENT`
2. Replace `JSONB` with `JSON`
3. Replace `TIMESTAMP WITH TIME ZONE` with `TIMESTAMP`
4. Adjust boolean syntax if needed

### SQLite
For development/testing with SQLite:
```bash
sqlite3 your_database.db < database/migrations/001_add_account_documents.sql
```

## Current Implementation

The current implementation uses JSON file storage (`server/data/users.json`) for simplicity. The database migration is provided for:

1. **Production deployments** - When you need a proper database
2. **Scalability** - When you need to handle many users
3. **Audit requirements** - When you need proper audit trails
4. **Reporting** - When you need to generate reports from document data

## Migration Strategy

If you're migrating from JSON file storage to a database:

1. **Backup your data** - Always backup `server/data/users.json` first
2. **Run the migration** - Create the tables using the SQL file
3. **Export existing data** - Write a script to export JSON data to the database
4. **Update server.mjs** - Modify the server to use database queries instead of JSON
5. **Test thoroughly** - Ensure all features work with the new database

## Environment Variables

When using a database, you'll need to set these environment variables:

```bash
# Database connection
DATABASE_URL=postgresql://user:password@localhost:5432/mudrexx_earn

# Or individual variables
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mudrexx_earn
DB_USER=your_username
DB_PASSWORD=your_password
```

## Backup Recommendations

1. **Regular backups** - Schedule daily backups of the database
2. **Test restores** - Regularly test restoring from backups
3. **Offsite storage** - Store backups in a different location
4. **Encryption** - Encrypt sensitive backup data

## Security Considerations

1. **Access control** - Limit database access to application user only
2. **Encryption** - Encrypt sensitive data at rest
3. **Audit logging** - Enable database audit logging
4. **Regular updates** - Keep database software updated
5. **Monitoring** - Monitor for unusual database activity
