// Stock Sentinel - 三 Tab 合一前端逻辑
// Tab 1: v29 信号 (api/v29_daily.json)
// Tab 2: 市场全景 (api/latest.json)
// Tab 3: 历史表现 (api/v29_performance.json)

const ACCENT = '#e94560';
const GREEN = '#cc2929';   // A股红涨
const RED = '#00b894';     // A股绿跌
const BLUE = '#4a90d9';
const MUTED = '#888';

// 缓存已加载的数据
let signalData = null;
let marketData = null;
let historyData = null;
let currentSubTab = 'launch';

// ======================== Tab 切换 ========================

function switchMainTab(tab) {
    // 更新按钮状态
    document.querySelectorAll('.main-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    // 更新面板
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === 'tab-' + tab);
    });
    // URL hash
    window.location.hash = tab;
    // 懒加载
    if (tab === 'signal' && !signalData) loadSignalData();
    if (tab === 'market' && !marketData) loadMarketData();
    if (tab === 'history' && !historyData) loadHistoryData();
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

// ======================== Tab 1: v29 信号 ========================

async function loadSignalData() {
    try {
        const resp = await fetch('api/v29_daily.json');
        signalData = await resp.json();
        renderSignalTab();
    } catch (e) {
        document.getElementById('v29-phase').textContent = '数据加载失败';
        console.error('v29_daily.json 加载失败:', e);
    }
}

function renderSignalTab() {
    if (!signalData) return;

    // 更新头部日期
    document.getElementById('header-date').textContent = fmtDate(signalData.date);

    // 状态横幅
    const phaseMap = { scan: '扫描完成', confirm: '确认阶段', check: '持仓检查', idle: '等待中' };
    document.getElementById('v29-phase').textContent = phaseMap[signalData.phase] || signalData.phase;

    const stats = signalData.live_stats || {};
    const statsEl = document.getElementById('v29-stats');
    if (stats.total_trades > 0) {
        const streakText = stats.streak > 0 ? `连胜${stats.streak}` : stats.streak < 0 ? `连败${Math.abs(stats.streak)}` : '';
        statsEl.innerHTML = `
            <span class="stat-item">总交易: <b>${stats.total_trades}</b></span>
            <span class="stat-item">止盈率: <b class="pct-up">${(stats.tp_rate * 100).toFixed(1)}%</b></span>
            <span class="stat-item">平均盈亏: <b class="${pctClass(stats.avg_pnl)}">${(stats.avg_pnl * 100).toFixed(1)}%</b></span>
            ${streakText ? `<span class="stat-item badge-streak">${streakText}</span>` : ''}
        `;
    } else {
        statsEl.innerHTML = '<span class="stat-item muted">暂无实盘记录</span>';
    }

    // 候选 — 显示具体买入日期
    const buyDateStr = signalData.buy_date ? fmtDate(signalData.buy_date) : '次日';
    document.getElementById('v29-candidates-title').textContent =
        signalData.candidates && signalData.candidates.length > 0
            ? `${buyDateStr} 买入候选`
            : '买入候选';
    renderV29Cards('v29-candidates', signalData.candidates, 'candidate');
    // 持仓
    renderV29Cards('v29-holdings', signalData.holdings, 'holding');
    // 待确认
    renderV29Cards('v29-pending', signalData.pending_confirm, 'pending');
    // 近期战绩
    renderRecentTrades();
}

function renderV29Cards(containerId, items, type) {
    const el = document.getElementById(containerId);
    if (!items || items.length === 0) {
        const emptyText = { candidate: '暂无候选', holding: '暂无持仓', pending: '暂无待确认' };
        el.innerHTML = `<p class="muted">${emptyText[type]}</p>`;
        return;
    }
    el.innerHTML = items.map(item => {
        let details = '';
        if (type === 'candidate') {
            const strengthClass = item.signal_strength === 'strong' ? 'badge-strong' : 'badge-normal';
            details = `
                <div class="v29-card-meta">
                    <span>${item.industry || '--'}</span>
                    <span class="${strengthClass}">${item.signal_strength}</span>
                </div>
                <div class="v29-card-price">${fmt(item.close, 2)}</div>
            `;
        } else if (type === 'holding') {
            details = `
                <div class="v29-card-meta">
                    <span>${item.industry || '--'}</span>
                    <span>持${item.hold_days}天</span>
                </div>
                <div class="v29-card-pnl ${pctClass(item.pnl_pct)}">
                    ${item.pnl_pct > 0 ? '+' : ''}${(item.pnl_pct * 100).toFixed(2)}%
                </div>
            `;
        } else {
            details = `
                <div class="v29-card-meta">
                    <span>${item.industry || '--'}</span>
                    <span>买入: ${fmtDate(item.buy_date)}</span>
                </div>
            `;
        }
        return `
            <div class="v29-card">
                <div class="v29-card-header">
                    <span class="v29-card-code">${item.ts_code}</span>
                    <span class="v29-card-name">${item.name}</span>
                </div>
                ${details}
            </div>
        `;
    }).join('');
}

