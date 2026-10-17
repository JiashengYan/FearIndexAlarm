namespace FearIndexAlarm.Core;

public sealed record Sample(double Value, long SourceTimeMs);
public sealed record Decision(bool Accept, bool Alert, string Reason);

public static class MonitorRules
{
    public static int Displayed(double value) => checked((int)Math.Round(value, MidpointRounding.AwayFromZero));

    public static Decision Evaluate(Sample? previous, Sample current, long nowMs, long maxAgeMs = 3_600_000)
    {
        if (!double.IsFinite(current.Value) || current.Value < 0 || current.Value > 100 || current.SourceTimeMs <= 0)
            return new(false, false, "无效数据");
        if (current.SourceTimeMs > nowMs + 300_000) return new(false, false, "数据时间超前");
        if (nowMs - current.SourceTimeMs > maxAgeMs) return new(false, false, "源数据超过 60 分钟未更新");
        if (previous is not null && current.SourceTimeMs < previous.SourceTimeMs)
            return new(false, false, "忽略旧时间戳");
        if (previous is not null && current.SourceTimeMs == previous.SourceTimeMs)
            return new(false, false, current.Value == previous.Value ? "源数据未更新" : "同一时间戳数值冲突");
        var alert = previous is not null && Displayed(current.Value) < 25 && Displayed(current.Value) < Displayed(previous.Value);
        return new(true, alert, alert ? "低于 25 且较上次下降" : previous is null ? "已建立基准" : "已更新");
    }
}

public sealed record TaskDefinition(string Id, string Name, int DefaultIntervalSeconds, string Url);

// Add a provider and definition here, then rebuild. No runtime script engine.
public static class TaskCatalog
{
    public static readonly TaskDefinition[] Tasks = [new("cnn-fear-greed", "CNN 恐惧与贪婪指数", 900,
        "https://production.dataviz.cnn.io/index/fearandgreed/graphdata")];
}
