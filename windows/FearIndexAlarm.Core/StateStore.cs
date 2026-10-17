using System.Text.Json;

namespace FearIndexAlarm.Core;

public sealed class TaskState
{
    public bool Enabled { get; set; } = true;
    public int IntervalSeconds { get; set; } = 900;
    public long SnoozedUntilMs { get; set; }
    public Sample? LastSample { get; set; }
    public string LastStatus { get; set; } = "尚未读取";
    public long LastSuccessMs { get; set; }
    public string? PendingMessage { get; set; }
}
public sealed class AppState
{
    public bool Running { get; set; }
    public Dictionary<string, TaskState> Tasks { get; set; } = [];
}
public sealed class StateStore
{
    private readonly object gate = new();
    private readonly string path;
    private readonly AppState state;
    public string DirectoryPath { get; }
    public StateStore(string directory)
    {
        DirectoryPath = directory;
        Directory.CreateDirectory(directory);
        path = Path.Combine(directory, "state.json");
        // Corrupt state must be visible, not silently replaced with an empty baseline.
        state = File.Exists(path) ? JsonSerializer.Deserialize<AppState>(File.ReadAllText(path)) ?? throw new InvalidDataException("监控状态为空") : new();
        foreach (var task in TaskCatalog.Tasks)
        {
            state.Tasks.TryAdd(task.Id, new TaskState { IntervalSeconds = task.DefaultIntervalSeconds });
            if (state.Tasks[task.Id].IntervalSeconds is < 60 or > 604800) state.Tasks[task.Id].IntervalSeconds = task.DefaultIntervalSeconds;
        }
    }
    public T Read<T>(Func<AppState, T> action) { lock (gate) return action(state); }
    public void Update(Action<AppState> action)
    {
        lock (gate)
        {
            action(state);
            var temporary = path + ".tmp";
            File.WriteAllText(temporary, JsonSerializer.Serialize(state, new JsonSerializerOptions { WriteIndented = true }));
            File.Move(temporary, path, true);
        }
    }
    public AppState Snapshot() => Read(value => JsonSerializer.Deserialize<AppState>(JsonSerializer.Serialize(value))!);
}
