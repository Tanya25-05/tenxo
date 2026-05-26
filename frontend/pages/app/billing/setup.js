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

  // Load Razorpay Checkout script
  useEffect(() => {
    if (typeof window !== "undefined" && !window.Razorpay) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
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
      // Create Razorpay customer + setup order
      const custRes = await fetch(`${API_URL}/billing/customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ user_id: session.user.id, email: session.user.email }),
      });
      const custData = await custRes.json();
      if (!custData.razorpay_customer_id) throw new Error("Failed to create customer");

      // Create setup order (₹1 verification)
      const setupRes = await fetch(`${API_URL}/billing/setup-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ user_id: session.user.id }),
      });
      const setupData = await setupRes.json();
      if (!setupData.order_id) throw new Error("Failed to create setup order");

      // Open Razorpay Checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: setupData.amount,
        currency: "INR",
        name: "Tenxo",
        description: "Verify payment method (₹1, immediately refunded)",
        order_id: setupData.order_id,
        prefill: {
          email: session.user.email || "",
          contact: "",
        },
        theme: { color: "#7c3aed" },
        handler: async function (response) {
          // Verify payment on backend
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
            setStep("done");
            setSuccess(true);
          } else {
            const err = await verifyRes.text();
            setError(err);
          }
          setLoading(false);
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      if (method === "upi") {
        options.prefill.method = "upi";
      }

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        setError(resp.error?.description || "Payment failed");
        setLoading(false);
      });
      rzp.open();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
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

        {loading && (
          <div className="mt-6 text-center text-sm text-[var(--text-muted)]">
            Opening Razorpay Checkout...
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-lg bg-red-500/10 p-4 text-sm text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </AppShell>
  );
}
