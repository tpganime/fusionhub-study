import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Sun, Moon, Home, Settings, ShieldCheck, LogOut } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, updateSettings, isAdmin, logoutAdmin } = useApp();
  const location = useLocation();

  const toggleTheme = () => {
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };

  const isActive = (path: string) => location.pathname === path ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/10 rounded-lg' : 'text-gray-500 dark:text-gray-400 hover:text-primary-600';

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-300">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-dark-card/80 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 group">
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