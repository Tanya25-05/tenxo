package payment

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/customer"
	"github.com/stripe/stripe-go/v81/paymentintent"
	"github.com/stripe/stripe-go/v81/paymentmethod"
	"github.com/stripe/stripe-go/v81/setupintent"
	"github.com/stripe/stripe-go/v81/webhook"
)

// ─── Config & Handler ──────────────────────────────────────────────────────

type StripeConfig struct {
	SecretKey      string
	WebhookSecret  string
	PublishableKey string
}

type BillingHandler struct {
	cfg StripeConfig
	rdb *redis.Client
}

func NewBillingHandler(rdb *redis.Client) *BillingHandler {
	sk := os.Getenv("STRIPE_SECRET_KEY")
	wh := os.Getenv("STRIPE_WEBHOOK_SECRET")
	pk := os.Getenv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
	if sk == "" {
		log.Println("payment: STRIPE_SECRET_KEY not set — billing disabled")
	}
	return &BillingHandler{
		cfg: StripeConfig{SecretKey: sk, WebhookSecret: wh, PublishableKey: pk},
		rdb: rdb,
	}
}

func (h *BillingHandler) Enabled() bool {
	return h.cfg.SecretKey != ""
}

// ─── Customer Management ───────────────────────────────────────────────────

// POST /billing/customer
// Request:  { "user_id": "supabase-user-id", "email": "alice@example.com" }
// Response: { "stripe_customer_id": "cus_xxx", "has_payment_method": false }
func (h *BillingHandler) HandleCreateCustomer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !h.Enabled() {
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	var req struct {
		UserID string `json:"user_id"`
		Email  string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	stripe.Key = h.cfg.SecretKey
	ctx := context.Background()
	custKey := fmt.Sprintf("stripe_customer:%s", req.UserID)

	// Return existing customer if already created
	if existing, err := h.rdb.Get(ctx, custKey).Result(); err == nil && existing != "" {
		hasPM := h.hasPaymentMethod(ctx, existing)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"stripe_customer_id": existing,
			"has_payment_method": hasPM,
		})
		return
	}

	params := &stripe.CustomerParams{
		Metadata: map[string]string{"user_id": req.UserID},
	}
	if req.Email != "" {
		params.Email = stripe.String(req.Email)
	}
	c, err := customer.New(params)
	if err != nil {
		log.Printf("payment: create customer error: %v", err)
		http.Error(w, "stripe error", http.StatusInternalServerError)
		return
	}

	h.rdb.Set(ctx, custKey, c.ID, 0)
	log.Printf("payment: created Stripe customer %s for user %s", c.ID, req.UserID)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"stripe_customer_id": c.ID,
		"has_payment_method": false,
	})
}

// ─── Setup Intent (save card / UPI) ────────────────────────────────────────

// POST /billing/setup-intent
// Request:  { "user_id": "abc" }
// Response: { "client_secret": "seti_xxx_secret_yyy", "stripe_customer_id": "cus_xxx" }
func (h *BillingHandler) HandleCreateSetupIntent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !h.Enabled() {
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	var req struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	stripe.Key = h.cfg.SecretKey
	custID := h.getOrCreateCustomer(r.Context(), req.UserID)

	params := &stripe.SetupIntentParams{
		Customer:          stripe.String(custID),
		PaymentMethodTypes: []*string{
			stripe.String("card"),
			stripe.String("upi"),
		},
	}

	si, err := setupintent.New(params)
	if err != nil {
		log.Printf("payment: setup intent error: %v", err)
		http.Error(w, "stripe error", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"client_secret":      si.ClientSecret,
		"stripe_customer_id": custID,
	})
}

// ─── Payment Methods ───────────────────────────────────────────────────────

