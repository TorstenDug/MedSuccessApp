import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
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
  selectedKeys: Set<string>;
  onToggleSelect: (item: TimelineItem) => void;
};

export function TimelineList({ meds, styles, onRecord, selectedKeys, onToggleSelect }: Props) {
  const timelineData = generateTimelineDisplayItems(meds);
  const [hoveredItemKey, setHoveredItemKey] = React.useState<string | null>(null);

  const formatDoseWithUnit = (dose?: string, unit?: string) => {
    if (!dose) return '';
    const trimmedDose = String(dose).trim();
    const trimmedUnit = String(unit || '').trim();
    if (!trimmedUnit) return trimmedDose;
    if (trimmedDose.toLowerCase().includes(trimmedUnit.toLowerCase())) return trimmedDose;
    return `${trimmedDose} ${trimmedUnit}`;
  };

  const formatCount = (value: number): string => {
    if (!Number.isFinite(value)) return '';
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
  };

  const getAdministrationBracket = (med: Medication): string => {
    const route = (med.route || '').toLowerCase();
    const totalDose = parseFloat(med.totalDose || '');
    const dosePerItem = parseFloat(med.dosePerTablet || '');

    const formatStrengthCompact = (dose?: string, unit?: string): string => {
      const d = String(dose || '').trim();
      const u = String(unit || '').trim();
      if (!d) return '';
      if (!u) return d;
      if (d.toLowerCase().includes(u.toLowerCase())) return d.replace(/\s+/g, '');
      return `${d}${u}`;
    };

    if (route.includes('liquid')) {
      const volumeText = formatDoseWithUnit(med.totalDose, med.unit);
      return volumeText ? `(${volumeText})` : '';
    }

    if (Number.isFinite(totalDose) && Number.isFinite(dosePerItem) && dosePerItem > 0) {
      const quantity = totalDose / dosePerItem;
      const qtyText = formatCount(quantity);
      if (!qtyText) return '';
      const perItemStrength = formatStrengthCompact(med.dosePerTablet, med.unit);
      const strengthPart = perItemStrength ? ` ${perItemStrength}` : '';

      if (route.includes('capsule')) return `(${qtyText}x${strengthPart} capsules)`;
      if (route.includes('tablet')) return `(${qtyText}x${strengthPart} tablets)`;
      if (route.includes('lozenge')) return `(${qtyText}x${strengthPart} lozenges)`;
      return `(${qtyText}x doses)`;
    }

    return '';
  };

  const getActualAdministrationDisplay = (med: Medication, recordTabletsGiven?: number) => {
    const route = (med.route || '').toLowerCase();
    const dosePerItem = parseFloat(med.dosePerTablet || '');
    const qty = typeof recordTabletsGiven === 'number' && Number.isFinite(recordTabletsGiven) ? recordTabletsGiven : undefined;

    if (!qty || qty <= 0 || !Number.isFinite(dosePerItem) || dosePerItem <= 0) {
      return null;
    }

    const actualTotal = qty * dosePerItem;
    const perItemStrength = formatDoseWithUnit(String(dosePerItem), med.unit);
    const totalText = formatDoseWithUnit(String(actualTotal), med.unit);

    if (route.includes('capsule')) return `${totalText} (${formatCount(qty)}x ${perItemStrength} capsules)`;
    if (route.includes('tablet')) return `${totalText} (${formatCount(qty)}x ${perItemStrength} tablets)`;
    if (route.includes('lozenge')) return `${totalText} (${formatCount(qty)}x ${perItemStrength} lozenges)`;
    return `${totalText} (${formatCount(qty)}x doses)`;
  };

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
        const itemKey = `${item.medId}::${item.time}`;
        const isHovered = hoveredItemKey === itemKey;
        const status = item.status;
        const stockFromNumber = Number(item.med.stock);
        const stockFromString = Number.parseFloat(String(item.med.stock ?? '').trim());
        const stock = Number.isFinite(stockFromNumber) ? stockFromNumber : stockFromString;
        const isOutOfStock = Number.isFinite(stock) && stock <= 0;
        const outlinedTotalDose = Number.parseFloat(String(item.med.totalDose || ''));
        const outlinedDosePerTablet = Number.parseFloat(String(item.med.dosePerTablet || ''));
        const outlinedQuantity =
          Number.isFinite(outlinedTotalDose) && Number.isFinite(outlinedDosePerTablet) && outlinedDosePerTablet > 0
            ? (outlinedTotalDose / outlinedDosePerTablet)
            : undefined;
        const epsilon = 0.000001;
        const isLowStock =
          Number.isFinite(stock) &&
          !isOutOfStock &&
          outlinedQuantity !== undefined &&
          stock <= outlinedQuantity + epsilon;
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
        const hasLongMissedStatus = status === 'missed' && !!displayMissedReason;
        const rightColumnWidth = hasLongMissedStatus ? 170 : 72;
        const variableDoseInstructions = String(item.med.variableDoseInstructions || '').trim();
        const strengthPerTablet = formatDoseWithUnit(item.med.dosePerTablet, item.med.unit);

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
            <View
              style={[
                styles.timelineCardLarge,
                { borderLeftColor: statusColors[status] },
                isHovered && {
                  shadowOpacity: 0.14,
                  shadowRadius: 10,
                  elevation: 4,
                  transform: [{ translateY: -1 }],
                },
              ]}
            >
              {hoveredItemKey === itemKey && status !== 'given' && (
                <View style={styles.timelineHoverHintBubble}>
                  <Text style={styles.timelineHoverHintText}>Click to record administration</Text>
                  <View style={styles.timelineHoverHintPointer} />
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Pressable
                  onPress={() => onRecord(item)}
                  style={{ flex: 1 }}
                  onHoverIn={() => setHoveredItemKey(itemKey)}
                  onHoverOut={() => setHoveredItemKey((prev) => (prev === itemKey ? null : prev))}
                >
                  <View style={styles.timelineContentLarge}>
                    <View style={styles.timelineHeaderLarge}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={[
                              styles.timelineDateLarge,
                              status === 'given' && { color: '#10b981' },
                              status === 'due' && { color: '#f59e0b' },
                              status === 'overdue' && { color: '#dc2626' },
                              status === 'missed' && { color: '#000000' },
                            ]}
                          >
                            {dateStr}
                          </Text>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: status === 'given' ? '#10b981' : status === 'due' ? '#f59e0b' : status === 'overdue' ? '#dc2626' : '#000' }}>{mealName}</Text>
                          {status !== 'given' && (
                            <Text style={styles.timelineTimeInline}>{displayTimeStr}</Text>
                          )}
                        </View>
                        {status === 'given' && <Text style={styles.timelineTimeLarge}>{displayTimeStr}</Text>}
                        {displayMissedReason && (
                          <Text style={styles.timelineReasonLarge}>Reason: {displayMissedReason}</Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.timelineMedNameLarge}>{item.medName}</Text>
                    {!!variableDoseInstructions && (
                      <Text style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>
                        Dose instructions: {variableDoseInstructions}
                      </Text>
                    )}
                    {!!variableDoseInstructions && !!strengthPerTablet && (
                      <Text style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>
                        Strength per tablet: {strengthPerTablet}
                      </Text>
                    )}
                    {(() => {
                      const actualGivenDisplay = status === 'given'
                        ? getActualAdministrationDisplay(item.med, record?.tabletsGiven)
                        : null;
                      const parsedTotalDose = Number.parseFloat(String(item.totalDose || '').trim());
                      const hasNumericPrescribedDose = Number.isFinite(parsedTotalDose);
                      const prescribedDisplay = hasNumericPrescribedDose
                        ? `${formatDoseWithUnit(item.totalDose, item.med.unit)} ${getAdministrationBracket(item.med)}`.trim()
                        : '';
                      const displayDose = actualGivenDisplay || prescribedDisplay;
                      if (!displayDose) return null;
                      return (
                        <Text style={styles.timelineDoseLarge}>
                          💊 {displayDose}
                        </Text>
                      );
                    })()}
                    {!!item.med.notes && (
                      <Text style={{ fontSize: 11, color: '#475569', marginTop: 2, fontStyle: 'italic' }} numberOfLines={2}>
                        Notes: {item.med.notes}
                      </Text>
                    )}
                    {isOutOfStock && (
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626', marginTop: 2 }}>Out of stock</Text>
                    )}
                    {isLowStock && (
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#b45309', marginTop: 2 }}>
                        Low stock
                      </Text>
                    )}
                  </View>
                </Pressable>

                <View style={{ alignItems: 'flex-end', marginLeft: 8, width: rightColumnWidth, position: 'relative' }}>
                  <Pressable
                    onPress={status === 'given' ? () => onRecord(item) : undefined}
                    disabled={status !== 'given'}
                    hitSlop={{ top: 12, bottom: 20, left: 10, right: 10 }}
                    style={{
                      width: '100%',
                      alignItems: 'flex-end',
                      minHeight: status === 'given' ? 72 : undefined,
                      paddingBottom: status === 'given' ? 12 : 0,
                      justifyContent: 'flex-start',
                    }}
                  >
                    <View style={[styles.timelineStatusBadgeLarge, { backgroundColor: statusColors[status] }]}
                    >
                      <Text style={styles.timelineStatusLabelLarge} numberOfLines={1}>
                        {status === 'missed' && displayMissedReason ? `Not given: ${displayMissedReason}` : statusLabels[status]}
                      </Text>
                    </View>

                    {status === 'given' && (
                      <Text
                        style={{ fontSize: 9, fontWeight: '700', color: '#2563eb', marginTop: 4, textAlign: 'right', width: '100%' }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        Mark as in error
                      </Text>
                    )}
                  </Pressable>

                  {status !== 'given' && (
                    <Pressable
                      onPress={() => onToggleSelect(item)}
                      style={({ pressed }) => [styles.timelineMultiSelectStacked, pressed && { opacity: 0.75 }]}
                      hitSlop={20}
                      pressRetentionOffset={20}
                    >
                      <View style={[
                        styles.timelineMultiSelectCheckbox,
                        selectedKeys.has(itemKey) && styles.timelineMultiSelectCheckboxChecked,
                      ]}>
                        {selectedKeys.has(itemKey) && (
                          <Text style={styles.timelineMultiSelectCheckmark}>✓</Text>
                        )}
                      </View>
                      <Text style={styles.timelineMultiSelectLabel}>Select</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </>
        );
      }}
    />
  );
}
