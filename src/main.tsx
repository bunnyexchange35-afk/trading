import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installMotionGovernor } from './perf';
import './styles.css';
import './theme-animation.css';
import './admin.css';

// Pause decorative animation loops whenever nothing can see them (hidden
// tab / offline) and disable continuous background motion on low-power
// mobile devices. Purely operational — the static design is untouched.
installMotionGovernor();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
