param([switch]$ProbeOnly)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$toolRoot = Join-Path $PSScriptRoot '.tools'
New-Item -ItemType Directory -Force -Path $toolRoot | Out-Null

function Get-Download([string]$Url, [string]$Path) {
    if (!(Test-Path -LiteralPath $Path)) {
        Write-Host "Downloading $Url"
        Invoke-WebRequest -Uri $Url -OutFile "$Path.partial" -UseBasicParsing -TimeoutSec 600
        Move-Item -LiteralPath "$Path.partial" -Destination $Path -Force
    }
}

if (!$ProbeOnly) {
    if (!(Test-Path (Join-Path $toolRoot 'dotnet/dotnet.exe'))) {
        Get-Download 'https://dot.net/v1/dotnet-install.ps1' (Join-Path $toolRoot 'dotnet-install.ps1')
        & (Join-Path $toolRoot 'dotnet-install.ps1') -Channel '10.0' -InstallDir (Join-Path $toolRoot 'dotnet') -NoPath
        if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw 'Installing .NET SDK failed.' }
    }
    if (!(Test-Path (Join-Path $toolRoot 'jdk'))) {
        Get-Download 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse' (Join-Path $toolRoot 'jdk.zip')
        Expand-Archive -LiteralPath (Join-Path $toolRoot 'jdk.zip') -DestinationPath (Join-Path $toolRoot 'jdk-unpack') -Force
        $jdkDirectory = Get-ChildItem (Join-Path $toolRoot 'jdk-unpack') -Directory | Select-Object -First 1
        Move-Item -LiteralPath $jdkDirectory.FullName -Destination (Join-Path $toolRoot 'jdk')
    }
    if (!(Test-Path (Join-Path $toolRoot 'gradle-8.11.1/bin/gradle.bat'))) {
        Get-Download 'https://services.gradle.org/distributions/gradle-8.11.1-bin.zip' (Join-Path $toolRoot 'gradle.zip')
        Expand-Archive -LiteralPath (Join-Path $toolRoot 'gradle.zip') -DestinationPath $toolRoot -Force
    }
    $sdkRoot = Join-Path $toolRoot 'android-sdk'
    $sdkManager = Join-Path $sdkRoot 'cmdline-tools/latest/bin/sdkmanager.bat'
    if (!(Test-Path $sdkManager)) {
        Get-Download 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip' (Join-Path $toolRoot 'android-cli.zip')
        Expand-Archive -LiteralPath (Join-Path $toolRoot 'android-cli.zip') -DestinationPath (Join-Path $toolRoot 'android-cli-unpack') -Force
        New-Item -ItemType Directory -Force -Path (Join-Path $sdkRoot 'cmdline-tools') | Out-Null
        Move-Item -LiteralPath (Join-Path $toolRoot 'android-cli-unpack/cmdline-tools') -Destination (Join-Path $sdkRoot 'cmdline-tools/latest')
    }
    $env:JAVA_HOME = Join-Path $toolRoot 'jdk'
    $env:ANDROID_HOME = $sdkRoot
    $env:ANDROID_SDK_ROOT = $sdkRoot
    if (!(Test-Path (Join-Path $sdkRoot 'platforms/android-35/android.jar'))) {
        Write-Host 'Installing Android SDK 35. This accepts the Android SDK licenses for this project-local SDK.'
        1..100 | ForEach-Object { 'y' } | & $sdkManager "--sdk_root=$sdkRoot" --licenses
        & $sdkManager "--sdk_root=$sdkRoot" 'platform-tools' 'platforms;android-35' 'build-tools;35.0.0'
        if ($LASTEXITCODE -ne 0) { throw 'Installing Android SDK packages failed.' }
    }
    Write-Host 'Project-local toolchain is ready.'
}

Write-Host 'Probing CNN with normal web request headers (no browser automation).'
try {
    $response = Invoke-WebRequest -Uri 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata' -UseBasicParsing -TimeoutSec 25 -UserAgent 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' -Headers @{ Referer='https://edition.cnn.com/markets/fear-and-greed'; Origin='https://edition.cnn.com'; Accept='application/json' }
    $data = $response.Content | ConvertFrom-Json
    if ($null -eq $data.fear_and_greed.score) { throw 'CNN response does not contain fear_and_greed.score' }
    Write-Host "CNN score=$($data.fear_and_greed.score), timestamp=$($data.fear_and_greed.timestamp)"
} catch {
    Write-Warning "CNN live probe failed: $($_.Exception.Message). The app must show a data-source error rather than a fabricated or cached live reading."
}