// GET /billing/payment-methods?user_id=abc
// Response: { "payment_methods": [ { "id": "pm_xxx", "type": "card", "last4": "4242", "brand": "visa", "is_default": true } ] }
func (h *BillingHandler) HandleListPaymentMethods(w http.ResponseWriter, r *http.Request) {
	if !h.Enabled() {
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "missing user_id", http.StatusBadRequest)
		return
	}

	stripe.Key = h.cfg.SecretKey
	custID := h.getCustomerID(r.Context(), userID)
	if custID == "" {
		json.NewEncoder(w).Encode(map[string]interface{}{"payment_methods": []interface{}{}})
		return
	}

	// Fetch card payment methods
	cardIter := paymentmethod.List(&stripe.PaymentMethodListParams{
		Customer: stripe.String(custID),
		Type:     stripe.String("card"),
	})
	// Fetch UPI payment methods
	upiIter := paymentmethod.List(&stripe.PaymentMethodListParams{
		Customer: stripe.String(custID),
		Type:     stripe.String("upi"),
	})

	var methods []map[string]interface{}
	for cardIter.Next() {
		pm := cardIter.PaymentMethod()
		methods = append(methods, map[string]interface{}{
			"id":        pm.ID,
			"type":      "card",
			"last4":     pm.Card.Last4,
			"brand":     pm.Card.Brand,
			"exp_month": pm.Card.ExpMonth,
			"exp_year":  pm.Card.ExpYear,
			"is_default": len(methods) == 0,
		})
	}
	for upiIter.Next() {
		pm := upiIter.PaymentMethod()
		methods = append(methods, map[string]interface{}{
			"id":         pm.ID,
			"type":       "upi",
			"is_default": len(methods) == 0,
		})
	}

	json.NewEncoder(w).Encode(map[string]interface{}{"payment_methods": methods})
}

// ─── Usage Tracking & Charging ─────────────────────────────────────────────

// POST /billing/track-usage
// Called by matchmaker when a job starts/stops.
// Request:  { "user_id": "abc", "job_id": "job-xxx", "action": "start"|"stop" }
func (h *BillingHandler) HandleTrackUsage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !h.Enabled() {
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	var req struct {
		UserID string `json:"user_id"`
		JobID  string `json:"job_id"`
		Action string `json:"action"` // "start" or "stop"
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" || req.JobID == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	usageKey := fmt.Sprintf("usage:%s:%s", req.UserID, req.JobID)

	switch req.Action {
	case "start":
		h.rdb.HSet(ctx, usageKey, "started", time.Now().Unix(), "user_id", req.UserID)
		h.rdb.Expire(ctx, usageKey, 72*time.Hour) // auto-clean in 3 days
		w.Write([]byte(`{"tracked": "start"}`))

	case "stop":
		startedStr, err := h.rdb.HGet(ctx, usageKey, "started").Result()
		if err != nil {
			http.Error(w, "job not found", http.StatusNotFound)
			return
		}
		var started int64
		fmt.Sscanf(startedStr, "%d", &started)
		elapsed := time.Now().Unix() - started

		h.rdb.HSet(ctx, usageKey, "stopped", time.Now().Unix(), "elapsed_seconds", elapsed)
		h.rdb.Expire(ctx, usageKey, 72*time.Hour)

		// Accumulate to user's total
		totalKey := fmt.Sprintf("usage_total:%s", req.UserID)
		h.rdb.HIncrBy(ctx, totalKey, "gpu_seconds", elapsed)

		// Auto-charge if threshold reached ($5 = 500 cents)
		h.autoChargeIfNeeded(ctx, req.UserID)

		w.Write([]byte(`{"tracked": "stop"}`))

	default:
		http.Error(w, "invalid action", http.StatusBadRequest)
	}
}

// GET /billing/usage?user_id=abc
// Response: { "gpu_seconds": 3600, "gpu_hours": 1.0, "unpaid_cents": 15 }
func (h *BillingHandler) HandleGetUsage(w http.ResponseWriter, r *http.Request) {
	if !h.Enabled() {
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "missing user_id", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	totalKey := fmt.Sprintf("usage_total:%s", userID)
	secsStr, _ := h.rdb.HGet(ctx, totalKey, "gpu_seconds").Result()
	unpaidStr, _ := h.rdb.HGet(ctx, totalKey, "unpaid_cents").Result()

	var secs, unpaid int64
	fmt.Sscanf(secsStr, "%d", &secs)
	fmt.Sscanf(unpaidStr, "%d", &unpaid)

	hours := float64(secs) / 3600
	rate := 15 // 15 cents per GPU-hour (default rate)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"gpu_seconds":  secs,
		"gpu_hours":    fmt.Sprintf("%.2f", hours),
		"unpaid_cents": unpaid,
		"hourly_rate_cents": rate,
	})
}

// ─── Charge ────────────────────────────────────────────────────────────────

