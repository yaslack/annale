import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { getQCMById } from '../utils/storage';
import { soundManager } from '../utils/sound';
import { getExplanation, getDefinition, askCustomQuestion } from '../utils/ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const Player = ({ qcmId, onBack }) => {
    const [qcm, setQcm] = useState(null);
    const [answers, setAnswers] = useState({}); // { questionId: [selectedIndices] }
    const [showResults, setShowResults] = useState(false);
    const [score, setScore] = useState(0);

    // Play Mode State
    const [mode, setMode] = useState(null); // 'all', 'one-by-one', 'one-by-one-immediate'
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [validatedSteps, setValidatedSteps] = useState({}); // { index: boolean } for immediate mode

    // AI State
    const [aiResponse, setAiResponse] = useState(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [showAiModal, setShowAiModal] = useState(false);
    const [selectionRect, setSelectionRect] = useState(null);
    const [selectedText, setSelectedText] = useState('');
    const [customQuestion, setCustomQuestion] = useState('');
    const [showQuestionInput, setShowQuestionInput] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            if (qcmId) {
                const data = await getQCMById(qcmId);
                if (data) {
                    setQcm(data);
                }
            }
            if (qcmId) {
                const data = await getQCMById(qcmId);
                if (data) {
                    setQcm(data);
                }
            }
        };
        loadData();
    }, [qcmId]);

    const handleSelect = (questionId, optionIndex, type) => {
        // Prevent changing answer if results are shown OR if this step is already validated in immediate mode
        if (showResults) return;
        if (mode === 'one-by-one-immediate' && validatedSteps[currentQuestionIndex]) return;

        setAnswers(prev => {
            soundManager.playClick();
            const currentSelected = prev[questionId] || [];
            // Always use multiple choice logic (toggle)
            if (currentSelected.includes(optionIndex)) {
                return { ...prev, [questionId]: currentSelected.filter(i => i !== optionIndex) };
            } else {
                return { ...prev, [questionId]: [...currentSelected, optionIndex] };
            }
        });
    };

    const calculateScore = () => {
        if (!qcm) return;
        let correctCount = 0;

        qcm.questions.forEach(q => {
            const userSelected = answers[q.id] || [];
            const correctIndices = q.options.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);

            const isCorrect = userSelected.length === correctIndices.length &&
                userSelected.every(val => correctIndices.includes(val));

            if (isCorrect) correctCount++;
        });

        setScore(correctCount);
        setShowResults(true);

        if (correctCount === qcm.questions.length) {
            soundManager.playComplete();
            triggerConfetti();
        } else {
            soundManager.playSuccess(); // Generic finish sound
        }
    };

    const triggerConfetti = () => {
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const random = (min, max) => Math.random() * (max - min) + min;

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: random(0.1, 0.3), y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: random(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
    };

    const handleValidateStep = () => {
        const q = qcm.questions[currentQuestionIndex];
        const userSelected = answers[q.id] || [];
        const isCorrect = userSelected.length === q.options.filter(o => o.isCorrect).length &&
            userSelected.every(idx => q.options[idx].isCorrect);

        if (isCorrect) {
            soundManager.playSuccess();
        } else {
            soundManager.playError();
        }
        setValidatedSteps(prev => ({ ...prev, [currentQuestionIndex]: true }));
    };

    const handleExplain = async (question, optionText, isCorrect) => {
        setIsAiLoading(true);
        setShowAiModal(true);
        setAiResponse(null);
        try {
            const response = await getExplanation(question.text, question.options, optionText, isCorrect, question.answerExplanation);
            setAiResponse(response);
        } catch (err) {
            setAiResponse("Erreur : Impossible de contacter l'IA. Vérifiez que LM Studio est lancé et configuré.");
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleAskCustom = async (question) => {
        if (!customQuestion.trim()) return;
        setIsAiLoading(true);
        setShowAiModal(true);
        setShowQuestionInput(false); // Close input, show loading modal
        setAiResponse(null);
        try {
            const response = await askCustomQuestion(customQuestion, question.text, question.options, question.answerExplanation);
            setAiResponse(response);
            setCustomQuestion('');
        } catch (err) {
            setAiResponse("Erreur : Impossible de contacter l'IA.");
        } finally {
            setIsAiLoading(false);
        }
    };



    const handleTextSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setSelectionRect(rect);
            setSelectedText(selection.toString());
        } else {
            setSelectionRect(null);
            setSelectedText('');
        }
    };

    const handleDefine = async () => {
        if (!selectedText) return;
        setIsAiLoading(true);
        setShowAiModal(true);
        setAiResponse(null);
        setSelectionRect(null); // Hide popover
        try {
            // Get context from current question
            const currentQ = qcm.questions[currentQuestionIndex];
            const context = `${currentQ.text} ${currentQ.options.map(o => o.text).join(' ')}`;
            const response = await getDefinition(selectedText, context);
            setAiResponse(response);
        } catch (err) {
            setAiResponse("Erreur : Impossible de contacter l'IA. Vérifiez que LM Studio est lancé.");
        } finally {
            setIsAiLoading(false);
        }
    };

    if (!qcm) return <div style={{ padding: '2rem', color: 'var(--text-main)' }}>Chargement...</div>;

    // Mode Selection Screen
    if (!mode) {
        return (
            <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
                <motion.button
                    onClick={onBack}
                    style={{ position: 'absolute', top: '2rem', left: '2rem', background: 'transparent', color: 'var(--text-muted)', fontSize: '1.5rem' }}
                    whileHover={{ x: -5 }}
                >
                    ← Retour
                </motion.button>

                <motion.h1
                    className="title-gradient"
                    style={{ fontSize: '3rem', marginBottom: 'var(--spacing-lg)', textAlign: 'center' }}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    {qcm.title}
                </motion.h1>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-md)', width: '100%', maxWidth: '1000px' }}>
                    {[
                        { id: 'all', icon: '📜', title: "Tout d'un coup", desc: "Affichez toutes les questions sur une seule page." },
                        { id: 'one-by-one', icon: '👉', title: "Une par une", desc: "Concentrez-vous sur une question à la fois." },
                        { id: 'one-by-one-immediate', icon: '✅', title: "Mode Entraînement", desc: "Validez chaque question instantanément." }
                    ].map((m, i) => (
                        <motion.div
                            key={m.id}
                            className="glass-panel"
                            onClick={() => setMode(m.id)}
                            style={{ padding: 'var(--spacing-xl)', cursor: 'pointer', textAlign: 'center' }}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            whileHover={{ y: -10, scale: 1.02, boxShadow: '0 10px 30px -10px rgba(99, 102, 241, 0.3)' }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{m.icon}</div>
                            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{m.title}</h3>
                            <p style={{ color: 'var(--text-muted)' }}>{m.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        );
    }

    // Render Questions based on mode
    const questionsToRender = (mode === 'all' || showResults) ? qcm.questions : [qcm.questions[currentQuestionIndex]];

    return (
        <div className="page-container" style={{ paddingBottom: '100px' }}>
            <header style={{ marginBottom: 'var(--spacing-xl)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <motion.button
                    onClick={() => setMode(null)}
                    style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.2rem' }}
                    whileHover={{ x: -5 }}
                >
                    ← Menu
                </motion.button>
                <motion.button
                    onClick={() => setMode(null)}
                    style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.2rem' }}
                    whileHover={{ x: -5 }}
                >
                    ← Menu
                </motion.button>
                <h1 className="title-gradient" style={{ fontSize: '2rem' }}>
                    {qcm.title}
                </h1>
                {mode !== 'all' && (
                    <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
                        Question {currentQuestionIndex + 1} / {qcm.questions.length}
                    </span>
                )}
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }} onMouseUp={handleTextSelection}>
                <AnimatePresence mode="wait">
                    {questionsToRender.map((q, idx) => {
                        // Adjust index for display if in one-by-one mode AND NOT showing results
                        const displayIndex = (mode === 'all' || showResults) ? idx : currentQuestionIndex;

                        // Determine if we should show feedback for this specific question
                        const isStepValidated = mode === 'one-by-one-immediate' && validatedSteps[displayIndex];
                        const showFeedback = showResults || isStepValidated;

                        const userSelected = answers[q.id] || [];
                        const isQuestionCorrect = showFeedback &&
                            userSelected.length === q.options.filter(o => o.isCorrect).length &&
                            userSelected.every(idx => q.options[idx].isCorrect);

                        return (
                            <motion.div
                                key={q.id}
                                className="glass-panel"
                                style={{
                                    padding: 'var(--spacing-lg)',
                                    border: showFeedback ? (isQuestionCorrect ? '1px solid var(--success)' : '1px solid var(--danger)') : '1px solid var(--glass-border)',
                                    position: 'relative'
                                }}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem' }}>Question {displayIndex + 1}</span>
                                    {showFeedback && (
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <motion.span
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                style={{ color: isQuestionCorrect ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}
                                            >
                                                {isQuestionCorrect ? 'Correct' : 'Incorrect'}
                                            </motion.span>
                                            <motion.button
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="btn-secondary"
                                                style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}
                                                onClick={(e) => { e.stopPropagation(); setShowQuestionInput(q.id); }}
                                            >
                                                💬 Poser une question
                                            </motion.button>
                                        </div>
                                    )}
                                </div>

                                <p style={{ fontSize: '1.3rem', marginBottom: 'var(--spacing-md)', lineHeight: '1.5' }}>{q.text}</p>

                                {/* Image Gallery */}
                                {(q.images || (q.image ? [q.image] : [])).length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
                                        {(q.images || (q.image ? [q.image] : [])).map((img, imgIdx) => (
                                            <img
                                                key={imgIdx}
                                                src={img}
                                                alt={`Question ${idx + 1} - Image ${imgIdx + 1}`}
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '300px',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--glass-border)',
                                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                                    objectFit: 'contain'
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    {q.options.map((opt, i) => {
                                        const isSelected = userSelected.includes(i);
                                        const isCorrect = opt.isCorrect;

                                        let bg = 'rgba(255,255,255,0.03)';
                                        let border = '1px solid var(--glass-border)';

                                        if (showFeedback) {
                                            if (isCorrect) {
                                                bg = 'rgba(16, 185, 129, 0.15)';
                                                border = '1px solid var(--success)';
                                            } else if (isSelected && !isCorrect) {
                                                bg = 'rgba(239, 68, 68, 0.15)';
                                                border = '1px solid var(--danger)';
                                            }
                                        } else if (isSelected) {
                                            bg = 'rgba(99, 102, 241, 0.15)';
                                            border = '1px solid var(--primary)';
                                        }

                                        return (
                                            <motion.div
                                                key={i}
                                                onClick={() => handleSelect(q.id, i, q.type)}
                                                style={{
                                                    padding: '1.2rem',
                                                    borderRadius: 'var(--radius-sm)',
                                                    background: bg,
                                                    border: border,
                                                    cursor: showFeedback ? 'default' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '1rem'
                                                }}
                                                whileHover={!showFeedback ? { scale: 1.01, backgroundColor: 'rgba(255,255,255,0.05)' } : {}}
                                                whileTap={!showFeedback ? { scale: 0.99 } : {}}
                                                animate={{ backgroundColor: bg, borderColor: border.split(' ')[2] }} // Animate color changes
                                            >
                                                <div style={{
                                                    width: '24px',
                                                    height: '24px',
                                                    borderRadius: '6px',
                                                    border: `2px solid ${isSelected || (showFeedback && isCorrect) ? (showFeedback && isCorrect ? 'var(--success)' : 'var(--primary)') : 'var(--text-dim)'}`,
                                                    background: isSelected || (showFeedback && isCorrect) ? (showFeedback && isCorrect ? 'var(--success)' : 'var(--primary)') : 'transparent',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    {(isSelected || (showFeedback && isCorrect)) && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ width: '10px', height: '10px', background: 'white', borderRadius: '2px' }}></motion.div>}
                                                </div>
                                                <span style={{ fontSize: '1.1rem', color: isSelected ? 'var(--text-main)' : 'var(--text-muted)', flex: 1 }}>{opt.text}</span>

                                                {showFeedback && (
                                                    <motion.button
                                                        initial={{ opacity: 0, scale: 0.8 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="btn-secondary"
                                                        style={{
                                                            padding: '0.2rem 0.5rem',
                                                            fontSize: '0.8rem',
                                                            marginLeft: '0.5rem',
                                                            background: 'rgba(0,0,0,0.2)',
                                                            border: 'none'
                                                        }}
                                                        onClick={(e) => { e.stopPropagation(); handleExplain(q, opt.text, opt.isCorrect); }}
                                                        title="Expliquer cette option"
                                                    >
                                                        🤖
                                                    </motion.button>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                {/* Explanation if available and feedback shown */}
                                {showFeedback && q.answerExplanation && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        style={{ marginTop: 'var(--spacing-md)', padding: 'var(--spacing-md)', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)' }}
                                    >
                                        <p style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Réponse :</p>
                                        <p>{q.answerExplanation}</p>
                                    </motion.div>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Navigation for One-by-One Modes */}
            {mode !== 'all' && !showResults && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: 'var(--spacing-lg)' }}>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <button
                            className="btn-secondary"
                            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                            disabled={currentQuestionIndex === 0}
                            style={{ opacity: currentQuestionIndex === 0 ? 0.5 : 1, flex: '1 1 auto' }}
                        >
                            Précédent
                        </button>

                        {/* Validate Button for Immediate Mode */}
                        {mode === 'one-by-one-immediate' && !validatedSteps[currentQuestionIndex] && (
                            <motion.button
                                className="btn-primary"
                                style={{ background: 'var(--warning)', flex: '1 1 auto' }}
                                onClick={handleValidateStep}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Valider
                            </motion.button>
                        )}

                        {/* Next Button */}
                        {(mode === 'one-by-one' || (mode === 'one-by-one-immediate' && validatedSteps[currentQuestionIndex])) && (
                            currentQuestionIndex < qcm.questions.length - 1 ? (
                                <motion.button
                                    className="btn-primary"
                                    onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    style={{ flex: '1 1 auto' }}
                                >
                                    Suivant
                                </motion.button>
                            ) : (
                                <motion.button
                                    className="btn-primary"
                                    style={{ background: 'var(--success)', flex: '1 1 auto' }}
                                    onClick={calculateScore}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    Terminer
                                </motion.button>
                            )
                        )}
                    </div>
                </div>
            )}

            {/* Submit Button for All Mode */}
            {mode === 'all' && !showResults && (
                <motion.button
                    className="btn-primary"
                    style={{ marginTop: 'var(--spacing-xl)', width: '100%', padding: '1.5rem', fontSize: '1.3rem' }}
                    onClick={calculateScore}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    Valider les Réponses
                </motion.button>
            )}

            {/* Results View */}
            {showResults && (
                <motion.div
                    className="glass-panel"
                    style={{ marginTop: 'var(--spacing-xl)', padding: 'var(--spacing-xl)', textAlign: 'center' }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                >
                    <h2 style={{ fontSize: '2.5rem', marginBottom: 'var(--spacing-sm)' }}>
                        Score: {score} / {qcm.questions.length}
                    </h2>
                    <motion.div
                        style={{
                            fontSize: '4rem',
                            fontWeight: 'bold',
                            background: 'linear-gradient(to right, var(--primary), var(--secondary))',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            marginBottom: 'var(--spacing-md)'
                        }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3, type: 'spring' }}
                    >
                        {Math.round((score / qcm.questions.length) * 100)}%
                    </motion.div>
                    <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-lg)' }}>
                        {score === qcm.questions.length ? 'Parfait ! 🎉' : score > qcm.questions.length / 2 ? 'Bien joué ! 👍' : 'Continuez à vous entraîner ! 💪'}
                    </p>
                    <motion.button
                        className="btn-primary"
                        onClick={onBack}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        Retour au Tableau de Bord
                    </motion.button>
                </motion.div>
            )}

            {/* AI Selection Popover */}
            {selectionRect && (
                <div
                    style={{
                        position: 'fixed',
                        top: selectionRect.top - 40,
                        left: selectionRect.left + (selectionRect.width / 2) - 40,
                        zIndex: 1000
                    }}
                >
                    <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="btn-primary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
                        onClick={handleDefine}
                    >
                        📖 Définir
                    </motion.button>
                </div>
            )}

            {/* AI Modal */}
            <AnimatePresence>
                {showAiModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
                        }}
                        onClick={() => setShowAiModal(false)}
                    >
                        <motion.div
                            className="glass-panel"
                            style={{ width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto', padding: '2rem', position: 'relative' }}
                            onClick={e => e.stopPropagation()}
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                        >
                            <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                🤖 Assistant IA
                            </h2>
                            {isAiLoading ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                        style={{ width: '40px', height: '40px', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 1rem' }}
                                    />
                                    <p>Réflexion en cours...</p>
                                </div>
                            ) : (
                                <div style={{ lineHeight: '1.6', color: 'var(--text-main)', fontSize: '1rem' }}>
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            h1: ({ node, ...props }) => <h1 style={{ color: 'var(--primary)', fontSize: '1.5rem', marginBottom: '1rem', marginTop: '1.5rem' }} {...props} />,
                                            h2: ({ node, ...props }) => <h2 style={{ color: 'var(--secondary)', fontSize: '1.3rem', marginBottom: '0.8rem', marginTop: '1.2rem' }} {...props} />,
                                            h3: ({ node, ...props }) => <h3 style={{ color: 'var(--accent)', fontSize: '1.1rem', marginBottom: '0.6rem', marginTop: '1rem' }} {...props} />,
                                            p: ({ node, ...props }) => <p style={{ marginBottom: '1rem' }} {...props} />,
                                            ul: ({ node, ...props }) => <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }} {...props} />,
                                            ol: ({ node, ...props }) => <ol style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }} {...props} />,
                                            li: ({ node, ...props }) => <li style={{ marginBottom: '0.5rem' }} {...props} />,
                                            strong: ({ node, ...props }) => <strong style={{ color: 'var(--primary)', fontWeight: 'bold' }} {...props} />,
                                            em: ({ node, ...props }) => <em style={{ color: 'var(--secondary)', fontStyle: 'italic' }} {...props} />,
                                            blockquote: ({ node, ...props }) => <blockquote style={{ borderLeft: '4px solid var(--primary)', paddingLeft: '1rem', marginLeft: 0, color: 'var(--text-muted)', fontStyle: 'italic' }} {...props} />,
                                            code: ({ node, inline, ...props }) => (
                                                inline
                                                    ? <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.4rem', borderRadius: '4px', fontFamily: 'monospace', color: 'var(--accent)' }} {...props} />
                                                    : <code style={{ display: 'block', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', overflowX: 'auto', fontFamily: 'monospace', margin: '1rem 0' }} {...props} />
                                            ),
                                        }}
                                    >
                                        {aiResponse}
                                    </ReactMarkdown>
                                </div>
                            )}
                            <button
                                className="btn-secondary"
                                style={{ marginTop: '2rem', width: '100%' }}
                                onClick={() => setShowAiModal(false)}
                            >
                                Fermer
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>



            {/* Custom Question Input Modal */}
            <AnimatePresence>
                {showQuestionInput && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
                        }}
                        onClick={() => setShowQuestionInput(false)}
                    >
                        <motion.div
                            className="glass-panel"
                            style={{ width: '90%', maxWidth: '500px', padding: '2rem' }}
                            onClick={e => e.stopPropagation()}
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                        >
                            <h2 style={{ marginBottom: '1rem' }}>💬 Poser une question</h2>
                            <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Posez votre question à l'IA concernant cet exercice.</p>
                            <textarea
                                className="input-field"
                                style={{ width: '100%', minHeight: '100px', marginBottom: '1rem', resize: 'vertical' }}
                                value={customQuestion}
                                onChange={e => setCustomQuestion(e.target.value)}
                                placeholder="Ex: Pourquoi la réponse B est fausse ?"
                                autoFocus
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button className="btn-secondary" onClick={() => setShowQuestionInput(false)}>Annuler</button>
                                <button
                                    className="btn-primary"
                                    onClick={() => {
                                        // Find the question object based on showQuestionInput (which holds the ID)
                                        const q = qcm.questions.find(q => q.id === showQuestionInput);
                                        handleAskCustom(q);
                                    }}
                                    disabled={!customQuestion.trim()}
                                >
                                    Envoyer
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default Player;
