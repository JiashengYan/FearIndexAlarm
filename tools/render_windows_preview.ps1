param([ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]*$')][string]$OutputDirectory='windows-gui-preview')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolRoot = Join-Path $projectRoot '.tools'
$env:DOTNET_CLI_HOME = Join-Path $toolRoot 'dotnet-home'
$env:NUGET_PACKAGES = Join-Path $toolRoot 'nuget'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = '1'
& (Join-Path $toolRoot 'dotnet/dotnet.exe') run --project (Join-Path $PSScriptRoot 'windows-preview/WindowsPreview.csproj') -c Release -- (Join-Path (Join-Path $projectRoot 'artifacts') $OutputDirectory)
if ($LASTEXITCODE -ne 0) { throw 'Offscreen Windows UI render failed.' }
