'use strict';
/* js/tasks.js — Task Management with Categories */

let _editTaskId = null;
let _taskFilter = 'all';
let _taskSort   = 'dueDate';
let _taskCategoryFilter = 'all'; // category filter

// Column container IDs
const COLUMN_CONTAINERS = {
    todo:       'kanbanTasks-todo',
    inprogress: 'kanbanTasks-inprogress',
    done:       'kanbanTasks-done'
};

/* ────────────────────────────────────────────────────────────── */
/* 1. Render Kanban Board                                        */
/* ────────────────────────────────────────────────────────────── */
async function renderTasks() {
    let tasks = await slpData.getTasks();

    // --- Category filter ---
    if (_taskCategoryFilter !== 'all') {
        tasks = tasks.filter(t => t.categoryId === _taskCategoryFilter);
    }

    // --- Status / other filters ---
    const todayStr = today();
    if (_taskFilter === 'today') {
        tasks = tasks.filter(t => t.dueDate === todayStr);
    } else if (_taskFilter === 'overdue') {
        tasks = tasks.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== 'done');
    } else if (_taskFilter === 'done') {
        tasks = tasks.filter(t => t.status === 'done');
    }

    // --- Sort ---
    tasks.sort((a, b) => {
        if (_taskSort === 'dueDate') {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.localeCompare(b.dueDate);
        }
        if (_taskSort === 'priority') {
            const prioWeight = { high: 1, medium: 2, low: 3 };
            return (prioWeight[a.priority] || 2) - (prioWeight[b.priority] || 2);
        }
        if (_taskSort === 'created') {
            return (b.createdAt || '').localeCompare(a.createdAt || '');
        }
        return 0;
    });

    // --- Split by status ---
    const tasksByStatus = {
        todo:       tasks.filter(t => (t.status || 'todo') === 'todo'),
        inprogress: tasks.filter(t => t.status === 'inprogress'),
        done:       tasks.filter(t => t.status === 'done')
    };

    // Update column counts
    document.getElementById('colCountTodo')       .textContent = tasksByStatus.todo.length;
    document.getElementById('colCountInprogress').textContent = tasksByStatus.inprogress.length;
    document.getElementById('colCountDone')       .textContent = tasksByStatus.done.length;

    // Render each column
    for (const [status, containerId] of Object.entries(COLUMN_CONTAINERS)) {
        const container = document.getElementById(containerId);
        if (!container) continue;
        container.innerHTML = tasksByStatus[status].map(task => taskCardHTML(task)).join('');
    }

    // Re‑init drag & drop
    if (window.DragDropManager) DragDropManager.refresh();

    // Refresh category filter dropdown (in case categories changed)
    populateCategoryFilter();
}

/* ────────────────────────────────────────────────────────────── */
/* 2. Task Card HTML (includes category emoji)                   */
/* ────────────────────────────────────────────────────────────── */
function taskCardHTML(t) {
    const isOverdue = t.dueDate && t.dueDate < today() && t.status !== 'done';
    const prioColor = {
        high:   'var(--red)',
        medium: 'var(--amber)',
        low:    'var(--green)'
    }[t.priority] || 'var(--accent)';

    // Get category emoji (default 📦)
    let categoryEmoji = '📦';
    if (t.categoryId && CategoryManager.all.length) {
        const cat = CategoryManager.all.find(c => c.id === t.categoryId);
        if (cat) categoryEmoji = cat.emoji;
    }

    const tags = (t.tags || []).map(tag => `<span class="task-card-date">#${escHtml(tag)}</span>`).join('');

    return `
    <div class="task-card ${t.status === 'done' ? 'done' : ''}" data-id="${t.id}" draggable="true">
        <div class="task-card-top">
            <span class="task-card-title">${categoryEmoji} ${escHtml(t.title)}</span>
            <span class="task-card-prio" style="background:${prioColor}"></span>
        </div>
        <div class="task-card-meta">
            ${t.dueDate ? `<span class="task-card-date ${isOverdue ? 'overdue' : ''}">📅 ${t.dueDate}</span>` : ''}
            ${tags}
        </div>
        <div class="task-card-actions">
            <button class="task-card-action" onclick="editTask('${t.id}')" title="ویرایش">✎</button>
            <button class="task-card-action" onclick="deleteTaskById('${t.id}')" title="حذف">🗑</button>
        </div>
    </div>
    `;
}

