"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  CreditCard,
  DollarSign,
  ExternalLink,
  Plus,
  Smartphone,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabaseClient";
import { API_URL } from "@/lib/api";

const PAYMENT_METHODS = [
  { id: "card", label: "Credit / Debit Card", icon: CreditCard, countries: "Worldwide" },
  { id: "upi", label: "UPI (India)", icon: Smartphone, countries: "India", note: "Google Pay, PhonePe, Paytm, BHIM" },
];

interface Transaction {
  id: string;
  created_at: string;
  type: string;
  amount_cents: number;
  gpu_seconds?: number;
  status: "completed" | "pending" | "failed";
}

export default function BillingPage() {
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [balance, setBalance] = useState<string | null>(null);
  const [usageHours, setUsageHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingAuth(false);
    });
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && !(window as any).Razorpay) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    fetchBillingData(session.access_token);
  }, [session]);

  const fetchBillingData = async (token: string) => {
    try {
      const [usageRes, methodsRes, transactionsRes] = await Promise.all([
        fetch(`${API_URL}/billing/usage`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/billing/payment-methods`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/billing/transactions`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (usageRes.ok) {
        const usageData = await usageRes.json();
        const unpaid = usageData.unpaid_cents ?? 0;
        setBalance(`$${(unpaid / 100).toFixed(2)}`);
        setUsageHours(parseFloat(usageData.gpu_hours ?? "0"));
      } else {
        setBalance("$0.00");
      }

      if (methodsRes.ok) {
        const methodsData = await methodsRes.json();
        setPaymentMethods(methodsData.payment_methods || []);
      }
      if (transactionsRes.ok) {
        const txData = await transactionsRes.json();
        setTransactions(txData.transactions || []);
      }
    } catch {
      setBalance("$0.00");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (method: string) => {
    if (!session?.access_token) return;
    setSelectedMethod(method);
    setProcessingPayment(true);
    setError(null);

    try {
      const custRes = await fetch(`${API_URL}/billing/customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ user_id: session.user.id, email: session.user.email }),
      });
      const custData = await custRes.json();
      if (!custData.razorpay_customer_id) throw new Error("Failed to create customer");

      const setupRes = await fetch(`${API_URL}/billing/setup-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ user_id: session.user.id }),
      });
      const setupData = await setupRes.json();
      if (!setupData.order_id) throw new Error("Failed to create setup order");

      const options: any = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: setupData.amount,
        currency: "INR",
        name: "Tenxo",
        description: "Verify payment method (₹1, immediately refunded)",
        order_id: setupData.order_id,
        prefill: { email: session.user.email || "", contact: "" },
        theme: { color: "#5E6AD2" },
        handler: async function (response: any) {
          const verifyRes = await fetch(`${API_URL}/billing/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              user_id: session.user.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          if (verifyRes.ok) {
            toast("Payment method added successfully", "success");
            setShowAddPayment(false);
            fetchBillingData(session.access_token);
          } else {
            setError(await verifyRes.text());
          }
          setProcessingPayment(false);
        },
        modal: { ondismiss: () => setProcessingPayment(false) },
      };

      if (method === "upi") options.prefill.method = "upi";

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        setError(resp.error?.description || "Payment failed");
        setProcessingPayment(false);
      });
      rzp.open();
    } catch (e: any) {
      setError(e.message);
      setProcessingPayment(false);
    }
  };

  if (checkingAuth || !session) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-text-secondary">
        Verifying your session...
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-6">
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-accent-purple">
          Billing
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-text-primary">
          Usage & Payments
        </h1>
      </div>

      {/* ─── 2-column top section ─── */}
      <div className="mb-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Left: Usage + Balance */}
        <div className="space-y-5">
          {/* Usage graph skeleton */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
                Compute Usage
              </p>
              <Badge>Last 30 days</Badge>
            </div>
            <div className="flex items-end gap-1" style={{ height: 120 }}>
              {[35, 55, 40, 70, 60, 85, 65, 45, 75, 50, 80, 90, 60, 40, 70, 55, 85, 65, 45, 75, 60, 80, 50, 70, 55, 40, 65, 85, 75, 60].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm bg-gradient-to-t from-accent-purple/40 to-accent-purple/20 transition-all hover:from-accent-purple/60"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-text-tertiary">
              <span>May 1</span>
              <span>{usageHours.toFixed(1)} GPU hours</span>
              <span>Today</span>
            </div>
          </Card>

          {/* Quick charge */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
                  Payment method
                </p>
                <p className="mt-1 text-[13px] text-text-secondary">Add a card or UPI to pay for compute</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setShowAddPayment(true)}>
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
          </Card>
        </div>

        {/* Right: Balance + Payment methods */}
        <div className="space-y-5">
          {/* Balance */}
          <Card>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
                  Outstanding Charges
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
                  {loading ? "..." : balance}
                </p>
                <p className="mt-1 text-[11px] text-text-tertiary">
                  Accrued compute usage at $0.15/GPU/hr
                </p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                <Wallet className="size-4 text-text-secondary" />
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-[12px] text-text-tertiary">
              <div className="flex items-center gap-2">
                <DollarSign className="size-3.5" />
                Pre-paid credits: Coming soon
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="size-3.5" />
                Auto-charge at $1.00 threshold
              </div>
            </div>
          </Card>

          {/* Payment methods */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
                Payment Methods
              </p>
              {!showAddPayment && (
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="flex items-center gap-1 text-[12px] text-accent-purple transition-colors hover:text-accent-purple/80"
                >
                  <Plus className="size-3.5" />
                  Add
                </button>
              )}
            </div>

            {showAddPayment ? (
              <div className="space-y-2">
                <p className="text-[11px] text-text-tertiary mb-2">
                  You&apos;ll be charged ₹1 (immediately refunded) to verify the card.
                </p>
                {PAYMENT_METHODS.map((method) => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.id}
                      onClick={() => handleAddPayment(method.id)}
                      disabled={processingPayment}
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-left transition-colors hover:border-white/[0.15] disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="size-4 text-text-secondary" />
                        <div className="flex-1">
                          <p className="text-[13px] font-medium text-text-primary">{method.label}</p>
                          <p className="text-[11px] text-text-tertiary">{method.countries}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {processingPayment && (
                  <p className="text-center text-[12px] text-text-tertiary">Opening Razorpay...</p>
                )}
                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-[12px] text-red-400">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <button
                  onClick={() => { setShowAddPayment(false); setError(null); }}
                  className="w-full text-center text-[12px] text-text-tertiary hover:text-text-secondary"
                >
                  Cancel
                </button>
              </div>
            ) : paymentMethods.length > 0 ? (
              <div className="space-y-2">
                {paymentMethods.map((pm: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                    <CreditCard className="size-4 text-text-secondary" />
                    <div className="flex-1">
                      <p className="text-[13px] text-text-primary">
                        {pm.type === "card" ? `•••• ${pm.last4}` : "UPI"}
                      </p>
                      <p className="text-[11px] text-text-tertiary">{pm.country || "Verified"}</p>
                    </div>
                    <CheckCircle className="size-4 text-emerald-400" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-text-tertiary">No payment methods on file</p>
            )}
          </Card>
        </div>
      </div>

      {/* ─── History Table ─── */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
            Transaction History
          </p>
          <Badge>{transactions.length} entries</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="pb-3 pr-4 text-[11px] font-medium text-text-tertiary">Date</th>
                <th className="pb-3 pr-4 text-[11px] font-medium text-text-tertiary">Type</th>
                <th className="pb-3 pr-4 text-[11px] font-medium text-text-tertiary">Amount</th>
                <th className="pb-3 pr-4 text-[11px] font-medium text-text-tertiary">Tx Hash</th>
                <th className="pb-3 text-[11px] font-medium text-text-tertiary">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-text-tertiary">
                    No billing events yet.
                  </td>
                </tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.02]">
                  <td className="py-3 pr-4 text-text-secondary">{new Date(tx.created_at).toLocaleDateString()}</td>
                  <td className="py-3 pr-4 text-text-primary">{tx.type === "gpu_usage" ? "GPU usage" : "Payment"}</td>
                  <td className="py-3 pr-4 font-mono text-text-primary">
                    {tx.amount_cents > 0 ? `$${(tx.amount_cents / 100).toFixed(2)}` : `${Math.round((tx.gpu_seconds || 0) / 60)} min`}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-1 font-mono text-[12px] text-text-tertiary">
                      {tx.id.substring(0, 18)}
                      <ExternalLink className="size-3 shrink-0" />
                    </span>
                  </td>
                  <td className="py-3">
                    <Badge
                      variant={tx.status === "completed" ? "success" : tx.status === "pending" ? "warning" : "default"}
                    >
                      {tx.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
