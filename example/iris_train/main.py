import os
import sys
import json
import subprocess
from pathlib import Path

dataset_url = os.environ.get(
    "DATASET_URL",
    "https://archive.ics.uci.edu/ml/machine-learning-databases/iris/iris.data",
)

output_dir = Path("/workspace/output")
output_dir.mkdir(parents=True, exist_ok=True)

# ── Step 1: Download dataset ──────────────────────────────────────────
print(f"Downloading dataset from {dataset_url} ...")
if dataset_url.startswith("gs://"):
    subprocess.run(
        ["gsutil", "cp", dataset_url, "iris.data"],
        check=True, capture_output=True, text=True,
    )
elif dataset_url.startswith("s3://"):
    subprocess.run(
        ["aws", "s3", "cp", dataset_url, "iris.data"],
        check=True, capture_output=True, text=True,
    )
else:
    subprocess.run(
        ["curl", "-sS", "-o", "iris.data", dataset_url],
        check=True, capture_output=True, text=True,
    )
print("Dataset downloaded.")

# ── Step 2: Load and prepare data ────────────────────────────────────
import pandas as pd
import numpy as np

col_names = ["sepal_length", "sepal_width", "petal_length", "petal_width", "class"]
df = pd.read_csv("iris.data", names=col_names)
print(f"Loaded {len(df)} samples")

label_map = {name: i for i, name in enumerate(df["class"].unique())}
df["label"] = df["class"].map(label_map)

X = df[col_names[:4]].values.astype(np.float32)
y = df["label"].values

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y,
)

scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)

print(f"Train: {X_train.shape[0]} samples, Test: {X_test.shape[0]} samples")

# ── Step 3: Build and train model ────────────────────────────────────
import torch
import torch.nn as nn
import torch.optim as optim

class IrisNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc = nn.Sequential(
            nn.Linear(4, 16),
            nn.ReLU(),
            nn.Linear(16, 8),
            nn.ReLU(),
            nn.Linear(8, 3),
        )

    def forward(self, x):
        return self.fc(x)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

model = IrisNet().to(device)
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.01)

X_train_t = torch.from_numpy(X_train)
y_train_t = torch.from_numpy(y_train).long()
X_test_t = torch.from_numpy(X_test)
y_test_t = torch.from_numpy(y_test).long()

batch_size = 16
epochs = 50

for epoch in range(epochs):
    perm = torch.randperm(len(X_train_t))
    total_loss = 0.0
    for i in range(0, len(X_train_t), batch_size):
        idx = perm[i : i + batch_size]
        inputs, labels = X_train_t[idx].to(device), y_train_t[idx].to(device)

        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()

    if (epoch + 1) % 10 == 0:
        with torch.no_grad():
            preds = model(X_test_t.to(device)).argmax(dim=1)
            acc = (preds == y_test_t.to(device)).float().mean().item()
        print(f"Epoch {epoch+1}/{epochs}  Loss: {total_loss:.4f}  Test Acc: {acc:.4f}")

# ── Step 4: Evaluate ─────────────────────────────────────────────────
model.eval()
with torch.no_grad():
    preds = model(X_test_t.to(device)).argmax(dim=1)
    accuracy = (preds == y_test_t.to(device)).float().mean().item()
print(f"\nFinal test accuracy: {accuracy:.4f}")

# ── Step 5: Save outputs ─────────────────────────────────────────────
torch.save(model.state_dict(), output_dir / "iris_model.pt")

with open(output_dir / "metrics.json", "w") as f:
    json.dump({
        "accuracy": round(accuracy, 4),
        "model": "IrisNet",
        "framework": "pytorch",
        "dataset": "iris",
        "device": str(device),
        "num_params": sum(p.numel() for p in model.parameters()),
    }, f, indent=2)

with open(output_dir / "label_map.json", "w") as f:
    json.dump({v: k for k, v in label_map.items()}, f, indent=2)

print("\nOutputs saved to /workspace/output/:")
for f in output_dir.iterdir():
    print(f"  {f.name} ({f.stat().st_size} bytes)")
