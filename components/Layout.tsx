import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Sun, Moon, Home, Settings, ShieldCheck, LogOut, AlertTriangle, ExternalLink } from 'lucide-react';
import { formatTo12Hour, getCurrentPeriod, getMinutesRemaining } from '../utils/helpers';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, updateSettings, isAdmin, logoutAdmin, timetable, configError } = useApp();
  const location = useLocation();
  const lastNotifiedPeriodRef = useRef<string | null>(null);
  const lastUpdatedMinuteRef = useRef<number | null>(null);

  const toggleTheme = () => {
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };

  const isActive = (path: string) => location.pathname === path ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/10 rounded-lg' : 'text-gray-500 dark:text-gray-400 hover:text-primary-600';

  // --- Global Notification Logic ---
  useEffect(() => {
    const checkNotifications = () => {
        if (!settings.notificationsEnabled) return;
        if (!("Notification" in window) || Notification.permission !== 'granted') return;

        const now = new Date();
        const { current, periodNum } = getCurrentPeriod(timetable, settings.batch, now);
        const currentMinute = now.getMinutes();

        if (current) {
            // Check if it's a new period or if minute changed (for countdown update)
            const isNewPeriod = lastNotifiedPeriodRef.current !== current.id;
            const isNewMinute = lastUpdatedMinuteRef.current !== currentMinute;

            if (isNewPeriod || isNewMinute) {
                // 1. Play Sound (Only on new period)
                if (isNewPeriod) {
                    try {
                        const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-positive-notification-951.mp3');
                        audio.volume = 0.6;
                        audio.play().catch(e => console.log('Audio play blocked (user must interact first)', e));
                    } catch (e) {
                        console.error("Audio Error", e);
                    }
                }

                // 2. Show/Update Notification (Continuous/Sticky)
                try {
                    const remaining = getMinutesRemaining(current.endTime);
                    const options: any = {
                        body: `Period ${periodNum}: ${current.subject}\nTime: ${formatTo12Hour(current.startTime)} - ${formatTo12Hour(current.endTime)}\nRemaining: ${remaining} min\nBatch: ${settings.batch}`,
                        icon: '/logo.svg',
                        tag: 'fusionhub-live-status', 
                        renotify: isNewPeriod, // Buzz/Sound only if it's a new period
                        silent: !isNewPeriod,  // Silent update for minute ticks
                        requireInteraction: true 
                    };

                    new Notification(isNewPeriod ? `🔔 Class Started: ${current.subject}` : `Live: ${current.subject}`, options);
                } catch (e) {
                    console.error("Notification Error", e);
                }

                lastNotifiedPeriodRef.current = current.id;
                lastUpdatedMinuteRef.current = currentMinute;
            }
        } else {
            // Reset if break or free period
            lastNotifiedPeriodRef.current = null;
        }
    };

    // Check every second
    const interval = setInterval(checkNotifications, 1000);
    return () => clearInterval(interval);
  }, [settings.notificationsEnabled, settings.batch, timetable]);

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-300">
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