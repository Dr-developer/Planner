'use strict';
/* ══════════════════════════════════════
   js/reminders.js — Task Reminders (fixed)
══════════════════════════════════════ */

const RemindersManager = (() => {
    let _interval = null;
    let _notifiedThisSession = new Set();

    async function check() {
        try {
            const tasks = await slpData.getTasks();
            const now = Date.now();

            for (const task of tasks) {
                if (task.status === 'done') continue;
                if (_notifiedThisSession.has(task.id)) continue;
                if (!task.reminderTime) continue;

                const reminderTimestamp = new Date(task.reminderTime).getTime();
                if (isNaN(reminderTimestamp)) continue;

                if (now >= reminderTimestamp && now - reminderTimestamp < 60_000) {
                    await _notify(task);
                    _notifiedThisSession.add(task.id);
                }
            }
        } catch (err) {
            console.error('Reminders check failed:', err);
        }
    }

    async function _notify(task) {
        const title = '🔔 یادآوری وظیفه';
        const body = `"${task.title}" زمان آن رسیده است.`;

        if (window.NotificationManager && typeof NotificationManager.send === 'function') {
            NotificationManager.send(title, body, 'info', `reminder-${task.id}`);
        } else {
            showToast(`${title}: ${body}`, 'info', 5000);
            if (Notification.permission === 'granted') {
                new Notification(title, { body, dir: 'rtl', lang: 'fa' });
            }
        }
    }

    function start() {
        if (_interval) return;
        check();
        _interval = setInterval(check, 60_000);
    }

    function stop() {
        if (_interval) {
            clearInterval(_interval);
            _interval = null;
        }
    }

    // 🔥 SYNC METHOD – called by app.js events
    function sync() {
        check();
    }

    function init() {
        start();
        window.addEventListener('beforeunload', () => {
            _notifiedThisSession.clear();
        });
        console.log('RemindersManager initialized');
    }

    return {
        init,
        start,
        stop,
        check,
        sync,   // explicitly exposed
    };
})();

// Auto‑start after data is ready
window.addEventListener('slp:dataReady', () => RemindersManager.init());

// Expose globally (already done by const, but ensure it's on window)
window.RemindersManager = RemindersManager;

// Confirm it's loaded
console.log('RemindersManager loaded and available:', !!window.RemindersManager);
