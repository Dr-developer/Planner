'use strict';
/* js/drag-drop.js – Works on all columns */

const DragDropManager = {
    init() {
        console.log('[DragDrop] Init');
        this.setupColumnsAsDropZones();
        this.scanAndBind();
        this.setupPageVisibilityRefresh();
        this.observeDOM();
    },

    setupColumnsAsDropZones() {
        // Attach drop handlers directly to each kanban column (the whole column div)
        document.querySelectorAll('.kanban-col').forEach(column => {
            if (column.getAttribute('data-drop-zone-ready')) return;
            column.setAttribute('data-drop-zone-ready', 'true');
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                column.classList.add('drag-over');
            });
            column.addEventListener('dragleave', () => {
                column.classList.remove('drag-over');
            });
            column.addEventListener('drop', this.onDrop.bind(this));
            console.log('[DragDrop] Column drop zone ready:', column.id);
        });
    },

    scanAndBind() {
        document.querySelectorAll('.task-card:not([data-dd-bound])').forEach(card => {
            card.setAttribute('draggable', 'true');
            card.setAttribute('data-dd-bound', 'true');
            card.addEventListener('dragstart', this.onDragStart.bind(this));
            card.addEventListener('dragend', this.onDragEnd.bind(this));
            card.style.cursor = 'grab';
            console.log('[DragDrop] Bound card:', card.dataset.id);
        });
    },

    onDragStart(e) {
        const card = e.target.closest('.task-card');
        if (!card) return false;
        const taskId = card.dataset.id;
        if (!taskId) return false;
        e.dataTransfer.setData('text/plain', taskId);
        e.dataTransfer.effectAllowed = 'move';
        card.style.opacity = '0.5';
        this.draggedTaskId = taskId;
        this.draggedCard = card;
        console.log('[DragDrop] Drag start:', taskId);
    },

    onDragEnd(e) {
        if (this.draggedCard) {
            this.draggedCard.style.opacity = '';
            this.draggedCard = null;
        }
        document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
        console.log('[DragDrop] Drag end');
    },

    async onDrop(e) {
        e.preventDefault();
        const column = e.currentTarget; // the .kanban-col element
        column.classList.remove('drag-over');

        const taskId = e.dataTransfer.getData('text/plain');
        if (!taskId) return;

        const newStatus = column.dataset.status;
        if (!newStatus) return;

        console.log(`[DragDrop] Drop on column ${column.id} -> target status: ${newStatus}`);

        try {
            const tasks = await slpData.getTasks();
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;

            console.log(`[DragDrop] Current status in DB: ${task.status}`);

            if (task.status !== newStatus) {
                task.status = newStatus;
                await slpData.saveTask(task);
                console.log('[DragDrop] Status updated in DB');
                showToast(`وضعیت وظیفه به "${this.getStatusLabel(newStatus)}" تغییر کرد`, 'success');
            } else {
                console.log('[DragDrop] Status already same, but refreshing UI anyway');
            }

            // Force UI refresh
            if (typeof renderTasks === 'function') await renderTasks();
            if (typeof renderDashboard === 'function') renderDashboard();

            // Additional safety: re‑set drop zones (in case they were lost)
            this.setupColumnsAsDropZones();

        } catch (err) {
            console.error('[DragDrop] Error:', err);
            showToast('خطا در تغییر وضعیت', 'error');
        }
    },

    getStatusLabel(status) {
        const map = { todo: 'در انتظار', inprogress: 'در حال انجام', done: 'انجام شده' };
        return map[status] || status;
    },

    setupPageVisibilityRefresh() {
        // When the tasks page becomes visible, re‑setup drop zones and bind cards
        if (typeof NavManager !== 'undefined') {
            const originalNavigate = NavManager.navigateTo;
            NavManager.navigateTo = function(...args) {
                originalNavigate.apply(NavManager, args);
                if (args[0] === 'tasks') {
                    setTimeout(() => {
                        console.log('[DragDrop] Tasks page shown – refreshing drop zones');
                        DragDropManager.setupColumnsAsDropZones();
                        DragDropManager.scanAndBind();
                    }, 100);
                }
            };
        }
    },

    observeDOM() {
        const observer = new MutationObserver(() => {
            this.scanAndBind();
            this.setupColumnsAsDropZones();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        this.observer = observer;
    },

    refresh() {
        this.setupColumnsAsDropZones();
        this.scanAndBind();
    }
};

document.addEventListener('DOMContentLoaded', () => DragDropManager.init());
window.DragDropManager = DragDropManager;