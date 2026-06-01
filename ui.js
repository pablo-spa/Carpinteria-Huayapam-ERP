/**
 * ui.js - Centraliza funciones de interfaz de usuario para los iframes.
 */

window.toast = function(msg, type = 'ok') {
    if (window.parent && typeof window.parent.showToast === 'function') {
        window.parent.showToast(msg, type || 'ok');
    } else {
        console.log(`[TOAST] ${type ? type.toUpperCase() : 'OK'}: ${msg}`);
        alert(msg); // Fallback por si lo corres fuera del iframe
    }
};

window.showConfirm = function(title, msg, btnText, btnClass, onConfirm) {
    if (window.parent && typeof window.parent.showConfirm === 'function') {
        window.parent.showConfirm(title, msg, btnText, btnClass, onConfirm);
    } else {
        if(confirm(title + "\n\n" + msg.replace(/<[^>]+>/g, ''))) onConfirm();
    }
};