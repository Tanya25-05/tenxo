package store

import (
	"context"
	_ "embed"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func parseIntField(v string) int {
	i, _ := strconv.Atoi(v)
	return i
}

//go:embed schema.sql
var schemaSQL string

type PGStore struct {
	pool *pgxpool.Pool
}

func NewPGStore(ctx context.Context, databaseURL string) (*PGStore, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("pgxpool.New: %w", err)
	}
	s := &PGStore{pool: pool}
	if err := s.Migrate(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return s, nil
}

func (s *PGStore) Migrate(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, schemaSQL)
	return err
}

func (s *PGStore) Close() {
	s.pool.Close()
}

func (s *PGStore) SetNode(ctx context.Context, nodeID, status, owner, gpuModel string, gpuVRAMMB int) error {
	// Preserve busy status from heartbeats — only explicit calls via
	// SetNodeStatus can change away from idle/busy. Reserved is transient
	// and gets cleared by the next heartbeat (proves agent is alive).
	_, err := s.pool.Exec(ctx,
		`INSERT INTO nodes (node_id, status, owner, gpu_model, gpu_vram_mb, last_seen)
		 VALUES ($1, $2, $3, $4, $5, NOW())
		 ON CONFLICT (node_id) DO UPDATE SET
		   status=CASE WHEN nodes.status='busy' THEN nodes.status ELSE $2 END,
		   owner=$3,
		   gpu_model=CASE WHEN $4='' THEN nodes.gpu_model ELSE $4 END,
		   gpu_vram_mb=CASE WHEN $5=0 THEN nodes.gpu_vram_mb ELSE $5 END,
		   last_seen=NOW()`,
		nodeID, status, owner, gpuModel, gpuVRAMMB)
	return err
}

func (s *PGStore) SetNodeStatus(ctx context.Context, nodeID, status string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE nodes SET status=$2 WHERE node_id=$1`,
		nodeID, status)
	return err
}

func (s *PGStore) SetNodeStatusIf(ctx context.Context, nodeID, status, expectedCurrent string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE nodes SET status=$2 WHERE node_id=$1 AND status=$3`,
		nodeID, status, expectedCurrent)
	return err
}

func (s *PGStore) SetNodeTEE(ctx context.Context, nodeID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE nodes SET tee_attested=TRUE, tee_last_attested=NOW() WHERE node_id=$1`,
		nodeID)
	return err
}

func (s *PGStore) GetNode(ctx context.Context, nodeID string) (string, error) {
	var status string
	err := s.pool.QueryRow(ctx,
		`SELECT status FROM nodes WHERE node_id=$1 AND last_seen > NOW() - INTERVAL '90 seconds'`,
		nodeID).Scan(&status)
	if err != nil {
		return "", err
	}
	return status, nil
}

func (s *PGStore) GetNodeOwner(ctx context.Context, nodeID string) (string, error) {
	var owner string
	err := s.pool.QueryRow(ctx,
		`SELECT owner FROM nodes WHERE node_id=$1`, nodeID).Scan(&owner)
	if err != nil {
		return "", err
	}
	return owner, nil
}

func (s *PGStore) GetAllNodes(ctx context.Context) (map[string]*NodeInfo, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT node_id, status, owner, gpu_model, gpu_vram_mb,
		        tee_attested, tee_last_attested,
		        EXTRACT(EPOCH FROM (last_seen + INTERVAL '60 seconds' - NOW()))::bigint AS ttl
		 FROM nodes
		 WHERE last_seen > NOW() - INTERVAL '90 seconds'`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	nodes := make(map[string]*NodeInfo)
	for rows.Next() {
		n := &NodeInfo{}
		if err := rows.Scan(&n.NodeID, &n.Status, &n.Owner, &n.GPUModel, &n.GPUVRAMMB,
			&n.TEEAttested, &n.TEEAttestedAt, &n.TTL); err != nil {
			return nil, err
		}
		if n.TTL < 0 {
			n.TTL = 0
		}
		nodes[n.NodeID] = n
	}
	return nodes, rows.Err()
}

