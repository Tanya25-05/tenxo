# Minimal GPU workload: check NVIDIA availability and do a tiny CUDA op (PyTorch)
import sys
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
b = (a * 2.0).sum()
print("GPU test OK, sum:", float(b))