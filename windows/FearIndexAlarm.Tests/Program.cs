using System.Globalization;
using System.Net;
using FearIndexAlarm.Core;

if (args.Contains("--live"))
{
    using var live = new CnnClient();
    var reading = await live.FetchAsync(TaskCatalog.Tasks[0], CancellationToken.None);
    Console.WriteLine($"LIVE CNN via .NET HttpClient: score={reading.Value.ToString(CultureInfo.InvariantCulture)}, source={DateTimeOffset.FromUnixTimeMilliseconds(reading.SourceTimeMs):O}");
    return;
}

var count = 0;
void Check(bool condition, string name)
{
    if (!condition) throw new Exception($"FAILED: {name}");
    count++;
}
var shared = Path.Combine(AppContext.BaseDirectory, "shared");
foreach (var line in File.ReadLines(Path.Combine(shared, "rule-cases.csv")).Skip(1))
{
    if (string.IsNullOrWhiteSpace(line)) continue;
    var c = line.Split(';');
    var previous = c[1].Length == 0 ? null : new Sample(double.Parse(c[1], CultureInfo.InvariantCulture), long.Parse(c[2]));
    var current = new Sample(double.Parse(c[3], CultureInfo.InvariantCulture), long.Parse(c[4]));
    var decision = MonitorRules.Evaluate(previous, current, long.Parse(c[5]));
    Check(decision.Accept == bool.Parse(c[6]) && decision.Alert == bool.Parse(c[7]), c[0]);
}
Check(!MonitorRules.Evaluate(null, new(double.NaN, 9999000), 10000000).Accept, "NaN is invalid");
Check(!MonitorRules.Evaluate(null, new(double.PositiveInfinity, 9999000), 10000000).Accept, "Infinity is invalid");
var sample = CnnClient.Parse(File.ReadAllText(Path.Combine(shared, "cnn-response.json")));
Check(sample.Value == 17.9954648526077 && sample.SourceTimeMs == DateTimeOffset.Parse("2026-10-16T19:52:21Z").ToUnixTimeMilliseconds(), "live-shaped CNN fixture");
Check(CnnClient.Parse("{\"fear_and_greed\":{\"score\":24,\"timestamp\":1700000000}}").SourceTimeMs == 1700000000000, "seconds timestamp");
Check(CnnClient.Parse("{\"fear_and_greed\":{\"score\":24,\"timestamp\":1700000000000}}").SourceTimeMs == 1700000000000, "milliseconds timestamp");
Check(CnnClient.Parse("{\"fear_and_greed\":{\"score\":24,\"timestamp\":\"1700000000\"}}").SourceTimeMs == 1700000000000, "string timestamp");
try { CnnClient.Parse("{\"error\":\"blocked\"}"); Check(false, "missing data must fail"); }
catch (KeyNotFoundException) { Check(true, "missing data fails"); }
using (var blocked = new CnnClient(new FakeHandler(_ => new HttpResponseMessage((HttpStatusCode)418))))
{
    try { await blocked.FetchAsync(TaskCatalog.Tasks[0], CancellationToken.None); Check(false, "blocked request must fail"); }
    catch (HttpRequestException e) { Check(e.Message.Contains("418"), "blocked response is visible"); }
}
using (var success = new CnnClient(new FakeHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
       { Content = new StringContent(File.ReadAllText(Path.Combine(shared, "cnn-response.json"))) })))
    Check((await success.FetchAsync(TaskCatalog.Tasks[0], CancellationToken.None)).Value == sample.Value, "fetch and parse");
// Exercise restart persistence and an unacknowledged notification, not just getter/setter mirrors.
var temporary = Path.Combine(Path.GetTempPath(), "fear-index-tests-" + Guid.NewGuid().ToString("N"));
try
{
    var state = new StateStore(temporary);
    state.Update(s => { s.Running = true; s.Tasks[TaskCatalog.Tasks[0].Id].LastSample = sample; s.Tasks[TaskCatalog.Tasks[0].Id].PendingMessage = "18 → 17"; });
    var recovered = new StateStore(temporary).Snapshot();
    Check(recovered.Running && recovered.Tasks[TaskCatalog.Tasks[0].Id].LastSample == sample && recovered.Tasks[TaskCatalog.Tasks[0].Id].PendingMessage == "18 → 17", "restart preserves baseline and outbox");
    File.WriteAllText(Path.Combine(temporary, "state.json"), "broken");
    try { _ = new StateStore(temporary); Check(false, "corrupt state must not disappear"); }
    catch (System.Text.Json.JsonException) { Check(true, "corrupt state is visible"); }
}
finally { if (Directory.Exists(temporary)) Directory.Delete(temporary, true); }
Console.WriteLine($"PASS: {count} checks (shared rules, CNN parsing and HTTP failures, restart persistence).");

sealed class FakeHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => Task.FromResult(respond(request));
}
