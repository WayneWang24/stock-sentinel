// Stock Sentinel - 前端逻辑
// Tab 1: v30 策略回测 (api/v30_backtest.json)
// Tab 2: 模拟盘 (api/v30_paper.json + api/v30_paper_archive.json)
// Tab 3: 市场全景 (api/latest.json)

const ACCENT = '#e94560';
const GREEN = '#cc2929';   // A股红涨
const RED = '#00b894';     // A股绿跌
const BLUE = '#4a90d9';
const MUTED = '#888';

let v30Data = null;
let paperData = null;
let archiveData = null;
let marketData = null;
let currentSubTab = 'launch';

// ======================== Tab 切换 ========================

function switchMainTab(tab) {
    document.querySelectorAll('.main-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === 'tab-' + tab);
    });
    window.location.hash = tab;
    if (tab === 'v30' && !v30Data) loadV30Data();
    if (tab === 'paper') {
        if (!paperData) loadPaperV30Data();
        if (!archiveData) loadPaperArchive();
    }
    if (tab === 'market' && !marketData) loadMarketData();
}

function switchPaperSubTab(subtab) {
    document.querySelectorAll('.sub-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subtab === subtab);
    });
    document.querySelectorAll('.sub-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === 'paper-sub-' + subtab);
    });
}

function switchSubTab(tab) {
    currentSubTab = tab;
    document.querySelectorAll('.tab-header .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes(
            tab === 'launch' ? '启动' : '低估'
        ));
    });
    renderMarketTable(tab);
}

// ======================== 工具函数 ========================

function fmt(v, decimals) {
    if (v == null || v === undefined || (typeof v === 'number' && isNaN(v))) return '--';
    return typeof v === 'number' ? v.toFixed(decimals) : String(v);
}

function fmtDate(d) {
    if (!d || d.length < 8) return '--';
    return d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
}

function pctClass(v) {
    if (v > 0) return 'pct-up';
    if (v < 0) return 'pct-down';
    return '';
}

// ======================== Tab 1: v30 策略回测 ========================

async function loadV30Data() {
    try {
        const resp = await fetch('api/v30_backtest.json');
        v30Data = await resp.json();
        document.getElementById('header-date').textContent = v30Data.updated_at;
        renderV30Tab();
    } catch (e) {
        document.getElementById('v30-kpi-cards').innerHTML = '<p class="muted">数据加载失败</p>';
        console.error('v30_backtest.json 加载失败:', e);
    }
}

function renderV30Tab() {
    if (!v30Data) return;

    const bp = v30Data.backtest_period;
    const ver = v30Data.version || 'v30.3';
    document.getElementById('v30-backtest-info').textContent =
        `${ver} ${v30Data.strategy} | 回测: ${bp.start} ~ ${bp.end} (${bp.trade_days} 交易日) | 更新: ${v30Data.updated_at}`;

    renderV30KPI();
    renderV30Equity();
    renderV30MonthlyChart();
    renderV30ExitChart();
    renderV30ReturnDist();
    renderV30MonthlyTable();
    renderV30Trades();
}

function renderV30KPI() {
    const s = v30Data.summary;
    const retCls = s.total_return >= 0 ? 'green' : 'red';
    const cards = [
        { label: '总收益', value: '+' + s.total_return + '%', cls: retCls },
        { label: '年化收益', value: '+' + s.annual_return + '%', cls: retCls },
        { label: 'Sharpe', value: s.sharpe, cls: s.sharpe >= 1.5 ? 'green' : '' },
        { label: '最大回撤', value: s.max_drawdown + '%', cls: 'red' },
        { label: '胜率', value: s.win_rate + '%', cls: s.win_rate >= 50 ? 'green' : '' },
        { label: '交易笔数', value: s.total_trades + '笔', cls: '' },
        { label: '平均持仓', value: s.avg_days_held + '天', cls: '' },
        { label: '平均盈亏', value: (s.avg_pnl_pct > 0 ? '+' : '') + s.avg_pnl_pct + '%', cls: s.avg_pnl_pct > 0 ? 'green' : 'red' },
    ];
    document.getElementById('v30-kpi-cards').innerHTML = cards.map(c => `
        <div class="kpi-card">
            <div class="kpi-value ${c.cls}">${c.value}</div>
            <div class="kpi-label">${c.label}</div>
        </div>
    `).join('');
}

function renderV30Equity() {
    const chart = echarts.init(document.getElementById('v30-equity-chart'));
    const nav = v30Data.daily_nav;
    const dates = nav.map(d => fmtDate(d.date));
    const navs = nav.map(d => d.nav);
    const dds = nav.map(d => -(d.drawdown * 100));

    chart.setOption({
        tooltip: {
            trigger: 'axis',
            formatter: function(params) {
                let s = params[0].axisValue + '<br/>';
                params.forEach(p => {
                    if (p.seriesIndex === 0) s += p.marker + '净值: ' + p.value.toFixed(4) + '<br/>';
                    else s += p.marker + '回撤: ' + (-p.value).toFixed(2) + '%<br/>';
                });
                return s;
            }
        },
        legend: { data: ['净值', '回撤'], textStyle: { color: MUTED } },
        xAxis: { type: 'category', data: dates, axisLabel: { color: MUTED } },
        yAxis: [
            { type: 'value', name: '净值', axisLabel: { color: MUTED }, scale: true },
            { type: 'value', name: '回撤(%)', axisLabel: { color: MUTED, formatter: '{value}%' }, max: 0 },
        ],
        series: [
            {
                name: '净值', type: 'line', smooth: true,
                data: navs, yAxisIndex: 0,
                lineStyle: { color: ACCENT, width: 2 },
                itemStyle: { color: ACCENT },
                symbol: 'none',
                markLine: {
                    silent: true,
                    data: [{ yAxis: 1.0, lineStyle: { color: '#666', type: 'dashed' } }],
                    label: { formatter: '基准', color: '#666' }
                },
            },
            {
                name: '回撤', type: 'bar',
                data: dds, yAxisIndex: 1,
                itemStyle: { color: 'rgba(0,184,148,0.3)' },
                barMaxWidth: 4,
            },
        ],
        dataZoom: [{ type: 'inside', start: 0, end: 100 }],
        grid: { left: '8%', right: '8%', bottom: '8%' },
        backgroundColor: 'transparent',
    });
    window.addEventListener('resize', () => chart.resize());
}

