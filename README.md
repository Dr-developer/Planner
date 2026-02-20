
# Smart Life Planner (برنامه‌ریز هوشمند زندگی)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)](https://yourusername.github.io/smart-life-planner/)
[![PWA](https://img.shields.io/badge/PWA-Enabled-blue)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

A comprehensive, offline‑capable personal management application for tasks, habits, and finances. Built as a **Progressive Web App (PWA)** – install it on your phone or desktop and use it without an internet connection.

![Dashboard Preview](screenshots/dashboard.png) <!-- Add a screenshot if you have one -->

---

## 📝 Description

Smart Life Planner helps you organize your daily life with three core modules:

- **Tasks** – Kanban board with due dates, priorities, tags, and drag‑drop.
- **Habits** – Track daily habits with streaks, color coding, and weekly overview.
- **Finances** – Manage income/expenses, set monthly budgets, and visualise spending.

All data is stored locally in **IndexedDB** – your information never leaves your device. The app is fully responsive and works in both dark and light themes.

---

## ✨ Features

- ✅ **Dashboard** – Quick overview of tasks, habits, and finances with progress bars.
- ✅ **Tasks** – Kanban columns (To‑Do, In Progress, Done), due dates, priority flags, tags, and drag‑drop between columns.
- ✅ **Habits** – Daily check‑off, streak counter, week view, and color customization.
- ✅ **Finance** – Income/expense entries, monthly budget, category breakdown.
- ✅ **Backup & Restore** – Export/import data as JSON or CSV.
- ✅ **Analytics** – Dedicated analytics page with charts and an advanced task table (filter, sort, paginate, inline edit).
- ✅ **Notifications** – Browser notifications for task reminders, habit streaks, and budget alerts.
- ✅ **Reminders** – Set time‑based reminders for tasks.
- ✅ **Drag & Drop** – Reorder tasks and transactions with smooth drag‑drop.
- ✅ **Onboarding** – First‑time user guide.
- ✅ **PWA** – Installable, works offline, loads instantly.
- ✅ **Responsive** – Works on mobile, tablet, and desktop.
- ✅ **Dark/Light Theme** – Toggle between themes.

---

## 🛠️ Technologies

- **HTML5** – Semantic markup.
- **CSS3** – Custom properties (variables), Flexbox, Grid, animations.
- **JavaScript (ES6+)** – Modules, async/await, classes.
- **IndexedDB** – Client‑side storage (via a custom wrapper).
- **Chart.js** – For analytics charts.
- **Service Worker** – Offline caching of static assets.
- **Web App Manifest** – PWA installability.
- **GitHub Pages** – Hosting.

---

## 🚀 Live Demo

[https://yourusername.github.io/smart-life-planner/](https://yourusername.github.io/smart-life-planner/)

---

## 📦 Installation (Local Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/smart-life-planner.git
   cd smart-life-planner
   ```

2. **Serve the files locally**  
   Use any static server, for example:
   ```bash
   # Python 3
   python -m http.server 8000
   ```
   or with [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) in VS Code.

3. **Open in browser**  
   Navigate to `http://localhost:8000`

---

## 🌍 Deploy to GitHub Pages

1. Push your code to a GitHub repository.
2. Go to repository **Settings** → **Pages**.
3. Under **Branch**, select `main` (or your default branch) and the `/root` folder.
4. Click **Save**. Your site will be published at `https://yourusername.github.io/repository-name/`.

> **Important:** If your site is served from a subdirectory (e.g., `username.github.io/repo/`), you must update all asset paths in HTML, manifest, and service worker to include the repository name. Use **root‑relative paths** like `/repo/js/app.js` or **relative paths** like `./js/app.js`. The service worker cache list must also reflect the correct paths.

---

## 📱 PWA Features

- **Installable** – On supported browsers, you'll see an "Add to Home screen" prompt.
- **Offline** – Once installed, the app shell (HTML, CSS, JS) works offline. Data operations (IndexedDB) remain functional because IndexedDB is client‑side.
- **Fast loading** – Static assets are cached by the service worker.

To test offline mode:
- Open DevTools → **Application** → **Service Workers** → check **Offline**.
- Reload the page – it should load from cache.

---

## 📄 License

This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check the [issues page](https://github.com/yourusername/smart-life-planner/issues) or open a pull request.

---

## 👤 Author

**Your Name**  
- GitHub: [@yourusername](https://github.com/yourusername)

---

## 🙏 Acknowledgements

- [Vazirmatn Font](https://github.com/rastikerdar/vazirmatn) – Beautiful Persian font.
- [Chart.js](https://www.chartjs.org/) – Simple yet flexible JavaScript charting.
- Icons from the [OpenMoji](https://openmoji.org/) project (or any other source you used).

```