function renderRecentTrades() {
    const trades = signalData.recent_trades || [];
    const tbody = document.getElementById('v29-trades-tbody');
    if (!trades.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;">暂无交易记录</td></tr>';
        return;
    }
    // 最新的在前
    tbody.innerHTML = trades.slice().reverse().slice(0, 10).map(t => {
        const exitClass = t.exit_reason === 'tp' ? 'badge-tp' : t.exit_reason === 'sl' ? 'badge-sl' : '';
        const exitText = t.exit_reason === 'tp' ? '止盈' : t.exit_reason === 'sl' ? '止损' : t.exit_reason === 'timeout' ? '超时' : t.exit_reason || '--';
        return `<tr>
            <td>${t.ts_code}</td>
            <td>${t.name}</td>
            <td>${fmtDate(t.buy_date)}</td>
            <td>${t.hold_days}天</td>
            <td class="${pctClass(t.pnl_pct)}">${t.pnl_pct > 0 ? '+' : ''}${(t.pnl_pct * 100).toFixed(2)}%</td>
            <td><span class="${exitClass}">${exitText}</span></td>
        </tr>`;
    }).join('');
}

// ======================== Tab 2: 市场全景 ========================

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

    // 日期 (如果 signal tab 还没加载)
    if (!signalData) {
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

// ======================== Tab 3: 历史表现 ========================

async function loadHistoryData() {
    try {
        const resp = await fetch('api/v29_performance.json');
        historyData = await resp.json();
        renderHistoryTab();
    } catch (e) {
        document.getElementById('kpi-cards').innerHTML = '<p class="muted">数据加载失败</p>';
        console.error('v29_performance.json 加载失败:', e);
    }
}

function renderHistoryTab() {
    if (!historyData) return;

    // 回测信息
    const bp = historyData.backtest_period;
    document.getElementById('backtest-info').textContent =
        `回测周期: ${bp.start} ~ ${bp.end} (${bp.total_days} 个交易日) | 更新: ${historyData.updated_at}`;

    renderKPI();
    renderCompareTable();
    renderMonthlyChart();
    renderFunnelChart();
    renderReturnDist();
    renderHoldDays();
    renderMonthlyTable();
}

function renderKPI() {
    const s = historyData.summary.TP10_SL5;
    const cards = [
        { label: '止盈率 (TP10/SL5)', value: (s.tp_rate * 100).toFixed(1) + '%', cls: 'green' },
        { label: '交易笔数', value: s.trades, cls: '' },
        { label: '平均收益', value: (s.avg_return * 100).toFixed(1) + '%', cls: 'green' },
        { label: '平均持仓天数', value: s.avg_hold_days + '天', cls: '' },
    ];
    document.getElementById('kpi-cards').innerHTML = cards.map(c => `
        <div class="kpi-card">
            <div class="kpi-value ${c.cls}">${c.value}</div>
            <div class="kpi-label">${c.label}</div>
        </div>
    `).join('');
}

function renderCompareTable() {
    const tbody = document.querySelector('#compare-table tbody');
    const schemes = [
        { name: 'TP10 / SL5', key: 'TP10_SL5' },
        { name: 'TP8 / SL3', key: 'TP8_SL3' },
    ];
    tbody.innerHTML = schemes.map(sc => {
        const s = historyData.summary[sc.key];
        return `<tr>
            <td>${sc.name}</td>
            <td>${s.trades}</td>
            <td class="highlight">${(s.tp_rate * 100).toFixed(1)}%</td>
            <td class="${s.avg_return > 0 ? 'highlight' : ''}">${(s.avg_return * 100).toFixed(1)}%</td>
            <td>${s.avg_hold_days}天</td>
        </tr>`;
    }).join('');
}

function renderMonthlyChart() {
    const chart = echarts.init(document.getElementById('monthly-chart'));
    const months = historyData.monthly.map(m => m.month);
    const tpRates = historyData.monthly.map(m => (m.tp_rate * 100).toFixed(1));
    const trades = historyData.monthly.map(m => m.trades);

    chart.setOption({
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'cross' },
            formatter: function(params) {
                let s = params[0].axisValue + '<br/>';
                params.forEach(p => {
                    const unit = p.seriesIndex === 0 ? '%' : '笔';
                    s += p.marker + p.seriesName + ': ' + p.value + unit + '<br/>';
                });
                return s;
            }
        },
        legend: { data: ['止盈率', '交易笔数'], textStyle: { color: MUTED } },
        xAxis: { type: 'category', data: months, axisLabel: { color: MUTED, rotate: 45, fontSize: 10 } },
        yAxis: [
            { type: 'value', name: '止盈率(%)', axisLabel: { color: MUTED, formatter: '{value}%' }, min: 0, max: 100 },
            { type: 'value', name: '笔数', axisLabel: { color: MUTED } },
        ],
        series: [
            {
                name: '止盈率', type: 'line', smooth: true,
                data: tpRates, yAxisIndex: 0,
                lineStyle: { color: ACCENT, width: 2 }, itemStyle: { color: ACCENT },
                areaStyle: { color: 'rgba(233,69,96,0.1)' },
                markLine: { silent: true, data: [{ yAxis: 95, lineStyle: { color: GREEN, type: 'dashed' } }], label: { formatter: '95%', color: GREEN } },
            },
            {
                name: '交易笔数', type: 'bar',
                data: trades, yAxisIndex: 1,
                itemStyle: { color: 'rgba(74,144,217,0.6)' }, barMaxWidth: 20,
            },
        ],
        grid: { left: '10%', right: '10%', bottom: '15%' },
        backgroundColor: 'transparent',
    });
    window.addEventListener('resize', () => chart.resize());
}

