using System.Globalization;
using System.Text.Json;

namespace FearIndexAlarm.Core;

public sealed class CnnClient : IDisposable
{
    private readonly HttpClient client;
    public CnnClient(HttpMessageHandler? handler = null)
    {
        client = handler is null ? new HttpClient(new SocketsHttpHandler
        {
            PooledConnectionLifetime = TimeSpan.FromMinutes(10), AllowAutoRedirect = false,
            AutomaticDecompression = System.Net.DecompressionMethods.All
        }) : new HttpClient(handler);
        client.Timeout = TimeSpan.FromSeconds(20);
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36");
        client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
        client.DefaultRequestHeaders.Referrer = new Uri("https://edition.cnn.com/markets/fear-and-greed");
        client.DefaultRequestHeaders.Add("Origin", "https://edition.cnn.com");
        client.MaxResponseContentBufferSize = 2_000_000;
    }
    public async Task<Sample> FetchAsync(TaskDefinition task, CancellationToken cancellationToken)
    {
        if (task.Id != "cnn-fear-greed") throw new InvalidOperationException("尚未实现该任务的数据源");
        using var response = await client.GetAsync(task.Url, cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            var status = (int)response.StatusCode;
            throw new HttpRequestException(status is 403 or 418 ? $"CNN 拒绝程序访问（HTTP {status}），没有取得实时数据" : $"CNN HTTP {status}");
        }
        return Parse(await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
    }
    public static Sample Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement.GetProperty("fear_and_greed");
        var raw = root.GetProperty("timestamp");
        long timestamp;
        if (raw.ValueKind == JsonValueKind.Number) timestamp = ParseNumericTimestamp(raw.GetInt64());
        else if (long.TryParse(raw.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var number)) timestamp = ParseNumericTimestamp(number);
        else timestamp = DateTimeOffset.Parse(raw.GetString()!, CultureInfo.InvariantCulture).ToUnixTimeMilliseconds();
        return new(root.GetProperty("score").GetDouble(), timestamp);
    }
    private static long ParseNumericTimestamp(long number) => number < 100_000_000_000 ? checked(number * 1000) : number;
    public void Dispose() => client.Dispose();
}
