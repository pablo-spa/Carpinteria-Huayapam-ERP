/**
 * ui.js — Utilidades de UI compartidas entre todos los iframes.
 */

// ── Toast ──────────────────────────────────────────────────────────────────
window.toast = function(msg, type = 'ok') {
    if (window.parent && typeof window.parent.showToast === 'function') {
        window.parent.showToast(msg, type || 'ok');
        return;
    }
    const colors = { ok: 'var(--green, #40a02b)', error: 'var(--red, #d20f39)', warn: 'var(--amber, #df8e1d)' };
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:70px;right:14px;z-index:9999;background:${colors[type]||colors.ok};color:#fff;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,.2);max-width:340px;`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
};

// ── Confirm modal ──────────────────────────────────────────────────────────
window.showConfirm = function(title, msg, btnText, btnClass, onConfirm) {
    if (window.parent && typeof window.parent.showConfirm === 'function') {
        window.parent.showConfirm(title, msg, btnText, btnClass, onConfirm);
    } else {
        if (confirm(title + '\n\n' + msg.replace(/<[^>]+>/g, ''))) onConfirm();
    }
};

// ── Formato de dinero ──────────────────────────────────────────────────────
// Uso: fmt(1234.5) → "$1,234.50"   fmt(null) → "$0.00"
window.fmt = n => '$' + (parseFloat(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Formato de fecha legible ───────────────────────────────────────────────
// Uso: fmtFecha('2025-06-09') → "9 jun 2025"   fmtFecha(null) → "—"
window.fmtFecha = str => {
    if (!str) return '—';
    return new Date(str + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};