func (s *PGStore) GetNodesByOwner(ctx context.Context, owner string) (map[string]*NodeInfo, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT node_id, status, owner, gpu_model, gpu_vram_mb,
		        tee_attested, tee_last_attested,
		        EXTRACT(EPOCH FROM (last_seen + INTERVAL '60 seconds' - NOW()))::bigint AS ttl
		 FROM nodes
		 WHERE owner=$1 AND last_seen > NOW() - INTERVAL '90 seconds'`,
		owner)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	nodes := make(map[string]*NodeInfo)
	for rows.Next() {
		n := &NodeInfo{}
		if err := rows.Scan(&n.NodeID, &n.Status, &n.Owner, &n.GPUModel, &n.GPUVRAMMB,
			&n.TEEAttested, &n.TEEAttestedAt, &n.TTL); err != nil {
			return nil, err
		}
		if n.TTL < 0 {
			n.TTL = 0
		}
		nodes[n.NodeID] = n
	}
	return nodes, rows.Err()
}

func (s *PGStore) ReapStaleNodes(ctx context.Context, maxAge time.Duration) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM nodes WHERE last_seen < NOW() - $1::interval`,
		maxAge.String())
	return err
}

func (s *PGStore) JobSet(ctx context.Context, jobID string, fields map[string]string) error {
	// UPSERT: insert or update each field via a single merge
	// We use a simple approach: SET each column independently.
	// Since our schema has fixed columns, we map known fields.
	_, err := s.pool.Exec(ctx,
		`INSERT INTO jobs (job_id, owner, status, upload_url, result_upload_url, result_url,
		                   receipt_upload_url, receipt_url, storage_token,
		                   enc_key_b64, salt_b64, upload_path, result_path, gpu_model, gpu_vram_mb, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
		 ON CONFLICT (job_id) DO UPDATE SET
		   owner=COALESCE(NULLIF($2,''), jobs.owner),
		   status=COALESCE(NULLIF($3,''), jobs.status),
		   upload_url=COALESCE(NULLIF($4,''), jobs.upload_url),
		   result_upload_url=COALESCE(NULLIF($5,''), jobs.result_upload_url),
		   result_url=COALESCE(NULLIF($6,''), jobs.result_url),
		   receipt_upload_url=COALESCE(NULLIF($7,''), jobs.receipt_upload_url),
		   receipt_url=COALESCE(NULLIF($8,''), jobs.receipt_url),
		   storage_token=COALESCE(NULLIF($9,''), jobs.storage_token),
		   enc_key_b64=COALESCE(NULLIF($10,''), jobs.enc_key_b64),
		   salt_b64=COALESCE(NULLIF($11,''), jobs.salt_b64),
		   upload_path=COALESCE(NULLIF($12,''), jobs.upload_path),
		   result_path=COALESCE(NULLIF($13,''), jobs.result_path),
		   gpu_model=COALESCE(NULLIF($14,''), jobs.gpu_model),
		   gpu_vram_mb=CASE WHEN $15=0 THEN jobs.gpu_vram_mb ELSE $15 END,
		   updated_at=NOW()`,
		jobID,
		fields["owner"],
		fields["status"],
		fields["upload_url"],
		fields["result_upload_url"],
		fields["result_url"],
		fields["receipt_upload_url"],
		fields["receipt_url"],
		fields["storage_token"],
		fields["enc_key_b64"],
		fields["salt_b64"],
		fields["upload_path"],
		fields["result_path"],
		fields["gpu_model"],
		parseIntField(fields["gpu_vram_mb"]),
	)
	return err
}

func (s *PGStore) JobGet(ctx context.Context, jobID, field string) (string, error) {
	// Validate allowed field names
	allowed := map[string]bool{
		"owner": true, "status": true, "upload_url": true,
		"result_upload_url": true, "result_url": true,
		"receipt_upload_url": true, "receipt_url": true,
		"storage_token": true,
		"enc_key_b64":   true, "salt_b64": true,
		"upload_path": true, "result_path": true,
		"gpu_model": true, "gpu_vram_mb": true,
	}
	if !allowed[field] {
		return "", fmt.Errorf("unknown job field: %s", field)
	}
	query := fmt.Sprintf(`SELECT %s FROM jobs WHERE job_id=$1`, field)
	var val string
	err := s.pool.QueryRow(ctx, query, jobID).Scan(&val)
	if err != nil {
		return "", err
	}
	return val, nil
}

