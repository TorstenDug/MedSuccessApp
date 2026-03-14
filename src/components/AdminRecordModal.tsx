import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { toIsoDateTime } from '../dateTimeUtils';

type AdminStatus = 'given' | 'not-given' | 'third-party' | null;

type AdminRecord = {
  medId: string;
  time: string;
  medName: string;
  presetDoseSummary?: string;
  dueDisplay?: string;
} | null;

type AdminRecordItem = {
  medId: string;
  time: string;
  medName: string;
  presetDoseSummary?: string;
  dueDisplay?: string;
};

type Props = {
  visible: boolean;
  adminRecord: AdminRecord;
  adminRecords?: AdminRecordItem[];
  adminStatus: AdminStatus;
  setAdminStatus: (status: AdminStatus) => void;
  adminScheduledTime: string;
  adminActualTime: string;
  setAdminActualTime: (value: string) => void;
  adminActualTimesByKey: Record<string, string>;
  setAdminActualTimesByKey: (value: Record<string, string>) => void;
  adminTabletsGiven: string;
  setAdminTabletsGiven: (value: string) => void;
  thirdPartyStockHandling: 'already-transferred' | 'own-stock' | null;
  setThirdPartyStockHandling: (value: 'already-transferred' | 'own-stock' | null) => void;
  adminNotes: string;
  setAdminNotes: (value: string) => void;
  administeredBy: string;
  setAdministeredBy: (value: string) => void;
  notGivenReason: string;
  setNotGivenReason: (value: any) => void;
  otherReason: string;
  setOtherReason: (value: string) => void;
  medRoute?: string;
  medStock?: number;
  medTotalDose?: string;
  medDosePerTablet?: string;
  isPrn?: boolean;
  activeMedication?: any;
  showStockReviewNotice?: boolean;
  externalBlockingReason?: string;
  onCancel: () => void;
  onSave: (bypassPrnLimit?: boolean) => void;
  styles: any;
};

