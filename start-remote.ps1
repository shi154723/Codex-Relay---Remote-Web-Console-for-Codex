$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:CODEX_REMOTE_TOKEN = [Environment]::GetEnvironmentVariable('CODEX_REMOTE_TOKEN', 'User')
$env:PORT = '4317'
$node = (Get-Command node.exe).Source
$existing = Get-NetTCPConnection -State Listen -LocalPort 4317 -ErrorAction SilentlyContinue
if (-not $existing) {
  Start-Process -FilePath $node -ArgumentList 'server.mjs' -WorkingDirectory $workspace -WindowStyle Hidden
}
