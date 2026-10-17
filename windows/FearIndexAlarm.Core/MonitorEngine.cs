using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace FearIndexAlarm.Core;

public sealed class MonitorEngine : IAsyncDisposable
{
    private readonly StateStore store;
    private readonly CnnClient client = new();
    private readonly SemaphoreSlim wake = new(0, 1);
    private readonly CancellationTokenSource stop = new();
    private readonly Dictionary<string, long> nextDue = [];
    private readonly Dictionary<string, int> failures = [];
    private Task? loop;
    private int revision;
    private int observedRevision;
    public event Action<string, string>? Alert;
    public MonitorEngine(StateStore store) => this.store = store;
    public void StartLoop() => loop ??= Task.Run(() => RunAsync(stop.Token));
    public void ConfigurationChanged()
    {
        Interlocked.Increment(ref revision);
        try { wake.Release(); } catch (SemaphoreFullException) { }
    }
    private async Task RunAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                if (observedRevision != Volatile.Read(ref revision))
                {
                    observedRevision = Volatile.Read(ref revision);
                    nextDue.Clear();
                }
                var state = store.Snapshot();
                if (state.Running)
                {
                    foreach (var task in TaskCatalog.Tasks)
                    {
                        var config = state.Tasks[task.Id];
                        if (!config.Enabled) { nextDue.Remove(task.Id); continue; }
                        var snooze = config.SnoozedUntilMs - DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                        if (snooze > 0) { nextDue[task.Id] = Environment.TickCount64 + snooze; continue; }
                        var due = nextDue.GetValueOrDefault(task.Id, Environment.TickCount64);
                        if (Environment.TickCount64 >= due)
                        {
                            await RunTaskAsync(task, due, cancellationToken).ConfigureAwait(false);
                            var interval = config.IntervalSeconds * 1000L;
                            var now = Environment.TickCount64;
                            nextDue[task.Id] = due + ((Math.Max(0, now - due) / interval) + 1) * interval;
                        }
                    }
                }
                else nextDue.Clear();
                var wait = nextDue.Count == 0 ? 60_000 : Math.Clamp(nextDue.Values.Min() - Environment.TickCount64, 250, 60_000);
                await wake.WaitAsync(TimeSpan.FromMilliseconds(wait), cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { break; }
            catch (Exception e)
            {
                try { AppendLog(new { type = "engine-error", started_ms = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), result = e.Message }); } catch { }
                await Task.Delay(5000, cancellationToken).ConfigureAwait(false);
            }
        }
    }
    private async Task RunTaskAsync(TaskDefinition task, long scheduledElapsed, CancellationToken cancellationToken)
    {
        var started = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var elapsed = Environment.TickCount64;
        var watch = Stopwatch.StartNew();
        string result;
        try
        {
            DeliverPending(task);
            var sample = await client.FetchAsync(task, cancellationToken).ConfigureAwait(false);
            // Do not notify after the user has stopped or disabled the task during an HTTP request.
            if (!store.Read(s => s.Running && s.Tasks[task.Id].Enabled && s.Tasks[task.Id].SnoozedUntilMs <= DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())) return;
            var previous = store.Read(s => s.Tasks[task.Id].LastSample);
            var decision = MonitorRules.Evaluate(previous, sample, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            var message = decision.Alert ? $"当前 {MonitorRules.Displayed(sample.Value)}，上次 {MonitorRules.Displayed(previous!.Value)}；源数据 {DateTimeOffset.FromUnixTimeMilliseconds(sample.SourceTimeMs).ToLocalTime():MM-dd HH:mm:ss}" : null;
            result = $"{(decision.Alert ? "ALERT" : "OK")} · {MonitorRules.Displayed(sample.Value)} · {decision.Reason}";
            store.Update(s =>
            {
                var config = s.Tasks[task.Id];
                if (decision.Accept) { config.LastSample = sample; if (message is not null) config.PendingMessage = message; }
                config.LastStatus = result; config.LastSuccessMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            });
            DeliverPending(task);
            failures[task.Id] = 0;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception e)
        {
            result = $"ERROR · {e.Message}";
            store.Update(s => s.Tasks[task.Id].LastStatus = result);
            failures[task.Id] = failures.GetValueOrDefault(task.Id) + 1;
            if (failures[task.Id] == 3) Alert?.Invoke("监控数据源异常", $"{task.Name} 连续 3 次失败：{e.Message}");
        }
        AppendLog(new { task = task.Id, scheduled_ms = started + scheduledElapsed - elapsed, started_ms = started,
            elapsed_ms = elapsed, duration_ms = watch.ElapsedMilliseconds, result });
    }
    private void DeliverPending(TaskDefinition task)
    {
        var pending = store.Read(s => s.Tasks[task.Id].PendingMessage);
        if (pending is null || Alert is null) return;
        Alert.Invoke("恐慌指数下降", pending);
        store.Update(s => s.Tasks[task.Id].PendingMessage = null);
    }
    private void AppendLog<T>(T entry)
    {
        var path = Path.Combine(store.DirectoryPath, "attempts.jsonl");
        if (File.Exists(path) && new FileInfo(path).Length > 4_000_000) File.Move(path, Path.Combine(store.DirectoryPath, "attempts.previous.jsonl"), true);
        File.AppendAllText(path, JsonSerializer.Serialize(entry) + Environment.NewLine, new UTF8Encoding(false));
    }
    public async ValueTask DisposeAsync()
    {
        await stop.CancelAsync();
        if (loop is not null) { try { await loop; } catch (OperationCanceledException) { } }
        client.Dispose(); wake.Dispose(); stop.Dispose();
    }
}
