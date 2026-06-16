package payment

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gpu-grid/matchmaker/pricing"
	"github.com/gpu-grid/matchmaker/store"
)

type Config struct {
	KeyID         string
	KeySecret     string
	WebhookSecret string
}

type BillingHandler struct {
	client *http.Client
	st     store.Store
	cfg    Config
}

func NewBillingHandler(st store.Store) *BillingHandler {
	keyID := os.Getenv("RAZORPAY_KEY_ID")
	keySecret := os.Getenv("RAZORPAY_KEY_SECRET")
	whSecret := os.Getenv("RAZORPAY_WEBHOOK_SECRET")
	if keyID == "" || keySecret == "" {
		log.Println("payment: RAZORPAY_KEY_ID/SECRET not set — billing disabled")
		return &BillingHandler{st: st}
	}
	return &BillingHandler{
		client: &http.Client{Timeout: 30 * time.Second},
		st:     st,
		cfg:    Config{KeyID: keyID, KeySecret: keySecret, WebhookSecret: whSecret},
	}
}

func (h *BillingHandler) Enabled() bool {
	return h.cfg.KeyID != "" && h.cfg.KeySecret != ""
}

// ─── Razorpay HTTP Client ─────────────────────────────────────────────────

const razorpayBase = "https://api.razorpay.com/v1"

func (h *BillingHandler) rzpPost(path string, body map[string]interface{}) (map[string]interface{}, error) {
	return h.rzpCall(http.MethodPost, path, body)
}

func (h *BillingHandler) rzpGet(path string) (map[string]interface{}, error) {
	return h.rzpCall(http.MethodGet, path, nil)
}

func (h *BillingHandler) rzpCall(method, path string, body map[string]interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, razorpayBase+path, reqBody)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(h.cfg.KeyID, h.cfg.KeySecret)
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		var errResp map[string]interface{}
		json.Unmarshal(respBody, &errResp)
		return nil, fmt.Errorf("razorpay %d: %v", resp.StatusCode, errResp)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// ─── Signature Verification ───────────────────────────────────────────────

func verifyPaymentSignature(orderID, paymentID, signature, secret string) bool {
	data := orderID + "|" + paymentID
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(data))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

func verifyWebhookSignature(body []byte, signature, secret string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

// ─── Redis Keys ───────────────────────────────────────────────────────────

const custPrefix = "rzp_customer:"
const tokenPrefix = "rzp_token:"

func (h *BillingHandler) getCustomerID(ctx context.Context, userID string) string {
	id, err := h.st.BillingGetCustomer(ctx, userID)
	if err != nil {
		return ""
	}
	return id
}

func (h *BillingHandler) getTokenID(ctx context.Context, userID string) string {
	tok, err := h.st.BillingGetToken(ctx, userID)
	if err != nil {
		return ""
	}
	return tok
}

func (h *BillingHandler) getOrCreateCustomer(ctx context.Context, userID, email string) string {
	if c := h.getCustomerID(ctx, userID); c != "" {
		return c
	}
	resp, err := h.rzpPost("/customers", map[string]interface{}{
		"name":          userID,
		"email":         email,
		"fail_existing": "1",
	})
	if err != nil {
		log.Printf("payment: create customer error: %v", err)
		return ""
	}
	cid, _ := resp["id"].(string)
	if cid != "" {
		h.st.BillingSetCustomer(ctx, userID, cid)
	}
	return cid
}

func (h *BillingHandler) getTotalPaid(ctx context.Context, userID string) int64 {
	_, paid, _, err := h.st.BillingGetTotal(ctx, userID)
	if err != nil {
		return 0
	}
	return paid
}

func (h *BillingHandler) notifyUser(ctx context.Context, userID string, data map[string]string) {
	msg, _ := json.Marshal(data)
	log.Printf("payment: notify %s: %s", userID, string(msg))
}

func (h *BillingHandler) getUserIDbyCustomer(ctx context.Context, custID string) string {
	userID, err := h.st.BillingFindUserByCustomer(ctx, custID)
	if err != nil {
		return ""
	}
	return userID
}

// ─── POST /billing/customer ───────────────────────────────────────────────

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
	ctx := context.Background()
	custID := h.getOrCreateCustomer(ctx, req.UserID, req.Email)
	if custID == "" {
		http.Error(w, "failed to create customer", http.StatusInternalServerError)
		return
	}
	hasPM := h.getTokenID(ctx, req.UserID) != ""
	json.NewEncoder(w).Encode(map[string]interface{}{
		"razorpay_customer_id": custID,
		"has_payment_method":   hasPM,
	})
}

