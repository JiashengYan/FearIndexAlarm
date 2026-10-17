using System.Reflection;
using FearIndexAlarm.Core;

internal static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        if (args.Length != 1) throw new ArgumentException("Supply an isolated artifact output directory.");
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        var output = Path.GetFullPath(args[0]);
        Directory.CreateDirectory(output);
        var assembly = Assembly.Load("FearIndexAlarm");
        using var icon = (Icon)assembly.GetType("FearIndexAlarm.AppIcon", true)!.GetMethod("Load", BindingFlags.Static | BindingFlags.NonPublic)!.Invoke(null, [32])!;
        foreach (var scenario in new[] { "fresh-red", "fresh-green", "stale", "empty" })
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var store = new StateStore(Path.Combine(output, "isolated-state", scenario));
            store.Update(s =>
            {
                s.Running = true;
                var config = s.Tasks[TaskCatalog.Tasks[0].Id];
                config.LastSample = scenario == "empty" ? null : new Sample(scenario == "fresh-green" ? 63 : 18,
                    now - (scenario == "stale" ? 7_200_000 : 1_045_000));
                config.LastSuccessMs = scenario == "empty" ? 0 : now;
                config.LastStatus = scenario == "empty" ? "ERROR · 演示：尚未获取数据" : "OK · 演示数据，不代表实时市场";
            });
            var engine = new MonitorEngine(store); // Never StartLoop: preview must not fetch/notify.
            using var form = (Form)Activator.CreateInstance(assembly.GetType("FearIndexAlarm.MainForm", true)!, store, engine, icon)!;
            form.Text = "界面预览 · 演示数据";
            form.StartPosition = FormStartPosition.Manual;
            form.Location = new Point(-30000, -30000);
            form.ShowInTaskbar = false;
            // WinForms omits invisible child controls from WM_PRINT/DrawToBitmap.
            // Show only this isolated preview offscreen, never the user's real monitor.
            form.Show();
            Application.DoEvents();
            form.PerformLayout();
            using var bitmap = new Bitmap(form.Width, form.Height);
            form.DrawToBitmap(bitmap, new Rectangle(Point.Empty, bitmap.Size));
            bitmap.Save(Path.Combine(output, scenario + ".png"), System.Drawing.Imaging.ImageFormat.Png);
            if (scenario == "fresh-red")
            {
                form.ClientSize = new Size(544, 581);
                form.PerformLayout();
                Application.DoEvents();
                var rootPanel = (FlowLayoutPanel)form.Controls[0];
                Console.WriteLine($"Narrow layout: viewport={rootPanel.ClientSize.Width}, horizontal-scroll={rootPanel.HorizontalScroll.Visible}");
                if (rootPanel.HorizontalScroll.Visible) throw new InvalidOperationException("Narrow preview unexpectedly requires horizontal scrolling.");
                using var narrow = new Bitmap(form.Width, form.Height);
                form.DrawToBitmap(narrow, new Rectangle(Point.Empty, narrow.Size));
                narrow.Save(Path.Combine(output, "narrow.png"), System.Drawing.Imaging.ImageFormat.Png);
            }
            engine.DisposeAsync().AsTask().GetAwaiter().GetResult();
            form.Hide();
            Console.WriteLine($"Rendered {scenario} from actual MainForm; isolated state, no network or notifications.");
        }
    }
}
