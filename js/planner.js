// js/planner.js

const Planner = {
    currentWeekStart: null,

    init() {
        this.currentWeekStart = Calendar.getWeekStart(
            new Date(),
            App.state.settings.weekStart
        );
        this.renderWeek();
        this.bindControls();
    },

    bindControls() {
        document.getElementById('prevWeek').onclick = () => {
            this.currentWeekStart = Calendar.addDays(this.currentWeekStart, -7);
            this.renderWeek();
        };

        document.getElementById('nextWeek').onclick = () => {
            this.currentWeekStart = Calendar.addDays(this.currentWeekStart, 7);
            this.renderWeek();
        };

        document.getElementById('todayBtn').onclick = () => {
            this.currentWeekStart = Calendar.getWeekStart(
                new Date(),
                App.state.settings.weekStart
            );
            this.renderWeek();
        };
    },

    renderWeek() {
        const days = Calendar.getWeekDays(
            this.currentWeekStart,
            App.state.settings.calendarType
        );

        const grid = document.getElementById('weeklyGrid');
        grid.innerHTML = '';

        let total = 0;
        let completed = 0;

        days.forEach(day => {
            const tasks = App.state.tasks.filter(
                t => Calendar.getStartOfDay(t.date) === Calendar.getStartOfDay(day.date)
            );

            total += tasks.length;
            completed += tasks.filter(t => t.completed).length;

            grid.appendChild(this.renderDay(day, tasks));
        });

        this.updateProgress(completed, total);
    },

    renderDay(day, tasks) {
        const el = document.createElement('div');
        el.className = `day-card ${day.isToday ? 'today' : ''}`;

        el.innerHTML = `
      <div class="day-header">
        <div>
          <div class="day-name">${day.dayName}</div>
          <div class="day-date">${day.day} ${day.monthName}</div>
        </div>
      </div>
      <div class="day-tasks">
        ${tasks.map(t => this.renderTask(t)).join('')}
      </div>
      <button class="add-task-btn">+ افزودن وظیفه</button>
    `;

        el.querySelector('.add-task-btn').onclick = () =>
            this.openTaskModal(day.date);

        return el;
    },

    renderTask(task) {
        return `
      <div class="task-item ${task.completed ? 'completed' : ''}">
        <input type="checkbox" ${task.completed ? 'checked' : ''}
          onchange="Planner.toggleTask('${task.id}')">
        <span class="task-text">${task.text}</span>
        <span class="task-priority ${task.priority}"></span>
      </div>
    `;
    },

    toggleTask(id) {
        const task = App.state.tasks.find(t => t.id === id);
        if (!task) return;

        task.completed = !task.completed;

        if (task.completed && task.recurrence) {
            this.createNextRecurrence(task);
        }

        App.saveState();
        this.renderWeek();
    },

    createNextRecurrence(task) {
        const next = { ...task };
        next.id = App.generateId();
        next.completed = false;

        if (task.recurrence.frequency === 'daily') {
            next.date = Calendar.addDays(task.date, task.recurrence.interval).getTime();
        }

        App.state.tasks.push(next);
    },

    updateProgress(done, total) {
        document.getElementById('weekProgressText')
            .textContent = `${done} از ${total} تکمیل شده`;

        document.getElementById('weekProgressBar')
            .style.width = total === 0 ? '0%' : `${Math.round((done / total) * 100)}%`;
    },

    openTaskModal(date) {
        document.getElementById('taskDate').value =
            new Date(date).toISOString().split('T')[0];
        document.getElementById('taskModal').classList.add('active');
    }
};
