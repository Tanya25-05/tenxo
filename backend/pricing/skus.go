package pricing

import "strings"

// SKUCatalog lists supported GPU tiers with hourly rates in USD cents.
// Rates are positioned below hyperscaler on-demand pricing to stay competitive
// while leaving room for provider payouts (70% share).
var SKUCatalog = []SKU{
	{ID: "gtx-1650", Name: "GTX 1650", MemoryGB: 4, UseCase: "Entry-level inference, dev testing", HourlyRateCents: 8, Matchers: []string{"1650", "gtx 1650", "geforce gtx 1650", "nvidia geforce gtx 1650"}},
	{ID: "rtx-3060", Name: "RTX 3060", MemoryGB: 12, UseCase: "Light inference, prototyping", HourlyRateCents: 12, Matchers: []string{"3060", "geforce rtx 3060"}},
	{ID: "rtx-3080", Name: "RTX 3080", MemoryGB: 10, UseCase: "Training small models", HourlyRateCents: 18, Matchers: []string{"3080", "geforce rtx 3080"}},
	{ID: "rtx-4080", Name: "RTX 4080", MemoryGB: 16, UseCase: "Mid-size fine-tuning", HourlyRateCents: 28, Matchers: []string{"4080", "geforce rtx 4080"}},
	{ID: "rtx-4090", Name: "RTX 4090", MemoryGB: 24, UseCase: "Fine-tuning, inference", HourlyRateCents: 35, Matchers: []string{"4090", "geforce rtx 4090"}},
	{ID: "rtx-a5000", Name: "RTX A5000", MemoryGB: 24, UseCase: "Stable training runs", HourlyRateCents: 45, Matchers: []string{"a5000", "rtx a5000"}},
	{ID: "rtx-a6000", Name: "RTX A6000", MemoryGB: 48, UseCase: "Large batch training", HourlyRateCents: 55, Matchers: []string{"a6000", "rtx a6000"}},
	{ID: "l40s", Name: "L40S", MemoryGB: 48, UseCase: "Inference at scale", HourlyRateCents: 85, Matchers: []string{"l40s", "l40"}},
	{ID: "a100-40gb", Name: "A100 40GB", MemoryGB: 40, UseCase: "Large model training", HourlyRateCents: 110, Matchers: []string{"a100", "a100-sxm4-40gb", "a100 40"}},
	{ID: "a100-80gb", Name: "A100 80GB", MemoryGB: 80, UseCase: "LLM training", HourlyRateCents: 145, Matchers: []string{"a100 80", "a100-sxm4-80gb", "a100 80gb"}},
	{ID: "h100", Name: "H100", MemoryGB: 80, UseCase: "Frontier model training", HourlyRateCents: 250, Matchers: []string{"h100", "h100 80", "h100 94"}},
}

const DefaultHourlyRateCents = 15
const ProviderSharePercent = 70

type SKU struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	MemoryGB        int      `json:"memory_gb"`
	UseCase         string   `json:"use_case"`
	HourlyRateCents int64    `json:"hourly_rate_cents"`
	HourlyRateUSD   float64  `json:"hourly_rate_usd"`
	Matchers        []string `json:"-"`
}

func init() {
	for i := range SKUCatalog {
		SKUCatalog[i].HourlyRateUSD = float64(SKUCatalog[i].HourlyRateCents) / 100
	}
}

// MatchSKU resolves the best catalog entry for a detected GPU model string.
func MatchSKU(gpuModel string) SKU {
	normalized := strings.ToLower(strings.TrimSpace(gpuModel))
	if normalized == "" {
		return defaultSKU()
	}

	bestScore := 0
	best := defaultSKU()
	for _, sku := range SKUCatalog {
		for _, matcher := range sku.Matchers {
			m := strings.ToLower(matcher)
			if strings.Contains(normalized, m) && len(m) > bestScore {
				bestScore = len(m)
				best = sku
			}
		}
	}
	return best
}

func defaultSKU() SKU {
	return SKU{
		ID:              "generic-gpu",
		Name:            "Generic GPU",
		MemoryGB:        0,
		UseCase:         "General compute",
		HourlyRateCents: DefaultHourlyRateCents,
		HourlyRateUSD:   float64(DefaultHourlyRateCents) / 100,
	}
}

// CostCents computes billable cents for elapsed GPU seconds at a given hourly rate.
func CostCents(elapsedSeconds, hourlyRateCents int64) int64 {
	if elapsedSeconds <= 0 || hourlyRateCents <= 0 {
		return 0
	}
	cost := (elapsedSeconds * hourlyRateCents) / 3600
	if cost < 1 {
		return 1
	}
	return cost
}

// ProviderEarningsCents returns the provider's share of gross job revenue.
func ProviderEarningsCents(grossCents int64) int64 {
	if grossCents <= 0 {
		return 0
	}
	return (grossCents * ProviderSharePercent) / 100
}

// PublicCatalog returns SKU data safe for API responses.
func PublicCatalog() []SKU {
	out := make([]SKU, len(SKUCatalog))
	copy(out, SKUCatalog)
	return out
}