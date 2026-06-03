/**
 * searchable-select.js
 * Replaces <select data-searchable> elements with a type-to-search input.
 * Supports substring and fuzzy matching with ranked results.
 *
 * Usage:
 *   <select data-searchable id="my-sel">...</select>
 *   SearchableSelect.init(document.getElementById('my-sel'));  // manual
 *   SearchableSelect.initAll();  // all [data-searchable] in document
 */

const SearchableSelect = (() => {
  // ── Matching ────────────────────────────────────────────────────────
  function score(text, query) {
    const t = text.toLowerCase(), q = query.toLowerCase();
    if (!q) return 0;
    if (t === q) return 0;
    if (t.startsWith(q)) return 1;
    if (t.includes(q)) return 2;
    // fuzzy: all chars appear in order
    let ti = 0;
    for (let i = 0; i < q.length; i++) {
      ti = t.indexOf(q[i], ti);
      if (ti === -1) return Infinity;
      ti++;
    }
    return 3;
  }

  // ── DOM helpers ─────────────────────────────────────────────────────
  function buildCSS() {
    if (document.getElementById('ss-style')) return;
    const s = document.createElement('style');
    s.id = 'ss-style';
    s.textContent = `
      .ss-wrap { position: relative; display: inline-block; width: 100%; }
      .ss-input {
        width: 100%; padding: 9px 32px 9px 11px;
        border: 1px solid var(--crust, #dce0e8);
        border-radius: 8px;
        background: var(--mantle, #e6e9ef);
        color: var(--text, #4c4f69);
        font-size: 13px; font-family: inherit;
        box-sizing: border-box; cursor: pointer;
        transition: border-color .15s;
      }
      .ss-input:focus { outline: none; border-color: var(--blue, #1e66f5); }
      .ss-input:disabled { opacity: .55; cursor: default; }
      .ss-arrow {
        position: absolute; right: 10px; top: 50%;
        transform: translateY(-50%);
        pointer-events: none; color: var(--subtext, #8c8fa1);
        font-size: 10px;
      }
      .ss-dropdown {
        position: fixed;
        background: var(--base, #eff1f5);
        border: 1px solid var(--surface0, #ccd0da);
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,.12);
        z-index: 9999; overflow: hidden;
        display: none; flex-direction: column; max-height: 280px;
      }
      .ss-opt[data-value="__new__"] { color: var(--blue, #1e66f5); font-weight: 700; }
      .ss-dropdown.open { display: flex; }
      .ss-search-wrap {
        padding: 8px 8px 4px;
        border-bottom: 1px solid var(--crust, #dce0e8);
        flex-shrink: 0;
      }
      .ss-search {
        width: 100%; padding: 7px 10px;
        border: 1px solid var(--surface0, #ccd0da);
        border-radius: 6px;
        background: var(--mantle, #e6e9ef);
        color: var(--text, #4c4f69);
        font-size: 13px; font-family: inherit;
        box-sizing: border-box;
      }
      .ss-search:focus { outline: none; border-color: var(--blue, #1e66f5); }
      .ss-list { overflow-y: auto; flex: 1; }
      .ss-opt {
        padding: 9px 14px; font-size: 13px;
        color: var(--text, #4c4f69); cursor: pointer;
        border-bottom: 1px solid var(--crust, #dce0e8);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .ss-opt:last-child { border-bottom: none; }
      .ss-opt:hover, .ss-opt.focused { background: var(--surface0, #ccd0da); }
      .ss-opt.selected { font-weight: 700; color: var(--blue, #1e66f5); }
      .ss-opt-group {
        padding: 5px 14px 3px;
        font-size: 10px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .05em;
        color: var(--subtext, #8c8fa1);
        background: var(--mantle, #e6e9ef);
        border-bottom: 1px solid var(--crust, #dce0e8);
      }
      .ss-empty {
        padding: 16px 14px; font-size: 13px;
        color: var(--subtext, #8c8fa1); text-align: center;
      }
      .ss-match { background: rgba(30,102,245,.15); border-radius: 2px; }
    `;
    document.head.appendChild(s);
  }

  function highlight(text, query) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return text.slice(0, idx) +
      `<mark class="ss-match">${text.slice(idx, idx + query.length)}</mark>` +
      text.slice(idx + query.length);
  }

  // ── Core ─────────────────────────────────────────────────────────────
  function init(select) {
    if (!select || select._ssInit) return;
    select._ssInit = true;
    select.style.display = 'none';

    buildCSS();

    // Build option list from select (including optgroups)
    function getOptions() {
      const opts = [];
      for (const child of select.children) {
        if (child.tagName === 'OPTGROUP') {
          for (const opt of child.children) {
            opts.push({ value: opt.value, text: opt.textContent.trim(), group: child.label, disabled: opt.disabled });
          }
        } else {
          opts.push({ value: child.value, text: child.textContent.trim(), group: null, disabled: child.disabled });
        }
      }
      return opts;
    }

    // Wrapper
    const wrap = document.createElement('div');
    wrap.className = 'ss-wrap';
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);

    // Trigger input (shows selected value)
    const trigger = document.createElement('input');
    trigger.className = 'ss-input';
    trigger.type = 'text';
    trigger.readOnly = true;
    trigger.placeholder = select.options[0]?.text || '— Seleccionar —';
    trigger.setAttribute('autocomplete', 'off');
    wrap.insertBefore(trigger, select);

    const arrow = document.createElement('span');
    arrow.className = 'ss-arrow';
    arrow.textContent = '▼';
    wrap.appendChild(arrow);

    // Dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'ss-dropdown';
    wrap.appendChild(dropdown);

    const searchWrap = document.createElement('div');
    searchWrap.className = 'ss-search-wrap';
    const searchInput = document.createElement('input');
    searchInput.className = 'ss-search';
    searchInput.type = 'text';
    searchInput.placeholder = 'Buscar…';
    searchWrap.appendChild(searchInput);
    dropdown.appendChild(searchWrap);

    const list = document.createElement('div');
    list.className = 'ss-list';
    dropdown.appendChild(list);

    let focusedIdx = -1;

    function renderList(query) {
      const opts = getOptions();
      const q = (query || '').trim();

      // Score and filter
      let scored = opts
        .filter(o => !o.disabled || o.value === '')
        .map(o => ({ ...o, s: score(o.text, q) }))
        .filter(o => o.s < Infinity);

      if (q) scored.sort((a, b) => a.s - b.s || a.text.localeCompare(b.text));

      list.innerHTML = '';
      focusedIdx = -1;

      if (!scored.length) {
        list.innerHTML = `<div class="ss-empty">Sin resultados para "${q}"</div>`;
        return;
      }

      let lastGroup = null;
      scored.forEach((o, i) => {
        if (o.group && o.group !== lastGroup) {
          const grp = document.createElement('div');
          grp.className = 'ss-opt-group';
          grp.textContent = o.group;
          list.appendChild(grp);
          lastGroup = o.group;
        }
        const div = document.createElement('div');
        div.className = 'ss-opt' + (o.value === select.value ? ' selected' : '');
        div.dataset.value = o.value;
        div.dataset.text  = o.text;
        div.dataset.idx   = i;
        div.innerHTML = highlight(o.text, q);
        div.addEventListener('mousedown', e => {
          e.preventDefault();
          choose(o.value, o.text);
        });
        list.appendChild(div);
      });
    }

    function choose(value, text) {
      select.value = value;
      // If value wasn't in original options (dynamic), add it
      if (select.value !== value) {
        const opt = document.createElement('option');
        opt.value = value; opt.textContent = text;
        select.appendChild(opt);
        select.value = value;
      }
      trigger.value = value ? text : '';
      trigger.placeholder = select.options[0]?.text || '— Seleccionar —';
      close();
      // Dispatch change event so onchange handlers fire
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function reposition() {
      const rect = trigger.getBoundingClientRect();
      dropdown.style.top   = (rect.bottom + 4) + 'px';
      dropdown.style.left  = rect.left + 'px';
      dropdown.style.width = rect.width + 'px';
    }

    function open() {
      if (trigger.disabled) return;
      reposition();
      renderList('');
      searchInput.value = '';
      dropdown.classList.add('open');
      arrow.textContent = '▲';
      setTimeout(() => searchInput.focus(), 10);
    }

    function close() {
      dropdown.classList.remove('open');
      arrow.textContent = '▼';
      focusedIdx = -1;
    }

    // Mantener dropdown alineado al hacer scroll (position:fixed no sigue al elemento)
    document.addEventListener('scroll', () => {
      if (dropdown.classList.contains('open')) reposition();
    }, { passive: true, capture: true });

    function moveFocus(delta) {
      const items = list.querySelectorAll('.ss-opt');
      if (!items.length) return;
      items.forEach(i => i.classList.remove('focused'));
      focusedIdx = Math.max(0, Math.min(items.length - 1, focusedIdx + delta));
      items[focusedIdx].classList.add('focused');
      items[focusedIdx].scrollIntoView({ block: 'nearest' });
    }

    trigger.addEventListener('click', () => dropdown.classList.contains('open') ? close() : open());

    searchInput.addEventListener('input', () => renderList(searchInput.value));

    searchInput.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const focused = list.querySelector('.ss-opt.focused');
        if (focused) choose(focused.dataset.value, focused.dataset.text);
      }
      else if (e.key === 'Escape') close();
    });

    document.addEventListener('mousedown', e => {
      if (!wrap.contains(e.target)) close();
    }, true);

    // Sync trigger when select changes externally (e.g. JS sets select.value)
    const origValueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    select._ssSync = () => {
      const sel = select.options[select.selectedIndex];
      trigger.value = sel && sel.value ? sel.textContent.trim() : '';
    };

    // Public API: call select._ssSync() or select._ssRefresh() after updating options
    select._ssRefresh = () => {
      select._ssSync();
      renderList(searchInput.value);
    };

    // Disable state mirroring
    const disObs = new MutationObserver(() => {
      trigger.disabled = select.disabled;
    });
    disObs.observe(select, { attributes: true, attributeFilter: ['disabled'] });

    // Set initial display value
    select._ssSync();
  }

  function initAll(root) {
    const ctx = root || document;
    ctx.querySelectorAll('select[data-searchable]').forEach(init);
  }

  return { init, initAll };
})();

// Auto-init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SearchableSelect.initAll());
} else {
  SearchableSelect.initAll();
}
