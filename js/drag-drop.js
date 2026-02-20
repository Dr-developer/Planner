'use strict';
/* ══════════════════════════════════════
   js/drag-drop.js — Drag & Drop Manager
   (optimized for SLP)
══════════════════════════════════════ */

class DragDropManager {
    constructor() {
        this.dragSrc = null;               // currently dragged element
        this.dragSrcContainer = null;       // original parent
        this.dragClone = null;              // ghost element
        this.touchOffsetX = 0;
        this.touchOffsetY = 0;
        this.isDragging = false;
        this.isTouch = false;
        this.placeholder = null;            // visual placeholder
        this.scrollInterval = null;
        this.dropZones = new Set();          // set of drop zone elements
        this.scrollContainer = null;         // nearest scrollable ancestor

        this._onDragStart = this._onDragStart.bind(this);
        this._onDragMove  = this._onDragMove.bind(this);
        this._onDragEnd   = this._onDragEnd.bind(this);
        this._onTouchStart = this._onTouchStart.bind(this);
        this._onTouchMove  = this._onTouchMove.bind(this);
        this._onTouchEnd   = this._onTouchEnd.bind(this);

        this.init();
    }

    init() {
        this._createPlaceholder();
        this._setupGlobalListeners();
        this._scanAndBind();                // initial bind
        this._observeDOM();                  // watch for new elements
    }

    _createPlaceholder() {
        this.placeholder = document.createElement('div');
        this.placeholder.className = 'dd-placeholder';
        this.placeholder.style.cssText = `
            background: var(--border);
            border-radius: var(--radius-md);
            margin: 4px 0;
            transition: height 0.1s;
        `;
    }

    _setupGlobalListeners() {
        document.addEventListener('mousemove', this._onDragMove, { passive: false });
        document.addEventListener('mouseup', this._onDragEnd);
        document.addEventListener('touchmove', this._onTouchMove, { passive: false });
        document.addEventListener('touchend', this._onTouchEnd);
        document.addEventListener('touchcancel', this._onTouchEnd);
    }

    _observeDOM() {
        const observer = new MutationObserver(() => this._scanAndBind());
        observer.observe(document.body, { childList: true, subtree: true });
        this.observer = observer;
    }

    _scanAndBind() {
        // Bind task cards – make them draggable
        document.querySelectorAll('.task-card:not([data-dd-bound])').forEach(el => {
            this._bindDraggable(el, 'task');
        });

        // Bind transaction items
        document.querySelectorAll('.transaction-item:not([data-dd-bound])').forEach(el => {
            this._bindDraggable(el, 'transaction');
        });

        // Register task drop zones – the containers inside kanban columns
        document.querySelectorAll('.kanban-tasks:not([data-dd-zone])').forEach(el => {
            this._registerDropZone(el, 'tasks');
        });

        // Register transaction drop zone
        const transList = document.getElementById('transactionsList');
        if (transList && !transList.hasAttribute('data-dd-zone')) {
            this._registerDropZone(transList, 'transactions');
        }
    }

    _bindDraggable(el, type) {
        el.setAttribute('data-dd-bound', '1');
        el.setAttribute('data-dd-type', type);
        el.setAttribute('draggable', 'false'); // we handle drag manually
        el.classList.add('dd-draggable');
        el.style.cursor = 'grab';

        // Mouse down – start drag if not on interactive element
        el.addEventListener('mousedown', this._onDragStart);
        // Touch start
        el.addEventListener('touchstart', this._onTouchStart, { passive: false });
    }

    _registerDropZone(el, type) {
        el.setAttribute('data-dd-zone', type);
        this.dropZones.add(el);
    }

    // ─── DRAG START ─────────────────────────────────────────────────
    _onDragStart(e) {
        // Only start drag if not on a button, input, or other interactive element
        const target = e.target;
        const isInteractive = target.matches('button, input, select, textarea, a, [contenteditable], .task-card-action, .transaction-delete, .btn');
        if (isInteractive) return;

        const el = e.currentTarget;
        const type = el.dataset.ddType;
        if (!type) return;

        e.preventDefault();
        this._startDrag(e.clientX, e.clientY, el, type);
    }

    _onTouchStart(e) {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const target = e.target;
        const isInteractive = target.matches('button, input, select, textarea, a, [contenteditable], .task-card-action, .transaction-delete, .btn');
        if (isInteractive) return;

        const el = e.currentTarget;
        const type = el.dataset.ddType;
        if (!type) return;

        e.preventDefault();
        this.isTouch = true;
        this._startDrag(touch.clientX, touch.clientY, el, type);
    }

