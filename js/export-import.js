'use strict';
/* ══════════════════════════════════════
   js/export-import.js — Backup Manager (fixed & optimized)
══════════════════════════════════════ */

/* ───────── Render Export Page (called by NavManager) ───────── */
async function renderExportPage() {
    await renderBackupList();
    updateLastBackupDate();
}
window.renderExportPage = renderExportPage;

/* ══════════════════════════════════════
   EXPORT (JSON only – matches the single export button)
══════════════════════════════════════ */

async function exportJSON() {
    try {
        const [tasks, habits, transactions] = await Promise.all([
            slpData.getTasks(),
            slpData.getHabits(),
            slpData.getTransactions()
        ]);

        const data = {
            version: 2,
            exportedAt: new Date().toISOString(),
            tasks,
            habits,
            transactions
        };

        downloadFile(
            JSON.stringify(data, null, 2),
            `slp-backup-${today()}.json`,
            'application/json'
        );
        showToast('فایل JSON دانلود شد ✦', 'success');
    } catch (err) {
        console.error('Export failed:', err);
        showToast('خطا در خروجی گرفتن', 'error');
    }
}

/* ══════════════════════════════════════
   IMPORT
══════════════════════════════════════ */

function initImport() {
    const dropzone = document.getElementById('importDropzone');
    const fileInput = document.getElementById('importFileInput');
    if (!dropzone || !fileInput) return;

    // Click on dropzone opens file picker
    dropzone.addEventListener('click', () => fileInput.click());

    // Drag & drop events
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleImportFile(file);
    });

    // File input change
    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) handleImportFile(fileInput.files[0]);
        fileInput.value = ''; // allow re-upload of same file
    });
}

async function handleImportFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'json') {
        const text = await file.text();
        try {
            const data = JSON.parse(text);
            showImportPreview(data, 'json');
        } catch {
            showToast('فایل JSON معتبر نیست', 'error');
        }
    } else if (ext === 'csv') {
        const text = await file.text();
        const data = parseCSV(text);
        showImportPreview(data, 'csv');
    } else {
        showToast('فرمت فایل پشتیبانی نمی‌شود (json یا csv)', 'error');
    }
}

function showImportPreview(data, type) {
    // Build a summary message
    let message = '';
    if (type === 'json') {
        const taskCount = (data.tasks || []).length;
        const habitCount = (data.habits || []).length;
        const transCount = (data.transactions || []).length;
        message = `✅ فایل JSON شامل:\n• وظایف: ${taskCount}\n• عادت‌ها: ${habitCount}\n• تراکنش‌ها: ${transCount}`;
    } else {
        message = `✅ فایل CSV شامل ${data.length} ردیف است.`;
    }

    // Ask user for import mode
    const mode = confirm(message + '\n\nبرای جایگزینی کامل داده‌ها OK را بزنید.\nبرای ادغام (افزودن داده‌های جدید) Cancel را بزنید.');
    const replaceMode = mode; // true = OK (replace), false = Cancel (merge)

    doImport(data, type, replaceMode);
}

async function doImport(data, type, replaceMode) {
    // Auto‑backup before import
    await createBackup('قبل از Import');

    try {
        if (type === 'json') {
            await importJSON(data, replaceMode ? 'replace' : 'merge');
        } else {
            await importCSVData(data, replaceMode);
        }

        // Refresh all relevant pages
        if (typeof renderTasks === 'function') renderTasks();
        if (typeof renderHabits === 'function') renderHabits();
        if (typeof renderFinance === 'function') renderFinance();
        if (typeof renderDashboard === 'function') renderDashboard();
        renderBackupList();

        showToast('داده‌ها با موفقیت وارد شدند ✦', 'success');
    } catch (err) {
        console.error('Import failed:', err);
        showToast('خطا در وارد کردن داده‌ها', 'error');
    }
}

async function importJSON(data, mode) {
    const saveItems = async (storeName, items) => {
        if (!Array.isArray(items) || items.length === 0) return;

        if (mode === 'replace') {
            // Clear existing and bulk insert
            await slpData.clear(storeName);
            await slpData.bulkPut(storeName, items);
        } else {
            // Merge: only add items with new ids
            const existing = await slpData.getAll(storeName);
            const existingIds = new Set(existing.map(x => x.id));
            const newItems = items.filter(item => !existingIds.has(item.id));
            if (newItems.length > 0) {
                await slpData.bulkPut(storeName, newItems);
            }
        }
    };

    await saveItems('tasks', data.tasks);
    await saveItems('habits', data.habits);
    await saveItems('transactions', data.transactions);
}

