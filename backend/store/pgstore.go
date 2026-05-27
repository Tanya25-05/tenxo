package store

import (
	"context"
	_ "embed"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

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

func (s *PGStore) SetNode(ctx context.Context, nodeID, status, owner string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO nodes (node_id, status, owner, last_seen)
		 VALUES ($1, $2, $3, NOW())
		 ON CONFLICT (node_id) DO UPDATE SET status=$2, owner=$3, last_seen=NOW()`,
		nodeID, status, owner)
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
		`SELECT node_id, status, owner,
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
		if err := rows.Scan(&n.NodeID, &n.Status, &n.Owner, &n.TTL); err != nil {
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
		`SELECT node_id, status, owner,
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
		if err := rows.Scan(&n.NodeID, &n.Status, &n.Owner, &n.TTL); err != nil {
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
		                   enc_key_b64, salt_b64, upload_path, result_path, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
		 ON CONFLICT (job_id) DO UPDATE SET
		   owner=COALESCE(NULLIF($2,''), jobs.owner),
		   status=COALESCE(NULLIF($3,''), jobs.status),
		   upload_url=COALESCE(NULLIF($4,''), jobs.upload_url),
		   result_upload_url=COALESCE(NULLIF($5,''), jobs.result_upload_url),
		   result_url=COALESCE(NULLIF($6,''), jobs.result_url),
		   enc_key_b64=COALESCE(NULLIF($7,''), jobs.enc_key_b64),
		   salt_b64=COALESCE(NULLIF($8,''), jobs.salt_b64),
		   upload_path=COALESCE(NULLIF($9,''), jobs.upload_path),
		   result_path=COALESCE(NULLIF($10,''), jobs.result_path),
		   updated_at=NOW()`,
		jobID,
		fields["owner"],
		fields["status"],
		fields["upload_url"],
		fields["result_upload_url"],
		fields["result_url"],
		fields["enc_key_b64"],
		fields["salt_b64"],
		fields["upload_path"],
		fields["result_path"],
	)
	return err
}

func (s *PGStore) JobGet(ctx context.Context, jobID, field string) (string, error) {
	// Validate allowed field names
	allowed := map[string]bool{
		"owner": true, "status": true, "upload_url": true,
		"result_upload_url": true, "result_url": true,
		"enc_key_b64": true, "salt_b64": true,
		"upload_path": true, "result_path": true,
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

func (s *PGStore) JobGetAll(ctx context.Context, jobID string) (map[string]string, error) {
	var owner, status, uploadURL, resultUploadURL, resultURL string
	var encKeyB64, saltB64, uploadPath, resultPath string
	err := s.pool.QueryRow(ctx,
		`SELECT owner, status, upload_url, result_upload_url, result_url,
		        enc_key_b64, salt_b64, upload_path, result_path
		 FROM jobs WHERE job_id=$1`,
		jobID).Scan(&owner, &status, &uploadURL, &resultUploadURL, &resultURL,
		&encKeyB64, &saltB64, &uploadPath, &resultPath)
	if err != nil {
		return nil, err
	}
	return map[string]string{
		"owner":             owner,
		"status":            status,
		"upload_url":        uploadURL,
		"result_upload_url": resultUploadURL,
		"result_url":        resultURL,
		"enc_key_b64":       encKeyB64,
		"salt_b64":          saltB64,
		"upload_path":       uploadPath,
		"result_path":       resultPath,
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
		`SELECT user_id FROM api_keys WHERE key_hash=$1`, keyHash).Scan(&userID)
	return userID, err
}

func (s *PGStore) SetAPIKey(ctx context.Context, keyHash, userID string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO api_keys (key_hash, user_id) VALUES ($1, $2)
		 ON CONFLICT (key_hash) DO UPDATE SET user_id=$2`,
		keyHash, userID)
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
	_, err := s.pool.Exec(ctx,
		`INSERT INTO usage_totals (user_id, total_paid_cents) VALUES ($1, $2)
		 ON CONFLICT (user_id) DO UPDATE SET total_paid_cents = usage_totals.total_paid_cents + $2`,
		userID, cents)
	return err
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
