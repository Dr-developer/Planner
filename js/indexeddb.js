/* ══════════════════════════════════════
   js/indexeddb.js — SLPDatabase Core (optimized)
══════════════════════════════════════ */

'use strict';

const SLPDatabase = (() => {
    const DB_NAME    = 'SmartLifePlanner';
    const DB_VERSION = 2;               // increment when schema changes
    let db = null;
    let openPromise = null;              // cache the opening promise

    const STORES = {
        tasks:        { keyPath: 'id' },
        habits:       { keyPath: 'id' },
        transactions: { keyPath: 'id' },
        tags:         { keyPath: 'id' },
        settings:     { keyPath: 'key' },
        backups:      { keyPath: 'id' }
    };

    const INDEXES = {
        tasks: [
            { name: 'by_due',    keyPath: 'dueDate' },
            { name: 'by_status', keyPath: 'status' }
        ],
        transactions: [
            { name: 'by_date', keyPath: 'date' },
            { name: 'by_type', keyPath: 'type' }
        ]
        // add indexes for other stores as needed
    };

    /**
     * Opens (or returns cached) database connection.
     * @returns {Promise<IDBDatabase>}
     */
    function open() {
        if (openPromise) return openPromise;

        openPromise = new Promise((resolve, reject) => {
            if (db) {
                resolve(db);
                return;
            }

            const req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = (ev) => {
                const idb = ev.target.result;
                const oldVersion = ev.oldVersion;
                console.log(`Upgrading DB from v${oldVersion} to v${DB_VERSION}`);

                // --- 1. Create missing object stores ---
                Object.entries(STORES).forEach(([name, opts]) => {
                    if (!idb.objectStoreNames.contains(name)) {
                        const store = idb.createObjectStore(name, opts);
                        // create indexes for this new store
                        (INDEXES[name] || []).forEach(idx => {
                            store.createIndex(idx.name, idx.keyPath, { unique: false });
                        });
                        console.log(`Created store: ${name}`);
                    }
                });

                // --- 2. For existing stores, ensure all desired indexes exist ---
                // This handles version upgrades where new indexes are added.
                Object.keys(STORES).forEach(storeName => {
                    if (idb.objectStoreNames.contains(storeName)) {
                        const store = ev.currentTarget.transaction.objectStore(storeName);
                        const existingIndexes = Array.from(store.indexNames);
                        (INDEXES[storeName] || []).forEach(idx => {
                            if (!existingIndexes.includes(idx.name)) {
                                store.createIndex(idx.name, idx.keyPath, { unique: false });
                                console.log(`Created index ${idx.name} on ${storeName}`);
                            }
                        });
                    }
                });
            };

            req.onsuccess = (ev) => {
                db = ev.target.result;
                console.log('Database opened successfully');
                resolve(db);
            };

            req.onerror = (ev) => {
                console.error('IndexedDB error:', ev.target.error);
                openPromise = null;          // allow retry
                reject(ev.target.error);
            };

            req.onblocked = () => {
                console.warn('Database blocked – close other tabs?');
                // Optionally retry or notify user
            };
        });

        return openPromise;
    }

    /**
     * Closes the database connection.
     */
    function close() {
        if (db) {
            db.close();
            db = null;
            openPromise = null;
            console.log('Database closed');
        }
    }

    /**
     * Returns a transaction object store.
     * @private
     */
    function _getStore(storeName, mode = 'readonly') {
        if (!db) throw new Error('Database not open. Call open() first.');
        const tx = db.transaction(storeName, mode);
        return tx.objectStore(storeName);
    }

    /**
     * Promisifies an IDBRequest.
     * @private
     */
    function _promisify(req) {
        return new Promise((resolve, reject) => {
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror   = (e) => reject(e.target.error);
        });
    }

    // --- Public API -------------------------------------------------

    function getAll(storeName) {
        return open().then(() => _promisify(_getStore(storeName).getAll()));
    }

    function get(storeName, key) {
        return open().then(() => _promisify(_getStore(storeName).get(key)));
    }

    function put(storeName, record) {
        return open().then(() => _promisify(_getStore(storeName, 'readwrite').put(record)));
    }

    function remove(storeName, key) {
        return open().then(() => _promisify(_getStore(storeName, 'readwrite').delete(key)));
    }

    function clear(storeName) {
        return open().then(() => _promisify(_getStore(storeName, 'readwrite').clear()));
    }

    /**
     * Inserts/updates multiple records in a single transaction.
     */
    function bulkPut(storeName, records) {
        return open().then(() => new Promise((resolve, reject) => {
            const tx    = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            records.forEach(r => store.put(r));
            tx.oncomplete = () => resolve();
            tx.onerror    = (e) => reject(e.target.error);
        }));
    }

    /**
     * Queries records using an index.
     * @param {string} storeName
     * @param {string} indexName
     * @param {IDBKeyRange|*} [query] - if omitted, gets all from index
     */
    function getByIndex(storeName, indexName, query) {
        return open().then(() => {
            const store = _getStore(storeName);
            const index = store.index(indexName);
            return _promisify(index.getAll(query));
        });
    }

    /**
     * Returns the count of records in a store (or index).
     */
    function count(storeName, indexName, query) {
        return open().then(() => {
            let target = _getStore(storeName);
            if (indexName) target = target.index(indexName);
            return _promisify(target.count(query));
        });
    }

    return {
        open,
        close,
        getAll,
        get,
        put,
        remove,
        clear,
        bulkPut,
        getByIndex,
        count
    };
})();

// Expose globally (or use ES modules if supported)
window.SLPDatabase = SLPDatabase;