    _startDrag(clientX, clientY, el, type) {
        if (this.isDragging) return;
        this.isDragging = true;

        this.dragSrc = el;
        this.dragSrcContainer = el.parentElement;

        // Find nearest scrollable container (for auto‑scroll)
        this.scrollContainer = this._getScrollableParent(el);

        const rect = el.getBoundingClientRect();
        this.touchOffsetX = clientX - rect.left;
        this.touchOffsetY = clientY - rect.top;

        // Create ghost clone
        this.dragClone = el.cloneNode(true);
        this.dragClone.classList.add('dd-ghost');
        this.dragClone.style.cssText = `
            position: fixed;
            top: ${rect.top}px;
            left: ${rect.left}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            opacity: 0.8;
            transform: rotate(2deg) scale(1.02);
            pointer-events: none;
            z-index: 99999;
            background: var(--bg-card);
            box-shadow: var(--shadow-lg);
            border-radius: var(--radius-md);
            transition: none;
        `;
        document.body.appendChild(this.dragClone);

        // Mark source as dragging
        el.classList.add('dd-source');

        // Insert placeholder
        this.placeholder.style.height = `${rect.height}px`;
        el.parentElement.insertBefore(this.placeholder, el.nextSibling);

        document.body.classList.add('dd-dragging');
        this._emit('dragstart', { el, type, clientX, clientY });
    }

    // ─── DRAG MOVE ─────────────────────────────────────────────────
    _onDragMove(e) {
        if (!this.isDragging || this.isTouch) return;
        e.preventDefault();
        this._moveDrag(e.clientX, e.clientY);
    }

    _onTouchMove(e) {
        if (!this.isDragging || !this.isTouch) return;
        e.preventDefault();
        const touch = e.touches[0];
        this._moveDrag(touch.clientX, touch.clientY);
    }

    _moveDrag(clientX, clientY) {
        if (!this.dragClone || !this.dragSrc) return;

        // Move ghost
        this.dragClone.style.left = `${clientX - this.touchOffsetX}px`;
        this.dragClone.style.top = `${clientY - this.touchOffsetY}px`;

        // Auto‑scroll
        this._autoScroll(clientY);

        // Find drop zone
        this.dragClone.style.display = 'none';
        const elBelow = document.elementFromPoint(clientX, clientY);
        this.dragClone.style.display = '';

        if (!elBelow) return;

        const dropZone = this._findDropZone(elBelow);
        if (!dropZone) return;

        this._highlightDropZone(dropZone);

        // Find sibling (element after which to insert placeholder)
        const sibling = this._findSibling(dropZone, clientY);
        if (sibling === this.dragSrc || sibling === this.placeholder) return;

        if (sibling) {
            dropZone.insertBefore(this.placeholder, sibling);
        } else {
            dropZone.appendChild(this.placeholder);
        }
    }

    // ─── DRAG END ─────────────────────────────────────────────────
    _onDragEnd(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        this._endDrag(e.clientX, e.clientY);
    }

    _onTouchEnd(e) {
        if (!this.isDragging || !this.isTouch) return;
        e.preventDefault();
        const touch = e.changedTouches[0];
        this._endDrag(touch.clientX, touch.clientY);
        this.isTouch = false;
    }

    async _endDrag(clientX, clientY) {
        if (!this.dragSrc) return;

        const type = this.dragSrc.dataset.ddType;
        const dropZone = this.placeholder.parentElement;

        // Remove ghost
        if (this.dragClone) {
            this.dragClone.remove();
            this.dragClone = null;
        }

        this.dragSrc.classList.remove('dd-source');
        document.body.classList.remove('dd-dragging');
        this._clearDropZoneHighlights();

        // Stop auto‑scroll
        clearInterval(this.scrollInterval);
        this.scrollInterval = null;

        // If dropped in a valid zone
        if (dropZone && dropZone.hasAttribute('data-dd-zone')) {
            const zoneType = dropZone.dataset.ddZone;

            if (zoneType === 'tasks' && type === 'task') {
                // Moving task between columns → change status
                const newStatus = dropZone.closest('.kanban-col')?.dataset.status;
                if (newStatus) {
                    const taskId = this.dragSrc.dataset.id;
                    if (taskId) {
                        await this._updateTaskStatus(taskId, newStatus);
                    }
                }
                // If dropped in same column, we do nothing (no reorder)
            } else if (zoneType === 'transactions' && type === 'transaction') {
                // Reorder transactions within the list
                await this._reorderTransactions(dropZone);
            }

            // Move the actual element to the new position
            dropZone.insertBefore(this.dragSrc, this.placeholder);
        } else {
            // Dropped outside – return to original position
            this.dragSrcContainer.insertBefore(this.dragSrc, this.placeholder);
        }

        // Remove placeholder
        this.placeholder.remove();

        this._emit('dragend', { el: this.dragSrc, dropZone, type });

        this.dragSrc = null;
        this.dragSrcContainer = null;
        this.isDragging = false;
    }

