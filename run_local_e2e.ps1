# Run full local E2E for GPU_grid (non-interactive)
# Usage: Open PowerShell as Administrator and run: .\run_local_e2e.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $root

Write-Host "Starting docker-compose services..."
docker-compose up -d

# Ensure uploads dir
$uploads = Join-Path $root 'uploads'
if (-not (Test-Path $uploads)) { New-Item -ItemType Directory -Path $uploads | Out-Null }

# Env defaults
$env:PUBLIC_API_URL = 'http://localhost:8080'
$env:NATS_URL = 'nats://localhost:4222'
$env:REDIS_ADDR = 'localhost:6379'
$env:API_ADDR = ':8080'

# Build and run backend
Write-Host "Building backend..."
Push-Location (Join-Path $root 'backend')
if (Test-Path .\mygrid-api.exe) { Remove-Item .\mygrid-api.exe -ErrorAction SilentlyContinue }
Write-Host "tidying go modules..."
go mod tidy
go build -o mygrid-api .
Write-Host "Starting backend (logs -> backend.log)..."
Start-Process -FilePath (Join-Path (Get-Location) 'mygrid-api.exe') -ArgumentList @() -WindowStyle Hidden
Pop-Location

# Register a test API key in Redis for local-dev-user
Write-Host "Registering test API key in Redis..."
$apiKey = 'dev-local-abc123'
$sha = ([System.BitConverter]::ToString((New-Object Security.Cryptography.SHA256Managed).ComputeHash([System.Text.Encoding]::UTF8.GetBytes($apiKey)))).Replace('-','').ToLower()
docker-compose exec -T redis redis-cli SET api_key:$sha local-dev-user | Out-Null
Write-Host "Test API key is: $apiKey"

# Build edge agent
Write-Host "Building edge agent..."
Push-Location (Join-Path $root 'edge_agent')
cargo build --release
$agentBin = Join-Path (Join-Path $root 'edge_agent') 'target\release\edge_agent.exe'
if (-not (Test-Path $agentBin)) { Write-Host "Warning: edge agent binary not found" } else {
    Write-Host "Starting edge agent (logs -> edge_agent.log)..."
    # Set example owner and node id for local dev
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $agentBin
    $startInfo.EnvironmentVariables['NATS_URL'] = 'nats://localhost:4222'
    $startInfo.EnvironmentVariables['OWNER'] = 'local-dev-user'
    $startInfo.EnvironmentVariables['NODE_ID'] = 'local-node-1'
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $proc = [System.Diagnostics.Process]::Start($startInfo)
}
Pop-Location

# Start frontend
Write-Host "Installing frontend dependencies and starting Next.js..."
Push-Location (Join-Path $root 'frontend')
if (-not (Test-Path node_modules)) { npm install }
Start-Process -FilePath 'npm' -ArgumentList 'run','dev' -WindowStyle Hidden
Pop-Location

Write-Host "E2E services started. Backend: http://localhost:8080, Frontend: http://localhost:3000"
Write-Host "Example: POST /presign with your API key to get upload/result URLs, then PUT the encrypted blob to the upload_url and POST /jobs with {job_id, encrypted_job_link:<upload_url>}"

Write-Host "Done."
