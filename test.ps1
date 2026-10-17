param([switch]$SkipAndroid, [switch]$LiveProbe, [switch]$CleanAndroid)
$ErrorActionPreference = 'Stop'
$toolRoot = Join-Path $PSScriptRoot '.tools'
$env:JAVA_HOME = Join-Path $toolRoot 'jdk'
$env:ANDROID_HOME = Join-Path $toolRoot 'android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = Join-Path $toolRoot 'gradle-cache'
$env:DOTNET_CLI_HOME = Join-Path $toolRoot 'dotnet-home'
$env:NUGET_PACKAGES = Join-Path $toolRoot 'nuget'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = '1'
& (Join-Path $toolRoot 'dotnet/dotnet.exe') run --project (Join-Path $PSScriptRoot 'windows/FearIndexAlarm.Tests/FearIndexAlarm.Tests.csproj') -c Release
if ($LASTEXITCODE -ne 0) { throw 'Windows/core tests failed.' }
if ($LiveProbe) {
    & (Join-Path $toolRoot 'dotnet/dotnet.exe') run --project (Join-Path $PSScriptRoot 'windows/FearIndexAlarm.Tests/FearIndexAlarm.Tests.csproj') -c Release -- --live
    if ($LASTEXITCODE -ne 0) { throw 'Windows live CNN probe failed.' }
    $env:FEARINDEXALARM_LIVE_TEST = '1'
} else { $env:FEARINDEXALARM_LIVE_TEST = '0' }
if (!$SkipAndroid) {
    if ($CleanAndroid) {
        & (Join-Path $toolRoot 'gradle-8.11.1/bin/gradle.bat') -p (Join-Path $PSScriptRoot 'android') --no-daemon :app:clean
        if ($LASTEXITCODE -ne 0) { throw 'Android clean failed.' }
    }
    & (Join-Path $toolRoot 'gradle-8.11.1/bin/gradle.bat') -p (Join-Path $PSScriptRoot 'android') --no-daemon :app:testDebugUnitTest :app:lintDebug
    if ($LASTEXITCODE -ne 0) { throw 'Android tests/lint failed.' }
}
