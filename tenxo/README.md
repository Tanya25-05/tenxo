# Tenxo

Zero-knowledge decentralized GPU grid — package and train AI models on remote GPUs.

## Install

```bash
pip install tenxo
```

## Quickstart

```bash
# Package your workspace
tenxo pack

# Full workflow: package → encrypt → upload → submit → poll → decrypt
tenxo run /path/to/workspace
```

## `.tenxoignore`

Create a `.tenxoignore` in your workspace root to exclude files (syntax like `.gitignore`):

```
.venv/
__pycache__/
*.pyc
.DS_Store
.git/
output/
*.zip
```

Running `tenxo pack` automatically reads `.tenxoignore` (falls back to `.gitignore`) and warns if `requirements.txt` is missing.
