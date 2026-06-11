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

/**
 * Renderiza de manera estandarizada el HTML de un artículo de compra.
 * opts = { showPrice: boolean }
 */
window.renderPurchaseCardItem = function(item, opts = {}) {
  const isMadera = item.tipo === 'madera';
  const isHerr = item.esHerramienta || item.tipo === 'herramienta';
  
  let icon = isMadera ? '🪵' : (isHerr ? '🔧' : '📦');
  let pillClass = isMadera ? 'std-pill-madera' : (isHerr ? 'std-pill-herr' : 'std-pill-insumo');
  let pillLabel = isMadera ? 'Madera' : (isHerr ? 'Herramienta' : 'Insumo');
  
  let title = '';
  if (isMadera) {
    const parts = [];
    if (item.nombre && item.nombre.trim()) parts.push(item.nombre);
    
    // Si no hay 'nombre' (legacy), pero hay 'especie', tratamos especie como el nombre principal
    if (!item.nombre && item.especie && item.especie !== 'Madera') {
      parts.push(item.especie);
    } else if (item.nombre && item.especie) {
      parts.push(item.especie);
    }
    
    if (item.calidad) parts.push(item.calidad);
    
    title = parts.join(' - ') || 'Madera';
  } else {
    title = item.name || item.code || item.descripcion || '—';
  }
  
  const qtyStr = (isMadera ? (item.cantidad || 1) : (item.qty || 0)) + ' ' + (item.unit || 'pza');
  
  let priceHtml = '';
  if (opts.showPrice && typeof item.price === 'number') {
    const total = (item.price || 0) * (isMadera ? (item.cantidad||1) : (item.qty||0));
    priceHtml = `
      <div class="std-item-price">
        <span class="std-item-price-unit">$${item.price.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2})}/u</span>
        <span class="std-item-price-total">$${total.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
      </div>`;
  }
  
  let extraHtml = '';
  if (opts.showSupplier && (item.proveedorNombre || item.provider || opts.orderProvider)) {
    const prov = item.proveedorNombre || item.provider || opts.orderProvider;
    extraHtml = `<div style="font-size:11.5px;color:var(--subtext);margin-top:4px;">🏭 Proveedor: <strong>${prov}</strong></div>`;
  }
  
  const wrapperStart = opts.withCheckbox 
    ? `<label class="std-item" style="cursor:pointer; align-items:center;" ${opts.checkboxId ? `for="${opts.checkboxId}"` : ''}>` 
    : `<div class="std-item">`;
  const wrapperEnd = opts.withCheckbox ? `</label>` : `</div>`;
  const chkHtml = opts.withCheckbox 
    ? `<input type="checkbox" class="std-item-chk" ${opts.checkboxId ? `id="${opts.checkboxId}"` : ''} checked style="margin-right:8px; width:18px; height:18px; flex-shrink:0; cursor:pointer;">` 
    : '';

  return `
    ${wrapperStart}
      ${chkHtml}
      <div class="std-item-main">
        <div class="std-item-title-row">
          <span class="std-item-icon">${icon}</span>
          <span class="std-item-title">${title.replace(/</g, '&lt;')}</span>
          <span class="std-item-pill ${pillClass}">${pillLabel}</span>
        </div>
        ${priceHtml}
        ${extraHtml}
      </div>
      <div class="std-item-qty">${qtyStr}</div>
    ${wrapperEnd}
  `;
};