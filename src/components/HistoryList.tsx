import React, { useMemo } from 'react';
import { FlatList, Text, View, TouchableOpacity, Alert } from 'react-native';
import { Client } from '../storage';
import { STATUS_COLORS, COLORS } from '../constants';
import { getAdministrationTimingStatus } from '../utils/medicationTimingHelpers';

type HistoryItem = {
  medName: string;
  time: string;
  status: string;
  actualTime?: string;
  reason?: string;
  tabletsGiven?: number;
};

type Props = {
  client: Client;
  styles: any;
  filteredRecords?: HistoryItem[];
};

export function HistoryList({ client, styles, filteredRecords }: Props) {
  const isErrorCorrectionReason = (reason?: string) => {
    const text = (reason || '').toLowerCase();
    return (
      text.includes('error correction:') ||
      text.includes('marked as error:') ||
      text.includes('marked as in error')
    );
  };

  const statusColors = {
    ...STATUS_COLORS,
    'not-given': COLORS.black,
    'error-correction': COLORS.textTertiary,
    due: COLORS.warning,
    overdue: COLORS.errorDark,
    pending: COLORS.primary,
    upcoming: '#06b6d4',
  } as const;

  // Extract receipt data from reason field
  function extractReceiptFromReason(reason?: string) {
    if (!reason || !reason.includes('Receipt: data:image')) return null;
    const receiptMatch = reason.match(/Receipt: (data:image\/[^|]+)/);
    return receiptMatch ? receiptMatch[1] : null;
  }

  // Download receipt
  function downloadReceipt(receipt: string) {
    try {
      if (typeof window !== 'undefined' && window.navigator && (window.navigator as any).msSaveOrOpenBlob) {
        // For IE 10+
        const arr = receipt.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(arr[1]);
        const n = bstr.length;
        const u8arr = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          u8arr[i] = bstr.charCodeAt(i);
        }
        const blob = new Blob([u8arr], { type: mime });
        (window.navigator as any).msSaveOrOpenBlob(blob, `receipt-${new Date().getTime()}.jpg`);
      } else if (typeof document !== 'undefined') {
        // For modern browsers
        const a = document.createElement('a');
        a.href = receipt;
        a.download = `receipt-${new Date().getTime()}.jpg`;
        a.click();
      }
    } catch (e) {
      console.error('Error downloading receipt:', e);
      Alert.alert('Error', 'Failed to download receipt');
    }
  }

  const history = useMemo(() => {
    if (filteredRecords) {
      // Use provided filtered records
      const items = [...filteredRecords];
      items.sort((a, b) => {
        const aTime = new Date(a.actualTime || a.time).getTime();
        const bTime = new Date(b.actualTime || b.time).getTime();
        return bTime - aTime;
      });
      return items;
    }
    
    // Build history from client data
    const items: HistoryItem[] = [];
    (client.medications || []).forEach(m => {
      (m.administrationRecords || []).forEach(r =>
        items.push({ medName: m.name, time: r.time, status: r.status, actualTime: r.actualTime, reason: r.reason, tabletsGiven: r.tabletsGiven })
      );
    });
    (client.archivedMedicationHistory || []).forEach(archived => {
      (archived.records || []).forEach(r =>
        items.push({ medName: archived.medName, time: r.time, status: r.status, actualTime: r.actualTime, reason: r.reason, tabletsGiven: r.tabletsGiven })
      );
    });
    items.sort((a, b) => {
      const aTime = new Date(a.actualTime || a.time).getTime();
      const bTime = new Date(b.actualTime || b.time).getTime();
      return bTime - aTime;
    });
    return items;
  }, [client, filteredRecords]);

  return (
    <FlatList
      data={history}
      keyExtractor={(h, idx) => h.medName + '::' + h.time + '::' + idx}
      contentContainerStyle={styles.medList}
      renderItem={({ item, index }) => {
        const effectiveStatus = item.status === 'missed' && isErrorCorrectionReason(item.reason)
          ? 'error-correction'
          : item.status;

        const baseTime = effectiveStatus === 'given' && item.actualTime
          ? new Date(item.actualTime).toLocaleString()
          : effectiveStatus === 'error-correction' && item.actualTime
            ? new Date(item.actualTime).toLocaleString()
            : new Date(item.time).toLocaleString();
        const originalDueTime = new Date(item.time).toLocaleString();

        const itemDate = new Date(item.actualTime || item.time);
        const currentDate = itemDate.toLocaleDateString();
        const currentDateLabel = itemDate.toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const prevItem = index > 0 ? history[index - 1] : null;
        const prevDate = prevItem
          ? new Date(prevItem.actualTime || prevItem.time).toLocaleDateString()
          : null;
        const showDayDivider = index === 0 || prevDate !== currentDate;
        
        let displayTime = baseTime;
        let timingStatusLabel: 'given early' | 'given late' | 'given' | null = null;
        if (effectiveStatus === 'given' && item.actualTime) {
          const timingStatus = getAdministrationTimingStatus(item.time, item.actualTime);
          if (timingStatus === 'given-early') {
            timingStatusLabel = 'given early';
          } else if (timingStatus === 'given-late') {
            timingStatusLabel = 'given late';
          } else {
            timingStatusLabel = 'given';
          }

          const timingDisplay =
            timingStatus === 'given-early'
              ? 'early'
              : timingStatus === 'given-late'
                ? 'late'
                : 'on time';
          displayTime = `Taken at ${baseTime} (${timingDisplay})`;
        }

        if (effectiveStatus === 'error-correction') {
          displayTime = `Marked in error at ${baseTime}`;
        }
        
        const receipt = extractReceiptFromReason(item.reason);
        
        let displayDetails = '';
        const tabletsInfo = effectiveStatus === 'given' && typeof item.tabletsGiven === 'number'
          ? ` — Tablets taken: ${item.tabletsGiven}`
          : '';
        if (item.reason) {
          // Remove receipt data from display details
          const reasonWithoutReceipt = item.reason.replace(/ \| Receipt: data:image\/[^|]+/, '');
          if (reasonWithoutReceipt) {
            if (effectiveStatus === 'missed') {
              displayDetails = ` — Reason: ${reasonWithoutReceipt}`;
            } else {
              displayDetails = ` — ${reasonWithoutReceipt}`;
            }
          }
        }
        
        const isGivenLate = timingStatusLabel === 'given late';
        const statusColor = isGivenLate
          ? COLORS.warning
          : (statusColors[effectiveStatus as keyof typeof statusColors] || COLORS.textTertiary);
        const displayStatus =
          effectiveStatus === 'stock-adjustment'
            ? '📦 Stock Adjustment'
            : effectiveStatus === 'error-correction'
              ? 'Marked as in error'
            : timingStatusLabel || effectiveStatus;
        
        return (
          <>
            {showDayDivider && (
              <View style={styles.dayDivider}>
                <View style={styles.dayDividerLine} />
                <Text style={styles.dayDividerText}>{currentDateLabel}</Text>
                <View style={styles.dayDividerLine} />
              </View>
            )}
            <View style={[styles.historyRow, { borderLeftColor: statusColor, borderLeftWidth: 4 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>
                  {item.medName}
                  {effectiveStatus !== 'stock-adjustment' ? `  •  Due: ${originalDueTime}` : ''}
                </Text>
                <Text style={[styles.medTimeSmall, { color: statusColor }]}>{displayTime} — <Text style={{ fontWeight: '700', color: statusColor }}>{displayStatus}</Text>{displayDetails}</Text>
                {tabletsInfo ? <Text style={[styles.medTimeSmall, { color: '#334155', marginTop: 2 }]}>{tabletsInfo}</Text> : null}
                {receipt && (
                  <TouchableOpacity
                    style={{
                      marginTop: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      backgroundColor: COLORS.primary,
                      borderRadius: 4,
                      alignSelf: 'flex-start',
                    }}
                    onPress={() => downloadReceipt(receipt)}
                  >
                    <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: '600' }}>📥 Download Receipt</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        );
      }}
    />
  );
}
