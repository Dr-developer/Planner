'use strict';
/* ══════════════════════════════════════
   js/habits.js — Habit Tracker (optimized)
══════════════════════════════════════ */

let _editHabitId = null;

// روزهای هفته (شنبه = 0)
const DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const DAY_LABELS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

/**
 * Returns an array of the last 7 days (including today) in order from oldest to newest.
 * شنبه = start of week.
 */
function getWeekDates() {
    const dates = [];
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = یکشنبه … 6 = شنبه
    // In Iran, week starts on Saturday (6 in JS). We want the last 7 days ending with today.
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
    }
    return dates; // [oldest ... today]
}

/**
 * Calculate current streak based on log (consecutive days up to today).
 */
function calcStreak(log = {}) {
    let streak = 0;
    const d = new Date();
    while (true) {
        const key = d.toISOString().split('T')[0];
        if (log[key]) {
            streak++;
            d.setDate(d.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
}

/**
 * Calculate completion rate (percentage of days with log entries).
 */
function calcCompletionRate(log = {}) {
    const days = Object.keys(log);
    if (!days.length) return 0;
    const done = Object.values(log).filter(Boolean).length;
    return Math.round((done / days.length) * 100);
}

/* ───────── Render habits grid ───────── */
async function renderHabits() {
    const habits = await slpData.getHabits();
    const grid = document.getElementById('habitsGrid');
    if (!grid) return;

    if (!habits.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">◎</div>
                <div class="empty-state-title">عادتی ثبت نشده</div>
                <div class="empty-state-desc">اولین عادت خود را بسازید!</div>
                <button class="btn btn-primary" onclick="openAddHabitModal()">+ افزودن عادت</button>
            </div>
        `;
        return;
    }

    const weekDates = getWeekDates();
    const todayStr = today();

    grid.innerHTML = habits.map(h => habitCardHTML(h, weekDates, todayStr)).join('');
}

/**
 * Generate HTML for a single habit card.
 * Uses CSS classes from your stylesheet.
 */
function habitCardHTML(h, weekDates, todayStr) {
    const log = h.log || {};
    const streak = calcStreak(log);
    const rate = calcCompletionRate(log);
    const color = h.color || '#6c63ff';
    const todayDone = log[todayStr];

    // Week dots
    const dots = weekDates.map((date, i) => {
        const done = log[date];
        const dayName = DAYS[i];
        return `<div class="habit-day-dot ${done ? 'done' : ''}" 
                     style="background: ${done ? color : ''}" 
                     title="${DAY_LABELS[i]}"
                     onclick="toggleHabitDay('${h.id}', '${date}')"></div>`;
    }).join('');

    // Category label (map value to display text)
    const categoryMap = {
        health: 'سلامتی',
        fitness: 'ورزش',
        learning: 'یادگیری',
        work: 'کار',
        finance: 'مالی',
        social: 'اجتماعی',
        other: 'سایر'
    };
    const categoryText = categoryMap[h.category] || h.category || 'سایر';

    // Toggle button text/class
    const toggleBtnClass = todayDone ? 'done' : 'undone';
    const toggleBtnText = todayDone ? '✓ انجام شد' : '○ ثبت برای امروز';

    return `
        <div class="habit-card" data-id="${h.id}">
            <div class="habit-card-top">
                <div class="habit-color-dot" style="background: ${color};"></div>
                <div class="habit-title">${escHtml(h.title)}</div>
                <div class="habit-category">${categoryText}</div>
            </div>
            <div class="habit-streak">
                <div class="habit-streak-num">${streak}</div>
                <div class="habit-streak-label">روز</div>
            </div>
            <div class="habit-week-track">
                ${dots}
            </div>
            <div class="habit-card-footer">
                <button class="habit-toggle-btn ${toggleBtnClass}" 
                        onclick="toggleHabitDay('${h.id}', '${todayStr}')"
                        style="${!todayDone ? `color: ${color}; border-color: ${color};` : ''}">
                    ${toggleBtnText}
                </button>
            </div>
        </div>
    `;
}

/* ───────── Toggle habit completion for a specific date ───────── */
window.toggleHabitDay = async function(id, date) {
    const habits = await slpData.getHabits();
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    habit.log = habit.log || {};
    habit.log[date] = !habit.log[date];
    habit.streak = calcStreak(habit.log);

    await slpData.saveHabit(habit);
    renderHabits();
    if (typeof renderDashboard === 'function') renderDashboard();

    const isToday = date === today();
    if (habit.log[date] && isToday) {
        showToast(`"${habit.title}" ثبت شد! 🔥`, 'success');
    }
    window.dispatchEvent(new CustomEvent('slp:habitSaved', { detail: habit }));
};

/* ───────── Open modal for adding a new habit ───────── */
function openAddHabitModal() {
    _editHabitId = null;
    // Reset form fields
    document.getElementById('habitId').value = '';
    document.getElementById('habitTitle').value = '';
    document.getElementById('habitCategory').value = 'health';
    document.getElementById('habitFrequency').value = 'daily';
    document.getElementById('habitColor').value = '#6c63ff';
    // Reset color swatch selection (the first one is selected by default in HTML)
    document.querySelectorAll('#habitColorPicker .color-swatch').forEach((swatch, index) => {
        swatch.classList.toggle('selected', index === 0);
    });
    document.getElementById('habitReminderTime').value = '';
    // Hide delete button
    const deleteBtn = document.getElementById('deleteHabitBtn');
    if (deleteBtn) deleteBtn.style.display = 'none';
    // Update modal title
    document.getElementById('habitModalTitle').textContent = 'عادت جدید';
    openModal('habitModal');
}

/* ───────── Open modal for editing an existing habit ───────── */
window.editHabit = async function(id) {
    const habits = await slpData.getHabits();
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    _editHabitId = id;
    document.getElementById('habitId').value = habit.id || '';
    document.getElementById('habitTitle').value = habit.title || '';
    document.getElementById('habitCategory').value = habit.category || 'health';
    document.getElementById('habitFrequency').value = habit.frequency || 'daily';
    document.getElementById('habitColor').value = habit.color || '#6c63ff';
    // Highlight the correct color swatch
    document.querySelectorAll('#habitColorPicker .color-swatch').forEach(swatch => {
        swatch.classList.toggle('selected', swatch.dataset.color === habit.color);
    });
    document.getElementById('habitReminderTime').value = habit.reminderTime || '';
    // Show delete button
    const deleteBtn = document.getElementById('deleteHabitBtn');
    if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    document.getElementById('habitModalTitle').textContent = 'ویرایش عادت';
    openModal('habitModal');
};

/* ───────── Delete habit by ID (used from card button) ───────── */
window.deleteHabitById = async function(id) {
    if (!confirm('آیا از حذف این عادت مطمئن هستید؟')) return;
    await slpData.deleteHabit(id);
    renderHabits();
    if (typeof renderDashboard === 'function') renderDashboard();
    showToast('عادت حذف شد', 'info');
    window.dispatchEvent(new CustomEvent('slp:habitDeleted', { detail: { id } }));
};

/* ───────── Save habit (add or edit) from modal ───────── */
document.getElementById('saveHabitBtn')?.addEventListener('click', async () => {
    const title = document.getElementById('habitTitle').value.trim();
    if (!title) {
        showToast('عنوان عادت الزامی است', 'error');
        return;
    }

    const habit = {
        id:           _editHabitId || uid(),
        title,
        category:     document.getElementById('habitCategory').value,
        frequency:    document.getElementById('habitFrequency').value, // 'daily' or 'weekly'
        color:        document.getElementById('habitColor').value,
        reminderTime: document.getElementById('habitReminderTime').value,
        log:          {},   // will be merged with existing if editing
        streak:       0,
        createdAt:    new Date().toISOString()
    };

    if (_editHabitId) {
        // Preserve existing log and streak
        const existing = await slpData.getHabits().then(all => all.find(h => h.id === _editHabitId));
        if (existing) {
            habit.log = existing.log || {};
            habit.streak = existing.streak || 0;
            habit.createdAt = existing.createdAt;
        }
    }

    await slpData.saveHabit(habit);
    closeModal('habitModal');
    renderHabits();
    if (typeof renderDashboard === 'function') renderDashboard();
    showToast(_editHabitId ? 'عادت ویرایش شد' : 'عادت جدید ایجاد شد', 'success');
    window.dispatchEvent(new CustomEvent('slp:habitSaved', { detail: habit }));
});

/* ───────── Delete habit from modal ───────── */
document.getElementById('deleteHabitBtn')?.addEventListener('click', async () => {
    if (!_editHabitId) return;
    if (!confirm('آیا از حذف این عادت مطمئن هستید؟')) return;
    await slpData.deleteHabit(_editHabitId);
    closeModal('habitModal');
    renderHabits();
    if (typeof renderDashboard === 'function') renderDashboard();
    showToast('عادت حذف شد', 'info');
});

/* ───────── Attach event listeners for "Add Habit" buttons ───────── */
// The main "عادت جدید" button in the page header
document.querySelector('#page-habits .btn-primary')?.addEventListener('click', (e) => {
    e.preventDefault();
    openAddHabitModal();
});

// Also handle the button inside the empty state (if it exists)
document.addEventListener('click', (e) => {
    const target = e.target;
    if (target.matches('.empty-state .btn-primary') && target.closest('#page-habits')) {
        openAddHabitModal();
    }
});

/* ───────── Expose render function for navigation ───────── */
window.renderHabits = renderHabits;