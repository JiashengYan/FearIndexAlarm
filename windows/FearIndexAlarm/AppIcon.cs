namespace FearIndexAlarm;

internal static class AppIcon
{
    // Embedded as well as compiled into the EXE: no working-directory or loose-file dependency.
    internal const string ResourceName = "FearIndexAlarm.StockAlert.ico";

    internal static Icon Load(int size)
    {
        using var stream = typeof(AppIcon).Assembly.GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException("Missing embedded stock-alert icon.");
        using var source = new Icon(stream, new Size(size, size));
        return (Icon)source.Clone();
    }
}
