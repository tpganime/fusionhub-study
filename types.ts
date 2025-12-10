export enum SubjectType {
  DCC = 'DCC',
  EDC = 'EDC',
  CHEMISTRY = 'Chemistry',
  CSE = 'CSE',
  MATHS = 'Maths',
  FICT = 'FICT',
  LIBRARY = 'Library'
}

export enum Batch {
  BATCH_1 = 'Batch 1',
  BATCH_2 = 'Batch 2'
}

export interface Period {
  id: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  subject: string;
}

export interface DaySchedule {
  day: string; // Monday, Tuesday, etc.
  periods: Period[]; // 6 periods
}

export interface Timetable {
  [Batch.BATCH_1]: DaySchedule[];
  [Batch.BATCH_2]: DaySchedule[];
}

export interface StudyMaterial {
  id: string;
  title: string;
  subject: SubjectType;
  type: 'video' | 'photo';
  size: string;
  uploadDate: string;
  url: string; // Mock URL
}

export interface UserSettings {
  batch: Batch;
  theme: 'light' | 'dark';
  notificationsEnabled: boolean;
}