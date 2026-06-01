/**
 * combofield.js — Combobox con autocompletado y opción de nuevo
 *
 * Uso:
 *   const combo = createComboField(containerEl, options, config);
 *   combo.getValue()  → { value, label, isNew } | null
 *   combo.setValue(value, label)
 *   combo.reset()
 *   combo.setOptions(newOptions)  // reemplaza la lista
 *
 * options: [{ value: string, label: string }]
 * config:  { placeholder, allowNew, inputClass }
 */

(function () {
  // ── CSS (inyectado una sola vez) ─────────────────────────────
  function injectCSS() {
    if (document.getElementById('cbf-css')) return;
    const s = document.createElement('style');
    s.id = 'cbf-css';
    s.textContent = `
      .cbf-wrap { position: relative; }
      .cbf-input {
        width: 100%; padding: 8px 10px;
        border: 1px solid var(--crust, #dce0e8);
        border-radius: 8px;
        background: var(--base, #eff1f5);
        color: var(--text, #4c4f69);
        font-size: 13px; font-family: inherit;
        transition: border-color .15s;
      }
      .cbf-input:focus { outline: none; border-color: var(--blue, #1e66f5); }
      .cbf-input.is-new { border-color: var(--amber, #df8e1d); background: var(--amber-bg, #fdf3e5); }
      .cbf-dropdown {
        position: absolute; top: calc(100% + 3px); left: 0; right: 0;
        z-index: 9999; display: none;
        background: var(--base, #eff1f5);
        border: 1px solid var(--surface0, #ccd0da);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,.14);
        max-height: 240px; overflow-y: auto;
      }
      .cbf-dropdown.open { display: block; }
      .cbf-opt {
        padding: 9px 12px; font-size: 13px; cursor: pointer;
        border-bottom: 1px solid var(--crust, #dce0e8); line-height: 1.3;
      }
      .cbf-opt:last-child { border-bottom: none; }
      .cbf-opt:hover, .cbf-opt.cbf-focused { background: var(--surface0, #ccd0da); }
      .cbf-opt.cbf-new-opt {
        color: var(--blue, #1e66f5); font-weight: 600;
        background: var(--blue-bg, #e6eaf6);
      }
      .cbf-opt.cbf-new-opt:hover { filter: brightness(.96); }
      .cbf-empty { padding: 10px 12px; font-size: 12px; color: var(--subtext, #8c8fa1); text-align: center; }
      .cbf-match { background: rgba(30,102,245,.18); border-radius: 2px; }
    `;
    document.head.appendChild(s);
  }

  function highlight(text, q) {
    if (!q) return text;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) return text;
    return text.slice(0, i)
      + `<mark class="cbf-match">${text.slice(i, i + q.length)}</mark>`
      + text.slice(i + q.length);
  }

  // ── createComboField ─────────────────────────────────────────
  window.createComboField = function (container, initialOptions, cfg = {}) {
    injectCSS();

    const { placeholder = '— Buscar —', allowNew = false, inputClass = '' } = cfg;
    let options = initialOptions || [];
    let current = null; // { value, label, isNew }
    let focusIdx = -1;

    // DOM
    const wrap = document.createElement('div');
    wrap.className = 'cbf-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.className = 'cbf-input' + (inputClass ? ' ' + inputClass : '');

    const dd = document.createElement('div');
    dd.className = 'cbf-dropdown';

    wrap.appendChild(input);
    wrap.appendChild(dd);
    container.appendChild(wrap);

    // ── Rendering ───────────────────────────────────────────────
    function getFiltered(q) {
      if (!q) return options.slice(0, 25);
      const lower = q.toLowerCase();
      return options
        .map(o => ({ o, i: o.label.toLowerCase().indexOf(lower) }))
        .filter(x => x.i !== -1)
        .sort((a, b) => a.i - b.i)
        .map(x => x.o)
        .slice(0, 30);
    }

    function renderDD(q) {
      const filtered = getFiltered(q);
      dd.innerHTML = '';
      focusIdx = -1;

      if (!filtered.length && !q) {
        dd.classList.remove('open');
        return;
      }

      if (filtered.length === 0 && q) {
        if (!allowNew) {
          dd.innerHTML = `<div class="cbf-empty">Sin resultados para "${q}"</div>`;
          dd.classList.add('open');
          return;
        }
      }

      filtered.forEach(o => {
        const div = document.createElement('div');
        div.className = 'cbf-opt';
        div.innerHTML = highlight(o.label, q);
        div.addEventListener('mousedown', e => { e.preventDefault(); choose(o.value, o.label, false); });
        dd.appendChild(div);
      });

      if (allowNew && q.trim()) {
        const exact = options.some(o => o.label.toLowerCase() === q.trim().toLowerCase());
        if (!exact) {
          const div = document.createElement('div');
          div.className = 'cbf-opt cbf-new-opt';
          div.innerHTML = `✚ Agregar <b>"${q.trim()}"</b> como nuevo`;
          div.addEventListener('mousedown', e => { e.preventDefault(); choose(null, q.trim(), true); });
          dd.appendChild(div);
        }
      }

      dd.classList.add('open');
    }

    function choose(value, label, isNew) {
      current = { value, label, isNew };
      input.value = label;
      input.classList.toggle('is-new', isNew);
      closeDD();
      input.dispatchEvent(new Event('cbf-change', { bubbles: true }));
    }

    function closeDD() {
      dd.classList.remove('open');
      focusIdx = -1;
    }

    function commitTyped() {
      const q = input.value.trim();
      if (!q) { current = null; input.classList.remove('is-new'); return; }
      if (current && current.label === q) return; // already committed
      const exact = options.find(o => o.label.toLowerCase() === q.toLowerCase());
      if (exact) {
        choose(exact.value, exact.label, false);
      } else if (allowNew) {
        choose(null, q, true);
      }
    }

    // ── Events ──────────────────────────────────────────────────
    input.addEventListener('input', () => renderDD(input.value));
    input.addEventListener('focus', () => renderDD(input.value));
    input.addEventListener('blur',  () => setTimeout(() => { closeDD(); commitTyped(); }, 160));

    input.addEventListener('keydown', e => {
      const items = dd.querySelectorAll('.cbf-opt');
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items.forEach(i => i.classList.remove('cbf-focused'));
        focusIdx = Math.min(focusIdx + 1, items.length - 1);
        items[focusIdx].classList.add('cbf-focused');
        items[focusIdx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items.forEach(i => i.classList.remove('cbf-focused'));
        focusIdx = Math.max(focusIdx - 1, 0);
        items[focusIdx].classList.add('cbf-focused');
        items[focusIdx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const focused = dd.querySelector('.cbf-opt.cbf-focused');
        if (focused) focused.dispatchEvent(new Event('mousedown'));
        else closeDD();
      } else if (e.key === 'Escape') {
        closeDD();
      } else if (e.key === 'Tab') {
        closeDD();
        commitTyped();
      }
    });

    document.addEventListener('mousedown', e => {
      if (!wrap.contains(e.target)) { closeDD(); commitTyped(); }
    }, true);

    // ── Public API ───────────────────────────────────────────────
    return {
      getValue() { return current; },
      setValue(value, label) {
        current = { value, label, isNew: false };
        input.value = label;
        input.classList.remove('is-new');
      },
      reset() {
        current = null;
        input.value = '';
        input.classList.remove('is-new');
        closeDD();
      },
      setOptions(newOpts) {
        options = newOpts || [];
      },
      focus() { input.focus(); }
    };
  };
})();
