/* Bank2Lexware – shared utilities for standalone converter pages.
   Each page sets window.B2L before loading this script:
     window.B2L = {
       brandColor:    '#0018A8',
       detailsLabel:  'Hier klicken für Buchungsvorschau',
       progressStep:  15,    // random increment max
       progressMs:    100    // interval ms
     };
*/

// ─── Dark-mode detection ────────────────────────
(function () {
    var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (mq && mq.matches) {
        document.documentElement.classList.add('theme-dark');
        document.documentElement.style.colorScheme = 'dark';
    }
    if (mq && mq.addEventListener) {
        mq.addEventListener('change', function (e) {
            document.documentElement.classList.toggle('theme-dark', e.matches);
            document.documentElement.style.colorScheme = e.matches ? 'dark' : 'light';
        });
    }
})();

// ─── Status / Error ─────────────────────────────
function showStatus(message, type) {
    type = type || 'info';
    var cfg = window.B2L || {};
    var brand = cfg.brandColor || '#003087';
    var label = cfg.detailsLabel || 'Hier klicken für Buchungsvorschau';
    var statusEl = document.getElementById('status');

    if (type === 'success') {
        statusEl.classList.add('hidden');

        var container = document.getElementById('conversion-details-container');
        var title = document.getElementById('details-title');
        var subtitle = document.getElementById('details-subtitle');

        container.classList.remove('hidden');
        container.className = "mt-8 text-left max-w-4xl mx-auto bg-green-50 rounded-xl shadow-sm border border-green-200 overflow-hidden transition-all";

        title.innerHTML = '✅ ' + message;
        title.className = "text-lg font-bold text-green-800 flex items-center";

        subtitle.textContent = label;
        subtitle.className = "text-sm text-green-600 mt-1";
    } else {
        statusEl.textContent = message;
        statusEl.className = 'mt-6 p-4 rounded-xl text-sm font-medium bg-blue-50 border-l-4';
        statusEl.style.color = brand;
        statusEl.style.borderLeftColor = brand;
        statusEl.classList.remove('hidden');

        if (type === 'info') {
            document.getElementById('conversion-details-container').classList.add('hidden');
        }
    }
}

function showError(message) {
    var statusEl = document.getElementById('status');
    statusEl.textContent = "⚠️ " + message;
    statusEl.className = 'mt-6 p-4 rounded-xl text-sm font-medium bg-red-50 text-[#C40029] border-l-4 border-[#C40029]';
    statusEl.classList.remove('hidden');
    document.getElementById('loading-indicator').classList.add('hidden');
    document.getElementById('conversion-details-container').classList.add('hidden');
}

// ─── UI helpers ─────────────────────────────────
function resetUI() {
    document.getElementById('status').classList.add('hidden');
    document.getElementById('download-area').classList.add('hidden');
    document.getElementById('date-selection-container').classList.add('hidden');
    document.getElementById('date-selection-content').classList.add('hidden');
    document.getElementById('date-selection-icon').style.transform = 'rotate(0deg)';
    document.getElementById('loading-indicator').classList.add('hidden');
    stopProgress();
    document.getElementById('conversion-details-container').classList.add('hidden');
    document.getElementById('conversion-details-content').classList.add('hidden');
    document.getElementById('details-icon').style.transform = 'rotate(0deg)';
    document.getElementById('conversion-table-body').innerHTML = '';
}

function toggleDetails() {
    var content = document.getElementById('conversion-details-content');
    var icon = document.getElementById('details-icon');
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
}

function toggleDateSelection() {
    var content = document.getElementById('date-selection-content');
    var icon = document.getElementById('date-selection-icon');
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
}

// ─── Progress bar ───────────────────────────────
var progressInterval;

function startProgress() {
    var cfg = window.B2L || {};
    var step = cfg.progressStep || 15;
    var ms = cfg.progressMs || 100;
    var bar = document.getElementById('progress-bar');
    var text = document.getElementById('progress-text');
    var width = 0;
    bar.style.width = '0%';
    text.textContent = '0%';

    clearInterval(progressInterval);
    progressInterval = setInterval(function () {
        if (width >= 90) {
            clearInterval(progressInterval);
        } else {
            width += Math.random() * step;
            if (width > 90) width = 90;
            bar.style.width = width + '%';
            text.textContent = Math.round(width) + '%';
        }
    }, ms);
}

function stopProgress() {
    clearInterval(progressInterval);
}

function completeProgress() {
    clearInterval(progressInterval);
    var bar = document.getElementById('progress-bar');
    var text = document.getElementById('progress-text');
    bar.style.width = '100%';
    text.textContent = '100%';
}

// ─── Copy email ─────────────────────────────────
function copyEmail() {
    var email = "al.oezalp@gmail.com";
    navigator.clipboard.writeText(email).then(function () {
        var textEl = document.getElementById('contact-text');
        var iconEl = document.getElementById('contact-icon');
        var tooltip = document.getElementById('copy-tooltip');

        var originalText = textEl.textContent;
        textEl.textContent = "Kopiert! ✅";
        textEl.classList.add('text-green-600');
        iconEl.textContent = "📋";

        tooltip.textContent = "Kopiert!";
        tooltip.classList.remove('opacity-0');

        setTimeout(function () {
            textEl.textContent = originalText;
            textEl.classList.remove('text-green-600');
            iconEl.textContent = "✉️";
            tooltip.classList.add('opacity-0');
            tooltip.textContent = "In Zwischenablage kopieren";
        }, 2000);
    }).catch(function (err) {
        console.error('Failed to copy: ', err);
    });
}
