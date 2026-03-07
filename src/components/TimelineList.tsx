import React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Medication } from '../storage';
import { getSlotNameFromTime, getTimeRangeLabel } from '../utils/medicationTimingHelpers';
import { generateTimelineDisplayItems } from '../utils/timelineGenerator';

type TimelineItem = {
  medId: string;
  medName: string;
  time: string;
  totalDose?: string;
  med: Medication;
};

type Props = {
  meds: Medication[];
  styles: any;
  onRecord: (item: TimelineItem) => void;
};

export function TimelineList({ meds, styles, onRecord }: Props) {
  const timelineData = generateTimelineDisplayItems(meds);

  const statusColors = {
    given: '#10b981',
    missed: '#000000',
    due: '#f59e0b',
    overdue: '#dc2626',
    pending: '#3b82f6',
    upcoming: '#06b6d4'
  } as const;
  const statusLabels = {
    given: 'Given',
    missed: 'Not Given',
    due: 'Due',
    overdue: 'Overdue',
    pending: 'Pending',
    upcoming: 'Upcoming'
  } as const;

  return (
    <FlatList
      data={timelineData}
      keyExtractor={(i) => i.medId + '::' + i.time}
      contentContainerStyle={styles.timelineList}
      ListEmptyComponent={
        <View style={styles.emptyTimelineContainer}>
          <Text style={styles.emptyTimelineIcon}>📅</Text>
          <Text style={styles.emptyTimelineTitle}>No medication timeline</Text>
          <Text style={styles.emptyTimelineDesc}>Add a medication with scheduled times to see the timeline</Text>
        </View>
      }
      renderItem={({ item, index }) => {
        const status = item.status;
        const dt = new Date(item.time);
        const dateStr = dt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

        const record = (item.med.administrationRecords || []).find(r => r.time === item.time);
        let displayTimeStr: string;
        const missedReason = status === 'missed' ? record?.reason : undefined;
        let displayMissedReason: string | undefined = undefined;
        if (missedReason) {
          // Extract just the reason part from "Reason: {reason} | ..."
          const match = missedReason.match(/Reason:\s*([^|]+)/i);
          displayMissedReason = match ? match[1].trim() : missedReason;
        }
        if (status === 'given') {
          const timeStr = record && record.actualTime
            ? new Date(record.actualTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          displayTimeStr = `Taken at ${timeStr}`;
        } else {
          const rangeLabel = getTimeRangeLabel(item.time);
          displayTimeStr = rangeLabel;
        }
        const slotName = getSlotNameFromTime(item.time);
        const mealName = slotName.split('(')[0].trim();

        const prevItem = index > 0 ? timelineData[index - 1] : null;
        const prevDate = prevItem ? new Date(prevItem.time).toLocaleDateString() : null;
        const currentDate = dt.toLocaleDateString();
        const showDayDivider = index === 0 || prevDate !== currentDate;

        return (
          <>
            {showDayDivider && (
              <View style={styles.dayDivider}>
                <View style={styles.dayDividerLine} />
                <Text style={styles.dayDividerText}>{dateStr}</Text>
                <View style={styles.dayDividerLine} />
              </View>
            )}
            <TouchableOpacity
              onPress={() => onRecord(item)}
              style={[styles.timelineCardLarge, { borderLeftColor: statusColors[status] }]}
            >
              <View style={styles.timelineContentLarge}>
                <View style={styles.timelineHeaderLarge}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.timelineDateLarge, status === 'given' && { color: '#10b981' }, status === 'due' && { color: '#f59e0b' }, status === 'overdue' && { color: '#dc2626' }]}>{dateStr}</Text>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: status === 'given' ? '#10b981' : status === 'due' ? '#f59e0b' : status === 'overdue' ? '#dc2626' : '#000' }}>{mealName}</Text>
                    </View>
                    <Text style={styles.timelineTimeLarge}>{displayTimeStr}</Text>
                    {displayMissedReason && (
                      <Text style={styles.timelineReasonLarge}>Reason: {displayMissedReason}</Text>
                    )}
                  </View>
                  <View style={[styles.timelineStatusBadgeLarge, { backgroundColor: statusColors[status] }]}
                  >
                    <Text style={styles.timelineStatusLabelLarge}>
                      {status === 'missed' && displayMissedReason ? `Not given: ${displayMissedReason}` : statusLabels[status]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.timelineMedNameLarge}>{item.medName}</Text>
                {item.totalDose && <Text style={styles.timelineDoseLarge}>💊 {item.totalDose}</Text>}
                <Text style={styles.timelineClickHint}>{status === 'given' ? 'Mark as in error' : 'Tap to record'}</Text>
              </View>
            </TouchableOpacity>
          </>
        );
      }}
    />
  );
}
