'use strict';
/* js/metrics.js – Metrics Dashboard with category time breakdown */

let metricsChartInstance = null;
let currentDateRange = { type: 'month', start: null, end: null };

/* ─── Helper: get date range from selection ───────────────── */
function getDateRange(type, customStart = null, customEnd = null) {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (type) {
        case 'today':
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            break;
        case 'week':
            start = new Date(now);
            start.setDate(now.getDate() - now.getDay()); // Sunday of current week
            start.setHours(0,0,0,0);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23,59,59,999);
            break;
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'year':
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
            break;
        case 'custom':
            start = new Date(customStart);
            end = new Date(customEnd);
            end.setHours(23,59,59,999);
            break;
        default:
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    return { start, end, type };
}

/* ─── Determine if a task falls inside the chosen range ───── */
function taskInRange(task, range) {
    if (!task.dueDate) return false;
    const taskDate = new Date(task.dueDate);
    return taskDate >= range.start && taskDate <= range.end;
}

/* ─── Compute metrics per category and overall ─────────────── */
async function computeMetrics(range) {
    const tasks = await slpData.getTasks();
    const categories = CategoryManager.all;

    // Filter tasks by due date (or created date – choose whichever fits your workflow)
    const filtered = tasks.filter(t => taskInRange(t, range));

    // Initialise per‑category accumulators
    const catMap = new Map();
    categories.forEach(cat => {
        catMap.set(cat.id, {
            name: cat.name,
            emoji: cat.emoji,
            totalTasks: 0,
            completedTasks: 0,
            totalLogged: 0,
            totalEstimated: 0
        });
    });
    // Also include tasks that may have a categoryId not in our list (fallback "Other")
    const otherKey = '__other__';
    catMap.set(otherKey, {
        name: 'Other',
        emoji: '📦',
        totalTasks: 0,
        completedTasks: 0,
        totalLogged: 0,
        totalEstimated: 0
    });

    // Accumulate figures
    for (const task of filtered) {
        let catId = task.categoryId;
        if (!catId || !catMap.has(catId)) catId = otherKey;
        const entry = catMap.get(catId);
        entry.totalTasks++;
        if (task.status === 'done') entry.completedTasks++;
        if (task.loggedTime) entry.totalLogged += task.loggedTime;
        if (task.estimatedTime) entry.totalEstimated += task.estimatedTime;
    }

    // Convert map to array, calculate derived metrics
    const categoriesArray = Array.from(catMap.values())
        .filter(c => c.totalTasks > 0 || c.totalLogged > 0) // only show categories that have data
        .map(c => ({
            ...c,
            completionRate: c.totalTasks ? Math.round((c.completedTasks / c.totalTasks) * 100) : 0,
            avgTimePerTask: c.totalTasks ? Math.round(c.totalLogged / c.totalTasks) : 0
        }));

    // Overall summary
    const overall = {
        totalTasks: filtered.length,
        completedTasks: filtered.filter(t => t.status === 'done').length,
        totalLogged: filtered.reduce((sum, t) => sum + (t.loggedTime || 0), 0),
        totalEstimated: filtered.reduce((sum, t) => sum + (t.estimatedTime || 0), 0)
    };
    overall.completionRate = overall.totalTasks ? Math.round((overall.completedTasks / overall.totalTasks) * 100) : 0;
    overall.avgTimePerTask = overall.totalTasks ? Math.round(overall.totalLogged / overall.totalTasks) : 0;

    return { categories: categoriesArray, overall };
}

