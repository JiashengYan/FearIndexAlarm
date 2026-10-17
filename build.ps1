param(
    [ValidateSet('All','Android','Windows')][string]$Target='All',
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]*$')][string]$WindowsOutputDirectory='windows'
)
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
$outputRoot = Join-Path $PSScriptRoot 'artifacts'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
if ($Target -in @('All','Windows')) {
    & (Join-Path $toolRoot 'dotnet/dotnet.exe') publish (Join-Path $PSScriptRoot 'windows/FearIndexAlarm/FearIndexAlarm.csproj') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o (Join-Path $outputRoot $WindowsOutputDirectory)
    if ($LASTEXITCODE -ne 0) { throw 'Windows build failed.' }
    Compress-Archive -Path (Join-Path (Join-Path $outputRoot $WindowsOutputDirectory) '*') -DestinationPath (Join-Path $outputRoot 'FearIndexAlarm-windows-x64.zip') -Force
}
if ($Target -in @('All','Android')) {
    & (Join-Path $toolRoot 'gradle-8.11.1/bin/gradle.bat') -p (Join-Path $PSScriptRoot 'android') --no-daemon :app:assembleDebug
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'android/app/build/outputs/apk/debug/app-debug.apk') -Destination (Join-Path $outputRoot 'FearIndexAlarm-debug.apk') -Force
}
Write-Host "Build output: $outputRoot"
