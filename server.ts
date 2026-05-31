import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

// Initialize Firebase Admin
initializeApp({
  credential: applicationDefault(),
  projectId: "gen-lang-client-0827035586"
});

const db = getFirestore("ai-studio-a12c0386-3408-4b58-a08e-36e79f61305b");

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // API Route: Generic DB Sync for all collections
  // Receives the ENTIRE state object and overwrites the specified collections.
  app.post("/api/db-sync", async (req, res) => {
    try {
      const data = req.body;
      if (!data) return res.status(400).json({ error: "No data provided" });
      
      const collections = [
        'workers', 'contacts', 'inventory', 'projects', 'project_phases', 'quotations', 'pieces', 'orders', 
        'production_logs', 'payroll_weeks', 'payroll_lines', 'worker_loans', 'worker_loan_payments', 
        'attendance', 'attendance_logs', 'piece_types', 'expense_categories', 'purchase_orders', 'purchase_order_lines', 'lumber_batches', 
        'lumber_boards', 'material_requests', 'suppliers', 'project_worker_hours', 'viajes', 
        'anticipos_viaticos', 'gastos_viaticos', 'notifications', 'accounting_movements', 'wood'
      ];
      
      const batch = db.batch();
      let opCount = 0;
      
      for (const col of collections) {
         if (data[col] && Array.isArray(data[col])) {
            for (const item of data[col]) {
               const id = item.id || item._id;
               if (id) {
                 const docRef = db.collection(col).doc(id.toString());
                 batch.set(docRef, item);
                 opCount++;
                 if (opCount >= 450) {
                   await batch.commit();
                   opCount = 0;
                 }
               }
            }
         }
      }
      
      if (data.settings) {
        batch.set(db.collection("settings").doc("main"), data.settings);
        opCount++;
      }
      
      if (opCount > 0) {
        await batch.commit();
      }
      
      res.json({ success: true });
    } catch (e: any) {
      console.error("Error writing to Firestore:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "mpa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      let reqPath = req.path;
      if (reqPath === "/") reqPath = "/index.html";
      const filePath = path.join(distPath, reqPath);
      if (fs.existsSync(filePath)) res.sendFile(filePath);
      else res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
