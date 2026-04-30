'use strict';
/* js/categories.js – Task Categories Manager (force predefined) */

const CategoryManager = (() => {
    const PREDEFINED = [
        { id: 'work',      name: 'کار',        emoji: '💼', isPredefined: true },
        { id: 'study',     name: 'مطالعه',     emoji: '📚', isPredefined: true },
        { id: 'exercise',  name: 'ورزش',       emoji: '🏋️', isPredefined: true },
        { id: 'personal',  name: 'شخصی',       emoji: '👤', isPredefined: true },
        { id: 'health',    name: 'سلامتی',     emoji: '❤️', isPredefined: true },
        { id: 'finance',   name: 'مالی',       emoji: '💰', isPredefined: true },
        { id: 'shopping',  name: 'خرید',       emoji: '🛒', isPredefined: true },
        { id: 'other',     name: 'سایر',       emoji: '📦', isPredefined: true }
    ];

    let categories = [];

    // --------------------------------------------------------------
    // Core data functions
    // --------------------------------------------------------------
    async function ensurePredefinedCategories() {
        let stored = await slpData.getCategories();
        console.log('[Categories] Current stored count:', stored.length);
        let changed = false;
        for (const predefined of PREDEFINED) {
            const exists = stored.some(c => c.id === predefined.id);
            if (!exists) {
                console.log(`[Categories] Adding missing predefined: ${predefined.name}`);
                await slpData.saveCategory(predefined);
                changed = true;
            }
        }
        if (changed) {
            stored = await slpData.getCategories();
            console.log('[Categories] After adding missing, count:', stored.length);
        }
        return stored;
    }

    async function init() {
        // Ensure database is open (SLPDatabase.open is called by slpData.init)
        let stored = await slpData.getCategories();
        if (stored.length === 0) {
            console.log('[Categories] No categories found, inserting all predefined');
            await slpData.bulkPut('categories', PREDEFINED);
            categories = PREDEFINED.slice();
        } else {
            // Check and add any missing predefined categories
            const updatedStored = await ensurePredefinedCategories();
            categories = updatedStored;
        }
        console.log('[Categories] Init complete. Total:', categories.length);
        console.log('[Categories] List:', categories.map(c => `${c.emoji} ${c.name} (predefined: ${c.isPredefined})`));
    }

    async function load() {
        categories = await slpData.getCategories();
        return categories;
    }

    async function addCategory(name, emoji) {
        const newCat = {
            id: uid(),
            name: name.trim(),
            emoji: emoji || '📌',
            isPredefined: false
        };
        await slpData.saveCategory(newCat);
        await load();
        return newCat;
    }

    async function deleteCategory(id) {
        const cat = categories.find(c => c.id === id);
        if (cat?.isPredefined) {
            showToast('دسته‌بندی پیش‌فرض قابل حذف نیست', 'warning');
            return false;
        }
        const tasks = await slpData.getTasks();
        for (let task of tasks) {
            if (task.categoryId === id) {
                task.categoryId = 'other';
                await slpData.saveTask(task);
            }
        }
        await slpData.deleteCategory(id);
        await load();
        showToast('دسته‌بندی حذف شد', 'success');
        return true;
    }

    async function getCategoryById(id) {
        if (!categories.length) await load();
        return categories.find(c => c.id === id);
    }

    async function renderCategorySelect(selectElement, selectedId = '') {
        if (!selectElement) return;
        const cats = await load();
        selectElement.innerHTML = '<option value="">-- انتخاب --</option>' +
            cats.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.emoji} ${c.name}</option>`).join('');
    }

    // --------------------------------------------------------------
    // UI functions for the category modal
    // --------------------------------------------------------------
    async function renderCategoryList() {
        const container = document.getElementById('categoriesList');
        if (!container) return;
        const cats = await load();
        if (cats.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">هیچ دسته‌ای وجود ندارد</div>';
            return;
        }
        container.innerHTML = cats.map(cat => `
            <div class="category-item" data-id="${cat.id}">
                <div class="category-item-info">
                    <span>${cat.emoji}</span>
                    <span>${escHtml(cat.name)}</span>
                    ${cat.isPredefined ? '<span class="badge badge-accent">پیش‌فرض</span>' : ''}
                </div>
                ${!cat.isPredefined ? `<button class="category-delete-btn" data-id="${cat.id}">🗑</button>` : ''}
            </div>
        `).join('');

        document.querySelectorAll('.category-delete-btn').forEach(btn => {
            btn.removeEventListener('click', handleDeleteCategory);
            btn.addEventListener('click', handleDeleteCategory);
        });
    }

    async function handleDeleteCategory(e) {
        const id = e.currentTarget.dataset.id;
        if (!id) return;
        if (!confirm('آیا از حذف این دسته اطمینان دارید؟')) return;
        await deleteCategory(id);
        await renderCategoryList();
        window.dispatchEvent(new CustomEvent('slp:categoriesChanged'));
        showToast('دسته حذف شد', 'success');
    }

    async function handleAddCategory() {
        const nameInput = document.getElementById('newCategoryName');
        const emojiInput = document.getElementById('newCategoryEmoji');
        const name = nameInput.value.trim();
        const emoji = emojiInput.value.trim() || '📌';
        if (!name) {
            showToast('لطفاً نام دسته را وارد کنید', 'warning');
            return;
        }
        console.log('[Categories] Adding:', name, emoji);
        try {
            const newCat = await addCategory(name, emoji);
            console.log('[Categories] Added:', newCat);
            nameInput.value = '';
            emojiInput.value = '';
            await renderCategoryList();
            showToast(`دسته "${name}" اضافه شد`, 'success');
            window.dispatchEvent(new CustomEvent('slp:categoriesChanged'));
        } catch (err) {
            console.error('[Categories] Add failed:', err);
            showToast('خطا در افزودن دسته', 'error');
        }
    }

    function bindEvents() {
        const addBtn = document.getElementById('addCategoryBtn');
        if (addBtn) {
            addBtn.removeEventListener('click', handleAddCategory);
            addBtn.addEventListener('click', handleAddCategory);
        }
    }

    async function openModalAndRefresh() {
        await renderCategoryList();
        bindEvents();
        openModal('categoryModal');
    }

    // --------------------------------------------------------------
    // Expose public API
    // --------------------------------------------------------------
    return {
        init,
        load,
        addCategory,
        deleteCategory,
        getCategoryById,
        renderCategorySelect,
        openModalAndRefresh,
        get all() { return categories; }
    };
})();

// Auto-initialize when data is ready
window.addEventListener('slp:dataReady', async () => {
    console.log('[Categories] slp:dataReady received, initializing...');
    await CategoryManager.init();
    // Force refresh any category-dependent UI
    window.dispatchEvent(new CustomEvent('slp:categoriesChanged'));
});

// Also expose for manual use
window.CategoryManager = CategoryManager;
console.log('[Categories] Script loaded');