function renderV30MonthlyChart() {
    const chart = echarts.init(document.getElementById('v30-monthly-chart'));
    const monthly = v30Data.monthly_returns;
    const months = monthly.map(m => m.month);
    const returns = monthly.map(m => m.return_pct);

    chart.setOption({
        tooltip: {
            trigger: 'axis',
            formatter: function(params) {
                const p = params[0];
                const m = monthly[p.dataIndex];
                return p.axisValue + '<br/>'
                    + p.marker + '收益: ' + m.return_pct + '%<br/>'
                    + '交易: ' + m.trades + '笔 | 胜率: ' + m.win_rate + '%';
            }
        },
        xAxis: { type: 'category', data: months, axisLabel: { color: MUTED, rotate: 45 } },
        yAxis: { type: 'value', name: '月收益(%)', axisLabel: { color: MUTED, formatter: '{value}%' } },
        series: [{
            type: 'bar',
            data: returns.map(v => ({
                value: v,
                itemStyle: { color: v >= 0 ? GREEN : RED },
            })),
            barMaxWidth: 40,
            label: {
                show: true, position: 'top', color: MUTED, fontSize: 10,
                formatter: function(p) { return p.value > 0 ? '+' + p.value + '%' : p.value + '%'; }
            },
        }],
        grid: { left: '8%', right: '5%', bottom: '15%' },
        backgroundColor: 'transparent',
    });
    window.addEventListener('resize', () => chart.resize());
}

function renderV30ExitChart() {
    const chart = echarts.init(document.getElementById('v30-exit-chart'));
    const reasons = v30Data.exit_reasons;
    const nameMap = {
        'stop_loss': '止损', 'take_profit_2': '止盈12%', 'timeout': '超时',
        'distribution': '派发', 'distribution_surge': '放量派发', 'backtest_end': '回测结束'
    };
    const data = Object.entries(reasons)
        .filter(([k]) => k !== 'backtest_end')
        .map(([k, v]) => ({ name: nameMap[k] || k, value: v }))
        .sort((a, b) => b.value - a.value);

    chart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c}笔 ({d}%)' },
        series: [{
            type: 'pie', radius: ['35%', '65%'],
            data: data,
            label: { color: MUTED, formatter: '{b}\n{c}笔' },
            itemStyle: { borderColor: '#1a1a2e', borderWidth: 2 },
        }],
        backgroundColor: 'transparent',
    });
    window.addEventListener('resize', () => chart.resize());
}

function renderV30ReturnDist() {
    const chart = echarts.init(document.getElementById('v30-return-dist-chart'));
    const dist = v30Data.return_distribution;
    chart.setOption({
        tooltip: { trigger: 'axis', formatter: '{b}: {c}笔' },
        xAxis: { type: 'category', data: dist.labels, axisLabel: { color: MUTED, fontSize: 10 } },
        yAxis: { type: 'value', name: '笔数', axisLabel: { color: MUTED }, minInterval: 1 },
        series: [{
            type: 'bar',
            data: dist.counts.map((c, i) => ({
                value: c,
                itemStyle: { color: dist.labels[i].startsWith('<') || dist.labels[i].startsWith('-') ? 'rgba(0,184,148,0.8)' : 'rgba(204,41,41,0.8)' },
            })),
            barMaxWidth: 40,
            label: { show: true, position: 'top', color: MUTED, formatter: '{c}' },
        }],
        grid: { left: '12%', right: '5%', bottom: '12%' },
        backgroundColor: 'transparent',
    });
    window.addEventListener('resize', () => chart.resize());
}

function renderV30MonthlyTable() {
    const tbody = document.getElementById('v30-monthly-tbody');
    tbody.innerHTML = v30Data.monthly_returns.map(m => {
        const retCls = m.return_pct > 0 ? 'pct-up' : m.return_pct < 0 ? 'pct-down' : '';
        return `<tr>
            <td style="text-align:left;">${m.month}</td>
            <td class="${retCls}">${m.return_pct > 0 ? '+' : ''}${m.return_pct}%</td>
            <td>${m.trades}</td>
            <td>${m.win_rate}%</td>
        </tr>`;
    }).join('');
}

