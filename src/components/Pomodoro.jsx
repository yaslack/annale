import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { soundManager } from '../utils/sound';

const Pomodoro = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState('work'); // 'work' | 'break'

    const timerRef = useRef(null);

    useEffect(() => {
        if (isActive && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            clearInterval(timerRef.current);
            setIsActive(false);
            soundManager.playComplete(); // Alarm
            // Auto switch mode? Maybe just stop.
        }

        return () => clearInterval(timerRef.current);
    }, [isActive, timeLeft]);

    const toggleTimer = () => {
        soundManager.playClick();
        setIsActive(!isActive);
    };

    const resetTimer = () => {
        soundManager.playClick();
        setIsActive(false);
        setTimeLeft(mode === 'work' ? 25 * 60 : 5 * 60);
    };

    const switchMode = (newMode) => {
        soundManager.playClick();
        setMode(newMode);
        setIsActive(false);
        setTimeLeft(newMode === 'work' ? 25 * 60 : 5 * 60);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 100 }}>
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
                            width: '300px',
                            background: 'rgba(15, 23, 42, 0.9)',
                            border: '1px solid var(--glass-border)'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <button
                                onClick={() => switchMode('work')}
                                style={{
                                    flex: 1,
                                    padding: '0.5rem',
                                    background: mode === 'work' ? 'var(--primary)' : 'transparent',
                                    color: mode === 'work' ? 'white' : 'var(--text-muted)',
                                    borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)',
                                    border: '1px solid var(--glass-border)'
                                }}
                            >
                                Travail
                            </button>
                            <button
                                onClick={() => switchMode('break')}
                                style={{
                                    flex: 1,
                                    padding: '0.5rem',
                                    background: mode === 'break' ? 'var(--success)' : 'transparent',
                                    color: mode === 'break' ? 'white' : 'var(--text-muted)',
                                    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                                    border: '1px solid var(--glass-border)',
                                    borderLeft: 'none'
                                }}
                            >
                                Pause
                            </button>
                        </div>

                        <div style={{ fontSize: '3.5rem', fontWeight: 'bold', textAlign: 'center', fontFamily: 'monospace', marginBottom: '1rem' }}>
                            {formatTime(timeLeft)}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className="btn-primary"
                                style={{ flex: 2, background: isActive ? 'var(--warning)' : 'var(--primary)' }}
                                onClick={toggleTimer}
                            >
                                {isActive ? 'Pause' : 'Démarrer'}
                            </button>
                            <button
                                className="btn-secondary"
                                style={{ flex: 1 }}
                                onClick={resetTimer}
                            >
                                Reset
                            </button>
                        </div>
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
                    background: 'var(--primary)',
                    color: 'white',
                    fontSize: '1.5rem',
                    boxShadow: '0 4px 12px var(--primary-glow)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    cursor: 'pointer'
                }}
            >
                {isOpen ? '✕' : '⏱️'}
            </motion.button>
        </div>
    );
};

export default Pomodoro;
