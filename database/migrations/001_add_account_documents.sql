-- ============================================================================
-- Migration: Add Account Documents Support
-- Description: Adds tables and columns for account statements, proofs, and agreements
-- Date: 2026-08-26
-- ============================================================================

-- ============================================================================
-- 1. ACCOUNT STATEMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS account_statements (
    id SERIAL PRIMARY KEY,
    statement_id VARCHAR(50) UNIQUE NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Account holder snapshot
    account_holder_name VARCHAR(255) NOT NULL,
    account_holder_email VARCHAR(255) NOT NULL,
    account_holder_phone VARCHAR(50),
    registered_at TIMESTAMP WITH TIME ZONE,
    invite_code VARCHAR(50),
    
    -- Balance snapshot
    real_balance DECIMAL(18, 2) DEFAULT 0,
    real_usdt_balance DECIMAL(18, 2) DEFAULT 0,
    frozen_balance DECIMAL(18, 2) DEFAULT 0,
    frozen_usdt_balance DECIMAL(18, 2) DEFAULT 0,
    demo_balance DECIMAL(18, 2) DEFAULT 0,
    total_real_balance DECIMAL(18, 2) DEFAULT 0,
    total_usdt_balance DECIMAL(18, 2) DEFAULT 0,
    total_converted DECIMAL(18, 2) DEFAULT 0,
    
    -- Transaction summary
    total_transactions INTEGER DEFAULT 0,
    total_deposits INTEGER DEFAULT 0,
    total_withdrawals INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    
    -- Full data stored as JSONB for flexibility
    frozen_items JSONB DEFAULT '[]',
    transactions JSONB DEFAULT '[]',
    asset_holdings JSONB DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_account_statements_user_email ON account_statements(user_email);
CREATE INDEX IF NOT EXISTS idx_account_statements_generated_at ON account_statements(generated_at);

-- ============================================================================
-- 2. ACCOUNT PROOFS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS account_proofs (
    id SERIAL PRIMARY KEY,
    proof_id VARCHAR(50) UNIQUE NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Account holder details
    account_holder_name VARCHAR(255) NOT NULL,
    account_holder_email VARCHAR(255) NOT NULL,
    account_holder_phone VARCHAR(50),
    registered_at TIMESTAMP WITH TIME ZONE,
    invite_code VARCHAR(50),
    invited_by VARCHAR(255),
    invited_by_type VARCHAR(20),
    
    -- Account status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT true,
    kyc_status VARCHAR(50) DEFAULT 'completed',
    account_type VARCHAR(50) DEFAULT 'standard',
    
    -- Balance snapshot
    real_balance DECIMAL(18, 2) DEFAULT 0,
    real_usdt_balance DECIMAL(18, 2) DEFAULT 0,
    frozen_balance DECIMAL(18, 2) DEFAULT 0,
    frozen_usdt_balance DECIMAL(18, 2) DEFAULT 0,
    demo_balance DECIMAL(18, 2) DEFAULT 0,
    total_real_balance DECIMAL(18, 2) DEFAULT 0,
    total_usdt_balance DECIMAL(18, 2) DEFAULT 0,
    
    -- Verification details
    email_verified BOOLEAN DEFAULT true,
    phone_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE,
    account_age_days INTEGER DEFAULT 0,
    
    -- Metadata
    disclaimer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_account_proofs_user_email ON account_proofs(user_email);
CREATE INDEX IF NOT EXISTS idx_account_proofs_issued_at ON account_proofs(issued_at);
CREATE INDEX IF NOT EXISTS idx_account_proofs_valid_until ON account_proofs(valid_until);

-- ============================================================================
-- 3. ACCOUNT AGREEMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS account_agreements (
    id SERIAL PRIMARY KEY,
    agreement_id VARCHAR(50) UNIQUE NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Account holder details
    account_holder_name VARCHAR(255) NOT NULL,
    account_holder_email VARCHAR(255) NOT NULL,
    registered_at TIMESTAMP WITH TIME ZONE,
    
    -- Terms details
    terms_version VARCHAR(20) NOT NULL,
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    terms_last_updated TIMESTAMP WITH TIME ZONE,
    
    -- Terms content stored as JSONB
    terms_sections JSONB NOT NULL DEFAULT '[]',
    
    -- User acceptance
    has_accepted BOOLEAN DEFAULT true,
    accepted_at TIMESTAMP WITH TIME ZONE,
    ip_address VARCHAR(50),
    user_agent TEXT,
    
    -- Metadata
    disclaimer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_account_agreements_user_email ON account_agreements(user_email);
CREATE INDEX IF NOT EXISTS idx_account_agreements_issued_at ON account_agreements(issued_at);

-- ============================================================================
-- 4. ADD COLUMNS TO EXISTING USERS TABLE (if using relational DB)
-- ============================================================================
-- Note: The current implementation uses JSON file storage, but these columns
-- are provided for future migration to a relational database.

-- ALTER TABLE users ADD COLUMN IF NOT EXISTS last_statement_at TIMESTAMP WITH TIME ZONE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS last_proof_at TIMESTAMP WITH TIME ZONE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS last_agreement_at TIMESTAMP WITH TIME ZONE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS documents_generated_count INTEGER DEFAULT 0;

-- ============================================================================
-- 5. DOCUMENT GENERATION LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_generation_log (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- 'statement', 'proof', 'agreement'
    document_id VARCHAR(50) NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50),
    user_agent TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_document_generation_log_user_email ON document_generation_log(user_email);
CREATE INDEX IF NOT EXISTS idx_document_generation_log_document_type ON document_generation_log(document_type);
CREATE INDEX IF NOT EXISTS idx_document_generation_log_generated_at ON document_generation_log(generated_at);

-- ============================================================================
-- 6. CREATE VIEWS FOR EASY QUERYING
-- ============================================================================

-- View for recent statements per user
CREATE OR REPLACE VIEW user_recent_statements AS
SELECT 
    user_email,
    statement_id,
    generated_at,
    total_real_balance,
    total_transactions
FROM account_statements
WHERE generated_at >= NOW() - INTERVAL '30 days'
ORDER BY user_email, generated_at DESC;

-- View for active proofs
CREATE OR REPLACE VIEW active_account_proofs AS
SELECT 
    user_email,
    proof_id,
    issued_at,
    valid_until,
    is_active,
    is_verified
FROM account_proofs
WHERE valid_until >= NOW()
ORDER BY issued_at DESC;

-- View for document generation statistics
CREATE OR REPLACE VIEW document_generation_stats AS
SELECT 
    user_email,
    document_type,
    COUNT(*) as total_generated,
    MAX(generated_at) as last_generated,
    MIN(generated_at) as first_generated
FROM document_generation_log
GROUP BY user_email, document_type;

-- ============================================================================
-- 7. INSERT DEFAULT TERMS SECTIONS
-- ============================================================================
-- This is handled by the application, but here's the structure for reference

-- INSERT INTO account_agreements (
--     agreement_id, user_email, account_holder_name, account_holder_email,
--     registered_at, terms_version, terms_accepted_at, terms_last_updated,
--     terms_sections, has_accepted, accepted_at, disclaimer
-- ) VALUES (
--     'AGR-DEFAULT', 'system@mudrexx.com', 'System', 'system@mudrexx.com',
--     NOW(), '1.0', NOW(), '2024-01-01',
--     '[
--         {"title": "Account Terms", "content": "Your account is subject to the platform rules and regulations..."},
--         {"title": "Trading Risks", "content": "Trading involves risk of loss..."},
--         {"title": "Demo Account", "content": "Demo credits are for practice purposes only..."},
--         {"title": "Fees and Charges", "content": "The platform may charge fees for certain transactions..."},
--         {"title": "Privacy Policy", "content": "Your personal information is protected under our privacy policy..."}
--     ]',
--     true, NOW(), 'This agreement is between you and Mudrexx Earn...'
-- );

-- ============================================================================
-- 8. GRANT PERMISSIONS (adjust as needed for your setup)
-- ============================================================================
-- GRANT SELECT, INSERT, UPDATE ON account_statements TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON account_proofs TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON account_agreements TO your_app_user;
-- GRANT SELECT, INSERT ON document_generation_log TO your_app_user;
-- GRANT SELECT ON user_recent_statements TO your_app_user;
-- GRANT SELECT ON active_account_proofs TO your_app_user;
-- GRANT SELECT ON document_generation_stats TO your_app_user;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
