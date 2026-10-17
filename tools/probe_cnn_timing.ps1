param([string]$OutputPath)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$observations = @()
foreach ($mode in @('default', 'revalidate')) {
    $headers = @{ Referer='https://edition.cnn.com/markets/fear-and-greed'; Origin='https://edition.cnn.com'; Accept='application/json' }
    if ($mode -eq 'revalidate') { $headers['Cache-Control'] = 'no-cache'; $headers['Pragma'] = 'no-cache' }
    $started = [DateTimeOffset]::UtcNow
    $response = Invoke-WebRequest -Uri 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata' -UseBasicParsing -TimeoutSec 25 -UserAgent 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' -Headers $headers
    $received = [DateTimeOffset]::UtcNow
    $data = $response.Content | ConvertFrom-Json
    $source = [DateTimeOffset]::Parse($data.fear_and_greed.timestamp)
    $componentTimes = [ordered]@{}
    foreach ($property in $data.PSObject.Properties) {
        if ($null -ne $property.Value.timestamp) { $componentTimes[$property.Name] = $property.Value.timestamp }
    }
    $observations += [ordered]@{
        mode=$mode
        received_utc=$received.ToString('o')
        request_ms=[Math]::Round(($received-$started).TotalMilliseconds)
        status=[int]$response.StatusCode
        score=$data.fear_and_greed.score
        raw_source_timestamp=$data.fear_and_greed.timestamp
        source_utc=$source.ToUniversalTime().ToString('o')
        source_age_seconds=[Math]::Round(($received-$source).TotalSeconds, 1)
        server_date=$response.Headers['Date']
        cache_age=$response.Headers['Age']
        cache_control=$response.Headers['Cache-Control']
        x_cache=$response.Headers['X-Cache']
        component_timestamps=$componentTimes
    }
}
$json = $observations | ConvertTo-Json -Depth 5
if ($OutputPath) {
    if (Test-Path -LiteralPath $OutputPath) { throw 'Refusing to overwrite existing timing evidence.' }
    $json | Set-Content -LiteralPath $OutputPath -Encoding UTF8
}
$json
