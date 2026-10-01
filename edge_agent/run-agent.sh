#!/usr/bin/env bash
set -euo pipefail

# Simple runner for the Edge Agent inside a Linux host (RunPod/WSL)
cd "$(dirname "$0")"
python3 agent.py