/* ────────────────────────────────────────────────────────────── */
/* 3. Category Filter Dropdown (populate & event)                */
/* ────────────────────────────────────────────────────────────── */
async function populateCategoryFilter() {
    const select = document.getElementById('taskCategoryFilter');
    if (!select) return;
    await CategoryManager.load(); // ensure fresh list
    const categories = CategoryManager.all;
    select.innerHTML = '<option value="all">همه دسته‌ها</option>' +
        categories.map(cat => `<option value="${cat.id}" ${cat.id === _taskCategoryFilter ? 'selected' : ''}>${cat.emoji} ${cat.name}</option>`).join('');
}

/* ────────────────────────────────────────────────────────────── */
/* 4. Filter & Sort Event Listeners                              */
/* ────────────────────────────────────────────────────────────── */
document.querySelectorAll('.task-filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        document.querySelectorAll('.task-filter-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        _taskFilter = e.target.dataset.filter;
        renderTasks();
    });
});

const sortSelect = document.getElementById('tasksSortSelect');
if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
        _taskSort = e.target.value;
        renderTasks();
    });
}

const categoryFilter = document.getElementById('taskCategoryFilter');
if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
        _taskCategoryFilter = e.target.value;
        renderTasks();
    });
}

// Refresh filter dropdown when categories change (from CategoryManager)
window.addEventListener('slp:categoriesChanged', () => {
    populateCategoryFilter();
    renderTasks(); // re‑apply filter with new categories
});

/* ────────────────────────────────────────────────────────────── */
/* 5. Task Modal – open for edit / new                           */
/* ────────────────────────────────────────────────────────────── */
window.editTask = async function(id) {
    const tasks = await slpData.getTasks();
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    _editTaskId = id;
    document.getElementById('taskModalTitle').textContent = 'ویرایش وظیفه';

    document.getElementById('taskId').value      = task.id || '';
    document.getElementById('taskTitle').value   = task.title || '';
    document.getElementById('taskDesc').value    = task.desc || '';
    document.getElementById('taskDueDate').value = task.dueDate || '';
    document.getElementById('taskStatus').value  = task.status || 'todo';
    document.getElementById('taskPriority').value = task.priority || 'medium';
    document.getElementById('taskTags').value    = (task.tags || []).join(', ');
    document.getElementById('taskLoggedTime').value = task.loggedTime || 0;
    // Fill category dropdown
    await CategoryManager.load();
    const catSelect = document.getElementById('taskCategory');
    if (catSelect) {
        catSelect.innerHTML = '<option value="">-- انتخاب --</option>' +
            CategoryManager.all.map(cat => `<option value="${cat.id}" ${cat.id === task.categoryId ? 'selected' : ''}>${cat.emoji} ${cat.name}</option>`).join('');
    }

    // Highlight priority option
    document.querySelectorAll('.priority-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.val === task.priority);
    });

    const deleteBtn = document.getElementById('deleteTaskBtn');
    if (deleteBtn) deleteBtn.style.display = 'inline-flex';

    openModal('taskModal');
};

document.getElementById('addTaskBtn')?.addEventListener('click', async () => {
    _editTaskId = null;
    document.getElementById('taskModalTitle').textContent = 'وظیفه جدید';

    // Clear fields
    document.getElementById('taskId').value = '';
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDesc').value = '';
    document.getElementById('taskDueDate').value = '';
    document.getElementById('taskStatus').value = 'todo';
    document.getElementById('taskPriority').value = 'medium';
    document.getElementById('taskTags').value = '';

    // Fill category dropdown with default selection 'other'
    await CategoryManager.load();
    const catSelect = document.getElementById('taskCategory');
    if (catSelect) {
        catSelect.innerHTML = '<option value="">-- انتخاب --</option>' +
            CategoryManager.all.map(cat => `<option value="${cat.id}">${cat.emoji} ${cat.name}</option>`).join('');
        catSelect.value = 'other'; // default to 'other' category
    }

    document.querySelectorAll('.priority-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.val === 'medium');
    });

    const deleteBtn = document.getElementById('deleteTaskBtn');
    if (deleteBtn) deleteBtn.style.display = 'none';

    openModal('taskModal');
});

