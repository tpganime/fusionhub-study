import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ADMIN_CREDENTIALS, SUBJECTS } from '../constants';
import { Batch, SubjectType } from '../types';
import { storage, auth } from '../services/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, uploadBytesResumable, getDownloadURL, listAll } from 'firebase/storage';
import { Upload, FileText, CheckCircle, Lock, Loader2, Calendar, Clock, Save, Link as LinkIcon, DownloadCloud, Plus } from 'lucide-react';
import { formatTo12Hour } from '../utils/helpers';

export const Admin: React.FC = () => {
  const { isAdmin, loginAdmin, addMaterial, timetable, updateTimetable, materials, refreshMaterials } = useApp();
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Upload State
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadSubject, setUploadSubject] = useState<SubjectType>(SubjectType.DCC);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  // Import/Sync State
  const [pendingImports, setPendingImports] = useState<any[]>([]);
  const [isLoadingImports, setIsLoadingImports] = useState(false);
  const [importInputs, setImportInputs] = useState<{[key: string]: {title: string, subject: SubjectType}}>({});

  // Timetable Edit State (Form based)
  const [formBatch, setFormBatch] = useState<Batch>(Batch.BATCH_1);
  const [formDay, setFormDay] = useState<string>('Monday');
  const [formPeriodIndex, setFormPeriodIndex] = useState<number>(0); 
  const [formSubject, setFormSubject] = useState<string>('');
  const [formStartTime, setFormStartTime] = useState<string>('09:00');
  const [formEndTime, setFormEndTime] = useState<string>('10:00');
  const [isBothBatches, setIsBothBatches] = useState<boolean>(false);
  const [isSavingTimetable, setIsSavingTimetable] = useState(false);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const allSubjectOptions = Object.values(SubjectType);

  const getBatchBadge = (dayIndex: number, pIdx: number) => {
    const currentBatch = formBatch;
    const otherBatch = currentBatch === Batch.BATCH_1 ? Batch.BATCH_2 : Batch.BATCH_1;
    if (!timetable[otherBatch] || !timetable[currentBatch]) return null;
    const s1 = timetable[currentBatch][dayIndex]?.periods[pIdx]?.subject;
    const s2 = timetable[otherBatch][dayIndex]?.periods[pIdx]?.subject;
    if (s1 && s2 && s1 !== s2) {
        return currentBatch === Batch.BATCH_1 ? 'B1' : 'B2';
    }
    return null;
  };

  useEffect(() => {
    const dayIndex = days.indexOf(formDay);
    if (dayIndex === -1) return;
    const schedule = timetable[formBatch];
    if (schedule && schedule[dayIndex]) {
        const period = schedule[dayIndex].periods[formPeriodIndex];
        if (period) {
            setFormSubject(period.subject);
            setFormStartTime(period.startTime);
            setFormEndTime(period.endTime);
        }
    }
  }, [formBatch, formDay, formPeriodIndex, timetable]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);

    // 1. Check against hardcoded credentials for safety
    if (email === ADMIN_CREDENTIALS.id && password === ADMIN_CREDENTIALS.password) {
      try {
        // 2. Try to Sign In to Firebase to get Write Permission
        await signInWithEmailAndPassword(auth, email, password);
        loginAdmin();
      } catch (authErr: any) {
        // 3. If User doesn't exist in Firebase yet, Create it (One-time setup for Admin)
        if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
            try {
                await createUserWithEmailAndPassword(auth, email, password);
                loginAdmin();
            } catch (createErr: any) {
                console.error("Failed to create admin in Firebase:", createErr);
                // 4. Fallback: Log in locally only (Write ops might fail if rules strict)
                loginAdmin();
                alert("Logged in locally. Note: Firebase DB writes might fail if Auth is disabled.");
            }
        } else {
             console.error("Firebase Login Error:", authErr);
             loginAdmin(); // Fallback
        }
      }
    } else {
      setError('Invalid credentials');
    }
    setIsLoggingIn(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle) return;

    setIsUploading(true);
    setUploadStatus('Initializing...');
    setUploadProgress(0);

    try {
        const safeName = uploadFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${Date.now()}-${safeName}`;
        const filePath = `study-materials/${uploadSubject}/${fileName}`;

        // Firebase Storage Upload
        const storageRef = ref(storage, filePath);
        const uploadTask = uploadBytesResumable(storageRef, uploadFile);

        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
            setUploadStatus(`Uploading: ${progress.toFixed(1)}%`);
          }, 
          (error) => {
            console.error('Upload failed:', error);
            alert(`Upload failed: ${error.message}`);
            setIsUploading(false);
            setUploadStatus('Failed');
          }, 
          async () => {
             // Upload complete
             setUploadStatus('Processing...');
             const publicUrl = await getDownloadURL(uploadTask.snapshot.ref);

             const sizeMB = (uploadFile.size / (1024 * 1024)).toFixed(2);
             const sizeStr = parseFloat(sizeMB) > 1024 
                ? `${(parseFloat(sizeMB)/1024).toFixed(2)} GB` 
                : `${sizeMB} MB`;

             let type: 'video' | 'photo' | 'note' = 'photo';
             if (uploadFile.type.startsWith('video')) type = 'video';
             else if (uploadFile.type === 'application/pdf') type = 'note';

             await addMaterial({
                id: Date.now().toString(),
                title: uploadTitle,
                subject: uploadSubject,
                type: type,
                size: sizeStr,
                uploadDate: new Date().toISOString(),
                url: publicUrl
             });

             alert('Upload Successful!');
             setUploadFile(null);
             setUploadTitle('');
             setUploadStatus('');
             setIsUploading(false);
             setUploadProgress(0);
          }
        );

    } catch (err: any) {
        console.error('Upload init failed:', err);
        alert(`Error: ${err.message}`);
        setIsUploading(false);
    }
  };

  const fetchUnlinkedFiles = async () => {
    setIsLoadingImports(true);
    try {
        const buckets = ['DCC', 'EDC', 'Chemistry', 'CSE', 'Maths']; 
        let allFiles: any[] = [];
        
        for (const folder of buckets) {
            const folderRef = ref(storage, `study-materials/${folder}`);
            try {
                const res = await listAll(folderRef);
                for (const itemRef of res.items) {
                    allFiles.push({
                        name: itemRef.name,
                        fullPath: itemRef.fullPath,
                        folder: folder,
                        ref: itemRef
                    });
                }
            } catch (err) {
               console.log(`Skipping folder ${folder}, likely empty.`);
            }
        }
        setPendingImports(allFiles);
        const initialInputs: any = {};
        allFiles.forEach((f, idx) => {
            initialInputs[idx] = {
                title: f.name,
                subject: f.folder as SubjectType
            };
        });
        setImportInputs(initialInputs);

    } catch (err) {
        console.error("Error fetching imports:", err);
        alert("Failed to fetch storage files. Ensure you are logged in.");
    } finally {
        setIsLoadingImports(false);
    }
  };

  const handleImport = async (fileObj: any, idx: number) => {
    const input = importInputs[idx];
    if (!input) return;

    try {
        const url = await getDownloadURL(fileObj.ref);
        const ext = fileObj.name.split('.').pop()?.toLowerCase();
        let type: 'video' | 'photo' | 'note' = 'photo';
        if (['mp4', 'mov', 'webm', 'mkv'].includes(ext)) type = 'video';
        else if (['pdf', 'doc', 'docx'].includes(ext)) type = 'note';
        
        await addMaterial({
            id: Date.now().toString(),
            title: input.title,
            subject: input.subject,
            type: type,
            size: "Unknown Size",
            uploadDate: new Date().toISOString(),
            url: url
        });

        setPendingImports(prev => prev.filter((_, i) => i !== idx));
        alert("Imported successfully!");
        refreshMaterials();

    } catch (err) {
        console.error("Import failed:", err);
        alert("Failed to import file.");
    }
  };

  const handleSavePeriod = async () => {
    setIsSavingTimetable(true);
    const dayIndex = days.indexOf(formDay);
    
    try {
        await updateTimetable(formBatch, dayIndex, formPeriodIndex, formSubject, formStartTime, formEndTime);
        if (isBothBatches) {
            const otherBatch = formBatch === Batch.BATCH_1 ? Batch.BATCH_2 : Batch.BATCH_1;
            await updateTimetable(otherBatch, dayIndex, formPeriodIndex, formSubject, formStartTime, formEndTime);
        }
        alert('Period updated successfully!');
    } catch (e) {
        console.error(e);
        alert('Failed to update period');
    } finally {
        setIsSavingTimetable(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] animate-fade-in-up">
        <div className="bg-white dark:bg-dark-card p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 to-purple-600"></div>
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-primary-100 dark:bg-primary-900/30 rounded-full text-primary-600 animate-pulse">
                <Lock className="w-8 h-8" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center mb-6">Admin Login</h2>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">Email ID</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 py-2 rounded animate-shake">{error}</p>}
            <button 
                type="submit" 
                disabled={isLoggingIn}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-bold transition-all shadow-lg shadow-primary-500/30 transform active:scale-95 flex justify-center items-center"
            >
              {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <span className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium flex items-center shadow-sm">
            <CheckCircle className="w-4 h-4 mr-2" /> Authenticated
        </span>
      </div>

      {/* Timetable Settings */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-primary-500" />
                Period Settings
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Configure timetable for each batch (6 periods, Monday-Saturday)
            </p>
        </div>
        
        <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Row 1: Batch & Day */}
                <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Batch</label>
                    <div className="relative">
                        <select 
                            value={formBatch}
                            onChange={(e) => setFormBatch(e.target.value as Batch)}
                            className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none appearance-none"
                        >
                            <option value={Batch.BATCH_1}>Batch 1</option>
                            <option value={Batch.BATCH_2}>Batch 2</option>
                        </select>
                         <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                        </div>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Day</label>
                    <div className="relative">
                        <select 
                            value={formDay}
                            onChange={(e) => setFormDay(e.target.value)}
                            className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none appearance-none"
                        >
                            {days.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                        </div>
                    </div>
                </div>

                {/* Row 2: Period & Subject */}
                <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Period Number</label>
                    <div className="relative">
                         <select 
                            value={formPeriodIndex}
                            onChange={(e) => setFormPeriodIndex(Number(e.target.value))}
                            className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none appearance-none"
                        >
                            {[0,1,2,3,4,5].map(i => <option key={i} value={i}>Period {i + 1}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                        </div>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Subject</label>
                    <div className="relative">
                        <select 
                            value={formSubject}
                            onChange={(e) => setFormSubject(e.target.value)}
                            className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none appearance-none"
                        >
                            <option value="">Select subject</option>
                            {allSubjectOptions.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                        </div>
                    </div>
                </div>

                {/* Row 3: Times */}
                <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Start Time</label>
                    <div className="relative">
                        <input 
                            type="time" 
                            value={formStartTime}
                            onChange={(e) => setFormStartTime(e.target.value)}
                            className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                         <Clock className="absolute right-4 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">End Time</label>
                    <div className="relative">
                         <input 
                            type="time" 
                            value={formEndTime}
                            onChange={(e) => setFormEndTime(e.target.value)}
                            className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                        <Clock className="absolute right-4 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-200">Both Batches Same</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">This period is the same for both batches</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsBothBatches(!isBothBatches)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${isBothBatches ? 'bg-primary-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isBothBatches ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            {/* Save Button */}
            <button 
                onClick={handleSavePeriod}
                disabled={isSavingTimetable}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-primary-500/20 active:scale-[0.99] flex justify-center items-center"
            >
                {isSavingTimetable ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                Save Period
            </button>
        </div>
      </div>

      {/* Import / Sync Section (New) */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm transition-all hover:shadow-md">
        <h2 className="text-xl font-bold mb-4 flex items-center">
            <DownloadCloud className="w-5 h-5 mr-2 text-primary-500" />
            Import from Firebase Storage
        </h2>
        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl text-sm text-blue-700 dark:text-blue-300 mb-6 border border-blue-100 dark:border-blue-900/30">
            <p className="font-semibold mb-1">Use this for huge files (up to 20GB):</p>
            <ol className="list-decimal ml-4 space-y-1">
                <li>Go to Firebase Console &gt; Storage.</li>
                <li>Upload file to <code>study-materials/&lt;Subject&gt;</code> folder.</li>
                <li>Click <strong>Scan Bucket</strong> below to link them.</li>
            </ol>
        </div>

        <button 
            onClick={fetchUnlinkedFiles}
            disabled={isLoadingImports}
            className="mb-6 px-6 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-bold flex items-center transition-all"
        >
            {isLoadingImports ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LinkIcon className="w-4 h-4 mr-2" />}
            Scan Storage for New Files
        </button>

        {pendingImports.length > 0 && (
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {pendingImports.map((file, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl flex flex-col sm:flex-row gap-4 items-start sm:items-end bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex-grow space-y-3 w-full">
                            <div>
                                <p className="text-xs text-gray-500 font-mono mb-1 truncate">{file.fullPath}</p>
                                <input 
                                    type="text"
                                    value={importInputs[idx]?.title || ''}
                                    onChange={(e) => setImportInputs(prev => ({
                                        ...prev,
                                        [idx]: { ...prev[idx], title: e.target.value }
                                    }))}
                                    className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                    placeholder="Enter Title"
                                />
                            </div>
                            <select
                                value={importInputs[idx]?.subject || ''}
                                onChange={(e) => setImportInputs(prev => ({
                                    ...prev,
                                    [idx]: { ...prev[idx], subject: e.target.value as SubjectType }
                                }))}
                                className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                            >
                                {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <button
                            onClick={() => handleImport(file, idx)}
                            className="w-full sm:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm flex items-center justify-center whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4 mr-1" /> Add to Library
                        </button>
                    </div>
                ))}
            </div>
        )}
        {pendingImports.length === 0 && !isLoadingImports && (
            <p className="text-center text-gray-400 italic text-sm">No new files found in storage.</p>
        )}
      </div>

      {/* Upload Section (Standard) */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm transition-all hover:shadow-md">
        <h2 className="text-xl font-bold mb-6 flex items-center pb-4 border-b border-gray-100 dark:border-gray-700">
            <Upload className="w-5 h-5 mr-2 text-primary-500" />
            Standard Upload (Supports Large Files)
        </h2>
        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Title / Topic Name</label>
                <input 
                    type="text" 
                    value={uploadTitle}
                    onChange={e => setUploadTitle(e.target.value)}
                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="e.g. Thermodynamics Lecture 1"
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-2">Subject Category</label>
                <select 
                    value={uploadSubject}
                    onChange={e => setUploadSubject(e.target.value as SubjectType)}
                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 outline-none"
                >
                    {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>
            <div>
                 <label className="block text-sm font-medium mb-2">File Upload</label>
                 <div className="relative group">
                    <input 
                        type="file" 
                        onChange={handleFileChange}
                        className="hidden" 
                        id="file-upload"
                        accept="image/*,video/*,application/pdf"
                    />
                    <label 
                        htmlFor="file-upload" 
                        className="flex items-center justify-center w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-primary-500 transition-all"
                    >
                        {uploadFile ? (
                            <div className="flex items-center text-primary-600">
                                <CheckCircle className="w-5 h-5 mr-2" />
                                <span className="font-semibold truncate max-w-[200px]">{uploadFile.name}</span>
                            </div>
                        ) : (
                            <span className="text-gray-500 group-hover:text-primary-500 transition-colors">Choose Video, Photo or PDF</span>
                        )}
                    </label>
                 </div>
            </div>
            <div className="md:col-span-2 mt-2">
                {isUploading ? (
                    <div className="w-full p-4 bg-primary-50 dark:bg-primary-900/10 rounded-xl flex flex-col items-center justify-center text-primary-600 border border-primary-100 dark:border-primary-900/20">
                        <div className="flex items-center mb-2">
                             <Loader2 className="w-6 h-6 animate-spin mr-2" />
                             <span className="font-bold text-lg">{uploadStatus}</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                            <div className="bg-primary-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                        <span className="text-xs text-primary-400 mt-2 font-semibold">Please keep this tab open until 100%.</span>
                    </div>
                ) : (
                    <button type="submit" className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white py-4 rounded-xl font-bold shadow-lg shadow-primary-500/20 transition-all transform active:scale-[0.98]">
                        Upload Material
                    </button>
                )}
            </div>
        </form>
      </div>

      {/* Timetable Table View (Read-only/Reference) */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-6 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-primary-500" />
            Timetable Overview
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
             <table className="w-full text-sm text-left border-collapse">
                <thead>
                    <tr>
                        <th className="p-4 border-b border-r dark:border-gray-700 bg-gray-100 dark:bg-gray-800 min-w-[100px]">Day / Period</th>
                        {[1,2,3,4,5,6].map(i => <th key={i} className="p-4 border-b dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-center min-w-[140px]">Period {i}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {timetable[formBatch].map((daySchedule, dIdx) => (
                        <tr key={dIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="p-4 border-r dark:border-gray-700 font-bold bg-gray-50 dark:bg-gray-800/30">{daySchedule.day}</td>
                            {daySchedule.periods.map((period, pIdx) => {
                                const badge = getBatchBadge(dIdx, pIdx);
                                return (
                                <td key={pIdx} className="p-2 border-r border-b dark:border-gray-700 relative text-center">
                                    <div className="flex flex-col items-center">
                                        <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                                            {period.subject}
                                            {badge && (
                                                <span className="text-[10px] font-bold bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 px-1 rounded">
                                                    {badge}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                                            {formatTo12Hour(period.startTime)} - {formatTo12Hour(period.endTime)}
                                        </div>
                                    </div>
                                </td>
                            );})}
                        </tr>
                    ))}
                </tbody>
             </table>
        </div>
      </div>
    </div>
  );
};