function renderFunnelChart() {
    const chart = echarts.init(document.getElementById('funnel-chart'));
    const funnel = historyData.confirmation_funnel;
    chart.setOption({
        tooltip: {
            trigger: 'item',
            formatter: function(p) {
                return p.name + '<br/>交易: ' + p.data.trades + '笔<br/>止盈率: ' + (p.data.tp_rate * 100).toFixed(1) + '%';
            },
        },
        series: [{
            type: 'funnel', left: '10%', right: '10%', top: '5%', bottom: '5%', width: '80%',
            sort: 'descending', gap: 4,
            label: {
                show: true, position: 'inside',
                formatter: function(p) { return p.name + '\n' + p.data.trades + '笔 | ' + (p.data.tp_rate * 100).toFixed(1) + '%'; },
                fontSize: 12, color: '#fff',
            },
            itemStyle: { borderWidth: 0 },
            data: funnel.map((f, i) => ({
                name: f.stage, value: f.trades, trades: f.trades, tp_rate: f.tp_rate,
                itemStyle: { color: ['rgba(74,144,217,0.7)', 'rgba(233,69,96,0.7)', 'rgba(204,41,41,0.9)'][i] },
            })),
        }],
        backgroundColor: 'transparent',
    });
    window.addEventListener('resize', () => chart.resize());
}

function renderReturnDist() {
    const chart = echarts.init(document.getElementById('return-dist-chart'));
    const dist = historyData.return_distribution;
    chart.setOption({
        tooltip: { trigger: 'axis', formatter: '{b}: {c}笔' },
        xAxis: { type: 'category', data: dist.labels, axisLabel: { color: MUTED, fontSize: 10, rotate: 30 } },
        yAxis: { type: 'value', name: '笔数', axisLabel: { color: MUTED }, minInterval: 1 },
        series: [{
            type: 'bar',
            data: dist.counts.map((c, i) => ({
                value: c,
                itemStyle: { color: dist.labels[i].startsWith('-') ? 'rgba(0,184,148,0.8)' : 'rgba(204,41,41,0.8)' },
            })),
            barMaxWidth: 40,
        }],
        grid: { left: '12%', right: '5%', bottom: '18%' },
        backgroundColor: 'transparent',
    });
    window.addEventListener('resize', () => chart.resize());
}

function renderHoldDays() {
    const chart = echarts.init(document.getElementById('hold-days-chart'));
    const dist = historyData.hold_days_distribution;
    chart.setOption({
        tooltip: { trigger: 'axis', formatter: '{b}: {c}笔' },
        xAxis: { type: 'category', data: dist.days, axisLabel: { color: MUTED } },
        yAxis: { type: 'value', name: '笔数', axisLabel: { color: MUTED }, minInterval: 1 },
        series: [{
            type: 'bar', data: dist.counts,
            itemStyle: { color: BLUE }, barMaxWidth: 50,
            label: { show: true, position: 'top', color: MUTED, formatter: '{c}' },
        }],
        grid: { left: '12%', right: '5%', bottom: '10%' },
        backgroundColor: 'transparent',
    });
    window.addEventListener('resize', () => chart.resize());
}

function renderMonthlyTable() {
    const tbody = document.getElementById('monthly-tbody');
    tbody.innerHTML = historyData.monthly.map(m => `
        <tr>
            <td style="text-align:left;">${m.month}</td>
            <td>${m.trades}</td>
            <td style="color: ${m.tp_rate >= 0.95 ? GREEN : m.tp_rate >= 0.8 ? ACCENT : '#fff'}">
                ${(m.tp_rate * 100).toFixed(1)}%
            </td>
            <td style="color: ${m.avg_return > 0 ? GREEN : 'inherit'}">
                ${(m.avg_return * 100).toFixed(1)}%
            </td>
        </tr>
    `).join('');
}

// ======================== 初始化 ========================

function init() {
    // 根据 URL hash 决定初始 tab
    const hash = window.location.hash.replace('#', '') || 'signal';
    const validTabs = ['signal', 'market', 'history'];
    const tab = validTabs.includes(hash) ? hash : 'signal';
    switchMainTab(tab);
}

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (['signal', 'market', 'history'].includes(hash)) {
        switchMainTab(hash);
    }
});

init();
