'use strict';
/* js/pomodoro.js – Pomodoro Timer with Task Integration */

const PomodoroManager = (() => {
    let currentTaskId = null;
    let timerInterval = null;
    let remainingSeconds = 0;
    let isWorkPhase = true;
    let isRunning = false;
    let workDuration = 25;   // minutes
    let breakDuration = 5;    // minutes

    // DOM elements
    const modal = document.getElementById('pomodoroModal');
    const taskSelect = document.getElementById('pomodoroTaskSelect');
    const workInput = document.getElementById('pomodoroWorkTime');
    const breakInput = document.getElementById('pomodoroBreakTime');
    const displaySpan = document.getElementById('pomodoroDisplay');
    const startBtn = document.getElementById('pomodoroStartBtn');
    const pauseBtn = document.getElementById('pomodoroPauseBtn');
    const stopBtn = document.getElementById('pomodoroStopBtn');
    const statusDiv = document.getElementById('pomodoroStatus');

    function updateDisplay() {
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        displaySpan.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function setPhase(work) {
        isWorkPhase = work;
        if (work) {
            statusDiv.textContent = '🧠 در حال کار...';
            statusDiv.style.color = 'var(--accent)';
            remainingSeconds = workDuration * 60;
        } else {
            statusDiv.textContent = '☕ استراحت';
            statusDiv.style.color = 'var(--green)';
            remainingSeconds = breakDuration * 60;
        }
        updateDisplay();
    }

    function tick() {
        if (remainingSeconds <= 0) {
            // Phase finished
            if (isWorkPhase) {
                // Work phase ended – log time to task
                if (currentTaskId) {
                    logWorkSessionToTask();
                }
                // Start break
                setPhase(false);
            } else {
                // Break ended – back to work (or stop)
                setPhase(true);
            }
        } else {
            remainingSeconds--;
            updateDisplay();
        }
    }

    async function logWorkSessionToTask() {
        if (!currentTaskId) return;
        const tasks = await slpData.getTasks();
        const task = tasks.find(t => t.id === currentTaskId);
        if (!task) return;
        const minutesWorked = workDuration;
        task.loggedTime = (task.loggedTime || 0) + minutesWorked;
        await slpData.saveTask(task);
        showToast(`${minutesWorked} دقیقه به وظیفه "${task.title}" اضافه شد`, 'success');
        if (typeof renderTasks === 'function') renderTasks();
        if (typeof renderDashboard === 'function') renderDashboard();
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        isRunning = true;
        timerInterval = setInterval(() => tick(), 1000);
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
    }

    function pauseTimer() {
        if (!isRunning) return;
        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = false;
        statusDiv.textContent = '⏸ متوقف شده';
    }

    async function stopTimer(saveLog = true) {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        isRunning = false;
        if (saveLog && isWorkPhase && currentTaskId) {
            // If work phase was active, log partial time
            const minutesElapsed = workDuration * 60 - remainingSeconds;
            const minutesLogged = Math.floor(minutesElapsed / 60);
            if (minutesLogged > 0) {
                const tasks = await slpData.getTasks();
                const task = tasks.find(t => t.id === currentTaskId);
                if (task) {
                    task.loggedTime = (task.loggedTime || 0) + minutesLogged;
                    await slpData.saveTask(task);
                    showToast(`${minutesLogged} دقیقه ثبت شد`, 'info');
                    if (typeof renderTasks === 'function') renderTasks();
                    if (typeof renderDashboard === 'function') renderDashboard();
                }
            }
        }
        resetUI();
    }

    function resetUI() {
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        isRunning = false;
        currentTaskId = null;
        taskSelect.value = '';
        statusDiv.textContent = 'در حال انتظار برای شروع';
        setPhase(true);
    }

    async function populateTaskSelect() {
        if (!taskSelect) return;
        const tasks = await slpData.getTasks();
        const todayStr = today();
        // Filter for tasks not done, and either due today or overdue (or no due date)
        const relevantTasks = tasks.filter(t => t.status !== 'done' && (!t.dueDate || t.dueDate <= todayStr));
        taskSelect.innerHTML = '<option value="">-- انتخاب کنید --</option>' +
            relevantTasks.map(t => `<option value="${t.id}">${escHtml(t.title)} (${t.dueDate || 'بدون تاریخ'})</option>`).join('');
    }

    function openModalAndRefreshTasks() {
        populateTaskSelect();
        openModal('pomodoroModal');
    }

    // Event listeners
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const selectedId = taskSelect.value;
            if (!selectedId) {
                showToast('لطفاً یک وظیفه انتخاب کنید', 'warning');
                return;
            }
            currentTaskId = selectedId;
            workDuration = parseInt(workInput.value) || 25;
            breakDuration = parseInt(breakInput.value) || 5;
            if (workDuration < 1) workDuration = 25;
            if (breakDuration < 1) breakDuration = 5;
            setPhase(true);
            startTimer();
        });
    }
    if (pauseBtn) pauseBtn.addEventListener('click', pauseTimer);
    if (stopBtn) stopBtn.addEventListener('click', () => stopTimer(true));

    // When modal closes, stop timer and discard any incomplete session (no log)
    const modalOverlay = document.getElementById('pomodoroModal');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                stopTimer(false);
                closeModal('pomodoroModal');
            }
        });
    }
    document.querySelectorAll('[data-modal="pomodoroModal"]').forEach(btn => {
        btn.addEventListener('click', () => {
            stopTimer(false);
            closeModal('pomodoroModal');
        });
    });

    return { openModal: openModalAndRefreshTasks };
})();

// Expose global
window.PomodoroManager = PomodoroManager;

// Hook the Pomodoro button
document.getElementById('pomodoroBtn')?.addEventListener('click', () => PomodoroManager.openModal());