import { openDB } from 'idb';

const DB_NAME = 'AnnaleDB';
const STORE_NAME = 'qcms';
const FOLDERS_STORE = 'folders';
const SHEETS_STORE = 'sheets';
const STORAGE_KEY = 'annale_qcms'; // Old key for migration

const dbPromise = openDB(DB_NAME, 3, { // Increment version
    upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
            db.createObjectStore(FOLDERS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SHEETS_STORE)) {
            db.createObjectStore(SHEETS_STORE, { keyPath: 'id' });
        }
    },
    blocked(currentVersion, blockedVersion, event) {
        console.error("DB Upgrade Blocked: Please close other tabs or reload the page.");
        alert("Mise à jour de la base de données bloquée. Veuillez fermer les autres onglets ou rafraîchir la page.");
    },
    blocking(currentVersion, blockedVersion, event) {
        console.warn("DB Blocking Upgrade: Closing connection to allow upgrade.");
        event.target.result.close();
    },
    terminated() {
        console.error("DB Connection Terminated unexpectedly.");
    }
});

// Migration helper
const migrateFromLocalStorage = async () => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        try {
            const qcms = JSON.parse(data);
            if (Array.isArray(qcms) && qcms.length > 0) {
                const db = await dbPromise;
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                for (const qcm of qcms) {
                    await store.put(qcm);
                }
                await tx.done;
                console.log('Migration from LocalStorage successful');
                localStorage.removeItem(STORAGE_KEY); // Clear old data
            }
        } catch (e) {
            console.error('Migration failed:', e);
        }
    }
};

// Initialize migration on load
migrateFromLocalStorage();

export const getQCMs = async () => {
    const db = await dbPromise;
    return db.getAll(STORE_NAME);
};

export const getQCMById = async (id) => {
    const db = await dbPromise;
    return db.get(STORE_NAME, id);
};

export const saveQCM = async (qcm) => {
    const db = await dbPromise;
    qcm.updatedAt = Date.now();
    return db.put(STORE_NAME, qcm);
};

export const deleteQCM = async (id) => {
    const db = await dbPromise;
    return db.delete(STORE_NAME, id);
};

// --- Folders API ---

export const getFolders = async () => {
    const db = await dbPromise;
    if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
        console.warn("Folders store missing, returning empty array.");
        return [];
    }
    return db.getAll(FOLDERS_STORE);
};

export const saveFolder = async (folder) => {
    const db = await dbPromise;
    folder.updatedAt = Date.now();
    return db.put(FOLDERS_STORE, folder);
};

export const deleteFolder = async (id) => {
    const db = await dbPromise;
    // Optional: Move QCMs inside this folder back to root?
    // For now, let's just keep them but with an invalid folderId (effectively root)
    // Or we can explicitly update them. Let's keep it simple.
    return db.delete(FOLDERS_STORE, id);
};

// --- Sheets API ---

export const getSheets = async () => {
    const db = await dbPromise;
    if (!db.objectStoreNames.contains(SHEETS_STORE)) {
        return [];
    }
    return db.getAll(SHEETS_STORE);
};

export const saveSheet = async (sheet) => {
    const db = await dbPromise;
    sheet.updatedAt = Date.now();
    return db.put(SHEETS_STORE, sheet);
};

export const deleteSheet = async (id) => {
    const db = await dbPromise;
    return db.delete(SHEETS_STORE, id);
};

export const exportData = async () => {
    const qcms = await getQCMs();
    const folders = await getFolders();
    const sheets = await getSheets();
    const data = { qcms, folders, sheets };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annale-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

export const importData = async (file) => {
    try {
        console.log("Starting import...");
        const text = await file.text();
        console.log("File read successfully, length:", text.length);

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("JSON Parse Error:", e);
            throw new Error("Le fichier n'est pas un JSON valide.");
        }

        let qcms = [];
        let folders = [];
        let sheets = [];

        if (Array.isArray(data)) {
            qcms = data;
        } else if (data.qcms) {
            qcms = data.qcms;
            folders = data.folders || [];
            sheets = data.sheets || [];
        } else {
            throw new Error("Format du fichier non reconnu.");
        }

        console.log(`Importing ${qcms.length} QCMs, ${folders.length} folders, and ${sheets.length} sheets...`);

        const db = await dbPromise;

        // Use sequential writes instead of one big transaction to avoid hanging
        let successCount = 0;
        for (const qcm of qcms) {
            if (!qcm.id) qcm.id = Date.now().toString() + Math.random().toString().slice(2);
            await db.put(STORE_NAME, qcm);
            successCount++;
        }

        for (const folder of folders) {
            if (!folder.id) folder.id = Date.now().toString() + Math.random().toString().slice(2);
            await db.put(FOLDERS_STORE, folder);
        }

        if (db.objectStoreNames.contains(SHEETS_STORE)) {
            for (const sheet of sheets) {
                if (!sheet.id) sheet.id = Date.now().toString() + Math.random().toString().slice(2);
                await db.put(SHEETS_STORE, sheet);
            }
        }

        console.log(`Import complete. Imported ${successCount} QCMs.`);
        return true;
    } catch (err) {
        console.error("Import failed:", err);
        throw err;
    }
};