    // ─── DROP HELPERS ──────────────────────────────────────────────
    _findDropZone(el) {
        while (el && el !== document.body) {
            if (el.hasAttribute('data-dd-zone')) return el;
            el = el.parentElement;
        }
        return null;
    }

    _findSibling(container, clientY) {
        const items = [...container.querySelectorAll('.dd-draggable:not(.dd-source)')];
        for (let item of items) {
            const rect = item.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            if (clientY < mid) return item;
        }
        return null;
    }

    _highlightDropZone(zone) {
        document.querySelectorAll('.dd-drop-active').forEach(z => z.classList.remove('dd-drop-active'));
        zone.classList.add('dd-drop-active');
    }

    _clearDropZoneHighlights() {
        document.querySelectorAll('.dd-drop-active').forEach(z => z.classList.remove('dd-drop-active'));
    }

    // ─── PERSISTENCE (using slpData) ───────────────────────────────
    async _updateTaskStatus(taskId, newStatus) {
        try {
            const tasks = await slpData.getTasks();
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;

            task.status = newStatus;
            await slpData.saveTask(task);

            // Refresh UI
            if (typeof renderTasks === 'function') renderTasks();
            if (typeof renderDashboard === 'function') renderDashboard();

            showToast('وضعیت وظیفه به‌روز شد', 'success');
            this._emit('taskStatusChanged', { taskId, newStatus });
        } catch (err) {
            console.error('Failed to update task status:', err);
            showToast('خطا در تغییر وضعیت', 'error');
        }
    }

    async _reorderTransactions(container) {
        const items = [...container.querySelectorAll('.transaction-item')];
        const ids = items.map(el => el.dataset.id).filter(Boolean);
        if (ids.length === 0) return;

        try {
            const transactions = await slpData.getTransactions();
            // Create a map for quick lookup
            const transMap = new Map(transactions.map(t => [t.id, t]));

            // Assign a new position field (0‑based) based on current order
            ids.forEach((id, index) => {
                const t = transMap.get(id);
                if (t) t.position = index;
            });

            // Save all updated transactions (bulk put)
            await slpData.bulkPut('transactions', Array.from(transMap.values()));

            if (typeof renderFinance === 'function') renderFinance();
            showToast('ترتیب تراکنش‌ها ذخیره شد', 'info');
            this._emit('transactionsReordered', { ids });
        } catch (err) {
            console.error('Failed to reorder transactions:', err);
            showToast('خطا در ذخیره ترتیب', 'error');
        }
    }

    // ─── AUTO SCROLL (inside the scrollable container) ─────────────
    _autoScroll(clientY) {
        if (!this.scrollContainer) return;

        const rect = this.scrollContainer.getBoundingClientRect();
        const threshold = 50;
        const speed = 8;

        clearInterval(this.scrollInterval);

        if (clientY < rect.top + threshold) {
            // Scroll up
            this.scrollInterval = setInterval(() => {
                this.scrollContainer.scrollTop -= speed;
            }, 16);
        } else if (clientY > rect.bottom - threshold) {
            // Scroll down
            this.scrollInterval = setInterval(() => {
                this.scrollContainer.scrollTop += speed;
            }, 16);
        }
    }

    // ─── UTILS ─────────────────────────────────────────────────────
    _getScrollableParent(el) {
        // Find the closest ancestor with overflow-y auto/scroll
        while (el && el !== document.body) {
            const style = window.getComputedStyle(el);
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                return el;
            }
            el = el.parentElement;
        }
        // Fallback to the main content area
        return document.querySelector('.page-content') || window;
    }

    _emit(eventName, detail) {
        document.dispatchEvent(new CustomEvent(`dd:${eventName}`, { detail, bubbles: true }));
    }

    // ─── PUBLIC API ────────────────────────────────────────────────
    refresh() {
        this._scanAndBind();
    }

    destroy() {
        document.removeEventListener('mousemove', this._onDragMove);
        document.removeEventListener('mouseup', this._onDragEnd);
        document.removeEventListener('touchmove', this._onTouchMove);
        document.removeEventListener('touchend', this._onTouchEnd);
        document.removeEventListener('touchcancel', this._onTouchEnd);
        if (this.observer) this.observer.disconnect();
        this.dragClone?.remove();
        this.placeholder?.remove();
        clearInterval(this.scrollInterval);
    }
}

// ─── AUTO‑INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    window.dragDrop = new DragDropManager();

    // Optional: listen to reorder events for additional refreshes
    document.addEventListener('dd:taskStatusChanged', () => {
        // Already handled in _updateTaskStatus, but you could add extra logic
    });
});