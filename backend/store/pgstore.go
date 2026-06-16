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

func (s *PGStore) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
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

func (s *PGStore) SetNodePubKey(ctx context.Context, nodeID, pubKey string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO nodes (node_id, public_key, last_seen)
		 VALUES ($1, $2, NOW())
		 ON CONFLICT (node_id) DO UPDATE SET public_key=$2, last_seen=NOW()`,
		nodeID, pubKey)
	return err
}

func (s *PGStore) GetNodePubKey(ctx context.Context, nodeID string) (string, error) {
	var pk string
	err := s.pool.QueryRow(ctx,
		`SELECT public_key FROM nodes WHERE node_id=$1 AND public_key!=''`,
		nodeID).Scan(&pk)
	if err != nil {
		return "", err
	}
	return pk, nil
}

func (s *PGStore) IncrNodeJobsAssigned(ctx context.Context, nodeID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE nodes SET jobs_assigned=jobs_assigned+1 WHERE node_id=$1`,
		nodeID)
	return err
}

func (s *PGStore) IncrNodeJobsCompleted(ctx context.Context, nodeID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE nodes SET jobs_completed=jobs_completed+1 WHERE node_id=$1`,
		nodeID)
	return err
}

func (s *PGStore) UpdateNodeUptime(ctx context.Context, nodeID string, seconds int64) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE nodes SET uptime_seconds=uptime_seconds+$2 WHERE node_id=$1`,
		nodeID, seconds)
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

