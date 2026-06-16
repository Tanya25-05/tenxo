package store

import (
	"context"
	"time"
)

type APIKeyInfo struct {
	KeyHash    string     `json:"id"`
	UserID     string     `json:"user_id"`
	Name       string     `json:"name"`
	Role       string     `json:"role"`
	IsActive   bool       `json:"is_active"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
}

type JobInfo struct {
	JobID              string    `json:"job_id"`
	Owner              string    `json:"owner,omitempty"`
	Status             string    `json:"status"`
	UploadURL          string    `json:"upload_url,omitempty"`
	ResultUploadURL    string    `json:"result_upload_url,omitempty"`
	ResultURL          string    `json:"result_url,omitempty"`
	ReceiptURL         string    `json:"receipt_url,omitempty"`
	GPUModel           string    `json:"gpu_model,omitempty"`
	GPUVRAMMB          int       `json:"gpu_vram_mb,omitempty"`
	NodeID             string    `json:"node_id,omitempty"`
	HourlyRateCents    int64     `json:"hourly_rate_cents,omitempty"`
	EstimatedCostCents int64     `json:"estimated_cost_cents,omitempty"`
	ElapsedSeconds     int64     `json:"elapsed_seconds,omitempty"`
	Error              string    `json:"error,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type UsageMeta struct {
	GPUModel        string
	HourlyRateCents int64
	ProviderID      string
	NodeID          string
}

type ProviderEarningsSummary struct {
	TotalEarningsCents int64 `json:"total_earnings_cents"`
	PendingCents       int64 `json:"pending_cents"`
	CompletedJobs      int   `json:"completed_jobs"`
	ActiveJobs         int   `json:"active_jobs"`
}

type TransactionInfo struct {
	ID          string     `json:"id"`
	UserID      string     `json:"user_id,omitempty"`
	JobID       string     `json:"job_id,omitempty"`
	Type        string     `json:"type"`
	AmountCents int64      `json:"amount_cents"`
	GPUSeconds  int64      `json:"gpu_seconds,omitempty"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

type NodeInfo struct {
	NodeID        string     `json:"node_id"`
	Status        string     `json:"status"`
	Owner         string     `json:"owner,omitempty"`
	GPUModel      string     `json:"gpu_model,omitempty"`
	GPUVRAMMB     int        `json:"gpu_vram_mb,omitempty"`
	TEEAttested   bool       `json:"tee_attested"`
	TEEAttestedAt *time.Time `json:"tee_last_attested,omitempty"`
	PublicKey     string     `json:"public_key,omitempty"`
	JobsAssigned  int        `json:"jobs_assigned"`
	JobsCompleted int        `json:"jobs_completed"`
	UptimeSeconds int64      `json:"uptime_seconds"`
	TTL           int64      `json:"ttl_seconds"`
}

type WorkspaceInfo struct {
	WorkspaceID string    `json:"workspace_id"`
	Owner       string    `json:"owner,omitempty"`
	UploadURL   string    `json:"upload_url,omitempty"`
	OverlayURL  string    `json:"overlay_url,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Store interface {
	Ping(ctx context.Context) error
	Migrate(ctx context.Context) error

	SetNode(ctx context.Context, nodeID, status, owner, gpuModel string, gpuVRAMMB int) error
	SetNodeStatus(ctx context.Context, nodeID, status string) error
	SetNodeStatusIf(ctx context.Context, nodeID, status, expectedCurrent string) error
	SetNodeTEE(ctx context.Context, nodeID string) error
	SetNodePubKey(ctx context.Context, nodeID, pubKey string) error
	GetNodePubKey(ctx context.Context, nodeID string) (string, error)
	IncrNodeJobsAssigned(ctx context.Context, nodeID string) error
	IncrNodeJobsCompleted(ctx context.Context, nodeID string) error
	UpdateNodeUptime(ctx context.Context, nodeID string, seconds int64) error
	GetNode(ctx context.Context, nodeID string) (status string, err error)
	GetNodeInfo(ctx context.Context, nodeID string) (*NodeInfo, error)
	GetAllNodes(ctx context.Context) (map[string]*NodeInfo, error)
	GetNodesByOwner(ctx context.Context, owner string) (map[string]*NodeInfo, error)
	GetNodeOwner(ctx context.Context, nodeID string) (string, error)
	ReapStaleNodes(ctx context.Context, maxAge time.Duration) error

	JobSet(ctx context.Context, jobID string, fields map[string]string) error
	JobGet(ctx context.Context, jobID, field string) (string, error)
	JobGetAll(ctx context.Context, jobID string) (map[string]string, error)
	JobExists(ctx context.Context, jobID string) (bool, error)
	ListJobsByOwner(ctx context.Context, owner string, limit, offset int) ([]JobInfo, error)
	CountJobsByOwner(ctx context.Context, owner string) (int, error)

	GetAPIKeyUser(ctx context.Context, keyHash string) (string, error)
	SetAPIKey(ctx context.Context, keyHash, userID string) error
	CreateAPIKey(ctx context.Context, keyHash, userID, name, role string, expiresAt *time.Time) error
	ListAPIKeys(ctx context.Context, userID string) ([]APIKeyInfo, error)
	RevokeAPIKey(ctx context.Context, keyHash, userID string) error
	UpdateAPIKeyName(ctx context.Context, keyHash, userID, name string) error
	TouchAPIKey(ctx context.Context, keyHash string) error

	BillingGetCustomer(ctx context.Context, userID string) (string, error)
	BillingSetCustomer(ctx context.Context, userID, customerID string) error
	BillingGetToken(ctx context.Context, userID string) (string, error)
	BillingSetToken(ctx context.Context, userID, tokenID string) error
	BillingGetTotal(ctx context.Context, userID string) (gpuSeconds, paidCents, unpaidCents int64, err error)
	BillingIncrGPU(ctx context.Context, userID string, seconds int64) error
	BillingRecordUsage(ctx context.Context, userID, jobID string, seconds, costCents int64) error
	BillingIncrPaid(ctx context.Context, userID string, cents int64) error
	BillingSetLastCharge(ctx context.Context, userID string) error
	BillingFindUserByCustomer(ctx context.Context, customerID string) (string, error)
	BillingListTransactions(ctx context.Context, userID string, limit int) ([]TransactionInfo, error)

	UsageStart(ctx context.Context, userID, jobID string, meta UsageMeta) error
	UsageStop(ctx context.Context, userID, jobID string) (elapsed, hourlyRateCents int64, providerID, gpuModel string, err error)
	UsageIsActive(ctx context.Context, userID, jobID string) (bool, error)
	UsageElapsed(ctx context.Context, userID, jobID string) (int64, error)

	RecordProviderEarning(ctx context.Context, providerID, renterID, jobID, gpuModel string, elapsed, grossCents, earningsCents int64) error
	GetProviderEarnings(ctx context.Context, providerID string) (ProviderEarningsSummary, error)

	ReapStaleJobs(ctx context.Context, maxAge time.Duration) ([]string, error)

	WorkspaceSet(ctx context.Context, workspaceID string, fields map[string]string) error
	WorkspaceGet(ctx context.Context, workspaceID string) (map[string]string, error)
	ListWorkspacesByOwner(ctx context.Context, owner string, limit int) ([]WorkspaceInfo, error)

	Close()
}