func (s *PGStore) ListJobsByOwner(ctx context.Context, owner string, limit int) ([]JobInfo, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx,
		`SELECT job_id, owner, status, upload_url, result_upload_url, result_url, receipt_url,
		        gpu_model, gpu_vram_mb, created_at, updated_at
		 FROM jobs
		 WHERE owner=$1
		 ORDER BY updated_at DESC
		 LIMIT $2`,
		owner, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	jobs := make([]JobInfo, 0)
	for rows.Next() {
		var j JobInfo
		if err := rows.Scan(&j.JobID, &j.Owner, &j.Status, &j.UploadURL, &j.ResultUploadURL,
			&j.ResultURL, &j.ReceiptURL, &j.GPUModel, &j.GPUVRAMMB, &j.CreatedAt, &j.UpdatedAt); err != nil {
			return nil, err
		}
		jobs = append(jobs, j)
	}
	return jobs, rows.Err()
}

func (s *PGStore) JobGetAll(ctx context.Context, jobID string) (map[string]string, error) {
	var owner, status, uploadURL, resultUploadURL, resultURL string
	var receiptUploadURL, receiptURL, storageToken string
	var encKeyB64, saltB64, uploadPath, resultPath string
	err := s.pool.QueryRow(ctx,
		`SELECT owner, status, upload_url, result_upload_url, result_url,
		        receipt_upload_url, receipt_url, storage_token,
		        enc_key_b64, salt_b64, upload_path, result_path
		 FROM jobs WHERE job_id=$1`,
		jobID).Scan(&owner, &status, &uploadURL, &resultUploadURL, &resultURL,
		&receiptUploadURL, &receiptURL, &storageToken,
		&encKeyB64, &saltB64, &uploadPath, &resultPath)
	if err != nil {
		return nil, err
	}
	return map[string]string{
		"owner":              owner,
		"status":             status,
		"upload_url":         uploadURL,
		"result_upload_url":  resultUploadURL,
		"result_url":         resultURL,
		"receipt_upload_url": receiptUploadURL,
		"receipt_url":        receiptURL,
		"storage_token":      storageToken,
		"enc_key_b64":        encKeyB64,
		"salt_b64":           saltB64,
		"upload_path":        uploadPath,
		"result_path":        resultPath,
	}, nil
}

func (s *PGStore) JobExists(ctx context.Context, jobID string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM jobs WHERE job_id=$1)`, jobID).Scan(&exists)
	return exists, err
}

func (s *PGStore) GetAPIKeyUser(ctx context.Context, keyHash string) (string, error) {
	var userID string
	err := s.pool.QueryRow(ctx,
		`SELECT user_id FROM api_keys
		 WHERE key_hash=$1 AND is_active=TRUE
		   AND (expires_at IS NULL OR expires_at > NOW())`, keyHash).Scan(&userID)
	return userID, err
}

func (s *PGStore) SetAPIKey(ctx context.Context, keyHash, userID string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO api_keys (key_hash, user_id) VALUES ($1, $2)
		 ON CONFLICT (key_hash) DO UPDATE SET user_id=$2, last_used_at=NOW()`,
		keyHash, userID)
	return err
}

func (s *PGStore) CreateAPIKey(ctx context.Context, keyHash, userID, name, role string, expiresAt *time.Time) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO api_keys (key_hash, user_id, name, role, expires_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		keyHash, userID, name, role, expiresAt)
	return err
}

func (s *PGStore) ListAPIKeys(ctx context.Context, userID string) ([]APIKeyInfo, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT key_hash, user_id, name, role, is_active, expires_at, created_at, last_used_at
		 FROM api_keys WHERE user_id=$1
		 ORDER BY created_at DESC`,
		userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []APIKeyInfo
	for rows.Next() {
		var k APIKeyInfo
		if err := rows.Scan(&k.KeyHash, &k.UserID, &k.Name, &k.Role,
			&k.IsActive, &k.ExpiresAt, &k.CreatedAt, &k.LastUsedAt); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

func (s *PGStore) RevokeAPIKey(ctx context.Context, keyHash, userID string) error {
	res, err := s.pool.Exec(ctx,
		`UPDATE api_keys SET is_active=FALSE WHERE key_hash=$1 AND user_id=$2`,
		keyHash, userID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("api key not found or not owned by user")
	}
	return nil
}

func (s *PGStore) UpdateAPIKeyName(ctx context.Context, keyHash, userID, name string) error {
	res, err := s.pool.Exec(ctx,
		`UPDATE api_keys SET name=$3 WHERE key_hash=$1 AND user_id=$2`,
		keyHash, userID, name)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("api key not found or not owned by user")
	}
	return nil
}

func (s *PGStore) TouchAPIKey(ctx context.Context, keyHash string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE api_keys SET last_used_at=NOW() WHERE key_hash=$1`,
		keyHash)
	return err
}

