export interface GpuSku {
  id: string;
  name: string;
  memory_gb: number;
  use_case: string;
  hourly_rate_cents: number;
  hourly_rate_usd: number;
}

/** Fallback catalog when the API is unreachable. Kept in sync with backend/pricing/skus.go */
export const GPU_SKU_CATALOG: GpuSku[] = [
  { id: "gtx-1650", name: "GTX 1650", memory_gb: 4, use_case: "Entry-level inference, dev testing", hourly_rate_cents: 8, hourly_rate_usd: 0.08 },
  { id: "rtx-3060", name: "RTX 3060", memory_gb: 12, use_case: "Light inference, prototyping", hourly_rate_cents: 12, hourly_rate_usd: 0.12 },
  { id: "rtx-3080", name: "RTX 3080", memory_gb: 10, use_case: "Training small models", hourly_rate_cents: 18, hourly_rate_usd: 0.18 },
  { id: "rtx-4080", name: "RTX 4080", memory_gb: 16, use_case: "Mid-size fine-tuning", hourly_rate_cents: 28, hourly_rate_usd: 0.28 },
  { id: "rtx-4090", name: "RTX 4090", memory_gb: 24, use_case: "Fine-tuning, inference", hourly_rate_cents: 35, hourly_rate_usd: 0.35 },
  { id: "rtx-a5000", name: "RTX A5000", memory_gb: 24, use_case: "Stable training runs", hourly_rate_cents: 45, hourly_rate_usd: 0.45 },
  { id: "rtx-a6000", name: "RTX A6000", memory_gb: 48, use_case: "Large batch training", hourly_rate_cents: 55, hourly_rate_usd: 0.55 },
  { id: "l40s", name: "L40S", memory_gb: 48, use_case: "Inference at scale", hourly_rate_cents: 85, hourly_rate_usd: 0.85 },
  { id: "a100-40gb", name: "A100 40GB", memory_gb: 40, use_case: "Large model training", hourly_rate_cents: 110, hourly_rate_usd: 1.1 },
  { id: "a100-80gb", name: "A100 80GB", memory_gb: 80, use_case: "LLM training", hourly_rate_cents: 145, hourly_rate_usd: 1.45 },
  { id: "h100", name: "H100", memory_gb: 80, use_case: "Frontier model training", hourly_rate_cents: 250, hourly_rate_usd: 2.5 },
];

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents >= 100 ? 2 : 4)}`;
}

export function formatHourlyRate(cents: number): string {
  return `$${(cents / 100).toFixed(2)}/hr`;
}