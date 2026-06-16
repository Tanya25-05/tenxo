package payment

import (
	"context"
	"log"

	"github.com/gpu-grid/matchmaker/pricing"
	"github.com/gpu-grid/matchmaker/store"
)

// JobBillingStartResult is returned when usage tracking begins for a job.
type JobBillingStartResult struct {
	GPUModel        string `json:"gpu_model"`
	HourlyRateCents int64  `json:"hourly_rate_cents"`
	HourlyRateUSD   string `json:"hourly_rate_usd"`
	ProviderID      string `json:"provider_id,omitempty"`
	AlreadyTracking bool   `json:"already_tracking,omitempty"`
}

// JobBillingStopResult is returned when usage tracking ends for a job.
type JobBillingStopResult struct {
	ElapsedSeconds  int64 `json:"elapsed_seconds"`
	CostCents       int64 `json:"cost_cents"`
	ProviderEarning int64 `json:"provider_earning_cents"`
	Skipped         bool  `json:"skipped,omitempty"`
}

// StartJobBilling begins per-second usage tracking when a job enters the running state.
// It is idempotent: restarting tracking for the same job resets the timer.
func StartJobBilling(ctx context.Context, st store.Store, userID, jobID, nodeID, gpuModel string) (JobBillingStartResult, error) {
	result := JobBillingStartResult{}

	if gpuModel == "" && nodeID != "" {
		if node, err := st.GetNodeInfo(ctx, nodeID); err == nil && node.GPUModel != "" {
			gpuModel = node.GPUModel
		}
	}

	sku := pricing.MatchSKU(gpuModel)
	result.GPUModel = gpuModel
	if result.GPUModel == "" {
		result.GPUModel = sku.Name
	}
	result.HourlyRateCents = sku.HourlyRateCents
	result.HourlyRateUSD = formatUSD(sku.HourlyRateCents)

	if nodeID != "" {
		if providerID, err := st.GetNodeOwner(ctx, nodeID); err == nil {
			result.ProviderID = providerID
		}
	}

	// Persist billing metadata on the job for later cost calculation.
	_ = st.JobSet(ctx, jobID, map[string]string{
		"node_id":           nodeID,
		"gpu_model":         result.GPUModel,
		"hourly_rate_cents": int64ToString(sku.HourlyRateCents),
	})

	if active, _ := st.UsageIsActive(ctx, userID, jobID); active {
		result.AlreadyTracking = true
		return result, nil
	}

	if err := st.UsageStart(ctx, userID, jobID, store.UsageMeta{
		GPUModel:        result.GPUModel,
		HourlyRateCents: sku.HourlyRateCents,
		ProviderID:      result.ProviderID,
		NodeID:          nodeID,
	}); err != nil {
		return result, err
	}

	log.Printf("billing: started usage for job %s user %s @ %dc/hr gpu=%s provider=%s",
		jobID, userID, sku.HourlyRateCents, result.GPUModel, result.ProviderID)
	return result, nil
}

// StopJobBilling ends usage tracking, records costs, and triggers auto-charge when enabled.
func StopJobBilling(ctx context.Context, st store.Store, bh *BillingHandler, userID, jobID string) (JobBillingStopResult, error) {
	result := JobBillingStopResult{}

	if active, _ := st.UsageIsActive(ctx, userID, jobID); !active {
		result.Skipped = true
		return result, nil
	}

	elapsed, rateCents, providerID, gpuModel, err := st.UsageStop(ctx, userID, jobID)
	if err != nil {
		log.Printf("billing: UsageStop %s/%s: %v", userID, jobID, err)
		result.Skipped = true
		return result, nil
	}

	if rateCents == 0 {
		if v, _ := st.JobGet(ctx, jobID, "hourly_rate_cents"); v != "" {
			rateCents = parseInt64(v)
		}
		if rateCents == 0 {
			if gm, _ := st.JobGet(ctx, jobID, "gpu_model"); gm != "" {
				rateCents = pricing.MatchSKU(gm).HourlyRateCents
			} else {
				rateCents = pricing.DefaultHourlyRateCents
			}
		}
	}
	if providerID == "" {
		if nodeID, _ := st.JobGet(ctx, jobID, "node_id"); nodeID != "" {
			providerID, _ = st.GetNodeOwner(ctx, nodeID)
		}
	}
	if gpuModel == "" {
		gpuModel, _ = st.JobGet(ctx, jobID, "gpu_model")
	}

	costCents := pricing.CostCents(elapsed, rateCents)
	providerEarning := pricing.ProviderEarningsCents(costCents)

	result.ElapsedSeconds = elapsed
	result.CostCents = costCents
	result.ProviderEarning = providerEarning

	if err := st.BillingRecordUsage(ctx, userID, jobID, elapsed, costCents); err != nil {
		log.Printf("billing: record usage %s/%s: %v", userID, jobID, err)
	}

	if providerID != "" && costCents > 0 {
		if err := st.RecordProviderEarning(ctx, providerID, userID, jobID, gpuModel, elapsed, costCents, providerEarning); err != nil {
			log.Printf("billing: provider earning %s/%s: %v", providerID, jobID, err)
		}
	}

	if bh != nil && bh.Enabled() {
		bh.autoChargeIfNeeded(ctx, userID)
	}

	log.Printf("billing: stopped usage for job %s user %s elapsed=%ds cost=%dc provider=%s earning=%dc",
		jobID, userID, elapsed, costCents, providerID, providerEarning)
	return result, nil
}

func int64ToString(v int64) string {
	if v == 0 {
		return "0"
	}
	return formatInt(v)
}

func formatInt(v int64) string {
	if v == 0 {
		return "0"
	}
	neg := v < 0
	if neg {
		v = -v
	}
	buf := make([]byte, 0, 20)
	for v > 0 {
		buf = append(buf, byte('0'+v%10))
		v /= 10
	}
	for i, j := 0, len(buf)-1; i < j; i, j = i+1, j-1 {
		buf[i], buf[j] = buf[j], buf[i]
	}
	if neg {
		return "-" + string(buf)
	}
	return string(buf)
}

func parseInt64(s string) int64 {
	var n int64
	for _, c := range s {
		if c < '0' || c > '9' {
			continue
		}
		n = n*10 + int64(c-'0')
	}
	return n
}

func formatUSD(cents int64) string {
	dollars := cents / 100
	remainder := cents % 100
	return formatInt(dollars) + "." + pad2(remainder)
}

func pad2(n int64) string {
	if n < 0 {
		n = -n
	}
	if n < 10 {
		return "0" + formatInt(n)
	}
	return formatInt(n)
}