/* ══════════════════════════════════════
   js/tasks.js — Task Management (optimized)
══════════════════════════════════════ */

'use strict';

let _editTaskId = null;
let _taskFilter = 'all';
let _taskSort   = 'dueDate'; // default sort

// Column container IDs (matching HTML)
const COLUMN_CONTAINERS = {
    todo:       'kanbanTasks-todo',
    inprogress: 'kanbanTasks-inprogress',
    done:       'kanbanTasks-done'
};

/* ── Render main task board ── */
async function renderTasks() {
    let tasks = await slpData.getTasks();

    // --- Apply filter ---
    const todayStr = today();
    if (_taskFilter === 'today') {
        tasks = tasks.filter(t => t.dueDate === todayStr);
    } else if (_taskFilter === 'overdue') {
        tasks = tasks.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== 'done');
    } else if (_taskFilter === 'done') {
        tasks = tasks.filter(t => t.status === 'done');
    } // 'all' does nothing

    // --- Apply sort ---
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

    // --- Separate by status and render each column ---
    const tasksByStatus = {
        todo:       tasks.filter(t => (t.status || 'todo') === 'todo'),
        inprogress: tasks.filter(t => t.status === 'inprogress'),
        done:       tasks.filter(t => t.status === 'done')
    };

    // Update column counts
    document.getElementById('colCountTodo')       .textContent = tasksByStatus.todo.length;
    document.getElementById('colCountInprogress').textContent = tasksByStatus.inprogress.length;
    document.getElementById('colCountDone')       .textContent = tasksByStatus.done.length;

    // Render each container
    for (const [status, containerId] of Object.entries(COLUMN_CONTAINERS)) {
        const container = document.getElementById(containerId);
        if (!container) continue;
        container.innerHTML = tasksByStatus[status].map(task => taskCardHTML(task)).join('');
    }

    // Re‑initialise drag & drop if available
    if (window.DragDropManager) {
        DragDropManager.init();
    }
}

/**
 * Generate HTML for a single task card (matches the structure in your HTML)
 */
function taskCardHTML(t) {
    const isOverdue = t.dueDate && t.dueDate < today() && t.status !== 'done';
    const prioColor = {
        high:   'var(--red)',
        medium: 'var(--amber)',
        low:    'var(--green)'
    }[t.priority] || 'var(--accent)';

    // Tags array (if any)
    const tags = (t.tags || []).map(tag => `<span class="task-card-date">#${escHtml(tag)}</span>`).join('');

    return `
    <div class="task-card ${t.status === 'done' ? 'done' : ''}" data-id="${t.id}" draggable="true">
        <div class="task-card-top">
            <span class="task-card-title">${escHtml(t.title)}</span>
            <span class="task-card-prio" style="background:${prioColor}"></span>
        </div>
        <div class="task-card-meta">
            ${t.dueDate ? `
                <span class="task-card-date ${isOverdue ? 'overdue' : ''}">
                    📅 ${t.dueDate}
                </span>
            ` : ''}
            ${tags}
        </div>
        <div class="task-card-actions">
            <button class="task-card-action" onclick="editTask('${t.id}')" title="ویرایش">✎</button>
            <button class="task-card-action" onclick="deleteTaskById('${t.id}')" title="حذف">🗑</button>
        </div>
    </div>
    `;
}

/* ── Filter tabs ── */
document.querySelectorAll('.task-filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        document.querySelectorAll('.task-filter-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        _taskFilter = e.target.dataset.filter;
        renderTasks();
    });
});

/* ── Sort select ── */
const sortSelect = document.getElementById('tasksSortSelect');
if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
        _taskSort = e.target.value;
        renderTasks();
    });
}

/* ── Toggle task completion (from dashboard quick‑done) ── */
window.toggleTask = async function(id) {
    const tasks = await slpData.getTasks();
    const task  = tasks.find(t => t.id === id);
    if (!task) return;
    task.status = task.status === 'done' ? 'todo' : 'done';
    await slpData.saveTask(task);
    renderTasks();
    if (typeof renderDashboard === 'function') renderDashboard();
    showToast(task.status === 'done' ? 'وظیفه انجام شد ✓' : 'وظیفه به لیست بازگشت', 'info');
};

