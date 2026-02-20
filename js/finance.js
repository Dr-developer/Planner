'use strict';
/* ══════════════════════════════════════
   js/finance.js — Financial Management (optimized)
══════════════════════════════════════ */

let _editTransId = null;
let _finFilterMonth = '';
let _finFilterType = '';

// Predefined categories (should match the modal options)
const CATEGORY_ICONS = {
    food: '🍔',
    transport: '🚗',
    health: '💊',
    entertainment: '🎮',
    clothing: '👗',
    home: '🏠',
    education: '📚',
    bills: '📋',
    shopping: '🛍',
    salary: '💼',
    freelance: '💻',
    investment: '📈',
    gift: '🎁',
    other: '📦'
};

// Category display names
const CATEGORY_NAMES = {
    food: 'خوراک',
    transport: 'حمل‌ونقل',
    health: 'بهداشت',
    entertainment: 'سرگرمی',
    clothing: 'پوشاک',
    home: 'مسکن',
    education: 'آموزش',
    bills: 'قبوض',
    shopping: 'خرید',
    salary: 'حقوق',
    freelance: 'فریلنس',
    investment: 'سرمایه‌گذاری',
    gift: 'هدیه',
    other: 'سایر'
};

/* ───────── Helper: generate month options for filter ───────── */
function populateMonthFilter() {
    const select = document.getElementById('finFilterMonth');
    if (!select) return;
    const now = new Date();
    const options = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = d.toISOString().slice(0, 7); // YYYY-MM
        const label = d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long' });
        options.push(`<option value="${value}">${label}</option>`);
    }
    select.innerHTML = '<option value="">همه ماه‌ها</option>' + options.join('');
    select.value = '';
}

