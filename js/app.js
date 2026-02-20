'use strict';
/* ══════════════════════════════════════
   js/app.js — Smart Life Planner Core (optimized)
   هسته اصلی اپلیکیشن، ناوبری، Utility‌ها
══════════════════════════════════════ */

/* ─────────────────────────────────────
   ۱. UTILITIES
───────────────────────────────────── */

/** تولید UUID ساده */
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** تاریخ امروز به فرمت ISO (محلی) – برای مقایسه‌های دقیق */
function today() {
    const d = new Date();
    // YYYY-MM-DD در منطقه زمانی محلی
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

/** تبدیل عدد به فرمت فارسی با جداکننده هزار */
function formatAmount(n) {
    return (+n || 0).toLocaleString('fa-IR');
}

/** Escape کردن HTML برای جلوگیری از XSS */
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Expose utilities to global scope (مورد نیاز سایر ماژول‌ها)
window.uid        = uid;
window.today      = today;
window.formatAmount = formatAmount;
window.escHtml    = escHtml;


/* ─────────────────────────────────────
   ۲. TOAST NOTIFICATIONS (با صف)
───────────────────────────────────── */
const ToastManager = (() => {
    const container = document.getElementById('toastContainer');
    let queue = [];
    let isShowing = false;

    function show(message, type = 'info', duration = 3000) {
        if (!container) return;

        queue.push({ message, type, duration });
        processQueue();
    }

    function processQueue() {
        if (isShowing || queue.length === 0) return;
        isShowing = true;

        const { message, type, duration } = queue.shift();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${escHtml(message)}</span>`;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => toast.classList.add('show'));

        const remove = () => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => {
                toast.remove();
                isShowing = false;
                processQueue();
            }, { once: true });
        };

        // Auto remove after duration
        const timer = setTimeout(remove, duration);
        toast.addEventListener('click', () => {
            clearTimeout(timer);
            remove();
        });
    }

    return { show };
})();

// Global wrapper for backward compatibility
function showToast(message, type = 'info', duration = 3000) {
    ToastManager.show(message, type, duration);
}
window.showToast = showToast;


/* ─────────────────────────────────────
   ۳. MODAL MANAGER (بهبود یافته)
───────────────────────────────────── */

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('active');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

window.openModal  = openModal;
window.closeModal = closeModal;

// یک listener برای همه رویدادهای مربوط به بستن modal
document.addEventListener('click', (e) => {
    // دکمه‌های close و المان‌های data-modal
    if (e.target.matches('.modal-close, [data-modal]')) {
        const modalId = e.target.dataset.modal || e.target.closest('.modal-overlay')?.id;
        if (modalId) closeModal(modalId);
        return;
    }
    // کلیک روی overlay (فقط اگر active باشد)
    if (e.target.matches('.modal-overlay.active')) {
        closeModal(e.target.id);
    }
});

// بستن با کلید Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) closeModal(activeModal.id);
    }
});


/* ─────────────────────────────────────
   ۴. THEME MANAGER
───────────────────────────────────── */

const ThemeManager = (() => {
    const KEY = 'slp_theme';

    function apply(theme) {
        document.body.classList.toggle('theme-dark',  theme === 'dark');
        document.body.classList.toggle('theme-light', theme !== 'dark');

        // به‌روزرسانی آیکون دکمه‌ها
        ['themeToggleBtn', 'themeToggleBtnMobile'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.textContent = theme === 'dark' ? '☀' : '☾';
        });
    }

    function toggle() {
        const current = localStorage.getItem(KEY) || 'light';
        const next    = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem(KEY, next);
        apply(next);
    }

    function init() {
        const saved = localStorage.getItem(KEY) || 'light';
        apply(saved);

        ['themeToggleBtn', 'themeToggleBtnMobile'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', toggle);
        });
    }

    return { init, apply, toggle };
})();

window.ThemeManager = ThemeManager;


/* ─────────────────────────────────────
   ۵. NAVIGATION
───────────────────────────────────── */

const NavManager = (() => {
    const PAGES = ['dashboard', 'tasks', 'habits', 'finance', 'backup', 'analytics']; // add 'analytics'
    let _current = 'dashboard';


    const PAGE_RENDERERS = {
        dashboard: () => typeof renderDashboard  === 'function' && renderDashboard(),
        tasks:     () => typeof renderTasks      === 'function' && renderTasks(),
        habits:    () => typeof renderHabits     === 'function' && renderHabits(),
        finance:   () => typeof renderFinance    === 'function' && renderFinance(),
        backup:    () => typeof renderExportPage === 'function' && renderExportPage(),
        analytics: () => typeof renderAnalytics  === 'function' && renderAnalytics(), // new
    };

    function navigateTo(page) {
        if (!PAGES.includes(page)) page = 'dashboard';
        _current = page;

        // نمایش صفحه مناسب
        PAGES.forEach(p => {
            const el = document.getElementById(`page-${p}`);
            if (el) el.classList.toggle('hidden', p !== page);
        });

        // فعال‌سازی لینک‌ها
        document.querySelectorAll('[data-nav]').forEach(link => {
            link.classList.toggle('active', link.dataset.nav === page);
        });

        // بستن منوی موبایل
        const mobileSidebar = document.getElementById('mobileSidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (mobileSidebar) mobileSidebar.classList.add('hidden');
        if (overlay) overlay.classList.add('hidden');

        // اجرای Renderer
        PAGE_RENDERERS[page]?.();
    }

    function init() {
        document.querySelectorAll('[data-nav]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo(link.dataset.nav);
            });
        });

        navigateTo('dashboard');
    }

    return { init, navigateTo, current: () => _current };
})();

window.NavManager = NavManager;


/* ─────────────────────────────────────
   ۶. MOBILE SIDEBAR
───────────────────────────────────── */

function initMobileSidebar() {
    const hamburger = document.getElementById('hamburgerBtn');
    const sidebar   = document.getElementById('mobileSidebar');
    const overlay   = document.getElementById('sidebarOverlay');

    if (!hamburger || !sidebar || !overlay) return;

    hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('hidden');
        overlay.classList.toggle('hidden');
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.add('hidden');
        overlay.classList.add('hidden');
    });
}


/* ─────────────────────────────────────
   ۷. DASHBOARD RENDERER
───────────────────────────────────── */

/** Helper برای به‌روزرسانی المان */
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

async function renderDashboard() {
    if (!window.slpData) return;

    try {
        const [tasks, habits, transactions] = await Promise.all([
            slpData.getTasks(),
            slpData.getHabits(),
            slpData.getTransactions()
        ]);

        const todayStr   = today();  // YYYY-MM-DD محلی
        const thisMonth  = todayStr.slice(0, 7); // YYYY-MM

        // وظایف
        const totalTasks    = tasks.length;
        const doneTasks     = tasks.filter(t => t.status === 'done').length;
        const todayTasks    = tasks.filter(t => t.dueDate === todayStr && t.status !== 'done').length;
        const overdueTasks  = tasks.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== 'done').length;

        // عادت‌ها
        const totalHabits   = habits.length;
        const doneHabitsToday = habits.filter(h => (h.log || {})[todayStr]).length;
        const maxStreak     = habits.reduce((m, h) => Math.max(m, h.streak || 0), 0);

        // مالی
        const income  = transactions
            .filter(t => t.type === 'income'  && t.date?.startsWith(thisMonth))
            .reduce((s, t) => s + (+t.amount || 0), 0);
        const expense = transactions
            .filter(t => t.type === 'expense' && t.date?.startsWith(thisMonth))
            .reduce((s, t) => s + (+t.amount || 0), 0);
        const balance = income - expense;

        // نام کاربر
        const username = localStorage.getItem('slp_username');

        // گریتینگ
        const greetEl = document.getElementById('dashGreeting');
        if (greetEl) {
            const hour = new Date().getHours();
            const greet = hour < 12 ? 'صبح بخیر' : hour < 17 ? 'روز بخیر' : 'شب بخیر';
            greetEl.textContent = username ? `${greet}، ${username}!` : `${greet}!`;
        }

        // تاریخ شمسی
        setText('dashDate', new Date().toLocaleDateString('fa-IR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }));

        // کارت‌های آمار
        setText('dashTotalTasks',   totalTasks);
        setText('dashDoneTasks',    doneTasks);
        setText('dashTodayTasks',   todayTasks);
        setText('dashOverdueTasks', overdueTasks);
        setText('dashTodayHabits',  `${doneHabitsToday}/${totalHabits}`);
        setText('dashMaxStreak',    maxStreak);
        setText('dashIncome',       `${formatAmount(income)} تومان`);
        setText('dashExpense',      `${formatAmount(expense)} تومان`);
        setText('dashBalance',      `${formatAmount(balance)} تومان`);

        // رنگ تراز
        const balEl = document.getElementById('dashBalance');
        if (balEl) balEl.style.color = balance >= 0 ? 'var(--green)' : 'var(--red)';

        // پیشرفت وظایف
        const taskProgress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
        const progressEl   = document.getElementById('dashTaskProgress');
        if (progressEl) progressEl.style.width = `${taskProgress}%`;
        setText('dashTaskProgressLabel', `${taskProgress}%`);

        // پیشرفت عادت‌های امروز
        const habitProgress = totalHabits ? Math.round((doneHabitsToday / totalHabits) * 100) : 0;
        const hProgressEl   = document.getElementById('dashHabitProgress');
        if (hProgressEl) hProgressEl.style.width = `${habitProgress}%`;
        setText('dashHabitProgressLabel', `${habitProgress}%`);

        // لیست‌های سریع
        renderDashQuickTasks(tasks, todayStr);
        renderDashQuickHabits(habits, todayStr);

    } catch (err) {
        console.error('Dashboard render error:', err);
        showToast('خطا در بارگذاری داشبورد', 'error');
        // نمایش حالت خالی
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'dash-empty';
        emptyDiv.textContent = 'خطا در دریافت اطلاعات';
        document.getElementById('dashQuickTasks')?.appendChild(emptyDiv);
    }
}

function renderDashQuickTasks(tasks, todayStr) {
    const el = document.getElementById('dashQuickTasks');
    if (!el) return;

    const todayTasks = tasks
        .filter(t => t.dueDate === todayStr && t.status !== 'done')
        .slice(0, 5);

    if (!todayTasks.length) {
        el.innerHTML = '<div class="dash-empty">✓ همه وظایف امروز انجام شده‌اند</div>';
        return;
    }

    const PRIO_COLORS = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--green)' };

    el.innerHTML = todayTasks.map(t => `
    <div class="dash-task-item">
      <span class="dash-task-dot" style="background:${PRIO_COLORS[t.priority] || 'var(--accent)'}"></span>
      <span class="dash-task-title">${escHtml(t.title)}</span>
      <button class="dash-task-done-btn" onclick="quickDoneTask('${t.id}')" title="انجام شد">✓</button>
    </div>`).join('');
}

function renderDashQuickHabits(habits, todayStr) {
    const el = document.getElementById('dashQuickHabits');
    if (!el) return;

    const pending = habits.filter(h => !(h.log || {})[todayStr]).slice(0, 5);

    if (!pending.length) {
        el.innerHTML = '<div class="dash-empty">🔥 همه عادت‌های امروز ثبت شده‌اند</div>';
        return;
    }

    el.innerHTML = pending.map(h => `
    <div class="dash-habit-item">
      <span class="dash-habit-dot" style="background:${h.color || 'var(--accent)'}"></span>
      <span class="dash-habit-title">${escHtml(h.title)}</span>
      <button class="dash-habit-done-btn" onclick="quickDoneHabit('${h.id}')" style="color:${h.color || 'var(--accent)'}">○</button>
    </div>`).join('');
}

/** انجام سریع وظیفه از داشبورد */
window.quickDoneTask = async function(id) {
    const tasks = await slpData.getTasks();
    const task  = tasks.find(t => t.id === id);
    if (!task) return;
    task.status    = 'done';
    task.doneAt    = new Date().toISOString();
    await slpData.saveTask(task);
    renderDashboard();
    showToast(`"${task.title}" انجام شد ✓`, 'success');
};

/** ثبت سریع عادت از داشبورد */
window.quickDoneHabit = async function(id) {
    if (typeof toggleHabitDay === 'function') {
        await toggleHabitDay(id, today());
    }
};

window.renderDashboard = renderDashboard;


/* ─────────────────────────────────────
   ۸. SEARCH
───────────────────────────────────── */

function initSearch() {
    const input = document.getElementById('globalSearch');
    if (!input) return;

    let debounceTimer;
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => performSearch(input.value.trim()), 300);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') input.value = '';
    });
}

async function performSearch(query) {
    const resultsEl = document.getElementById('searchResults');
    if (!resultsEl) return;

    if (!query) { resultsEl.classList.add('hidden'); return; }

    const q = query.toLowerCase();
    const [tasks, habits] = await Promise.all([slpData.getTasks(), slpData.getHabits()]);

    const matchedTasks  = tasks.filter(t => t.title?.toLowerCase().includes(q) || t.desc?.toLowerCase().includes(q));
    const matchedHabits = habits.filter(h => h.title?.toLowerCase().includes(q));

    if (!matchedTasks.length && !matchedHabits.length) {
        resultsEl.innerHTML = '<div class="search-empty">نتیجه‌ای یافت نشد</div>';
    } else {
        resultsEl.innerHTML = [
            ...matchedTasks.map(t => `<div class="search-item" onclick="NavManager.navigateTo('tasks')">⊞ ${escHtml(t.title)}</div>`),
            ...matchedHabits.map(h => `<div class="search-item" onclick="NavManager.navigateTo('habits')">◎ ${escHtml(h.title)}</div>`)
        ].join('');
    }
    resultsEl.classList.remove('hidden');
}


/* ─────────────────────────────────────
   ۹. INTEGRATION
───────────────────────────────────── */

function emitDataReady() {
    window.dispatchEvent(new CustomEvent('slp:dataReady'));
}

function initDragDropIntegration() {
    if (typeof DragDropManager === 'undefined') return;

    window.addEventListener('slp:tasksReordered', async (e) => {
        const { taskId, newStatus } = e.detail || {};
        if (!taskId || !newStatus) return;

        const tasks = await slpData.getTasks();
        const task  = tasks.find(t => t.id === taskId);
        if (!task) return;

        task.status = newStatus;
        await slpData.saveTask(task);
        renderDashboard();
        showToast('وضعیت وظیفه به‌روز شد', 'info');
    });
}

function initReminderSync() {
    if (typeof RemindersManager === 'undefined') return;

    window.addEventListener('slp:taskSaved',  () => RemindersManager.sync());
    window.addEventListener('slp:habitSaved', () => RemindersManager.sync());
}

function updateUserDisplay() {
    const name    = localStorage.getItem('slp_username');
    const nameEl  = document.getElementById('headerUsername');
    if (nameEl && name) nameEl.textContent = name;
}


/* ─────────────────────────────────────
   ۱۰. APP INIT
───────────────────────────────────── */

async function initApp() {
    try {
        // ۱) IndexedDB
        if (typeof slpData === 'undefined' || typeof slpData.init !== 'function') {
            console.error('slpData not found! Make sure indexeddb.js loaded first.');
            return;
        }

        await slpData.init();

        // ۲) Theme
        ThemeManager.init();

        // ۳) Mobile Sidebar
        initMobileSidebar();

        // ۴) Search
        initSearch();

        // ۵) User Display
        updateUserDisplay();

        // ۶) Event emit – سایر ماژول‌ها منتظر این رویداد هستند
        emitDataReady();

        // ۷) Integration hooks
        initDragDropIntegration();
        initReminderSync();

        // ۸) Navigation (بعد از emit)
        NavManager.init();

        // ۹) Budget alert
        if (typeof checkBudgetAlert === 'function') {
            setTimeout(checkBudgetAlert, 1500);
        }

        console.info('✦ Smart Life Planner initialized successfully');

    } catch (err) {
        console.error('App init error:', err);
        showToast('خطا در راه‌اندازی اپلیکیشن', 'error');
    }
}


/* ─────────────────────────────────────
   ۱۱. BOOTSTRAP
───────────────────────────────────── */

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}