// POST /billing/charge
// Request:  { "user_id": "abc" }
// Response: { "charged": true, "amount_cents": 50, "payment_method": "visa_4242" }
func (h *BillingHandler) HandleCharge(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !h.Enabled() {
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	var req struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	result, err := h.chargeUser(ctx, req.UserID)
	if err != nil {
		log.Printf("payment: charge error for %s: %v", req.UserID, err)
		http.Error(w, err.Error(), http.StatusPaymentRequired)
		return
	}

	json.NewEncoder(w).Encode(result)
}

// ─── Webhook ───────────────────────────────────────────────────────────────

// POST /billing/webhook
// Handles: setup_intent.succeeded, payment_intent.succeeded, payment_intent.payment_failed
func (h *BillingHandler) HandleStripeWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !h.Enabled() {
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}

	const maxBody = 65536
	r.Body = http.MaxBytesReader(w, r.Body, maxBody)
	payload, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "read error", http.StatusBadRequest)
		return
	}

	event, err := webhook.ConstructEvent(payload, r.Header.Get("Stripe-Signature"), h.cfg.WebhookSecret)
	if err != nil {
		log.Printf("payment: webhook signature invalid: %v", err)
		http.Error(w, "invalid signature", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	switch event.Type {
	case "setup_intent.succeeded":
		var si stripe.SetupIntent
		if err := json.Unmarshal(event.Data.Raw, &si); err != nil {
			break
		}
		custID := si.Customer.ID
		userID := h.getUserIDbyCustomer(ctx, custID)
		if userID != "" {
			h.rdb.HSet(ctx, fmt.Sprintf("customer:%s", userID), "has_payment_method", "true")
			log.Printf("payment: user %s saved payment method (setup %s)", userID, si.ID)
		}

	case "payment_intent.succeeded":
		var pi stripe.PaymentIntent
		if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
			break
		}
		userID := pi.Metadata["user_id"]
		if userID != "" {
			amount := pi.Amount
			totalKey := fmt.Sprintf("usage_total:%s", userID)
			h.rdb.HIncrBy(ctx, totalKey, "total_paid_cents", amount)
			h.rdb.HSet(ctx, totalKey, "last_charge", time.Now().Unix())
			log.Printf("payment: charged user %s %d cents (PI %s)", userID, amount, pi.ID)
		}

	case "payment_intent.payment_failed":
		var pi stripe.PaymentIntent
		if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
			break
		}
		userID := pi.Metadata["user_id"]
		if userID != "" {
			log.Printf("payment: payment failed for user %s: %s", userID, pi.LastPaymentError.Msg)
			// Notify user via WebSocket
			h.notifyUser(ctx, userID, map[string]string{
				"type":    "payment_failed",
				"message": pi.LastPaymentError.Msg,
			})
		}
	}

	w.Write([]byte(`{"received": true}`))
}

// ─── Internal Helpers ──────────────────────────────────────────────────────

func (h *BillingHandler) getCustomerID(ctx context.Context, userID string) string {
	custID, err := h.rdb.Get(ctx, fmt.Sprintf("stripe_customer:%s", userID)).Result()
	if err != nil {
		return ""
	}
	return custID
}

func (h *BillingHandler) getUserIDbyCustomer(ctx context.Context, custID string) string {
	// Scan for the customer mapping
	iter := h.rdb.Scan(ctx, 0, "stripe_customer:*", 100).Iterator()
	for iter.Next(ctx) {
		val, err := h.rdb.Get(ctx, iter.Val()).Result()
		if err == nil && val == custID {
			return iter.Val()[len("stripe_customer:"):]
		}
	}
	return ""
}

func (h *BillingHandler) getOrCreateCustomer(ctx context.Context, userID string) string {
	if c := h.getCustomerID(ctx, userID); c != "" {
		return c
	}

	stripe.Key = h.cfg.SecretKey
	c, err := customer.New(&stripe.CustomerParams{
		Metadata: map[string]string{"user_id": userID},
	})
	if err != nil {
		log.Printf("payment: create customer failed: %v", err)
		return ""
	}
	h.rdb.Set(ctx, fmt.Sprintf("stripe_customer:%s", userID), c.ID, 0)
	return c.ID
}

func (h *BillingHandler) hasPaymentMethod(ctx context.Context, custID string) bool {
	stripe.Key = h.cfg.SecretKey
	iter := paymentmethod.List(&stripe.PaymentMethodListParams{
		Customer: stripe.String(custID),
		Type:     stripe.String("card"),
	})
	return iter.Next()
}