// ─── POST /billing/setup-intent ───────────────────────────────────────────

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
	ctx := context.Background()
	custID := h.getOrCreateCustomer(ctx, req.UserID, "")
	if custID == "" {
		http.Error(w, "failed to create customer", http.StatusInternalServerError)
		return
	}

	order, err := h.rzpPost("/orders", map[string]interface{}{
		"amount":          100,
		"currency":        "INR",
		"customer_id":     custID,
		"payment_capture": 1,
		"notes":           map[string]interface{}{"user_id": req.UserID, "purpose": "payment_method_verification"},
	})
	if err != nil {
		log.Printf("payment: setup intent error: %v", err)
		http.Error(w, "razorpay error", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"order_id":             order["id"],
		"amount":               100,
		"key_id":               h.cfg.KeyID,
		"razorpay_customer_id": custID,
	})
}

// ─── POST /billing/verify-payment ─────────────────────────────────────────

func (h *BillingHandler) HandleVerifyPayment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !h.Enabled() {
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	var req struct {
		UserID            string `json:"user_id"`
		RazorpayOrderID   string `json:"razorpay_order_id"`
		RazorpayPaymentID string `json:"razorpay_payment_id"`
		RazorpaySignature string `json:"razorpay_signature"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if !verifyPaymentSignature(req.RazorpayOrderID, req.RazorpayPaymentID, req.RazorpaySignature, h.cfg.KeySecret) {
		log.Printf("payment: sig verify failed for user %s", req.UserID)
		http.Error(w, "invalid payment signature", http.StatusUnauthorized)
		return
	}

	payment, err := h.rzpGet("/payments/" + req.RazorpayPaymentID)
	if err != nil {
		log.Printf("payment: fetch error: %v", err)
		http.Error(w, "verify failed", http.StatusInternalServerError)
		return
	}

	tokenID, _ := payment["token_id"].(string)
	if tokenID == "" {
		log.Printf("payment: no token in payment %s", req.RazorpayPaymentID)
		http.Error(w, "no saved payment method", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	h.st.BillingSetToken(ctx, req.UserID, tokenID)
	log.Printf("payment: user %s saved token %s", req.UserID, tokenID)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"verified": true,
		"token_id": tokenID,
	})
}

// ─── GET /billing/payment-methods ─────────────────────────────────────────

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
	ctx := context.Background()
	custID := h.getCustomerID(ctx, userID)
	if custID == "" {
		json.NewEncoder(w).Encode(map[string]interface{}{"payment_methods": []interface{}{}})
		return
	}

	tokens, err := h.rzpGet(fmt.Sprintf("/customers/%s/tokens", custID))
	if err != nil {
		log.Printf("payment: list tokens error: %v", err)
		json.NewEncoder(w).Encode(map[string]interface{}{"payment_methods": []interface{}{}})
		return
	}

	defaultToken := h.getTokenID(ctx, userID)
	items, _ := tokens["items"].([]interface{})
	var methods []map[string]interface{}
	for _, item := range items {
		tok, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		tokID, _ := tok["id"].(string)
		method, _ := tok["method"].(string)
		last4, _ := tok["last4"].(string)
		if card, _ := tok["card"].(map[string]interface{}); card != nil {
			if b, _ := card["type"].(string); b != "" {
				method = "card - " + b
			}
		}
		if vpa, _ := tok["vpa"].(string); vpa != "" {
			last4 = vpa
		}
		methods = append(methods, map[string]interface{}{
			"id":         tokID,
			"type":       method,
			"last4":      last4,
			"is_default": tokID == defaultToken,
		})
	}
	if methods == nil {
		methods = []map[string]interface{}{}
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"payment_methods": methods})
}

// ─── POST /billing/track-usage ────────────────────────────────────────────

func (h *BillingHandler) HandleTrackUsage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !h.Enabled() {
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	var req struct {
		UserID string `json:"user_id"`
		JobID  string `json:"job_id"`
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" || req.JobID == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	ctx := context.Background()

	switch req.Action {
	case "start":
		_, err := StartJobBilling(ctx, h.st, req.UserID, req.JobID, "", "")
		if err != nil {
			http.Error(w, "failed to start tracking", http.StatusInternalServerError)
			return
		}
		w.Write([]byte(`{"tracked": "start"}`))
	case "stop":
		result, err := StopJobBilling(ctx, h.st, h, req.UserID, req.JobID)
		if err != nil {
			http.Error(w, "failed to stop tracking", http.StatusInternalServerError)
			return
		}
		if result.Skipped {
			http.Error(w, "job not found", http.StatusNotFound)
			return
		}
		w.Write([]byte(`{"tracked": "stop"}`))
	default:
		http.Error(w, "invalid action", http.StatusBadRequest)
	}
}

// ─── GET /billing/usage ───────────────────────────────────────────────────

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
	secs, _, unpaid, err := h.st.BillingGetTotal(ctx, userID)
	if err != nil {
		secs, unpaid = 0, 0
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"gpu_seconds":       secs,
		"gpu_hours":         fmt.Sprintf("%.2f", float64(secs)/3600),
		"unpaid_cents":      unpaid,
		"hourly_rate_cents": pricing.DefaultHourlyRateCents,
		"skus":              pricing.PublicCatalog(),
	})
}

// ─── POST /billing/charge ─────────────────────────────────────────────────

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

// ─── POST /billing/webhook ────────────────────────────────────────────────

func (h *BillingHandler) HandleWebhook(w http.ResponseWriter, r *http.Request) {
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
	sig := r.Header.Get("X-Razorpay-Signature")
	if !verifyWebhookSignature(payload, sig, h.cfg.WebhookSecret) {
		log.Printf("payment: webhook sig invalid")
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	var event map[string]interface{}
	json.Unmarshal(payload, &event)
	ctx := context.Background()

	switch event["event"] {
	case "payment.captured":
		pay, _ := event["payload"].(map[string]interface{})
		paymentEnt, _ := pay["payment"].(map[string]interface{})
		ent, _ := paymentEnt["entity"].(map[string]interface{})
		if ent == nil {
			break
		}
		notes, _ := ent["notes"].(map[string]interface{})
		userID, _ := notes["user_id"].(string)
		if userID == "" {
			if cid, _ := ent["customer_id"].(string); cid != "" {
				userID = h.getUserIDbyCustomer(ctx, cid)
			}
		}
		if userID == "" {
			break
		}
		amount, _ := ent["amount"].(float64)
		amountCents := int64(amount) / 100
		if amountCents > 0 {
			h.st.BillingIncrPaid(ctx, userID, amountCents)
			h.st.BillingSetLastCharge(ctx, userID)
		}
		log.Printf("payment: captured %d for user %s", amountCents, userID)

	case "payment.failed":
		pay, _ := event["payload"].(map[string]interface{})
		paymentEnt, _ := pay["payment"].(map[string]interface{})
		ent, _ := paymentEnt["entity"].(map[string]interface{})
		if ent == nil {
			break
		}
		notes, _ := ent["notes"].(map[string]interface{})
		userID, _ := notes["user_id"].(string)
		if userID != "" {
			errDesc, _ := ent["error_description"].(string)
			log.Printf("payment: failed for %s: %s", userID, errDesc)
			h.notifyUser(ctx, userID, map[string]string{
				"type":    "payment_failed",
				"message": errDesc,
			})
		}
	}
	w.Write([]byte(`{"received": true}`))
}

// ─── Internal ─────────────────────────────────────────────────────────────

func (h *BillingHandler) autoChargeIfNeeded(ctx context.Context, userID string) {
	_, _, unpaid, err := h.st.BillingGetTotal(ctx, userID)
	if err != nil {
		return
	}

	if unpaid >= 100 {
		result, err := h.chargeUser(ctx, userID)
		if err != nil {
			log.Printf("payment: auto-charge failed for %s: %v", userID, err)
			h.notifyUser(ctx, userID, map[string]string{
				"type": "auto_charge_failed", "message": "Auto-charge failed.",
			})
		} else {
			log.Printf("payment: auto-charged user %s %v", userID, result["amount_cents"])
		}
	}
}

func (h *BillingHandler) chargeUser(ctx context.Context, userID string) (map[string]interface{}, error) {
	custID := h.getCustomerID(ctx, userID)
	if custID == "" {
		return nil, fmt.Errorf("no razorpay customer for user %s", userID)
	}
	tokenID := h.getTokenID(ctx, userID)
	if tokenID == "" {
		return nil, fmt.Errorf("no saved payment method for user %s", userID)
	}

	_, _, unpaid, _ := h.st.BillingGetTotal(ctx, userID)
	amountCents := unpaid
	if amountCents < 50 {
		amountCents = 50
	}
	amountPaise := amountCents * 100

	order, err := h.rzpPost("/orders", map[string]interface{}{
		"amount":          amountPaise,
		"currency":        "INR",
		"customer_id":     custID,
		"payment_capture": 1,
		"notes":           map[string]interface{}{"user_id": userID, "purpose": "gpu_usage_charge"},
	})
	if err != nil {
		return nil, fmt.Errorf("order failed: %w", err)
	}
	orderID, _ := order["id"].(string)

	// Create recurring payment with saved token
	recurResp, err := h.rzpPost("/payments/create/recurring", map[string]interface{}{
		"email":       "",
		"contact":     "",
		"amount":      amountPaise,
		"currency":    "INR",
		"order_id":    orderID,
		"customer_id": custID,
		"token":       tokenID,
		"recurring":   "1",
		"description": "Tenxo GPU compute usage",
		"notes":       map[string]interface{}{"user_id": userID},
	})
	if err != nil {
		return nil, fmt.Errorf("recurring payment failed: %w", err)
	}

	paymentID, _ := recurResp["razorpay_payment_id"].(string)
	label := "token_" + tokenID
	if len(tokenID) > 8 {
		label = "... " + tokenID[len(tokenID)-8:]
	}

	return map[string]interface{}{
		"charged":        true,
		"amount_cents":   amountCents,
		"payment_method": label,
		"payment_id":     paymentID,
		"order_id":       orderID,
	}, nil
}
