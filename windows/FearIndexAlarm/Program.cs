using FearIndexAlarm.Core;

namespace FearIndexAlarm;

internal static class Program
{
    [STAThread]
    static void Main()
    {
        using var instance = new Mutex(true, @"Local\FearIndexAlarm", out var created);
        if (!created) return;
        ApplicationConfiguration.Initialize();
        try
        {
            var path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FearIndexAlarm");
            Application.Run(new TrayApplication(new StateStore(path)));
        }
        catch (Exception e) { MessageBox.Show(e.Message, "恐慌指数提醒启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error); }
    }
}

internal sealed class TrayApplication : ApplicationContext
{
    private readonly NotifyIcon tray;
    private readonly MainForm window;
    private readonly MonitorEngine engine;
    private readonly Icon windowIcon = AppIcon.Load(32);
    private readonly Icon trayIcon = AppIcon.Load(16);
    private readonly Control dispatcher = new();
    private bool exiting;
    public TrayApplication(StateStore store)
    {
        _ = dispatcher.Handle;
        engine = new MonitorEngine(store);
        window = new MainForm(store, engine, windowIcon);
        var menu = new ContextMenuStrip();
        menu.Items.Add("打开任务列表", null, (_, _) => ShowWindow());
        menu.Items.Add("开始监控", null, (_, _) => { store.Update(s => s.Running = true); engine.ConfigurationChanged(); });
        menu.Items.Add("停止监控", null, (_, _) => { store.Update(s => s.Running = false); engine.ConfigurationChanged(); });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("退出", null, async (_, _) => await QuitAsync(store));
        tray = new NotifyIcon { Icon = trayIcon, Text = "恐慌指数提醒", Visible = true, ContextMenuStrip = menu };
        tray.DoubleClick += (_, _) => ShowWindow();
        engine.Alert += (title, message) =>
        {
            // Marshal synchronously: only acknowledge the durable outbox after the UI accepted the notification.
            if (exiting) throw new OperationCanceledException("应用正在退出，保留待发提醒");
            dispatcher.Invoke(() => tray.ShowBalloonTip(10_000, title, message, ToolTipIcon.Info));
        };
        engine.StartLoop();
        ShowWindow();
    }
    private void ShowWindow() { window.Show(); window.WindowState = FormWindowState.Normal; window.Activate(); }
    private async Task QuitAsync(StateStore store)
    {
        if (exiting) return;
        exiting = true;
        store.Update(s => s.Running = false);
        await engine.DisposeAsync();
        window.AllowClose = true; window.Close();
        tray.Visible = false; tray.Dispose();
        trayIcon.Dispose(); windowIcon.Dispose();
        dispatcher.Dispose(); ExitThread();
    }
}
