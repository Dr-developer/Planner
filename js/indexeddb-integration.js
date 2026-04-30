/* ══════════════════════════════════════
   js/indexeddb-integration.js
   MigrationManager + DataService (optimized)
══════════════════════════════════════ */

'use strict';

/**
 * Handles migration of legacy localStorage data to IndexedDB.
 * Ensures idempotency and logs detailed errors.
 */
const MigrationManager = (() => {
    const MIGRATION_FLAG = 'slp_idb_migrated_v2';

    // Mapping of IndexedDB store names to localStorage keys
    const LS_MAP = {
        tasks:        'slp_tasks',
        habits:       'slp_habits',
        transactions: 'slp_transactions'
    };

    /**
     * Migrates data from localStorage to IndexedDB if not already done.
     * @returns {Promise<boolean>} – true if migration succeeded (or already done), false if partial failure.
     */
    async function migrate() {
        if (localStorage.getItem(MIGRATION_FLAG) === '1') {
            return true; // already migrated
        }

        console.info('[Migration] Starting localStorage → IndexedDB migration...');

        // Ensure database is open (optional, bulkPut will open anyway)
        await SLPDatabase.open();

        const migrationPromises = Object.entries(LS_MAP).map(async ([store, key]) => {
            const raw = localStorage.getItem(key);
            if (!raw) return; // nothing to migrate

            try {
                const data = JSON.parse(raw);
                if (Array.isArray(data) && data.length > 0) {
                    await SLPDatabase.bulkPut(store, data);
                    console.log(`[Migration] Store "${store}" migrated (${data.length} items).`);
                }
            } catch (err) {
                throw new Error(`Store "${store}" failed: ${err.message}`);
            }
        });

        const results = await Promise.allSettled(migrationPromises);
        const failed = results.filter(r => r.status === 'rejected');

        if (failed.length === 0) {
            localStorage.setItem(MIGRATION_FLAG, '1');
            console.info('[Migration] Successfully completed.');
            return true;
        } else {
            console.error('[Migration] Partial failure – flag not set.', failed.map(f => f.reason));
            return false;
        }
    }

    /**
     * Removes migrated data from localStorage (optional clean‑up).
     */
    function pruneLocalStorage() {
        Object.values(LS_MAP).forEach(key => localStorage.removeItem(key));
        console.info('[Migration] Pruned localStorage of migrated data.');
    }

    return { migrate, pruneLocalStorage };
})();

/**
 * Unified data access layer – uses IndexedDB if available and initialised,
 * otherwise falls back to localStorage transparently.
 */
