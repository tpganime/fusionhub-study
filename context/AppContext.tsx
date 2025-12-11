import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { UserSettings, Batch, Timetable, StudyMaterial, SubjectType } from '../types';
import { DEFAULT_TIMETABLE } from '../constants';
import { db, auth } from '../services/firebase';
import { collection, getDocs, doc, setDoc, addDoc, query, orderBy } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

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
  refreshMaterials: () => Promise<void>;
  configError: 'auth-disabled' | 'permission-denied' | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- State ---
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('fh_settings');
    return saved ? { notificationsEnabled: false, ...JSON.parse(saved) } : { batch: Batch.BATCH_1, theme: 'light', notificationsEnabled: false };
  });

  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  
  // Data
  const [timetable, setTimetable] = useState<Timetable>(DEFAULT_TIMETABLE);
  const timetableRef = useRef<Timetable>(DEFAULT_TIMETABLE);

  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [configError, setConfigError] = useState<'auth-disabled' | 'permission-denied' | null>(null);

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('fh_settings', JSON.stringify(settings));
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  // Authenticate and Fetch
  useEffect(() => {
    let mounted = true;
    
    const initAuth = async () => {
        // Setup listener
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!mounted) return;
            
            if (user) {
                // User is signed in, safe to fetch
                setConfigError(null);
                await fetchData();
            } else {
                // Not logged in. Try Anonymous.
                try {
                    await signInAnonymously(auth);
                    // onAuthStateChanged will trigger again with user
                } catch (error: any) {
                    console.warn("FusionHub: Anonymous Auth disabled or restricted.", error.code);
                    if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
                        setConfigError('auth-disabled');
                    }
                    // Attempt fetch anyway (in case of public rules)
                    await fetchData(); 
                }
            }
        });
        return unsub;
    };

    const unsubscribePromise = initAuth();

    return () => { 
        mounted = false;
        unsubscribePromise.then(unsub => unsub && unsub());
    };
  }, []);

  const fetchData = async () => {
    try {
      setIsLoadingData(true);
      
      // 1. Fetch Materials
      await fetchMaterials();

      // 2. Fetch Timetable
      const timeSnapshot = await getDocs(collection(db, 'timetables'));
      
      if (!timeSnapshot.empty) {
        const newTimetable = { ...DEFAULT_TIMETABLE };
        timeSnapshot.forEach((doc) => {
           const data = doc.data();
           const batchId = doc.id as Batch;
           if (batchId === Batch.BATCH_1 || batchId === Batch.BATCH_2) {
              newTimetable[batchId] = data.schedule;
           }
        });
        setTimetable(newTimetable);
        timetableRef.current = newTimetable;
      } else {
        // Try to initialize if empty
        try {
            await setDoc(doc(db, 'timetables', Batch.BATCH_1), { schedule: DEFAULT_TIMETABLE[Batch.BATCH_1] });
            await setDoc(doc(db, 'timetables', Batch.BATCH_2), { schedule: DEFAULT_TIMETABLE[Batch.BATCH_2] });
        } catch (e) {
            console.log("Using default timetable (DB init skipped due to permissions).");
        }
      }

    } catch (error: any) {
      console.error("Error fetching data:", error);
      if (error.code === 'permission-denied') {
          // Only override if we don't already know it's an auth issue
          setConfigError(prev => prev === 'auth-disabled' ? 'auth-disabled' : 'permission-denied');
      }
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchMaterials = async () => {
      try {
        const q = query(collection(db, 'materials'), orderBy('uploadDate', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const formattedMaterials: StudyMaterial[] = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title,
                subject: data.subject as SubjectType,
                type: data.type as 'video' | 'photo' | 'note',
                size: data.size,
                uploadDate: data.uploadDate,
                url: data.url
            };
        });
        setMaterials(formattedMaterials);
      } catch (e: any) {
        if (e.code === 'permission-denied') {
             throw e; // Let fetchData handle it
        }
        console.warn("Could not fetch materials (network/unknown).");
        setMaterials([]); 
      }
  };

  // --- Actions ---
  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const loginAdmin = () => setIsAdmin(true);
  const logoutAdmin = () => {
      setIsAdmin(false);
      auth.signOut(); 
  };

  const updateTimetable = async (batch: Batch, dayIndex: number, periodIndex: number, subject: string, startTime: string, endTime: string) => {
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
    
    const updatedTimetable = {
      ...currentTimetable,
      [batch]: newSchedule
    };
    timetableRef.current = updatedTimetable;
    setTimetable(updatedTimetable);

    // Sync with Firebase
    try {
      await setDoc(doc(db, 'timetables', batch), { schedule: newSchedule }, { merge: true });
    } catch (error) {
      console.error("Failed to update timetable in DB", error);
      alert("Failed to save to database. You might not have permission (Try logging out and logging in again).");
    }
  };

  const addMaterial = async (material: StudyMaterial) => {
    // 1. Optimistic UI Update
    setMaterials(prev => [material, ...prev]);

    // 2. Sync with Firebase
    try {
      await addDoc(collection(db, 'materials'), {
        title: material.title,
        subject: material.subject,
        type: material.type,
        size: material.size,
        uploadDate: material.uploadDate,
        url: material.url
      });
    } catch (error) {
      console.error("Failed to add material to DB", error);
      alert("Saved locally, but failed to sync to Database. Check permissions.");
    }
  };

  const refreshMaterials = async () => {
    await fetchMaterials();
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
      isLoadingData,
      refreshMaterials,
      configError
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