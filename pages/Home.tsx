import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { SUBJECTS } from '../constants';
import { Period, SubjectType, Batch } from '../types';
import { Clock, Calendar, Cpu, Zap, FlaskConical, Code, Calculator, BookOpen, FileText, Coffee } from 'lucide-react';
import { formatTo12Hour } from '../utils/helpers';

export const Home: React.FC = () => {
  const { settings, timetable } = useApp();
  
  // State to track periods for BOTH batches
  const [statusB1, setStatusB1] = useState<{ current: Period | null, next: Period | null }>({ current: null, next: null });
  const [statusB2, setStatusB2] = useState<{ current: Period | null, next: Period | null }>({ current: null, next: null });

  const [isHoliday, setIsHoliday] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Ref to track the last notified period ID to prevent repeated notifications
  const lastNotifiedPeriodRef = useRef<string | null>(null);

  // --- Logic for 2nd and 3rd Saturday ---
  const checkIsOffDay = (date: Date) => {
    const day = date.getDay();
    const dateNum = date.getDate();
    
    // 0 is Sunday
    if (day === 0) return true;

    if (day === 6) { // Saturday
      // Calculate which Saturday it is (1st, 2nd, 3rd, 4th, 5th)
      const weekNum = Math.ceil(dateNum / 7);
      // User requested off on 2nd and 3rd Saturday
      if (weekNum === 2 || weekNum === 3) return true;
    }
    return false;
  };

  const getBatchBadge = (dayIndex: number, pIdx: number) => {
    const currentBatch = settings.batch;
    const otherBatch = currentBatch === Batch.BATCH_1 ? Batch.BATCH_2 : Batch.BATCH_1;
    
    // Safety check
    if (!timetable[otherBatch] || !timetable[currentBatch]) return null;
    
    const s1 = timetable[currentBatch][dayIndex]?.periods[pIdx]?.subject;
    const s2 = timetable[otherBatch][dayIndex]?.periods[pIdx]?.subject;
    
    if (s1 && s2 && s1 !== s2) {
        return currentBatch === Batch.BATCH_1 ? 'B1' : 'B2';
    }
    return null;
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      if (checkIsOffDay(now)) {
        setIsHoliday(true);
        setStatusB1({ current: null, next: null });
        setStatusB2({ current: null, next: null });
        lastNotifiedPeriodRef.current = null;
        return;
      } else {
        setIsHoliday(false);
      }

      // Logic to find current period
      // Need to map Day index (0-6) to Array index (0-5, Mon-Sat)
      let dayIndex = now.getDay() - 1; 
      if (dayIndex < 0 || dayIndex > 5) {
        // Sunday
        setStatusB1({ current: null, next: null });
        setStatusB2({ current: null, next: null });
        lastNotifiedPeriodRef.current = null;
        return;
      }

      const timeString = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      // Helper to find periods for a specific batch schedule
      const findPeriods = (batch: Batch) => {
          const schedule = timetable[batch][dayIndex];
          const current = schedule.periods.find(p => timeString >= p.startTime && timeString < p.endTime) || null;
          
          let next = null;
          if (current) {
              const currentIndex = schedule.periods.indexOf(current);
              if (currentIndex < schedule.periods.length - 1) {
                  next = schedule.periods[currentIndex + 1];
              }
          } else {
             // Check if before first period
            const first = schedule.periods[0];
            if (first && timeString < first.startTime) {
                next = first;
            }
          }
          return { current, next };
      };

      const b1 = findPeriods(Batch.BATCH_1);
      const b2 = findPeriods(Batch.BATCH_2);

      setStatusB1(b1);
      setStatusB2(b2);

      // --- Notification Logic (Based on User's Selected Batch) ---
      const userBatchStatus = settings.batch === Batch.BATCH_1 ? b1 : b2;
      const currentPeriod = userBatchStatus.current;

      if (settings.notificationsEnabled && currentPeriod) {
          // If we haven't notified for this specific period ID yet
          if (lastNotifiedPeriodRef.current !== currentPeriod.id) {
             // Only try to send if permission is explicitly granted
             if ("Notification" in window && Notification.permission === 'granted') {
                try {
                  // 1. Visual Notification
                  new Notification(`Class Started: ${currentPeriod.subject}`, {
                     body: `${formatTo12Hour(currentPeriod.startTime)} - ${formatTo12Hour(currentPeriod.endTime)}\nBatch: ${settings.batch}`,
                     icon: '/favicon.ico'
                  });
                  
                  // 2. Audio Notification
                  const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-positive-notification-951.mp3');
                  audio.volume = 0.5;
                  audio.play().catch(e => console.warn("Audio play failed (autoplay blocked):", e));

                } catch (e) {
                  console.warn("Notification failed to send:", e);
                }
             }
             lastNotifiedPeriodRef.current = currentPeriod.id;
          }
      } else if (!currentPeriod) {
          lastNotifiedPeriodRef.current = null;
      }

    }, 1000); 

    const now = new Date();
    if(checkIsOffDay(now)) setIsHoliday(true);
    
    return () => clearInterval(timer);
  }, [timetable, settings.batch, settings.notificationsEnabled]);

  const getSubjectIcon = (id: string) => {
    switch (id) {
      case SubjectType.DCC: return <Cpu className="w-10 h-10 text-white stroke-[1.5]" />;
      case SubjectType.EDC: return <Zap className="w-10 h-10 text-white stroke-[1.5]" />;
      case SubjectType.CHEMISTRY: return <FlaskConical className="w-10 h-10 text-white stroke-[1.5]" />;
      case SubjectType.CSE: return <Code className="w-10 h-10 text-white stroke-[1.5]" />;
      case SubjectType.MATHS: return <Calculator className="w-10 h-10 text-white stroke-[1.5]" />;
      case SubjectType.LIBRARY: return <BookOpen className="w-10 h-10 text-white stroke-[1.5]" />;
      case SubjectType.FICT: return <FileText className="w-10 h-10 text-white stroke-[1.5]" />;
      case SubjectType.FREE: return <Coffee className="w-10 h-10 text-white stroke-[1.5]" />;
      default: return <Cpu className="w-10 h-10 text-white stroke-[1.5]" />;
    }
  };

  // Render helper for status lines
  const renderStatusLine = (label: string, period: Period | null, colorClass: string, bgClass: string) => {
      if (!period) return (
        <div className="flex justify-between items-center opacity-60">
            <span className="font-semibold text-sm">{label}</span>
            <span className="text-sm">Free / Break</span>
        </div>
      );
      
      return (
          <div className="flex justify-between items-center">
              <span className={`font-bold text-sm px-2 py-0.5 rounded ${bgClass} ${colorClass}`}>{label}</span>
              <div className="text-right">
                  <span className={`font-bold ${colorClass}`}>{period.subject}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      {formatTo12Hour(period.startTime)} - {formatTo12Hour(period.endTime)}
                  </span>
              </div>
          </div>
      );
  };

  const isB1B2SameCurrent = statusB1.current?.subject === statusB2.current?.subject && statusB1.current?.subject != null;
  const isB1B2SameNext = statusB1.next?.subject === statusB2.next?.subject && statusB1.next?.subject != null;

  return (
    <div className="flex flex-col space-y-6 sm:space-y-8 animate-fade-in-up pb-10">
      {/* Header Greeting - Order 1 */}
      <div className="order-1 flex flex-col md:flex-row justify-between items-center bg-white dark:bg-dark-card rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="text-center md:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 text-gray-900 dark:text-white">Welcome Back</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">
            Your Batch: <span className="font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded ml-1">{settings.batch}</span>
          </p>
        </div>
        <div className="mt-4 md:mt-0 text-center md:text-right">
          <p className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-gray-800 dark:text-gray-100">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm uppercase tracking-wide font-medium mt-1">
            {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Live Status - Order 2 */}
      <div className="order-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center mb-4">
          <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-primary-500 mr-2 animate-pulse-slow" />
          <h2 className="text-lg sm:text-xl font-bold">Live Status</h2>
        </div>

        {isHoliday ? (
          <div className="p-6 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-xl flex items-center justify-center sm:justify-start">
            <Calendar className="w-6 h-6 mr-3" />
            <span className="font-semibold text-lg">It's a Holiday! Enjoy your day off.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Current Period Card */}
            <div className={`p-4 sm:p-6 rounded-xl border-l-4 transition-all duration-300 hover:shadow-md ${statusB1.current || statusB2.current ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-gray-400 bg-gray-50 dark:bg-gray-800'}`}>
              <div className="flex justify-between items-center mb-3">
                  <p className="text-xs sm:text-sm uppercase tracking-wide opacity-70 font-semibold">Now Happening</p>
                  {(statusB1.current || statusB2.current) && <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>}
              </div>
              
              <div className="space-y-3">
                  {/* Common Schedule */}
                  {isB1B2SameCurrent ? (
                      <div>
                          <div className="flex items-center gap-2">
                              <h3 className="text-2xl sm:text-3xl font-bold text-green-700 dark:text-green-400">{statusB1.current?.subject}</h3>
                              <span className="text-xs font-bold bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-100 px-2 py-0.5 rounded-md">Common</span>
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 font-medium">
                              {formatTo12Hour(statusB1.current?.startTime || '')} - {formatTo12Hour(statusB1.current?.endTime || '')}
                          </p>
                      </div>
                  ) : (
                      // Split Schedule
                      <>
                        {renderStatusLine("Batch 1", statusB1.current, "text-green-700 dark:text-green-400", "bg-green-100 dark:bg-green-900/30")}
                        <hr className="border-gray-200 dark:border-gray-700/50" />
                        {renderStatusLine("Batch 2", statusB2.current, "text-green-700 dark:text-green-400", "bg-green-100 dark:bg-green-900/30")}
                      </>
                  )}
                  
                  {!statusB1.current && !statusB2.current && (
                      <p className="text-lg font-semibold text-gray-500">Free Period / Break</p>
                  )}
              </div>
            </div>

            {/* Next Period Card */}
            <div className="p-4 sm:p-6 rounded-xl border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/10 transition-all duration-300 hover:shadow-md">
              <p className="text-xs sm:text-sm uppercase tracking-wide opacity-70 mb-3 font-semibold">Up Next</p>
              
              <div className="space-y-3">
                   {isB1B2SameNext ? (
                      <div>
                          <div className="flex items-center gap-2">
                              <h3 className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-400">{statusB1.next?.subject}</h3>
                              <span className="text-xs font-bold bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-100 px-2 py-0.5 rounded-md">Common</span>
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 font-medium">
                              {formatTo12Hour(statusB1.next?.startTime || '')} - {formatTo12Hour(statusB1.next?.endTime || '')}
                          </p>
                      </div>
                  ) : (
                      <>
                        {renderStatusLine("Batch 1", statusB1.next, "text-blue-700 dark:text-blue-400", "bg-blue-100 dark:bg-blue-900/30")}
                        <hr className="border-gray-200 dark:border-gray-700/50" />
                        {renderStatusLine("Batch 2", statusB2.next, "text-blue-700 dark:text-blue-400", "bg-blue-100 dark:bg-blue-900/30")}
                      </>
                  )}

                  {!statusB1.next && !statusB2.next && (
                    <p className="text-lg font-semibold text-gray-500 py-1">No more classes today</p>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Visual Timetable "Photo" - Order 3 */}
      <div className="order-3 bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-6 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-2">
          <div className="flex items-center">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-primary-500 mr-2" />
            <h2 className="text-lg sm:text-xl font-bold">Timetable View</h2>
          </div>
          <span className="text-xs sm:text-sm px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full font-medium border border-gray-200 dark:border-gray-700">
            Current View: {settings.batch}
          </span>
        </div>
        
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner bg-gray-50 dark:bg-gray-900/50">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-gray-100 dark:bg-gray-800 uppercase font-bold text-gray-700 dark:text-gray-300">
              <tr>
                <th className="px-3 py-3 sm:px-4 sm:py-4 sticky left-0 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-sm">Day</th>
                {[1,2,3,4,5,6].map(i => <th key={i} className="px-3 py-3 sm:px-4 sm:py-4 text-center">Pd {i}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {timetable[settings.batch].map((daySchedule, idx) => (
                <tr key={idx} className="hover:bg-white dark:hover:bg-gray-800 transition-colors">
                  <td className="px-3 py-3 sm:px-4 sm:py-4 font-bold sticky left-0 bg-gray-50 dark:bg-dark-card border-r border-gray-200 dark:border-gray-700">
                    {daySchedule.day.substring(0, 3)}
                  </td>
                  {daySchedule.periods.map((p, pIdx) => {
                    const badge = getBatchBadge(idx, pIdx);
                    // Determine if we need to show other batch subject too
                    const currentBatch = settings.batch;
                    const otherBatch = currentBatch === Batch.BATCH_1 ? Batch.BATCH_2 : Batch.BATCH_1;
                    const otherSubject = timetable[otherBatch][idx]?.periods[pIdx]?.subject;
                    const isDifferent = otherSubject && otherSubject !== p.subject;

                    return (
                        <td key={pIdx} className="px-3 py-3 sm:px-4 sm:py-4 min-w-[100px] text-center">
                        <div className="flex flex-col items-center">
                            <div className="flex flex-col items-center gap-0.5 mb-1">
                                <div className="flex items-center gap-1">
                                    <span className="font-bold text-primary-700 dark:text-primary-400">{p.subject}</span>
                                    {badge && (
                                        <span className="text-[10px] font-bold bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 px-1 rounded">
                                            {badge}
                                        </span>
                                    )}
                                </div>
                                {isDifferent && (
                                     <div className="flex items-center gap-1 opacity-60 scale-90">
                                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{otherSubject}</span>
                                        <span className="text-[9px] font-bold bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1 rounded">
                                            {currentBatch === Batch.BATCH_1 ? 'B2' : 'B1'}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                            {formatTo12Hour(p.startTime)}-{formatTo12Hour(p.endTime)}
                            </span>
                        </div>
                        </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subject Grid - Order 4 */}
      <div className="order-4">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 px-1">Study Subjects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {SUBJECTS.map((sub, index) => (
            <Link 
              key={sub.id} 
              to={`/subject/${sub.id}`}
              className={`group relative overflow-hidden rounded-2xl p-6 h-48 shadow-lg transition-transform hover:scale-[1.02] duration-300 flex flex-col justify-between ${sub.color}`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Decorative Circles Overlay */}
              <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white opacity-10 rounded-full blur-none group-hover:scale-110 transition-transform duration-500"></div>
              <div className="absolute bottom-8 -right-12 w-32 h-32 bg-white opacity-5 rounded-full blur-xl group-hover:scale-110 transition-transform duration-500"></div>

              {/* Icon */}
              <div className="relative z-10">
                {getSubjectIcon(sub.id)}
              </div>

              {/* Text Content */}
              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-white tracking-wide mb-1">{sub.name}</h3>
                <p className="text-white/80 text-sm font-medium">View materials</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};