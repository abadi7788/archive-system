[CmdletBinding()]
param(
    [string]$DeploymentPath = 'D:\archive-system',
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-f]{40}$')]
    [string]$ExpectedRevision,
    [string]$PublicUrl = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Windows PowerShell does not throw on a native program's nonzero exit code.
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Program failed with exit code $LASTEXITCODE. Deployment stopped."
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $DeploymentPath '.git'))) {
    throw "Deployment repository not found: $DeploymentPath"
}
if (-not $env:GH_TOKEN) {
    throw 'GH_TOKEN is required for the repository fetch.'
}

Push-Location -LiteralPath $DeploymentPath
try {
    # This checkout contains the server's .env and persistent Compose volumes.
    # Never reset/clean it, switch branches, or delete volumes to force a deploy.
    $safePath = (Get-Location).Path.Replace('\', '/')
    Invoke-Checked 'git' @('config', '--global', '--add', 'safe.directory', $safePath)
    $branch = Invoke-Checked 'git' @('branch', '--show-current')
    if ($branch -ne 'main') { throw "Server checkout is on '$branch', expected 'main'. No branch was changed." }
    $dirty = Invoke-Checked 'git' @('status', '--porcelain', '--untracked-files=no')
    if ($dirty) { throw 'The server has tracked local changes. Preserve/reconcile them before deploying; nothing was overwritten.' }

    # Authentication exists only in the child process environment, never in a
    # remote URL, command output, FETCH_HEAD, or repository config.
    $auth = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("x-access-token:$env:GH_TOKEN"))
    $env:GIT_CONFIG_COUNT = '1'
    $env:GIT_CONFIG_KEY_0 = 'http.https://github.com/.extraheader'
    $env:GIT_CONFIG_VALUE_0 = "AUTHORIZATION: basic $auth"
    try {
        Invoke-Checked 'git' @('-c', 'credential.helper=', 'fetch', '--no-tags', '--no-recurse-submodules', 'https://github.com/abadi7788/archive-system.git', $ExpectedRevision)
    } finally {
        Remove-Item -Path @('Env:GIT_CONFIG_COUNT', 'Env:GIT_CONFIG_KEY_0', 'Env:GIT_CONFIG_VALUE_0') -ErrorAction SilentlyContinue
        $auth = $null
    }
    Invoke-Checked 'git' @('merge', '--ff-only', $ExpectedRevision)
    $actual = Invoke-Checked 'git' @('rev-parse', 'HEAD')
    if ($actual -ne $ExpectedRevision) { throw "Checkout revision mismatch: expected $ExpectedRevision, got $actual. No containers were changed." }
    Write-Host "Building release $actual in $DeploymentPath"

    # Stamp both images with the source revision. Build must complete before any
    # running services are replaced. Preserve the existing Compose project name.
    $env:SOURCE_REVISION = $ExpectedRevision
    Invoke-Checked 'docker' @('compose', 'config', '--quiet')
    Invoke-Checked 'docker' @('compose', 'build', '--pull', 'backend', 'frontend')
    Invoke-Checked 'docker' @('compose', 'up', '-d', '--no-build', '--wait', '--wait-timeout', '180')

    # Verify HTTP responses from the running containers, not just image metadata.
    $frontendProbe = "fetch('http://127.0.0.1:3000/build-info',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);const b=await r.json();if(b.revision!==process.argv[1])throw Error('Frontend revision mismatch: '+b.revision);console.log('Frontend revision verified: '+b.revision)}).catch(e=>{console.error(e.message);process.exit(1)})"
    $backendProbe = "import json,sys,urllib.request; b=json.load(urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=15)); assert b.get('revision')==sys.argv[1], 'Backend revision mismatch: '+str(b.get('revision')); print('Backend revision verified: '+b['revision'])"
    Invoke-Checked 'docker' @('compose', 'exec', '-T', 'frontend', 'node', '-e', $frontendProbe, $ExpectedRevision)
    Invoke-Checked 'docker' @('compose', 'exec', '-T', 'backend', 'python', '-c', $backendProbe, $ExpectedRevision)

    if ($PublicUrl) {
        # Optional trusted public/LAN URL checks routing to the same release.
        # Do not bypass TLS verification: install Caddy's local CA on the runner.
        $info = Invoke-RestMethod -Uri ($PublicUrl.TrimEnd('/') + '/build-info') -Headers @{ 'Cache-Control' = 'no-cache' } -TimeoutSec 30
        if ($info.revision -ne $ExpectedRevision) { throw 'Public URL serves a different frontend release.' }
        $health = Invoke-RestMethod -Uri ($PublicUrl.TrimEnd('/') + '/api/v1/health') -Headers @{ 'Cache-Control' = 'no-cache' } -TimeoutSec 30
        if ($health.revision -ne $ExpectedRevision) { throw 'Public URL serves a different backend release.' }
        Write-Host 'Public URL release verified.'
    } else {
        Write-Warning 'ARCHIVE_PUBLIC_URL is not configured: container revisions verified, but the browser-facing URL was not checked.'
    }
    Invoke-Checked 'docker' @('compose', 'ps')
    if ($env:GITHUB_STEP_SUMMARY) {
        "Deployed and verified container release: ``$ExpectedRevision``" | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Encoding utf8 -Append
    }
} finally {
    Remove-Item Env:SOURCE_REVISION -ErrorAction SilentlyContinue
    Pop-Location
}
