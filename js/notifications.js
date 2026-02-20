'use strict';
/* ══════════════════════════════════════
   js/notifications.js — Smart Notifications (optimized)
══════════════════════════════════════ */

const NotificationManager = (() => {
    let _interval = null;
    let _snoozed = new Set(); // for future snooze feature

    // Default settings – all notification types enabled
    const DEFAULTS = {
        enabled: true,
        browser: false,      // whether browser permission was granted
        tasks: true,
        habits: true,
        finance: true,
        taskLeadMinutes: 30   // not used yet, but kept for extension
    };

    /* ── Load settings from IndexedDB ── */
    async function getSettings() {
        try {
            const saved = await slpData.getSetting('notifications');
            return { ...DEFAULTS, ...(saved?.value || {}) };
        } catch (err) {
            console.warn('Failed to load notification settings:', err);
            return DEFAULTS;
        }
    }

    async function saveSettings(updates) {
        try {
            const current = await getSettings();
            await slpData.saveSetting('notifications', { ...current, ...updates });
        } catch (err) {
            console.warn('Failed to save notification settings:', err);
        }
    }

    /* ── Request browser permission (triggered by settings button) ── */
    async function requestPermission() {
        if (!('Notification' in window)) {
            showToast('مرورگر شما از اعلان پشتیبانی نمی‌کند', 'warning');
            return false;
        }
        try {
            const result = await Notification.requestPermission();
            if (result === 'granted') {
                await saveSettings({ browser: true });
                showToast('اجازه اعلان مرورگر دریافت شد ✦', 'success');
                return true;
            } else {
                await saveSettings({ browser: false });
                showToast('اجازه اعلان رد شد', 'error');
                return false;
            }
        } catch (err) {
            console.error('Permission request error:', err);
            showToast('خطا در درخواست مجوز', 'error');
            return false;
        }
    }

    /* ── Send a notification (both in‑app toast and browser) ── */
    function send(title, body, type = 'info', tag = '') {
        // Always show in‑app toast
        showToast(`${title}: ${body}`, type, 5000);

        // Browser notification if permission granted
        if (Notification.permission === 'granted') {
            try {
                new Notification(title, {
                    body,
                    tag: tag || uid(),
                    icon: '/favicon.ico',  // you can replace with an actual icon
                    dir: 'rtl',
                    lang: 'fa'
                });
            } catch (e) {
                // silent fail
            }
        }

        // Dispatch event for other modules (e.g., to log to panel)
        window.dispatchEvent(new CustomEvent('slp:notification', { detail: { title, body, type, tag } }));
    }

    /* ── Check tasks for overdue / due today ── */
    async function checkTasks(settings) {
        if (!settings.tasks) return;
        try {
            const tasks = await slpData.getTasks();
            const now = new Date();
            const todayStr = today(); // from app.js

            tasks.forEach(t => {
                if (t.status === 'done' || _snoozed.has(t.id)) return;

                // Overdue tasks (due date in the past)
                if (t.dueDate && t.dueDate < todayStr) {
                    const key = `overdue-${t.id}-${todayStr}`;
                    if (!sessionStorage.getItem(key)) {
                        send('وظیفه معوق', `"${t.title}" از ${t.dueDate} باقی مانده`, 'warning', key);
                        sessionStorage.setItem(key, '1');
                    }
                    return;
                }

                // Due today – remind once per day
                if (t.dueDate === todayStr) {
                    const key = `today-${t.id}-${todayStr}`;
                    if (!sessionStorage.getItem(key)) {
                        send('یادآوری وظیفه', `امروز: "${t.title}"`, 'info', key);
                        sessionStorage.setItem(key, '1');
                    }
                }
            });
        } catch (err) {
            console.error('Task notification check failed:', err);
        }
    }

    /* ── Check habits for reminders and streak milestones ── */
    async function checkHabits(settings) {
        if (!settings.habits) return;
        try {
            const habits = await slpData.getHabits();
            const todayStr = today();
            const hour = new Date().getHours();

            habits.forEach(h => {
                const log = h.log || {};

                // Remind in morning (8) and evening (20) if habit not done today
                if (!log[todayStr] && (hour === 8 || hour === 20)) {
                    const key = `habit-remind-${h.id}-${todayStr}-${hour}`;
                    if (!sessionStorage.getItem(key)) {
                        send('یادآوری عادت', `"${h.title}" را فراموش نکنید!`, 'info', key);
                        sessionStorage.setItem(key, '1');
                    }
                }

                // Streak milestones (7, 14, 21, 30, 50, 100)
                const streak = h.streak || 0;
                if ([7, 14, 21, 30, 50, 100].includes(streak)) {
                    const key = `streak-${h.id}-${streak}`;
                    if (!sessionStorage.getItem(key)) {
                        const emoji = streak >= 30 ? '🏆' : '🔥';
                        send(`${emoji} استریک ${streak} روزه!`, `"${h.title}" — شگفت‌انگیزه!`, 'success', key);
                        sessionStorage.setItem(key, '1');
                    }
                }
            });
        } catch (err) {
            console.error('Habit notification check failed:', err);
        }
    }

    /* ── Check finance for budget warnings (based on total monthly budget) ── */
    async function checkFinance(settings) {
        if (!settings.finance) return;
        try {
            const transactions = await slpData.getTransactions();
            const thisMonth = new Date().toISOString().slice(0, 7);

            // Get total monthly budget from settings (you can set this via a simple input in settings modal)
            const budgetSetting = await slpData.getSetting('monthlyBudget');
            const budget = budgetSetting?.value ? parseFloat(budgetSetting.value) : 0;

            if (!budget) return;

            const expense = transactions
                .filter(t => t.type === 'expense' && t.date?.startsWith(thisMonth))
                .reduce((s, t) => s + (+t.amount || 0), 0);

            const ratio = expense / budget;
            const key = `budget-${thisMonth}-${Math.floor(ratio * 10)}`;

            if (ratio >= 0.9 && !sessionStorage.getItem(key)) {
                send('⚠ هشدار بودجه', `${Math.round(ratio * 100)}% از بودجه ماهانه مصرف شده`, 'warning', key);
                sessionStorage.setItem(key, '1');
            }
        } catch (err) {
            console.error('Finance notification check failed:', err);
        }
    }

    /* ── Daily summary (at 9 AM) ── */
    async function checkDailySummary(settings) {
        if (!settings.tasks) return; // uses tasks setting
        try {
            const hour = new Date().getHours();
            if (hour !== 9) return;

            const tasks = await slpData.getTasks();
            const todayStr = today();
            const key = `daily-${todayStr}`;
            if (sessionStorage.getItem(key)) return;

            const todayTasks = tasks.filter(t => t.dueDate === todayStr && t.status !== 'done');
            if (todayTasks.length) {
                send('خلاصه روز', `${todayTasks.length} وظیفه برای امروز دارید`, 'info', key);
                sessionStorage.setItem(key, '1');
            }
        } catch (err) {
            console.error('Daily summary failed:', err);
        }
    }

    /* ── Main tick function – runs every minute ── */
    async function tick() {
        const settings = await getSettings();
        if (!settings.enabled) return;

        await Promise.allSettled([
            checkTasks(settings),
            checkHabits(settings),
            checkFinance(settings),
            checkDailySummary(settings)
        ]);
    }

    function start() {
        if (_interval) return;
        tick(); // first run immediately
        _interval = setInterval(tick, 60_000); // every minute
    }

    function stop() {
        if (_interval) {
            clearInterval(_interval);
            _interval = null;
        }
    }

    /* ── Initialize – attach event listener to permission button and start scheduler ── */
    function init() {
        // Attach permission request to the button in settings modal
        const permBtn = document.getElementById('requestNotifPermBtn');
        if (permBtn) {
            permBtn.addEventListener('click', requestPermission);
        }

        // Start the notification scheduler
        start();

        // Optionally, listen for settings changes (e.g., from a future toggle)
    }

    // Public API
    return {
        init,
        requestPermission,
        send,
        start,
        stop
    };
})();

// Auto‑initialize when data is ready
window.addEventListener('slp:dataReady', () => NotificationManager.init());

// Expose globally if needed
window.NotificationManager = NotificationManager;