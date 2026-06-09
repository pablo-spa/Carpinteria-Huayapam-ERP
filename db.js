function getDB() {
  if (window.parent && window.parent.DB_STATE_LOADED) {
    // Clonación superficial de las colecciones, no un clonado profundo del objeto global
    // Esto previene que el navegador se congele al tener miles de registros
    const stateClone = { ...window.parent.DB_STATE };
    for (let key in stateClone) {
      if (Array.isArray(stateClone[key])) stateClone[key] = [...stateClone[key]];
    }
    return stateClone;
  }
  return {
    _isIncomplete: true,
    workers: [], contacts: [], inventory: [], projects: [], quotations: [], quotations_viaticos: [], orders: [], accounting_movements: [],
    settings: {}, systemEvents: [], attendance: [],
    project_worker_hours: [], viajes: [], anticipos_viaticos: [], gastos_viaticos: [], notifications: [], wood: [],
    actividades_trabajo: [], inventory_salidas: [], attendance_logs: []
  };
}

function saveDB(newData) {
  if (!window.parent) return;

  if (newData._isIncomplete || !window.parent.DB_STATE_LOADED) {
    console.warn("BLOCKED saveDB: DB not ready.");
    return;
  }

  if (!window.parent.DB_STATE) {
    window.parent.DB_STATE = newData;
    return;
  }

  const liveState = window.parent.DB_STATE;
  const collections = Object.keys(newData);

  collections.forEach(col => {
    if (col === 'attendance_logs' || col === '_isIncomplete') return;

    const liveArr = liveState[col];
    const newArr  = newData[col];

    if (Array.isArray(newArr) && Array.isArray(liveArr)) {
      newArr.forEach(newItem => {
        const id = newItem.id || newItem._id;
        if (!id || newItem._init) return;

        const liveItem = liveArr.find(x => (x.id || x._id) === id);
        if (!liveItem) {
          // New item: add to live state and persist
          liveArr.push(newItem);
          if (window.parent.setDocumentInFirebase) {
            window.parent.setDocumentInFirebase(col, id, newItem);
          }
        } else if (JSON.stringify(liveItem) !== JSON.stringify(newItem)) {
          // Changed item: update live state and persist
          const idx = liveArr.indexOf(liveItem);
          liveArr[idx] = newItem;
          if (window.parent.setDocumentInFirebase) {
            window.parent.setDocumentInFirebase(col, id, newItem);
          }
        }
      });
      // NOTE: intentionally NOT deleting items here.
      // Deletions must be done explicitly via deleteDocumentFromFirebase.
    } else if (col === 'settings' && newArr && typeof newArr === 'object' && !Array.isArray(newArr)) {
      if (JSON.stringify(liveState.settings) !== JSON.stringify(newArr)) {
        liveState.settings = newArr;
        if (window.parent.setDocumentInFirebase) {
          window.parent.setDocumentInFirebase('settings', 'main', newArr);
        }
      }
    }
  });
}

