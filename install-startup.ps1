$startup = [Environment]::GetFolderPath('Startup')
$workspace = $PSScriptRoot
$cmd = Join-Path $startup 'Codex Remote Web.cmd'
$lnk = Join-Path $startup 'Codex Remote Web.lnk'
Remove-Item -LiteralPath $cmd -Force -ErrorAction SilentlyContinue
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnk)
$sc.TargetPath = (Get-Command powershell.exe).Source
$sc.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ' + [char]34 + (Join-Path $workspace 'start-remote.ps1') + [char]34
$sc.WorkingDirectory = $workspace
$sc.Save()
$check = $ws.CreateShortcut($lnk)
Write-Output $check.Arguments
