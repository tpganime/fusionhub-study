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
