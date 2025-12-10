import React from 'react';
import { useApp } from '../context/AppContext';
import { Batch } from '../types';
import { Moon, Sun, Users, Bell, BellOff } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useApp();

  const toggleNotifications = async () => {
    if (!settings.notificationsEnabled) {
      // Trying to enable
      if (!("Notification" in window)) {
        alert("This browser does not support desktop notifications");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        updateSettings({ notificationsEnabled: true });
        new Notification("Notifications Enabled", { body: "You will now receive alerts for period changes." });
      } else {
        alert("Permission denied. Please enable notifications in your browser settings.");
      }
    } else {
      // Disabling
      updateSettings({ notificationsEnabled: false });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in-up">
      <h1 className="text-3xl font-bold">Settings</h1>

      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-8">
        
        {/* Batch Selection */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-primary-500" />
            Your Batch
          </h2>
          <p className="text-gray-500 text-sm mb-4">Select your batch to get accurate timetable notifications.</p>
          <div className="grid grid-cols-2 gap-4">
            {[Batch.BATCH_1, Batch.BATCH_2].map((b) => (
              <button
                key={b}
                onClick={() => updateSettings({ batch: b })}
                className={`p-4 rounded-xl border-2 transition-all duration-200 font-bold ${
                  settings.batch === b
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 shadow-md'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        <hr className="border-gray-100 dark:border-gray-700" />

        {/* Notifications */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Bell className="w-5 h-5 mr-2 text-primary-500" />
            Notifications
          </h2>
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl transition-colors">
            <div className="flex flex-col">
              <span className="font-medium">Period Alerts</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Get notified when a new period starts</span>
            </div>
            <button 
              onClick={toggleNotifications}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${settings.notificationsEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <hr className="border-gray-100 dark:border-gray-700" />

        {/* Appearance */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center">
             {settings.theme === 'dark' ? <Moon className="w-5 h-5 mr-2 text-primary-500" /> : <Sun className="w-5 h-5 mr-2 text-primary-500" />}
             Appearance
          </h2>
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl transition-colors">
            <span className="font-medium">Dark Mode</span>
            <button 
              onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${settings.theme === 'dark' ? 'bg-primary-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};