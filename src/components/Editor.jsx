import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { parseQCM } from '../utils/parser';
import { parseQCMContent } from '../utils/ai';
import { saveQCM, getQCMById } from '../utils/storage';

const Editor = ({ qcmId, onBack }) => {
    const [title, setTitle] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [rawText, setRawText] = useState('');
    // AI Import State
    const [showAiImportModal, setShowAiImportModal] = useState(false);
    const [aiImportText, setAiImportText] = useState('');
    const [isAiImporting, setIsAiImporting] = useState(false);
    const [aiImportError, setAiImportError] = useState(null);
    const [separator, setSeparator] = useState('---');
    const [choiceSeparator, setChoiceSeparator] = useState('???');
    const [answerMarker, setAnswerMarker] = useState('ANSWER:');
    const [bulkAnswers, setBulkAnswers] = useState(''); // New state for bulk answers
    const [parsedQuestions, setParsedQuestions] = useState([]);

    useEffect(() => {
        const loadQCM = async () => {
            if (qcmId) {
                const qcm = await getQCMById(qcmId);
                if (qcm) {
                    setTitle(qcm.title);
                    setRawText(qcm.rawText || '');
                    setSeparator(qcm.separator || '---');
                    setChoiceSeparator(qcm.choiceSeparator || '???');
                    setAnswerMarker(qcm.answerMarker || 'ANSWER:');
                    setParsedQuestions(qcm.questions || []);
                }
            } else {
                setTitle('Nouveau QCM');
            }
        };
        loadQCM();
    }, [qcmId]);

    const handleParse = () => {
        const newQuestions = parseQCM(rawText, {
            blockSeparator: separator,
            choiceSeparator,
            answerSeparator: answerMarker
        });

        if (parsedQuestions.length > 0 && !confirm('Le re-parsing va écraser les questions et images actuelles. Continuer ?')) {
            return;
        }
        setParsedQuestions(newQuestions);
    };

    const handleImageUpload = (questionId, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setParsedQuestions(prev => prev.map(q => {
                if (q.id !== questionId) return q;
                const currentImages = q.images || (q.image ? [q.image] : []);
                return { ...q, images: [...currentImages, reader.result], image: null }; // Migrate old 'image' to 'images'
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleDeleteImage = (questionId, index) => {
        setParsedQuestions(prev => prev.map(q => {
            if (q.id !== questionId) return q;
            const currentImages = q.images || (q.image ? [q.image] : []);
            const newImages = currentImages.filter((_, i) => i !== index);
            return { ...q, images: newImages, image: null };
        }));
    };

    const handleSave = async () => {
        if (!title.trim()) {
            alert('Veuillez entrer un titre');
            return;
        }
        const qcm = {
            id: qcmId || Date.now().toString(),
            title,
            rawText,
            separator,
            choiceSeparator,
            answerMarker,
            questions: parsedQuestions,
            updatedAt: Date.now()
        };
        await saveQCM(qcm);
        onBack();
    };

    const handleQuestionTypeChange = (id, type) => {
        setParsedQuestions(prev => prev.map(q =>
            q.id === id ? { ...q, type } : q
        ));
    };

    const handleAiImport = async () => {
        if (!aiImportText.trim()) return;
        setIsAiImporting(true);
        setAiImportError(null);
        try {
            const parsedAiQuestions = await parseQCMContent(aiImportText);

            // Convert parsed questions to internal format
            const newQuestions = parsedAiQuestions.map(q => ({
                id: uuidv4(),
                text: q.text,
                type: 'multiple', // Default to multiple choice
                options: q.options.map(o => ({
                    text: o.text,
                    isCorrect: o.isCorrect
                })),
                answerExplanation: q.answerExplanation || '',
                images: [], // Initialize empty images array
                image: null // Deprecated
            }));

            // If there are existing questions, ask for confirmation to overwrite
            if (parsedQuestions.length > 0 && !confirm('L\'import IA va écraser les questions actuelles. Continuer ?')) {
                setIsAiImporting(false);
                return;
            }

            setParsedQuestions(newQuestions);
            setShowAiImportModal(false);
            setAiImportText('');
        } catch (err) {
            setAiImportError("Erreur : Impossible d'analyser le texte. Vérifiez le format ou la connexion IA.");
        } finally {
            setIsAiImporting(false);
        }
    };
    const handleBulkAnswersApply = () => {
        if (!bulkAnswers.trim()) return;

        const lines = bulkAnswers.split('\n').map(l => l.trim()).filter(l => l);

        setParsedQuestions(prev => prev.map((q, idx) => {
            if (idx >= lines.length) return q;

            const answerLine = lines[idx].toLowerCase();
            const correctIndices = [];

            // Map 'a', 'b', 'c', etc. to indices 0, 1, 2...
            for (let i = 0; i < answerLine.length; i++) {
                const charCode = answerLine.charCodeAt(i);
                if (charCode >= 97 && charCode <= 122) { // a-z
                    correctIndices.push(charCode - 97);
                }
            }

            const newOptions = q.options.map((opt, optIdx) => ({
                ...opt,
                isCorrect: correctIndices.includes(optIdx)
            }));

            return { ...q, options: newOptions };
        }));

        setBulkAnswers('');
        alert('Réponses appliquées !');
    };

    return (
        <div style={{ padding: 'var(--spacing-lg)', maxWidth: '1600px', margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                    <motion.button
                        onClick={onBack}
                        style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.5rem', padding: '0.5rem' }}
                        whileHover={{ x: -5 }}
                    >
                        ←
                    </motion.button>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Titre du QCM"
                        style={{
                            fontSize: '2rem',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-main)',
                            fontWeight: 'bold',
                            width: '500px',
                            fontFamily: 'var(--font-sans)'
                        }}
                    />
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                    <motion.button
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        onClick={() => setShowAiImportModal(true)}
                        whileHover={{ scale: 1.05 }}
                    >
                        ✨ Import IA
                    </motion.button>
                    <button className="btn-primary" onClick={handleSave}>Sauvegarder</button>
                </div>
            </header>

            <div style={{ display: 'flex', gap: 'var(--spacing-md)', flex: 1, overflow: 'hidden' }}>
                {/* Left Panel: Input */}
                <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'var(--spacing-md)' }}>
                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                            <h3 style={{ color: 'var(--text-main)' }}>Texte Brut</h3>
                            <button className="btn-primary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.9rem' }} onClick={handleParse}>
                                Générer (Parse) →
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-sm)' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Séparateur Bloc</label>
                                <input
                                    value={separator}
                                    onChange={(e) => setSeparator(e.target.value)}
                                    className="input-field"
                                    style={{ padding: '0.6rem' }}
                                    placeholder="---"
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Séparateur Choix</label>
                                <input
                                    value={choiceSeparator}
                                    onChange={(e) => setChoiceSeparator(e.target.value)}
                                    className="input-field"
                                    style={{ padding: '0.6rem' }}
                                    placeholder="???"
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Marqueur Réponse</label>
                                <input
                                    value={answerMarker}
                                    onChange={(e) => setAnswerMarker(e.target.value)}
                                    className="input-field"
                                    style={{ padding: '0.6rem' }}
                                    placeholder="ANSWER:"
                                />
                            </div>
                        </div>
                    </div>
                    <textarea
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        placeholder={`Collez vos questions ici...\nExemple:\nQuestion 1\n${choiceSeparator}\nA) Option A\nB) Option B\n${answerMarker} A\n${separator}\nQuestion 2...`}
                        style={{
                            flex: 1,
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-muted)',
                            padding: 'var(--spacing-sm)',
                            borderRadius: 'var(--radius-sm)',
                            resize: 'none',
                            fontFamily: 'monospace',
                            fontSize: '0.9rem',
                            lineHeight: '1.5'
                        }}
                    />


                    {/* Bulk Answer Input */}
                    <div style={{ marginTop: 'var(--spacing-md)', background: 'rgba(0,0,0,0.2)', padding: 'var(--spacing-md)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
                        <label style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                            📝 Réponses en masse (Rapide)
                        </label>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                            Collez vos réponses ligne par ligne (ex: "ab", "c", "abc").<br />
                            Ligne 1 = Question 1, Ligne 2 = Question 2, etc.
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <textarea
                                value={bulkAnswers}
                                onChange={(e) => setBulkAnswers(e.target.value)}
                                placeholder="ab&#10;c&#10;abcde"
                                style={{
                                    flex: 1,
                                    height: '80px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--text-main)',
                                    padding: '0.5rem',
                                    borderRadius: 'var(--radius-sm)',
                                    resize: 'none',
                                    fontFamily: 'monospace'
                                }}
                            />
                            <button
                                className="btn-secondary"
                                onClick={handleBulkAnswersApply}
                                style={{ alignSelf: 'flex-end', height: '100%' }}
                            >
                                Appliquer
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Preview & Edit */}
                <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'var(--spacing-md)', overflowY: 'auto' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-main)' }}>Aperçu ({parsedQuestions.length})</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        {parsedQuestions.map((q, idx) => (
                            <div key={q.id} style={{ background: 'rgba(255,255,255,0.02)', padding: 'var(--spacing-md)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.1rem' }}>Q{idx + 1}</span>
                                    {/* Type selector removed - always multiple */}
                                </div>

                                <p style={{ fontSize: '1.1rem', marginBottom: 'var(--spacing-sm)', fontWeight: '500' }}>{q.text}</p>



                                {/* Image Gallery */}
                                {(q.images || (q.image ? [q.image] : [])).length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: 'var(--spacing-sm)' }}>
                                        {(q.images || (q.image ? [q.image] : [])).map((img, imgIdx) => (
                                            <div key={imgIdx} style={{ position: 'relative' }}>
                                                <img
                                                    src={img}
                                                    alt={`Question ${idx + 1} - Image ${imgIdx + 1}`}
                                                    style={{ maxWidth: '150px', maxHeight: '150px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', objectFit: 'cover' }}
                                                />
                                                <button
                                                    onClick={() => handleDeleteImage(q.id, imgIdx)}
                                                    style={{
                                                        position: 'absolute', top: -5, right: -5,
                                                        background: 'var(--danger)', color: 'white',
                                                        borderRadius: '50%', width: '20px', height: '20px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.8rem', border: 'none', cursor: 'pointer'
                                                    }}
                                                    title="Supprimer l'image"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <label style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '0.5rem 1rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: 'var(--radius-full)',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    marginBottom: 'var(--spacing-sm)',
                                    border: '1px solid var(--glass-border)',
                                    transition: 'all 0.2s'
                                }}>
                                    + Ajouter Image
                                    <input type="file" accept="image/*" hidden onChange={(e) => handleImageUpload(q.id, e.target.files[0])} />
                                </label>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    {q.options.map((opt, i) => (
                                        <div
                                            key={i}
                                            onClick={() => {
                                                setParsedQuestions(prev => prev.map(pq => {
                                                    if (pq.id !== q.id) return pq;
                                                    const newOptions = [...pq.options];
                                                    newOptions[i] = { ...newOptions[i], isCorrect: !newOptions[i].isCorrect };
                                                    return { ...pq, options: newOptions };
                                                }));
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.8rem',
                                                padding: '0.5rem',
                                                borderRadius: 'var(--radius-sm)',
                                                background: opt.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                                border: opt.isCorrect ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                            title="Cliquez pour marquer comme correct/incorrect"
                                        >
                                            <div style={{
                                                width: '16px',
                                                height: '16px',
                                                borderRadius: '4px',
                                                border: `2px solid ${opt.isCorrect ? 'var(--success)' : 'var(--text-muted)'}`,
                                                background: opt.isCorrect ? 'var(--success)' : 'transparent',
                                                flexShrink: 0
                                            }}></div>
                                            <span style={{
                                                color: opt.isCorrect ? 'var(--success)' : 'var(--text-dim)',
                                                fontWeight: opt.isCorrect ? '600' : '400'
                                            }}>{opt.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {parsedQuestions.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 'var(--spacing-xl)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>⌨️</div>
                                <p>Aucune question. Collez votre texte à gauche et cliquez sur Générer.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* AI Import Modal */}
            <AnimatePresence>
                {showAiImportModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
                        }}
                        onClick={() => setShowAiImportModal(false)}
                    >
                        <motion.div
                            className="glass-panel"
                            style={{ width: '90%', maxWidth: '600px', padding: '2rem' }}
                            onClick={e => e.stopPropagation()}
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                        >
                            <h2 style={{ marginBottom: '1rem' }}>✨ Import Intelligent (IA)</h2>
                            <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
                                Collez votre texte brut (questions, choix, réponses) ci-dessous. L'IA va essayer de détecter automatiquement la structure.
                            </p>
                            <textarea
                                className="input-field"
                                style={{ width: '100%', minHeight: '200px', marginBottom: '1rem', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.9rem' }}
                                value={aiImportText}
                                onChange={e => setAiImportText(e.target.value)}
                                placeholder={"Exemple :\n\n1. Quelle est la capitale de la France ?\nA) Londres\nB) Paris\nC) Berlin\nRéponse : B\n\n2. ..."}
                                autoFocus
                            />
                            {aiImportError && (
                                <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{aiImportError}</p>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button className="btn-secondary" onClick={() => setShowAiImportModal(false)}>Annuler</button>
                                <button
                                    className="btn-primary"
                                    onClick={handleAiImport}
                                    disabled={!aiImportText.trim() || isAiImporting}
                                >
                                    {isAiImporting ? 'Analyse en cours...' : 'Importer'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default Editor;
