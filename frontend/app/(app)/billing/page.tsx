"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, CreditCard, ShieldCheck, Smartphone } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/Button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const PAYMENT_METHODS = [
  { id: "card", label: "Credit / Debit Card", icon: CreditCard, countries: "Worldwide" },
  { id: "upi", label: "UPI (India)", icon: Smartphone, countries: "India", note: "Google Pay, PhonePe, Paytm, BHIM" },
];

export default function BillingSetup() {
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [step, setStep] = useState("intro");
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

  const handleSelect = async (method: string) => {
    setSelectedMethod(method);
    setLoading(true);
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
        theme: { color: "#7c3aed" },
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
            setStep("done");
            setSuccess(true);
          } else {
            setError(await verifyRes.text());
          }
          setLoading(false);
        },
        modal: { ondismiss: () => setLoading(false) },
      };

      if (method === "upi") options.prefill.method = "upi";

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (resp: any) {
        setError(resp.error?.description || "Payment failed");
        setLoading(false);
      });
      rzp.open();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  if (checkingAuth || !session) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-gray-500">
        Verifying your session...
      </div>
    );
  }

  if (step === "done" && success) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle className="size-8 text-emerald-400" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-white">Payment method added</h2>
        <p className="mb-8 text-sm text-gray-500">
          You can now submit GPU jobs. You will be charged for actual usage only.
        </p>
        <a href="/app/developer">
          <Button>
            <CreditCard className="size-4" />
            Go to Developer Console
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <ShieldCheck className="size-6 text-gray-300" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-white">Set up billing to continue</h1>
        <p className="text-sm text-gray-500">
          You need a payment method to use Tenxo GPU compute. Pay only for what you use — by the second.
        </p>
      </div>

      <div className="space-y-3">
        {PAYMENT_METHODS.map((method) => {
          const Icon = method.icon;
          const active = selectedMethod === method.id;
          return (
            <button
              key={method.id}
              onClick={() => handleSelect(method.id)}
              disabled={loading}
              className={`w-full rounded-xl border p-5 text-left transition-colors ${
                active
                  ? "border-blue-400/40 bg-blue-500/5"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex size-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
                  <Icon className="size-4 text-gray-300" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{method.label}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{method.countries}</p>
                  {method.note && <p className="mt-1 text-xs text-gray-400">{method.note}</p>}
                </div>
                <div className="shrink-0">
                  {active ? (
                    <div className="size-5 rounded-full border-2 border-blue-400 bg-blue-400" />
                  ) : (
                    <div className="size-5 rounded-full border-2 border-white/20" />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="mt-6 text-center text-sm text-gray-500">Opening Razorpay Checkout...</div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-3 rounded-lg bg-red-500/10 p-4 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
