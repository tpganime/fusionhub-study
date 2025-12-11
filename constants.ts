import { Batch, SubjectType, Timetable, DaySchedule } from './types';

export const ADMIN_CREDENTIALS = {
  id: 'fusionhub122@gmail.com',
  password: 'Tanmayts@123'
};

export const SUBJECTS = [
  { id: SubjectType.DCC, name: 'DCC', color: 'bg-gradient-to-br from-cyan-500 to-blue-600' },
  { id: SubjectType.EDC, name: 'EDC', color: 'bg-gradient-to-br from-purple-500 to-indigo-600' },
  { id: SubjectType.CHEMISTRY, name: 'Chemistry', color: 'bg-gradient-to-br from-emerald-500 to-green-600' },
  { id: SubjectType.CSE, name: 'CSE', color: 'bg-gradient-to-br from-orange-500 to-red-600' },
  { id: SubjectType.MATHS, name: 'Maths', color: 'bg-gradient-to-br from-pink-500 to-rose-600' }
];

const DEFAULT_PERIODS = [
  { id: '1', startTime: '08:00', endTime: '09:00', subject: 'DCC' },
  { id: '2', startTime: '09:00', endTime: '10:00', subject: 'EDC' },
  { id: '3', startTime: '10:00', endTime: '11:00', subject: 'Chemistry' },
  { id: '4', startTime: '11:00', endTime: '12:00', subject: 'CSE' },
  { id: '5', startTime: '12:00', endTime: '13:00', subject: 'Maths' },
  { id: '6', startTime: '13:00', endTime: '14:00', subject: 'Library' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const createDefaultSchedule = (): DaySchedule[] => {
  return DAYS.map(day => ({
    day,
    periods: DEFAULT_PERIODS.map(p => ({ ...p }))
  }));
};

export const DEFAULT_TIMETABLE: Timetable = {
  [Batch.BATCH_1]: createDefaultSchedule(),
  [Batch.BATCH_2]: createDefaultSchedule(),
};