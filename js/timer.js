'use strict';
/* js/timer.js – Timer Manager for tasks */

const TimerManager = (() => {
    let activeTaskId = null;
    let startTime = null;
    let intervalId = null;
    let currentDisplayElement = null;

    function updateDisplay() {
        if (!activeTaskId || !startTime) {
            if (currentDisplayElement) currentDisplayElement.textContent = '00:00:00';
            return;
        }
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        const str = `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
        if (currentDisplayElement) currentDisplayElement.textContent = str;
    }

    function startTimer(taskId, displayEl) {
        if (activeTaskId && activeTaskId !== taskId) {
            if (confirm('هم اکنون در حال زمان‌سنجی وظیفه دیگری هستید. آیا می‌خواهید آن را متوقف کرده و زمان آن را ذخیره کنید؟')) {
                stopTimer(true).then(() => startTimer(taskId, displayEl));
            }
            return;
        }
        if (activeTaskId === taskId && startTime) return;

        if (intervalId) clearInterval(intervalId);
        activeTaskId = taskId;
        startTime = Date.now();
        currentDisplayElement = displayEl;
        intervalId = setInterval(updateDisplay, 1000);
        updateDisplay();
    }

    function pauseTimer() {
        if (!activeTaskId || !startTime) return;
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }

    async function stopTimer(save = true) {
        if (!activeTaskId || !startTime) return;
        const elapsedMs = Date.now() - startTime;
        const elapsedMinutes = Math.floor(elapsedMs / 60000);
        if (elapsedMinutes > 0 && save) {
            const tasks = await slpData.getTasks();
            const task = tasks.find(t => t.id === activeTaskId);
            if (task) {
                task.loggedTime = (task.loggedTime || 0) + elapsedMinutes;
                await slpData.saveTask(task);
                showToast(`زمان ${formatDuration(elapsedMinutes)} به وظیفه اضافه شد`, 'success');
                if (typeof renderTasks === 'function') renderTasks();
                if (typeof renderDashboard === 'function') renderDashboard();
                const loggedInput = document.getElementById('taskLoggedTime');
                if (loggedInput && document.getElementById('taskId').value === activeTaskId) {
                    loggedInput.value = task.loggedTime || 0;
                }
            }
        }
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        activeTaskId = null;
        startTime = null;
        if (currentDisplayElement) currentDisplayElement.textContent = '00:00:00';
        currentDisplayElement = null;
    }

    function formatDuration(minutes) {
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hrs ? `${hrs} ساعت و ${mins} دقیقه` : `${mins} دقیقه`;
    }

    return { startTimer, pauseTimer, stopTimer };
})();

window.TimerManager = TimerManager;