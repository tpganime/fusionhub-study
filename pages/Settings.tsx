import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Batch } from '../types';
import { Moon, Sun, Users, Bell } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useApp();

  // Sync state with actual browser permission on mount
  useEffect(() => {
    if (settings.notificationsEnabled && "Notification" in window && Notification.permission !== 'granted') {
      // If setting is ON but browser says NO, turn setting OFF
      updateSettings({ notificationsEnabled: false });
    }
  }, [settings.notificationsEnabled, updateSettings]);

  const toggleNotifications = async () => {
    // 1. If currently enabled, just turn off
    if (settings.notificationsEnabled) {
      updateSettings({ notificationsEnabled: false });
      return;
    }

    // 2. Browser support check
    if (!("Notification" in window)) {
      alert("This browser does not support desktop notifications.");
      return;
    }

    // 3. Check current permission status
    if (Notification.permission === 'granted') {
      // Already granted, just enable setting
      updateSettings({ notificationsEnabled: true });
      try {
        new Notification("Notifications Active", { body: "You will receive alerts for class periods." });
      } catch (e) {
        console.warn("Notification test failed:", e);
      }
      return;
    }

    if (Notification.permission === 'denied') {
      // Blocked - guide user to fix it
      alert("Notifications are blocked for this site.\n\nPlease click the lock icon (🔒) in your browser address bar and set Notifications to 'Allow', then try again.");
      return;
    }

    // 4. Permission is 'default', so ASK the user
    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        updateSettings({ notificationsEnabled: true });
        try {
          new Notification("Notifications Enabled", { body: "You will receive alerts for class periods." });
        } catch (e) {
          console.warn("Notification test failed:", e);
        }
      } else {
        // User clicked Block or X
        updateSettings({ notificationsEnabled: false });
      }
    } catch (error) {
      console.error("Error requesting permission:", error);
      alert("Something went wrong requesting permissions. Please check your browser settings.");
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
          {!settings.notificationsEnabled && Notification.permission === 'denied' && (
            <p className="text-xs text-red-500 mt-2 px-1">
              * Notifications are blocked in browser settings.
            </p>
          )}
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