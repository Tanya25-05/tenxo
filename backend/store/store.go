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

type NodeInfo struct {
	NodeID         string     `json:"node_id"`
	Status         string     `json:"status"`
	Owner          string     `json:"owner,omitempty"`
	GPUModel       string     `json:"gpu_model,omitempty"`
	GPUVRAMMB      int        `json:"gpu_vram_mb,omitempty"`
	TEEAttested    bool       `json:"tee_attested"`
	TEEAttestedAt  *time.Time `json:"tee_last_attested,omitempty"`
	TTL            int64      `json:"ttl_seconds"`
}

type Store interface {
	Migrate(ctx context.Context) error

	SetNode(ctx context.Context, nodeID, status, owner, gpuModel string, gpuVRAMMB int) error
	SetNodeTEE(ctx context.Context, nodeID string) error
	GetNode(ctx context.Context, nodeID string) (status string, err error)
	GetAllNodes(ctx context.Context) (map[string]*NodeInfo, error)
	GetNodesByOwner(ctx context.Context, owner string) (map[string]*NodeInfo, error)
	GetNodeOwner(ctx context.Context, nodeID string) (string, error)
	ReapStaleNodes(ctx context.Context, maxAge time.Duration) error

	JobSet(ctx context.Context, jobID string, fields map[string]string) error
	JobGet(ctx context.Context, jobID, field string) (string, error)
	JobGetAll(ctx context.Context, jobID string) (map[string]string, error)
	JobExists(ctx context.Context, jobID string) (bool, error)

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
	BillingGetTotal(ctx context.Context, userID string) (gpuSeconds, paidCents int64, err error)
	BillingIncrGPU(ctx context.Context, userID string, seconds int64) error
	BillingIncrPaid(ctx context.Context, userID string, cents int64) error
	BillingSetLastCharge(ctx context.Context, userID string) error
	BillingFindUserByCustomer(ctx context.Context, customerID string) (string, error)

	UsageStart(ctx context.Context, userID, jobID string) error
	UsageStop(ctx context.Context, userID, jobID string) (elapsed int64, err error)

	ReapStaleJobs(ctx context.Context, maxAge time.Duration) ([]string, error)

	Close()
}
