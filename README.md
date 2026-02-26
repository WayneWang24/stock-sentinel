<div align="center">

# 📡 Stock Sentinel

**A股量化策略信号系统 — 每日自动扫描全市场，输出高确定性交易信号**

[![Live Dashboard](https://img.shields.io/badge/Live-Dashboard-e94560?style=for-the-badge&logo=github)](https://waynewang24.github.io/stock-sentinel/)
[![Strategy](https://img.shields.io/badge/Strategy-v29-cc2929?style=for-the-badge)](https://waynewang24.github.io/stock-sentinel/#signal)
[![History](https://img.shields.io/badge/Backtest-500天-4a90d9?style=for-the-badge)](https://waynewang24.github.io/stock-sentinel/#history)

</div>

---

## 这是什么？

Stock Sentinel 是一个全自动的 A 股量化分析系统。它每天收盘后扫描全市场 5000+ 只股票，经过三级过滤和多因子评分，最终输出少量高置信度的交易信号。

核心策略 **v29（极致确认持仓）** 在 500 个交易日的样本外回测中取得了 **95.7% 的止盈率**，平均持仓仅 1.3 天。

> 不追求信号数量，只追求每一笔的确定性。

## 核心功能

### 🎯 v29 策略信号

| 指标 | 数值 |
|------|------|
| 回测周期 | 500 个交易日 (2024.02 ~ 2026.02) |
| 止盈率 (TP10/SL5) | **95.7%** |
| 止盈率 (TP8/SL3) | **97.9%** |
| 总交易笔数 | 47 笔 |
| 平均收益 | +9.4% / 笔 |
| 平均持仓 | 1.3 天 |
| 信号频率 | 约每月 2-3 次 |

**工作原理：** 多因子涨停首板选股 → T+1 日内确认 → 高确定性持仓止盈

### 🌐 市场全景

- **热门板块资金流** — 每日 Top 10 板块净流入/流出
- **板块选股推荐** — 根据板块热度 + 龙头显著度筛选个股
- **即将启动 Top 100** — 多因子综合评分最高的启动信号
- **最低估 Top 100** — 基本面 + 技术面 + 资金面低估评分

### 📊 历史回测可视化

- KPI 仪表盘（止盈率、收益、持仓天数）
- TP10/SL5 vs TP8/SL3 方案对比
- 月度止盈率趋势图
- 确认漏斗（从全部选中 → 日内确认 → 强确认持仓）
- 收益分布 + 持仓天数分布

## 在线查看

🔗 **[waynewang24.github.io/stock-sentinel](https://waynewang24.github.io/stock-sentinel/)**

页面包含三个 Tab，支持直链：

| Tab | 链接 | 说明 |
|-----|------|------|
| v29 信号 | [#signal](https://waynewang24.github.io/stock-sentinel/#signal) | 今日候选 / 持仓 / 近期战绩 |
| 市场全景 | [#market](https://waynewang24.github.io/stock-sentinel/#market) | 板块资金流 / 选股 / Top 100 |
| 历史表现 | [#history](https://waynewang24.github.io/stock-sentinel/#history) | 回测统计 / 图表 / 月度明细 |

## 数据接口

所有数据以静态 JSON 提供，可直接调用：

| 接口 | 说明 | 更新频率 |
|------|------|----------|
| [`api/v29_daily.json`](https://waynewang24.github.io/stock-sentinel/api/v29_daily.json) | v29 实时信号（候选/持仓/战绩） | 每日 |
| [`api/latest.json`](https://waynewang24.github.io/stock-sentinel/api/latest.json) | 市场全景数据 | 每日 |
| [`api/v29_performance.json`](https://waynewang24.github.io/stock-sentinel/api/v29_performance.json) | 回测统计数据 | 不定期 |

## 仓库结构

```
stock-sentinel/
├── docs/                    # GitHub Pages 网站
│   ├── index.html           # 三 Tab 合一主页
│   ├── assets/              # CSS + JS
│   └── api/                 # 静态 JSON 数据接口
├── reports/                 # 每日报告存档 (Markdown + CSV)
└── strategy/                # 权重变更历史
```

## 技术栈

- **后端引擎：** Python · 多因子评分 · LightGBM · 50 维特征工程
- **数据源：** Tushare Pro
- **前端：** 纯 HTML/CSS/JS · ECharts 图表 · 暗色主题 · 移动端适配
- **部署：** GitHub Pages · 静态 JSON API · 每日自动发布

## 免责声明

> ⚠️ 本项目仅供学习研究，**不构成任何投资建议**。
> 回测结果不代表未来表现，实际交易存在流动性、滑点、手续费等风险。
> 股市有风险，投资需谨慎。

---

<div align="center">
<sub>Built with quantitative analysis and a lot of backtesting.</sub>
</div>
