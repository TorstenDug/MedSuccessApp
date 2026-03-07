import React, { useMemo } from 'react';
import { FlatList, Text, View, TouchableOpacity, Alert } from 'react-native';
import { Client } from '../storage';
import { STATUS_COLORS, COLORS } from '../constants';

type HistoryItem = {
  medName: string;
  time: string;
  status: string;
  actualTime?: string;
  reason?: string;
};

type Props = {
  client: Client;
  styles: any;
  filteredRecords?: HistoryItem[];
};

export function HistoryList({ client, styles, filteredRecords }: Props) {
  const statusColors = {
    ...STATUS_COLORS,
    'not-given': COLORS.black,
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
        items.push({ medName: m.name, time: r.time, status: r.status, actualTime: r.actualTime, reason: r.reason })
      );
    });
    (client.archivedMedicationHistory || []).forEach(archived => {
      (archived.records || []).forEach(r =>
        items.push({ medName: archived.medName, time: r.time, status: r.status, actualTime: r.actualTime, reason: r.reason })
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
        const baseTime = item.status === 'given' && item.actualTime
          ? new Date(item.actualTime).toLocaleString()
          : new Date(item.time).toLocaleString();

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
        if (item.status === 'given' && item.actualTime) {
          const scheduledTime = new Date(item.time).getTime();
          const actualTime = new Date(item.actualTime).getTime();
          const diffMinutes = (actualTime - scheduledTime) / (1000 * 60);
          const timingStatus = diffMinutes <= 15 ? 'on time' : 'late';
          displayTime = `Taken at ${baseTime} (${timingStatus})`;
        }
        
        const receipt = extractReceiptFromReason(item.reason);
        
        let displayDetails = '';
        if (item.reason) {
          // Remove receipt data from display details
          const reasonWithoutReceipt = item.reason.replace(/ \| Receipt: data:image\/[^|]+/, '');
          if (reasonWithoutReceipt) {
            if (item.status === 'missed') {
              displayDetails = ` — Reason: ${reasonWithoutReceipt}`;
            } else {
              displayDetails = ` — ${reasonWithoutReceipt}`;
            }
          }
        }
        
        const statusColor = statusColors[item.status as keyof typeof statusColors] || COLORS.textTertiary;
        const displayStatus = item.status === 'stock-adjustment' ? '📦 Stock Adjustment' : item.status;
        
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
                <Text style={styles.medName}>{item.medName}</Text>
                <Text style={[styles.medTimeSmall, { color: statusColor }]}>{displayTime} — <Text style={{ fontWeight: '700', color: statusColor }}>{displayStatus}</Text>{displayDetails}</Text>
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
