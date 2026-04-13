# Start ngrok Tunnel for Alexa Skill Development
# Usage: .\start_ngrok.ps1 -DevUser "devuser" -DevPassword "StrongPass123" -Port 3000 -SessionMinutes 60
# Or use environment variable: $env:NGROK_AUTHTOKEN="your-token"
param(
    [string]$DevUser = "devuser",
    [string]$DevPassword = "StrongPass123",
    [int]$Port = 3000,
    [int]$SessionMinutes = 60
)

# Validate ngrok is installed
$ngrokPath = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrokPath) {
    Write-Error "ngrok not found. Install from https://ngrok.com/download"
    exit 1
}

# Check for authtoken in environment or ngrok config
$token = $env:NGROK_AUTHTOKEN
if (-not $token) {
    Write-Warning "NGROK_AUTHTOKEN not set. Attempting to use configured token..."
    # ngrok will use ~/.ngrok2/ngrok.yml if authtoken is configured there
}

Write-Host "🚀 Starting secure ngrok tunnel for Alexa..."
Write-Host "  Port: $Port"
Write-Host "  Username: $DevUser"
Write-Host "  Session duration: $SessionMinutes minutes"
Write-Host "  HTTPS: Enabled (bind-tls=true)"
Write-Host "  Inspection: Disabled (secure mode)"
Write-Host ""
Write-Host "📝 After ngrok starts:"
Write-Host "  1. Copy the HTTPS URL (e.g., https://abcd1234.ngrok.io)"
Write-Host "  2. Add it to Alexa Developer Console: Settings > Endpoint > Default Region"
Write-Host "  3. Test skill in console (interactions will be verified)"
Write-Host ""

# Build ngrok command
$ngrokArgs = @(
    'http'
    $Port
    '--bind-tls=true'
    '--auth=' + $DevUser + ':' + $DevPassword
    '--inspect=false'
)

if ($token) {
    $ngrokArgs += '--authtoken=' + $token
}

# Start ngrok in background
$ngrokProcess = Start-Process -FilePath ngrok -ArgumentList $ngrokArgs -PassThru -NoNewWindow

Write-Host "✅ ngrok started (PID: $($ngrokProcess.Id))"
Write-Host "⏱️  Auto-stop in $SessionMinutes minutes..."

# Wait for session duration
Start-Sleep -Seconds ($SessionMinutes * 60)

# Clean shutdown
Write-Host ""
Write-Host "⏹️  Stopping ngrok tunnel..."
$ngrokProcess | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

if (-not $ngrokProcess.HasExited) {
    Write-Error "Failed to stop ngrok gracefully"
    exit 1
}

Write-Host "✅ ngrok tunnel closed. Session ended."
