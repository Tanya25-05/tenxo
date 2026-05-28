CREATE TABLE IF NOT EXISTS nodes (
    node_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'idle',
    owner TEXT NOT NULL DEFAULT '',
    gpu_model TEXT NOT NULL DEFAULT '',
    gpu_vram_mb INTEGER NOT NULL DEFAULT 0,
    tee_attested BOOLEAN NOT NULL DEFAULT FALSE,
    tee_last_attested TIMESTAMPTZ,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
    job_id TEXT PRIMARY KEY,
    owner TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'created',
    upload_url TEXT NOT NULL DEFAULT '',
    result_upload_url TEXT NOT NULL DEFAULT '',
    result_url TEXT NOT NULL DEFAULT '',
    enc_key_b64 TEXT NOT NULL DEFAULT '',
    salt_b64 TEXT NOT NULL DEFAULT '',
    upload_path TEXT NOT NULL DEFAULT '',
    result_path TEXT NOT NULL DEFAULT '',
    gpu_model TEXT NOT NULL DEFAULT '',
    gpu_vram_mb INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS gpu_model TEXT NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS gpu_vram_mb INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_jobs_owner_updated_at ON jobs(owner, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status_updated_at ON jobs(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS api_keys (
    key_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'developer',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

CREATE TABLE IF NOT EXISTS billing_customers (
    user_id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    token_id TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS usage_totals (
    user_id TEXT PRIMARY KEY,
    gpu_seconds BIGINT NOT NULL DEFAULT 0,
    total_paid_cents BIGINT NOT NULL DEFAULT 0,
    unpaid_cents BIGINT NOT NULL DEFAULT 0,
    last_charge TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS usage_records (
    user_id TEXT NOT NULL,
    job_id TEXT NOT NULL,
    started_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ,
    elapsed_seconds BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, job_id)
);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    job_id TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL,
    amount_cents BIGINT NOT NULL DEFAULT 0,
    gpu_seconds BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_created_at
    ON payment_transactions(user_id, created_at DESC);
