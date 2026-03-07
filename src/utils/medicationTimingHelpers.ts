import { Medication } from '../storage';

/**
 * Determines the administration status of a medication at a given scheduled time
 * Returns: 'given' | 'missed' | 'pending' | 'overdue' | 'due' | 'upcoming'
 */
export function getAdministrationStatus(
  medId: string,
  timeIso: string,
  med: Medication
): 'given' | 'missed' | 'pending' | 'overdue' | 'due' | 'upcoming' {
  const record = (med.administrationRecords || []).find(r => r.time === timeIso);
  if (record) return record.status === 'given' ? 'given' : 'missed';

  const now = new Date();
  const t = new Date(timeIso);
  const medHour = t.getHours();
  const nowHour = now.getHours();
  const nowMinutes = now.getMinutes();

  // For interval-based medications (every-second-day, weekly, fortnightly), show as "due" all day
  if (med.frequencyType && med.frequencyType !== 'daily') {
    const medDate = t.toDateString();
    const nowDate = now.toDateString();
    const isSameDay = medDate === nowDate;
    
    if (isSameDay) {
      // Show as "due" throughout the entire day
      return 'due';
    } else if (t < now) {
      // Past date - overdue
      return 'overdue';
    } else {
      // Future date - upcoming
      return 'upcoming';
    }
  }

  // Determine time window based on scheduled medication time
  let windowStart: number; // hour
  let windowEnd: number; // hour
  let isCustomTime = false;

  if (medHour === 7 && t.getMinutes() === 30) {
    // Before Breakfast (07:30)
    windowStart = 5;
    windowEnd = 10;
  } else if (medHour === 8 && t.getMinutes() === 0) {
    // Breakfast (08:00)
    windowStart = 7;
    windowEnd = 10;
  } else if (medHour === 12 && t.getMinutes() === 0) {
    // Lunch (12:00)
    windowStart = 10;
    windowEnd = 15; // 3pm
  } else if (medHour === 18 && t.getMinutes() === 0) {
    // Dinner (18:00)
    windowStart = 16; // 4pm
    windowEnd = 22; // 10pm
  } else if (medHour === 22 && t.getMinutes() === 0) {
    // Before Bed (22:00)
    windowStart = 18; // 6pm
    windowEnd = 24; // 11:59pm (treated as 24)
  } else {
    // Custom time: use 15-minute window (±15 minutes)
    isCustomTime = true;
    const medMinutes = t.getMinutes();
    const scheduledTimeInMinutes = medHour * 60 + medMinutes;
    const currentTimeInMinutes = nowHour * 60 + nowMinutes;
    
    // Check if we're on the same day
    const medDate = t.toDateString();
    const nowDate = now.toDateString();
    const isSameDay = medDate === nowDate;
    
    if (!isSameDay) {
      if (t < now) return 'overdue';
      return 'upcoming';
    }
    
    const diffMinutes = currentTimeInMinutes - scheduledTimeInMinutes;
    
    if (diffMinutes >= -15 && diffMinutes <= 15) {
      // Within ±15 minutes: due
      return 'due';
    } else if (diffMinutes > 15) {
      // More than 15 minutes past: overdue
      return 'overdue';
    } else {
      // Before the window: upcoming
      return 'upcoming';
    }
  }

  // For standard meal times, continue with hour-based windows
  if (isCustomTime) {
    // Already handled above
    return 'upcoming';
  }

  // Check if we're on the same day
  const medDate = t.toDateString();
  const nowDate = now.toDateString();
  const isSameDay = medDate === nowDate;

  // If on different day, use previous/upcoming logic
  if (!isSameDay) {
    if (t < now) return 'overdue';
    return 'upcoming';
  }

  // Same day - check time window
  const currentTimeInHours = nowHour + nowMinutes / 60;

  if (currentTimeInHours >= windowStart && currentTimeInHours < windowEnd) {
    // Currently within the window
    return 'due';
  } else if (currentTimeInHours >= windowEnd) {
    // Past the window and no record
    return 'overdue';
  } else {
    // Before the window
    return 'upcoming';
  }
}

/**
 * Formats a time ISO string to display the meal slot name
 */
export function getSlotNameFromTime(timeIso: string): string {
  const d = new Date(timeIso);
  const h = d.getHours();
  const m = d.getMinutes();
  
  // For interval medications (time is 00:00), show "Any time today"
  if (h === 0 && m === 0) return 'Any time today';
  
  if (h === 7 && m === 30) return `Before Breakfast (${getTimeRangeLabel(timeIso)})`;
  if (h === 8 && m === 0) return `Breakfast (${getTimeRangeLabel(timeIso)})`;
  if (h === 12 && m === 0) return `Lunch (${getTimeRangeLabel(timeIso)})`;
  if (h === 18 && m === 0) return `Dinner (${getTimeRangeLabel(timeIso)})`;
  if (h === 22 && m === 0) return `Before Bed (${getTimeRangeLabel(timeIso)})`;
  return `Scheduled (${getTimeRangeLabel(timeIso)})`;
}

function formatTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(1439, minutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatRange(startMinutes: number, endMinutes: number): string {
  const start = formatTime(startMinutes);
  const end = formatTime(endMinutes);
  return `${start}-${end}`;
}

/**
 * Returns a display range for when a medication can be given.
 */
export function getTimeRangeLabel(timeIso: string): string {
  const d = new Date(timeIso);
  const h = d.getHours();
  const m = d.getMinutes();

  if (h === 0 && m === 0) return 'Any time today';

  if (h === 7 && m === 30) return '05:00-10:00';
  if (h === 8 && m === 0) return '07:00-10:00';
  if (h === 12 && m === 0) return '10:00-15:00';
  if (h === 18 && m === 0) return '16:00-22:00';
  if (h === 22 && m === 0) return '18:00-23:59';

  const scheduledMinutes = h * 60 + m;
  return formatRange(scheduledMinutes - 15, scheduledMinutes + 15);
}

/**
 * Gets the time window (start/end hours) for a given medication time
 */
export function getTimeWindow(timeIso: string): { start: number; end: number } {
  const d = new Date(timeIso);
  const h = d.getHours();
  const m = d.getMinutes();

  if (h === 7 && m === 30) return { start: 5, end: 10 };
  if (h === 8 && m === 0) return { start: 7, end: 10 };
  if (h === 12 && m === 0) return { start: 10, end: 15 };
  if (h === 18 && m === 0) return { start: 16, end: 22 };
  if (h === 22 && m === 0) return { start: 18, end: 24 };

  return { start: h - 1, end: h + 1 };
}

/**
 * Gets color for a status for UI display
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'given':
      return '#10b981'; // green
    case 'overdue':
      return '#ef4444'; // red
    case 'due':
      return '#f97316'; // orange
    case 'upcoming':
      return '#3b82f6'; // blue
    case 'missed':
      return '#6b7280'; // gray
    default:
      return '#d1d5db'; // light gray
  }
}