function renderV30Trades() {
    const tbody = document.getElementById('v30-trades-tbody');
    const trades = v30Data.completed_trades;
    const nameMap = {
        'stop_loss': '止损', 'take_profit_2': '止盈', 'timeout': '超时',
        'distribution': '派发', 'distribution_surge': '放量派发', 'backtest_end': '结束'
    };
    tbody.innerHTML = trades.slice().reverse().map(t => {
        const cls = pctClass(t.pnl_pct);
        const reason = nameMap[t.exit_reason] || t.exit_reason;
        const reasonBadge = t.exit_reason === 'take_profit_2' ? 'badge-tp' : t.exit_reason === 'stop_loss' ? 'badge-sl' : '';
        return `<tr>
            <td>${t.ts_code}</td>
            <td>${t.name}</td>
            <td>${fmtDate(t.sell_date)}</td>
            <td>${t.days_held}天</td>
            <td class="${cls}">${t.pnl_pct > 0 ? '+' : ''}${t.pnl_pct}%</td>
            <td><span class="${reasonBadge}">${reason}</span></td>
        </tr>`;
    }).join('');
}

// ======================== Tab 2: 模拟盘 — 实时跟踪 ========================

async function loadPaperV30Data() {
    try {
        const resp = await fetch('api/v30_paper.json');
        paperData = await resp.json();
        renderPaperLive();
    } catch (e) {
        console.error('v30_paper.json 加载失败:', e);
    }
}

function renderPaperLive() {
    if (!paperData) return;
    renderTrackingProgress();
    renderPaperKPIs();
    renderPaperEquity();
    renderPaperEffectiveness();
    renderPaperHoldings();
    renderPaperCandidates();
    renderPaperPendingSells();
    renderDailyActions();
    renderPairedTrades();
    renderPaperTrades();

    // 有交易数据时隐藏空消息
    const hasTrades = paperData.paper_trades && paperData.paper_trades.length > 0;
    const hasHoldings = paperData.holdings && paperData.holdings.length > 0;
    if (hasTrades || hasHoldings) {
        document.getElementById('paper-empty-msg').style.display = 'none';
    }
}

function renderTrackingProgress() {
    const tp = paperData.tracking_period;
    if (!tp) return;

    const el = document.getElementById('tracking-progress');
    const progress = tp.tracking_days || 0;
    const total = tp.total_trading_days || 65;
    const pct = Math.min(progress / total * 100, 100);

    const startFmt = fmtDate(tp.start);
    const endFmt = fmtDate(tp.end);

    el.innerHTML = `
        <div class="progress-info">
            <span>跟踪期: ${startFmt} ~ ${endFmt}</span>
            <span>已进行 ${progress}/${total} 交易日 (${pct.toFixed(0)}%)</span>
        </div>
        <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${pct}%"></div>
        </div>
        <div class="progress-meta">
            <span>v30.3 FI标准化评分 | ${tp.months}个月跟踪</span>
            ${paperData.date ? '<span>最新数据: ' + fmtDate(paperData.date) + '</span>' : ''}
        </div>
    `;
}

function renderPaperKPIs() {
    const s = paperData.paper_stats;
    if (!s) return;

    document.getElementById('paper-section').style.display = '';
    const returnPct = (s.net_return * 100).toFixed(2);
    const returnSign = s.net_return >= 0 ? '+' : '';
    const returnCls = s.net_return >= 0 ? 'green' : 'red';

    const cards = [
        { label: '总资产', value: s.total_equity.toLocaleString(), cls: '' },
        { label: '净值 (收益率)', value: `${s.nav.toFixed(4)} <small class="paper-kpi-sub ${returnCls}">${returnSign}${returnPct}%</small>`, cls: returnCls },
        { label: '最大回撤', value: (s.max_drawdown * 100).toFixed(2) + '%', cls: 'red' },
        { label: '持仓 / 胜率', value: `${s.positions}仓 <small class="paper-kpi-sub">${s.total_trades}笔 ${(s.win_rate * 100).toFixed(0)}%</small>`, cls: '' },
        { label: 'Sharpe', value: fmt(s.sharpe, 2), cls: s.sharpe >= 1.5 ? 'green' : '' },
    ];
    document.getElementById('paper-kpis').innerHTML = cards.map(c => `
        <div class="kpi-card">
            <div class="kpi-value ${c.cls}">${c.value}</div>
            <div class="kpi-label">${c.label}</div>
        </div>
    `).join('');
}

function renderPaperEquity() {
    const curve = paperData.equity_curve;
    if (!curve || curve.length < 2) return;

    document.getElementById('paper-equity-section').style.display = '';
    const chart = echarts.init(document.getElementById('paper-equity-chart'));

    const dates = curve.map(p => fmtDate(p.date));
    const navs = curve.map(p => p.nav);
    const dds = curve.map(p => -(p.drawdown * 100));

    chart.setOption({
        tooltip: {
            trigger: 'axis',
            formatter: function(params) {
                let s = params[0].axisValue + '<br/>';
                params.forEach(p => {
                    if (p.seriesIndex === 0) s += p.marker + '净值: ' + p.value.toFixed(4) + '<br/>';
                    else s += p.marker + '回撤: ' + (-p.value).toFixed(2) + '%<br/>';
                });
                return s;
            }
        },
        legend: { data: ['净值', '回撤'], textStyle: { color: MUTED } },
        xAxis: { type: 'category', data: dates, axisLabel: { color: MUTED } },
        yAxis: [
            { type: 'value', name: '净值', axisLabel: { color: MUTED }, scale: true },
            { type: 'value', name: '回撤(%)', axisLabel: { color: MUTED, formatter: '{value}%' }, max: 0 },
        ],
        series: [
            {
                name: '净值', type: 'line', smooth: true,
                data: navs, yAxisIndex: 0,
                lineStyle: { color: ACCENT, width: 2 },
                itemStyle: { color: ACCENT },
                symbol: 'circle', symbolSize: 6,
            },
            {
                name: '回撤', type: 'bar',
                data: dds, yAxisIndex: 1,
                itemStyle: { color: 'rgba(0,184,148,0.4)' },
                barMaxWidth: 30,
            },
        ],
        grid: { left: '10%', right: '10%', bottom: '10%' },
        backgroundColor: 'transparent',
    });
    window.addEventListener('resize', () => chart.resize());
}

