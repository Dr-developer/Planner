// js/pwa.js

const PWA = {
    init() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js');
        }
    }
};