func (h *BillingHandler) autoChargeIfNeeded(ctx context.Context, userID string) {
	totalKey := fmt.Sprintf("usage_total:%s", userID)
	unpaidStr, err := h.rdb.HGet(ctx, totalKey, "unpaid_cents").Result()
	if err != nil {
		unpaidStr = "0"
	}
	var unpaid int64
	fmt.Sscanf(unpaidStr, "%d", &unpaid)

	// Calculate from GPU seconds at 15 cents/hour
	gpuSecsStr, _ := h.rdb.HGet(ctx, totalKey, "gpu_seconds").Result()
	var gpuSecs int64
	fmt.Sscanf(gpuSecsStr, "%d", &gpuSecs)

	hourlyRate := int64(15) // 15 cents / GPU-hour
	calculated := (gpuSecs * hourlyRate) / 3600
	unpaid = calculated - h.getTotalPaid(ctx, userID)

	if unpaid >= 100 { // $1 minimum charge threshold
		result, err := h.chargeUser(ctx, userID)
		if err != nil {
			log.Printf("payment: auto-charge failed for %s: %v", userID, err)
			h.notifyUser(ctx, userID, map[string]string{
				"type":    "auto_charge_failed",
				"message": "Auto-charge failed. Please update your payment method.",
			})
		} else {
			log.Printf("payment: auto-charged user %s %d cents", userID, result["amount_cents"])
		}
	}
}

func (h *BillingHandler) chargeUser(ctx context.Context, userID string) (map[string]interface{}, error) {
	stripe.Key = h.cfg.SecretKey
	custID := h.getCustomerID(ctx, userID)
	if custID == "" {
		return nil, fmt.Errorf("no stripe customer for user %s", userID)
	}

	// Calculate amount
	totalKey := fmt.Sprintf("usage_total:%s", userID)
	gpuSecsStr, _ := h.rdb.HGet(ctx, totalKey, "gpu_seconds").Result()
	var gpuSecs int64
	fmt.Sscanf(gpuSecsStr, "%d", &gpuSecs)

	hourlyRate := int64(15)
	calculated := (gpuSecs * hourlyRate) / 3600
	paid := h.getTotalPaid(ctx, userID)
	amountCents := calculated - paid
	if amountCents < 50 {
		amountCents = 50 // minimum charge 50 cents
	}

	// Get the customer's default payment method
	pmIter := paymentmethod.List(&stripe.PaymentMethodListParams{
		Customer: stripe.String(custID),
		Type:     stripe.String("card"),
	})
	if !pmIter.Next() {
		return nil, fmt.Errorf("no payment method on file")
	}
	pmID := pmIter.PaymentMethod().ID

	pi, err := paymentintent.New(&stripe.PaymentIntentParams{
		Amount:          stripe.Int64(amountCents),
		Currency:        stripe.String(string(stripe.CurrencyUSD)),
		Customer:        stripe.String(custID),
		PaymentMethod:   stripe.String(pmID),
		OffSession:      stripe.Bool(true),
		Confirm:         stripe.Bool(true),
		Metadata:        map[string]string{"user_id": userID},
	})
	if err != nil {
		return nil, fmt.Errorf("charge failed: %w", err)
	}

	pm, _ := paymentmethod.Get(pmID, nil)
	label := "card_" + string(pm.Card.Brand) + "_" + pm.Card.Last4

	return map[string]interface{}{
		"charged":        true,
		"amount_cents":   amountCents,
		"payment_method": label,
		"payment_intent": pi.ID,
	}, nil
}

func (h *BillingHandler) getTotalPaid(ctx context.Context, userID string) int64 {
	totalKey := fmt.Sprintf("usage_total:%s", userID)
	paidStr, err := h.rdb.HGet(ctx, totalKey, "total_paid_cents").Result()
	if err != nil {
		return 0
	}
	var paid int64
	fmt.Sscanf(paidStr, "%d", &paid)
	return paid
}

func (h *BillingHandler) notifyUser(ctx context.Context, userID string, data map[string]string) {
	// WebSocket notification via Redis pub/sub
	msg, _ := json.Marshal(data)
	h.rdb.Publish(ctx, fmt.Sprintf("notify:%s", userID), string(msg))
}
