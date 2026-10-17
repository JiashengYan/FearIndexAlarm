using FearIndexAlarm.Core;

namespace FearIndexAlarm;

internal sealed class MainForm : Form
{
    private readonly StateStore store;
    private readonly MonitorEngine engine;
    private readonly Label status = new() { AutoSize = true, Padding = new Padding(0, 8, 0, 4) };
    private readonly Dictionary<string, TaskDisplay> displays = [];
    private readonly Font valueFont = new("Segoe UI", 52, FontStyle.Bold);
    private readonly System.Windows.Forms.Timer refresh = new() { Interval = 2000 };
    [System.ComponentModel.DesignerSerializationVisibility(System.ComponentModel.DesignerSerializationVisibility.Hidden)]
    public bool AllowClose { get; set; }
    public MainForm(StateStore store, MonitorEngine engine, Icon icon)
    {
        this.store = store; this.engine = engine;
        Icon = icon;
        Text = "恐慌指数提醒"; ClientSize = new Size(700, 780); MinimumSize = new Size(560, 620);
        Font = new Font("Microsoft YaHei UI", 10); StartPosition = FormStartPosition.CenterScreen;
        var panel = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true, Padding = new Padding(22), BackColor = Color.FromArgb(245, 248, 247) };
        Controls.Add(panel);
        panel.Controls.Add(new Label { Text = "恐慌指数提醒", Font = new Font(Font.FontFamily, 24, FontStyle.Bold), AutoSize = true });
        panel.Controls.Add(new Label { Text = "本机独立监控 · 关闭窗口后继续在托盘运行", AutoSize = true, Padding = new Padding(0, 8, 0, 8) });
        panel.Controls.Add(status);
        var actions = new FlowLayoutPanel { AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, WrapContents = true, Margin = Padding.Empty };
        panel.Controls.Add(actions);
        void AddButton(Control parent, string label, Action action)
        {
            var button = new Button { Text = label, AutoSize = true, MinimumSize = new Size(180, 36) };
            button.Click += (_, _) => { try { action(); UpdateStatus(); } catch (Exception e) { MessageBox.Show(this, e.Message, "操作失败"); } };
            parent.Controls.Add(button);
        }
        void Button(string label, Action action)
        {
            AddButton(panel, label, action);
        }
        AddButton(actions, "开始 / 立即检查", () => { store.Update(s => s.Running = true); engine.ConfigurationChanged(); });
        AddButton(actions, "停止全部监控", () => { store.Update(s => s.Running = false); engine.ConfigurationChanged(); });
        foreach (var task in TaskCatalog.Tasks)
        {
            var card = new FlowLayoutPanel
            {
                FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoSize = true,
                AutoSizeMode = AutoSizeMode.GrowAndShrink, BackColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle, Padding = new Padding(16), Margin = new Padding(0, 12, 0, 12)
            };
            Label CardLabel(string text, Color? color = null)
            {
                var label = new Label { Text = text, AutoSize = true, ForeColor = color ?? Color.FromArgb(53, 68, 78), Margin = new Padding(0, 3, 0, 3) };
                card.Controls.Add(label);
                return label;
            }
            var heading = CardLabel(task.Name);
            heading.Font = new Font(Font.FontFamily, 12, FontStyle.Bold);
            var caption = CardLabel("当前指数（显示整数）");
            var value = CardLabel("—");
            value.Font = valueFont;
            value.Margin = new Padding(0, 0, 0, 4);
            var sourceTime = CardLabel("CNN 数据时间：—");
            var fetchedTime = CardLabel("本机最近成功获取：—");
            var sourceAge = CardLabel("距 CNN 数据时间：—");
            var result = CardLabel("尚未读取");
            var configuration = CardLabel("");
            displays.Add(task.Id, new TaskDisplay(card, caption, value, sourceTime, fetchedTime, sourceAge, result, configuration));
            panel.Controls.Add(card);
            var enabled = new CheckBox { Text = "启用此任务", Checked = store.Read(s => s.Tasks[task.Id].Enabled), AutoSize = true };
            enabled.CheckedChanged += (_, _) => { store.Update(s => s.Tasks[task.Id].Enabled = enabled.Checked); engine.ConfigurationChanged(); };
            panel.Controls.Add(enabled);
            var frequency = new NumericUpDown { Minimum = 60, Maximum = 604800, Value = store.Read(s => s.Tasks[task.Id].IntervalSeconds), Width = 230 };
            panel.Controls.Add(new Label { Text = "执行间隔（秒，最少 60）", AutoSize = true });
            panel.Controls.Add(frequency);
            Button("保存执行间隔", () => { store.Update(s => s.Tasks[task.Id].IntervalSeconds = (int)frequency.Value); engine.ConfigurationChanged(); });
            Button("休眠 1 小时", () => { store.Update(s => s.Tasks[task.Id].SnoozedUntilMs = DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeMilliseconds()); engine.ConfigurationChanged(); });
            Button("结束休眠", () => { store.Update(s => s.Tasks[task.Id].SnoozedUntilMs = 0); engine.ConfigurationChanged(); });
        }
        panel.Controls.Add(new Label { AutoSize = true, MaximumSize = new Size(600, 0), Padding = new Padding(0, 12, 0, 8), Text = "规则：显示整数低于 25，且较上次有效值下降时提醒；首次读取建立基准。源数据超过 60 分钟未更新时不触发。系统睡眠、断网和通知设置会影响运行与提醒。" });
        Button("导出执行日志", () =>
        {
            using var dialog = new SaveFileDialog { FileName = "fear-index-attempts.jsonl", Filter = "JSONL 日志|*.jsonl" };
            if (dialog.ShowDialog(this) == DialogResult.OK)
            {
                var source = Path.Combine(store.DirectoryPath, "attempts.jsonl");
                if (!File.Exists(source)) throw new InvalidOperationException("尚无执行记录");
                File.Copy(source, dialog.FileName, true);
            }
        });
        var resizingContent = false;
        void ResizeContent()
        {
            if (resizingContent) return;
            resizingContent = true;
            try
            {
                var width = Math.Max(280, panel.ClientSize.Width - panel.Padding.Horizontal - SystemInformation.VerticalScrollBarWidth - 4);
                actions.MaximumSize = new Size(width, 0);
                foreach (Control control in panel.Controls)
                    if (control is Label) control.MaximumSize = new Size(width, 0);
                foreach (var display in displays.Values)
                {
                    display.Card.MinimumSize = new Size(width, 0);
                    display.Card.MaximumSize = new Size(width, 0);
                    foreach (Control control in display.Card.Controls) control.MaximumSize = new Size(width - 36, 0);
                }
                // Recompute scroll extents after child widths shrink; otherwise WinForms can
                // retain the wider pre-resize display rectangle and a phantom horizontal bar.
                panel.PerformLayout();
            }
            finally { resizingContent = false; }
        }
        panel.ClientSizeChanged += (_, _) => ResizeContent();
        ResizeContent();
        refresh.Tick += (_, _) => UpdateStatus();
        VisibleChanged += (_, _) => { refresh.Enabled = Visible; if (Visible) UpdateStatus(); };
        FormClosing += (_, e) => { if (!AllowClose) { e.Cancel = true; Hide(); } };
        UpdateStatus();
    }
    private void UpdateStatus()
    {
        var state = store.Snapshot();
        status.Text = state.Running ? "● 监控已启用" : "● 监控已停止";
        status.ForeColor = state.Running ? Color.FromArgb(19, 120, 89) : Color.DimGray;
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        foreach (var task in TaskCatalog.Tasks)
        {
            var config = state.Tasks[task.Id];
            var sample = config.LastSample;
            var display = displays[task.Id];
            var stale = sample is not null && now - sample.SourceTimeMs > 3_600_000;
            var failed = config.LastStatus.StartsWith("ERROR", StringComparison.Ordinal);
            display.Caption.Text = sample is null ? "尚未取得有效指数" : stale ? "上次有效指数 · 源数据已过期" : failed ? "上次有效指数 · 当前读取失败" : "当前指数（显示整数）";
            display.Value.Text = sample is null ? "—" : MonitorRules.Displayed(sample.Value).ToString();
            display.Value.ForeColor = sample is null || stale ? Color.SlateGray : ScoreColor(MonitorRules.Displayed(sample.Value));
            display.SourceTime.Text = $"CNN 数据时间：{(sample is null ? "—" : LocalTime(sample.SourceTimeMs))}";
            display.FetchedTime.Text = $"本机最近成功获取：{(config.LastSuccessMs == 0 ? "—" : LocalTime(config.LastSuccessMs))}";
            display.SourceAge.Text = $"距 CNN 数据时间：{(sample is null ? "—" : Age(now - sample.SourceTimeMs))}（按本机时钟）";
            display.SourceAge.ForeColor = stale ? Color.Firebrick : Color.FromArgb(97, 111, 120);
            display.Result.Text = config.LastStatus;
            display.Result.ForeColor = failed ? Color.Firebrick : Color.FromArgb(53, 68, 78);
            display.Configuration.Text = $"{(config.Enabled ? "任务启用" : "任务暂停")} · 每 {config.IntervalSeconds} 秒" +
                (config.SnoozedUntilMs > now ? $" · 休眠至 {LocalTime(config.SnoozedUntilMs)}" : "");
        }
    }
    private static string LocalTime(long ms) => DateTimeOffset.FromUnixTimeMilliseconds(ms).ToLocalTime().ToString("MM-dd HH:mm:ss zzz");
    private static string Age(long ms)
    {
        var span = TimeSpan.FromMilliseconds(Math.Abs(ms));
        var text = span.TotalHours >= 1 ? $"{(long)span.TotalHours} 小时 {span.Minutes} 分 {span.Seconds} 秒" : $"{span.Minutes} 分 {span.Seconds} 秒";
        return ms < 0 ? $"源时间领先本机 {text}" : text;
    }
    private static Color ScoreColor(int score) => score switch
    {
        < 25 => Color.FromArgb(194, 53, 53),
        < 45 => Color.FromArgb(170, 98, 12),
        <= 55 => Color.FromArgb(83, 100, 121),
        < 75 => Color.FromArgb(22, 131, 107),
        _ => Color.FromArgb(12, 111, 68)
    };
    private sealed record TaskDisplay(FlowLayoutPanel Card, Label Caption, Label Value, Label SourceTime, Label FetchedTime, Label SourceAge, Label Result, Label Configuration);
    protected override void Dispose(bool disposing) { if (disposing) refresh.Dispose(); base.Dispose(disposing); if (disposing) valueFont.Dispose(); }
}