func (s *PGStore) GetNodeInfo(ctx context.Context, nodeID string) (*NodeInfo, error) {
	var n NodeInfo
	err := s.pool.QueryRow(ctx,
		`SELECT node_id, status, owner, gpu_model, gpu_vram_mb,
		        tee_attested, tee_last_attested,
		        public_key, jobs_assigned, jobs_completed, uptime_seconds,
		        EXTRACT(EPOCH FROM (last_seen + INTERVAL '60 seconds' - NOW()))::bigint AS ttl
		 FROM nodes WHERE node_id=$1`,
		nodeID).Scan(&n.NodeID, &n.Status, &n.Owner, &n.GPUModel, &n.GPUVRAMMB,
		&n.TEEAttested, &n.TEEAttestedAt,
		&n.PublicKey, &n.JobsAssigned, &n.JobsCompleted, &n.UptimeSeconds,
		&n.TTL)
	if err != nil {
		return nil, err
	}
	if n.TTL < 0 {
		n.TTL = 0
	}
	return &n, nil
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
		        public_key, jobs_assigned, jobs_completed, uptime_seconds,
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
			&n.TEEAttested, &n.TEEAttestedAt,
			&n.PublicKey, &n.JobsAssigned, &n.JobsCompleted, &n.UptimeSeconds,
			&n.TTL); err != nil {
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
		        public_key, jobs_assigned, jobs_completed, uptime_seconds,
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
			&n.TEEAttested, &n.TEEAttestedAt,
			&n.PublicKey, &n.JobsAssigned, &n.JobsCompleted, &n.UptimeSeconds,
			&n.TTL); err != nil {
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
		                   enc_key_b64, salt_b64, upload_path, result_path, gpu_model, gpu_vram_mb,
		                   node_id, hourly_rate_cents, error, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
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
		   node_id=COALESCE(NULLIF($16,''), jobs.node_id),
		   hourly_rate_cents=CASE WHEN $17=0 THEN jobs.hourly_rate_cents ELSE $17 END,
		   error=COALESCE(NULLIF($18,''), jobs.error),
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
		fields["node_id"],
		parseIntField(fields["hourly_rate_cents"]),
		fields["error"],
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
		"node_id": true, "hourly_rate_cents": true,
		"error": true, "download_url": true,
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

func (s *PGStore) ListJobsByOwner(ctx context.Context, owner string, limit, offset int) ([]JobInfo, error) {
	if limit <= 0 || limit > 100 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := s.pool.Query(ctx,
		`SELECT j.job_id, j.owner, j.status, j.upload_url, j.result_upload_url, j.result_url, j.receipt_url,
		        j.gpu_model, j.gpu_vram_mb, j.node_id, j.hourly_rate_cents, j.error, j.created_at, j.updated_at,
		        COALESCE(
		          CASE WHEN ur.stopped_at IS NULL AND ur.started_at IS NOT NULL
		            THEN EXTRACT(EPOCH FROM NOW() - ur.started_at)::bigint
		            ELSE ur.elapsed_seconds
		          END, 0
		        ) AS elapsed_seconds,
		        COALESCE(ur.cost_cents, 0) AS cost_cents
		 FROM jobs j
		 LEFT JOIN usage_records ur ON ur.user_id = j.owner AND ur.job_id = j.job_id
		 WHERE j.owner=$1
		 ORDER BY j.updated_at DESC
		 LIMIT $2 OFFSET $3`,
		owner, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	jobs := make([]JobInfo, 0)
	for rows.Next() {
		var j JobInfo
		var costCents int64
		if err := rows.Scan(&j.JobID, &j.Owner, &j.Status, &j.UploadURL, &j.ResultUploadURL,
			&j.ResultURL, &j.ReceiptURL, &j.GPUModel, &j.GPUVRAMMB, &j.NodeID, &j.HourlyRateCents,
			&j.Error, &j.CreatedAt, &j.UpdatedAt, &j.ElapsedSeconds, &costCents); err != nil {
			return nil, err
		}
		if j.EstimatedCostCents == 0 {
			if costCents > 0 {
				j.EstimatedCostCents = costCents
			} else if j.HourlyRateCents > 0 && j.ElapsedSeconds > 0 {
				j.EstimatedCostCents = (j.ElapsedSeconds * j.HourlyRateCents) / 3600
				if j.EstimatedCostCents < 1 && j.ElapsedSeconds > 0 {
					j.EstimatedCostCents = 1
				}
			}
		}
		jobs = append(jobs, j)
	}
	return jobs, rows.Err()
}

func (s *PGStore) CountJobsByOwner(ctx context.Context, owner string) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM jobs WHERE owner=$1`, owner).Scan(&count)
	return count, err
}

func (s *PGStore) JobGetAll(ctx context.Context, jobID string) (map[string]string, error) {
	var owner, status, uploadURL, resultUploadURL, resultURL string
	var receiptUploadURL, receiptURL, storageToken string
	var encKeyB64, saltB64, uploadPath, resultPath, errStr string
	var gpuModel, nodeID string
	var gpuVRAMMB, hourlyRateCents int
	var createdAt, updatedAt time.Time
	err := s.pool.QueryRow(ctx,
		`SELECT owner, status, upload_url, result_upload_url, result_url,
		        receipt_upload_url, receipt_url, storage_token,
		        enc_key_b64, salt_b64, upload_path, result_path, error,
		        gpu_model, gpu_vram_mb, node_id, hourly_rate_cents, created_at, updated_at
		 FROM jobs WHERE job_id=$1`,
		jobID).Scan(&owner, &status, &uploadURL, &resultUploadURL, &resultURL,
		&receiptUploadURL, &receiptURL, &storageToken,
		&encKeyB64, &saltB64, &uploadPath, &resultPath, &errStr,
		&gpuModel, &gpuVRAMMB, &nodeID, &hourlyRateCents, &createdAt, &updatedAt)
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
		"error":              errStr,
		"gpu_model":          gpuModel,
		"gpu_vram_mb":        strconv.Itoa(gpuVRAMMB),
		"node_id":            nodeID,
		"hourly_rate_cents":  strconv.Itoa(hourlyRateCents),
		"created_at":         createdAt.Format(time.RFC3339),
		"updated_at":         updatedAt.Format(time.RFC3339),
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

func (s *PGStore) BillingGetTotal(ctx context.Context, userID string) (gpuSeconds, paidCents, unpaidCents int64, err error) {
	err = s.pool.QueryRow(ctx,
		`SELECT gpu_seconds, total_paid_cents, unpaid_cents FROM usage_totals WHERE user_id=$1`,
		userID).Scan(&gpuSeconds, &paidCents, &unpaidCents)
	if err != nil {
		return 0, 0, 0, err
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

func (s *PGStore) BillingRecordUsage(ctx context.Context, userID, jobID string, seconds, costCents int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		`INSERT INTO usage_totals (user_id, gpu_seconds, unpaid_cents) VALUES ($1, $2, $3)
		 ON CONFLICT (user_id) DO UPDATE SET
		   gpu_seconds = usage_totals.gpu_seconds + $2,
		   unpaid_cents = usage_totals.unpaid_cents + $3`,
		userID, seconds, costCents)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO payment_transactions (id, user_id, job_id, type, amount_cents, gpu_seconds, status, completed_at)
		 VALUES ($1, $2, $3, 'gpu_usage', $4, $5, 'completed', NOW())
		 ON CONFLICT (id) DO UPDATE SET
		   amount_cents = $4, gpu_seconds = $5, status = 'completed', completed_at = NOW()`,
		fmt.Sprintf("usage_%s", jobID), userID, jobID, costCents, seconds)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *PGStore) BillingIncrPaid(ctx context.Context, userID string, cents int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx,
		`INSERT INTO usage_totals (user_id, total_paid_cents) VALUES ($1, $2)
		 ON CONFLICT (user_id) DO UPDATE SET
		   total_paid_cents = usage_totals.total_paid_cents + $2,
		   unpaid_cents = GREATEST(usage_totals.unpaid_cents - $2, 0)`,
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

func (s *PGStore) UsageStart(ctx context.Context, userID, jobID string, meta UsageMeta) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO usage_records (user_id, job_id, started_at, gpu_model, hourly_rate_cents, provider_id, node_id, cost_cents)
		 VALUES ($1, $2, NOW(), $3, $4, $5, $6, 0)
		 ON CONFLICT (user_id, job_id) DO UPDATE SET
		   started_at=NOW(), stopped_at=NULL, elapsed_seconds=0, cost_cents=0,
		   gpu_model=COALESCE(NULLIF($3,''), usage_records.gpu_model),
		   hourly_rate_cents=CASE WHEN $4=0 THEN usage_records.hourly_rate_cents ELSE $4 END,
		   provider_id=COALESCE(NULLIF($5,''), usage_records.provider_id),
		   node_id=COALESCE(NULLIF($6,''), usage_records.node_id)`,
		userID, jobID, meta.GPUModel, meta.HourlyRateCents, meta.ProviderID, meta.NodeID)
	return err
}

func (s *PGStore) UsageStop(ctx context.Context, userID, jobID string) (elapsed, hourlyRateCents int64, providerID, gpuModel string, err error) {
	err = s.pool.QueryRow(ctx,
		`UPDATE usage_records
		 SET stopped_at=NOW(),
		     elapsed_seconds=EXTRACT(EPOCH FROM NOW() - started_at)::bigint,
		     cost_cents=(EXTRACT(EPOCH FROM NOW() - started_at)::bigint * hourly_rate_cents) / 3600
		 WHERE user_id=$1 AND job_id=$2 AND stopped_at IS NULL
		 RETURNING elapsed_seconds, hourly_rate_cents, provider_id, gpu_model`,
		userID, jobID).Scan(&elapsed, &hourlyRateCents, &providerID, &gpuModel)
	if err != nil {
		log.Printf("UsageStop: %s/%s: %v", userID, jobID, err)
	}
	return
}

func (s *PGStore) UsageIsActive(ctx context.Context, userID, jobID string) (bool, error) {
	var active bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(
		   SELECT 1 FROM usage_records
		   WHERE user_id=$1 AND job_id=$2 AND started_at IS NOT NULL AND stopped_at IS NULL
		 )`, userID, jobID).Scan(&active)
	return active, err
}

