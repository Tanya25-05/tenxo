CREATE TABLE IF NOT EXISTS nodes (
    node_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'idle',
    owner TEXT NOT NULL DEFAULT '',
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
    key_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL
);

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
