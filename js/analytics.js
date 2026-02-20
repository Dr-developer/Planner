'use strict';
/* ══════════════════════════════════════
   js/analytics.js — Task Analytics Dashboard
══════════════════════════════════════ */

let currentPage = 1;
const pageSize = 10;
let currentSort = { column: 'dueDate', direction: 'asc' };
let currentFilters = {
    search: '',
    status: 'all',
    priority: 'all',
    type: 'all'
};
let tasksCache = []; // holds all tasks after initial load
let filteredTasks = [];

// Chart instances
let progressChart, categoryChart, priorityChart;

/* ─── Initialize Charts ─── */
function initCharts() {
    const ctxProgress = document.getElementById('progressChart')?.getContext('2d');
    const ctxCategory = document.getElementById('categoryChart')?.getContext('2d');
    const ctxPriority = document.getElementById('priorityChart')?.getContext('2d');

    if (ctxProgress) {
        progressChart = new Chart(ctxProgress, {
            type: 'doughnut',
            data: { labels: ['انجام شده', 'مانده'], datasets: [{ data: [0, 100], backgroundColor: ['#22c55e', '#eeeef5'] }] },
            options: { cutout: '70%', plugins: { legend: { display: false } } }
        });
    }

    if (ctxCategory) {
        categoryChart = new Chart(ctxCategory, {
            type: 'bar',
            data: {
                labels: ['تکلیف درسی', 'پروژه', 'آزمون', 'شخصی', 'پژوهش', 'سایر'],
                datasets: [{
                    label: 'تعداد وظایف',
                    data: [0,0,0,0,0,0],
                    backgroundColor: '#6c63ff'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    if (ctxPriority) {
        priorityChart = new Chart(ctxPriority, {
            type: 'bar',
            data: {
                labels: ['بالا', 'متوسط', 'پایین'],
                datasets: [{
                    label: 'تعداد',
                    data: [0,0,0],
                    backgroundColor: ['#ef4444', '#f59e0b', '#22c55e']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

/* ─── Render Analytics Page ─── */
async function renderAnalytics() {
    // Fetch tasks
    tasksCache = await slpData.getTasks();
    applyFilters();
    renderStats();
    renderCharts();
    renderTable();
}

function applyFilters() {
    let filtered = tasksCache.slice();

    // Search
    if (currentFilters.search) {
        const q = currentFilters.search.toLowerCase();
        filtered = filtered.filter(t => t.title?.toLowerCase().includes(q) || t.desc?.toLowerCase().includes(q));
    }

    // Status filter
    if (currentFilters.status !== 'all') {
        if (currentFilters.status === 'overdue') {
            const todayStr = today();
            filtered = filtered.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== 'done');
        } else {
            filtered = filtered.filter(t => t.status === currentFilters.status);
        }
    }

    // Priority filter
    if (currentFilters.priority !== 'all') {
        filtered = filtered.filter(t => t.priority === currentFilters.priority);
    }

    // Type filter (using task.type, which may not exist yet; we'll add it)
    if (currentFilters.type !== 'all') {
        filtered = filtered.filter(t => t.type === currentFilters.type);
    }

    filteredTasks = filtered;
}

function renderStats() {
    const total = tasksCache.length;
    const completed = tasksCache.filter(t => t.status === 'done').length;
    const incomplete = total - completed;
    const todayStr = today();
    const dueToday = tasksCache.filter(t => t.dueDate === todayStr && t.status !== 'done').length;

    document.getElementById('totalTasksCount').textContent = total;
    document.getElementById('completedTasksCount').textContent = completed;
    document.getElementById('incompleteTasksCount').textContent = incomplete;
    document.getElementById('dueTodayCount').textContent = dueToday;

    // Update card colors if needed (already have classes)
}

function renderCharts() {
    const total = tasksCache.length;
    const completed = tasksCache.filter(t => t.status === 'done').length;
    const remaining = total - completed;

    if (progressChart) {
        progressChart.data.datasets[0].data = [completed, remaining];
        progressChart.update();
        document.getElementById('progressPercent').textContent = total ? Math.round((completed/total)*100) + '%' : '0%';
    }

    // Category counts (we need a 'type' field on tasks; if not present, default to 'other')
    const categories = ['coursework', 'project', 'exam', 'personal', 'research', 'other'];
    const categoryCounts = categories.map(cat => tasksCache.filter(t => (t.type || 'other') === cat).length);
    if (categoryChart) {
        categoryChart.data.datasets[0].data = categoryCounts;
        categoryChart.update();
    }

    // Priority counts
    const priorityCounts = [
        tasksCache.filter(t => t.priority === 'high').length,
        tasksCache.filter(t => t.priority === 'medium').length,
        tasksCache.filter(t => t.priority === 'low' || !t.priority).length
    ];
    if (priorityChart) {
        priorityChart.data.datasets[0].data = priorityCounts;
        priorityChart.update();
    }
}

function renderTable() {
    // Sort
    const { column, direction } = currentSort;
    const sorted = [...filteredTasks].sort((a, b) => {
        let aVal = a[column] || '';
        let bVal = b[column] || '';
        if (column === 'dueDate') {
            aVal = a.dueDate || '9999-12-31';
            bVal = b.dueDate || '9999-12-31';
        }
        if (column === 'daysRemaining') {
            const todayStr = today();
            const aDays = a.dueDate ? Math.floor((new Date(a.dueDate) - new Date(todayStr)) / (1000*60*60*24)) : 999;
            const bDays = b.dueDate ? Math.floor((new Date(b.dueDate) - new Date(todayStr)) / (1000*60*60*24)) : 999;
            aVal = aDays;
            bVal = bDays;
        }
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Paginate
    const total = sorted.length;
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    const pageItems = sorted.slice(start, end);

    // Update pagination info
    document.getElementById('tableStart').textContent = total ? start + 1 : 0;
    document.getElementById('tableEnd').textContent = end;
    document.getElementById('tableTotal').textContent = total;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = end >= total;

    // Generate table rows
    const tbody = document.getElementById('taskTableBody');
    if (!tbody) return;

    if (pageItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center" style="padding:40px;">هیچ وظیفه‌ای یافت نشد</td></tr>';
        return;
    }

    const todayStr = today();
    const rows = pageItems.map(task => {
        const daysRemaining = task.dueDate ? Math.floor((new Date(task.dueDate) - new Date(todayStr)) / (1000*60*60*24)) : null;
        const isOverdue = task.dueDate && task.dueDate < todayStr && task.status !== 'done';
        const rowClass = isOverdue ? 'overdue-row' : '';

        // Build dropdowns for type, priority, status
        const typeOptions = ['coursework','project','exam','personal','research','other'].map(t =>
            `<option value="${t}" ${(task.type || 'other') === t ? 'selected' : ''}>${getTypeLabel(t)}</option>`
        ).join('');

        const priorityOptions = ['high','medium','low'].map(p =>
            `<option value="${p}" ${task.priority === p ? 'selected' : ''}>${getPriorityLabel(p)}</option>`
        ).join('');

        const statusOptions = ['todo','inprogress','done'].map(s =>
            `<option value="${s}" ${task.status === s ? 'selected' : ''}>${getStatusLabel(s)}</option>`
        ).join('');

        // Due time (if exists)
        const dueTime = task.reminderTime ? task.reminderTime.split('T')[1]?.slice(0,5) : '';

        return `
        <tr class="${rowClass}" data-id="${task.id}">
            <td contenteditable="true" class="editable" data-field="title">${escHtml(task.title || '')}</td>
            <td>
                <select class="table-select" data-field="type" data-id="${task.id}">
                    ${typeOptions}
                </select>
            </td>
            <td contenteditable="true" class="editable" data-field="desc">${escHtml(task.desc || '')}</td>
            <td>
                <select class="table-select" data-field="priority" data-id="${task.id}">
                    ${priorityOptions}
                </select>
            </td>
            <td>
                <select class="table-select" data-field="status" data-id="${task.id}">
                    ${statusOptions}
                </select>
            </td>
            <td contenteditable="true" class="editable" data-field="dueDate">${task.dueDate || ''}</td>
            <td contenteditable="true" class="editable" data-field="reminderTime">${dueTime}</td>
            <td>${daysRemaining !== null ? daysRemaining : '—'}</td>
            <td contenteditable="true" class="editable" data-field="score">${task.score || ''}</td>
            <td>
                <button class="btn-icon btn-ghost" onclick="deleteTaskFromAnalytics('${task.id}')" title="حذف">🗑</button>
            </td>
        </tr>`;
    }).join('');

    tbody.innerHTML = rows;

    // Attach change listeners to selects
    document.querySelectorAll('.table-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const taskId = e.target.dataset.id;
            const field = e.target.dataset.field;
            const value = e.target.value;
            await updateTaskField(taskId, field, value);
        });
    });

    // Attach blur listeners to contenteditable fields
    document.querySelectorAll('.editable').forEach(el => {
        el.addEventListener('blur', async (e) => {
            const row = e.target.closest('tr');
            if (!row) return;
            const taskId = row.dataset.id;
            const field = e.target.dataset.field;
            const value = e.target.innerText.trim();
            await updateTaskField(taskId, field, value);
        });
    });
}

async function updateTaskField(taskId, field, value) {
    const tasks = await slpData.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Convert value types as needed
    if (field === 'dueDate' && value === '') value = null;
    if (field === 'reminderTime') {
        // If value is just time, combine with dueDate?
        // For simplicity, we'll just store as full datetime if possible.
        // We'll leave it as reminderTime (string). In the modal, it's datetime-local.
        // The table only shows time part, but we need full ISO? We'll store as time string.
        // To be safe, we'll keep as is.
    }
    if (field === 'score') {
        const num = parseFloat(value);
        task.score = isNaN(num) ? null : num;
    } else {
        task[field] = value;
    }

    await slpData.saveTask(task);

    // If status changed to done, maybe update completion stats
    if (field === 'status') {
        renderAnalytics(); // full refresh to update all stats
    } else {
        // Partial refresh: update only table and maybe charts/stats
        // For simplicity, full refresh
        renderAnalytics();
    }
}

window.deleteTaskFromAnalytics = async function(id) {
    if (!confirm('آیا از حذف این وظیفه اطمینان دارید؟')) return;
    await slpData.deleteTask(id);
    renderAnalytics();
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderTasks === 'function') renderTasks();
};

/* ─── Helper label functions ─── */
function getTypeLabel(type) {
    const map = {
        coursework: 'تکلیف درسی',
        project: 'پروژه',
        exam: 'آزمون',
        personal: 'شخصی',
        research: 'پژوهش',
        other: 'سایر'
    };
    return map[type] || 'سایر';
}

function getPriorityLabel(prio) {
    const map = { high: 'بالا', medium: 'متوسط', low: 'پایین' };
    return map[prio] || 'متوسط';
}

function getStatusLabel(status) {
    const map = { todo: 'در انتظار', inprogress: 'در حال انجام', done: 'انجام شده' };
    return map[status] || status;
}

/* ─── Event Listeners for Filters and Sorting ─── */
function bindEvents() {
    // Search input
    const searchInput = document.getElementById('taskTableSearch');
    searchInput?.addEventListener('input', (e) => {
        currentFilters.search = e.target.value;
        currentPage = 1;
        renderTable();
    });

    // Status filter
    const statusFilter = document.getElementById('taskTableStatusFilter');
    statusFilter?.addEventListener('change', (e) => {
        currentFilters.status = e.target.value;
        currentPage = 1;
        renderTable();
    });

    // Priority filter
    const priorityFilter = document.getElementById('taskTablePriorityFilter');
    priorityFilter?.addEventListener('change', (e) => {
        currentFilters.priority = e.target.value;
        currentPage = 1;
        renderTable();
    });

    // Type filter
    const typeFilter = document.getElementById('taskTableTypeFilter');
    typeFilter?.addEventListener('change', (e) => {
        currentFilters.type = e.target.value;
        currentPage = 1;
        renderTable();
    });

    // Sorting on table headers
    document.querySelectorAll('#taskAnalyticsTable th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'asc';
            }
            renderTable();
        });
    });

    // Pagination buttons
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    document.getElementById('nextPage')?.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredTasks.length / pageSize);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });
}

/* ─── Initialisation ─── */
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    bindEvents();
});

window.renderAnalytics = renderAnalytics;