import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { soundManager } from '../utils/sound';
import { saveAIConfig, getModels } from '../utils/ai';

const AISettings = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [aiConfig, setAiConfig] = useState({ url: 'http://localhost:1234/v1', model: 'local-model' });
    const [availableModels, setAvailableModels] = useState([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    useEffect(() => {
        const storedConfig = localStorage.getItem('ai_config');
        if (storedConfig) {
            setAiConfig(JSON.parse(storedConfig));
        }
    }, []);

    const handleSaveConfig = (e) => {
        e.preventDefault();
        saveAIConfig(aiConfig);
        setIsOpen(false);
        soundManager.playSuccess();
    };

    const fetchModels = async () => {
        setIsLoadingModels(true);
        const models = await getModels();
        setAvailableModels(models);
        setIsLoadingModels(false);
    };

    return (
        <div style={{ position: 'fixed', bottom: '2rem', left: '2rem', zIndex: 100 }}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        className="glass-panel"
                        style={{
                            marginBottom: '1rem',
                            padding: '1.5rem',
                            width: '350px',
                            background: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid var(--glass-border)'
                        }}
                    >
                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>⚙️ Configuration IA</h2>
                        <form onSubmit={handleSaveConfig}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>URL de l'API (LM Studio)</label>
                                <input
                                    className="input-field"
                                    value={aiConfig.url}
                                    onChange={e => setAiConfig({ ...aiConfig, url: e.target.value })}
                                    placeholder="http://localhost:1234/v1"
                                    style={{ fontSize: '0.9rem', padding: '0.6rem' }}
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nom du Modèle</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <select
                                        className="input-field"
                                        value={aiConfig.model}
                                        onChange={e => setAiConfig({ ...aiConfig, model: e.target.value })}
                                        style={{ flex: 1, fontSize: '0.9rem', padding: '0.6rem' }}
                                    >
                                        <option value={aiConfig.model}>{aiConfig.model} (Actuel)</option>
                                        {(availableModels || []).map(m => (
                                            <option key={m.id} value={m.id}>{m.id}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={fetchModels}
                                        disabled={isLoadingModels}
                                        title="Rafraîchir la liste des modèles"
                                        style={{ padding: '0.6rem' }}
                                    >
                                        {isLoadingModels ? '...' : '🔄'}
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn-secondary" onClick={() => setIsOpen(false)} style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>Annuler</button>
                                <button type="submit" className="btn-primary" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>Sauvegarder</button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                onClick={() => { soundManager.playClick(); setIsOpen(!isOpen); }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'var(--secondary)',
                    color: 'white',
                    fontSize: '1.5rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--glass-border)',
                    cursor: 'pointer'
                }}
                title="Configuration IA"
            >
                {isOpen ? '✕' : '🤖'}
            </motion.button>
        </div>
    );
};

export default AISettings;