func (s *PGStore) BillingGetCustomer(ctx context.Context, userID string) (string, error) {
	var cid string
	err := s.pool.QueryRow(ctx,
		`SELECT customer_id FROM billing_customers WHERE user_id=$1`, userID).Scan(&cid)
	return cid, err
}

func (s *PGStore) BillingSetCustomer(ctx context.Context, userID, customerID string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO billing_customers (user_id, customer_id) VALUES ($1, $2)
		 ON CONFLICT (user_id) DO UPDATE SET customer_id=$2`,
		userID, customerID)
	return err
}

func (s *PGStore) BillingGetToken(ctx context.Context, userID string) (string, error) {
	var tok string
	err := s.pool.QueryRow(ctx,
		`SELECT token_id FROM billing_customers WHERE user_id=$1`, userID).Scan(&tok)
	return tok, err
}

func (s *PGStore) BillingSetToken(ctx context.Context, userID, tokenID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE billing_customers SET token_id=$2 WHERE user_id=$1`,
		userID, tokenID)
	return err
}

func (s *PGStore) BillingGetTotal(ctx context.Context, userID string) (gpuSeconds, paidCents int64, err error) {
	err = s.pool.QueryRow(ctx,
		`SELECT gpu_seconds, total_paid_cents FROM usage_totals WHERE user_id=$1`,
		userID).Scan(&gpuSeconds, &paidCents)
	if err != nil {
		return 0, 0, err
	}
	return
}

func (s *PGStore) BillingIncrGPU(ctx context.Context, userID string, seconds int64) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO usage_totals (user_id, gpu_seconds) VALUES ($1, $2)
		 ON CONFLICT (user_id) DO UPDATE SET gpu_seconds = usage_totals.gpu_seconds + $2`,
		userID, seconds)
	return err
}

func (s *PGStore) BillingIncrPaid(ctx context.Context, userID string, cents int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx,
		`INSERT INTO usage_totals (user_id, total_paid_cents) VALUES ($1, $2)
		 ON CONFLICT (user_id) DO UPDATE SET total_paid_cents = usage_totals.total_paid_cents + $2`,
		userID, cents)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx,
		`INSERT INTO payment_transactions (id, user_id, type, amount_cents, status, completed_at)
		 VALUES ($1, $2, 'payment', $3, 'completed', NOW())
		 ON CONFLICT (id) DO NOTHING`,
		fmt.Sprintf("pay_%d_%s", time.Now().UnixNano(), userID), userID, cents)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *PGStore) BillingListTransactions(ctx context.Context, userID string, limit int) ([]TransactionInfo, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, job_id, type, amount_cents, gpu_seconds, status, created_at, completed_at
		 FROM (
		   SELECT id, user_id, job_id, type, amount_cents, gpu_seconds, status, created_at, completed_at
		   FROM payment_transactions
		   WHERE user_id=$1
		 UNION ALL
		   SELECT 'usage_' || job_id, user_id, job_id, 'gpu_usage', 0, elapsed_seconds,
		          CASE WHEN stopped_at IS NULL THEN 'pending' ELSE 'completed' END,
		          COALESCE(started_at, NOW()), stopped_at
		   FROM usage_records
		   WHERE user_id=$1
		 ) txs
		 ORDER BY created_at DESC
		 LIMIT $2`,
		userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]TransactionInfo, 0)
	for rows.Next() {
		var item TransactionInfo
		if err := rows.Scan(&item.ID, &item.UserID, &item.JobID, &item.Type, &item.AmountCents,
			&item.GPUSeconds, &item.Status, &item.CreatedAt, &item.CompletedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *PGStore) BillingSetLastCharge(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE usage_totals SET last_charge=NOW() WHERE user_id=$1`,
		userID)
	return err
}

func (s *PGStore) BillingFindUserByCustomer(ctx context.Context, customerID string) (string, error) {
	var userID string
	err := s.pool.QueryRow(ctx,
		`SELECT user_id FROM billing_customers WHERE customer_id=$1`, customerID).Scan(&userID)
	return userID, err
}

func (s *PGStore) UsageStart(ctx context.Context, userID, jobID string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO usage_records (user_id, job_id, started_at) VALUES ($1, $2, NOW())
		 ON CONFLICT (user_id, job_id) DO UPDATE SET started_at=NOW(), stopped_at=NULL, elapsed_seconds=0`,
		userID, jobID)
	return err
}

