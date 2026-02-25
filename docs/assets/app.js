// Stock Sentinel - A股每日分析前端逻辑
let currentData = null;
let currentTab = 'launch';

async function loadData() {
    try {
        const resp = await fetch('api/latest.json');
        currentData = await resp.json();
        renderPage();
    } catch (e) {
        document.getElementById('report-date').textContent = '数据加载失败';
        console.error(e);
    }
}

function fmt(v, decimals) {
    if (v == null || v === undefined || (typeof v === 'number' && isNaN(v))) return '--';
    return typeof v === 'number' ? v.toFixed(decimals) : String(v);
}

function renderPage() {
    if (!currentData) return;

    // 日期
    const d = currentData.trade_date || '';
    if (d.length >= 8) {
        document.getElementById('report-date').textContent =
            `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
    } else {
        document.getElementById('report-date').textContent = '暂无数据';
    }

    renderSummary();
    renderTop3();
    renderSectorChart();
    renderTable(currentTab);
}

function renderSummary() {
    const el = document.getElementById('summary-cards');
    const perf = currentData.performance?.windows || {};
    const stats = currentData.stats || {};

    const cards = [
        { label: 'T+5 命中率', value: perf[5]?.avg_hit_rate
            ? (perf[5].avg_hit_rate * 100).toFixed(1) + '%' : '--' },
        { label: 'T+10 命中率', value: perf[10]?.avg_hit_rate
            ? (perf[10].avg_hit_rate * 100).toFixed(1) + '%' : '--' },
        { label: 'T+20 命中率', value: perf[20]?.avg_hit_rate
            ? (perf[20].avg_hit_rate * 100).toFixed(1) + '%' : '--' },
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
    const top3 = currentData.top3_buy || [];

    el.innerHTML = top3.map((s, i) => {
        const signalClass = s.signal === '即将启动' ? 'signal-up'
                          : s.signal === '即将下跌' ? 'signal-down' : '';
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

function renderSectorChart() {
    const sectors = currentData.top10_sectors || [];
    if (!sectors.length) return;

    const chart = echarts.init(document.getElementById('sector-chart'));
    const names = sectors.map(s => s.name);
    const values = sectors.map(s => (s.net_amount / 10000).toFixed(0));

    chart.setOption({
        tooltip: { trigger: 'axis', formatter: '{b}: {c} 亿' },
        xAxis: {
            type: 'category', data: names,
            axisLabel: { color: '#999', rotate: 30 },
        },
        yAxis: {
            type: 'value', name: '净流入(亿)',
            axisLabel: { color: '#999' },
        },
        series: [{
            type: 'bar',
            data: values.map(v => ({
                value: v,
                itemStyle: { color: v >= 0 ? '#cc2929' : '#00b894' },
            })),
        }],
        grid: { left: '8%', right: '5%', bottom: '15%' },
        backgroundColor: 'transparent',
    });
    window.addEventListener('resize', () => chart.resize());
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes(
            tab === 'launch' ? '启动' : '低估'
        ));
    });
    renderTable(tab);
}

function renderTable(tab) {
    const data = tab === 'launch'
        ? currentData.top100_launch
        : currentData.top100_undervalue;

    const tbody = document.getElementById('stock-tbody');
    tbody.innerHTML = (data || []).map((s, i) => {
        const pctClass = s.pct_chg > 0 ? 'pct-up' : s.pct_chg < 0 ? 'pct-down' : '';
        const signalClass = s.signal === '即将启动' ? 'signal-up'
                          : s.signal === '即将下跌' ? 'signal-down' : '';
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
            <td class="${pctClass}">${s.pct_chg>0?'+':''}${fmt(s.pct_chg,2)}%</td>
        </tr>`;
    }).join('');
}

loadData();
