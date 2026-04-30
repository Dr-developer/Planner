'use strict';
/* js/analytics.js — Task Analytics Dashboard with Dynamic Categories */

let currentPage = 1;
const pageSize = 10;
let currentSort = { column: 'dueDate', direction: 'asc' };
let currentFilters = {
    search: '',
    status: 'all',
    priority: 'all',
    category: 'all'
};
let tasksCache = [];
let filteredTasks = [];

// Chart instances
let progressChart, categoryChart, priorityChart;

/* ─── Helper: get category name and emoji ─── */
function getCategoryInfo(categoryId) {
    const cat = CategoryManager.all.find(c => c.id === categoryId);
    return cat ? { name: cat.name, emoji: cat.emoji } : { name: 'سایر', emoji: '📦' };
}

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
            data: { labels: [], datasets: [{ label: 'تعداد وظایف', data: [], backgroundColor: '#6c63ff' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    if (ctxPriority) {
        priorityChart = new Chart(ctxPriority, {
            type: 'bar',
            data: { labels: ['بالا', 'متوسط', 'پایین'], datasets: [{ label: 'تعداد', data: [0,0,0], backgroundColor: ['#ef4444', '#f59e0b', '#22c55e'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

/* ─── Render Analytics Page ─── */
async function renderAnalytics() {
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
    const todayStr = today();
    if (currentFilters.status !== 'all') {
        if (currentFilters.status === 'overdue') {
            filtered = filtered.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== 'done');
        } else {
            filtered = filtered.filter(t => t.status === currentFilters.status);
        }
    }

    // Priority filter
    if (currentFilters.priority !== 'all') {
        filtered = filtered.filter(t => t.priority === currentFilters.priority);
    }

    // Category filter
    if (currentFilters.category !== 'all') {
        filtered = filtered.filter(t => t.categoryId === currentFilters.category);
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

    // --- Category distribution using real categories ---
    const categories = CategoryManager.all; // already loaded
    const categoryCounts = categories.map(cat => tasksCache.filter(t => t.categoryId === cat.id).length);
    // Also include tasks with no categoryId (assign to 'other')
    const otherCount = tasksCache.filter(t => !t.categoryId || !categories.find(c => c.id === t.categoryId)).length;
    const labels = categories.map(cat => `${cat.emoji} ${cat.name}`);
    if (otherCount > 0) {
        labels.push('📦 سایر');
        categoryCounts.push(otherCount);
    }
    if (categoryChart) {
        categoryChart.data.labels = labels;
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

    const total = sorted.length;
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    const pageItems = sorted.slice(start, end);

    document.getElementById('tableStart').textContent = total ? start + 1 : 0;
    document.getElementById('tableEnd').textContent = end;
    document.getElementById('tableTotal').textContent = total;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = end >= total;

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
        const catInfo = getCategoryInfo(task.categoryId);
        const categoryDisplay = `${catInfo.emoji} ${catInfo.name}`;

        // Dropdowns for priority, status, and category
        const priorityOptions = ['high','medium','low'].map(p =>
            `<option value="${p}" ${task.priority === p ? 'selected' : ''}>${getPriorityLabel(p)}</option>`
        ).join('');
        const statusOptions = ['todo','inprogress','done'].map(s =>
            `<option value="${s}" ${task.status === s ? 'selected' : ''}>${getStatusLabel(s)}</option>`
        ).join('');
        const categoryOptions = CategoryManager.all.map(cat =>
            `<option value="${cat.id}" ${task.categoryId === cat.id ? 'selected' : ''}>${cat.emoji} ${cat.name}</option>`
        ).join('') + `<option value="other" ${(task.categoryId && !CategoryManager.all.find(c => c.id === task.categoryId)) ? 'selected' : ''}>📦 سایر</option>`;

        const dueTime = task.reminderTime ? task.reminderTime.split('T')[1]?.slice(0,5) : '';

        return `
        <tr class="${rowClass}" data-id="${task.id}">
            <td contenteditable="true" class="editable" data-field="title">${escHtml(task.title || '')}</td>
            <td>
                <select class="table-select" data-field="categoryId" data-id="${task.id}">
                    ${categoryOptions}
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

    // Attach change listeners
    document.querySelectorAll('.table-select').forEach(select => {
        select.removeEventListener('change', handleSelectChange);
        select.addEventListener('change', handleSelectChange);
    });
    document.querySelectorAll('.editable').forEach(el => {
        el.removeEventListener('blur', handleEditableBlur);
        el.addEventListener('blur', handleEditableBlur);
    });
}

async function handleSelectChange(e) {
    const taskId = e.target.dataset.id;
    const field = e.target.dataset.field;
    const value = e.target.value;
    await updateTaskField(taskId, field, value);
}

async function handleEditableBlur(e) {
    const row = e.target.closest('tr');
    if (!row) return;
    const taskId = row.dataset.id;
    const field = e.target.dataset.field;
    const value = e.target.innerText.trim();
    await updateTaskField(taskId, field, value);
}

async function updateTaskField(taskId, field, value) {
    const tasks = await slpData.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (field === 'dueDate' && value === '') value = null;
    if (field === 'score') {
        const num = parseFloat(value);
        task.score = isNaN(num) ? null : num;
    } else {
        task[field] = value;
    }
    await slpData.saveTask(task);
    renderAnalytics(); // full refresh
}

window.deleteTaskFromAnalytics = async function(id) {
    if (!confirm('آیا از حذف این وظیفه اطمینان دارید؟')) return;
    await slpData.deleteTask(id);
    renderAnalytics();
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderTasks === 'function') renderTasks();
};

function getPriorityLabel(p) {
    const map = { high: 'بالا', medium: 'متوسط', low: 'پایین' };
    return map[p] || 'متوسط';
}

function getStatusLabel(s) {
    const map = { todo: 'در انتظار', inprogress: 'در حال انجام', done: 'انجام شده' };
    return map[s] || s;
}

/* ─── Populate category filter dropdown ─── */
async function populateCategoryFilterUI() {
    const filterSelect = document.getElementById('taskTableTypeFilter');
    if (!filterSelect) return;
    await CategoryManager.load();
    const categories = CategoryManager.all;
    filterSelect.innerHTML = '<option value="all">همه انواع</option>' +
        categories.map(cat => `<option value="${cat.id}">${cat.emoji} ${cat.name}</option>`).join('');
    // Restore selected value if any
    if (currentFilters.category !== 'all') filterSelect.value = currentFilters.category;
}

/* ─── Event Listeners for Filters and Sorting ─── */
function bindEvents() {
    const searchInput = document.getElementById('taskTableSearch');
    searchInput?.addEventListener('input', (e) => {
        currentFilters.search = e.target.value;
        currentPage = 1;
        renderTable();
    });

    const statusFilter = document.getElementById('taskTableStatusFilter');
    statusFilter?.addEventListener('change', (e) => {
        currentFilters.status = e.target.value;
        currentPage = 1;
        renderTable();
    });

    const priorityFilter = document.getElementById('taskTablePriorityFilter');
    priorityFilter?.addEventListener('change', (e) => {
        currentFilters.priority = e.target.value;
        currentPage = 1;
        renderTable();
    });

    const typeFilter = document.getElementById('taskTableTypeFilter');
    typeFilter?.addEventListener('change', (e) => {
        currentFilters.category = e.target.value;
        currentPage = 1;
        renderTable();
    });

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

    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderTable(); }
    });
    document.getElementById('nextPage')?.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredTasks.length / pageSize);
        if (currentPage < totalPages) { currentPage++; renderTable(); }
    });
}

/* ─── Refresh when categories change ─── */
function initCategoryListeners() {
    window.addEventListener('slp:categoriesChanged', () => {
        populateCategoryFilterUI();
        renderAnalytics(); // re‑render charts and table with new categories
    });
}

/* ─── Initialisation ─── */
document.addEventListener('DOMContentLoaded', async () => {
    initCharts();
    bindEvents();
    await populateCategoryFilterUI();
    initCategoryListeners();
});

window.renderAnalytics = renderAnalytics;