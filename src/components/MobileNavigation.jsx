import { motion } from 'framer-motion';
import { soundManager } from '../utils/sound';

const MobileNavigation = ({
    onHome,
    onSearch,
    onAdd,
    onGenerate,
    selectionCount
}) => {
    const navItems = [
        { id: 'home', icon: '🏠', label: 'Accueil', action: onHome },
        { id: 'search', icon: '🔍', label: 'Recherche', action: onSearch },
        { id: 'add', icon: '➕', label: 'Créer', action: onAdd, primary: true },
        { id: 'generate', icon: '🧠', label: 'Générer', action: onGenerate, disabled: selectionCount === 0, badge: selectionCount },
    ];

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '100%',
            background: 'rgba(15, 15, 20, 0.95)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--glass-border)',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '0.5rem 0',
            zIndex: 1000,
            paddingBottom: 'env(safe-area-inset-bottom, 1rem)' // Handle iPhone notch/bar
        }}>
            {navItems.map(item => (
                <motion.button
                    key={item.id}
                    onClick={() => {
                        if (!item.disabled) {
                            soundManager.playClick();
                            item.action();
                        }
                    }}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.2rem',
                        color: item.disabled ? 'var(--text-muted)' : (item.primary ? 'var(--accent)' : 'var(--text-dim)'),
                        opacity: item.disabled ? 0.5 : 1,
                        position: 'relative',
                        padding: '0.5rem',
                        flex: 1
                    }}
                    whileTap={{ scale: 0.9 }}
                >
                    <div style={{
                        fontSize: item.primary ? '1.8rem' : '1.5rem',
                        background: item.primary ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        borderRadius: item.primary ? '50%' : '0',
                        width: item.primary ? '45px' : 'auto',
                        height: item.primary ? '45px' : 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {item.icon}
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: '600' }}>{item.label}</span>

                    {item.badge > 0 && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            style={{
                                position: 'absolute',
                                top: '5px',
                                right: '25%',
                                background: 'var(--accent)',
                                color: 'white',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                fontSize: '0.7rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold'
                            }}
                        >
                            {item.badge}
                        </motion.div>
                    )}
                </motion.button>
            ))}
        </div>
    );
};

export default MobileNavigation;