func (s *PGStore) UsageElapsed(ctx context.Context, userID, jobID string) (int64, error) {
	var elapsed int64
	err := s.pool.QueryRow(ctx,
		`SELECT CASE
		   WHEN stopped_at IS NOT NULL THEN elapsed_seconds
		   WHEN started_at IS NOT NULL THEN EXTRACT(EPOCH FROM NOW() - started_at)::bigint
		   ELSE 0
		 END
		 FROM usage_records WHERE user_id=$1 AND job_id=$2`,
		userID, jobID).Scan(&elapsed)
	return elapsed, err
}

func (s *PGStore) RecordProviderEarning(ctx context.Context, providerID, renterID, jobID, gpuModel string, elapsed, grossCents, earningsCents int64) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO provider_earnings (provider_id, job_id, renter_id, gpu_model, elapsed_seconds, gross_cents, earnings_cents, status, completed_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', NOW())
		 ON CONFLICT (provider_id, job_id) DO UPDATE SET
		   renter_id=$3, gpu_model=$4, elapsed_seconds=$5, gross_cents=$6,
		   earnings_cents=$7, status='completed', completed_at=NOW()`,
		providerID, jobID, renterID, gpuModel, elapsed, grossCents, earningsCents)
	return err
}

func (s *PGStore) GetProviderEarnings(ctx context.Context, providerID string) (ProviderEarningsSummary, error) {
	var summary ProviderEarningsSummary
	err := s.pool.QueryRow(ctx,
		`SELECT
		   COALESCE(SUM(earnings_cents), 0),
		   COALESCE(SUM(CASE WHEN status='pending' THEN earnings_cents ELSE 0 END), 0),
		   COUNT(*) FILTER (WHERE status='completed'),
		   COUNT(*) FILTER (WHERE status='pending')
		 FROM provider_earnings WHERE provider_id=$1`,
		providerID).Scan(&summary.TotalEarningsCents, &summary.PendingCents,
		&summary.CompletedJobs, &summary.ActiveJobs)
	return summary, err
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
		reaped = append(reaped, jobID)
	}
	return reaped, rows.Err()
}
