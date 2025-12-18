import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQCMs, deleteQCM, saveQCM, exportData, importData, getFolders, saveFolder, deleteFolder, getSheets, saveSheet, deleteSheet } from '../utils/storage';
import { soundManager } from '../utils/sound';
import { generateRevisionSheet } from '../utils/ai';
import RevisionSheetModal from './RevisionSheetModal';
import MobileNavigation from './MobileNavigation';

const Dashboard = ({ onCreateNew, onEdit, onPlay }) => {
    const [qcms, setQcms] = useState([]);
    const [folders, setFolders] = useState([]);
    const [sheets, setSheets] = useState([]);
    const [currentFolderId, setCurrentFolderId] = useState(null); // null = root

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [qcmToMove, setQcmToMove] = useState(null);

    // Revision Sheet State
    const [selectedQcmIds, setSelectedQcmIds] = useState(new Set());
    const [showSheetModal, setShowSheetModal] = useState(false);
    const [sheetContent, setSheetContent] = useState('');
    const [isGeneratingSheet, setIsGeneratingSheet] = useState(false);
    const [currentSheet, setCurrentSheet] = useState(null); // For viewing saved sheets

    const [newTitle, setNewTitle] = useState('');
    const [newFolderName, setNewFolderName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('date-desc'); // date-desc, date-asc, name-asc, name-desc

    // Offline State
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const qcmData = await getQCMs();
            setQcms(qcmData || []);
        } catch (error) {
            console.error("Failed to load QCMs:", error);
            alert("Erreur lors du chargement des QCMs.");
        }

        try {
            const folderData = await getFolders();
            setFolders(folderData || []);
        } catch (error) {
            console.error("Failed to load folders:", error);
        }

        try {
            const sheetData = await getSheets();
            setSheets(sheetData || []);
        } catch (error) {
            console.error("Failed to load sheets:", error);
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (confirm('Êtes-vous sûr de vouloir supprimer ce QCM ?')) {
            await deleteQCM(id);
            loadData();
        }
    };

    const handleRename = async (id, newName) => {
        const qcm = qcms.find(q => q.id === id);
        if (qcm && newName.trim() !== '') {
            qcm.title = newName;
            await saveQCM(qcm);
            loadData();
        }
    };

    const handleCreateSubmit = (e) => {
        e.preventDefault();
        if (newTitle.trim()) {
            onCreateNew(newTitle, currentFolderId);
            setNewTitle('');
            setShowCreateModal(false);
        }
    };

    const handleCreateFolder = async (e) => {
        e.preventDefault();
        if (newFolderName.trim()) {
            const newFolder = {
                id: Date.now().toString(),
                name: newFolderName,
                parentId: currentFolderId,
                updatedAt: Date.now()
            };
            await saveFolder(newFolder);
            setNewFolderName('');
            setShowFolderModal(false);
            loadData();
        }
    };

    const handleDeleteFolder = async (id, e) => {
        e.stopPropagation();
        if (confirm('Êtes-vous sûr de vouloir supprimer ce dossier ? Les QCMs à l\'intérieur ne seront pas supprimés mais déplacés à la racine.')) {
            const qcmsInFolder = qcms.filter(q => q.folderId === id);
            for (const q of qcmsInFolder) {
                q.folderId = null;
                await saveQCM(q);
            }
            await deleteFolder(id);
            loadData();
        }
    };

    const handleMoveQCM = async (folderId) => {
        if (qcmToMove) {
            qcmToMove.folderId = folderId;
            await saveQCM(qcmToMove);
            setQcmToMove(null);
            setShowMoveModal(false);
            loadData();
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                await importData(file);
                alert('Import réussi ! La page va se recharger.');
                window.location.reload();
            } catch (err) {
                alert('Erreur lors de l\'import : ' + err);
            }
        }
    };

    // Selection Logic
    const toggleSelection = (id, e) => {
        e.stopPropagation();
        const newSelection = new Set(selectedQcmIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedQcmIds(newSelection);
    };

    const handleGenerateSheet = async () => {
        if (isOffline) {
            alert("⚠️ La génération par IA nécessite une connexion internet (ou réseau local avec le PC).");
            return;
        }

        if (selectedQcmIds.size === 0) return;

        const selectedQcms = qcms.filter(q => selectedQcmIds.has(q.id));
        setCurrentSheet(null); // Reset current sheet
        setShowSheetModal(true);
        setIsGeneratingSheet(true);
        setSheetContent('');

        try {
            const content = await generateRevisionSheet(selectedQcms);
            setSheetContent(content);
        } catch (error) {
            console.error("Generation failed:", error);
            setSheetContent("Erreur lors de la génération de la fiche. Vérifiez la connexion IA.");
        } finally {
            setIsGeneratingSheet(false);
        }
    };

    const handleSaveSheet = async (title, content) => {
        const newSheet = {
            id: currentSheet ? currentSheet.id : Date.now().toString(),
            title: title,
            content: content,
            folderId: currentFolderId, // Save in current folder
            updatedAt: Date.now()
        };
        await saveSheet(newSheet);
        setShowSheetModal(false);
        loadData();
    };

    const handleOpenSheet = (sheet) => {
        setCurrentSheet(sheet);
        setSheetContent(sheet.content);
        setShowSheetModal(true);
    };

    const handleDeleteSheet = async (id, e) => {
        e.stopPropagation();
        if (confirm('Supprimer cette fiche de révision ?')) {
            await deleteSheet(id);
            loadData();
        }
    };

    // Simplified variants to avoid stagger issues with async data
    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    const filteredQcms = qcms
        .filter(q => {
            const matchesSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase());
            const folderExists = q.folderId && folders.some(f => f.id === q.folderId);
            const effectiveFolderId = folderExists ? q.folderId : null;
            const matchesFolder = searchTerm ? true : (effectiveFolderId === currentFolderId || (!effectiveFolderId && !currentFolderId));
            return matchesSearch && matchesFolder;
        });

    const filteredSheets = sheets
        .filter(s => {
            const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase());
            // Sheets also respect folder structure
            const folderExists = s.folderId && folders.some(f => f.id === s.folderId);
            const effectiveFolderId = folderExists ? s.folderId : null;
            const matchesFolder = searchTerm ? true : (effectiveFolderId === currentFolderId || (!effectiveFolderId && !currentFolderId));
            return matchesSearch && matchesFolder;
        });

    // Combine and sort
    const allItems = [...filteredQcms.map(q => ({ ...q, type: 'qcm' })), ...filteredSheets.map(s => ({ ...s, type: 'sheet' }))]
        .sort((a, b) => {
            if (sortOrder === 'date-desc') return (b.updatedAt || 0) - (a.updatedAt || 0);
            if (sortOrder === 'date-asc') return (a.updatedAt || 0) - (b.updatedAt || 0);
            if (sortOrder === 'name-asc') return a.title.localeCompare(b.title);
            if (sortOrder === 'name-desc') return b.title.localeCompare(a.title);
            return 0;
        });

    const currentFolders = folders.filter(f => !searchTerm && (f.parentId === currentFolderId || (!f.parentId && !currentFolderId)));

    return (
        <div className="page-container">
            {isOffline && (
                <div style={{
                    position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
                    background: '#ff4444', color: 'white', padding: '0.5rem 1rem', borderRadius: '20px',
                    zIndex: 2000, boxShadow: '0 4px 10px rgba(0,0,0,0.3)', fontWeight: 'bold'
                }}>
                    📡 Mode Hors Ligne
                </div>
            )}
            <header style={{ marginBottom: 'var(--spacing-xl)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: '1 1 auto' }}>
                    <motion.h1
                        className="title-gradient"
                        style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        {currentFolderId && (
                            <motion.button
                                className="btn-secondary"
                                style={{ fontSize: '1.5rem', padding: '0.5rem', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                onClick={() => { soundManager.playClick(); setCurrentFolderId(null); }}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                title="Retour à l'accueil"
                            >
                                ⬅
                            </motion.button>
                        )}
                        <span style={{ wordBreak: 'break-word' }}>
                            {currentFolderId ? folders.find(f => f.id === currentFolderId)?.name || 'Dossier' : 'Mes QCMs'}
                        </span>
                    </motion.h1>
                    <motion.p
                        style={{ color: 'var(--text-muted)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        Gérez et jouez à vos quiz
                    </motion.p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-start', width: '100%', marginTop: '1rem' }}>
                    {selectedQcmIds.size > 0 && (
                        <motion.button
                            className="btn-primary"
                            style={{ background: 'var(--accent)', color: 'white', flex: '1 1 auto' }}
                            onClick={handleGenerateSheet}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            🧠 Générer ({selectedQcmIds.size})
                        </motion.button>
                    )}

                    <motion.label
                        className="btn-secondary"
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 auto', justifyContent: 'center' }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        📥 Importer
                        <input type="file" accept=".json" hidden onChange={handleImport} />
                    </motion.label>
                    <motion.button
                        className="btn-secondary"
                        onClick={exportData}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        style={{ flex: '1 1 auto' }}
                    >
                        📤 Exporter
                    </motion.button>
                    <motion.button
                        className="btn-secondary"
                        onClick={() => { soundManager.playClick(); setShowFolderModal(true); }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        style={{ flex: '1 1 auto' }}
                    >
                        📁 Dossier
                    </motion.button>
                    <motion.button
                        className="btn-primary"
                        onClick={() => { soundManager.playClick(); setShowCreateModal(true); }}
                        whileHover={{ scale: 1.05 }}
                        onMouseEnter={() => soundManager.playHover()}
                        whileTap={{ scale: 0.95 }}
                        style={{ flex: '1 1 auto' }}
                    >
                        + QCM
                    </motion.button>
                </div>
            </header>

            {/* Filters & Search */}
            <motion.div
                style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <input
                    className="input-field"
                    placeholder="🔍 Rechercher..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ flex: '1 1 100%', minWidth: '200px' }}
                />
                <select
                    className="input-field"
                    value={sortOrder}
                    onChange={e => setSortOrder(e.target.value)}
                    style={{ flex: '1 1 auto', minWidth: '150px' }}
                >
                    <option value="date-desc">📅 Date (Récent)</option>
                    <option value="date-asc">📅 Date (Ancien)</option>
                    <option value="name-asc">abc Nom (A-Z)</option>
                    <option value="name-desc">zyx Nom (Z-A)</option>
                </select>
            </motion.div>

            <div
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-md)' }}
            >
                <AnimatePresence>
                    {/* Folders */}
                    {currentFolders.map(folder => (
                        <motion.div
                            key={folder.id}
                            className="glass-panel"
                            style={{ padding: 'var(--spacing-md)', cursor: 'pointer', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.15)', background: 'rgba(255, 255, 255, 0.03)' }}
                            onClick={() => { soundManager.playClick(); setCurrentFolderId(folder.id); }}
                            initial="hidden"
                            animate="show"
                            exit="hidden"
                            variants={itemVariants}
                            layout
                            whileHover={{ y: -5, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)', borderColor: 'var(--primary)' }}
                            onMouseEnter={() => soundManager.playHover()}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <div style={{ fontSize: '2.5rem' }}>📁</div>
                                <motion.button
                                    className="btn-danger"
                                    style={{ padding: '0.3rem', fontSize: '0.8rem', opacity: 0.7 }}
                                    onClick={(e) => handleDeleteFolder(folder.id, e)}
                                    title="Supprimer le dossier"
                                    whileHover={{ scale: 1.1, opacity: 1 }}
                                    whileTap={{ scale: 0.9 }}
                                >
                                    ✕
                                </motion.button>
                            </div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-main)' }}>{folder.name}</h3>
                            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Dossier</p>
                        </motion.div>
                    ))}

                    {/* Mixed QCMs and Sheets */}
                    {allItems.map(item => {
                        if (item.type === 'sheet') {
                            return (
                                <motion.div
                                    key={item.id}
                                    className="glass-panel"
                                    style={{
                                        padding: 'var(--spacing-md)',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        border: '1px solid rgba(100, 255, 100, 0.2)', // Greenish tint for sheets
                                        background: 'rgba(20, 40, 30, 0.4)'
                                    }}
                                    onClick={() => { soundManager.playClick(); handleOpenSheet(item); }}
                                    initial="hidden"
                                    animate="show"
                                    exit="hidden"
                                    variants={itemVariants}
                                    layout
                                    whileHover={{ y: -5, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)', borderColor: 'var(--secondary)' }}
                                    onMouseEnter={() => soundManager.playHover()}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-sm)' }}>
                                        <div style={{ fontSize: '2rem' }}>🧠</div>
                                        <motion.button
                                            className="btn-danger"
                                            style={{ padding: '0.4rem', fontSize: '0.8rem', opacity: 0.7 }}
                                            onClick={(e) => handleDeleteSheet(item.id, e)}
                                            title="Supprimer"
                                            whileHover={{ scale: 1.1, opacity: 1 }}
                                            whileTap={{ scale: 0.9 }}
                                        >
                                            ✕
                                        </motion.button>
                                    </div>
                                    <h3 style={{ fontSize: '1.4rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                                        {item.title}
                                    </h3>
                                    <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Fiche de Révision</p>
                                    <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: 'var(--spacing-md)', textAlign: 'right' }}>
                                        {new Date(item.updatedAt || Date.now()).toLocaleDateString('fr-FR')}
                                    </p>
                                </motion.div>
                            );
                        } else {
                            // QCM Card
                            return (
                                <motion.div
                                    key={item.id}
                                    className="glass-panel"
                                    style={{
                                        padding: 'var(--spacing-md)',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        border: selectedQcmIds.has(item.id) ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)'
                                    }}
                                    onClick={() => { soundManager.playClick(); onPlay(item.id); }}
                                    initial="hidden"
                                    animate="show"
                                    exit="hidden"
                                    variants={itemVariants}
                                    layout
                                    whileHover={{ y: -5, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)' }}
                                    onMouseEnter={() => soundManager.playHover()}
                                >
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}></div>

                                    {/* Checkbox for selection */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: '10px',
                                            right: '10px',
                                            zIndex: 10
                                        }}
                                        onClick={(e) => toggleSelection(item.id, e)}
                                    >
                                        <div style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '6px',
                                            border: '2px solid var(--text-muted)',
                                            background: selectedQcmIds.has(item.id) ? 'var(--accent)' : 'rgba(0,0,0,0.3)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s'
                                        }}>
                                            {selectedQcmIds.has(item.id) && <span style={{ color: 'white', fontSize: '16px' }}>✓</span>}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-sm)', paddingRight: '30px' }}>
                                        <h3
                                            contentEditable
                                            suppressContentEditableWarning
                                            onClick={(e) => e.stopPropagation()}
                                            onBlur={(e) => handleRename(item.id, e.target.innerText)}
                                            style={{ fontSize: '1.4rem', fontWeight: '600', outline: 'none', borderBottom: '1px solid transparent', color: 'var(--text-main)' }}
                                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                        >
                                            {item.title || 'QCM Sans Titre'}
                                        </h3>
                                    </div>

                                    <p style={{ color: 'var(--text-dim)', fontSize: '0.95rem', marginBottom: 'var(--spacing-md)' }}>
                                        {item.questions ? item.questions.length : 0} Questions
                                    </p>

                                    <div style={{ display: 'flex', gap: '0.8rem', marginTop: 'auto' }}>
                                        <motion.button
                                            className="btn-primary"
                                            style={{ flex: 1, padding: '0.6rem', fontSize: '0.9rem' }}
                                            onClick={(e) => { e.stopPropagation(); onPlay(item.id); }}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            Jouer
                                        </motion.button>
                                        <motion.button
                                            className="btn-secondary"
                                            style={{ flex: 1, padding: '0.6rem', fontSize: '0.9rem' }}
                                            onClick={(e) => { e.stopPropagation(); onEdit(qcm.id); }}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            Éditer
                                        </motion.button>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                        <motion.button
                                            className="btn-secondary"
                                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)' }}
                                            onClick={(e) => { e.stopPropagation(); setQcmToMove(item); setShowMoveModal(true); }}
                                            whileHover={{ scale: 1.02 }}
                                        >
                                            📂 Déplacer
                                        </motion.button>
                                        <motion.button
                                            className="btn-danger"
                                            style={{ width: '30px', padding: '0.4rem', fontSize: '0.8rem', opacity: 0.7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            onClick={(e) => handleDelete(item.id, e)}
                                            title="Supprimer"
                                            whileHover={{ scale: 1.1, opacity: 1 }}
                                            whileTap={{ scale: 0.9 }}
                                        >
                                            ✕
                                        </motion.button>
                                    </div>

                                    <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: 'var(--spacing-md)', textAlign: 'right' }}>
                                        Modifié le {new Date(item.updatedAt || Date.now()).toLocaleDateString('fr-FR')}
                                    </p>
                                </motion.div>
                            );
                        }
                    })}
                </AnimatePresence>

                {allItems.length === 0 && folders.length === 0 && (
                    <motion.div
                        className="glass-panel"
                        style={{ gridColumn: '1 / -1', padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <div style={{ fontSize: '3rem', opacity: 0.5 }}>📝</div>
                        <p style={{ fontSize: '1.2rem' }}>Aucun QCM ni Fiche trouvé.</p>
                        <motion.button
                            className="btn-primary"
                            onClick={() => setShowCreateModal(true)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            Commencer à créer
                        </motion.button>
                    </motion.div>
                )}

                {allItems.length === 0 && currentFolders.length === 0 && (qcms.length > 0 || folders.length > 0 || sheets.length > 0) && (
                    <motion.div
                        className="glass-panel"
                        style={{ gridColumn: '1 / -1', padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--text-muted)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <p style={{ fontSize: '1.2rem' }}>Aucun résultat pour "{searchTerm}" 🔍</p>
                    </motion.div>
                )}
            </div>

            {/* Revision Sheet Modal */}
            <RevisionSheetModal
                isOpen={showSheetModal}
                onClose={() => setShowSheetModal(false)}
                content={sheetContent}
                isLoading={isGeneratingSheet}
                onSave={handleSaveSheet}
            />

            {/* Create Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <motion.div
                        style={{
                            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                        }}
                        onClick={() => setShowCreateModal(false)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="glass-panel"
                            style={{ padding: 'var(--spacing-lg)', width: '100%', maxWidth: '500px' }}
                            onClick={e => e.stopPropagation()}
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                        >
                            <h2 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1.8rem' }}>Nouveau QCM</h2>
                            <form onSubmit={handleCreateSubmit}>
                                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Titre du QCM</label>
                                    <input
                                        autoFocus
                                        className="input-field"
                                        value={newTitle}
                                        onChange={e => setNewTitle(e.target.value)}
                                        placeholder="Ex: Anatomie Chapitre 1"
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                    <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Annuler</button>
                                    <button type="submit" className="btn-primary">Créer</button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Folder Modal */}
            <AnimatePresence>
                {showFolderModal && (
                    <motion.div
                        style={{
                            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                        }}
                        onClick={() => setShowFolderModal(false)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="glass-panel"
                            style={{ padding: 'var(--spacing-lg)', width: '100%', maxWidth: '400px' }}
                            onClick={e => e.stopPropagation()}
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                        >
                            <h2 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1.5rem' }}>Nouveau Dossier</h2>
                            <form onSubmit={handleCreateFolder}>
                                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nom du dossier</label>
                                    <input
                                        autoFocus
                                        className="input-field"
                                        value={newFolderName}
                                        onChange={e => setNewFolderName(e.target.value)}
                                        placeholder="Ex: Anatomie"
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                    <button type="button" className="btn-secondary" onClick={() => setShowFolderModal(false)}>Annuler</button>
                                    <button type="submit" className="btn-primary">Créer</button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Move QCM Modal */}
            <AnimatePresence>
                {showMoveModal && (
                    <motion.div
                        style={{
                            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                        }}
                        onClick={() => setShowMoveModal(false)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="glass-panel"
                            style={{ padding: 'var(--spacing-lg)', width: '100%', maxWidth: '400px' }}
                            onClick={e => e.stopPropagation()}
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                        >
                            <h2 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1.5rem' }}>Déplacer vers...</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => handleMoveQCM(null)}
                                    style={{ textAlign: 'left', padding: '0.8rem', background: !qcmToMove?.folderId ? 'var(--primary)' : 'rgba(255,255,255,0.05)' }}
                                >
                                    🏠 Accueil (Racine)
                                </button>
                                {folders.map(f => (
                                    <button
                                        key={f.id}
                                        className="btn-secondary"
                                        onClick={() => handleMoveQCM(f.id)}
                                        style={{ textAlign: 'left', padding: '0.8rem', background: qcmToMove?.folderId === f.id ? 'var(--primary)' : 'rgba(255,255,255,0.05)' }}
                                    >
                                        📁 {f.name}
                                    </button>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="button" className="btn-secondary" onClick={() => setShowMoveModal(false)}>Annuler</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Mobile Navigation */}
            <div className="mobile-only">
                <MobileNavigation
                    onHome={() => { setCurrentFolderId(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    onSearch={() => document.querySelector('.search-input')?.focus()}
                    onAdd={() => setShowMobileMenu(true)}
                    onGenerate={handleGenerateSheet}
                    selectionCount={selectedQcmIds.size}
                />
            </div>

            {/* Mobile Menu Modal (Bottom Sheet style) */}
            <AnimatePresence>
                {showMobileMenu && (
                    <motion.div
                        style={{
                            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
                            display: 'flex', alignItems: 'flex-end', zIndex: 2000
                        }}
                        onClick={() => setShowMobileMenu(false)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="glass-panel"
                            style={{
                                width: '100%',
                                padding: 'var(--spacing-lg)',
                                borderBottomLeftRadius: 0,
                                borderBottomRightRadius: 0,
                                borderTopLeftRadius: '20px',
                                borderTopRightRadius: '20px',
                                background: 'var(--bg-dark)',
                                border: '1px solid var(--glass-border)'
                            }}
                            onClick={e => e.stopPropagation()}
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        >
                            <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>Créer / Importer</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <button className="btn-secondary" onClick={() => { setShowCreateModal(true); setShowMobileMenu(false); }} style={{ flexDirection: 'column', padding: '1.5rem', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '2rem' }}>📝</span>
                                    Nouveau QCM
                                </button>
                                <button className="btn-secondary" onClick={() => { setShowFolderModal(true); setShowMobileMenu(false); }} style={{ flexDirection: 'column', padding: '1.5rem', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '2rem' }}>📁</span>
                                    Nouveau Dossier
                                </button>
                                <label className="btn-secondary" style={{ flexDirection: 'column', padding: '1.5rem', gap: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '2rem' }}>📥</span>
                                    Importer
                                    <input type="file" accept=".json" hidden onChange={(e) => { handleImport(e); setShowMobileMenu(false); }} />
                                </label>
                                <button className="btn-secondary" onClick={() => { exportData(); setShowMobileMenu(false); }} style={{ flexDirection: 'column', padding: '1.5rem', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '2rem' }}>📤</span>
                                    Exporter
                                </button>
                            </div>
                            <button
                                className="btn-danger"
                                style={{ width: '100%', marginTop: '1.5rem', padding: '1rem' }}
                                onClick={() => setShowMobileMenu(false)}
                            >
                                Annuler
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Dashboard;
