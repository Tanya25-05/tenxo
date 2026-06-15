# Minimal GPU workload: check NVIDIA availability and do a tiny CUDA op (PyTorch)
import json
import sys
from pathlib import Path

output_dir = Path("/workspace/output")
output_dir.mkdir(parents=True, exist_ok=True)

try:
    import torch
except Exception as e:
    print("PyTorch not installed in container:", e)
    sys.exit(2)

if not torch.cuda.is_available():
    print("No CUDA device available")
    sys.exit(1)

dev = torch.device("cuda")
a = torch.randn(1024, 1024, device=dev)
result = float((a * 2.0).sum())
print("GPU test OK, sum:", result)

with open(output_dir / "gpu_test.json", "w") as f:
    json.dump({
        "status": "ok",
        "device": torch.cuda.get_device_name(0),
        "sum": result,
    }, f, indent=2)

print("Result saved to /workspace/output/gpu_test.json")