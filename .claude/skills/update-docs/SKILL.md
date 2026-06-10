---
invoke: user
---
# Actualizar Manual, Permisos y Reglas

Mantén sincronizados los tres archivos de administración del sistema con los cambios recientes en el ERP. Corre esto después de agregar módulos, cambiar nombres o ajustar permisos.

---

## Archivos a actualizar

| Archivo | Qué contiene |
|---|---|
| `wiki.html` | Manual del sistema. Nav lateral + artículos HTML. |
| `admin_permisos.html` | Tabla de permisos por rol. Array `SECTIONS` en JS. |
| `admin_config.html` | Reglas de asistencia, folios, vacaciones. Solo si se agregan nuevos ajustes. |

---

## Paso 1 — Detectar qué cambió

Corre esto para ver los últimos commits y archivos modificados:

```bash
cd "/Users/pablospada/Programming Projects/carpinteria-huayapam/Carpinteria-Huayapam-ERP"
git log --oneline -15
git diff HEAD~5 --name-only
```

También lee el `defaultMenuLayout` en `index.html` (líneas ~610–670) y la tabla de permisos en `defaultPerms` (líneas ~2179–2201) para ver el estado actual de módulos y permisos.

---

## Paso 2 — Actualizar `admin_permisos.html`

El array `SECTIONS` (líneas ~103–143) debe tener **exactamente** los mismos section IDs que `defaultPerms` en `index.html`.

**Para cada módulo nuevo:**
1. Identifica su `section ID` en `SECTION_MAP` de `index.html`.
2. Agrega una entrada en el grupo correcto del array `SECTIONS`:
   ```js
   { id: 'nuevo_id', label: 'Nombre en Pantalla', sub: 'Descripción breve de qué hace' },
   ```
3. Colócala en el grupo lógico (`Compras y Almacén`, `Administración del Sistema`, etc.).

**Para renombres:** Actualiza el campo `label` y `sub` de la entrada existente.

**No toques** la lógica de `cycle()`, `renderTable()`, `savePermissions()` ni los estilos.

---

## Paso 3 — Actualizar `wiki.html`

### Para módulos nuevos — agregar entrada en el nav lateral:
Busca el bloque `<div class="wiki-nav" id="wiki-nav">`. Agrega el ítem en la sección correcta:
```html
<div class="nav-item" data-search="palabras clave para búsqueda" onclick="showArticle('art-nombre-id', this)">Nombre del Módulo</div>
```

### Para módulos nuevos — agregar el artículo:
Al final de `<div class="wiki-content">`, antes del cierre `</div>`, agrega:
```html
<!-- ─────────────────────── NOMBRE MÓDULO ──────────────────────────── -->
<div class="wiki-article" id="art-nombre-id">
  <h1>Nombre del Módulo</h1>
  <p>Descripción general de para qué sirve.</p>

  <h2>¿Qué puedo hacer aquí?</h2>
  <ul>
    <li>Acción 1</li>
    <li>Acción 2</li>
  </ul>

  <h2>Quién tiene acceso</h2>
  <p>Roles con acceso: <strong>Admin, Gerencia</strong>.</p>
</div>
```

### Para renombres de módulos:
Actualiza el texto del `<div class="nav-item">` correspondiente y el `<h1>` del artículo.

### Clases de contenido disponibles:
- `.info-box` — tip azul
- `.warn-box` — advertencia amarilla
- `.green-box` — confirmación verde
- `.flow-steps` + `.flow-step` — diagrama de pasos numerados
- `.db-table` — tabla de base de datos con columnas y código

---

## Paso 4 — Actualizar `admin_config.html`

Solo necesita cambios si se agregan **nuevas configuraciones** de empresa (nuevos campos de settings en Firestore).

Si hay nuevos campos:
1. Agrega el `<div class="field">` con `<label>`, `<input>` y `.info-text` en la tarjeta correspondiente.
2. En `loadSettings()`, agrega: `document.getElementById('nuevo-campo').value = s.nuevoCampo ?? valorDefault;`
3. En `saveSettings()`, agrega: `nuevoCampo: document.getElementById('nuevo-campo').value,`

Si no hay nuevas configuraciones, omite este paso.

---

## Paso 5 — Deploy

```bash
cd "/Users/pablospada/Programming Projects/carpinteria-huayapam/Carpinteria-Huayapam-ERP"
firebase deploy --only hosting
```

---

## Cambios pendientes al invocar este skill

Detecta automáticamente qué falta comparando:
- `defaultMenuLayout` en `index.html` → con `SECTIONS` en `admin_permisos.html`
- Nav items en `wiki.html` → con los módulos en `defaultMenuLayout`

Si hay discrepancias, corrígelas. Si todo está sincronizado, díselo al usuario.

---

## Accumulated Knowledge

### Módulos sin artículo en el wiki (conocidos)
<!-- Agregar aquí módulos que intencionalmente no tienen artículo -->

### Módulos con permisos especiales
<!-- Módulos donde programador NO tiene acceso completo automático -->
- `admin_db` — solo `programador`, el resto `none`

### Historial de actualizaciones
<!-- Formato: fecha — qué se actualizó -->
- 2026-06-10 — Skill creado. Pendiente: agregar `passwords` a admin_permisos.html y wiki.html
