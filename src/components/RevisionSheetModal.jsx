import { useState } from 'react';
import { motion } from 'framer-motion';
import { soundManager } from '../utils/sound';

const RevisionSheetModal = ({ isOpen, onClose, content, isLoading, onSave }) => {
    const [title, setTitle] = useState('Ma Fiche de Révision');

    if (!isOpen) return null;

    const handleCopy = () => {
        // Create a temporary element to copy text content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        navigator.clipboard.writeText(tempDiv.innerText);
        alert('Texte de la fiche copié ! 📋');
        soundManager.playClick();
    };

    const handleSave = () => {
        if (onSave) {
            onSave(title, content);
            soundManager.playSuccess();
        }
    };

    return (
        <motion.div
            style={{
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
            }}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                className="sheet-modal"
                onClick={e => e.stopPropagation()}
                initial={{ scale: 0.9, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 30 }}
            >
                <div className="sheet-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                        <span style={{ fontSize: '2rem' }}>🧠</span>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="input-field"
                            style={{ fontSize: '1.5rem', fontWeight: 'bold', background: 'transparent', border: 'none', borderBottom: '1px solid var(--text-muted)', padding: '0.2rem', width: '100%' }}
                            placeholder="Titre de la fiche..."
                        />
                    </div>
                    <button
                        className="btn-danger"
                        onClick={onClose}
                        style={{ padding: '0.5rem 1rem', marginLeft: '1rem' }}
                    >
                        ✕
                    </button>
                </div>

                <div className="sheet-content">
                    {isLoading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                style={{ fontSize: '3rem', marginBottom: '1rem' }}
                            >
                                ⚙️
                            </motion.div>
                            <p style={{ fontSize: '1.2rem', color: 'var(--accent)' }}>L'IA rédige votre fiche de révision...</p>
                        </div>
                    ) : (
                        <div dangerouslySetInnerHTML={{ __html: content }} />
                    )}
                </div>

                {!isLoading && (
                    <div className="sheet-footer">
                        <motion.button
                            className="btn-secondary"
                            onClick={handleCopy}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            📋 Copier Texte
                        </motion.button>
                        <motion.button
                            className="btn-primary"
                            onClick={handleSave}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            style={{ background: 'linear-gradient(45deg, var(--primary), var(--secondary))' }}
                        >
                            💾 Sauvegarder
                        </motion.button>
                    </div>
                )}
            </motion.div>
        </motion.div>

    );
};

export default RevisionSheetModal;
