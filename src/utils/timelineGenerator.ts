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
  const sevenDaysAhead = now + 7 * 24 * 60 * 60 * 1000;
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

  const toLocalSlotKey = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return [
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
    ].join('-');
  };

  return meds
    .flatMap(m => {
      const parsedEndTime = m.endTime ? new Date(m.endTime).getTime() : undefined;
      const hasEndDate = parsedEndTime !== undefined && Number.isFinite(parsedEndTime);
      const isShortTerm = m.courseType === 'short-term';
      const baseFutureHorizon = hasEndDate || isShortTerm ? ninetyDaysAhead : sevenDaysAhead;
      const futureHorizon = m.frequencyType === 'fortnightly'
        ? Math.max(baseFutureHorizon, now + 14 * 24 * 60 * 60 * 1000)
        : m.frequencyType === 'monthly'
          ? Math.max(baseFutureHorizon, now + 32 * 24 * 60 * 60 * 1000)
          : baseFutureHorizon;

      const medStartCandidates = [
        m.startTime ? new Date(m.startTime).getTime() : undefined,
        earliestScheduledBaseTime(m)
      ].filter((t): t is number => t !== undefined && Number.isFinite(t));

      const medStartTime = medStartCandidates.length > 0 ? Math.min(...medStartCandidates) : now;
      const generationStart = startOfDay(medStartTime);
      const generationEnd = endOfDay(
        Math.min(
          hasEndDate ? parsedEndTime! : Number.MAX_SAFE_INTEGER,
          futureHorizon
        )
      );

      if (generationStart.getTime() > generationEnd.getTime()) {
        return [];
      }

      // Handle interval-based medications (every-second-day, weekly, fortnightly, monthly)
      if (m.frequencyType && m.frequencyType !== 'daily' && m.startTime) {
        const startDate = new Date(m.startTime);
        startDate.setHours(0, 0, 0, 0);
        const generatedTimes: string[] = [];
        const intervalDays = m.frequencyType === 'every-second-day' ? 2 : m.frequencyType === 'weekly' ? 7 : m.frequencyType === 'fortnightly' ? 14 : undefined;

        if (startDate.getTime() > generationEnd.getTime()) {
          return [];
        }

        if (m.frequencyType === 'monthly') {
          const firstInstance = new Date(startDate);
          while (firstInstance.getTime() < generationStart.getTime()) {
            firstInstance.setMonth(firstInstance.getMonth() + 1);
          }

          const cursor = new Date(firstInstance);
          while (cursor.getTime() <= generationEnd.getTime()) {
            const instanceDate = new Date(cursor);
            // Set to 00:00 for all-day "due" status
            instanceDate.setHours(0, 0, 0, 0);
            generatedTimes.push(instanceDate.toISOString());
            cursor.setMonth(cursor.getMonth() + 1);
          }
        } else {
          const firstInstance = new Date(startDate);
          while (firstInstance.getTime() < generationStart.getTime()) {
            firstInstance.setDate(firstInstance.getDate() + (intervalDays || 0));
          }

          const cursor = new Date(firstInstance);
          while (cursor.getTime() <= generationEnd.getTime()) {
            const instanceDate = new Date(cursor);
            // Set to 00:00 for all-day "due" status
            instanceDate.setHours(0, 0, 0, 0);
            generatedTimes.push(instanceDate.toISOString());
            cursor.setDate(cursor.getDate() + (intervalDays || 0));
          }
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

      const parsedEndTime = item.med.endTime ? new Date(item.med.endTime).getTime() : undefined;
      const hasEndDate = parsedEndTime !== undefined && Number.isFinite(parsedEndTime);
      const isShortTerm = item.med.courseType === 'short-term';
      const futureHorizon = hasEndDate || isShortTerm ? ninetyDaysAhead : sevenDaysAhead;

      if (t > futureHorizon) return false;
      
      // Check if time is before medication start date
      if (item.med.startTime) {
        const startTime = new Date(item.med.startTime).getTime();
        const isIntervalSchedule = !!item.med.frequencyType && item.med.frequencyType !== 'daily';
        const isDailySchedule = !item.med.frequencyType || item.med.frequencyType === 'daily';
        const hasScheduledTimes = (item.med.scheduledTimes || []).length > 0;

        if ((isDailySchedule && hasScheduledTimes) || isIntervalSchedule) {
          const startDate = new Date(item.med.startTime);
          startDate.setHours(0, 0, 0, 0);
          const itemDate = new Date(item.time);
          itemDate.setHours(0, 0, 0, 0);
          if (itemDate.getTime() < startDate.getTime()) return false;
        } else {
          if (t < startTime) return false;
        }
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

      const scheduleSlotKey = toLocalSlotKey(item.time);
      const hasActionedRecordForSlot = (item.med.administrationRecords || []).some(r => {
        if (!(r.status === 'given' || r.status === 'missed')) return false;
        if (!scheduleSlotKey) return false;
        return toLocalSlotKey(r.time) === scheduleSlotKey;
      });

      const givenRecordAtTime = (item.med.administrationRecords || []).find(
        r => r.time === item.time && r.status === 'given'
      );
      const givenRecordDayTime = givenRecordAtTime
        ? (() => {
            const d = new Date(givenRecordAtTime.actualTime || givenRecordAtTime.time);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
          })()
        : undefined;
      const isScheduledForToday = scheduleDateTime === todayTime;

      // Preserve today's given entries only when they are scheduled for today.
      // This prevents past-day overdue doses recorded late from lingering as "Given" in timeline.
      if (item.status === 'given' && isScheduledForToday && givenRecordDayTime === todayTime) {
        return true;
      }

      // For medications from previous days, only show if they're due, overdue, or missed
      if (scheduleDateTime < todayTime) {
        // Once a previous-day dose has been actioned, keep it in history only.
        if (hasActionedRecordForSlot) {
          return false;
        }

        // Only show if status is due, overdue, or missed
        if (!['due', 'overdue', 'missed'].includes(item.status)) {
          return false;
        }

        return true;
      }

      return true;
    })
    .sort((a, b) => {
      const isDueAnyTimeToday = (item: TimelineDisplayItem) => {
        if (item.status !== 'due') return false;
        const d = new Date(item.time);
        const nowDate = new Date();
        return (
          d.getFullYear() === nowDate.getFullYear() &&
          d.getMonth() === nowDate.getMonth() &&
          d.getDate() === nowDate.getDate() &&
          d.getHours() === 0 &&
          d.getMinutes() === 0
        );
      };

      const aDueAnyToday = isDueAnyTimeToday(a);
      const bDueAnyToday = isDueAnyTimeToday(b);
      if (aDueAnyToday !== bDueAnyToday) return aDueAnyToday ? -1 : 1;

      const ta = new Date(a.time).getTime();
      const tb = new Date(b.time).getTime();
      const aPast = ta <= now;
      const bPast = tb <= now;
      if (aPast !== bPast) return aPast ? -1 : 1;
      if (aPast && bPast) return ta - tb;
      return ta - tb;
    });
}