function renderPaperEffectiveness() {
    const eff = paperData.effectiveness;
    if (!eff) return;

    // 周度收益
    const weekly = eff.weekly_returns || [];
    const rollingWR = eff.rolling_win_rate || [];
    if (weekly.length < 1 && rollingWR.length < 1) return;

    document.getElementById('paper-effectiveness-section').style.display = '';

    // 周度收益柱状图
    if (weekly.length > 0) {
        const chart = echarts.init(document.getElementById('paper-weekly-chart'));
        chart.setOption({
            tooltip: { trigger: 'axis', formatter: function(params) {
                const p = params[0];
                const w = weekly[p.dataIndex];
                return fmtDate(w.start) + ' ~ ' + fmtDate(w.end) + '<br/>' + p.marker + p.value + '%';
            }},
            xAxis: { type: 'category', data: weekly.map((w, i) => 'W' + (i + 1)), axisLabel: { color: MUTED } },
            yAxis: { type: 'value', name: '周收益(%)', axisLabel: { color: MUTED, formatter: '{value}%' } },
            series: [{
                type: 'bar',
                data: weekly.map(w => ({
                    value: w.return_pct,
                    itemStyle: { color: w.return_pct >= 0 ? GREEN : RED },
                })),
                barMaxWidth: 30,
            }],
            grid: { left: '15%', right: '5%', bottom: '10%' },
            backgroundColor: 'transparent',
        });
        window.addEventListener('resize', () => chart.resize());
    }

    // 滚动胜率折线图
    if (rollingWR.length > 0) {
        const chart = echarts.init(document.getElementById('paper-rolling-wr-chart'));
        chart.setOption({
            tooltip: { trigger: 'axis', formatter: function(params) {
                const p = params[0];
                return '第' + rollingWR[p.dataIndex].trade_index + '笔<br/>' +
                    p.marker + '胜率: ' + (p.value * 100).toFixed(0) + '%';
            }},
            xAxis: { type: 'category', data: rollingWR.map(r => '#' + r.trade_index), axisLabel: { color: MUTED } },
            yAxis: { type: 'value', name: '胜率', min: 0, max: 1, axisLabel: { color: MUTED, formatter: function(v) { return (v*100)+'%'; } } },
            series: [{
                type: 'line', smooth: true,
                data: rollingWR.map(r => r.win_rate),
                lineStyle: { color: BLUE, width: 2 },
                itemStyle: { color: BLUE },
                markLine: {
                    silent: true,
                    data: [{ yAxis: 0.5, lineStyle: { color: '#666', type: 'dashed' } }],
                    label: { formatter: '50%', color: '#666' }
                },
            }],
            grid: { left: '15%', right: '5%', bottom: '10%' },
            backgroundColor: 'transparent',
        });
        window.addEventListener('resize', () => chart.resize());
    }
}

function renderPaperHoldings() {
    const holdings = paperData.holdings;
    if (!holdings || !holdings.length) return;

    document.getElementById('paper-holdings-section').style.display = '';
    const el = document.getElementById('paper-holdings');
    el.innerHTML = holdings.map(h => {
        const pnl = h.pnl_pct;
        const pnlText = (pnl >= 0 ? '+' : '') + (pnl * 100).toFixed(2) + '%';
        const borderCls = pnl >= 0 ? 'trade-card-win' : 'trade-card-loss';
        return `
        <div class="trade-card ${borderCls}" style="margin-bottom:10px;">
            <div class="trade-card-top">
                <div>
                    <span class="trade-card-code">${h.ts_code}</span>
                    <span class="trade-card-name">${h.name}</span>
                </div>
                <span class="trade-card-badge badge-hold">${h.sector_name}</span>
            </div>
            <div class="trade-card-body">
                <div class="trade-card-price">${h.buy_price.toFixed(2)} → ${h.current_price.toFixed(2)}</div>
                <div class="trade-card-pnl ${pctClass(pnl)}">${pnlText}</div>
            </div>
            <div class="trade-card-footer">
                <span>${h.shares}股</span>
                <span>成本 ${h.buy_cost.toLocaleString()}</span>
                <span>市值 ${h.market_value.toLocaleString()}</span>
                <span>持仓${h.days_held}天</span>
                <span>买入 ${fmtDate(h.buy_date)}</span>
            </div>
        </div>`;
    }).join('');
}

