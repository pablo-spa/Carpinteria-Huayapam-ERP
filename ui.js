/**
 * ui.js - Centraliza funciones de interfaz de usuario para los iframes.
 */

window.toast = function(msg, type = 'ok') {
    if (window.parent && typeof window.parent.showToast === 'function') {
        window.parent.showToast(msg, type || 'ok');
        return;
    }
    // DOM toast fallback
    const colors = { ok: 'var(--green, #40a02b)', error: 'var(--red, #d20f39)', warn: 'var(--amber, #df8e1d)' };
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:70px;right:14px;z-index:9999;background:${colors[type]||colors.ok};color:#fff;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,.2);max-width:340px;`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
};

window.showConfirm = function(title, msg, btnText, btnClass) {
    return new Promise(resolve => {
        if (window.parent && typeof window.parent.showConfirm === 'function') {
            // El showConfirm del padre es callback-based, lo envolvemos en una promesa
            window.parent.showConfirm(title, msg, btnText, btnClass, 
                () => resolve(true),  // onConfirm
                () => resolve(false)  // onCancel
            );
        } else {
            resolve(confirm(title + "\n\n" + msg.replace(/<[^>]+>/g, '')));
        }
    });
};