window.DB = {
  get: getDB,
  save: saveDB,
  query: async (collectionName, filters = {}) => {
      // WaitFor DB_STATE only if we are in an iframe and parent is managing state
      let loops = 0;
      if (window.parent && window.parent !== window) {
          while (!window.parent.DB_STATE_LOADED && loops < 300) {
              await new Promise(r => setTimeout(r, 100));
              loops++;
          }
      }
      
      let parentState = (window.parent && window.parent !== window && window.parent.DB_STATE) ? window.parent.DB_STATE : window.DB_STATE;

      // Carga bajo demanda: si la colección aún no está en DB_STATE, pedirla al padre
      if (parentState && parentState[collectionName] === undefined &&
          window.parent && window.parent !== window && window.parent.cargar_coleccion) {
        await window.parent.cargar_coleccion(collectionName);
        parentState = window.parent.DB_STATE;
      }

      let data = [];
      if (parentState && parentState[collectionName]) {
         data = parentState[collectionName];
      } else {
         const localD = getDB();
         if (localD && localD[collectionName]) data = localD[collectionName];
      }
      
      // Migration alias mapping
      if (collectionName === 'contacts') {
          // If contacts doesn't have it, use workers collection to ease migration
          let merged = [...data];
          let workerData = (parentState && parentState.workers) ? parentState.workers : (getDB().workers || []);
          if (workerData) {
             const workersMapped = workerData.map(w => ({...w, tipo: 'trabajador', activo: true}));
             // Deduplicate by ID
             for (const w of workersMapped) {
                 if (!merged.find(x => x.id === w.id)) {
                     merged.push(w);
                 }
             }
          }
          data = merged;
      }
      
      // Filter the data

      return JSON.parse(JSON.stringify(data)).filter(item => {
          for (const key in filters) {
             if (item[key] !== filters[key]) return false;
          }
          return true;
      });
  },
  addColumn: (collection, columnName, defaultValue = "") => {
    const d = getDB();
    if (!d[collection]) return;
    d[collection].forEach((item) => {
      if (item[columnName] === undefined) {
        item[columnName] = defaultValue;
        if(window.parent && window.parent.setDocumentInFirebase && item.id) {
           window.parent.setDocumentInFirebase(collection, item.id, item);
        }
      }
    });
    saveDB(d);
  },
  addTable: (tableName) => {
    const d = getDB();
    if (!d[tableName]) {
      d[tableName] = [];
      saveDB(d);
    }
  },
  addWood: (item) => {
    const d = getDB();
    if(!item.id) item.id = crypto.randomUUID();
    
    // Legacy support
    d.wood.unshift(item);
    if(window.parent && window.parent.setDocumentInFirebase) window.parent.setDocumentInFirebase("wood", item.id, item);
    
    // New system: map wood directly into inventory
    const nameStr = `${item.format || 'Tabla'} ${item.species} ${item.t}"x${item.w}"x${item.l}' (${item.quality})`;
    const invItem = {
       id: item.id, // match ID
       code: item.code,
       name: nameStr,
       category: 'madera',
       stock: 1, // each scanned piece is 1
       min: 0,
       unit: 'pieza',
       cost: item.cost || 0,
       location: item.location || '',
       details: `Lote: ${item.lote} | PT: ${item.pt ? item.pt.toFixed(2) : '-'}`,
       entryDate: item.entryDate,
       // Include native wood properties for wood views
       species: item.species,
       lote: item.lote,
       format: item.format,
       t: item.t,
       w: item.w,
       l: item.l,
       pt: item.pt,
       quality: item.quality
    };
    
    d.inventory.unshift(invItem);
    if(window.parent && window.parent.setDocumentInFirebase) window.parent.setDocumentInFirebase("inventory", invItem.id, invItem);
    
    saveDB(d);
  },
  addMovement: (mov) => {
    if(!mov.id) mov.id = crypto.randomUUID();
    // Siempre persistir en Firestore primero (no depende de que la colección esté cacheada)
    if(window.parent && window.parent.setDocumentInFirebase) window.parent.setDocumentInFirebase("accounting_movements", mov.id, mov);
    // Actualizar DB_STATE en memoria si existe
    if(window.parent && window.parent.DB_STATE) {
      if(!window.parent.DB_STATE.accounting_movements) window.parent.DB_STATE.accounting_movements = [];
      window.parent.DB_STATE.accounting_movements.unshift(mov);
    }
    // También guardar en la copia local si está cargada
    const d = getDB();
    if(d && !d._isIncomplete && Array.isArray(d.accounting_movements)) {
      d.accounting_movements.unshift(mov);
      saveDB(d);
    }
  },
  updateMovement: (mov) => {
    const d = getDB();
    const idx = d.accounting_movements.findIndex(m => m.id === mov.id);
    if (idx !== -1) {
       d.accounting_movements[idx] = mov;
       if(window.parent && window.parent.setDocumentInFirebase) window.parent.setDocumentInFirebase("accounting_movements", mov.id, mov);
       saveDB(d);
    }
  },
  updateInventoryStock: async (code, qtyChange) => {
    const d = getDB();
    const item = d.inventory.find((i) => i.code === code);
    if (item) {
      item.stock += qtyChange;
      if(window.parent && window.parent.incrementFieldInFirebase && item.id) await window.parent.incrementFieldInFirebase("inventory", item.id, "stock", qtyChange);
      saveDB(d);
    }
  },
  logInventoryPurchase: async (code, qty, price, date = new Date().toISOString().slice(0, 10)) => {
    const d = getDB();
    const item = d.inventory.find((i) => i.code === code);
    if (item) {
      item.stock += qty;
      item.lastPurchaseDate = date;
      
      const extraUpdates = { lastPurchaseDate: date };

      if (price > 0 && item.cost !== price) {
        item.cost = price;
        if (!item.priceHistory) item.priceHistory = [];
        item.priceHistory.push({ date: date, price: price });
        
        extraUpdates.cost = price;
        extraUpdates.priceHistory = item.priceHistory;
      }
      if(window.parent && window.parent.incrementFieldInFirebase && item.id) await window.parent.incrementFieldInFirebase("inventory", item.id, "stock", qty, extraUpdates);
      saveDB(d);
    }
  },
  addOrUpdateInventory: (item) => {
    const d = getDB();
    const ex = d.inventory.find((i) => i.code === item.code);
    if (ex) {
      Object.assign(ex, item);
      if(window.parent && window.parent.setDocumentInFirebase && ex.id) window.parent.setDocumentInFirebase("inventory", ex.id, ex);
    } else {
      if(!item.id) item.id = crypto.randomUUID();
      d.inventory.push(item);
      if(window.parent && window.parent.setDocumentInFirebase && item.id) window.parent.setDocumentInFirebase("inventory", item.id, item);
    }
    saveDB(d);
  },
  addAttendance: (record) => {
    const d = getDB();
    if(!record.id) record.id = crypto.randomUUID();
    
    // Save to attendance_logs — usar nombres en español, mantener alias inglés para compatibilidad con reloj checador
    if (!d.attendance_logs) d.attendance_logs = [];
    const attLog = {
       id:           record.id,
       trabajadorId: record.trabajadorId || record.workerId,
       workerId:     record.trabajadorId || record.workerId, // alias para reloj checador
       fecha:        record.fecha || record.date,
       estado:       record.estado || record.status,
       status:       record.estado || record.status,         // alias legacy
       entrada:      record.entrada || '',
       salida:       record.salida  || '',
       horasNormal:  record.horasNormal  != null ? record.horasNormal  : (record.hours    || 0),
       horasExtra:   record.horasExtra   != null ? record.horasExtra   : (record.horas_x15 || 0),
       horasDoble:   record.horasDoble   != null ? record.horasDoble   : (record.horas_x2  || 0),
       horasTotales: record.horasTotales != null ? record.horasTotales : (record.hours     || 0),
       retardoMin:   record.retardoMin   || 0,
       notas:        record.notas        || ''
    };

    // Update or insert
    const aIdx = d.attendance_logs.findIndex(x => (x.trabajadorId || x.workerId) === attLog.trabajadorId && x.fecha === attLog.fecha && x.tipo !== 'entrada' && x.tipo !== 'salida');
    if (aIdx >= 0) d.attendance_logs[aIdx] = { ...d.attendance_logs[aIdx], ...attLog };
    else d.attendance_logs.push(attLog);
    
    if(window.parent && window.parent.setDocumentInFirebase) {
        window.parent.setDocumentInFirebase("attendance_logs", attLog.id, attLog);
    }

    // Sync to live DB_STATE (saveDB skips attendance_logs intentionally)
    if (window.parent && window.parent.DB_STATE) {
        if (!window.parent.DB_STATE.attendance_logs) window.parent.DB_STATE.attendance_logs = [];
        const liveIdx = window.parent.DB_STATE.attendance_logs.findIndex(x => x.id === attLog.id);
        if (liveIdx >= 0) window.parent.DB_STATE.attendance_logs[liveIdx] = attLog;
        else window.parent.DB_STATE.attendance_logs.push(attLog);
    }

    // Maintain legacy attendance collection for compatibility
    d.attendance.push(record);
    if(window.parent && window.parent.setDocumentInFirebase) {
        window.parent.setDocumentInFirebase("attendance", record.id, record);
    }
    
    // Generate production_logs
    const proyectosArr = record.proyectos || record.projects;
    if (proyectosArr && Array.isArray(proyectosArr)) {
        if (!d.production_logs) d.production_logs = [];
        proyectosArr.forEach(p => {
             if (!p.p) return;
             const pLog = {
                 id:              crypto.randomUUID(),
                 trabajadorId:    record.trabajadorId || record.workerId,
                 proyectoId:      p.p,
                 fecha:           record.fecha || record.date,
                 actividad:       p.actividad || '',
                 descripcion:     p.descripcion || p.pieza || '',
                 horasTrabajadas: parseFloat(p.horas) || (record.horasTotales ? record.horasTotales / proyectosArr.length : 0)
             };
             d.production_logs.push(pLog);
             if(window.parent && window.parent.setDocumentInFirebase) {
                 window.parent.setDocumentInFirebase("production_logs", pLog.id, pLog);
             }
        });
    }
    
    saveDB(d);
  },
  addContact: (contact) => {
    const d = getDB();
    if(!contact.id) contact.id = crypto.randomUUID();
    d.contacts.push(contact);
    if(window.parent && window.parent.setDocumentInFirebase) window.parent.setDocumentInFirebase("contacts", contact.id, contact);
    saveDB(d);
  },
  updateContact: (contact) => {
    const d = getDB();
    const idx = d.contacts.findIndex((c) => c.id === contact.id);
    if (idx !== -1) {
      d.contacts[idx] = { ...d.contacts[idx], ...contact };
      if(window.parent && window.parent.setDocumentInFirebase && contact.id) window.parent.setDocumentInFirebase("contacts", contact.id, d.contacts[idx]);
      saveDB(d);
    }
  },
  saveSettings: (settings) => {
    const d = getDB();
    d.settings = settings;
    if(window.parent && window.parent.setDocumentInFirebase) window.parent.setDocumentInFirebase("settings", "main", settings);
    saveDB(d);
  },
  addSystemEvent: (type, text) => {
    const d = getDB();
    if (!d.systemEvents) d.systemEvents = [];
    const ev = { id: crypto.randomUUID(), date: new Date().toISOString(), type, text };
    d.systemEvents.push(ev);
    if(window.parent && window.parent.setDocumentInFirebase) window.parent.setDocumentInFirebase("systemEvents", ev.id, ev);
    saveDB(d);
  },
  updateWorker: (worker) => {
    const d = getDB();
    const idx = d.workers.findIndex((w) => w.id === worker.id);
    if (idx !== -1) {
      d.workers[idx] = worker;
      if(window.parent && window.parent.setDocumentInFirebase && worker.id) window.parent.setDocumentInFirebase("workers", worker.id, worker);
      saveDB(d);
    }
  },
  addOrder: (order) => {
    const d = getDB();
    if(!order.id) order.id = crypto.randomUUID();
    if (!order.folio) order.folio = "OC-" + Math.floor(Math.random() * 10000);
    d.orders.push(order);
    if(window.parent && window.parent.setDocumentInFirebase) { 
        window.parent.setDocumentInFirebase("orders", order.id, order);
        window.parent.setDocumentInFirebase("purchase_orders", order.id, order);
    }
    saveDB(d);
  },
  updateOrder: (order) => {
    const d = getDB();
    const idx = d.orders.findIndex((o) => o.id === order.id);
    if (idx !== -1) {
      d.orders[idx] = order;
      if(window.parent && window.parent.setDocumentInFirebase && order.id) {
          window.parent.setDocumentInFirebase("orders", order.id, order);
          window.parent.setDocumentInFirebase("purchase_orders", order.id, order);
      }
      saveDB(d);
    }
  },
  addProject: (project) => {
    const d = getDB();
    if(!project.id) project.id = crypto.randomUUID();
    d.projects.push(project);
    if(window.parent && window.parent.setDocumentInFirebase) window.parent.setDocumentInFirebase("projects", project.id, project);
    saveDB(d);
  },
  updateProject: (project) => {
    const d = getDB();
    const idx = d.projects.findIndex((x) => x.id === project.id);
    if (idx !== -1) {
      d.projects[idx] = project;
      if(window.parent && window.parent.setDocumentInFirebase && project.id) window.parent.setDocumentInFirebase("projects", project.id, project);
      saveDB(d);
    }
  },
  agregar_prestamo: (prestamo) => {
    const d = getDB();
    if (!prestamo.id) prestamo.id = crypto.randomUUID();
    if (!d.worker_loans) d.worker_loans = [];
    d.worker_loans.push(prestamo);
    if (window.parent?.setDocumentInFirebase) window.parent.setDocumentInFirebase('worker_loans', prestamo.id, prestamo);
    if (window.parent?.DB_STATE) {
      if (!window.parent.DB_STATE.worker_loans) window.parent.DB_STATE.worker_loans = [];
      window.parent.DB_STATE.worker_loans.push(prestamo);
    }
  },
  actualizar_prestamo: async (prestamo) => {
    const d = getDB();
    if (!d.worker_loans) d.worker_loans = [];
    const idx = d.worker_loans.findIndex(l => l.id === prestamo.id);
    if (idx >= 0) d.worker_loans[idx] = prestamo;
    else d.worker_loans.push(prestamo);
    
    let wp = null;
    if (window.parent?.setDocumentInFirebase) wp = window.parent.setDocumentInFirebase('worker_loans', prestamo.id, prestamo);
    if (window.parent?.DB_STATE) {
      if (!window.parent.DB_STATE.worker_loans) window.parent.DB_STATE.worker_loans = [];
      const li = window.parent.DB_STATE.worker_loans.findIndex(l => l.id === prestamo.id);
      if (li >= 0) window.parent.DB_STATE.worker_loans[li] = prestamo;
      else window.parent.DB_STATE.worker_loans.push(prestamo);
    }
    if (wp) await wp;
  },
  saveJornada: async (workerId, fecha, fields) => {
    const d = getDB();
    if (!d.attendance) d.attendance = [];
    const existing = d.attendance.find(a =>
      (a.fecha || a.date) === fecha &&
      (a.trabajadorId || a.workerId) === workerId && !a._init
    );
    const record = {
      ...(existing || {}),
      ...fields,
      id: existing ? existing.id : (fields.id || crypto.randomUUID()),
      fecha,
      date: fecha,
      trabajadorId: workerId,
      workerId,
    };
    if (existing) {
      d.attendance[d.attendance.indexOf(existing)] = record;
    } else {
      d.attendance.push(record);
    }
    let p1 = null, p2 = null;
    if (window.parent?.setDocumentInFirebase) p1 = window.parent.setDocumentInFirebase('attendance', record.id, record);
    if (window.parent?.DB_STATE) {
      if (!window.parent.DB_STATE.attendance) window.parent.DB_STATE.attendance = [];
      const li = window.parent.DB_STATE.attendance.findIndex(a => a.id === record.id);
      if (li >= 0) window.parent.DB_STATE.attendance[li] = record;
      else window.parent.DB_STATE.attendance.push(record);
    }
    // Sync attendance_logs
    if (!d.attendance_logs) d.attendance_logs = [];
    const al = {
      id: record.id,
      trabajadorId: workerId, workerId,
      fecha,
      estado: record.estado || record.status || '',
      status: record.estado || record.status || '',
      horasNormal:  record.horasNormal  || 0,
      horasExtra:   record.horasExtra   || 0,
      horasDoble:   record.horasDoble   || 0,
      horasTotales: record.horasTotales || record.horasNormal || 0,
      retardoMin:   record.retardoMin   || 0,
      notas:        record.notas        || '',
      editado_manualmente: record.editado_manualmente || false,
      editado_por:         record.editado_por         || '',
    };
    const ali = d.attendance_logs.findIndex(x => x.id === al.id);
    if (ali >= 0) d.attendance_logs[ali] = al;
    else d.attendance_logs.push(al);
    if (window.parent?.setDocumentInFirebase) p2 = window.parent.setDocumentInFirebase('attendance_logs', al.id, al);
    if (window.parent?.DB_STATE) {
      if (!window.parent.DB_STATE.attendance_logs) window.parent.DB_STATE.attendance_logs = [];
      const lli = window.parent.DB_STATE.attendance_logs.findIndex(x => x.id === al.id);
      if (lli >= 0) window.parent.DB_STATE.attendance_logs[lli] = al;
      else window.parent.DB_STATE.attendance_logs.push(al);
    }
    if (p1 || p2) await Promise.all([p1, p2].filter(Boolean));
    return record;
  },
  addQuote: (quote) => {
    const d = getDB();
    if (!quote.id) quote.id = crypto.randomUUID();
    if (!d.quotations) d.quotations = [];
    d.quotations.push(quote);
    if(window.parent && window.parent.setDocumentInFirebase) window.parent.setDocumentInFirebase("quotations", quote.id, quote);
    // Sincronizar directamente en DB_STATE (quotations no está en carga inicial; saveDB la ignora si no existe)
    if (window.parent?.DB_STATE) {
      if (!window.parent.DB_STATE.quotations) window.parent.DB_STATE.quotations = [];
      window.parent.DB_STATE.quotations.push(quote);
    }
    saveDB(d);
  },
  assignTool: async (toolId, workerId, isReturn) => {
    if (window.parent?.cargar_coleccion && window.parent?.DB_STATE &&
        !window.parent.DB_STATE.herramientas) {
      await window.parent.cargar_coleccion('herramientas');
    }
    const tools = window.parent?.DB_STATE?.herramientas || [];
    const tool  = tools.find(t => (t.id || t._id) === toolId);
    if (!tool) throw new Error('Herramienta no encontrada: ' + toolId);
    const docId = tool.id || tool._id;
    const updated = { ...tool, id: docId, assignedTo: isReturn ? null : workerId };
    const idx = tools.findIndex(t => (t.id || t._id) === toolId);
    if (idx >= 0 && window.parent?.DB_STATE?.herramientas) {
      window.parent.DB_STATE.herramientas[idx] = updated;
    }
    if (window.parent?.setDocumentInFirebase) {
      await window.parent.setDocumentInFirebase('herramientas', docId, updated);
    }
    const log = {
      id: crypto.randomUUID(),
      toolId: docId,
      toolNombre: tool.nombre || '',
      workerId,
      tipo: isReturn ? 'devolucion' : 'prestamo',
      fecha: new Date().toISOString(),
    };
    if (window.parent?.DB_STATE) {
      if (!window.parent.DB_STATE.tool_logs) window.parent.DB_STATE.tool_logs = [];
      window.parent.DB_STATE.tool_logs.unshift(log);
    }
    if (window.parent?.setDocumentInFirebase) {
      await window.parent.setDocumentInFirebase('tool_logs', log.id, log);
    }
    return updated;
  },
  updateQuote: (quote) => {
    const d = getDB();
    if (!d.quotations) d.quotations = [];
    const idx = d.quotations.findIndex((x) => x.id === quote.id);
    if (idx !== -1) {
      d.quotations[idx] = quote;
      if(window.parent && window.parent.setDocumentInFirebase && quote.id) window.parent.setDocumentInFirebase("quotations", quote.id, quote);
      // Sincronizar directamente en DB_STATE
      if (window.parent?.DB_STATE?.quotations) {
        const li = window.parent.DB_STATE.quotations.findIndex(q => q.id === quote.id);
        if (li >= 0) window.parent.DB_STATE.quotations[li] = quote;
        else window.parent.DB_STATE.quotations.push(quote);
      }
      saveDB(d);
    }
  },
  addQuoteViaticos: (quote) => {
    const d = getDB();
    if (!quote.id) quote.id = crypto.randomUUID();
    if (!d.quotations_viaticos) d.quotations_viaticos = [];
    d.quotations_viaticos.push(quote);
    if(window.parent && window.parent.setDocumentInFirebase) window.parent.setDocumentInFirebase("quotations_viaticos", quote.id, quote);
    if (window.parent?.DB_STATE) {
      if (!window.parent.DB_STATE.quotations_viaticos) window.parent.DB_STATE.quotations_viaticos = [];
      window.parent.DB_STATE.quotations_viaticos.push(quote);
    }
    saveDB(d);
  },
  updateQuoteViaticos: (quote) => {
    const d = getDB();
    if (!d.quotations_viaticos) d.quotations_viaticos = [];
    const idx = d.quotations_viaticos.findIndex((x) => x.id === quote.id);
    if (idx !== -1) {
      d.quotations_viaticos[idx] = quote;
      if(window.parent && window.parent.setDocumentInFirebase && quote.id) window.parent.setDocumentInFirebase("quotations_viaticos", quote.id, quote);
      if (window.parent?.DB_STATE?.quotations_viaticos) {
        const li = window.parent.DB_STATE.quotations_viaticos.findIndex(q => q.id === quote.id);
        if (li >= 0) window.parent.DB_STATE.quotations_viaticos[li] = quote;
        else window.parent.DB_STATE.quotations_viaticos.push(quote);
      }
      saveDB(d);
    }
  }
};

// ── Auto-Sincronización de Tema (Previene modo blanco en iframes) ──
try {
  if (window.parent && window.parent.document && window.parent.document.body) {
    const syncTheme = () => {
      const isDark = window.parent.document.body.classList.contains('dark-mode');
      if (isDark) document.body.classList.add('dark-mode');
      else document.body.classList.remove('dark-mode');
    };
    syncTheme(); // Ejecución inmediata
    
    // Observar cambios en tiempo real sin importar cuándo cargue la página
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(m => { if (m.attributeName === 'class') syncTheme(); });
    });
    observer.observe(window.parent.document.body, { attributes: true });
  }
} catch (e) {
  // Ignorar errores de CORS cruzado
}