function renderPaperCandidates() {
    const candidates = paperData.candidates;
    if (!candidates || !candidates.length) return;

    document.getElementById('paper-candidates-section').style.display = '';
    const el = document.getElementById('paper-candidates');
    el.innerHTML = candidates.map(c => `
        <div class="v29-card">
            <div class="v29-card-header">
                <span class="v29-card-code">${c.ts_code}</span>
                <span class="v29-card-name">${c.name}</span>
            </div>
            <div class="v29-card-meta">
                <span>${c.sector_name}</span>
                <span>评分 ${fmt(c.stock_score, 0)}</span>
            </div>
            <div class="v29-card-price">${fmt(c.close, 2)}</div>
        </div>
    `).join('');
}

function renderPaperPendingSells() {
    const sells = paperData.pending_sells;
    if (!sells || !sells.length) return;

    document.getElementById('paper-pending-section').style.display = '';
    const el = document.getElementById('paper-pending-sells');
    const reasonMap = {
        'take_profit_2': '止盈', 'stop_loss': '止损',
        'distribution': '派发', 'distribution_surge': '放量派发', 'timeout': '超时',
    };
    el.innerHTML = sells.map(s => `
        <div class="v29-card" style="border-left-color: var(--red);">
            <div class="v29-card-header">
                <span class="v29-card-code">${s.ts_code}</span>
                <span class="badge-sl">${reasonMap[s.reason] || s.reason}</span>
            </div>
        </div>
    `).join('');
}

