import { Icon } from "./icon";

export function RulePanel() {
  return (
    <section className="panel rule-panel" aria-labelledby="rule-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">A SIGNAL, NOT THE NOISE</span>
          <h2 id="rule-title">只在恐惧加深时提醒</h2>
        </div>
        <span className="rule-icon">
          <Icon name="shield" size={24} />
        </span>
      </div>
      <p className="rule-intro">两个条件同时满足，触发一次告警。</p>
      <div className="rule-equation">
        <div>
          <span className="rule-number">01</span>
          <p>进入极度恐惧区间</p>
          <strong>
            指数 <b>&lt; 25</b>
          </strong>
        </div>
        <span className="and">&</span>
        <div>
          <span className="rule-number">02</span>
          <p>相比上次有效读数</p>
          <strong>
            继续 <b>下降 ↘</b>
          </strong>
        </div>
      </div>
      <div className="rule-example">
        <span>例如</span>
        <span>
          26 <i>→</i> 24 <i>→</i> 23
        </span>
        <span className="positive">
          <Icon name="check" size={14} />
          后两次提醒
        </span>
      </div>
      <div className="rule-details">
        <p>
          <Icon name="check" size={15} />
          按显示整数比较，首次读取只建立基准
        </p>
        <p>
          <Icon name="check" size={15} />
          超过 60 分钟的源数据不参与告警
        </p>
        <p>
          <Icon name="check" size={15} />
          反弹后再次下跌，仍会触发提醒
        </p>
      </div>
      <div className="browser-note">
        <Icon name="pulse" size={18} />
        <p>
          保持页面打开，以持续监控。
          <span>后台标签页可能延迟；关闭页面或电脑休眠后不会持续检查。</span>
        </p>
      </div>
    </section>
  );
}