async function importCSVData(rows, replaceMode) {
    if (rows.length === 0) return;

    // Auto‑detect type by headers
    const firstRow = rows[0] || {};
    const keys = Object.keys(firstRow).join(',').toLowerCase();

    if (keys.includes('اولویت') || keys.includes('سررسید')) {
        // Tasks CSV
        const tasks = rows.map(row => ({
            id: uid(),
            title: row['عنوان'] || row[Object.keys(row)[1]] || 'بدون عنوان',
            dueDate: row['سررسید'] || '',
            priority: row['اولویت'] || 'medium',
            status: row['وضعیت'] || 'todo',
            createdAt: new Date().toISOString()
        }));
        if (replaceMode) await slpData.clear('tasks');
        await slpData.bulkPut('tasks', tasks);
    } else if (keys.includes('مبلغ') || keys.includes('درآمد')) {
        // Transactions CSV
        const transactions = rows.map(row => ({
            id: uid(),
            type: (row['نوع'] || '').includes('درآمد') ? 'income' : 'expense',
            amount: parseFloat(row['مبلغ'] || 0),
            title: row['توضیحات'] || row['عنوان'] || 'بدون توضیح',
            category: row['دسته‌بندی'] || 'other',
            date: row['تاریخ'] || today(),
            createdAt: new Date().toISOString()
        }));
        if (replaceMode) await slpData.clear('transactions');
        await slpData.bulkPut('transactions', transactions);
    } else {
        showToast('فرمت CSV شناسایی نشد', 'error');
    }
}

function parseCSV(text) {
    // Remove BOM and split lines
    const lines = text.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    return lines.slice(1).map(line => {
        // Simple CSV parsing (handles quoted values)
        const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
        const obj = {};
        headers.forEach((h, i) => {
            let val = (values[i] || '').replace(/^"|"$/g, '').trim();
            obj[h] = val;
        });
        return obj;
    });
}

/* ══════════════════════════════════════
   BACKUP (internal snapshots)
══════════════════════════════════════ */

async function createBackup(label = '') {
    try {
        const [tasks, habits, transactions] = await Promise.all([
            slpData.getTasks(),
            slpData.getHabits(),
            slpData.getTransactions()
        ]);

        const backups = await slpData.getBackups();

        // Keep max 5 auto backups (oldest removed)
        const autoBackups = backups.filter(b => !b.manual).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        if (autoBackups.length >= 5) {
            await slpData.deleteBackup(autoBackups[0].id);
        }

        const backup = {
            id: uid(),
            label: label || `نسخه ${new Date().toLocaleDateString('fa-IR')}`,
            manual: !!label,
            data: { tasks, habits, transactions },
            createdAt: new Date().toISOString()
        };

        await slpData.saveBackup(backup);
        renderBackupList();
        updateLastBackupDate();
        return backup;
    } catch (err) {
        console.error('Backup creation failed:', err);
        showToast('خطا در ایجاد نسخه پشتیبان', 'error');
    }
}

async function renderBackupList() {
    const listEl = document.getElementById('backupList');
    if (!listEl) return;

    const backups = await slpData.getBackups();
    if (!backups.length) {
        listEl.innerHTML = '<div class="empty-state">نسخه پشتیبانی وجود ندارد</div>';
        return;
    }

    // Sort newest first
    backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    listEl.innerHTML = `
        <div class="dash-column-title mb-12">نسخه‌های پشتیبان</div>
        <div class="backup-items">
            ${backups.map(b => `
                <div class="backup-item card" style="padding: 12px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600;">${escHtml(b.label)}</div>
                            <div style="font-size: 11px; color: var(--text-muted);">
                                ${new Date(b.createdAt).toLocaleString('fa-IR')}
                            </div>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn-icon btn-ghost" onclick="downloadBackup('${b.id}')" title="دانلود">⤓</button>
                            <button class="btn-icon btn-ghost" onclick="restoreBackup('${b.id}')" title="بازیابی">↻</button>
                            <button class="btn-icon btn-ghost" onclick="deleteBackupById('${b.id}')" title="حذف">🗑</button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

window.downloadBackup = async function(id) {
    const backups = await slpData.getBackups();
    const backup = backups.find(b => b.id === id);
    if (!backup) return;
    downloadFile(
        JSON.stringify(backup.data, null, 2),
        `slp-backup-${backup.createdAt.split('T')[0]}.json`,
        'application/json'
    );
};

window.restoreBackup = async function(id) {
    if (!confirm('داده‌های فعلی جایگزین می‌شوند. ادامه می‌دهید؟')) return;
    const backups = await slpData.getBackups();
    const backup = backups.find(b => b.id === id);
    if (!backup) return;
    await importJSON(backup.data, 'replace');
    renderBackupList();
    showToast('نسخه پشتیبان بازیابی شد ✦', 'success');
};

window.deleteBackupById = async function(id) {
    if (!confirm('آیا از حذف این نسخه اطمینان دارید؟')) return;
    await slpData.deleteBackup(id);
    renderBackupList();
    showToast('نسخه پشتیبان حذف شد', 'info');
};

function updateLastBackupDate() {
    const el = document.getElementById('lastBackupDate');
    if (!el) return;
    slpData.getBackups().then(backups => {
        if (backups.length) {
            const latest = backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
            el.textContent = new Date(latest.createdAt).toLocaleDateString('fa-IR');
        } else {
            el.textContent = 'هرگز';
        }
    });
}

/* ══════════════════════════════════════
   BUTTON EVENT LISTENERS
══════════════════════════════════════ */

// Main export button
document.getElementById('exportBtn')?.addEventListener('click', exportJSON);

// Create backup button (you must add this button to the HTML)
document.getElementById('createBackupBtn')?.addEventListener('click', async () => {
    await createBackup('دستی');
    showToast('نسخه پشتیبان ایجاد شد ✦', 'success');
});

/* ══════════════════════════════════════
   UTILS
══════════════════════════════════════ */

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */

window.addEventListener('slp:dataReady', initImport);