export function AdminRecordModal({
  visible,
  adminRecord,
  adminRecords = [],
  adminStatus,
  setAdminStatus,
  adminScheduledTime,
  adminActualTime,
  setAdminActualTime,
  adminActualTimesByKey,
  setAdminActualTimesByKey,
  adminTabletsGiven,
  setAdminTabletsGiven,
  thirdPartyStockHandling,
  setThirdPartyStockHandling,
  adminNotes,
  setAdminNotes,
  administeredBy,
  setAdministeredBy,
  notGivenReason,
  setNotGivenReason,
  otherReason,
  setOtherReason,
  medRoute,
  medStock,
  medTotalDose,
  medDosePerTablet,
  isPrn,
  activeMedication,
  showStockReviewNotice = true,
  externalBlockingReason = '',
  onCancel,
  onSave,
  styles,
}: Props) {
  const hourWheelRef = React.useRef<ScrollView | null>(null);
  const minuteWheelRef = React.useRef<ScrollView | null>(null);
  const timeWheelRowHeight = 34;
  const timeWheelVisibleHeight = 220;

  const [showAdminTimePicker, setShowAdminTimePicker] = useState(false);
  const [showPrnTooEarlyConfirm, setShowPrnTooEarlyConfirm] = useState(false);
  const [showActionRequiredModal, setShowActionRequiredModal] = useState(false);
  const [actionRequiredMessage, setActionRequiredMessage] = useState('');
  const [timePickerTargetKey, setTimePickerTargetKey] = useState<string | null>(null);
  const [adminPickerYear, setAdminPickerYear] = useState(new Date().getFullYear());
  const [adminPickerMonth, setAdminPickerMonth] = useState(new Date().getMonth() + 1);
  const [adminPickerDay, setAdminPickerDay] = useState(new Date().getDate());
  const [adminPickerHour, setAdminPickerHour] = useState(new Date().getHours());
  const [adminPickerMinute, setAdminPickerMinute] = useState(new Date().getMinutes());
  const [adminTimePickerError, setAdminTimePickerError] = useState('');
  const pickerFutureMessage = 'The given time cannot be in the future. Please select the current time or an earlier time.';
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const calendarDayColumnWidth = '14.2857%';
  const calendarTimeGap = 8;

  const selectedPickerDate = new Date(
    adminPickerYear,
    adminPickerMonth - 1,
    adminPickerDay,
    adminPickerHour,
    adminPickerMinute,
    0,
    0
  );
  const selectedPickerMs = selectedPickerDate.getTime();
  const isAdminPickerFuture = Number.isFinite(selectedPickerMs) && selectedPickerMs > Date.now();

  useEffect(() => {
    if (adminTimePickerError) setAdminTimePickerError('');
  }, [adminPickerYear, adminPickerMonth, adminPickerDay, adminPickerHour, adminPickerMinute]);

  useEffect(() => {
    if (!showAdminTimePicker) return;

    const centerOffset = Math.max(0, (timeWheelVisibleHeight - timeWheelRowHeight) / 2);
    const hourY = Math.max(0, (adminPickerHour * timeWheelRowHeight) - centerOffset);
    const minuteY = Math.max(0, (adminPickerMinute * timeWheelRowHeight) - centerOffset);

    const timer = setTimeout(() => {
      hourWheelRef.current?.scrollTo({ y: hourY, animated: false });
      minuteWheelRef.current?.scrollTo({ y: minuteY, animated: false });
    }, 0);

    return () => clearTimeout(timer);
  }, [showAdminTimePicker, adminPickerHour, adminPickerMinute]);

  useEffect(() => {
    const maxDay = new Date(adminPickerYear, adminPickerMonth, 0).getDate();
    if (adminPickerDay > maxDay) {
      setAdminPickerDay(maxDay);
    }
  }, [adminPickerYear, adminPickerMonth, adminPickerDay]);

  function openAdminTimePicker(targetKey?: string) {
    const currentValue = targetKey ? adminActualTimesByKey[targetKey] : adminActualTime;
    const parsed = currentValue ? new Date(currentValue) : new Date();
    const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    setAdminPickerYear(base.getFullYear());
    setAdminPickerMonth(base.getMonth() + 1);
    setAdminPickerDay(base.getDate());
    setAdminPickerHour(base.getHours());
    setAdminPickerMinute(Math.floor(base.getMinutes() / 5) * 5);
    setAdminTimePickerError('');
    setTimePickerTargetKey(targetKey || null);
    setShowAdminTimePicker(true);
  }

  function setPickerFromDate(next: Date) {
    const safe = Number.isNaN(next.getTime()) ? new Date() : next;
    setAdminPickerYear(safe.getFullYear());
    setAdminPickerMonth(safe.getMonth() + 1);
    setAdminPickerDay(safe.getDate());
    setAdminPickerHour(safe.getHours());
    setAdminPickerMinute(Math.floor(safe.getMinutes() / 5) * 5);
  }

  function shiftPickerByMonths(delta: number) {
    const next = new Date(selectedPickerDate);
    const targetDay = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + delta);
    const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(targetDay, maxDay));
    setPickerFromDate(next);
  }

  function setPickerTimeFrom24h(hour24: number, minute: number) {
    const normalizedHour24 = Math.max(0, Math.min(23, hour24));
    setAdminPickerHour(normalizedHour24);
    setAdminPickerMinute(Math.max(0, Math.min(59, minute)));
  }

  function selectCalendarDay(day: number, monthOffset: -1 | 0 | 1) {
    const base = new Date(adminPickerYear, adminPickerMonth - 1, 1, adminPickerHour, adminPickerMinute, 0, 0);
    base.setMonth(base.getMonth() + monthOffset);
    base.setDate(day);
    setPickerFromDate(base);
  }

  function confirmAdminTimePicker() {
    const formatted = toIsoDateTime(
      adminPickerYear,
      adminPickerMonth,
      adminPickerDay,
      adminPickerHour,
      adminPickerMinute
    );

    const selectedMs = new Date(formatted).getTime();
    if (isAdminPickerFuture || (!Number.isNaN(selectedMs) && selectedMs > Date.now())) {
      setAdminTimePickerError(pickerFutureMessage);
      return;
    }

    if (timePickerTargetKey) {
      setAdminActualTimesByKey({ ...adminActualTimesByKey, [timePickerTargetKey]: formatted });
    } else {
      setAdminActualTime(formatted);
    }
    setAdminTimePickerError('');
    setTimePickerTargetKey(null);
    setShowAdminTimePicker(false);
  }

  const isMultiRecordMode = adminRecords.length > 1;
  const showTabletCount = medRoute
    ? medRoute.toLowerCase().includes('tablet') || medRoute.toLowerCase().includes('capsule')
    : false;
  const showTabletCountInput = showTabletCount && !isMultiRecordMode;

  const outlinedTabletsPerAdministration = React.useMemo(() => {
    const totalDose = parseFloat(String(medTotalDose || ''));
    const dosePerTablet = parseFloat(String(medDosePerTablet || ''));
    if (!Number.isFinite(totalDose) || !Number.isFinite(dosePerTablet) || dosePerTablet <= 0) {
      return undefined;
    }
    return totalDose / dosePerTablet;
  }, [medTotalDose, medDosePerTablet]);

  const outlinedTabletsDisplay = React.useMemo(() => {
    if (outlinedTabletsPerAdministration === undefined) return '';
    return outlinedTabletsPerAdministration.toFixed(2).replace(/\.00$/, '');
  }, [outlinedTabletsPerAdministration]);

  const stockReviewNotice = React.useMemo(() => {
    const stockFromNumber = Number(medStock);
    const stockFromString = Number.parseFloat(String(medStock ?? '').trim());
    const stock = Number.isFinite(stockFromNumber) ? stockFromNumber : stockFromString;
    if (!Number.isFinite(stock)) return '';
    if (stock <= 0) {
      return 'This medication is marked out of stock. Stock records may be incorrect and should be reviewed.';
    }
    const enteredQuantity = Number.parseFloat(adminTabletsGiven);
    const threshold = outlinedTabletsPerAdministration ?? (Number.isFinite(enteredQuantity) && enteredQuantity > 0 ? enteredQuantity : undefined);
    if (threshold !== undefined) {
      const epsilon = 0.000001;
      if (stock <= threshold + epsilon) {
        return `This medication is low in stock. Only one outlined dose remains (${threshold.toFixed(2).replace(/\.00$/, '')} units). Stock records should be reviewed.`;
      }
    }
    return '';
  }, [medStock, outlinedTabletsPerAdministration, adminTabletsGiven]);

  useEffect(() => {
    if (adminStatus !== 'third-party') {
      setThirdPartyStockHandling('already-transferred');
    } else if (!thirdPartyStockHandling) {
      setThirdPartyStockHandling('already-transferred');
    }
  }, [adminStatus, thirdPartyStockHandling, setThirdPartyStockHandling, setAdminTabletsGiven]);

  useEffect(() => {
    const needsQuantity = showTabletCountInput && (adminStatus === 'given' || (adminStatus === 'third-party' && thirdPartyStockHandling === 'own-stock'));
    if (!needsQuantity) return;
    if (adminTabletsGiven.trim()) return;
    if (!outlinedTabletsDisplay) return;
    setAdminTabletsGiven(outlinedTabletsDisplay);
  }, [showTabletCountInput, adminStatus, thirdPartyStockHandling, adminTabletsGiven, outlinedTabletsDisplay, setAdminTabletsGiven]);

  useEffect(() => {
    if (!visible) return;
    const message = String(externalBlockingReason || '').trim();
    if (!message) return;
    setActionRequiredMessage(message);
    setShowActionRequiredModal(true);
  }, [visible, externalBlockingReason]);

  const blockingReason = React.useMemo(() => {
    if (!adminStatus) return '';

    if (adminStatus === 'given') {
      if (isMultiRecordMode) {
        for (const record of adminRecords) {
          const key = `${record.medId}::${record.time}`;
          const rowTime = adminActualTimesByKey[key];
          if (!rowTime) return 'Please record the actual date/time for each selected medication.';
          const rowMs = new Date(rowTime).getTime();
          if (Number.isNaN(rowMs) || rowMs > Date.now()) {
            return 'The given time cannot be in the future. Please select the current time or an earlier time.';
          }
        }
      } else {
        const actualMs = adminActualTime ? new Date(adminActualTime).getTime() : NaN;
        if (!adminActualTime) return 'Please record the actual administration time.';
        if (!Number.isNaN(actualMs) && actualMs > Date.now()) {
          return 'The given time cannot be in the future. Please select the current time or an earlier time.';
        }
      }
      if (showTabletCountInput && !adminTabletsGiven) {
        return `Please enter the number of ${medRoute || 'tablets/capsules'} given.`;
      }
      if (showTabletCountInput && outlinedTabletsPerAdministration !== undefined) {
        const entered = parseFloat(adminTabletsGiven);
        if (Number.isFinite(entered)) {
          const epsilon = 0.000001;
          if (entered > outlinedTabletsPerAdministration + epsilon) {
            return `You entered ${entered} tablets/capsules, but the outlined amount is ${outlinedTabletsPerAdministration.toFixed(2).replace(/\.00$/, '')} per administration.`;
          }
        }
      }
    }

    if (adminStatus === 'third-party') {
      if (!thirdPartyStockHandling) return 'Please select one stock handling option.';
      if (showTabletCountInput && thirdPartyStockHandling === 'own-stock' && !adminTabletsGiven) {
        return `Please enter the number of ${medRoute || 'tablets/capsules'} given.`;
      }
      if (showTabletCountInput && thirdPartyStockHandling === 'own-stock' && outlinedTabletsPerAdministration !== undefined) {
        const entered = parseFloat(adminTabletsGiven);
        if (Number.isFinite(entered)) {
          const epsilon = 0.000001;
          if (entered > outlinedTabletsPerAdministration + epsilon) {
            return `You entered ${entered} tablets/capsules, but the outlined amount is ${outlinedTabletsPerAdministration.toFixed(2).replace(/\.00$/, '')} per administration.`;
          }
        }
      }
      if (!administeredBy.trim()) return 'Please enter who administered the medication.';
    }

    return '';
  }, [adminStatus, adminActualTime, adminActualTimesByKey, adminRecords, isMultiRecordMode, showTabletCountInput, adminTabletsGiven, medRoute, thirdPartyStockHandling, administeredBy, notGivenReason, outlinedTabletsPerAdministration]);

  const prnTooEarlyWarning = React.useMemo(() => {
    if (!(adminStatus === 'given' || adminStatus === 'third-party')) return '';
    if (!isPrn) return '';
    const parsePositive = (value: any): number | undefined => {
      const parsed = Number.parseFloat(String(value ?? ''));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    };

    let effectiveMinHours: number | undefined;
    if (activeMedication) {
      const knownFallback = [
        (activeMedication as any).prnVariableMinHoursBetween,
        (activeMedication as any).minTimeBetweenDoses,
        (activeMedication as any).prnMinHoursBetween,
        (activeMedication as any).prnMinimumHoursBetween,
        (activeMedication as any).prnMinimumHoursBetweenDoses,
      ];
      for (const candidate of knownFallback) {
        const parsed = parsePositive(candidate);
        if (parsed) {
          effectiveMinHours = parsed;
          break;
        }
      }

      if (!effectiveMinHours) {
        const dynamicMinHourKeys = Object.keys(activeMedication).filter(key => {
          const lowered = key.toLowerCase();
          return lowered.includes('prn') && lowered.includes('min') && lowered.includes('hour');
        });
        for (const key of dynamicMinHourKeys) {
          const parsed = parsePositive((activeMedication as any)[key]);
          if (parsed) {
            effectiveMinHours = parsed;
            break;
          }
        }
      }
    }

    if (!effectiveMinHours || !activeMedication?.administrationRecords) return '';

    const parseDateTimeFlexibleMs = (value?: string): number | undefined => {
      if (!value) return undefined;
      const raw = String(value).trim();
      if (!raw) return undefined;

      const direct = new Date(raw).getTime();
      if (!Number.isNaN(direct)) return direct;

      const localMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
      if (localMatch) {
        const day = Number.parseInt(localMatch[1], 10);
        const month = Number.parseInt(localMatch[2], 10);
        const year = Number.parseInt(localMatch[3], 10);
        let hour = Number.parseInt(localMatch[4], 10);
        const minute = Number.parseInt(localMatch[5], 10);
        const second = localMatch[6] ? Number.parseInt(localMatch[6], 10) : 0;
        const ampm = (localMatch[7] || '').toUpperCase();

        if (ampm === 'PM' && hour < 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;

        const fallback = new Date(year, month - 1, day, hour, minute, second).getTime();
        if (!Number.isNaN(fallback)) return fallback;
      }

      return undefined;
    };

    const selectedTimeSource = adminActualTime || adminRecord?.time || adminRecords[0]?.time || new Date().toISOString();
    const selectedMsParsed = parseDateTimeFlexibleMs(selectedTimeSource);
    const latestGivenIso = [...activeMedication.administrationRecords]
      .filter((r: any) => r.status === 'given')
      .map((r: any) => r.actualTime || r.time)
      .filter((v: any): v is string => typeof v === 'string' && v.trim().length > 0)
      .sort((a: string, b: string) => {
        const aMs = parseDateTimeFlexibleMs(a);
        const bMs = parseDateTimeFlexibleMs(b);
        const aSafe = typeof aMs === 'number' ? aMs : -Infinity;
        const bSafe = typeof bMs === 'number' ? bMs : -Infinity;
        return bSafe - aSafe;
      })[0];
    if (!latestGivenIso) return '';
    const lastGivenMsParsed = parseDateTimeFlexibleMs(latestGivenIso);
    const selectedMs = typeof selectedMsParsed === 'number' ? selectedMsParsed : NaN;
    const lastGivenMs = typeof lastGivenMsParsed === 'number' ? lastGivenMsParsed : NaN;
    if (Number.isNaN(selectedMs) || Number.isNaN(lastGivenMs)) return '';

    const hoursSinceLast = (selectedMs - lastGivenMs) / (1000 * 60 * 60);
    if (hoursSinceLast < effectiveMinHours) {
      return `${adminRecord?.medName || 'This PRN medication'} doses must be at least ${effectiveMinHours} hour${effectiveMinHours === 1 ? '' : 's'} apart. The last dose was ${hoursSinceLast.toFixed(1)} hour${hoursSinceLast.toFixed(1) === '1.0' ? '' : 's'} ago.`;
    }

    return '';
  }, [
    adminStatus,
    isPrn,
    activeMedication,
    adminActualTime,
    adminRecord,
    adminRecords,
  ]);

  const handleSavePress = () => {
    if (prnTooEarlyWarning && !isMultiRecordMode) {
      setShowPrnTooEarlyConfirm(true);
      return;
    }

    if (blockingReason) {
      setActionRequiredMessage(blockingReason);
      setShowActionRequiredModal(true);
      return;
    }

    onSave();
  };

  const compactAdminSummary = React.useMemo(() => {
    if (!isMultiRecordMode) return [];
    return adminRecords.map((record) => {
      const due = record.dueDisplay || `${new Date(record.time).toLocaleDateString()} @ ${new Date(record.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const dose = record.presetDoseSummary || 'Dose not set';
      return `${record.medName} | ${dose} | ${due}`;
    });
  }, [adminRecords, isMultiRecordMode]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '90%' }]}>
          <ScrollView
            showsVerticalScrollIndicator
            persistentScrollbar
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 4 }}
          >
          <View style={styles.adminModalHeader}>
            <Text style={styles.modalTitle}>Record Administration</Text>
            <Text style={styles.adminModalSubtitle}>
              {isMultiRecordMode ? `${adminRecords.length} medications selected` : adminRecord?.medName}
            </Text>
            {isMultiRecordMode && (
              <View style={{ marginTop: 8, backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#1d4ed8', marginBottom: 6 }}>Recording now</Text>
                {compactAdminSummary.slice(0, 4).map((line, index) => (
                  <Text key={`${line}-${index}`} style={{ fontSize: 11, color: '#1e3a8a', marginBottom: 2 }}>
                    {line}
                  </Text>
                ))}
                {compactAdminSummary.length > 4 && (
                  <Text style={{ fontSize: 11, color: '#1e40af', fontWeight: '600' }}>+{compactAdminSummary.length - 4} more</Text>
                )}
              </View>
            )}
          </View>

          {!adminStatus ? (
            <View style={styles.adminStatusButtons}>
              <TouchableOpacity
                style={styles.adminStatusButton}
                onPress={() => setAdminStatus('given')}
              >
                <Text style={styles.adminStatusButtonLabel}>✓ Given</Text>
                <Text style={styles.adminStatusButtonDesc}>Dose was administered</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminStatusButton}
                onPress={() => setAdminStatus('not-given')}
              >
                <Text style={styles.adminStatusButtonLabel}>✗ Not Given</Text>
                <Text style={styles.adminStatusButtonDesc}>Dose was not taken</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminStatusButton}
                onPress={() => setAdminStatus('third-party')}
              >
                <Text style={styles.adminStatusButtonLabel}>👤 Third Party</Text>
                <Text style={styles.adminStatusButtonDesc}>Administered by another person</Text>
              </TouchableOpacity>
            </View>
          ) : adminStatus === 'given' || adminStatus === 'third-party' ? (
            <View style={styles.adminFormSection}>
              {!isPrn && (
                <>
                  <Text style={styles.adminFormLabel}>Scheduled Time</Text>
                  <View style={[styles.adminFormInput, { justifyContent: 'center', paddingVertical: 12, backgroundColor: '#f0f9ff' }]}>
                    <Text style={{ color: '#333', fontSize: 16, fontWeight: '600' }}>{adminScheduledTime}</Text>
                  </View>
                </>
              )}

              {adminStatus === 'given' && !isMultiRecordMode && (
                <>
                  <Text style={styles.adminFormLabel}>Actual Administration Time *</Text>
                  <TouchableOpacity
                    style={[styles.adminFormInput, { justifyContent: 'center', paddingVertical: 12, borderWidth: 1, borderColor: !adminActualTime ? '#dc2626' : '#d1d5db' }]}
                    onPress={() => openAdminTimePicker()}
                  >
                    <Text style={{ color: adminActualTime ? '#000' : '#999', fontSize: 16 }}>
                      {adminActualTime ? new Date(adminActualTime).toLocaleString() : 'Tap to select date & time'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {adminStatus === 'given' && isMultiRecordMode && (
                <View style={{ marginBottom: 12 }}>
                  <TouchableOpacity
                    style={{ alignSelf: 'flex-start', backgroundColor: '#2563eb', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 }}
                    onPress={() => {
                      const now = new Date();
                      const formatted = toIsoDateTime(now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), Math.floor(now.getMinutes() / 5) * 5);
                      const next: Record<string, string> = { ...adminActualTimesByKey };
                      adminRecords.forEach((record) => {
                        next[`${record.medId}::${record.time}`] = formatted;
                      });
                      setAdminActualTimesByKey(next);
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Apply Current Date/Time To All</Text>
                  </TouchableOpacity>

                  {adminRecords.map((record) => {
                    const recordKey = `${record.medId}::${record.time}`;
                    const rowTime = adminActualTimesByKey[recordKey];
                    const doseLabel = record.presetDoseSummary || 'Dose not set';
                    return (
                      <View key={recordKey} style={{ borderWidth: 1, borderColor: '#dbeafe', borderRadius: 8, backgroundColor: '#f8fbff', padding: 10, marginBottom: 8 }}>
                        <Text style={{ fontSize: 13, color: '#1f2937' }}>
                          <Text style={{ fontWeight: '700' }}>{record.medName}</Text>
                          <Text style={{ color: '#334155' }}> | {doseLabel}</Text>
                        </Text>
                        <Text style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>Due: {record.dueDisplay || `${new Date(record.time).toLocaleDateString()} @ ${new Date(record.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</Text>
                        <TouchableOpacity
                          style={[styles.adminFormInput, { marginTop: 8, justifyContent: 'center', paddingVertical: 10, borderWidth: 1, borderColor: rowTime ? '#d1d5db' : '#dc2626' }]}
                          onPress={() => openAdminTimePicker(recordKey)}
                        >
                          <Text style={{ color: rowTime ? '#000' : '#999', fontSize: 14 }}>
                            {rowTime ? new Date(rowTime).toLocaleString() : 'Tap to set actual date & time'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {adminStatus === 'third-party' && showTabletCountInput && (
                <>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}
                    onPress={() => {
                      const next = thirdPartyStockHandling === 'already-transferred' ? null : 'already-transferred';
                      setThirdPartyStockHandling(next);
                      setAdminTabletsGiven('');
                    }}
                  >
                    <View style={{ width: 18, height: 18, borderWidth: 2, borderColor: '#3b82f6', borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 2, backgroundColor: thirdPartyStockHandling === 'already-transferred' ? '#3b82f6' : '#fff' }}>
                      {thirdPartyStockHandling === 'already-transferred' ? <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text> : null}
                    </View>
                    <Text style={{ flex: 1, fontSize: 12, color: '#334155', fontWeight: '600', lineHeight: 17 }}>
                      This medication has already been transfered to this third party and the stock count does not need updating
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}
                    onPress={() => {
                      const next = thirdPartyStockHandling === 'own-stock' ? null : 'own-stock';
                      setThirdPartyStockHandling(next);
                      if (next !== 'own-stock') setAdminTabletsGiven('');
                    }}
                  >
                    <View style={{ width: 18, height: 18, borderWidth: 2, borderColor: '#3b82f6', borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 2, backgroundColor: thirdPartyStockHandling === 'own-stock' ? '#3b82f6' : '#fff' }}>
                      {thirdPartyStockHandling === 'own-stock' ? <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text> : null}
                    </View>
                    <Text style={{ flex: 1, fontSize: 12, color: '#334155', fontWeight: '600', lineHeight: 17 }}>
                      This dose has not already been transfered to this third party, and has been taken direclty from own stock, requiring the stock count to be updated
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {showTabletCountInput && (adminStatus === 'given' || (adminStatus === 'third-party' && thirdPartyStockHandling === 'own-stock')) && (
                <>
                  <Text style={styles.adminFormLabel}>Number of tablets taken *</Text>
                  <TextInput
                    style={[styles.adminFormInput, !adminTabletsGiven && { borderColor: '#dc2626', borderWidth: 2 }]}
                    placeholder="Enter number (required)"
                    value={adminTabletsGiven}
                    onChangeText={setAdminTabletsGiven}
                    keyboardType="number-pad"
                  />
                </>
              )}

              <Text style={styles.adminFormLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.adminFormInput, styles.multilineInput]}
                placeholder="Any additional notes..."
                value={adminNotes}
                onChangeText={setAdminNotes}
                multiline
              />

              {adminStatus === 'third-party' && (
                <>
                  <Text style={styles.adminFormLabel}>Administered by *</Text>
                  <TextInput
                    style={styles.adminFormInput}
                    placeholder="Name of person or orginistation responsible"
                    value={administeredBy}
                    onChangeText={setAdministeredBy}
                  />
                </>
              )}
            </View>
          ) : (
            <View style={styles.adminFormSection}>
              <Text style={styles.adminFormLabel}>Reason not given</Text>
              {['refused', 'out-of-stock', 'missed', 'schedule-conflict', 'other'].map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[styles.reasonOption, notGivenReason === reason && styles.reasonOptionSelected]}
                  onPress={() => setNotGivenReason(reason as any)}
                >
                  <Text style={[styles.reasonOptionText, notGivenReason === reason && styles.reasonOptionTextSelected]}>
                    {reason.charAt(0).toUpperCase() + reason.slice(1).replace('-', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
              {notGivenReason === 'other' && (
                <TextInput
                  style={styles.adminFormInput}
                  placeholder="Please specify reason"
                  value={otherReason}
                  onChangeText={setOtherReason}
                  multiline
                />
              )}
            </View>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalCancel]}
              onPress={onCancel}
            >
              <Text style={styles.modalBtnText}>{adminStatus ? 'Back' : 'Cancel'}</Text>
            </TouchableOpacity>
            {adminStatus && (
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSave, !!blockingReason && { opacity: 0.8 }]}
                onPress={handleSavePress}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            )}
          </View>
          {adminStatus && !!blockingReason && (
            <Text style={{ fontSize: 12, color: '#b45309', marginTop: 8, fontWeight: '600' }}>
              {blockingReason}
            </Text>
          )}
          </ScrollView>
        </View>
      </View>

      <Modal
        visible={showPrnTooEarlyConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPrnTooEarlyConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '88%', maxWidth: 420 }]}>
            <Text style={styles.modalTitle}>PRN Dose Limit</Text>
            <Text style={{ fontSize: 13, color: '#4b5563', lineHeight: 20, marginBottom: 16 }}>
              {prnTooEarlyWarning}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setShowPrnTooEarlyConfirm(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSave]}
                onPress={() => {
                  setShowPrnTooEarlyConfirm(false);
                  onSave(true);
                }}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Record Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAdminTimePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '90%', maxWidth: 520, maxHeight: '90%', padding: 16 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Select Administration Date & Time</Text>
            </View>

            {(isAdminPickerFuture || !!adminTimePickerError) && (
              <View style={{ marginBottom: 12, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff1f2' }}>
                <Text style={{ fontSize: 12, color: '#b91c1c', fontWeight: '700' }}>
                  {isAdminPickerFuture ? pickerFutureMessage : adminTimePickerError}
                </Text>
              </View>
            )}

            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity
                  style={{ backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}
                  onPress={() => setPickerFromDate(new Date())}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: '#e0e7ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}
                  onPress={() => {
                    const source = adminRecord?.time || adminRecords[0]?.time;
                    if (!source) return;
                    setPickerFromDate(new Date(source));
                  }}
                >
                  <Text style={{ color: '#1e3a8a', fontSize: 12, fontWeight: '700' }}>Use Scheduled</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, backgroundColor: '#f3f4f6', padding: 12, marginBottom: 8 }}>
              {(() => {
                const firstOfMonth = new Date(adminPickerYear, adminPickerMonth - 1, 1);
                const firstWeekday = firstOfMonth.getDay();
                const daysInMonth = new Date(adminPickerYear, adminPickerMonth, 0).getDate();
                const prevMonthDays = new Date(adminPickerYear, adminPickerMonth - 1, 0).getDate();
                const totalCells = 42;

                const cells: Array<{ day: number; offset: -1 | 0 | 1 }> = [];
                for (let i = 0; i < firstWeekday; i += 1) {
                  cells.push({ day: prevMonthDays - firstWeekday + i + 1, offset: -1 });
                }
                for (let d = 1; d <= daysInMonth; d += 1) {
                  cells.push({ day: d, offset: 0 });
                }
                while (cells.length < totalCells) {
                  cells.push({ day: cells.length - (firstWeekday + daysInMonth) + 1, offset: 1 });
                }

                const rows = Array.from({ length: 6 }, (_, rowIdx) => cells.slice(rowIdx * 7, rowIdx * 7 + 7));

                return (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'flex-start', marginBottom: 8 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 8 }}>
                          <View style={{ borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>{`${monthLabels[adminPickerMonth - 1]} ${adminPickerYear}`}</Text>
                          </View>
                          <View style={{ marginLeft: 6, flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity
                              style={{ backgroundColor: '#e5e7eb', borderRadius: 6, width: 26, height: 22, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}
                              onPress={() => shiftPickerByMonths(1)}
                            >
                              <Text style={{ fontWeight: '800', color: '#111827', fontSize: 12 }}>↑</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ backgroundColor: '#e5e7eb', borderRadius: 6, width: 26, height: 22, alignItems: 'center', justifyContent: 'center' }}
                              onPress={() => shiftPickerByMonths(-1)}
                            >
                              <Text style={{ fontWeight: '800', color: '#111827', fontSize: 12 }}>↓</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 6 }}>
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, idx) => (
                            <Text key={`${w}-${idx}`} style={{ width: calendarDayColumnWidth, textAlign: 'center', fontSize: 10, color: '#374151', fontWeight: '700' }}>{w}</Text>
                          ))}
                        </View>

                        {rows.map((row, rowIdx) => (
                          <View key={`row-${rowIdx}`} style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 0 }}>
                            {row.map((cell, cellIdx) => {
                              const isSelected = cell.offset === 0 && cell.day === adminPickerDay;
                              const isOutside = cell.offset !== 0;
                              return (
                                <TouchableOpacity
                                  key={`cell-${rowIdx}-${cellIdx}`}
                                  style={{
                                    width: calendarDayColumnWidth,
                                    height: 22,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 6,
                                    backgroundColor: isSelected ? '#3b82f6' : 'transparent',
                                  }}
                                  onPress={() => selectCalendarDay(cell.day, cell.offset)}
                                >
                                  <Text style={{
                                    fontSize: 12,
                                    color: isSelected ? '#fff' : isOutside ? '#9ca3af' : '#111827',
                                    fontWeight: isSelected ? '800' : '600',
                                  }}>
                                    {cell.day}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ))}
                      </View>

                      <View style={{ width: 160, marginLeft: calendarTimeGap }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ width: 72, textAlign: 'center', fontSize: 12, fontWeight: '800', color: '#475569' }}>Hour</Text>
                          <Text style={{ width: 72, textAlign: 'center', fontSize: 12, fontWeight: '800', color: '#475569' }}>Min</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <ScrollView ref={hourWheelRef} style={{ width: 72, height: 220 }} showsVerticalScrollIndicator={false}>
                            {Array.from({ length: 24 }, (_, i) => i).map((hour24) => {
                              const selected = hour24 === adminPickerHour;
                              return (
                                <TouchableOpacity
                                  key={`h-${hour24}`}
                                  style={{
                                    borderRadius: 6,
                                    height: timeWheelRowHeight,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 0,
                                    backgroundColor: selected ? '#3b82f6' : 'transparent',
                                  }}
                                  onPress={() => setPickerTimeFrom24h(hour24, adminPickerMinute)}
                                >
                                  <Text style={{ color: selected ? '#fff' : '#111827', fontWeight: selected ? '800' : '600', fontSize: 14 }}>
                                    {String(hour24).padStart(2, '0')}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>

                          <ScrollView ref={minuteWheelRef} style={{ width: 72, height: 220 }} showsVerticalScrollIndicator={false}>
                            {Array.from({ length: 60 }, (_, i) => i).map((minute) => {
                              const selected = minute === adminPickerMinute;
                              return (
                                <TouchableOpacity
                                  key={`m-${minute}`}
                                  style={{
                                    borderRadius: 6,
                                    height: timeWheelRowHeight,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 0,
                                    backgroundColor: selected ? '#3b82f6' : 'transparent',
                                  }}
                                  onPress={() => setPickerTimeFrom24h(adminPickerHour, minute)}
                                >
                                  <Text style={{ color: selected ? '#fff' : '#111827', fontWeight: selected ? '800' : '600', fontSize: 14 }}>
                                    {String(minute).padStart(2, '0')}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      </View>
                    </View>
                  </>
                );
              })()}
            </View>

            <View style={{ backgroundColor: '#f0f9ff', borderRadius: 8, padding: 12, marginTop: 4, marginBottom: 12, borderWidth: 1, borderColor: '#93c5fd' }}>
              <Text style={{ fontSize: 12, color: '#666', fontWeight: '600', marginBottom: 4 }}>Selected</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#2563eb' }}>
                {new Date(adminPickerYear, adminPickerMonth - 1, adminPickerDay, adminPickerHour, adminPickerMinute).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>

             <View
               style={[
                 styles.modalActions,
                 {
                   marginTop: 8,
                   marginBottom: 0,
                   paddingHorizontal: 0,
                   alignSelf: 'stretch',
                   justifyContent: 'flex-end',
                   alignItems: 'center',
                 },
               ]}
             >
               <TouchableOpacity
                 style={[styles.modalBtn, styles.modalCancel, { minWidth: 92, alignItems: 'center' }]}
                 onPress={() => {
                   setAdminTimePickerError('');
                   setShowAdminTimePicker(false);
                 }}
               >
                 <Text style={styles.modalBtnText}>Cancel</Text>
               </TouchableOpacity>
               <TouchableOpacity
                 style={[styles.modalBtn, styles.modalSave, { minWidth: 92, alignItems: 'center' }, isAdminPickerFuture && { opacity: 0.6 }]}
                 onPress={confirmAdminTimePicker}
                 disabled={isAdminPickerFuture}
               >
                 <Text style={[styles.modalBtnText, { color: '#fff' }]}>Confirm</Text>
               </TouchableOpacity>
             </View>
           </View>
         </View>
       </Modal>

      <Modal
        visible={showActionRequiredModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionRequiredModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '88%', maxWidth: 420 }]}> 
            <Text style={styles.modalTitle}>Cannot Record Medication</Text>
            <Text style={{ fontSize: 13, color: '#4b5563', lineHeight: 20, marginBottom: 16 }}>
              {actionRequiredMessage}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSave]}
                onPress={() => setShowActionRequiredModal(false)}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}