/* ────────────────────────────────────────────────────────────── */
/* 6. Save Task (Create or Edit) – includes categoryId           */
/* ────────────────────────────────────────────────────────────── */
document.getElementById('saveTaskBtn')?.addEventListener('click', async () => {
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) {
        showToast('عنوان وظیفه الزامی است', 'error');
        return;
    }

    const categoryId = document.getElementById('taskCategory').value || 'other';

    const task = {
        id:       _editTaskId || uid(),
        title,
        desc:     document.getElementById('taskDesc').value.trim(),
        dueDate:  document.getElementById('taskDueDate').value,
        priority: document.getElementById('taskPriority').value,
        status:   document.getElementById('taskStatus').value,
        tags:     document.getElementById('taskTags').value.split(',').map(s => s.trim()).filter(Boolean),
        categoryId: categoryId,
    };

    if (!_editTaskId) {
        task.createdAt = new Date().toISOString();
    } else {
        task.updatedAt = new Date().toISOString();
    }

    await slpData.saveTask(task);
    closeModal('taskModal');

    renderTasks();
    if (typeof renderDashboard === 'function') renderDashboard();

    showToast(_editTaskId ? 'وظیفه ویرایش شد' : 'وظیفه ایجاد شد', 'success');
    window.dispatchEvent(new CustomEvent('slp:taskSaved', { detail: task }));
});
/* ────────────────────────────────────────────────────────────── */
/* 6.1. Manual Time  – includes categoryId           */
/* ────────────────────────────────────────────────────────────── */
// Manual time logging
const manualLogBtn = document.getElementById('manualLogBtn');
const manualLogInput = document.getElementById('manualLogMinutes');
if (manualLogBtn) {
    manualLogBtn.addEventListener('click', async () => {
        const taskId = document.getElementById('taskId').value;
        if (!taskId) {
            showToast('وظیفه ذخیره نشده است. ابتدا وظیفه را ذخیره کنید.', 'warning');
            return;
        }
        const minutes = parseInt(manualLogInput.value);
        if (isNaN(minutes) || minutes <= 0) {
            showToast('لطفاً یک عدد مثبت وارد کنید', 'warning');
            return;
        }
        try {
            const tasks = await slpData.getTasks();
            const task = tasks.find(t => t.id === taskId);
            if (!task) {
                showToast('وظیفه یافت نشد', 'error');
                return;
            }
            const oldLogged = task.loggedTime || 0;
            task.loggedTime = oldLogged + minutes;
            await slpData.saveTask(task);
            // Update the loggedTime field in the modal
            const loggedTimeField = document.getElementById('taskLoggedTime');
            if (loggedTimeField) loggedTimeField.value = task.loggedTime;
            showToast(`${minutes} دقیقه به وظیفه اضافه شد (جمع: ${task.loggedTime} دقیقه)`, 'success');
            // Refresh UI in background
            if (typeof renderTasks === 'function') renderTasks();
            if (typeof renderDashboard === 'function') renderDashboard();
            manualLogInput.value = ''; // clear input
        } catch (err) {
            console.error('Manual log error:', err);
            showToast('خطا در ثبت وقت', 'error');
        }
    });
}
/* ────────────────────────────────────────────────────────────── */
/* 7. Delete Functions                                           */
/* ────────────────────────────────────────────────────────────── */
document.getElementById('deleteTaskBtn')?.addEventListener('click', async () => {
    if (!_editTaskId) return;
    if (!confirm('آیا از حذف این وظیفه اطمینان دارید؟')) return;
    await slpData.deleteTask(_editTaskId);
    closeModal('taskModal');
    renderTasks();
    if (typeof renderDashboard === 'function') renderDashboard();
    showToast('وظیفه حذف شد', 'info');
    window.dispatchEvent(new CustomEvent('slp:taskDeleted', { detail: { id: _editTaskId } }));
});

window.deleteTaskById = async function(id) {
    if (!confirm('آیا از حذف این وظیفه اطمینان دارید؟')) return;
    await slpData.deleteTask(id);
    renderTasks();
    if (typeof renderDashboard === 'function') renderDashboard();
    showToast('وظیفه حذف شد', 'info');
    window.dispatchEvent(new CustomEvent('slp:taskDeleted', { detail: { id } }));
};

/* ────────────────────────────────────────────────────────────── */
/* 8. Initial Load & Category Dropdown Population                */
/* ────────────────────────────────────────────────────────────── */
window.renderTasks = renderTasks;

// Initialize category filter after CategoryManager is ready
document.addEventListener('slp:dataReady', async () => {
    await CategoryManager.init();
    await populateCategoryFilter();
    // If tasks page is already visible, render; otherwise NavManager will call it later
    if (document.getElementById('page-tasks') && !document.getElementById('page-tasks').classList.contains('hidden')) {
        renderTasks();
    }
});