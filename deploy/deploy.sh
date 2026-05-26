#!/usr/bin/env bash
# Tenxo Deployment Script — deploy matchmaker to Render and frontend to Vercel.
# Prerequisites: gh CLI, vercel CLI, render CLI (optional)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo " Tenxo Deployment"
echo "============================================"

# ── Step 1: Build & push Docker image (Render) ─────────────────────────────
echo ""
echo "[1] Building matchmaker Docker image..."
cd "$REPO_ROOT/backend"
docker build -t tenxo-matchmaker:latest .
echo "    OK — image tenxo-matchmaker:latest built"
echo ""
echo "    To deploy to Render:"
echo "      1. Push this repo to GitHub"
echo "      2. Create a new Web Service on Render"
echo "         - Source: your GitHub repo"
echo "         - Root directory: backend/"
echo "         - Build command: docker build -t matchmaker ."
echo "         - Start command: docker run -p 8080:8080 matchmaker"
echo "      3. Add env vars from .env.example"
echo "      4. Create a Redis instance on Render"
echo "      5. Deploy"
echo ""

# ── Step 2: Deploy frontend to Vercel ──────────────────────────────────────
echo "[2] Deploying frontend to Vercel..."
cd "$REPO_ROOT/frontend"
if command -v vercel &>/dev/null; then
  vercel --prod
  echo "    Frontend deployed successfully!"
else
  echo "    vercel CLI not found. Install it:"
  echo "      npm i -g vercel"
  echo "    Then run:"
  echo "      cd frontend && vercel --prod"
  echo ""
  echo "    And set env vars in Vercel dashboard:"
  echo "      NEXT_PUBLIC_API_URL=https://<your-render-app>.onrender.com"
  echo "      NEXT_PUBLIC_WS_URL=wss://<your-render-app>.onrender.com"
  echo "      NEXT_PUBLIC_SUPABASE_URL=..."
  echo "      NEXT_PUBLIC_SUPABASE_ANON_KEY=..."
fi

# ── Step 3: Publish PyPI update ────────────────────────────────────────────
echo ""
echo "[3] Publishing Python SDK to PyPI..."
cd "$REPO_ROOT/tenxo"
if command -v twine &>/dev/null; then
  python -m build && twine upload dist/*
  echo "    Published to PyPI!"
else
  echo "    To publish: cd tenxo && python -m build && twine upload dist/*"
fi

echo ""
echo "============================================"
echo " Deployment commands complete."
echo ""
echo " Post-deploy checklist:"
echo "  □ Set Stripe secret key on Render"
echo "  □ Set Supabase JWKS URL on Render"
echo "  □ Set R2 credentials (if using S3 storage)"
echo "  □ Set Vercel env vars for production"
echo "  □ Update install.sh with production binary URL"
echo "  □ Test with: tenxo run --matchmaker https://<your-app>.onrender.com"
echo "============================================"
