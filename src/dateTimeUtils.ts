// Date and time utility functions

export function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function formatTimeForDisplay(timeStr: string): string {
  if (!timeStr) return '';
  return timeStr;
}

export function getCurrentDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function getYearsArray(startYear: number, endYear: number): number[] {
  const years = [];
  for (let i = startYear; i <= endYear; i++) {
    years.push(i);
  }
  return years;
}

export function getMonthsArray(): string[] {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
}

export function getDaysArray(year: number, month: number): number[] {
  const date = new Date(year, month, 0);
  const days = date.getDate();
  const daysArray = [];
  for (let i = 1; i <= days; i++) {
    daysArray.push(i);
  }
  return daysArray;
}

export function getHoursArray(): number[] {
  const hours = [];
  for (let i = 0; i < 24; i++) {
    hours.push(i);
  }
  return hours;
}

export function getMinutesArray(): number[] {
  const minutes = [];
  for (let i = 0; i < 60; i += 5) {
    minutes.push(i);
  }
  return minutes;
}

export function parseDateString(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10),
    day: parseInt(parts[2], 10),
  };
}

export function parseTimeString(timeStr: string): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;
  return {
    hours: parseInt(parts[0], 10),
    minutes: parseInt(parts[1], 10),
  };
}

export function formatDateFromParts(year: number, month: number, day: number): string {
  const monthStr = String(month).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  return `${year}-${monthStr}-${dayStr}`;
}

export function formatTimeFromParts(hours: number, minutes: number): string {
  const hoursStr = String(hours).padStart(2, '0');
  const minutesStr = String(minutes).padStart(2, '0');
  return `${hoursStr}:${minutesStr}`;
}

export function formatIsoDate(iso?: string): string {
  if (!iso) return '';
  return iso.split('T')[0] || '';
}

export function toIsoDate(dateStr: string): string | undefined {
  if (!dateStr.trim()) return undefined;
  return dateStr.trim() + 'T00:00:00';
}

export function toIsoDateTime(year: number, month: number, day: number, hours: number, minutes: number): string {
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  return `${dateStr}T${timeStr}`;
}

export function isDateInPast(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export function getDaysBetween(startDate: Date, endDate: Date): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}
