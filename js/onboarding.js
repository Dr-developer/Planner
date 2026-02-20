const OnboardingManager = (() => {
    function init() {
        const overlay = document.getElementById('onboardingOverlay');
        if (!overlay) return;

        if (localStorage.getItem('slp_onboarded') === 'true') {
            overlay.style.display = 'none';
            return;
        }

        overlay.style.display = 'flex';
        bindEvents();
    }

    function bindEvents() {
        const startBtn = document.getElementById('onboardingStartBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const nameInput = document.getElementById('onboardingName');
                const name = nameInput ? nameInput.value.trim() : '';
                if (!name) {
                    nameInput?.classList.add('input-error');
                    return;
                }
                localStorage.setItem('slp_username', name);
                document.querySelectorAll('#headerUsername, #headerUsername2').forEach(el => el.textContent = name);
                finish();  // directly finish instead of nextStep
            });
        }
    }

    function finish() {
        localStorage.setItem('slp_onboarded', 'true');
        const overlay = document.getElementById('onboardingOverlay');
        if (overlay) overlay.style.display = 'none';
        if (typeof showToast === 'function') showToast('خوش آمدید! 🎉', 'success');
    }

    return { init };
})();

// راه‌اندازی
document.addEventListener('DOMContentLoaded', () => {
    OnboardingManager.init();
});

// یا اگر از رویداد slp:dataReady استفاده می‌کنی:
document.addEventListener('slp:dataReady', () => {
    OnboardingManager.init();
});
