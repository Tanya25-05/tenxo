package store

import (
	"context"
	"errors"
	"sync"
	"time"
)

type MockStore struct {
	mu      sync.RWMutex
	nodes   map[string]*NodeInfo
	jobs    map[string]map[string]string
	apiKeys map[string]APIKeyInfo // key_hash -> info
	users   map[string]string    // user_id -> latest key_hash
}

func NewMockStore() *MockStore {
	return &MockStore{
		nodes:   make(map[string]*NodeInfo),
		jobs:    make(map[string]map[string]string),
		apiKeys: make(map[string]APIKeyInfo),
		users:   make(map[string]string),
	}
}

func (m *MockStore) Migrate(ctx context.Context) error { return nil }
func (m *MockStore) Close()                            {}

func (m *MockStore) SetNode(ctx context.Context, nodeID, status, owner, gpuModel string, gpuVRAMMB int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	existing, ok := m.nodes[nodeID]
	if ok {
		existing.Status = status
		existing.Owner = owner
		if gpuModel != "" {
			existing.GPUModel = gpuModel
		}
		if gpuVRAMMB != 0 {
			existing.GPUVRAMMB = gpuVRAMMB
		}
	} else {
		m.nodes[nodeID] = &NodeInfo{
			NodeID:    nodeID,
			Status:    status,
			Owner:     owner,
			GPUModel:  gpuModel,
			GPUVRAMMB: gpuVRAMMB,
		}
	}
	return nil
}

func (m *MockStore) SetNodeTEE(ctx context.Context, nodeID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	n, ok := m.nodes[nodeID]
	if !ok {
		return errors.New("node not found")
	}
	now := time.Now()
	n.TEEAttested = true
	n.TEEAttestedAt = &now
	return nil
}

func (m *MockStore) GetNode(ctx context.Context, nodeID string) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	n, ok := m.nodes[nodeID]
	if !ok {
		return "", errors.New("node not found")
	}
	return n.Status, nil
}

func (m *MockStore) GetAllNodes(ctx context.Context) (map[string]*NodeInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make(map[string]*NodeInfo, len(m.nodes))
	for k, v := range m.nodes {
		cp := *v
		result[k] = &cp
	}
	return result, nil
}

func (m *MockStore) GetNodesByOwner(ctx context.Context, owner string) (map[string]*NodeInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make(map[string]*NodeInfo)
	for k, v := range m.nodes {
		if v.Owner == owner {
			cp := *v
			result[k] = &cp
		}
	}
	return result, nil
}

func (m *MockStore) GetNodeOwner(ctx context.Context, nodeID string) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	n, ok := m.nodes[nodeID]
	if !ok {
		return "", errors.New("node not found")
	}
	return n.Owner, nil
}

func (m *MockStore) ReapStaleNodes(ctx context.Context, maxAge time.Duration) error {
	return nil
}

func (m *MockStore) JobSet(ctx context.Context, jobID string, fields map[string]string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.jobs[jobID]; !ok {
		m.jobs[jobID] = make(map[string]string)
	}
	for k, v := range fields {
		m.jobs[jobID][k] = v
	}
	return nil
}

func (m *MockStore) JobGet(ctx context.Context, jobID, field string) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	j, ok := m.jobs[jobID]
	if !ok {
		return "", errors.New("job not found")
	}
	v, ok := j[field]
	if !ok {
		return "", errors.New("field not found")
	}
	return v, nil
}

func (m *MockStore) JobGetAll(ctx context.Context, jobID string) (map[string]string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	j, ok := m.jobs[jobID]
	if !ok {
		return nil, errors.New("job not found")
	}
	result := make(map[string]string, len(j))
	for k, v := range j {
		result[k] = v
	}
	return result, nil
}

func (m *MockStore) JobExists(ctx context.Context, jobID string) (bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	_, ok := m.jobs[jobID]
	return ok, nil
}

func (m *MockStore) GetAPIKeyUser(ctx context.Context, keyHash string) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	k, ok := m.apiKeys[keyHash]
	if !ok {
		return "", errors.New("key not found")
	}
	if !k.IsActive {
		return "", errors.New("key revoked")
	}
	if k.ExpiresAt != nil && k.ExpiresAt.Before(time.Now()) {
		return "", errors.New("key expired")
	}
	return k.UserID, nil
}

