# Self-contained failure-path tests. No Git repository, Docker, network or real
# credentials are touched. Runs in Windows PowerShell before deployment.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Join-Path ([IO.Path]::GetTempPath()) ('archive-deploy-test-' + [Guid]::NewGuid())
New-Item -ItemType Directory -Path (Join-Path $root '.git') -Force | Out-Null
$revision = 'a' * 40
$savedToken = $env:GH_TOKEN
$savedSummary = $env:GITHUB_STEP_SUMMARY
$env:GITHUB_STEP_SUMMARY = $null
$env:GH_TOKEN = 'deployment-test-placeholder'
$global:ArchiveDeployTestScenario = ''
$global:ArchiveDeployTestCommands = @()

function global:git {
    $arguments = @($args)
    $global:ArchiveDeployTestCommands += 'git ' + ($arguments -join ' ')
    $global:LASTEXITCODE = 0
    if ($arguments -contains 'branch') {
        if ($global:ArchiveDeployTestScenario -eq 'wrong-branch') { return 'feature' }
        return 'main'
    }
    if ($arguments -contains 'status' -and $global:ArchiveDeployTestScenario -eq 'dirty') { return ' M Caddyfile' }
    if ($arguments -contains 'fetch' -and $global:ArchiveDeployTestScenario -eq 'fetch-failed') { $global:LASTEXITCODE = 128 }
    if ($arguments -contains 'merge' -and $global:ArchiveDeployTestScenario -eq 'merge-failed') { $global:LASTEXITCODE = 1 }
    if ($arguments -contains 'rev-parse') {
        if ($global:ArchiveDeployTestScenario -eq 'wrong-revision') { return ('b' * 40) }
        return ('a' * 40)
    }
}
function global:docker {
    $arguments = @($args)
    $global:ArchiveDeployTestCommands += 'docker ' + ($arguments -join ' ')
    $global:LASTEXITCODE = 0
    if ($arguments -contains 'build' -and $global:ArchiveDeployTestScenario -eq 'build-failed') { $global:LASTEXITCODE = 1 }
    if ($arguments -contains 'up' -and $global:ArchiveDeployTestScenario -eq 'up-failed') { $global:LASTEXITCODE = 1 }
    if ($arguments -contains 'exec' -and $global:ArchiveDeployTestScenario -eq 'probe-failed') { $global:LASTEXITCODE = 1 }
}

try {
    foreach ($case in @('wrong-branch', 'dirty', 'fetch-failed', 'merge-failed', 'wrong-revision', 'build-failed', 'up-failed', 'probe-failed', 'success')) {
        $global:ArchiveDeployTestScenario = $case
        $global:ArchiveDeployTestCommands = @()
        $failed = $false
        try {
            & (Join-Path $PSScriptRoot 'Deploy-Archive.ps1') -DeploymentPath $root -ExpectedRevision $revision
        } catch {
            $failed = $true
        }
        if (($case -eq 'success') -eq $failed) { throw "Unexpected result for deployment test: $case" }
        $upCommands = @($global:ArchiveDeployTestCommands | Where-Object { $_ -match '^docker compose up ' })
        if ($case -in @('wrong-branch', 'dirty', 'fetch-failed', 'merge-failed', 'wrong-revision', 'build-failed') -and $upCommands.Count -ne 0) {
            throw "$case incorrectly replaced running containers."
        }
        if ($case -eq 'success') {
            $probes = @($global:ArchiveDeployTestCommands | Where-Object { $_ -match '^docker compose exec ' })
            if ($upCommands.Count -ne 1 -or $probes.Count -ne 2) { throw 'Success did not verify both running services.' }
        }
        if (Test-Path Env:GIT_CONFIG_VALUE_0) { throw 'Fetch authentication was not cleared.' }
        Write-Host "PASS: $case"
    }
} finally {
    Remove-Item -Path @('Function:\git', 'Function:\docker') -ErrorAction SilentlyContinue
    $env:GH_TOKEN = $savedToken
    $env:GITHUB_STEP_SUMMARY = $savedSummary
    Remove-Variable -Name @('ArchiveDeployTestScenario', 'ArchiveDeployTestCommands') -Scope Global -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $root -Recurse -Force
}
