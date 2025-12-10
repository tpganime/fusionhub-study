import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { UserSettings, Batch, Timetable, StudyMaterial, SubjectType } from '../types';
import { DEFAULT_TIMETABLE } from '../constants';
import { supabase } from '../services/supabaseClient';

interface AppContextType {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  isAdmin: boolean;
  loginAdmin: () => void;
  logoutAdmin: () => void;
  timetable: Timetable;
  updateTimetable: (batch: Batch, dayIndex: number, periodIndex: number, subject: string, startTime: string, endTime: string) => Promise<void>;
  materials: StudyMaterial[];
  addMaterial: (material: StudyMaterial) => Promise<void>;
  isLoadingData: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- State ---
  // Settings remain local as they are per-device user preferences
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('fh_settings');
    // Default notifications to false if not set. Default theme is now 'light'
    return saved ? { notificationsEnabled: false, ...JSON.parse(saved) } : { batch: Batch.BATCH_1, theme: 'light', notificationsEnabled: false };
  });

  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  
  // Data from Supabase
  const [timetable, setTimetable] = useState<Timetable>(DEFAULT_TIMETABLE);
  // Use a Ref to hold the latest timetable state. This prevents stale closure issues
  // when updateTimetable is called multiple times rapidly (e.g., for "Both Batches").
  const timetableRef = useRef<Timetable>(DEFAULT_TIMETABLE);

  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('fh_settings', JSON.stringify(settings));
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingData(true);
        
        // 1. Fetch Materials
        const { data: matData, error: matError } = await supabase
          .from('materials')
          .select('*')
          .order('upload_date', { ascending: false });
          
        if (matData) {
           const formattedMaterials: StudyMaterial[] = matData.map((m: any) => ({
             id: m.id,
             title: m.title,
             subject: m.subject as SubjectType,
             type: m.type as 'video' | 'photo' | 'note', // Cast to supported types
             size: m.size,
             uploadDate: m.upload_date || m.uploadDate, // handle both casing
             url: m.url
           }));
           setMaterials(formattedMaterials);
        }

        // 2. Fetch Timetable
        const { data: timeData, error: timeError } = await supabase
          .from('timetables')
          .select('*');

        if (timeData && timeData.length > 0) {
          const newTimetable = { ...DEFAULT_TIMETABLE };
          timeData.forEach((row: any) => {
             if (row.batch === Batch.BATCH_1 || row.batch === Batch.BATCH_2) {
                newTimetable[row.batch as Batch] = row.schedule;
             }
          });
          setTimetable(newTimetable);
          timetableRef.current = newTimetable; // Sync Ref
        } else {
          // If no timetable exists in DB, insert default one
          await supabase.from('timetables').upsert([
             { batch: Batch.BATCH_1, schedule: DEFAULT_TIMETABLE[Batch.BATCH_1] },
             { batch: Batch.BATCH_2, schedule: DEFAULT_TIMETABLE[Batch.BATCH_2] }
          ]);
        }

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, []);

  // --- Actions ---
  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const loginAdmin = () => setIsAdmin(true);
  const logoutAdmin = () => setIsAdmin(false);

  const updateTimetable = async (batch: Batch, dayIndex: number, periodIndex: number, subject: string, startTime: string, endTime: string) => {
    // 1. Use Ref to get absolute latest state (bypassing closure staleness)
    const currentTimetable = timetableRef.current;
    const currentBatchSchedule = currentTimetable[batch];
    
    if (!currentBatchSchedule) return;

    const newSchedule = currentBatchSchedule.map((day, dIdx) => {
        if (dIdx !== dayIndex) return day;
        return {
            ...day,
            periods: day.periods.map((p, pIdx) => {
                if (pIdx !== periodIndex) return p;
                return { ...p, subject, startTime, endTime };
            })
        };
    });
    
    // 2. Update Ref immediately so subsequent calls see this change
    const updatedTimetable = {
      ...currentTimetable,
      [batch]: newSchedule
    };
    timetableRef.current = updatedTimetable;

    // 3. Update React State to trigger re-render
    setTimetable(updatedTimetable);

    // 4. Sync with Supabase (using the clean newSchedule for this specific batch)
    try {
      await supabase
        .from('timetables')
        .upsert({ batch: batch, schedule: newSchedule });
    } catch (error) {
      console.error("Failed to update timetable in DB", error);
    }
  };

  const addMaterial = async (material: StudyMaterial) => {
    // 1. Optimistic UI Update
    setMaterials(prev => [material, ...prev]);

    // 2. Sync with Supabase
    try {
      await supabase.from('materials').insert({
        title: material.title,
        subject: material.subject,
        type: material.type,
        size: material.size,
        upload_date: material.uploadDate,
        url: material.url
      });
    } catch (error) {
      console.error("Failed to add material to DB", error);
    }
  };

  return (
    <AppContext.Provider value={{
      settings,
      updateSettings,
      isAdmin,
      loginAdmin,
      logoutAdmin,
      timetable,
      updateTimetable,
      materials,
      addMaterial,
      isLoadingData
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};