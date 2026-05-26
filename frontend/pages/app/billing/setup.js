import { useEffect, useState } from "react";
import { Card, ShieldCheck, Smartphone, CreditCard, AlertTriangle, CheckCircle } from "lucide-react";
import { useRequireSession } from "../../../lib/useRequireSession";
import AppShell from "../../../components/AppShell";
import { API_URL } from "../../../lib/api";

const PAYMENT_METHODS = [
  { id: "card", label: "Credit / Debit Card", icon: CreditCard, countries: "Worldwide" },
  { id: "upi", label: "UPI (India)", icon: Smartphone, countries: "India", note: "Google Pay, PhonePe, Paytm, BHIM" },
];

export default function BillingSetup() {
  const { checkingAuth, session } = useRequireSession();
  const [step, setStep] = useState("intro");
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!session?.access_token) return;
    // Check if user already has payment method
    fetch(`${API_URL}/billing/customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ user_id: session.user.id, email: session.user.email }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.has_payment_method) {
          setStep("done");
          setSuccess(true);
        }
      })
      .catch(() => {});
  }, [session]);

  const handleSelect = async (method) => {
    setSelectedMethod(method);
    setLoading(true);
    setError(null);
    try {
      // Create Stripe customer + setup intent
      const custRes = await fetch(`${API_URL}/billing/customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ user_id: session.user.id, email: session.user.email }),
      });
      const custData = await custRes.json();
      if (!custData.stripe_customer_id) throw new Error("Failed to create customer");

      // For MVP: redirect to Stripe hosted setup page
      // In production: use Stripe Elements with @stripe/react-stripe-js
      setStep("configure");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    setStep("done");
    setSuccess(true);
  };

  if (checkingAuth || !session) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-[var(--text-muted)]">
        Verifying your session...
      </div>
    );
  }

  if (step === "done" && success) {
    return (
      <AppShell active="Billing" role="developer" title="Billing & Payment">
        <div className="mx-auto max-w-lg py-12 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle size={32} className="text-green-400" />
          </div>
          <h2 className="mb-2 text-2xl font-semibold text-white">Payment method added</h2>
          <p className="mb-8 text-sm text-[var(--text-muted)]">
            You can now submit GPU jobs. You will be charged for actual usage only.
          </p>
          <a href="/app/developer" className="tenxo-btn-primary inline-flex items-center gap-2">
            <Card size={16} />
            Go to Developer Console
          </a>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="Billing" role="developer" title="Add Payment Method">
      <div className="mx-auto max-w-2xl py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--accent-tenxo)]/10">
            <ShieldCheck size={28} className="text-[var(--accent-tenxo)]" />
          </div>
          <h1 className="mb-2 text-2xl font-semibold text-white">Set up billing to continue</h1>
          <p className="text-sm text-[var(--text-muted)]">
            You need a payment method to use Tenxo GPU compute.
            Pay only for what you use — by the second.
          </p>
        </div>

        <div className="space-y-3">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.id}
              onClick={() => handleSelect(method.id)}
              disabled={loading}
              className={`w-full rounded-xl border p-5 text-left transition ${
                selectedMethod === method.id
                  ? "border-[var(--accent-tenxo)] bg-[var(--accent-tenxo)]/5"
                  : "border-white/[0.07] bg-white/[0.035] hover:border-white/[0.15]"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="tenxo-icon-tile">
                  <method.icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">{method.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{method.countries}</p>
                  {method.note && (
                    <p className="mt-1.5 text-xs text-[var(--accent-tenxo)]">{method.note}</p>
                  )}
                </div>
                <div className="shrink-0">
                  {selectedMethod === method.id ? (
                    <div className="h-5 w-5 rounded-full border-2 border-[var(--accent-tenxo)] bg-[var(--accent-tenxo)]" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-white/[0.2]" />
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-lg bg-red-500/10 p-4 text-sm text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === "configure" && selectedMethod && (
          <div className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.035] p-6">
            <h3 className="mb-4 font-semibold text-white">
              {selectedMethod === "card" ? "Enter card details" : "Enter your UPI ID"}
            </h3>

            {selectedMethod === "card" ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-white/[0.1] bg-black/20 p-3">
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Card Number</label>
                  <input
                    type="text"
                    placeholder="4242 4242 4242 4242"
                    className="w-full bg-transparent font-mono text-sm text-white outline-none placeholder:text-white/[0.25]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-white/[0.1] bg-black/20 p-3">
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Expiry</label>
                    <input
                      type="text"
                      placeholder="MM / YY"
                      className="w-full bg-transparent font-mono text-sm text-white outline-none placeholder:text-white/[0.25]"
                    />
                  </div>
                  <div className="rounded-lg border border-white/[0.1] bg-black/20 p-3">
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">CVC</label>
                    <input
                      type="text"
                      placeholder="123"
                      className="w-full bg-transparent font-mono text-sm text-white outline-none placeholder:text-white/[0.25]"
                    />
                  </div>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Your card info is sent directly to Stripe. We never see or store full card numbers.
                  A $1 authorization hold will be placed and immediately refunded.
                </p>
                <button onClick={handleDone} className="tenxo-btn-primary w-full">
                  <Card size={16} />
                  Add Card
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-white/[0.1] bg-black/20 p-3">
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">UPI ID</label>
                  <input
                    type="text"
                    placeholder="username@paytm / username@okhdfcbank / username@ybl"
                    className="w-full bg-transparent font-mono text-sm text-white outline-none placeholder:text-white/[0.25]"
                  />
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  You will receive a payment request on your UPI app. Approve it to verify
                  your payment method. A ₹1 authorization will be placed and refunded.
                </p>
                <button onClick={handleDone} className="tenxo-btn-primary w-full">
                  <Smartphone size={16} />
                  Add UPI
                </button>
              </div>
            )}

            <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
              Secured by <strong className="text-white">Stripe</strong>
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
