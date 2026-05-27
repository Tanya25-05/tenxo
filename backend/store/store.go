package store

import (
	"context"
	"time"
)

type NodeInfo struct {
	NodeID string `json:"node_id"`
	Status string `json:"status"`
	Owner  string `json:"owner,omitempty"`
	TTL    int64  `json:"ttl_seconds"`
}

type Store interface {
	Migrate(ctx context.Context) error

	SetNode(ctx context.Context, nodeID, status, owner string) error
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

	Close()
}
