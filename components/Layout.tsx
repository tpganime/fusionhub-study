import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Sun, Moon, Home, Settings, ShieldCheck, LogOut, AlertTriangle, ExternalLink, X, Bell } from 'lucide-react';
import { formatTo12Hour, getCurrentPeriod, getMinutesRemaining } from '../utils/helpers';

// --- Toast Component ---
const Toast: React.FC<{ message: string; subMessage?: string; onClose: () => void }> = ({ message, subMessage, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000); // Auto close after 5s
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] animate-fade-in-up w-[90%] max-w-md">
      <div className="bg-white dark:bg-gray-800 border-l-4 border-primary-500 shadow-2xl rounded-r-lg p-4 flex items-start justify-between">
        <div className="flex items-start space-x-3">
           <div className="bg-primary-100 dark:bg-primary-900/30 p-2 rounded-full text-primary-600">
              <Bell className="w-5 h-5 animate-pulse" />
           </div>
           <div>
             <h3 className="font-bold text-gray-900 dark:text-white">{message}</h3>
             {subMessage && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{subMessage}</p>}
           </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// --- Audio Helper (Oscillator based - No download needed) ---
const playNotificationSound = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        // Pleasant chime sound (Sine wave)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1); // C6

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
        console.error("Audio play failed:", e);
    }
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, updateSettings, isAdmin, logoutAdmin, timetable, configError } = useApp();
  const location = useLocation();
  const lastNotifiedPeriodRef = useRef<string | null>(null);
  
  // Toast State
  const [toast, setToast] = useState<{ message: string, subMessage: string } | null>(null);

  const toggleTheme = () => {
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };

  const isActive = (path: string) => location.pathname === path ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/10 rounded-lg' : 'text-gray-500 dark:text-gray-400 hover:text-primary-600';

  // --- Interaction Listener (Unlock Audio) ---
  useEffect(() => {
    const unlockAudio = () => {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
            const ctx = new AudioContext();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
        }
        // Remove listener after first interaction
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    
    return () => {
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // --- Global Notification Logic ---
  useEffect(() => {
    const checkNotifications = () => {
        // If settings disabled, do nothing
        if (!settings.notificationsEnabled) return;

        const now = new Date();
        const { current, periodNum } = getCurrentPeriod(timetable, settings.batch, now);

        // If we are inside a valid period
        if (current) {
            const isNewPeriod = lastNotifiedPeriodRef.current !== current.id;
            
            if (isNewPeriod) {
                // 1. Play Sound
                playNotificationSound();

                // 2. Show In-App Popup (Toast)
                setToast({
                    message: `Period ${periodNum} Started`,
                    subMessage: `${current.subject} (${formatTo12Hour(current.startTime)} - ${formatTo12Hour(current.endTime)})`
                });

                // 3. System Notification (if permission granted)
                if ("Notification" in window && Notification.permission === 'granted') {
                    try {
                        new Notification(`🔔 Class Started: ${current.subject}`, {
                            body: `Period ${periodNum} is now live.\nTime: ${formatTo12Hour(current.startTime)}`,
                            icon: '/logo.svg',
                            tag: 'fusionhub-period-alert',
                            renotify: true
                        } as any);
                    } catch (e) {
                        console.error("System notification error", e);
                    }
                }

                // Update ref so we don't notify again for this period
                lastNotifiedPeriodRef.current = current.id;
            }
        } else {
            // We are in a break or free time
            if (lastNotifiedPeriodRef.current !== 'break') {
                // Optional: Notify about break? For now, just reset logic so next period fires.
                // We set it to null so the NEXT valid period will definitely count as "new"
                // But we check if we were previously IN a period to avoid spamming "Break" on load
                if (lastNotifiedPeriodRef.current !== null) {
                    // Logic for break start could go here if desired
                }
                lastNotifiedPeriodRef.current = null;
            }
        }
    };

    // Check every second
    const interval = setInterval(checkNotifications, 1000);
    return () => clearInterval(interval);
  }, [settings.notificationsEnabled, settings.batch, timetable]);

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-300 relative">
      {/* Toast Notification */}
      {toast && (
          <Toast 
            message={toast.message} 
            subMessage={toast.subMessage} 
            onClose={() => setToast(null)} 
          />
      )}

      {/* Configuration Error Banner */}
      {configError && (
        <div className="bg-amber-100 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-700/50 text-amber-900 dark:text-amber-100 px-4 py-3 shadow-inner">
           <div className="max-w-7xl mx-auto flex items-start gap-3">
               <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
               <div className="flex-grow text-sm">
                   <p className="font-bold mb-1">Firebase Setup Required</p>
                   {configError === 'auth-disabled' ? (
                       <p>
                           Anonymous Authentication is disabled. Go to <a href="https://console.firebase.google.com" target="_blank" className="underline font-semibold hover:text-amber-700">Firebase Console</a> &gt; Build &gt; Authentication &gt; Sign-in method &gt; Enable <strong>Anonymous</strong>.
                       </p>
                   ) : (
                       <p>
                           Database access is denied. Go to <a href="https://console.firebase.google.com" target="_blank" className="underline font-semibold hover:text-amber-700">Firebase Console</a> &gt; Build &gt; Firestore Database &gt; Rules and change to: <code>allow read, write: if true;</code>
                       </p>
                   )}
               </div>
               <a href="https://console.firebase.google.com" target="_blank" className="text-amber-700 dark:text-amber-300 hover:text-amber-900">
                   <ExternalLink className="w-4 h-4" />
               </a>
           </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-dark-card/80 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 group">
              <img src="/logo.svg" alt="FusionHub Logo" className="w-8 h-8 sm:w-10 sm:h-10 transition-transform duration-200 group-hover:rotate-12" />
              <span className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-500 to-purple-600 group-hover:scale-105 transition-transform duration-200">
                FusionHub
              </span>
            </Link>

            {/* Nav Items */}
            <div className="flex items-center space-x-3 sm:space-x-6">
              <Link to="/" className={`p-2 transition-all duration-200 ${isActive('/')}`} title="Home">
                <Home className="w-5 h-5 sm:w-6 sm:h-6" />
              </Link>
              
              {isAdmin ? (
                 <div className="flex items-center space-x-2 sm:space-x-4 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-1">
                    <Link to="/admin" className={`p-2 transition-all duration-200 ${isActive('/admin')}`} title="Admin Dashboard">
                      <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                    </Link>
                    <button onClick={logoutAdmin} className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Logout">
                      <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                 </div>
              ) : (
                <Link to="/admin" className={`p-2 transition-all duration-200 ${isActive('/admin')}`} title="Admin Login">
                  <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 opacity-60 hover:opacity-100" />
                </Link>
              )}

              <Link to="/settings" className={`p-2 transition-all duration-200 ${isActive('/settings')}`} title="Settings">
                <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
              </Link>

              <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-2"></div>

              <button 
                onClick={toggleTheme} 
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
                aria-label="Toggle Theme"
              >
                {settings.theme === 'dark' ? <Sun className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" /> : <Moon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-900" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-grow container mx-auto px-4 py-6 max-w-7xl w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
        &copy; {new Date().getFullYear()} FusionHub Study.
      </footer>
    </div>
  );
};