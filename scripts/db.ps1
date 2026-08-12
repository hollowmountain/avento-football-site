# Local portable PostgreSQL control script (Windows, no Docker required).
# Usage: powershell -File scripts/db.ps1 start|stop|status
param([Parameter(Mandatory = $true)][ValidateSet('start', 'stop', 'status')][string]$Action)

$root = Split-Path -Parent $PSScriptRoot
$pgBin = Join-Path $root '.tools\pgsql\bin'
$pgData = Join-Path $root '.local\pgdata'
$pgLog = Join-Path $root '.local\pg.log'
$port = 5433

if (-not (Test-Path (Join-Path $pgBin 'pg_ctl.exe'))) {
    Write-Error "Portable PostgreSQL not found at $pgBin. See README (local setup without Docker)."
    exit 1
}

switch ($Action) {
    'start' { & (Join-Path $pgBin 'pg_ctl.exe') -D $pgData -l $pgLog -o "-p $port" -w start }
    'stop' { & (Join-Path $pgBin 'pg_ctl.exe') -D $pgData -w stop }
    'status' { & (Join-Path $pgBin 'pg_ctl.exe') -D $pgData status }
}
exit $LASTEXITCODE