const DataService = (() => {
    const IDB_SUPPORTED = 'indexedDB' in window;
    let useIDB = false;           // becomes true only after successful IDB open
    let initPromise = null;

    // --- LocalStorage helpers (used when IDB unavailable) ---
    function _lsGet(key) {
        try {
            const val = localStorage.getItem(key);
            return val ? JSON.parse(val) : [];
        } catch {
            return [];
        }
    }

    function _lsSave(key, item) {
        const arr = _lsGet(key);
        const index = arr.findIndex(x => x.id === item.id);
        if (index >= 0) arr[index] = item;
        else arr.push(item);
        localStorage.setItem(key, JSON.stringify(arr));
    }

    function _lsDelete(key, id) {
        const arr = _lsGet(key).filter(x => x.id !== id);
        localStorage.setItem(key, JSON.stringify(arr));
    }

    function _lsGetSetting(key) {
        try {
            return JSON.parse(localStorage.getItem('slp_set_' + key));
        } catch {
            return null;
        }
    }

    function _lsSaveSetting(key, value) {
        localStorage.setItem('slp_set_' + key, JSON.stringify(value));
    }

    // --- Generic error wrapper (logs and rethrows) ---
    function _handleError(operation, store) {
        return (err) => {
            console.error(`DataService: ${operation} on "${store}" failed.`, err);
            // Optionally show a toast notification here if showToast is available
            if (typeof showToast === 'function') {
                showToast('خطا در عملیات داده', 'error');
            }
            throw err;
        };
    }

    // --- Task methods ---
    function getTasks() {
        return useIDB
            ? SLPDatabase.getAll('tasks').catch(_handleError('getAll', 'tasks'))
            : Promise.resolve(_lsGet('slp_tasks'));
    }

    function saveTask(task) {
        return useIDB
            ? SLPDatabase.put('tasks', task).catch(_handleError('put', 'tasks'))
            : Promise.resolve(_lsSave('slp_tasks', task));
    }

    function deleteTask(id) {
        return useIDB
            ? SLPDatabase.remove('tasks', id).catch(_handleError('delete', 'tasks'))
            : Promise.resolve(_lsDelete('slp_tasks', id));
    }

    // --- Habit methods ---
    function getHabits() {
        return useIDB
            ? SLPDatabase.getAll('habits').catch(_handleError('getAll', 'habits'))
            : Promise.resolve(_lsGet('slp_habits'));
    }

    function saveHabit(habit) {
        return useIDB
            ? SLPDatabase.put('habits', habit).catch(_handleError('put', 'habits'))
            : Promise.resolve(_lsSave('slp_habits', habit));
    }

    function deleteHabit(id) {
        return useIDB
            ? SLPDatabase.remove('habits', id).catch(_handleError('delete', 'habits'))
            : Promise.resolve(_lsDelete('slp_habits', id));
    }

    // --- Transaction methods ---
    function getTransactions() {
        return useIDB
            ? SLPDatabase.getAll('transactions').catch(_handleError('getAll', 'transactions'))
            : Promise.resolve(_lsGet('slp_transactions'));
    }

    function saveTransaction(transaction) {
        return useIDB
            ? SLPDatabase.put('transactions', transaction).catch(_handleError('put', 'transactions'))
            : Promise.resolve(_lsSave('slp_transactions', transaction));
    }

    function deleteTransaction(id) {
        return useIDB
            ? SLPDatabase.remove('transactions', id).catch(_handleError('delete', 'transactions'))
            : Promise.resolve(_lsDelete('slp_transactions', id));
    }

    // --- Settings ---
    function getSetting(key) {
        return useIDB
            ? SLPDatabase.get('settings', key)
                .then(record => record ? record.value : null)
                .catch(_handleError('get', 'settings'))
            : Promise.resolve(_lsGetSetting(key));
    }

    function saveSetting(key, value) {
        const record = { key, value };
        return useIDB
            ? SLPDatabase.put('settings', record).catch(_handleError('put', 'settings'))
            : Promise.resolve(_lsSaveSetting(key, value));
    }

    // --- Backups ---
    function getBackups() {
        return useIDB
            ? SLPDatabase.getAll('backups').catch(_handleError('getAll', 'backups'))
            : Promise.resolve(_lsGet('slp_backups'));
    }

    function saveBackup(backup) {
        return useIDB
            ? SLPDatabase.put('backups', backup).catch(_handleError('put', 'backups'))
            : Promise.resolve(_lsSave('slp_backups', backup));
    }

    function deleteBackup(id) {
        return useIDB
            ? SLPDatabase.remove('backups', id).catch(_handleError('delete', 'backups'))
            : Promise.resolve(_lsDelete('slp_backups', id));
    }
// --- Category methods ---
    function getCategories() {
        const lsKey = 'slp_categories';
        return useIDB
            ? SLPDatabase.getAll('categories')
            : Promise.resolve(_lsGet(lsKey));
    }

    function saveCategory(category) {
        const lsKey = 'slp_categories';
        return useIDB
            ? SLPDatabase.put('categories', category)
            : Promise.resolve(_lsSave(lsKey, category));
    }

    function deleteCategory(id) {
        const lsKey = 'slp_categories';
        return useIDB
            ? SLPDatabase.remove('categories', id)
            : Promise.resolve(_lsDelete(lsKey, id));
    }
    /**
     * Initialises the data layer:
     * - Tries to open IndexedDB (if supported)
     * - Performs migration (if IDB becomes active)
     * - Always fires `slp:dataReady` (even on fallback)
     * @returns {Promise<void>}
     */
    async function init() {
        if (initPromise) return initPromise;

        initPromise = (async () => {
            let mode = 'localStorage';

            if (IDB_SUPPORTED) {
                try {
                    await SLPDatabase.open();
                    // Migration only if IndexedDB opened successfully
                    const migrated = await MigrationManager.migrate();
                    if (migrated) {
                        // Optionally prune localStorage after successful migration
                        // MigrationManager.pruneLocalStorage(); // uncomment if you want auto‑cleanup
                    }
                    useIDB = true;
                    mode = 'indexedDB';
                } catch (err) {
                    console.error('IndexedDB initialisation failed, falling back to localStorage.', err);
                    useIDB = false;
                }
            } else {
                console.info('IndexedDB not supported – using localStorage.');
                useIDB = false;
            }

            console.log(`DataService ready (mode: ${mode})`);
            window.dispatchEvent(new Event('slp:dataReady'));
        })();

        return initPromise;
    }

    // Public API
    return {
        init,
        getTasks, saveTask, deleteTask,
        getHabits, saveHabit, deleteHabit,
        getTransactions, saveTransaction, deleteTransaction,
        getSetting, saveSetting,
        getBackups, saveBackup, deleteBackup,
        getCategories,      // 👈 new
        saveCategory,       // 👈 new
        deleteCategory      // 👈 new
    };
})();

// Expose globally for other scripts
window.slpData = DataService;