/* ── Open modal for editing ── */
window.editTask = async function(id) {
    const tasks = await slpData.getTasks();
    const task  = tasks.find(t => t.id === id);
    if (!task) return;

    _editTaskId = id;
    document.getElementById('taskModalTitle').textContent = 'ویرایش وظیفه';

    // Fill form fields
    document.getElementById('taskId').value      = task.id || '';
    document.getElementById('taskTitle').value   = task.title || '';
    document.getElementById('taskDesc').value    = task.desc || '';
    document.getElementById('taskDueDate').value = task.dueDate || '';
    document.getElementById('taskStatus').value  = task.status || 'todo';
    document.getElementById('taskPriority').value = task.priority || 'medium';
    document.getElementById('taskTags').value    = (task.tags || []).join(', ');

    // Highlight the correct priority option in the UI
    document.querySelectorAll('.priority-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.val === task.priority);
    });

    // Show delete button
    const deleteBtn = document.getElementById('deleteTaskBtn');
    if (deleteBtn) deleteBtn.style.display = 'inline-flex';

    openModal('taskModal');
};

/* ── Open modal for new task ── */
document.getElementById('addTaskBtn')?.addEventListener('click', () => {
    _editTaskId = null;
    document.getElementById('taskModalTitle').textContent = 'وظیفه جدید';

    // Clear all fields
    document.getElementById('taskId').value = '';
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDesc').value = '';
    document.getElementById('taskDueDate').value = '';
    document.getElementById('taskStatus').value = 'todo';
    document.getElementById('taskPriority').value = 'medium';
    document.getElementById('taskTags').value = '';

    // Reset priority UI to medium selected
    document.querySelectorAll('.priority-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.val === 'medium');
    });

    // Hide delete button
    const deleteBtn = document.getElementById('deleteTaskBtn');
    if (deleteBtn) deleteBtn.style.display = 'none';

    openModal('taskModal');
});

/* ── Save task (new or edit) ── */
document.getElementById('saveTaskBtn')?.addEventListener('click', async () => {
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) {
        showToast('عنوان وظیفه الزامی است', 'error');
        return;
    }

    const task = {
        id:       _editTaskId || uid(),
        title,
        desc:     document.getElementById('taskDesc').value.trim(),
        dueDate:  document.getElementById('taskDueDate').value,
        priority: document.getElementById('taskPriority').value,
        status:   _editTaskId ? undefined : 'todo',
        tags:     document.getElementById('taskTags').value.split(',').map(s => s.trim()).filter(Boolean),
        type:     'other',  // default
        createdAt: _editTaskId ? undefined : new Date().toISOString()
    };

    if (!_editTaskId) {
        task.createdAt = new Date().toISOString();
    }

    await slpData.saveTask(task);
    closeModal('taskModal');

    renderTasks();
    if (typeof renderDashboard === 'function') renderDashboard();

    showToast(_editTaskId ? 'وظیفه ویرایش شد' : 'وظیفه ایجاد شد', 'success');

    // Dispatch event for reminder sync, if needed
    window.dispatchEvent(new CustomEvent('slp:taskSaved', { detail: task }));
});

/* ── Delete task from modal ── */
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

/* ── Delete task by ID (used from card button) ── */
window.deleteTaskById = async function(id) {
    if (!confirm('آیا از حذف این وظیفه اطمینان دارید؟')) return;
    await slpData.deleteTask(id);
    renderTasks();
    if (typeof renderDashboard === 'function') renderDashboard();
    showToast('وظیفه حذف شد', 'info');
    window.dispatchEvent(new CustomEvent('slp:taskDeleted', { detail: { id } }));
};

/* ── Initial render (called by NavManager) ── */
window.renderTasks = renderTasks;