/* ───────── Render finance summary and transactions ───────── */
async function renderFinance() {
    const transactions = await slpData.getTransactions();

    // Apply filters
    let filtered = transactions;
    if (_finFilterMonth) {
        filtered = filtered.filter(t => t.date && t.date.startsWith(_finFilterMonth));
    }
    if (_finFilterType) {
        filtered = filtered.filter(t => t.type === _finFilterType);
    }

    // Calculate monthly totals (based on current month for summary, independent of filter)
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthlyIncome = transactions
        .filter(t => t.type === 'income' && t.date?.startsWith(thisMonth))
        .reduce((sum, t) => sum + (+t.amount || 0), 0);
    const monthlyExpense = transactions
        .filter(t => t.type === 'expense' && t.date?.startsWith(thisMonth))
        .reduce((sum, t) => sum + (+t.amount || 0), 0);
    const monthlyBalance = monthlyIncome - monthlyExpense;

    // Update summary cards
    document.getElementById('finIncome').textContent = formatAmount(monthlyIncome) + ' تومان';
    document.getElementById('finExpense').textContent = formatAmount(monthlyExpense) + ' تومان';
    document.getElementById('finBalance').textContent = formatAmount(monthlyBalance) + ' تومان';
    document.getElementById('finBalance').style.color = monthlyBalance >= 0 ? 'var(--green)' : 'var(--red)';

    // Render budget bars (call after transactions are loaded)
    renderBudgetBars(transactions);

    // Render transaction list (filtered and sorted newest first)
    const sorted = filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const listEl = document.getElementById('transactionsList');
    if (!listEl) return;

    if (sorted.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💳</div>
                <div class="empty-state-title">تراکنشی یافت نشد</div>
                <div class="empty-state-desc">تراکنش جدید اضافه کنید یا فیلترها را تغییر دهید</div>
                <button class="btn btn-primary mt-12" onclick="openAddTransactionModal()">+ افزودن تراکنش</button>
            </div>
        `;
        return;
    }

    listEl.innerHTML = sorted.map(t => transactionItemHTML(t)).join('');
}

function transactionItemHTML(t) {
    const icon = CATEGORY_ICONS[t.category] || '📦';
    const catName = CATEGORY_NAMES[t.category] || t.category || 'سایر';
    const amount = formatAmount(t.amount);
    const sign = t.type === 'income' ? '+' : '−';
    const amountClass = t.type === 'income' ? 'income' : 'expense';

    return `
        <div class="transaction-item" data-id="${t.id}">
            <div class="transaction-icon ${t.type}">${icon}</div>
            <div class="transaction-info">
                <div class="transaction-title">${escHtml(t.title || 'بدون عنوان')}</div>
                <div class="transaction-category">${catName}</div>
                <div class="transaction-date">${t.date ? new Date(t.date).toLocaleDateString('fa-IR') : '—'}</div>
            </div>
            <div class="transaction-amount ${amountClass}">${sign} ${amount}</div>
            <button class="btn-icon btn-ghost" onclick="deleteTransactionById('${t.id}')" title="حذف">🗑</button>
        </div>
    `;
}

/* ───────── Budget Bars (based on monthly budgets stored in settings) ───────── */
async function renderBudgetBars(transactions) {
    const budgetSection = document.getElementById('budgetSection');
    const budgetBars = document.getElementById('budgetBars');
    if (!budgetSection || !budgetBars) return;

    // Load budgets from settings (expects an object with category => amount)
    const budgets = (await slpData.getSetting('monthlyBudgets')) || {};
    const categories = Object.keys(budgets).filter(cat => budgets[cat] > 0);
    if (categories.length === 0) {
        budgetBars.innerHTML = '<div class="text-muted text-sm text-center" style="padding:16px">بودجه‌ای تنظیم نشده</div>';
        return;
    }

    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthlyExpenses = transactions
        .filter(t => t.type === 'expense' && t.date?.startsWith(thisMonth))
        .reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + (+t.amount || 0);
            return acc;
        }, {});

    const barsHTML = categories.map(cat => {
        const budget = budgets[cat];
        const spent = monthlyExpenses[cat] || 0;
        const percent = Math.min(100, Math.round((spent / budget) * 100));
        const catName = CATEGORY_NAMES[cat] || cat;
        return `
            <div class="budget-row">
                <span class="budget-label">${catName}</span>
                <div class="budget-bar">
                    <div class="progress-bar-track">
                        <div class="progress-bar-fill" style="width: ${percent}%; background: ${percent > 90 ? 'var(--red)' : percent > 70 ? 'var(--amber)' : 'var(--accent)'};"></div>
                    </div>
                </div>
                <span class="budget-pct">${formatAmount(spent)} / ${formatAmount(budget)}</span>
            </div>
        `;
    }).join('');

    budgetBars.innerHTML = barsHTML;
}

/* ───────── Transaction Modal (Add/Edit) ───────── */
function openAddTransactionModal() {
    _editTransId = null;
    // Reset form
    document.getElementById('transactionId').value = '';
    document.getElementById('transactionTitle').value = '';
    document.getElementById('transactionAmount').value = '';
    document.getElementById('transactionDate').value = today();
    document.getElementById('transactionCategory').value = 'food'; // default
    document.getElementById('transactionNote').value = '';
    // Set default type to income
    window.setTransType('income');
    // Hide delete button
    const deleteBtn = document.getElementById('deleteTransBtn');
    if (deleteBtn) deleteBtn.style.display = 'none';
    document.getElementById('transactionModalTitle').textContent = 'تراکنش جدید';
    openModal('transactionModal');
}

window.editTransaction = async function(id) {
    const transactions = await slpData.getTransactions();
    const trans = transactions.find(t => t.id === id);
    if (!trans) return;

    _editTransId = id;
    document.getElementById('transactionId').value = trans.id || '';
    document.getElementById('transactionTitle').value = trans.title || '';
    document.getElementById('transactionAmount').value = trans.amount || '';
    document.getElementById('transactionDate').value = trans.date || today();
    document.getElementById('transactionCategory').value = trans.category || 'other';
    document.getElementById('transactionNote').value = trans.note || '';
    // Set type
    window.setTransType(trans.type || 'income');
    // Show delete button
    const deleteBtn = document.getElementById('deleteTransBtn');
    if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    document.getElementById('transactionModalTitle').textContent = 'ویرایش تراکنش';
    openModal('transactionModal');
};

/* ───────── Save Transaction (Add/Edit) ───────── */
document.getElementById('saveTransactionBtn')?.addEventListener('click', async () => {
    const title = document.getElementById('transactionTitle').value.trim();
    const amount = parseFloat(document.getElementById('transactionAmount').value);
    if (!title) {
        showToast('عنوان تراکنش الزامی است', 'error');
        return;
    }
    if (!amount || amount <= 0) {
        showToast('مبلغ معتبر وارد کنید', 'error');
        return;
    }

    const type = document.getElementById('transactionType').value; // set by setTransType
    const transaction = {
        id:       _editTransId || uid(),
        title,
        amount,
        type,
        category: document.getElementById('transactionCategory').value,
        date:     document.getElementById('transactionDate').value || today(),
        note:     document.getElementById('transactionNote').value.trim(),
        updatedAt: new Date().toISOString()
    };
    if (!_editTransId) {
        transaction.createdAt = new Date().toISOString();
    }

    await slpData.saveTransaction(transaction);
    closeModal('transactionModal');
    renderFinance();
    if (typeof renderDashboard === 'function') renderDashboard();
    showToast(_editTransId ? 'تراکنش ویرایش شد' : 'تراکنش ثبت شد', 'success');
    checkBudgetAlert(); // re-check after change
});

/* ───────── Delete Transaction (from list or modal) ───────── */
window.deleteTransactionById = async function(id) {
    if (!confirm('آیا از حذف این تراکنش اطمینان دارید؟')) return;
    await slpData.deleteTransaction(id);
    renderFinance();
    if (typeof renderDashboard === 'function') renderDashboard();
    showToast('تراکنش حذف شد', 'info');
    checkBudgetAlert();
};

document.getElementById('deleteTransBtn')?.addEventListener('click', async () => {
    if (!_editTransId) return;
    if (!confirm('آیا از حذف این تراکنش اطمینان دارید؟')) return;
    await slpData.deleteTransaction(_editTransId);
    closeModal('transactionModal');
    renderFinance();
    if (typeof renderDashboard === 'function') renderDashboard();
    showToast('تراکنش حذف شد', 'info');
    checkBudgetAlert();
});

/* ───────── Filters ───────── */
document.getElementById('finFilterMonth')?.addEventListener('change', (e) => {
    _finFilterMonth = e.target.value;
    renderFinance();
});

document.getElementById('finFilterType')?.addEventListener('change', (e) => {
    _finFilterType = e.target.value;
    renderFinance();
});

/* ───────── Budget Modal ───────── */
async function openBudgetModal() {
    const budgets = (await slpData.getSetting('monthlyBudgets')) || {};
    const modalBody = document.getElementById('budgetModalBody');
    if (!modalBody) return;

    // Create input fields for each category that has a budget, plus a way to add new
    const categories = Object.keys(CATEGORY_NAMES);
    const rows = categories.map(cat => {
        const value = budgets[cat] || '';
        const catName = CATEGORY_NAMES[cat];
        return `
            <div class="form-group">
                <label class="form-label">${catName}</label>
                <input type="number" class="form-control budget-input" data-category="${cat}" value="${value}" min="0" placeholder="مبلغ (تومان)">
            </div>
        `;
    }).join('');

    modalBody.innerHTML = `
        <p class="text-muted mb-16">بودجه ماهانه برای هر دسته را وارد کنید (صفر = بدون بودجه).</p>
        ${rows}
    `;
    openModal('budgetModal');
}

// Save budget
document.getElementById('saveBudgetBtn')?.addEventListener('click', async () => {
    const inputs = document.querySelectorAll('#budgetModalBody .budget-input');
    const budgets = {};
    inputs.forEach(input => {
        const cat = input.dataset.category;
        const val = parseFloat(input.value);
        if (val > 0) budgets[cat] = val;
    });
    await slpData.saveSetting('monthlyBudgets', budgets);
    closeModal('budgetModal');
    renderFinance(); // re-render budget bars
    showToast('بودجه ذخیره شد', 'success');
    checkBudgetAlert();
});

/* ───────── Budget Alert ───────── */
async function checkBudgetAlert() {
    const budgets = (await slpData.getSetting('monthlyBudgets')) || {};
    if (Object.keys(budgets).length === 0) return;

    const transactions = await slpData.getTransactions();
    const thisMonth = new Date().toISOString().slice(0, 7);
    const expensesByCat = transactions
        .filter(t => t.type === 'expense' && t.date?.startsWith(thisMonth))
        .reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + (+t.amount || 0);
            return acc;
        }, {});

    let anyWarning = false;
    for (const [cat, budget] of Object.entries(budgets)) {
        const spent = expensesByCat[cat] || 0;
        if (spent >= budget * 0.9) {
            anyWarning = true;
            break;
        }
    }
    if (anyWarning) {
        showToast('⚠️ نزدیک به محدودیت بودجه در برخی دسته‌ها', 'warning', 5000);
    }
}

/* ───────── Attach event listener to "Budget" button ───────── */
document.querySelector('#page-finance .btn-secondary')?.addEventListener('click', (e) => {
    if (e.target.textContent.includes('بودجه')) {
        e.preventDefault();
        openBudgetModal();
    }
});

/* ───────── Initialise filter month and expose render function ───────── */
document.addEventListener('DOMContentLoaded', () => {
    populateMonthFilter();
});

window.renderFinance = renderFinance;
window.checkBudgetAlert = checkBudgetAlert;
window.openAddTransactionModal = openAddTransactionModal; // for empty state button