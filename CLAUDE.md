# Carpintería Huayapam ERP — Guía para IA / Desarrolladores

## Descripción
ERP para Carpintería Huayapam (Oaxaca, México). ~30 páginas HTML standalone servidas como archivos estáticos. El estado compartido vive en `window.parent.DB_STATE`. `db.js` es la capa cliente de base de datos. No hay framework frontend — HTML + JS vanilla.

## Stack
- **Frontend:** HTML + JS vanilla (sin React en producción)
- **Backend/DB:** Firebase Firestore
- **Hosting:** Firebase Hosting
- **Auth:** Firebase Auth
- **Firebase project:** `gen-lang-client-0827035586`
- **Firestore database ID:** `carpinteria-huayapam-erp`
- **URL en producción:** https://gen-lang-client-0827035586.web.app

## Desarrollo local
```bash
# Requiere la clave de servicio de Firebase Admin
GOOGLE_APPLICATION_CREDENTIALS="/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json" npm run dev
# Corre en http://localhost:5173
```

## ⚡ Cómo subir cambios al servidor (deploy)
Cada vez que modifiques archivos HTML, JS o CSS y quieras que los cambios sean visibles en producción:

```bash
cd "/Users/pablospada/Programming Projects/carpinteria-huayapam/Carpinteria-Huayapam-ERP"
firebase deploy --only hosting
```

Eso es todo. No hay build step — los archivos se suben tal cual.
Si también hiciste cambios en Firestore rules o indexes: `firebase deploy` (sin `--only hosting`).

## Cómo subir cambios a GitHub
```bash
git add -A
git commit -m "descripción del cambio"
git push
```

## Scripts de datos (Node.js)
```bash
# Poblar base de datos desde cero (contactos, categorías, inventario, etc.)
npm run seed

# Importar movimientos contables históricos (19k+ movimientos)
npm run seed:movimientos:import

# Solo generar CSV combinado de movimientos (sin subir a Firestore)
npm run seed:movimientos:combine
```

Los scripts de seed requieren `GOOGLE_APPLICATION_CREDENTIALS` apuntando a la clave de servicio. El `npm run seed` ya la incluye hardcodeada.

## Estructura de colecciones en Firestore
| Colección | Descripción |
|---|---|
| `contacts` | Clientes, proveedores y trabajadores. Campo `tipo`: `'cliente'`, `'proveedor'`, `'trabajador'` |
| `accounting_movements` | Movimientos contables. Campo `type`: `'Ingreso'`, `'Gasto'`, `'Transferencia'` |
| `bank_accounts` | Doc `main` con campo `list: ['CAJA', 'CHU', 'SATP', ...]` |
| `payment_methods` | Doc `main` con campo `list: ['EFECTIVO', 'TRANSF', ...]` |
| `expense_categories` | Categorías de ingresos y gastos |
| `inventory` | Conceptos de inventario |
| `projects` | Proyectos / obras |
| `settings` | Configuración general (doc `main`) |
| `workers` | Trabajadores (también en `contacts` con `tipo: 'trabajador'`) |

## Clave de servicio Firebase Admin
Ruta local: `/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json`
No subir al repositorio (está en .gitignore).