func (s *PGStore) UsageStop(ctx context.Context, userID, jobID string) (elapsed int64, err error) {
	err = s.pool.QueryRow(ctx,
		`UPDATE usage_records
		 SET stopped_at=NOW(), elapsed_seconds=EXTRACT(EPOCH FROM NOW() - started_at)::bigint
		 WHERE user_id=$1 AND job_id=$2 AND stopped_at IS NULL
		 RETURNING elapsed_seconds`,
		userID, jobID).Scan(&elapsed)
	if err != nil {
		log.Printf("UsageStop: %s/%s: %v", userID, jobID, err)
	}
	return
}

func (s *PGStore) WorkspaceSet(ctx context.Context, workspaceID string, fields map[string]string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO workspaces (workspace_id, owner, upload_url, enc_key_b64, overlay_url, updated_at)
		 VALUES ($1, $2, $3, $4, $5, NOW())
		 ON CONFLICT (workspace_id) DO UPDATE SET
		   owner=COALESCE(NULLIF($2,''), workspaces.owner),
		   upload_url=COALESCE(NULLIF($3,''), workspaces.upload_url),
		   enc_key_b64=COALESCE(NULLIF($4,''), workspaces.enc_key_b64),
		   overlay_url=COALESCE(NULLIF($5,''), workspaces.overlay_url),
		   updated_at=NOW()`,
		workspaceID,
		fields["owner"],
		fields["upload_url"],
		fields["enc_key_b64"],
		fields["overlay_url"],
	)
	return err
}

func (s *PGStore) WorkspaceGet(ctx context.Context, workspaceID string) (map[string]string, error) {
	var owner, uploadURL, encKeyB64, overlayURL string
	err := s.pool.QueryRow(ctx,
		`SELECT owner, upload_url, enc_key_b64, overlay_url
		 FROM workspaces WHERE workspace_id=$1`,
		workspaceID).Scan(&owner, &uploadURL, &encKeyB64, &overlayURL)
	if err != nil {
		return nil, err
	}
	return map[string]string{
		"owner":       owner,
		"upload_url":  uploadURL,
		"enc_key_b64": encKeyB64,
		"overlay_url": overlayURL,
	}, nil
}

func (s *PGStore) ListWorkspacesByOwner(ctx context.Context, owner string, limit int) ([]WorkspaceInfo, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx,
		`SELECT workspace_id, owner, upload_url, overlay_url, created_at, updated_at
		 FROM workspaces
		 WHERE owner=$1
		 ORDER BY updated_at DESC
		 LIMIT $2`,
		owner, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	workspaces := make([]WorkspaceInfo, 0)
	for rows.Next() {
		var w WorkspaceInfo
		if err := rows.Scan(&w.WorkspaceID, &w.Owner, &w.UploadURL, &w.OverlayURL, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, err
		}
		workspaces = append(workspaces, w)
	}
	return workspaces, rows.Err()
}

func (s *PGStore) ReapStaleJobs(ctx context.Context, maxAge time.Duration) ([]string, error) {
	rows, err := s.pool.Query(ctx,
		`UPDATE jobs
		 SET status = 'failed', updated_at = NOW()
		 WHERE status IN ('queued', 'created', 'running')
		   AND updated_at < NOW() - $1::interval
		 RETURNING job_id, owner`,
		maxAge.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reaped []string
	for rows.Next() {
		var jobID, owner string
		if err := rows.Scan(&jobID, &owner); err != nil {
			return reaped, err
		}
		// Close usage tracking so provider gets paid for partial work
		if owner != "" {
			if _, err := s.UsageStop(ctx, owner, jobID); err != nil {
				log.Printf("reaper: UsageStop %s/%s: %v", owner, jobID, err)
			}
		}
		reaped = append(reaped, jobID)
	}
	return reaped, rows.Err()
}
