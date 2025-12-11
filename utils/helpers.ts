import { Timetable, Batch } from '../types';

/**
 * Converts a 24-hour time string (e.g., "14:30") to 12-hour format (e.g., "02:30 PM").
 */
export const formatTo12Hour = (time24: string): string => {
  if (!time24) return '';
  
  const [hoursStr, minutesStr] = time24.split(':');
  if (!hoursStr || !minutesStr) return time24; // Return original if invalid format

  const hours = parseInt(hoursStr, 10);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12; // Convert 0 to 12
  
  return `${h}:${minutesStr} ${suffix}`;
};

export const checkIsOffDay = (date: Date): boolean => {
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

export const getCurrentPeriod = (timetable: Timetable, batch: Batch, date: Date) => {
    // 0 = Sunday, 1 = Monday ... 6 = Saturday
    // Timetable array: 0 = Monday ... 5 = Saturday
    const dayIndex = date.getDay() - 1;

    // Check bounds and holidays
    if (dayIndex < 0 || dayIndex > 5 || checkIsOffDay(date)) {
        return { current: null, next: null, periodNum: -1 };
    }

    const timeString = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const schedule = timetable[batch][dayIndex];
    
    if (!schedule) return { current: null, next: null, periodNum: -1 };

    const current = schedule.periods.find(p => timeString >= p.startTime && timeString < p.endTime) || null;
    let next = null;
    let periodNum = -1;

    if (current) {
        periodNum = schedule.periods.indexOf(current) + 1;
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
    return { current, next, periodNum };
};