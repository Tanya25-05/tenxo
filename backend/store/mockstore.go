package store

import (
	"context"
	"errors"
	"sort"
	"sync"
	"time"
)

type MockStore struct {
	mu      sync.RWMutex
	nodes   map[string]*NodeInfo
	jobs    map[string]map[string]string
	apiKeys map[string]APIKeyInfo // key_hash -> info
	users   map[string]string     // user_id -> latest key_hash
}

func NewMockStore() *MockStore {
	return &MockStore{
		nodes:   make(map[string]*NodeInfo),
		jobs:    make(map[string]map[string]string),
		apiKeys: make(map[string]APIKeyInfo),
		users:   make(map[string]string),
	}
}

func (m *MockStore) Ping(ctx context.Context) error    { return nil }
func (m *MockStore) Migrate(ctx context.Context) error { return nil }
func (m *MockStore) Close()                            {}

func (m *MockStore) SetNode(ctx context.Context, nodeID, status, owner, gpuModel string, gpuVRAMMB int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	existing, ok := m.nodes[nodeID]
	if ok {
		// Preserve reserved/busy status from heartbeats
		if status == "idle" && existing.Status != "idle" && existing.Status != "" {
			// Don't overwrite reserved/busy with idle
		} else {
			existing.Status = status
		}
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

func (m *MockStore) SetNodeStatus(ctx context.Context, nodeID, status string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if n, ok := m.nodes[nodeID]; ok {
		n.Status = status
	}
	return nil
}

func (m *MockStore) SetNodeStatusIf(ctx context.Context, nodeID, status, expectedCurrent string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if n, ok := m.nodes[nodeID]; ok && n.Status == expectedCurrent {
		n.Status = status
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

func (m *MockStore) GetNodeInfo(ctx context.Context, nodeID string) (*NodeInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	n, ok := m.nodes[nodeID]
	if !ok {
		return nil, errors.New("node not found")
	}
	cp := *n
	return &cp, nil
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

func (m *MockStore) SetNodePubKey(ctx context.Context, nodeID, pubKey string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if n, ok := m.nodes[nodeID]; ok {
		n.PublicKey = pubKey
	} else {
		m.nodes[nodeID] = &NodeInfo{NodeID: nodeID, PublicKey: pubKey}
	}
	return nil
}

func (m *MockStore) GetNodePubKey(ctx context.Context, nodeID string) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	n, ok := m.nodes[nodeID]
	if !ok || n.PublicKey == "" {
		return "", errors.New("pubkey not found")
	}
	return n.PublicKey, nil
}

func (m *MockStore) IncrNodeJobsAssigned(ctx context.Context, nodeID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if n, ok := m.nodes[nodeID]; ok {
		n.JobsAssigned++
	}
	return nil
}

func (m *MockStore) IncrNodeJobsCompleted(ctx context.Context, nodeID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if n, ok := m.nodes[nodeID]; ok {
		n.JobsCompleted++
	}
	return nil
}

func (m *MockStore) UpdateNodeUptime(ctx context.Context, nodeID string, seconds int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if n, ok := m.nodes[nodeID]; ok {
		n.UptimeSeconds += seconds
	}
	return nil
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

func (m *MockStore) ListJobsByOwner(ctx context.Context, owner string, limit, offset int) ([]JobInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if limit <= 0 || limit > 100 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}
	jobs := make([]JobInfo, 0)
	now := time.Now()
	for id, fields := range m.jobs {
		if fields["owner"] != owner {
			continue
		}
		jobs = append(jobs, JobInfo{
			JobID:           id,
			Owner:           fields["owner"],
			Status:          fields["status"],
			UploadURL:       fields["upload_url"],
			ResultUploadURL: fields["result_upload_url"],
			ResultURL:       fields["result_url"],
			ReceiptURL:      fields["receipt_url"],
			GPUModel:        fields["gpu_model"],
			NodeID:          fields["node_id"],
			HourlyRateCents: parseMockInt64(fields["hourly_rate_cents"]),
			Error:           fields["error"],
			CreatedAt:       now,
			UpdatedAt:       now,
		})
	}
	sort.Slice(jobs, func(i, j int) bool { return jobs[i].JobID > jobs[j].JobID })
	if offset >= len(jobs) {
		return []JobInfo{}, nil
	}
	end := offset + limit
	if end > len(jobs) {
		end = len(jobs)
	}
	return jobs[offset:end], nil
}

func (m *MockStore) CountJobsByOwner(ctx context.Context, owner string) (int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	count := 0
	for _, fields := range m.jobs {
		if fields["owner"] == owner {
			count++
		}
	}
	return count, nil
}

func parseMockInt64(s string) int64 {
	var n int64
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + int64(c-'0')
		}
	}
	return n
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
func (m *MockStore) BillingGetTotal(ctx context.Context, userID string) (gpuSeconds, paidCents, unpaidCents int64, err error) {
	return 0, 0, 0, nil
}
func (m *MockStore) BillingIncrGPU(ctx context.Context, userID string, seconds int64) error {
	return nil
}
func (m *MockStore) BillingRecordUsage(ctx context.Context, userID, jobID string, seconds, costCents int64) error {
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
func (m *MockStore) BillingListTransactions(ctx context.Context, userID string, limit int) ([]TransactionInfo, error) {
	return []TransactionInfo{}, nil
}

type usageRecord struct {
	UserID          string
	JobID           string
	StartTime       time.Time
	Stopped         bool
	Elapsed         int64
	GPUModel        string
	HourlyRateCents int64
	ProviderID      string
	NodeID          string
}

var (
	usageMu    sync.Mutex
	usageStore = make(map[string]*usageRecord) // jobID -> record
)

func (m *MockStore) UsageStart(ctx context.Context, userID, jobID string, meta UsageMeta) error {
	usageMu.Lock()
	defer usageMu.Unlock()
	usageStore[jobID] = &usageRecord{
		UserID:          userID,
		JobID:           jobID,
		StartTime:       time.Now(),
		GPUModel:        meta.GPUModel,
		HourlyRateCents: meta.HourlyRateCents,
		ProviderID:      meta.ProviderID,
		NodeID:          meta.NodeID,
	}
	return nil
}

func (m *MockStore) UsageStop(ctx context.Context, userID, jobID string) (elapsed, hourlyRateCents int64, providerID, gpuModel string, err error) {
	usageMu.Lock()
	defer usageMu.Unlock()
	rec, ok := usageStore[jobID]
	if !ok || rec.Stopped {
		return 0, 0, "", "", errors.New("usage not started")
	}
	rec.Stopped = true
	elapsed = int64(time.Since(rec.StartTime).Seconds())
	rec.Elapsed = elapsed
	return elapsed, rec.HourlyRateCents, rec.ProviderID, rec.GPUModel, nil
}

func (m *MockStore) UsageIsActive(ctx context.Context, userID, jobID string) (bool, error) {
	usageMu.Lock()
	defer usageMu.Unlock()
	rec, ok := usageStore[jobID]
	return ok && rec != nil && !rec.Stopped, nil
}

func (m *MockStore) UsageElapsed(ctx context.Context, userID, jobID string) (int64, error) {
	usageMu.Lock()
	defer usageMu.Unlock()
	rec, ok := usageStore[jobID]
	if !ok {
		return 0, errors.New("usage not found")
	}
	if rec.Stopped {
		return rec.Elapsed, nil
	}
	return int64(time.Since(rec.StartTime).Seconds()), nil
}

func (m *MockStore) RecordProviderEarning(ctx context.Context, providerID, renterID, jobID, gpuModel string, elapsed, grossCents, earningsCents int64) error {
	return nil
}

func (m *MockStore) GetProviderEarnings(ctx context.Context, providerID string) (ProviderEarningsSummary, error) {
	return ProviderEarningsSummary{}, nil
}

func (m *MockStore) ReapStaleJobs(ctx context.Context, maxAge time.Duration) ([]string, error) {
	return nil, nil
}

type mockWorkspace struct {
	WorkspaceID string
	Owner       string
	UploadURL   string
	EncKeyB64   string
	OverlayURL  string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

var (
	wsMu       sync.Mutex
	workspaces = make(map[string]*mockWorkspace)
	wsSeq      int
)

func (m *MockStore) WorkspaceSet(ctx context.Context, workspaceID string, fields map[string]string) error {
	wsMu.Lock()
	defer wsMu.Unlock()
	w, ok := workspaces[workspaceID]
	if !ok {
		w = &mockWorkspace{WorkspaceID: workspaceID, CreatedAt: time.Now()}
		workspaces[workspaceID] = w
	}
	if v, ok := fields["owner"]; ok {
		w.Owner = v
	}
	if v, ok := fields["upload_url"]; ok {
		w.UploadURL = v
	}
	if v, ok := fields["enc_key_b64"]; ok {
		w.EncKeyB64 = v
	}
	if v, ok := fields["overlay_url"]; ok {
		w.OverlayURL = v
	}
	w.UpdatedAt = time.Now()
	return nil
}

func (m *MockStore) WorkspaceGet(ctx context.Context, workspaceID string) (map[string]string, error) {
	wsMu.Lock()
	defer wsMu.Unlock()
	w, ok := workspaces[workspaceID]
	if !ok {
		return nil, errors.New("workspace not found")
	}
	return map[string]string{
		"owner":       w.Owner,
		"upload_url":  w.UploadURL,
		"enc_key_b64": w.EncKeyB64,
		"overlay_url": w.OverlayURL,
	}, nil
}

func (m *MockStore) ListWorkspacesByOwner(ctx context.Context, owner string, limit int) ([]WorkspaceInfo, error) {
	wsMu.Lock()
	defer wsMu.Unlock()
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	var result []WorkspaceInfo
	for _, w := range workspaces {
		if w.Owner == owner {
			result = append(result, WorkspaceInfo{
				WorkspaceID: w.WorkspaceID,
				Owner:       w.Owner,
				UploadURL:   w.UploadURL,
				OverlayURL:  w.OverlayURL,
				CreatedAt:   w.CreatedAt,
				UpdatedAt:   w.UpdatedAt,
			})
		}
	}
	return result, nil
}