func (m *MockStore) SetAPIKey(ctx context.Context, keyHash, userID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	k, ok := m.apiKeys[keyHash]
	if ok {
		k.UserID = userID
		m.apiKeys[keyHash] = k
	}
	return nil
}

func (m *MockStore) CreateAPIKey(ctx context.Context, keyHash, userID, name, role string, expiresAt *time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.apiKeys[keyHash] = APIKeyInfo{
		KeyHash:   keyHash,
		UserID:    userID,
		Name:      name,
		Role:      role,
		IsActive:  true,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}
	m.users[userID] = keyHash
	return nil
}

func (m *MockStore) ListAPIKeys(ctx context.Context, userID string) ([]APIKeyInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []APIKeyInfo
	for _, k := range m.apiKeys {
		if k.UserID == userID {
			result = append(result, k)
		}
	}
	if result == nil {
		result = []APIKeyInfo{}
	}
	return result, nil
}

func (m *MockStore) RevokeAPIKey(ctx context.Context, keyHash, userID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	k, ok := m.apiKeys[keyHash]
	if !ok {
		return errors.New("key not found")
	}
	if k.UserID != userID {
		return errors.New("key does not belong to user")
	}
	k.IsActive = false
	m.apiKeys[keyHash] = k
	return nil
}

func (m *MockStore) UpdateAPIKeyName(ctx context.Context, keyHash, userID, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	k, ok := m.apiKeys[keyHash]
	if !ok {
		return errors.New("key not found")
	}
	if k.UserID != userID {
		return errors.New("key does not belong to user")
	}
	k.Name = name
	m.apiKeys[keyHash] = k
	return nil
}

func (m *MockStore) TouchAPIKey(ctx context.Context, keyHash string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	k, ok := m.apiKeys[keyHash]
	if !ok {
		return errors.New("key not found")
	}
	now := time.Now()
	k.LastUsedAt = &now
	m.apiKeys[keyHash] = k
	return nil
}

func (m *MockStore) BillingGetCustomer(ctx context.Context, userID string) (string, error) {
	return "", errors.New("not found")
}
func (m *MockStore) BillingSetCustomer(ctx context.Context, userID, customerID string) error {
	return nil
}
func (m *MockStore) BillingGetToken(ctx context.Context, userID string) (string, error) {
	return "", errors.New("not found")
}
func (m *MockStore) BillingSetToken(ctx context.Context, userID, tokenID string) error {
	return nil
}
func (m *MockStore) BillingGetTotal(ctx context.Context, userID string) (gpuSeconds, paidCents int64, err error) {
	return 0, 0, nil
}
func (m *MockStore) BillingIncrGPU(ctx context.Context, userID string, seconds int64) error {
	return nil
}
func (m *MockStore) BillingIncrPaid(ctx context.Context, userID string, cents int64) error {
	return nil
}
func (m *MockStore) BillingSetLastCharge(ctx context.Context, userID string) error {
	return nil
}
func (m *MockStore) BillingFindUserByCustomer(ctx context.Context, customerID string) (string, error) {
	return "", errors.New("not found")
}

type usageRecord struct {
	UserID    string
	JobID     string
	StartTime time.Time
}

var (
	usageMu    sync.Mutex
	usageStore = make(map[string]*usageRecord) // jobID -> record
)

func (m *MockStore) UsageStart(ctx context.Context, userID, jobID string) error {
	usageMu.Lock()
	defer usageMu.Unlock()
	usageStore[jobID] = &usageRecord{
		UserID:    userID,
		JobID:     jobID,
		StartTime: time.Now(),
	}
	return nil
}

func (m *MockStore) UsageStop(ctx context.Context, userID, jobID string) (elapsed int64, err error) {
	usageMu.Lock()
	defer usageMu.Unlock()
	rec, ok := usageStore[jobID]
	if !ok {
		return 0, errors.New("usage not started")
	}
	delete(usageStore, jobID)
	return int64(time.Since(rec.StartTime).Seconds()), nil
}

func (m *MockStore) ReapStaleJobs(ctx context.Context, maxAge time.Duration) ([]string, error) {
	return nil, nil
}
