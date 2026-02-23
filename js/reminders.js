'use strict';
/* ══════════════════════════════════════
   js/reminders.js — Task Reminders (optimized)
══════════════════════════════════════ */

const RemindersManager = (() => {
    let _interval = null;
    let _notifiedThisSession = new Set(); // task IDs that already triggered a notification in this session

    /**
     * Check all tasks for due reminders and send notifications.
     */
    async function check() {
        try {
            const tasks = await slpData.getTasks();
            const now = Date.now();

            for (const task of tasks) {
                // Skip if already done, already notified this session, or has no reminder
                if (task.status === 'done') continue;
                if (_notifiedThisSession.has(task.id)) continue;
                if (!task.reminderTime) continue;

                // Convert reminderTime (datetime-local string) to timestamp
                // Format: "YYYY-MM-DDTHH:mm"
                const reminderTimestamp = new Date(task.reminderTime).getTime();
                if (isNaN(reminderTimestamp)) continue; // invalid date

                // If reminder time is now or in the past (within a tolerance of 1 minute)
                if (now >= reminderTimestamp && now - reminderTimestamp < 60_000) {
                    await _notify(task);
                    _notifiedThisSession.add(task.id);
                }
            }
        } catch (err) {
            console.error('Reminders check failed:', err);
        }
    }

    /**
     * Send a notification and mark the task as notified (so it won't fire again).
     */
    async function _notify(task) {
        // Use NotificationManager.send if available, otherwise fallback to showToast + browser
        const title = '🔔 یادآوری وظیفه';
        const body = `"${task.title}" زمان آن رسیده است.`;

        if (window.NotificationManager && typeof NotificationManager.send === 'function') {
            NotificationManager.send(title, body, 'info', `reminder-${task.id}`);
        } else {
            // Fallback: showToast and browser notification directly
            showToast(`${title}: ${body}`, 'info', 5000);
            if (Notification.permission === 'granted') {
                new Notification(title, { body, dir: 'rtl', lang: 'fa' });
            }
        }

        // Optionally update a "notified" flag on the task to prevent future reminders
        // (But we already prevent within session via _notifiedThisSession)
        // If you want permanent suppression, you could set a field like `lastNotified`
        // and skip if it's already been notified. For now, session‑based is enough.
    }

    function start() {
        if (_interval) return;
        // Run once immediately
        check();
        // Then every 60 seconds
        _interval = setInterval(check, 60_000);
    }

    function stop() {
        if (_interval) {
            clearInterval(_interval);
            _interval = null;
        }
    }

    /**
     * Sync – triggers an immediate check (used by event listeners in app.js)
     */
    function sync() {
        check();
    }

    function init() {
        // Only start if browser supports notifications and permission is granted or we can request later
        // (We don't request here; that's handled by NotificationManager or user action)
        start();

        // Clear session set on page unload (optional)
        window.addEventListener('beforeunload', () => {
            _notifiedThisSession.clear();
        });
    }

    return {
        init,
        start,
        stop,
        check,
        sync,  // alias for check, used by event listeners
    };
})();

// Auto‑start after data is ready
window.addEventListener('slp:dataReady', () => RemindersManager.init());

// Expose globally if needed
window.RemindersManager = RemindersManager;