/* ─── Render metrics cards ─────────────────────────────────── */
function renderMetricsCards(overall) {
    const container = document.getElementById('metricsCards');
    if (!container) return;
    container.innerHTML = `
        <div class="stat-card accent">
            <div class="stat-icon">📋</div>
            <div class="stat-value">${overall.totalTasks}</div>
            <div class="stat-label">کل وظایف</div>
        </div>
        <div class="stat-card green">
            <div class="stat-icon">✓</div>
            <div class="stat-value">${overall.completedTasks}</div>
            <div class="stat-label">وظایف انجام شده</div>
            <div class="stat-sub">${overall.completionRate}%</div>
        </div>
        <div class="stat-card blue">
            <div class="stat-icon">⏱️</div>
            <div class="stat-value">${Math.floor(overall.totalLogged / 60)}h ${overall.totalLogged % 60}m</div>
            <div class="stat-label">کل زمان ثبت شده</div>
        </div>
        <div class="stat-card amber">
            <div class="stat-icon">🎯</div>
            <div class="stat-value">${Math.floor(overall.totalEstimated / 60)}h ${overall.totalEstimated % 60}m</div>
            <div class="stat-label">کل زمان تخمینی</div>
        </div>
        <div class="stat-card pink">
            <div class="stat-icon">⚡</div>
            <div class="stat-value">${overall.avgTimePerTask} دقیقه</div>
            <div class="stat-label">میانگین زمان هر وظیفه</div>
        </div>
    `;
}
/* ─── Render bar chart (logged time by category) ───────────── */
function renderCategoryChart(categories) {
    const ctx = document.getElementById('categoryTimeChart')?.getContext('2d');
    if (!ctx) return;

    const labels = categories.map(c => `${c.emoji} ${c.name}`);
    const data = categories.map(c => c.totalLogged);

    if (metricsChartInstance) metricsChartInstance.destroy();
    metricsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'دقیقه ثبت شده',
                data,
                backgroundColor: '#6c63ff',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } }
        }
    });
}

/* ─── Render the category metrics table ────────────────────── */
function renderMetricsTable(categories) {
    const tbody = document.getElementById('metricsTableBody');
    if (!tbody) return;
    tbody.innerHTML = categories.map(c => `
        <tr>
            <td>${c.emoji} ${c.name}</td>
            <td>${c.totalTasks}</td>
            <td>${c.completedTasks}</td>
            <td>${c.completionRate}%</td>
            <td>${c.totalLogged} min (${Math.floor(c.totalLogged / 60)}h ${c.totalLogged % 60}m)</td>
            <td>${c.totalEstimated} min</td>
            <td>${c.avgTimePerTask} min</td>
        </tr>
    `).join('');
}

/* ─── Main refresh function ────────────────────────────────── */
async function refreshMetrics() {
    const range = getDateRange(currentDateRange.type, currentDateRange.start, currentDateRange.end);
    console.log('[Metrics] Range:', range);
    const { categories, overall } = await computeMetrics(range);
    renderMetricsCards(overall);
    renderCategoryChart(categories);
    renderMetricsTable(categories);
}

/* ─── Event listeners for range buttons and custom picker ──── */
function bindRangeEvents() {
    document.querySelectorAll('[data-range]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = btn.dataset.range;
            currentDateRange.type = type;
            if (type !== 'custom') {
                document.getElementById('customRangeContainer').style.display = 'none';
                refreshMetrics();
            } else {
                document.getElementById('customRangeContainer').style.display = 'flex';
                // Optionally set default values
                const today = new Date().toISOString().slice(0,10);
                document.getElementById('customStartDate').value = today;
                document.getElementById('customEndDate').value = today;
            }
        });
    });

    const applyBtn = document.getElementById('applyCustomRange');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const start = document.getElementById('customStartDate').value;
            const end = document.getElementById('customEndDate').value;
            if (start && end) {
                currentDateRange.type = 'custom';
                currentDateRange.start = start;
                currentDateRange.end = end;
                refreshMetrics();
            } else {
                showToast('لطفاً هر دو تاریخ شروع و پایان را انتخاب کنید', 'warning');            }
        });
    }

    // Export button
    const exportBtn = document.getElementById('exportMetricsBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportMetricsToCSV);
    }
}

/* ─── Export table data as CSV ─────────────────────────────── */
function exportMetricsToCSV() {
    const rows = [];
    // Header
    rows.push(['دسته','تعداد وظایف','تکمیل شده','نرخ تکمیل','زمان ثبت شده (دقیقه)','زمان تخمینی (دقیقه)','میانگین زمان هر وظیفه (دقیقه)']);    // Data rows
    const tbody = document.getElementById('metricsTableBody');
    if (tbody) {
        const trs = tbody.querySelectorAll('tr');
        trs.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            const row = Array.from(tds).map(td => td.innerText.trim());
            rows.push(row);
        });
    }
    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'metrics_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/* ─── Public API ───────────────────────────────────────────── */
function init() {
    bindRangeEvents();
    refreshMetrics();
}

window.MetricsDashboard = { init, refresh: refreshMetrics };