function renderDailyActions() {
    const actions = paperData.daily_actions;
    if (!actions || !actions.length) return;

    const container = document.getElementById('daily-actions-view');
    if (!container) return;
    document.getElementById('daily-actions-section').style.display = '';

    // 按日期分组 (倒序)
    const groups = {};
    actions.forEach(a => {
        const d = a.date;
        if (!groups[d]) groups[d] = [];
        groups[d].push(a);
    });

    const sortedDates = Object.keys(groups).sort().reverse();
    container.innerHTML = sortedDates.map(date => {
        const items = groups[date];
        return `
            <div class="trade-group">
                <div class="trade-group-date">${fmtDate(date)}</div>
                <div class="trade-cards-grid">
                    ${items.map(a => renderActionCard(a)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function renderActionCard(a) {
    const exitReasonMap = {
        'take_profit_2': '止盈', 'stop_loss': '止损',
        'distribution': '派发', 'distribution_surge': '放量派发',
        'timeout': '超时', 'manual_sell': '手动卖出',
    };

    if (a.type === 'buy') {
        return `
            <div class="trade-card action-card-buy">
                <div class="trade-card-top">
                    <div>
                        <span class="trade-card-code">${a.ts_code}</span>
                        <span class="trade-card-name">${a.name}</span>
                    </div>
                    <span class="trade-card-badge badge-buy">买入</span>
                </div>
                <div class="trade-card-body">
                    <div class="trade-card-price">${a.price.toFixed(2)} × ${a.shares}股</div>
                    <div style="font-size:0.85rem;color:var(--text-muted)">¥${a.amount.toLocaleString()}</div>
                </div>
                <div class="trade-card-footer">
                    <span>NAV ${a.nav.toFixed(4)}</span>
                    <span>现金 ${Math.round(a.cash).toLocaleString()}</span>
                    <span>持仓 ${a.positions}只</span>
                </div>
            </div>
        `;
    }

    if (a.type === 'sell') {
        const pnl = a.pnl_pct || 0;
        const reason = exitReasonMap[a.exit_reason] || a.exit_reason || '--';
        const badgeClass = a.exit_reason === 'stop_loss' ? 'badge-sl' :
            a.exit_reason === 'take_profit_2' ? 'badge-tp' : '';
        return `
            <div class="trade-card ${pnl >= 0 ? 'action-card-sell-win' : 'action-card-sell-loss'}">
                <div class="trade-card-top">
                    <div>
                        <span class="trade-card-code">${a.ts_code}</span>
                        <span class="trade-card-name">${a.name}</span>
                    </div>
                    <span class="trade-card-badge ${badgeClass}">卖出 · ${reason}</span>
                </div>
                <div class="trade-card-body">
                    <div class="trade-card-price">${a.price.toFixed(2)} × ${a.shares}股</div>
                    <div class="trade-card-pnl"><span class="${pctClass(pnl)}">${pnl > 0 ? '+' : ''}${(pnl * 100).toFixed(2)}%</span></div>
                </div>
                <div class="trade-card-footer">
                    <span>NAV ${a.nav.toFixed(4)}</span>
                    <span>现金 ${Math.round(a.cash).toLocaleString()}</span>
                    <span>持仓 ${a.positions}只</span>
                </div>
            </div>
        `;
    }

    if (a.type === 'holding') {
        return `
            <div class="trade-card action-card-holding">
                <div class="trade-card-top">
                    <div><span class="trade-card-code">持仓观望</span></div>
                    <span class="trade-card-badge badge-hold">持有 ${a.positions}只</span>
                </div>
                <div class="trade-card-body">
                    <div style="color:var(--text-muted);font-size:0.9rem">等待出场信号</div>
                    <div style="font-size:0.9rem">NAV ${a.nav.toFixed(4)}</div>
                </div>
                <div class="trade-card-footer">
                    <span>现金 ${Math.round(a.cash).toLocaleString()}</span>
                </div>
            </div>
        `;
    }

    // standby — 空仓
    return `
        <div class="trade-card action-card-standby">
            <div class="trade-card-top">
                <div><span class="trade-card-code">空仓观望</span></div>
                <span class="trade-card-badge badge-standby">等待机会</span>
            </div>
            <div class="trade-card-body">
                <div style="color:var(--text-muted);font-size:0.9rem">市场过滤不入场</div>
                <div style="font-size:0.9rem">NAV ${a.nav.toFixed(4)}</div>
            </div>
            <div class="trade-card-footer">
                <span>现金 ${Math.round(a.cash).toLocaleString()}</span>
            </div>
        </div>
    `;
}

function renderPairedTrades() {
    const paired = paperData.paper_paired_trades;
    if (!paired || !paired.length) return;

    document.getElementById('paper-trades-section').style.display = '';
    const container = document.getElementById('paired-trades-view');

    const groups = {};
    paired.forEach(t => {
        const d = t.buy_date || 'unknown';
        if (!groups[d]) groups[d] = [];
        groups[d].push(t);
    });

    const sortedDates = Object.keys(groups).sort().reverse();
    container.innerHTML = sortedDates.map(date => {
        const trades = groups[date];
        return `
            <div class="trade-group">
                <div class="trade-group-date">${fmtDate(date)}</div>
                <div class="trade-cards-grid">
                    ${trades.map(t => renderTradeCard(t)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function renderTradeCard(t) {
    const isHolding = t.status === 'holding';
    const pnl = t.pnl_pct || 0;
    const borderClass = isHolding ? 'trade-card-holding' : pnl >= 0 ? 'trade-card-win' : 'trade-card-loss';

    const exitReasonMap = {
        'take_profit_2': '止盈', 'stop_loss': '止损',
        'distribution': '派发', 'distribution_surge': '放量派发', 'timeout': '超时',
    };
    const reasonText = isHolding ? '持仓中' : (exitReasonMap[t.exit_reason] || t.exit_reason || '--');
    const reasonBadge = isHolding ? 'badge-hold' :
        t.exit_reason === 'take_profit_2' ? 'badge-tp' :
        t.exit_reason === 'stop_loss' ? 'badge-sl' : '';

    const pnlText = `<span class="${pctClass(pnl)}">${pnl > 0 ? '+' : ''}${(pnl * 100).toFixed(2)}%</span>`;
    const arrow = isHolding ? '' : ` → ${t.exit_price.toFixed(2)}`;
    const holdText = t.hold_days ? `${t.hold_days}天` : '';

    const buyAmt = t.buy_amount || 0;
    const sellAmt = t.sell_amount || 0;
    const netPnl = isHolding ? 0 : (sellAmt - buyAmt);

    return `
        <div class="trade-card ${borderClass}">
            <div class="trade-card-top">
                <div>
                    <span class="trade-card-code">${t.ts_code}</span>
                    <span class="trade-card-name">${t.name}</span>
                </div>
                <span class="trade-card-badge ${reasonBadge}">${reasonText}</span>
            </div>
            <div class="trade-card-body">
                <div class="trade-card-price">${t.entry_price.toFixed(2)}${arrow}</div>
                <div class="trade-card-pnl">${pnlText}</div>
            </div>
            <div class="trade-card-amounts">
                <span>买入 <b>${buyAmt.toLocaleString()}</b></span>
                ${!isHolding ? `<span>卖出 <b>${sellAmt.toLocaleString()}</b></span>` : ''}
                ${!isHolding ? `<span class="${netPnl >= 0 ? 'pct-up' : 'pct-down'}">净盈亏 ${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(0)}</span>` : ''}
            </div>
            <div class="trade-card-footer">
                <span>${t.shares}股</span>
                ${holdText ? `<span>持仓${holdText}</span>` : ''}
                <span>佣金 ${t.commission.toFixed(2)}</span>
                ${t.stamp > 0 ? `<span>印花税 ${t.stamp.toFixed(2)}</span>` : ''}
            </div>
        </div>
    `;
}

function switchTradeView(view) {
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.getElementById('paired-trades-view').style.display = view === 'card' ? '' : 'none';
    document.getElementById('flow-trades-view').style.display = view === 'flow' ? '' : 'none';
}

function renderPaperTrades() {
    const trades = paperData.paper_trades;
    if (!trades || !trades.length) return;

    document.getElementById('paper-trades-section').style.display = '';
    const tbody = document.getElementById('paper-trades-tbody');

    const exitReasonMap = {
        'take_profit_2': '止盈', 'stop_loss': '止损',
        'distribution': '派发', 'distribution_surge': '放量派发', 'timeout': '超时',
    };

    tbody.innerHTML = trades.slice().reverse().map(t => {
        const isBuy = t.direction === 'buy';
        const dirClass = isBuy ? 'paper-row-buy' : 'paper-row-sell';
        const dirText = isBuy ? '买入' : '卖出';
        const pnlText = t.pnl_pct != null && !isBuy
            ? `<span class="${pctClass(t.pnl_pct)}">${t.pnl_pct > 0 ? '+' : ''}${(t.pnl_pct * 100).toFixed(2)}%</span>`
            : '--';
        const reason = t.exit_reason ? (exitReasonMap[t.exit_reason] || t.exit_reason) : '--';

        return `<tr class="${dirClass}">
            <td>${fmtDate(t.date)}</td>
            <td>${t.ts_code}</td>
            <td>${t.name}</td>
            <td>${dirText}</td>
            <td>${fmt(t.price, 2)}</td>
            <td>${t.shares}</td>
            <td>${t.amount.toLocaleString()}</td>
            <td>${fmt(t.fee, 2)}</td>
            <td>${pnlText}</td>
            <td>${isBuy ? '--' : reason}</td>
        </tr>`;
    }).join('');
}

// ======================== Tab 2: 模拟盘 — 历史存档 ========================

async function loadPaperArchive() {
    try {
        const resp = await fetch('api/v30_paper_archive.json');
        archiveData = await resp.json();
        renderPaperArchive();
    } catch (e) {
        console.error('v30_paper_archive.json 加载失败:', e);
    }
}

function renderPaperArchive() {
    if (!archiveData) return;

    const s = archiveData.paper_stats;
    if (!s) return;

    const returnPct = (s.net_return * 100).toFixed(2);
    const returnSign = s.net_return >= 0 ? '+' : '';
    const returnCls = s.net_return >= 0 ? 'green' : 'red';

    const cards = [
        { label: '总资产', value: s.total_equity.toLocaleString(), cls: '' },
        { label: '净值 (收益率)', value: `${s.nav.toFixed(4)} <small class="paper-kpi-sub ${returnCls}">${returnSign}${returnPct}%</small>`, cls: returnCls },
        { label: '最大回撤', value: (s.max_drawdown * 100).toFixed(2) + '%', cls: s.max_drawdown > 0 ? 'red' : '' },
        { label: '交易/胜率', value: `${s.total_trades}笔 ${(s.win_rate * 100).toFixed(0)}%`, cls: '' },
    ];

    document.getElementById('archive-kpis').innerHTML = cards.map(c => `
        <div class="kpi-card">
            <div class="kpi-value ${c.cls}">${c.value}</div>
            <div class="kpi-label">${c.label}</div>
        </div>
    `).join('');

    // 持仓快照
    const holdings = archiveData.holdings || [];
    if (holdings.length > 0) {
        document.getElementById('archive-holdings-section').style.display = '';
        document.getElementById('archive-holdings').innerHTML = holdings.map(h => {
            const pnl = h.pnl_pct || 0;
            const pnlText = (pnl >= 0 ? '+' : '') + (pnl * 100).toFixed(2) + '%';
            return `<div class="v29-card"><div class="v29-card-header">
                <span class="v29-card-code">${h.ts_code}</span>
                <span class="v29-card-name">${h.name}</span>
            </div><div class="v29-card-meta">
                <span>${pnlText}</span><span>${h.shares}股</span>
            </div></div>`;
        }).join('');
    }

    // 交易记录
    const trades = archiveData.paper_paired_trades || [];
    if (trades.length > 0) {
        document.getElementById('archive-trades-section').style.display = '';
        document.getElementById('archive-trades').innerHTML =
            '<div class="trade-cards-grid">' +
            trades.map(t => renderTradeCard(t)).join('') +
            '</div>';
    }
}

// ======================== Tab 3: 市场全景 ========================

async function loadMarketData() {
    try {
        const resp = await fetch('api/latest.json');
        marketData = await resp.json();
        renderMarketTab();
    } catch (e) {
        document.getElementById('summary-cards').innerHTML = '<p class="muted">数据加载失败</p>';
        console.error('latest.json 加载失败:', e);
    }
}

function renderMarketTab() {
    if (!marketData) return;

    if (!v30Data) {
        const d = marketData.trade_date || '';
        document.getElementById('header-date').textContent = fmtDate(d);
    }

    renderSummary();
    renderTop3();
    renderSectorPicks();
    renderSectorChart();
    renderMarketTable(currentSubTab);
}

function renderSummary() {
    const el = document.getElementById('summary-cards');
    const perf = marketData.performance?.windows || {};
    const stats = marketData.stats || {};
    const cards = [
        { label: 'T+5 命中率', value: perf[5]?.avg_hit_rate ? (perf[5].avg_hit_rate * 100).toFixed(1) + '%' : '--' },
        { label: 'T+10 命中率', value: perf[10]?.avg_hit_rate ? (perf[10].avg_hit_rate * 100).toFixed(1) + '%' : '--' },
        { label: 'T+20 命中率', value: perf[20]?.avg_hit_rate ? (perf[20].avg_hit_rate * 100).toFixed(1) + '%' : '--' },
        { label: '扫描股票数', value: stats.stage3_count || '--' },
    ];
    el.innerHTML = cards.map(c =>
        `<div class="summary-card">
            <div class="label">${c.label}</div>
            <div class="value">${c.value}</div>
        </div>`
    ).join('');
}

function renderTop3() {
    const el = document.getElementById('top3-grid');
    const top3 = marketData.top3_buy || [];
    el.innerHTML = top3.map((s, i) => {
        const signalClass = s.signal === '即将启动' ? 'signal-up' : s.signal === '即将下跌' ? 'signal-down' : '';
        return `
        <div class="top3-card">
            <div>
                <span class="stock-code">#${i+1} ${s.ts_code}</span>
                <span class="stock-name">${s.name}</span>
            </div>
            <div class="metrics">
                <div class="metric">信号: <span class="val ${signalClass}">${s.signal}</span></div>
                <div class="metric">置信度: <span class="val">${fmt(s.confidence*100,0)}%</span></div>
                <div class="metric">技术分: <span class="val">${fmt(s.tech_score,0)}</span></div>
                <div class="metric">低估分: <span class="val">${fmt(s.undervalue_score,0)}</span></div>
                <div class="metric">行业: <span class="val">${s.industry||'--'}</span></div>
                <div class="metric">PE: <span class="val">${fmt(s.pe_ttm,1)}</span></div>
                <div class="metric">收盘: <span class="val">${fmt(s.close,2)}</span></div>
                <div class="metric">涨跌: <span class="val ${s.pct_chg>0?'pct-up':'pct-down'}">${s.pct_chg>0?'+':''}${fmt(s.pct_chg,2)}%</span></div>
            </div>
        </div>`;
    }).join('') || '<p class="muted">暂无推荐</p>';
}

function renderSectorPicks() {
    const picks = marketData.sector_picks || [];
    const gridEl = document.getElementById('sector-picks-grid');
    const tableEl = document.getElementById('sector-picks-table');
    const tbodyEl = document.getElementById('sector-picks-tbody');

    if (!picks.length) {
        gridEl.innerHTML = '<p class="muted">暂无板块选股数据</p>';
        return;
    }

    const top3 = picks.slice(0, 3);
    gridEl.innerHTML = top3.map((p, i) => {
        const cls = pctClass(p.pct_chg);
        const flags = (p.flags || []).join(' ');
        return `
        <div class="top3-card">
            <div>
                <span class="stock-code">#${i+1} ${p.ts_code}</span>
                <span class="stock-name">${p.name}</span>
                ${p.is_star ? '<span class="badge-star">科创</span>' : ''}
            </div>
            <div class="metrics">
                <div class="metric">板块: <span class="val">${p.sector_name}</span></div>
                <div class="metric">类型: <span class="val">${p.sector_type === 'concept' ? '概念' : '行业'}</span></div>
                <div class="metric">板块排名: <span class="val">#${p.sector_rank}</span></div>
                <div class="metric">涨跌: <span class="val ${cls}">${p.pct_chg>0?'+':''}${fmt(p.pct_chg,2)}%</span></div>
                <div class="metric">评分: <span class="val">${fmt(p.composite_score,0)}</span></div>
                <div class="metric">标记: <span class="val flag-text">${flags||'--'}</span></div>
            </div>
        </div>`;
    }).join('');

    if (picks.length > 3) {
        tableEl.style.display = '';
        tbodyEl.innerHTML = picks.slice(3).map((p, i) => {
            const cls = pctClass(p.pct_chg);
            const flags = (p.flags || []).join(',');
            return `<tr>
                <td>${i+4}</td>
                <td>${p.ts_code}${p.is_star ? ' <span class="badge-star">科创</span>' : ''}</td>
                <td>${p.name}</td>
                <td>${p.sector_name}</td>
                <td>${p.sector_type === 'concept' ? '概念' : '行业'}</td>
                <td class="${cls}">${p.pct_chg>0?'+':''}${fmt(p.pct_chg,2)}%</td>
                <td>${fmt(p.amount/10,0)}</td>
                <td>${fmt(p.composite_score,0)}</td>
                <td class="flag-text">${flags}</td>
            </tr>`;
        }).join('');
    }
}

function renderSectorChart() {
    const sectors = marketData.top10_sectors || [];
    if (!sectors.length) return;

    const chart = echarts.init(document.getElementById('sector-chart'));
    const names = sectors.map(s => s.name);
    const values = sectors.map(s => (s.net_amount / 10000).toFixed(0));

    chart.setOption({
        tooltip: { trigger: 'axis', formatter: '{b}: {c} 亿' },
        xAxis: { type: 'category', data: names, axisLabel: { color: MUTED, rotate: 30 } },
        yAxis: { type: 'value', name: '净流入(亿)', axisLabel: { color: MUTED } },
        series: [{
            type: 'bar',
            data: values.map(v => ({
                value: v,
                itemStyle: { color: v >= 0 ? GREEN : RED },
            })),
        }],
        grid: { left: '8%', right: '5%', bottom: '15%' },
        backgroundColor: 'transparent',
    });
    window.addEventListener('resize', () => chart.resize());
}

function renderMarketTable(tab) {
    if (!marketData) return;
    const data = tab === 'launch' ? marketData.top100_launch : marketData.top100_undervalue;
    const tbody = document.getElementById('stock-tbody');
    tbody.innerHTML = (data || []).map((s, i) => {
        const cls = pctClass(s.pct_chg);
        const signalClass = s.signal === '即将启动' ? 'signal-up' : s.signal === '即将下跌' ? 'signal-down' : '';
        return `<tr>
            <td>${i+1}</td>
            <td>${s.ts_code}</td>
            <td>${s.name}</td>
            <td>${s.industry||'--'}</td>
            <td class="${signalClass}">${s.signal}</td>
            <td>${fmt(s.confidence*100,0)}%</td>
            <td>${fmt(s.tech_score,0)}</td>
            <td>${fmt(s.undervalue_score,0)}</td>
            <td>${fmt(s.pe_ttm,1)}</td>
            <td>${fmt(s.close,2)}</td>
            <td class="${cls}">${s.pct_chg>0?'+':''}${fmt(s.pct_chg,2)}%</td>
        </tr>`;
    }).join('');
}

// ======================== 初始化 ========================

function init() {
    const hash = window.location.hash.replace('#', '') || 'paper';
    const validTabs = ['paper', 'v30', 'market'];
    const tab = validTabs.includes(hash) ? hash : 'paper';
    switchMainTab(tab);
}

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (['v30', 'paper', 'market'].includes(hash)) {
        switchMainTab(hash);
    }
});

init();
