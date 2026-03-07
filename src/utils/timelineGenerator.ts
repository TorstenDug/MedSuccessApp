import { Medication } from '../storage';
import { getAdministrationStatus } from './medicationTimingHelpers';

export type TimelineDisplayItem = {
  medId: string;
  medName: string;
  time: string;
  totalDose?: string;
  med: Medication;
  status: 'given' | 'missed' | 'pending' | 'overdue' | 'due' | 'upcoming';
};

/**
 * Generates timeline items exactly as displayed in the timeline list.
 * Use this for any status badges/counts to keep UI fully consistent.
 */
export function generateTimelineDisplayItems(meds: Medication[]): TimelineDisplayItem[] {
  const now = Date.now();
  const ninetyDaysAhead = now + 90 * 24 * 60 * 60 * 1000;

  const startOfDay = (time: number) => {
    const d = new Date(time);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const endOfDay = (time: number) => {
    const d = new Date(time);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  const earliestScheduledBaseTime = (med: Medication): number | undefined => {
    const times = med.scheduledTimes || [];
    if (times.length === 0) return undefined;
    const parsed = times
      .map(t => new Date(t).getTime())
      .filter(t => Number.isFinite(t));
    if (parsed.length === 0) return undefined;
    return Math.min(...parsed);
  };

  return meds
    .flatMap(m => {
      const medStartCandidates = [
        m.startTime ? new Date(m.startTime).getTime() : undefined,
        earliestScheduledBaseTime(m)
      ].filter((t): t is number => t !== undefined && Number.isFinite(t));

      const medStartTime = medStartCandidates.length > 0 ? Math.min(...medStartCandidates) : now;
      const generationStart = startOfDay(medStartTime);
      const generationEnd = endOfDay(
        Math.min(
          m.endTime ? new Date(m.endTime).getTime() : Number.MAX_SAFE_INTEGER,
          ninetyDaysAhead
        )
      );

      if (generationStart.getTime() > generationEnd.getTime()) {
        return [];
      }

      // Handle interval-based medications (every-second-day, weekly, fortnightly)
      if (m.frequencyType && m.frequencyType !== 'daily' && m.startTime) {
        const startDate = new Date(m.startTime);
        startDate.setHours(0, 0, 0, 0);
        const generatedTimes: string[] = [];
        const intervalDays = m.frequencyType === 'every-second-day' ? 2 : m.frequencyType === 'weekly' ? 7 : 14;

        if (startDate.getTime() > generationEnd.getTime()) {
          return [];
        }

        const firstInstance = new Date(startDate);
        while (firstInstance.getTime() < generationStart.getTime()) {
          firstInstance.setDate(firstInstance.getDate() + intervalDays);
        }

        const cursor = new Date(firstInstance);
        while (cursor.getTime() <= generationEnd.getTime()) {
          const instanceDate = new Date(cursor);
          // Set to 00:00 for all-day "due" status
          instanceDate.setHours(0, 0, 0, 0);
          generatedTimes.push(instanceDate.toISOString());
          cursor.setDate(cursor.getDate() + intervalDays);
        }

        return generatedTimes.map(t => {
          const status = getAdministrationStatus(m.id, t, m);
          return { medId: m.id, medName: m.name, time: t, totalDose: m.totalDose, med: m, status };
        });
      }

      const timeSlots = (m.scheduledTimes || []).map(t => {
        const baseDate = new Date(t);
        return { hour: baseDate.getHours(), minute: baseDate.getMinutes() };
      });

      const generatedDailyTimes: string[] = [];
      if (timeSlots.length > 0) {
        const cursor = new Date(generationStart);
        while (cursor.getTime() <= generationEnd.getTime()) {
          timeSlots.forEach(({ hour, minute }) => {
            const instanceDate = new Date(cursor);
            instanceDate.setHours(hour, minute, 0, 0);
            generatedDailyTimes.push(instanceDate.toISOString());
          });
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      const prnRecords = m.prn && (m.administrationRecords || [])
        .filter(r => r.time && r.status === 'given')
        .map(r => r.time);

      const allTimes = [...generatedDailyTimes, ...(prnRecords || [])];
      const uniqueTimes = Array.from(new Set(allTimes));

      return uniqueTimes.map(t => {
        const status = getAdministrationStatus(m.id, t, m);
        return { medId: m.id, medName: m.name, time: t, totalDose: m.totalDose, med: m, status };
      });
    })
    .filter((item) => {
      const t = new Date(item.time).getTime();

      if (t > ninetyDaysAhead) return false;
      
      // Check if time is before medication start date
      if (item.med.startTime) {
        const startTime = new Date(item.med.startTime).getTime();
        if (t < startTime) return false;
      }
      
      if (item.med.endTime) {
        const endTime = new Date(item.med.endTime).getTime();
        if (t > endTime) return false;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTime = today.getTime();

      const scheduleDate = new Date(item.time);
      scheduleDate.setHours(0, 0, 0, 0);
      const scheduleDateTime = scheduleDate.getTime();

      // For medications from previous days, only show if they're due, overdue, or missed
      if (scheduleDateTime < todayTime) {
        // Only show if status is due, overdue, or missed
        if (!['due', 'overdue', 'missed'].includes(item.status)) {
          return false;
        }

        // Hide manually recorded "not given" entries from previous days
        // (e.g. refused, out-of-stock, schedule-conflict). Keep only potential
        // auto-missed entries that have no reason text.
        if (item.status === 'missed') {
          const missedRecordsAtTime = (item.med.administrationRecords || []).filter(
            r => r.time === item.time && r.status === 'missed'
          );

          const hasManualNotGivenReason = missedRecordsAtTime.some(r => {
            const reasonText = (r.reason || '').toLowerCase().trim();
            if (!reasonText) return false;

            return (
              reasonText.includes('marked as not given:') ||
              reasonText.includes('reason: refused') ||
              reasonText.includes('reason: out-of-stock') ||
              reasonText.includes('reason: schedule-conflict') ||
              reasonText.includes('reason: other') ||
              reasonText.includes('reason:')
            );
          });

          if (hasManualNotGivenReason) {
            return false;
          }
        }

        return true;
      }

      return true;
    })
    .sort((a, b) => {
      const ta = new Date(a.time).getTime();
      const tb = new Date(b.time).getTime();
      const aPast = ta <= now;
      const bPast = tb <= now;
      if (aPast !== bPast) return aPast ? -1 : 1;
      if (aPast && bPast) return ta - tb;
      return ta - tb;
    });
}
