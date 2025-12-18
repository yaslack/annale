import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { saveQCM } from './utils/storage';
import Dashboard from './components/Dashboard';
import Editor from './components/Editor';
import Player from './components/Player';
import Pomodoro from './components/Pomodoro';
import AISettings from './components/AISettings';
import './styles/global.css';

function App() {
  const [view, setView] = useState('dashboard'); // 'dashboard', 'editor', 'player'
  const [currentQCMId, setCurrentQCMId] = useState(null);

  const handleCreateNew = (title, folderId = null) => {
    const newQCM = {
      id: Date.now().toString(),
      title: title,
      questions: [],
      folderId: folderId,
      updatedAt: Date.now()
    };
    saveQCM(newQCM);
    setCurrentQCMId(newQCM.id);
    setView('editor');
  };

  const handleEdit = (id) => {
    setCurrentQCMId(id);
    setView('editor');
  };

  const handlePlay = (id) => {
    setCurrentQCMId(id);
    setView('player');
  };

  const handleBack = () => {
    setView('dashboard');
    setCurrentQCMId(null);
  };

  const pageVariants = {
    initial: { opacity: 0, y: 20, scale: 0.98 },
    in: { opacity: 1, y: 0, scale: 1 },
    out: { opacity: 0, y: -20, scale: 0.98 }
  };

  const pageTransition = {
    type: 'tween',
    ease: 'anticipate',
    duration: 0.4
  };

  return (
    <div className="app-container">
      <AnimatePresence mode="wait">
        {view === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            style={{ width: '100%' }}
          >
            <Dashboard onCreateNew={handleCreateNew} onEdit={handleEdit} onPlay={handlePlay} />
          </motion.div>
        )}
        {view === 'editor' && (
          <motion.div
            key="editor"
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            style={{ width: '100%' }}
          >
            <Editor qcmId={currentQCMId} onBack={handleBack} />
          </motion.div>
        )}
        {view === 'player' && (
          <motion.div
            key="player"
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            style={{ width: '100%' }}
          >
            <Player qcmId={currentQCMId} onBack={handleBack} />
          </motion.div>
        )}
      </AnimatePresence>
      <Pomodoro />
      <AISettings />
    </div>
  );
}

export default App;
