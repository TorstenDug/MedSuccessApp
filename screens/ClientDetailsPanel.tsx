import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, Image, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import JSZip from 'jszip';
import { Client, Medication, loadData, saveData, updateMedication, addAdministrationRecord, updateClient, deleteClient } from '../src/storage';
import { AddMedicationModal } from './AddMedicationScreen';
import { AdminRecordModal } from '../src/components/AdminRecordModal';
import { TimelineList } from '../src/components/TimelineList';
import { HistoryList } from '../src/components/HistoryList';
import { DeleteConfirmModal } from '../src/components/DeleteConfirmModal';
import { getSlotNameFromTime, getAdministrationStatus, getAdministrationTimingStatus } from '../src/utils/medicationTimingHelpers';
import { formatIsoDate, toIsoDate } from '../src/dateTimeUtils';
import { safeParseInt } from '../src/validation';
import { logError, showError, showSuccess } from '../src/errorHandling';

const MED_UNITS = ['mg', 'g', 'mcg', 'ml', 'L', 'IU', 'mmol', '%', 'units'];
const SCRIPT_LOCATIONS = ['Pharmacy file', 'Home office', 'Clients possession', 'Management office', 'Other'] as const;

type Props = {
  client: Client | null;
  locationId?: string;
  navigation?: any;
  onClientUpdated?: () => void;
};

type TimelineSelectableItem = {
  medId: string;
  medName: string;
  time: string;
  totalDose?: string;
  med: Medication;
};

export default function ClientDetailsPanel({ client, locationId, navigation, onClientUpdated }: Props) {

  const isCleanNumberInput = (value: string): boolean => /^\d+(\.\d+)?$/.test(String(value || '').trim());

  const formatDoseWithUnit = (dose?: string, unit?: string) => {
    if (!dose) return '';
    const trimmedDose = String(dose).trim();
    const trimmedUnit = String(unit || '').trim();
    if (!trimmedUnit) return trimmedDose;
    if (trimmedDose.toLowerCase().includes(trimmedUnit.toLowerCase())) return trimmedDose;
    return `${trimmedDose} ${trimmedUnit}`;
  };

  const formatCustomTimeRange = (time: string): string => {
    const parts = time.split(':');
    if (parts.length !== 2) return time;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return time;
    const total = h * 60 + m;
    const start = Math.max(0, total - 15);
    const end = Math.min(1439, total + 15);
    const fmt = (mins: number) => {
      const hh = Math.floor(mins / 60);
      const mm = mins % 60;
      return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
    };
    return `${fmt(start)}-${fmt(end)}`;
  };

  const [tab, setTab] = useState<'medications' | 'timeline' | 'history'>('timeline');
  const [localClient, setLocalClient] = useState<Client | null>(client);
  const [editMed, setEditMed] = useState<Medication | null>(null);
  const [editing, setEditing] = useState(false);
  const [slots, setSlots] = useState({ beforeBreakfast: false, breakfast: false, lunch: false, dinner: false, beforeBed: false });
  const [editPrn, setEditPrn] = useState(false);
  const [editStartDate, setEditStartDate] = useState('');
  const [showEditStartDatePicker, setShowEditStartDatePicker] = useState(false);
  const [editEndDate, setEditEndDate] = useState('');
  const [showEditEndDatePicker, setShowEditEndDatePicker] = useState(false);
  const [editPickerYear, setEditPickerYear] = useState(new Date().getFullYear());
  const [editPickerMonth, setEditPickerMonth] = useState(new Date().getMonth() + 1);
  const [editPickerDay, setEditPickerDay] = useState(new Date().getDate());
  
  // Edit medication extended fields
  const [editFrequencyType, setEditFrequencyType] = useState<'daily' | 'every-second-day' | 'weekly' | 'fortnightly' | 'monthly'>('daily');
  const [editCustomTimes, setEditCustomTimes] = useState<string[]>([]);
  const [editNewCustomTime, setEditNewCustomTime] = useState('');
  const [editMinTimeBetweenDoses, setEditMinTimeBetweenDoses] = useState('');
  const [editMaxDosePerAdministration, setEditMaxDosePerAdministration] = useState('');
  const [editMaxDosePer24Hours, setEditMaxDosePer24Hours] = useState('');
  const [editTabletsToBeGiven, setEditTabletsToBeGiven] = useState('');
  const [editMultipleDosesPerTablet, setEditMultipleDosesPerTablet] = useState(false);
  const [editDosePerTablet2, setEditDosePerTablet2] = useState('');
  const [showEditSecondUnitDropdown, setShowEditSecondUnitDropdown] = useState(false);
  const [showEditFrequencyDropdown, setShowEditFrequencyDropdown] = useState(false);
  const [showEditSlotsDropdown, setShowEditSlotsDropdown] = useState(false);
  const [editCourseType, setEditCourseType] = useState<'long-term' | 'short-term'>('long-term');
  const [editStartTime, setEditStartTime] = useState('');
  const [editHasScriptRepeats, setEditHasScriptRepeats] = useState(false);
  const [editScriptRepeatsCount, setEditScriptRepeatsCount] = useState('');
  const [editPrescriptionFileUri, setEditPrescriptionFileUri] = useState('');
  const [editScriptLocation, setEditScriptLocation] = useState<(typeof SCRIPT_LOCATIONS)[number] | ''>('');
  const [editScriptLocationOtherDetail, setEditScriptLocationOtherDetail] = useState('');
  const [showEditScriptLocationDropdown, setShowEditScriptLocationDropdown] = useState(false);
  
  const [editingClient, setEditingClient] = useState(false);
  const [showEditClientLocationDropdown, setShowEditClientLocationDropdown] = useState(false);
  const [editClientLocationId, setEditClientLocationId] = useState('');
  const [availableClientLocations, setAvailableClientLocations] = useState<{ id: string; name: string }[]>([]);
  const [clientDraft, setClientDraft] = useState<{ name: string; dob?: string; allergies?: string; additionalInfo?: string; gender?: string; weight?: string; contactEmail?: string; gp?: string; gpClinic?: string; medicareNumber?: string; photoUri?: string }>({ name: client?.name || '', dob: client?.dob || '', allergies: client?.allergies || '', additionalInfo: client?.additionalInfo || '', gender: client?.gender || '', weight: client?.weight || '', contactEmail: client?.contactEmail || '', gp: client?.gp || '', gpClinic: client?.gpClinic || '', medicareNumber: client?.medicareNumber || '', photoUri: client?.photoUri || '' });
  
  // Administration recording modal state
  const [recordingAdmin, setRecordingAdmin] = useState(false);
  const [adminRecord, setAdminRecord] = useState<{ medId: string; time: string; medName: string; presetDoseSummary?: string; dueDisplay?: string } | null>(null);
  const [adminRecordsBatch, setAdminRecordsBatch] = useState<{ medId: string; time: string; medName: string; presetDoseSummary?: string; dueDisplay?: string }[]>([]);
  const [adminStatus, setAdminStatus] = useState<'given' | 'not-given' | 'third-party' | null>(null);
  const [notGivenReason, setNotGivenReason] = useState<'refused' | 'out-of-stock' | 'missed' | 'schedule-conflict' | 'other' | ''>('');
  const [otherReason, setOtherReason] = useState('');
  const [administeredBy, setAdministeredBy] = useState('');
  
  // New administration recording fields
  const [adminScheduledTime, setAdminScheduledTime] = useState('');
  const [adminActualTime, setAdminActualTime] = useState('');
  const [adminActualTimesByKey, setAdminActualTimesByKey] = useState<Record<string, string>>({});
  const [adminEntrySource, setAdminEntrySource] = useState<'timeline' | 'medications' | null>(null);
  const [adminSaveBlockReason, setAdminSaveBlockReason] = useState('');
  const [adminTabletsGiven, setAdminTabletsGiven] = useState('');
  const [adminThirdPartyStockHandling, setAdminThirdPartyStockHandling] = useState<'already-transferred' | 'own-stock' | null>('already-transferred');
  const [adminNotes, setAdminNotes] = useState('');

  const [selectedTimelineItems, setSelectedTimelineItems] = useState<TimelineSelectableItem[]>([]);
  const [selectedTimelineClientId, setSelectedTimelineClientId] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [medToDelete, setMedToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // Stock warning modal state
  const [showStockWarning, setShowStockWarning] = useState(false);
  const [stockWarningMed, setStockWarningMed] = useState<{ name: string; stock: number } | null>(null);
  
  // Error correction modal state
  const [showErrorCorrection, setShowErrorCorrection] = useState(false);
  const [errorCorrectionRecord, setErrorCorrectionRecord] = useState<{ medId: string; time: string; medName: string } | null>(null);
  const [errorReason, setErrorReason] = useState<'wrong-client' | 'wrong-time' | 'wrong-medication' | 'other' | ''>('');
  const [errorNotes, setErrorNotes] = useState('');
  const [showErrorReasonDropdown, setShowErrorReasonDropdown] = useState(false);
  
  // Add medication modal state
  const [showAddMedication, setShowAddMedication] = useState(false);
  const [showAddMedicationPrompt, setShowAddMedicationPrompt] = useState(false);
  const [showSummaryOptions, setShowSummaryOptions] = useState(false);
  const [showOutOfStockReviewPrompt, setShowOutOfStockReviewPrompt] = useState(false);
  const [outOfStockReviewMessage, setOutOfStockReviewMessage] = useState('');
  const [pendingOutOfStockBypassPrn, setPendingOutOfStockBypassPrn] = useState<boolean | undefined>(undefined);
  
  // History search state
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [showHistoryFilters, setShowHistoryFilters] = useState(false);
  const [historyDatePreset, setHistoryDatePreset] = useState<'all' | 'today' | 'last7' | 'last30'>('all');
  const [historySelectedStatuses, setHistorySelectedStatuses] = useState<string[]>([]);
  const [historySelectedMeds, setHistorySelectedMeds] = useState<string[]>([]);
  const [historyTimingFilter, setHistoryTimingFilter] = useState<'all' | 'on-time' | 'early' | 'late'>('all');
  const [historyHasReasonOnly, setHistoryHasReasonOnly] = useState(false);
  const [historyIncludeStockAdjustments, setHistoryIncludeStockAdjustments] = useState(true);
  const [historyOnlyStockAdjustments, setHistoryOnlyStockAdjustments] = useState(false);

  const allHistoryRecords = useMemo(() => {
    if (!localClient) return [] as { medName: string; time: string; status: string; actualTime?: string; reason?: string; tabletsGiven?: number }[];

    const allRecords = Array.from(localClient.medications || [])
      .flatMap(m => (m.administrationRecords || []).map(r => ({ medName: m.name, ...r })));
    const archivedRecords = Array.from(localClient.archivedMedicationHistory || []).flatMap(archived =>
      (archived.records || []).map(r => ({ medName: archived.medName, time: r.time, status: r.status as any, actualTime: r.actualTime, reason: r.reason, tabletsGiven: r.tabletsGiven }))
    );

    return allRecords.concat(archivedRecords as any);
  }, [localClient]);
  const historyStatusOptions = useMemo(() => {
    return Array.from(new Set(allHistoryRecords.map(r => r.status))).sort();
  }, [allHistoryRecords]);

  const historyMedicationOptions = useMemo(() => {
    return Array.from(new Set(allHistoryRecords.map(r => r.medName))).sort((a, b) => a.localeCompare(b));
  }, [allHistoryRecords]);

  const activeHistoryFilterCount =
    (historyDatePreset !== 'all' ? 1 : 0) +
    (historySelectedStatuses.length > 0 ? 1 : 0) +
    (historySelectedMeds.length > 0 ? 1 : 0) +
    (historyTimingFilter !== 'all' ? 1 : 0) +
    (historyHasReasonOnly ? 1 : 0) +
    (!historyIncludeStockAdjustments ? 1 : 0) +
    (historyOnlyStockAdjustments ? 1 : 0);

  function toggleHistoryStatus(status: string) {
    setHistorySelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  }

  function toggleHistoryMedication(medName: string) {
    setHistorySelectedMeds(prev =>
      prev.includes(medName) ? prev.filter(m => m !== medName) : [...prev, medName]
    );
  }

  function clearAllHistoryFilters() {
    setHistoryDatePreset('all');
    setHistorySelectedStatuses([]);
    setHistorySelectedMeds([]);
    setHistoryTimingFilter('all');
    setHistoryHasReasonOnly(false);
    setHistoryIncludeStockAdjustments(true);
    setHistoryOnlyStockAdjustments(false);
  }

  // Refresh local client state when selection changes
  useEffect(() => {
    setLocalClient(client ?? null);
    setClientDraft({
      name: client?.name || '',
      dob: client?.dob || '',
      allergies: client?.allergies || '',
      additionalInfo: client?.additionalInfo || '',
      gender: client?.gender || '',
      weight: client?.weight || '',
      contactEmail: client?.contactEmail || '',
      gp: client?.gp || '',
      gpClinic: client?.gpClinic || '',
      medicareNumber: client?.medicareNumber || '',
      photoUri: client?.photoUri || ''
    });
    setEditClientLocationId(locationId || '');
    setTab('timeline');
    setEditing(false);
    setEditingClient(false);
    setSelectedTimelineItems([]);
    setSelectedTimelineClientId(client?.id || null);
    setAdminRecordsBatch([]);
    setAdminActualTimesByKey({});
    setAdminEntrySource(null);
    setAdminSaveBlockReason('');
  }, [client?.id]);

  useEffect(() => {
    if (!editingClient) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await loadData();
        if (cancelled) return;
        setAvailableClientLocations(data.map(loc => ({ id: loc.id, name: loc.name })));
      } catch (e) {
        logError(e, 'Load Locations For Client Edit');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editingClient]);

  // Refresh data when screen comes into focus (e.g., after returning from StockManagement)
  useFocusEffect(
    React.useCallback(() => {
      if (locationId && localClient?.id) {
        (async () => {
          try {
            const data = await loadData();
            const loc = data.find(l => l.id === locationId);
            const c = loc?.clients.find(cc => cc.id === localClient.id) || null;
            setLocalClient(c);
            if (onClientUpdated) onClientUpdated();
          } catch (e) {
            logError(e, 'Refresh Client Data');
          }
        })();
      }
    }, [locationId, localClient?.id])
  );

  async function refreshLocal() {
    if (!locationId || !localClient) return;
    try {
      const data = await loadData();
      const loc = data.find(l => l.id === locationId);
      const c = loc?.clients.find(cc => cc.id === localClient.id) || null;
      setLocalClient(c);
      if (onClientUpdated) onClientUpdated();
    } catch (e) {
      logError(e, 'Refresh Local Client');
    }
  }

  const activeAdminMedication = localClient?.medications?.find(m => m.id === (adminRecordsBatch[0]?.medId || adminRecord?.medId));
  const parseDateTimeFlexibleMs = (value?: string): number | undefined => {
    if (!value) return undefined;
    const raw = String(value).trim();
    if (!raw) return undefined;

    const direct = new Date(raw).getTime();
    if (!Number.isNaN(direct)) return direct;

    // Fallback for locale-like strings, e.g. 12/03/2026, 09:45:00 PM
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

  function openEditStartDatePicker() {
    if (editStartDate) {
      const parts = editStartDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (parts) {
        setEditPickerYear(safeParseInt(parts[1], editPickerYear));
        setEditPickerMonth(safeParseInt(parts[2], editPickerMonth));
        setEditPickerDay(safeParseInt(parts[3], editPickerDay));
      }
    } else {
      const today = new Date();
      setEditPickerYear(today.getFullYear());
      setEditPickerMonth(today.getMonth() + 1);
      setEditPickerDay(today.getDate());
    }
    setShowEditStartDatePicker(true);
  }

  function openEditEndDatePicker() {
    if (editEndDate) {
      const parts = editEndDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (parts) {
        setEditPickerYear(safeParseInt(parts[1], editPickerYear));
        setEditPickerMonth(safeParseInt(parts[2], editPickerMonth));
        setEditPickerDay(safeParseInt(parts[3], editPickerDay));
      }
    } else {
      const today = new Date();
      setEditPickerYear(today.getFullYear());
      setEditPickerMonth(today.getMonth() + 1);
      setEditPickerDay(today.getDate());
    }
    setShowEditEndDatePicker(true);
  }

  function confirmEditStartDatePicker() {
    const formatted = `${editPickerYear}-${String(editPickerMonth).padStart(2, '0')}-${String(editPickerDay).padStart(2, '0')}`;
    setEditStartDate(formatted);
    setShowEditStartDatePicker(false);
  }

  function confirmEditEndDatePicker() {
    const formatted = `${editPickerYear}-${String(editPickerMonth).padStart(2, '0')}-${String(editPickerDay).padStart(2, '0')}`;
    const selectedDate = new Date(formatted);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      Alert.alert('Invalid Date', 'End date cannot be in the past');
      return;
    }
    
    setEditEndDate(formatted);
    setShowEditEndDatePicker(false);
  }

  // medication edit handlers
  function openEdit(med: Medication) {
    setEditMed({ ...med });
    setEditStartDate(formatIsoDate(med.startTime));
    setEditEndDate(formatIsoDate(med.endTime));
    
    // derive slot selections from scheduledTimes
    const s = { beforeBreakfast: false, breakfast: false, lunch: false, dinner: false, beforeBed: false };
    const customTimesArray: string[] = [];
    
    (med.scheduledTimes || []).forEach(t => {
      const d = new Date(t);
      const h = d.getHours();
      const mmin = d.getMinutes();
      if (h === 7 && mmin === 30) s.beforeBreakfast = true;
      else if (h === 8 && mmin === 0) s.breakfast = true;
      else if (h === 12 && mmin === 0) s.lunch = true;
      else if (h === 18 && mmin === 0) s.dinner = true;
      else if (h === 22 && mmin === 0) s.beforeBed = true;
      else {
        // Custom time
        const timeStr = `${h.toString().padStart(2, '0')}:${mmin.toString().padStart(2, '0')}`;
        if (!customTimesArray.includes(timeStr)) {
          customTimesArray.push(timeStr);
        }
      }
    });
    
    setSlots(s);
    setEditCustomTimes(customTimesArray);
    setEditNewCustomTime('');
    setEditPrn(!!med.prn);
    setEditFrequencyType(med.frequencyType || 'daily');
    const parsedTotalDose = Number.parseFloat(String(med.totalDose || '').trim());
    const parsedDosePerTablet = Number.parseFloat(String(med.dosePerTablet || '').trim());
    const hasNumericQuantity = Number.isFinite(parsedTotalDose) && Number.isFinite(parsedDosePerTablet) && parsedDosePerTablet > 0;
    const derivedQuantity = hasNumericQuantity ? (parsedTotalDose / parsedDosePerTablet).toString() : '';
    setEditTabletsToBeGiven(med.variableDoseInstructions || derivedQuantity || '');
    setEditMultipleDosesPerTablet(!!med.multipleDosesPerTablet);
    setEditDosePerTablet2(med.dosePerTablet2 || '');
    setEditMed(current => current ? { ...current, dosePerTablet2Unit: current.dosePerTablet2Unit || current.unit || 'mg' } : current);
    setEditMinTimeBetweenDoses(med.prnVariableMinHoursBetween?.toString() || '');
    setEditMaxDosePerAdministration(med.prnVariableMaxDosePerAdministration?.toString() || '');
    setEditMaxDosePer24Hours(med.prnVariableMaxDosePer24Hours?.toString() || '');
    setEditCourseType(med.courseType || 'long-term');
    setEditStartTime(med.startTime ? (med.startTime.split('T')[1]?.slice(0, 5) || '') : '');
    setEditHasScriptRepeats(!!med.hasScriptRepeats);
    setEditScriptRepeatsCount(med.scriptRepeatsCount?.toString() || '');
    setEditPrescriptionFileUri(med.prescriptionFileUri || '');
    setEditScriptLocation(med.scriptLocation || '');
    setEditScriptLocationOtherDetail(med.scriptLocationOtherDetail || '');
    setEditing(true);
  }

  async function pickEditPrescriptionFile() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets[0]?.base64) {
        const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setEditPrescriptionFileUri(base64Uri);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to select prescription file');
    }
  }

  async function saveEdit() {
    if (!editMed || !locationId || !localClient) {
      Alert.alert('Cannot Save', 'Medication details are incomplete or unavailable. Please close and reopen the edit form, then try again.');
      return;
    }
    
    // Preserve free-text dose instructions and only calculate totalDose from clean numeric inputs.
    const hasCleanQuantity = isCleanNumberInput(editTabletsToBeGiven);
    const hasCleanPerItemDose = isCleanNumberInput(editMed.dosePerTablet || '');
    if (editTabletsToBeGiven && hasCleanQuantity && hasCleanPerItemDose) {
      editMed.totalDose = (parseFloat(editTabletsToBeGiven) * parseFloat(editMed.dosePerTablet || '')).toString();
      editMed.variableDoseInstructions = undefined;
    } else if (editTabletsToBeGiven && !hasCleanQuantity) {
      editMed.totalDose = '';
      editMed.variableDoseInstructions = editTabletsToBeGiven.trim();
    } else {
      editMed.variableDoseInstructions = undefined;
      if (!editTabletsToBeGiven) {
        editMed.totalDose = '';
      }
    }
    
    // update scheduledTimes from slots and custom times
    editMed.scheduledTimes = editFrequencyType === 'daily' && !editPrn ? makeScheduledTimesFromSlots(slots, editCustomTimes) : [];
    editMed.prn = !!editPrn;
    editMed.frequencyType = editFrequencyType !== 'daily' ? editFrequencyType : undefined;
    editMed.courseType = editPrn ? undefined : editCourseType;
    editMed.startTime = editStartDate
      ? `${editStartDate}T${(editStartTime || '00:00')}:00`
      : undefined;
    editMed.endTime = (editCourseType === 'short-term' && editEndDate) ? toIsoDate(editEndDate) : undefined;
    editMed.hasScriptRepeats = editHasScriptRepeats || undefined;
    editMed.scriptRepeatsCount = editHasScriptRepeats && editScriptRepeatsCount ? parseInt(editScriptRepeatsCount, 10) : undefined;
    editMed.prescriptionFileUri = editHasScriptRepeats ? (editPrescriptionFileUri || undefined) : undefined;
    editMed.scriptLocation = editHasScriptRepeats ? (editScriptLocation || undefined) : undefined;
    editMed.scriptLocationOtherDetail = editHasScriptRepeats && editScriptLocation === 'Other'
      ? (editScriptLocationOtherDetail || undefined)
      : undefined;
    
    // Handle subcutaneous injection
    if (editMed.route === 'Subcutaneous injection') {
      editMed.dosePerTablet = undefined;
      editMed.dosePerTablet2 = undefined;
      editMed.dosePerTablet2Unit = undefined;
      editMed.multipleDosesPerTablet = undefined;
    } else {
      editMed.multipleDosesPerTablet = editMultipleDosesPerTablet || undefined;
      editMed.dosePerTablet2 = editMultipleDosesPerTablet ? editDosePerTablet2 : undefined;
      editMed.dosePerTablet2Unit = editMultipleDosesPerTablet ? (editMed.dosePerTablet2Unit || editMed.unit) : undefined;
    }
    
    // Save PRN variable restrictions
    if (editPrn) {
      editMed.prnVariableMinHoursBetween = editMinTimeBetweenDoses ? parseFloat(editMinTimeBetweenDoses) : undefined;
      editMed.prnVariableMaxDosePerAdministration = editMaxDosePerAdministration ? parseFloat(editMaxDosePerAdministration) : undefined;
      editMed.prnVariableMaxDosePer24Hours = editMaxDosePer24Hours ? parseFloat(editMaxDosePer24Hours) : undefined;
    } else {
      editMed.prnVariableMinHoursBetween = undefined;
      editMed.prnVariableMaxDosePerAdministration = undefined;
      editMed.prnVariableMaxDosePer24Hours = undefined;
    }
    
    try {
      await updateMedication(locationId, localClient.id, editMed);
      setEditing(false);
      setEditMed(null);
      await refreshLocal();
    } catch (e) {
      logError(e, 'Save Medication Edit');
      showError(e, 'Failed to save medication');
    }
  }

  async function deleteMedication() {
    if (!editMed) return;
    
    // Check if medication has remaining stock
    const stockCount = safeParseInt(editMed.stock || 0);
    const route = String(editMed.route || '').toLowerCase();
    const bypassStockZeroDeleteRule = route.includes('liquid') || route.includes('eye drops');
    
    if (stockCount > 0 && !bypassStockZeroDeleteRule) {
      // Show in-app warning modal
      setStockWarningMed({ name: editMed.name, stock: stockCount });
      setShowStockWarning(true);
      return;
    }
    
    setMedToDelete({ id: editMed.id, name: editMed.name });
    setShowDeleteConfirm(true);
  }

  async function confirmDeleteMedication() {
    if (!medToDelete || !locationId || !localClient) return;
    
    try {
      // Record deletion in history
      const deletedTime = new Date().toISOString();
      await addAdministrationRecord(locationId, localClient.id, medToDelete.id, deletedTime, 'deleted');
      
      // Re-fetch the medication to get the deletion record that was just added
      const data = await loadData();
      const loc = data.find(l => l.id === locationId);
      const freshClient = loc?.clients.find(c => c.id === localClient.id);
      if (!freshClient) throw new Error('Client not found');
      
      const medicationToArchive = freshClient.medications?.find(m => m.id === medToDelete.id);
      
      // Archive the medication's administration records before removing it
      if (medicationToArchive && medicationToArchive.administrationRecords && medicationToArchive.administrationRecords.length > 0) {
        const archived = {
          medName: medicationToArchive.name,
          records: medicationToArchive.administrationRecords
        };
        freshClient.archivedMedicationHistory = freshClient.archivedMedicationHistory || [];
        freshClient.archivedMedicationHistory.push(archived);
      }
      
      // Remove from medications
      const updatedMeds = (freshClient.medications || []).filter(m => m.id !== medToDelete.id);
      freshClient.medications = updatedMeds;
      
      // Update storage
      await updateClient(locationId, freshClient);
      
      // Close modals
      setShowDeleteConfirm(false);
      setMedToDelete(null);
      setEditing(false);
      setEditMed(null);
      
      // Refresh
      await refreshLocal();
      
      showSuccess(`${medToDelete.name} has been deleted.`);
    } catch (e) {
      logError(e, 'Delete Medication');
      showError(e, 'Failed to delete medication');
    }
  }

  // helper to compute scheduledTimes from slot selection
  function makeScheduledTimesFromSlots(slots: { beforeBreakfast: boolean; breakfast: boolean; lunch: boolean; dinner: boolean; beforeBed: boolean }, customTimes?: string[]) {
    const now = new Date();
    const make = (h: number, m: number) => {
      const d = new Date(now);
      d.setHours(h, m, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      return d.toISOString();
    };
    const out: string[] = [];
    if (slots.beforeBreakfast) out.push(make(7, 30));
    if (slots.breakfast) out.push(make(8, 0));
    if (slots.lunch) out.push(make(12, 0));
    if (slots.dinner) out.push(make(18, 0));
    if (slots.beforeBed) out.push(make(22, 0));
    
    // Add custom times
    if (customTimes) {
      customTimes.forEach(timeStr => {
        const parts = timeStr.split(':');
        if (parts.length === 2) {
          const h = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          if (!Number.isNaN(h) && !Number.isNaN(m)) {
            out.push(make(h, m));
          }
        }
      });
    }
    
    return out;
  }

  // Filter history records by search query
  function getFilteredHistoryRecords() {
    const query = historySearchQuery.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = now.getTime() - (30 * 24 * 60 * 60 * 1000);

    return allHistoryRecords.filter(record => {
      if (query) {
        const matchesSearch =
          record.medName.toLowerCase().includes(query) ||
          record.status.toLowerCase().includes(query) ||
          (record.reason && record.reason.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      const eventTime = new Date(record.actualTime || record.time).getTime();
      if (!Number.isFinite(eventTime)) return false;

      if (historyDatePreset === 'today' && eventTime < startOfToday) return false;
      if (historyDatePreset === 'last7' && eventTime < sevenDaysAgo) return false;
      if (historyDatePreset === 'last30' && eventTime < thirtyDaysAgo) return false;

      if (historyOnlyStockAdjustments) {
        const isStockRelated = record.status === 'stock-adjustment' || record.status === 'created';
        if (!isStockRelated) return false;
      }

      if (!historyIncludeStockAdjustments && record.status === 'stock-adjustment') return false;

      if (historySelectedStatuses.length > 0 && !historySelectedStatuses.includes(record.status)) return false;
      if (historySelectedMeds.length > 0 && !historySelectedMeds.includes(record.medName)) return false;

      if (historyHasReasonOnly && !(record.reason && record.reason.trim())) return false;

      if (historyTimingFilter !== 'all') {
        if (record.status !== 'given' || !record.actualTime) return false;
        const timing = getAdministrationTimingStatus(record.time, record.actualTime);
        if (historyTimingFilter === 'on-time' && timing !== 'given-on-time') return false;
        if (historyTimingFilter === 'early' && timing !== 'given-early') return false;
        if (historyTimingFilter === 'late' && timing !== 'given-late') return false;
      }

      return true;
    });
  }

  async function pickClientPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets[0]?.base64) {
        const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setClientDraft(d => ({ ...d, photoUri: base64Uri }));
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image');
    }
  }

  async function saveClientEdit() {
    if (!locationId || !localClient) {
      Alert.alert('Cannot Save', 'Client details are unavailable right now. Please refresh the screen and try again.');
      return;
    }
    if (!clientDraft.name.trim()) {
      Alert.alert('Validation', 'Please enter client name');
      return;
    }
    if (!editClientLocationId) {
      Alert.alert('Validation', 'Please select a location');
      return;
    }
    const updated: Client = { 
      ...localClient, 
      name: clientDraft.name,
      dob: clientDraft.dob, 
      allergies: clientDraft.allergies,
      additionalInfo: clientDraft.additionalInfo?.trim() || undefined,
      gender: clientDraft.gender as any,
      weight: clientDraft.weight,
      contactEmail: clientDraft.contactEmail,
      gp: clientDraft.gp,
      gpClinic: clientDraft.gpClinic,
      medicareNumber: clientDraft.medicareNumber,
      photoUri: clientDraft.photoUri || undefined,
    };
    try {
      if (editClientLocationId === locationId) {
        await updateClient(locationId, updated);
      } else {
        const data = await loadData();
        const sourceLoc = data.find(l => l.id === locationId);
        const targetLoc = data.find(l => l.id === editClientLocationId);
        if (!sourceLoc || !targetLoc) {
          Alert.alert('Cannot Save', 'Selected location was not found. Please refresh and try again.');
          return;
        }

        const sourceIdx = sourceLoc.clients.findIndex(c => c.id === localClient.id);
        if (sourceIdx === -1) {
          Alert.alert('Cannot Save', 'Client could not be found in the current location. Please refresh and try again.');
          return;
        }

        sourceLoc.clients.splice(sourceIdx, 1);
        targetLoc.clients.push(updated);
        await saveData(data);
      }
      setEditingClient(false);
      await refreshLocal();
    } catch (e) {
      logError(e, 'Save Client Edit');
      showError(e, 'Failed to update client');
    }
  }

  async function handleErrorCorrection() {
    if (!errorCorrectionRecord || !errorReason.trim() || !locationId || !localClient) {
      Alert.alert('Validation', 'Please select an error reason');
      return;
    }

    try {
      const med = localClient.medications?.find(m => m.id === errorCorrectionRecord.medId);

      if (med) {
        const givenRecordsAtTime = (med.administrationRecords || []).filter(
          r => r.time === errorCorrectionRecord.time && r.status === 'given'
        );
        const givenRecordToReverse = givenRecordsAtTime.length > 0
          ? givenRecordsAtTime[givenRecordsAtTime.length - 1]
          : undefined;

        const inferAdministrationQuantity = (medication?: Medication): number | undefined => {
          if (!medication) return undefined;
          const totalDose = parseFloat(String(medication.totalDose || ''));
          const dosePerTablet = parseFloat(String(medication.dosePerTablet || ''));
          if (Number.isFinite(totalDose) && Number.isFinite(dosePerTablet) && dosePerTablet > 0) {
            return totalDose / dosePerTablet;
          }
          return 1;
        };

        if (!givenRecordToReverse) {
          Alert.alert('Unable to Mark as Error', 'No given administration record was found to reverse for this scheduled time.');
          return;
        }

        const quantityToRestore =
          (typeof givenRecordToReverse.tabletsGiven === 'number' && Number.isFinite(givenRecordToReverse.tabletsGiven) && givenRecordToReverse.tabletsGiven > 0)
            ? givenRecordToReverse.tabletsGiven
            : inferAdministrationQuantity(med);

        const allRecords = med.administrationRecords || [];
        let removeIndex = -1;
        for (let i = allRecords.length - 1; i >= 0; i -= 1) {
          const r = allRecords[i];
          if (r.time === errorCorrectionRecord.time && r.status === 'given') {
            removeIndex = i;
            break;
          }
        }
        const updatedRecords = removeIndex >= 0
          ? allRecords.filter((_, idx) => idx !== removeIndex)
          : allRecords;

        const shouldRestoreStock =
          !!givenRecordToReverse &&
          typeof med.stock === 'number' &&
          med.stock > 0 &&
          typeof quantityToRestore === 'number' &&
          Number.isFinite(quantityToRestore) &&
          quantityToRestore > 0;

        const updatedMed: Medication = {
          ...med,
          administrationRecords: updatedRecords,
          stock: shouldRestoreStock ? (med.stock || 0) + quantityToRestore : med.stock,
        };

        await updateMedication(locationId, localClient.id, updatedMed);
      }

      // Log a compact audit-only entry without affecting timeline due/overdue status.
      const errorReasonLabel =
        errorReason === 'wrong-client' ? 'Wrong Client' :
        errorReason === 'wrong-time' ? 'Wrong Time' :
        errorReason === 'wrong-medication' ? 'Wrong Medication' :
        'Other';
      const correctionReason = `Marked as in error (${errorReasonLabel})${errorNotes ? ` - ${errorNotes}` : ''}`;
      await addAdministrationRecord(
        locationId,
        localClient.id,
        errorCorrectionRecord.medId,
        errorCorrectionRecord.time,
        'error-correction',
        new Date().toISOString(),
        correctionReason
      );

      setShowErrorCorrection(false);
      setErrorCorrectionRecord(null);
      setErrorReason('');
      setErrorNotes('');
      await refreshLocal();
      showSuccess('Error correction recorded');
    } catch (e) {
      logError(e, 'Error Correction');
      showError(e, 'Failed to record error correction');
    }
  }

  async function saveAdministrationRecord(bypassPrnLimit?: boolean, bypassOutOfStockPrompt?: boolean) {
    setAdminSaveBlockReason('');
    const recordsToSave = adminRecordsBatch.length > 0
      ? adminRecordsBatch
      : (adminRecord ? [adminRecord] : []);
    const outOfStockRecordedMeds = new Set<string>();

    const blockAdministrationSave = (title: string, message: string) => {
      setAdminSaveBlockReason(message);
      Alert.alert(title, message);
    };

    const getNumericStock = (med?: Medication): number | undefined => {
      if (!med) return undefined;
      const rawStock = (med as any).stock;
      const numericStock = typeof rawStock === 'number' ? rawStock : parseFloat(String(rawStock));
      return Number.isFinite(numericStock) ? numericStock : undefined;
    };

    if (recordsToSave.length === 0 || !adminStatus || !locationId || !localClient) {
      blockAdministrationSave(
        'Cannot Save',
        recordsToSave.length === 0
          ? 'No medication entries were selected to save.'
          : !adminStatus
            ? 'Please choose a status before saving (Given, Not Given, or Third Party).'
            : 'Required client or location details are missing. Please close and reopen this form, then try again.'
      );
      return;
    }
    
    try {
      if (adminStatus === 'given' || adminStatus === 'third-party') {
        const showStockReviewWarnings = adminEntrySource === 'timeline';
        const shouldApplyStockDeduction =
          adminStatus === 'given' || (adminStatus === 'third-party' && adminThirdPartyStockHandling === 'own-stock');

        const inferAdministrationQuantity = (med?: Medication): number | undefined => {
          if (!med) return undefined;
          const totalDose = parseFloat(String(med.totalDose || ''));
          const dosePerTablet = parseFloat(String(med.dosePerTablet || ''));
          if (Number.isFinite(totalDose) && Number.isFinite(dosePerTablet) && dosePerTablet > 0) {
            return totalDose / dosePerTablet;
          }
          return 1;
        };

        const medicationRoute = (localClient?.medications?.find(m => m.id === recordsToSave[0]?.medId)?.route || '').toLowerCase();
        const requiresTabletCount = medicationRoute.includes('tablet') || medicationRoute.includes('capsule');
        const isMultiRecordMode = recordsToSave.length > 1;
        const requireQuantityInput =
          !isMultiRecordMode && (
            adminStatus === 'given'
              ? requiresTabletCount
              : (adminStatus === 'third-party' && requiresTabletCount && adminThirdPartyStockHandling === 'own-stock')
          );
        const parsedTabletsGiven = parseFloat(adminTabletsGiven);
        const enteredQuantity = Number.isFinite(parsedTabletsGiven) ? parsedTabletsGiven : undefined;
        // Validate quantity only for tablet/capsule routes.
        if (requireQuantityInput && !adminTabletsGiven) {
          blockAdministrationSave('Validation', 'Please enter the number of tablets/capsules given');
          return;
        }
        if (requireQuantityInput && !Number.isFinite(parsedTabletsGiven)) {
          blockAdministrationSave('Validation', 'Please enter a valid number for tablets/capsules given');
          return;
        }

        if (adminStatus === 'third-party' && !administeredBy.trim()) {
          blockAdministrationSave('Validation', 'Please enter who administered the medication');
          return;
        }

        if (adminStatus === 'third-party' && !adminThirdPartyStockHandling) {
          blockAdministrationSave('Validation', 'Please select one stock handling option for third-party administration');
          return;
        }

        const requiresOutOfStockAcknowledgement =
          adminStatus === 'given' || (adminStatus === 'third-party' && adminThirdPartyStockHandling === 'own-stock');

        if (requiresOutOfStockAcknowledgement && !bypassOutOfStockPrompt) {
          const freshData = await loadData();
          const freshLoc = freshData.find(l => l.id === locationId);
          const freshClient = freshLoc?.clients.find(c => c.id === localClient.id);
          const outOfStockNow = new Set<string>();

          for (const recordToSave of recordsToSave) {
            const med = freshClient?.medications?.find(m => m.id === recordToSave.medId)
              || localClient.medications?.find(m => m.id === recordToSave.medId);
            const stock = getNumericStock(med);
            if (typeof stock === 'number' && stock <= 0 && med?.name) {
              outOfStockNow.add(med.name);
            }
          }

          if (outOfStockNow.size > 0) {
            const medNames = Array.from(outOfStockNow).join(', ');
            setOutOfStockReviewMessage(
              `This medication is out of stock in the system (${medNames}). Please review Stock Management and conduct a medication count.`
            );
            setPendingOutOfStockBypassPrn(bypassPrnLimit);
            setShowOutOfStockReviewPrompt(true);
            return;
          }
        }

        // Validate actual time only for direct "given" entries (not third-party).
        if (adminStatus === 'given') {
          if (isMultiRecordMode) {
            for (const rec of recordsToSave) {
              const recordKey = `${rec.medId}::${rec.time}`;
              const recordActualTime = adminActualTimesByKey[recordKey];
              if (!recordActualTime) {
                blockAdministrationSave('Validation', 'Please record the actual date/time for each selected medication.');
                return;
              }

              const actualGivenMs = new Date(recordActualTime).getTime();
              if (Number.isNaN(actualGivenMs)) {
                blockAdministrationSave('Validation', 'One or more selected administration date/time values are invalid.');
                return;
              }
              if (actualGivenMs > Date.now()) {
                blockAdministrationSave('Cannot Record Future Administration', 'The given time cannot be in the future. Please select the current time or an earlier time.');
                return;
              }
            }
          } else {
            if (!adminActualTime) {
              blockAdministrationSave('Validation', 'Please record the actual time the medication was given');
              return;
            }

            // Do not allow recording a given administration in the future.
            const actualGivenMs = new Date(adminActualTime).getTime();
            if (Number.isNaN(actualGivenMs)) {
              blockAdministrationSave('Validation', 'The recorded administration date/time is invalid');
              return;
            }
            if (actualGivenMs > Date.now()) {
              blockAdministrationSave('Cannot Record Future Administration', 'The given time cannot be in the future. Please select the current time or an earlier time.');
              return;
            }
          }
        }

        // Enforce PRN limits (max per day and minimum hours apart)
        const warnedOutOfStock = new Set<string>();
        const warnedLowStock = new Set<string>();
        const showPrnLimitAlert = (message: string) => {
          setAdminSaveBlockReason(message);
          Alert.alert(
            'PRN Dose Limit',
            message,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Record Anyway',
                onPress: () => {
                  saveAdministrationRecord(true, bypassOutOfStockPrompt);
                }
              }
            ]
          );
        };
        for (const recordToSave of recordsToSave) {
          const recordKey = `${recordToSave.medId}::${recordToSave.time}`;
          const actualTimeForRecord =
            adminStatus === 'given'
              ? (isMultiRecordMode ? adminActualTimesByKey[recordKey] : adminActualTime)
              : undefined;
          const freshData = await loadData();

          const freshLoc = freshData.find(l => l.id === locationId);
          const freshClient = freshLoc?.clients.find(c => c.id === localClient.id);
          const prnMed = freshClient?.medications?.find(m => m.id === recordToSave.medId) || localClient.medications?.find(m => m.id === recordToSave.medId);
          const stockAtRecordTime = getNumericStock(prnMed);
          if (typeof stockAtRecordTime === 'number' && stockAtRecordTime <= 0 && prnMed?.name) {
            outOfStockRecordedMeds.add(prnMed.name);
          }
          const quantityForThisRecord =
            adminStatus === 'third-party'
              ? (adminThirdPartyStockHandling === 'own-stock' ? enteredQuantity : undefined)
              : (enteredQuantity ?? inferAdministrationQuantity(prnMed));

          if (
            prnMed &&
            typeof enteredQuantity === 'number' &&
            Number.isFinite(enteredQuantity) &&
            enteredQuantity > 0
          ) {
            const outlinedTotalDose = parseFloat(String(prnMed.totalDose || ''));
            const outlinedDosePerTablet = parseFloat(String(prnMed.dosePerTablet || ''));
            if (
              Number.isFinite(outlinedTotalDose) &&
              Number.isFinite(outlinedDosePerTablet) &&
              outlinedDosePerTablet > 0
            ) {
              const outlinedTablets = outlinedTotalDose / outlinedDosePerTablet;
              const epsilon = 0.000001;
              if (enteredQuantity > outlinedTablets + epsilon) {
                blockAdministrationSave(
                  'Dose Exceeds Prescribed Amount',
                  `You entered ${enteredQuantity} tablets/capsules, but the outlined amount for this medication is ${outlinedTablets.toFixed(2).replace(/\.00$/, '')} per administration.`
                );
                return;
              }
            }
          }

          if (shouldApplyStockDeduction && showStockReviewWarnings) {
            const stock = getNumericStock(prnMed);
            if (typeof stock === 'number') {
              if (stock <= 0 && prnMed && !warnedOutOfStock.has(prnMed.name)) {
                warnedOutOfStock.add(prnMed.name);
                Alert.alert(
                  'Stock Review Notice',
                  `${prnMed.name} is marked out of stock. Stock records may be incorrect and should be reviewed.`
                );
              } else if (
                prnMed &&
                !warnedLowStock.has(prnMed.name) &&
                typeof quantityForThisRecord === 'number' &&
                Number.isFinite(quantityForThisRecord) &&
                quantityForThisRecord > 0
              ) {
                const parsedTotalDose = parseFloat(String(prnMed.totalDose || ''));
                const parsedDosePerTablet = parseFloat(String(prnMed.dosePerTablet || ''));
                const outlinedQuantity =
                  Number.isFinite(parsedTotalDose) && Number.isFinite(parsedDosePerTablet) && parsedDosePerTablet > 0
                    ? (parsedTotalDose / parsedDosePerTablet)
                    : quantityForThisRecord;
                const epsilon = 0.000001;
                if (stock <= outlinedQuantity + epsilon) {
                  warnedLowStock.add(prnMed.name);
                  Alert.alert(
                    'Stock Review Notice',
                    `${prnMed.name} is low in stock. Only one outlined dose remains (${outlinedQuantity.toFixed(2).replace(/\.00$/, '')} units). Stock records should be reviewed.`
                  );
                }
              }
            }
          }

          if (prnMed?.prn && !bypassPrnLimit) {
            const parsedNewTimeMs = parseDateTimeFlexibleMs(actualTimeForRecord || recordToSave.time);
            const newTimeMs = typeof parsedNewTimeMs === 'number' ? parsedNewTimeMs : NaN;
            const tabletsGivenNowRaw = quantityForThisRecord ?? parseFloat(adminTabletsGiven);

            // Support both current and legacy PRN rule field names and string values.
            const parseRuleNumber = (...candidates: any[]): number | undefined => {
              for (const candidate of candidates) {
                const parsed = Number.parseFloat(String(candidate ?? ''));
                if (Number.isFinite(parsed) && parsed > 0) return parsed;
              }
              return undefined;
            };

            const minHoursBetweenFromKnown = parseRuleNumber(
              prnMed.prnVariableMinHoursBetween,
              (prnMed as any).minTimeBetweenDoses,
              (prnMed as any).prnMinHoursBetween,
              (prnMed as any).prnMinimumHoursBetween,
              (prnMed as any).prnMinimumHoursBetweenDoses
            );
            let minHoursBetween = minHoursBetweenFromKnown;
            if (!minHoursBetween && prnMed) {
              const dynamicMinHourKeys = Object.keys(prnMed as any).filter(k => {
                const key = k.toLowerCase();
                return key.includes('prn') && key.includes('min') && key.includes('hour');
              });
              for (const key of dynamicMinHourKeys) {
                const parsed = parseRuleNumber((prnMed as any)[key]);
                if (parsed) {
                  minHoursBetween = parsed;
                  break;
                }
              }
            }
            const maxDosePerAdministration = parseRuleNumber(
              prnMed.prnVariableMaxDosePerAdministration,
              (prnMed as any).maxDosePerAdministration,
              (prnMed as any).prnMaxDosePerAdministration
            );
            const maxDosePer24Hours = parseRuleNumber(
              prnMed.prnVariableMaxDosePer24Hours,
              (prnMed as any).prnVariableMaxDosesIn24h,
              (prnMed as any).maxDosePer24Hours,
              (prnMed as any).prnMaxDosePer24Hours
            );
            const tabletsGivenNow =
              typeof tabletsGivenNowRaw === 'number' && Number.isFinite(tabletsGivenNowRaw) && tabletsGivenNowRaw > 0
                ? tabletsGivenNowRaw
                : (inferAdministrationQuantity(prnMed) || 0);

            if (!isNaN(newTimeMs)) {
              const givenRecords = (prnMed.administrationRecords || []).filter(r => r.status === 'given');
              const recordTimes = givenRecords
                .map(r => parseDateTimeFlexibleMs(r.actualTime || r.time))
                .filter((t): t is number => typeof t === 'number' && !Number.isNaN(t));

              if (minHoursBetween || maxDosePerAdministration || maxDosePer24Hours) {
                if (maxDosePerAdministration && tabletsGivenNow > maxDosePerAdministration) {
                  const msg = `${prnMed.name} cannot exceed ${maxDosePerAdministration} tablet${maxDosePerAdministration === 1 ? '' : 's'} per administration. You entered ${tabletsGivenNow} tablet${tabletsGivenNow === 1 ? '' : 's'}.`;
                  showPrnLimitAlert(msg);
                  return;
                }

                if (minHoursBetween && recordTimes.length > 0) {
                  const lastTimeMs = Math.max(...recordTimes);
                  const timeSinceLastMs = newTimeMs - lastTimeMs;
                  const hoursSinceLast = timeSinceLastMs / (1000 * 60 * 60);

                  if (hoursSinceLast < minHoursBetween) {
                    const msg = `${prnMed.name} doses must be at least ${minHoursBetween} hour${minHoursBetween === 1 ? '' : 's'} apart. The last dose was ${hoursSinceLast.toFixed(1)} hour${hoursSinceLast.toFixed(1) === '1.0' ? '' : 's'} ago.`;
                    showPrnLimitAlert(msg);
                    return;
                  }
                }

                if (maxDosePer24Hours) {
                  const twentyFourHoursAgo = newTimeMs - (24 * 60 * 60 * 1000);
                  const recentRecords = givenRecords.filter(r => {
                    const recTime = parseDateTimeFlexibleMs(r.actualTime || r.time);
                    return typeof recTime === 'number' && !Number.isNaN(recTime) && recTime >= twentyFourHoursAgo;
                  });

                  let tabletsInLast24Hours = 0;
                  for (let i = 0; i < recentRecords.length; i += 1) {
                    const recMed = prnMed;
                    if (recMed.totalDose && recMed.dosePerTablet) {
                      const calculated = parseFloat(recMed.totalDose) / parseFloat(recMed.dosePerTablet);
                      if (!isNaN(calculated) && isFinite(calculated)) {
                        tabletsInLast24Hours += calculated;
                      }
                    }
                  }

                  const totalAfterThisDose = tabletsInLast24Hours + tabletsGivenNow;

                  if (totalAfterThisDose > maxDosePer24Hours) {
                    const msg = `${prnMed.name} cannot exceed ${maxDosePer24Hours} tablet${maxDosePer24Hours === 1 ? '' : 's'} in 24 hours. Currently ${tabletsInLast24Hours} tablet${tabletsInLast24Hours === 1 ? '' : 's'} have been given in the last 24 hours. This dose would bring the total to ${totalAfterThisDose} tablet${totalAfterThisDose === 1 ? '' : 's'}.`;
                    showPrnLimitAlert(msg);
                    return;
                  }
                }
              }
            }
          }

          await addAdministrationRecord(
            locationId,
            localClient.id,
            recordToSave.medId,
            recordToSave.time,
            'given',
            actualTimeForRecord,
            undefined,
            quantityForThisRecord
          );

          const data = await loadData();
          const loc = data.find(l => l.id === locationId);
          const client = loc?.clients.find(c => c.id === localClient.id);
          const med = client?.medications?.find(m => m.id === recordToSave.medId);

          const shouldDeductStock =
            adminStatus === 'given' || (adminStatus === 'third-party' && adminThirdPartyStockHandling === 'own-stock');

          if (shouldDeductStock && med && med.stock !== undefined && med.stock > 0) {
            const quantityToDeduct = quantityForThisRecord;
            if (typeof quantityToDeduct === 'number' && Number.isFinite(quantityToDeduct) && quantityToDeduct > 0) {
              const updatedMed = { ...med, stock: Math.max(0, med.stock - quantityToDeduct) };
              await updateMedication(locationId, localClient.id, updatedMed);
            }
          }
        }
      } else {
        const selectedReason = notGivenReason === 'other' ? otherReason : notGivenReason;
        const reason = (selectedReason || 'not specified').trim();

        for (const recordToSave of recordsToSave) {
          const medAtRecordTime = localClient.medications?.find(m => m.id === recordToSave.medId);
          const stockAtRecordTime = getNumericStock(medAtRecordTime);
          if (typeof stockAtRecordTime === 'number' && stockAtRecordTime <= 0 && medAtRecordTime?.name) {
            outOfStockRecordedMeds.add(medAtRecordTime.name);
          }

          const scheduledTime = new Date(recordToSave.time).toLocaleString();
          const markedTime = new Date().toLocaleString();
          const detailedReason = [
            `Reason: ${reason}`,
            `Marked as not given: ${markedTime}`,
            `Originally scheduled: ${scheduledTime}`,
            `Scheduled slot: ${getSlotNameFromTime(recordToSave.time)}`
          ].join(' | ');
          await addAdministrationRecord(locationId, localClient.id, recordToSave.medId, recordToSave.time, 'missed', undefined, detailedReason);
        }
      }
      
      // Clear all state
      setRecordingAdmin(false);
      setAdminRecord(null);
      setAdminRecordsBatch([]);
      setAdminStatus(null);
      setNotGivenReason('');
      setOtherReason('');
      setAdministeredBy('');
      setAdminScheduledTime('');
      setAdminActualTime('');
      setAdminActualTimesByKey({});
      setAdminTabletsGiven('');
      setAdminThirdPartyStockHandling('already-transferred');
      setAdminNotes('');
      setSelectedTimelineItems([]);
      setAdminSaveBlockReason('');
      
      // Refresh data from storage
      await refreshLocal();

      const shouldPromptStockReview =
        outOfStockRecordedMeds.size > 0 ||
        (adminStatus === 'not-given' && notGivenReason === 'out-of-stock');

      const successMessage =
        recordsToSave.length > 1
          ? `${recordsToSave.length} medications recorded successfully`
          : 'Medication recorded successfully';

      if (shouldPromptStockReview) {
        const medNames = Array.from(outOfStockRecordedMeds).join(', ');
        const medSuffix = medNames ? ` (${medNames})` : '';
        Alert.alert(
          'Stock Review Required',
          `You recorded an administration for out-of-stock medication${medSuffix}. Please review Stock Management and conduct a medication count.`,
          [
            {
              text: 'OK',
              onPress: () => showSuccess(successMessage),
            },
          ]
        );
      } else {
        showSuccess(successMessage);
      }
    } catch (e) {
      logError(e, 'Save Administration Record');
      setAdminSaveBlockReason('Failed to record administration. Please review the details and try again.');
      showError(e, 'Failed to record administration');
    }
  }

  function downloadSummary() {
    if (!localClient) return;
    
    // Extract receipts from administration records
    const receipts: { index: number; base64: string }[] = [];
    let receiptIndex = 0;
    
    (localClient.medications || []).forEach(m => {
      (m.administrationRecords || []).forEach(r => {
        if (r.reason && r.reason.includes('Receipt: data:image')) {
          const receiptMatch = r.reason.match(/Receipt: (data:image\/[^|]+)/);
          if (receiptMatch) {
            receipts.push({ index: receiptIndex++, base64: receiptMatch[1] });
          }
        }
      });
    });
    
    (localClient.archivedMedicationHistory || []).forEach(archived => {
      (archived.records || []).forEach(r => {
        if (r.reason && r.reason.includes('Receipt: data:image')) {
          const receiptMatch = r.reason.match(/Receipt: (data:image\/[^|]+)/);
          if (receiptMatch) {
            receipts.push({ index: receiptIndex++, base64: receiptMatch[1] });
          }
        }
      });
    });
    
    const rows: string[] = [];
    const now = new Date();
    const generatedDate = now.toLocaleString();
    
    // Header section: Client Information
    rows.push('MEDICATION SUMMARY REPORT');
    rows.push('');
    rows.push(`Generated: ${generatedDate}`);
    rows.push('');
    rows.push('CLIENT INFORMATION');
    rows.push(`Name,${localClient.name}`);
    rows.push(`Date of Birth,${localClient.dob || 'N/A'}`);
    rows.push(`Gender,${localClient.gender || 'N/A'}`);
    rows.push(`Weight,${localClient.weight || 'N/A'}`);
    rows.push(`Contact Email,${localClient.contactEmail || 'N/A'}`);
    rows.push(`Allergies,${localClient.allergies || 'None'}`);
    rows.push('');
    
    // Medication statistics
    const totalMeds = localClient.medications?.length || 0;
    const prnMeds = (localClient.medications || []).filter(m => m.prn).length;
    const scheduledMeds = totalMeds - prnMeds;
    rows.push('MEDICATION STATISTICS');
    rows.push(`Total Medications,${totalMeds}`);
    rows.push(`Scheduled Medications,${scheduledMeds}`);
    rows.push(`PRN Medications,${prnMeds}`);
    rows.push('');
    
    // Current medications
    rows.push('CURRENT MEDICATIONS');
    rows.push('Medication,Total Dose,Route,Type,Stock,Start Date,End Date,Scheduled Times,Notes');
    (localClient.medications || []).forEach(m => {
      const type = m.prn ? 'PRN' : 'Scheduled';
      const stock = m.stock !== undefined ? m.stock : 'N/A';
      const startDate = m.startTime ? new Date(m.startTime).toLocaleDateString() : '';
      const endDate = m.endTime ? new Date(m.endTime).toLocaleDateString() : 'Ongoing';
      const scheduledTimes = (m.scheduledTimes || []).map(t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })).join('; ') || 'N/A';
      const notes = m.notes ? m.notes.replace(/"/g, '""') : '';
      const line = `"${m.name.replace(/"/g, '""')}","${m.totalDose || ''}","${m.route || ''}","${type}","${stock}","${startDate}","${endDate}","${scheduledTimes}","${notes}"`;
      rows.push(line);
    });
    rows.push('');
    
    // Administration records
    rows.push('ADMINISTRATION RECORDS');
    rows.push('Medication,Scheduled Time,Actual Time,Status,Timing,Reason,Notes');
    const allRecords: { medName: string; time: string; actualTime?: string; status: string; reason?: string }[] = [];
    (localClient.medications || []).forEach(m => {
      (m.administrationRecords || []).forEach(r => {
        allRecords.push({ medName: m.name, time: r.time, actualTime: r.actualTime, status: r.status, reason: r.reason });
      });
    });
    (localClient.archivedMedicationHistory || []).forEach(archived => {
      (archived.records || []).forEach(r => {
        allRecords.push({ medName: archived.medName, time: r.time, actualTime: r.actualTime, status: r.status, reason: r.reason });
      });
    });
    allRecords.sort((a, b) => new Date(b.actualTime || b.time).getTime() - new Date(a.actualTime || a.time).getTime());
    
    allRecords.forEach(r => {
      const scheduled = new Date(r.time).toLocaleString();
      const actual = r.actualTime ? new Date(r.actualTime).toLocaleString() : '';
      let timing = '';
      if (r.status === 'given' && r.actualTime) {
        const diffMinutes = (new Date(r.actualTime).getTime() - new Date(r.time).getTime()) / (1000 * 60);
        timing = diffMinutes <= 15 ? 'On Time' : `Late (${Math.round(diffMinutes)} min)`;
      }
      const reason = r.reason ? r.reason.replace(/"/g, '""') : '';
      const line = `"${r.medName.replace(/"/g, '""')}","${scheduled}","${actual}","${r.status}","${timing}","${reason}",""`;
      rows.push(line);
    });
    
    const csv = rows.join('\n');
    
    try {
      // Create zip file with CSV and receipts
      const zip = new JSZip();
      const dateStr = new Date().toISOString().split('T')[0];
      const folderName = `${localClient.name}Medication record ${dateStr}`;
      const folder = zip.folder(folderName);
      
      if (!folder) throw new Error('Failed to create folder in zip');
      
      // Add CSV to folder
      folder.file('medication-summary.csv', csv);
      
      // Add receipts to folder
      receipts.forEach((receipt, idx) => {
        try {
          // Convert base64 to blob
          const arr = receipt.base64.split(',');
          const bstr = atob(arr[1]);
          const n = bstr.length;
          const u8arr = new Uint8Array(n);
          for (let i = 0; i < n; i++) {
            u8arr[i] = bstr.charCodeAt(i);
          }
          folder.file(`receipt_${idx + 1}.jpg`, u8arr);
        } catch (e) {
          console.error(`Error processing receipt ${idx + 1}:`, e);
        }
      });
      
      // Generate and download zip
      zip.generateAsync({ type: 'blob' }).then((blob: Blob) => {
        if (typeof window !== 'undefined' && window.navigator && (window.navigator as any).msSaveOrOpenBlob) {
          (window.navigator as any).msSaveOrOpenBlob(blob, `${folderName}.zip`);
        } else if (typeof document !== 'undefined') {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${folderName}.zip`;
          a.click();
          URL.revokeObjectURL(url);
        }
        showSuccess('Summary downloaded successfully');
      });
    } catch (e) {
      logError(e, 'Download Summary');
      showError(e, 'Failed to generate summary');
    }
  }

  function collectAllHistoryRecords() {
    if (!localClient) return [] as { medName: string; time: string; actualTime?: string; status: string; reason?: string }[];
    const allRecords: { medName: string; time: string; actualTime?: string; status: string; reason?: string }[] = [];
    (localClient.medications || []).forEach(m => {
      (m.administrationRecords || []).forEach(r => {
        allRecords.push({ medName: m.name, time: r.time, actualTime: r.actualTime, status: r.status, reason: r.reason });
      });
    });
    (localClient.archivedMedicationHistory || []).forEach(archived => {
      (archived.records || []).forEach(r => {
        allRecords.push({ medName: archived.medName, time: r.time, actualTime: r.actualTime, status: r.status, reason: r.reason });
      });
    });
    allRecords.sort((a, b) => new Date(b.actualTime || b.time).getTime() - new Date(a.actualTime || a.time).getTime());
    return allRecords;
  }

  function sanitizePdfText(value: string): string {
    return value
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
      .replace(/[\u0000-\u001F]/g, ' ')
      .replace(/[\u0080-\uFFFF]/g, '?');
  }

  function buildSimplePdf(lines: string[]): Blob {
    const escapePdf = (text: string) => sanitizePdfText(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const textCmd = (text: string, size: number, x: number, y: number, r: number, g: number, b: number) => (
      `BT /F1 ${size} Tf ${r} ${g} ${b} rg ${x} ${y} Td (${escapePdf(text)}) Tj ET`
    );
    const rectCmd = (r: number, g: number, b: number, x: number, y: number, w: number, h: number) => (
      `${r} ${g} ${b} rg ${x} ${y} ${w} ${h} re f`
    );
    const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
      const approxCharWidth = fontSize * 0.52;
      const maxChars = Math.max(12, Math.floor(maxWidth / approxCharWidth));
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length === 0) return [''];

      const wrapped: string[] = [];
      let current = '';
      words.forEach(word => {
        if (word.length > maxChars) {
          if (current) {
            wrapped.push(current);
            current = '';
          }
          for (let i = 0; i < word.length; i += maxChars) {
            wrapped.push(word.slice(i, i + maxChars));
          }
          return;
        }
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= maxChars) {
          current = candidate;
        } else {
          if (current) wrapped.push(current);
          current = word;
        }
      });
      if (current) wrapped.push(current);
      return wrapped;
    };

    const sourceLines = lines.length > 0 ? lines : ['No data available'];
    const titleLine = sanitizePdfText(sourceLines.find(l => l.trim()) || 'Medication Summary Report');
    const bodyLines = sourceLines[0]?.trim() ? sourceLines.slice(1) : sourceLines;
    const margin = 40;
    const pageWidth = 612;
    const pageHeight = 842;
    const contentWidth = pageWidth - (margin * 2);
    const minY = 52;
    const pages: string[] = [];
    let pageNumber = 1;
    let currentY = 0;
    let commands: string[] = [];

    const startPage = () => {
      commands = [];
      commands.push(rectCmd(0.99, 0.995, 1, 0, 0, pageWidth, pageHeight));
      commands.push(rectCmd(0.11, 0.39, 0.86, 0, 782, pageWidth, 60));
      commands.push(textCmd(titleLine, 16, margin, 806, 1, 1, 1));
      commands.push(textCmd(`Page ${pageNumber}`, 10, pageWidth - 88, 808, 0.9, 0.96, 1));
      currentY = 760;
    };

    const finalizePage = () => {
      commands.push(rectCmd(0.87, 0.91, 0.96, margin, 35, contentWidth, 1));
      commands.push(textCmd('Generated by MedSuccess', 9, margin, 20, 0.45, 0.5, 0.58));
      pages.push(commands.join('\n'));
      pageNumber += 1;
    };

    const ensureSpace = (requiredHeight: number) => {
      if (currentY - requiredHeight < minY) {
        finalizePage();
        startPage();
      }
    };

    startPage();

    bodyLines.forEach(rawLine => {
      const line = sanitizePdfText(rawLine || '');
      const trimmed = line.trim();
      if (!trimmed) {
        currentY -= 8;
        return;
      }

      const isSectionHeader = /^[A-Z][A-Z0-9\s():-]{3,}$/.test(trimmed) && !/^Generated:/i.test(trimmed);
      if (isSectionHeader) {
        ensureSpace(28);
        commands.push(rectCmd(0.9, 0.95, 1, margin, currentY - 14, contentWidth, 20));
        commands.push(textCmd(trimmed, 11, margin + 8, currentY - 1, 0.11, 0.32, 0.66));
        currentY -= 28;
        return;
      }

      let fontSize = 10;
      let color: [number, number, number] = [0.2, 0.24, 0.29];
      let indent = 0;
      if (/^Generated:/i.test(trimmed)) {
        fontSize = 10;
        color = [0.44, 0.5, 0.58];
      } else if (/^\d+\./.test(trimmed)) {
        fontSize = 10.5;
        color = [0.12, 0.18, 0.25];
      } else if (/^(Details:|Scheduled:|Actual:|Reason\/Notes:)/i.test(trimmed)) {
        fontSize = 9.5;
        indent = 16;
        color = [0.35, 0.4, 0.48];
      }

      const wrapped = wrapText(trimmed, contentWidth - indent, fontSize);
      const lineHeight = Math.max(12, Math.round(fontSize + 2));
      ensureSpace((wrapped.length * lineHeight) + 2);
      wrapped.forEach(chunk => {
        commands.push(textCmd(chunk, fontSize, margin + indent, currentY, color[0], color[1], color[2]));
        currentY -= lineHeight;
      });
    });

    finalizePage();

    const objects: string[] = [];
    const addObject = (obj: string) => {
      objects.push(obj);
      return objects.length;
    };

    const catalogObj = addObject('<< /Type /Catalog /Pages 2 0 R >>');
    const pagesObj = addObject('<< /Type /Pages /Kids [] /Count 0 >>');
    const pageCount = pages.length;
    const firstPageObjNum = 3;
    const fontObjNum = firstPageObjNum + pageCount * 2;
    const pageRefs: string[] = [];

    pages.forEach((stream, pageIndex) => {
      const pageObjNum = firstPageObjNum + pageIndex * 2;
      const contentObjNum = pageObjNum + 1;
      pageRefs.push(`${pageObjNum} 0 R`);
      const streamLen = new TextEncoder().encode(stream).length;

      addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> /Contents ${contentObjNum} 0 R >>`);
      addObject(`<< /Length ${streamLen} >>\nstream\n${stream}\nendstream`);
    });

    addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    objects[pagesObj - 1] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageCount} >>`;

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    objects.forEach((obj, idx) => {
      offsets.push(new TextEncoder().encode(pdf).length);
      pdf += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
    });

    const xrefOffset = new TextEncoder().encode(pdf).length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i <= objects.length; i++) {
      pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new Blob([pdf], { type: 'application/pdf' });
  }

  function downloadSevenDayHistoryPdf() {
    if (!localClient) return;
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const records = collectAllHistoryRecords().filter(r => {
      const eventTime = new Date(r.actualTime || r.time).getTime();
      return !Number.isNaN(eventTime) && eventTime >= sevenDaysAgo;
    });

    const stockEvents = records.filter(r => r.status === 'stock-adjustment' || /stock/i.test(r.reason || '') || r.status === 'created');

    const lines: string[] = [];
    lines.push('MEDICATION SUMMARY REPORT (LAST 7 DAYS)');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');
    lines.push('CLIENT IDENTIFICATION');
    lines.push(`Name: ${localClient.name}`);
    lines.push(`Date of Birth: ${localClient.dob || 'N/A'}`);
    lines.push(`Gender: ${localClient.gender || 'N/A'}`);
    lines.push(`Medicare Number: ${localClient.medicareNumber || 'N/A'}`);
    lines.push(`Contact Email: ${localClient.contactEmail || 'N/A'}`);
    lines.push(`Allergies: ${localClient.allergies || 'None listed'}`);
    lines.push('');
    lines.push(`Total events in last 7 days: ${records.length}`);
    lines.push(`Stock management events: ${stockEvents.length}`);
    lines.push('');
    lines.push('STOCK MANAGEMENT EVENTS');
    if (stockEvents.length === 0) {
      lines.push('No stock management events recorded in this period.');
    } else {
      stockEvents.forEach((r, idx) => {
        lines.push(`${idx + 1}. ${new Date(r.actualTime || r.time).toLocaleString()} | ${r.medName} | ${r.status}`);
        if (r.reason) lines.push(`   Details: ${r.reason}`);
      });
    }
    lines.push('');
    lines.push('ADMINISTRATION HISTORY (LAST 7 DAYS)');
    if (records.length === 0) {
      lines.push('No administration records for this period.');
    } else {
      records.forEach((r, idx) => {
        lines.push(`${idx + 1}. ${new Date(r.actualTime || r.time).toLocaleString()} | ${r.medName} | ${r.status}`);
        lines.push(`   Scheduled: ${new Date(r.time).toLocaleString()}`);
        if (r.actualTime) lines.push(`   Actual: ${new Date(r.actualTime).toLocaleString()}`);
        if (r.reason) lines.push(`   Reason/Notes: ${r.reason}`);
      });
    }

    try {
      const blob = buildSimplePdf(lines);
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `${localClient.name}-7-day-history-${dateStr}.pdf`;
      if (typeof window !== 'undefined' && window.navigator && (window.navigator as any).msSaveOrOpenBlob) {
        (window.navigator as any).msSaveOrOpenBlob(blob, fileName);
      } else if (typeof document !== 'undefined') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
      showSuccess('7 day PDF summary downloaded successfully');
    } catch (e) {
      logError(e, 'Download 7 Day PDF Summary');
      showError(e, 'Failed to generate 7 day PDF summary');
    }
  }

  function downloadHistoryCsv(): boolean {
    if (!localClient) return false;
    const rows: string[] = [];
    rows.push('Medication,Status,ScheduledTime,ActualTime,Reason');
    const records: { medName: string; time: string; status: string; actualTime?: string; reason?: string }[] = [];
    (localClient.medications || []).forEach(m => {
      (m.administrationRecords || []).forEach(r =>
        records.push({ medName: m.name, time: r.time, status: r.status, actualTime: r.actualTime, reason: r.reason })
      );
    });
    (localClient.archivedMedicationHistory || []).forEach(archived => {
      (archived.records || []).forEach(r =>
        records.push({ medName: archived.medName, time: r.time, status: r.status, actualTime: r.actualTime, reason: r.reason })
      );
    });
    records.sort((a, b) => new Date(b.actualTime || b.time).getTime() - new Date(a.actualTime || a.time).getTime());
    records.forEach(r => {
      const scheduled = new Date(r.time).toLocaleString();
      const actual = r.actualTime ? new Date(r.actualTime).toLocaleString() : '';
      const reason = r.reason ? r.reason.replace(/"/g, '""') : '';
      const line = `"${r.medName.replace(/"/g, '""')}","${r.status}","${scheduled}","${actual}","${reason}"`;
      rows.push(line);
    });
    const csv = rows.join('\n');
    try {
      if (typeof window !== 'undefined' && window.navigator && (window.navigator as any).msSaveOrOpenBlob) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        (window.navigator as any).msSaveOrOpenBlob(blob, `${localClient.name}-history.csv`);
      } else if (typeof document !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${localClient.name}-history.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert('History', csv);
      }
      return true;
    } catch (e) {
      logError(e, 'Download History');
      showError(e, 'Failed to download history');
      return false;
    }
  }

  async function handleDeleteClient() {
    if (!locationId || !localClient) return;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const proceed = window.confirm('Deleting a client requires downloading their history first. Proceed to download and delete?');
      if (!proceed) return;
      const downloaded = downloadHistoryCsv();
      if (!downloaded) return;
      try {
        await deleteClient(locationId, localClient.id);
        setEditingClient(false);
        setLocalClient(null);
        if (onClientUpdated) onClientUpdated();
        if (typeof window.alert === 'function') {
          window.alert('Client was deleted');
        }
      } catch (e) {
        if (typeof window.alert === 'function') {
          window.alert('Failed to delete client');
        }
      }
      return;
    }
    Alert.alert(
      'Delete Client',
      'Deleting a client requires downloading their history first. Proceed to download and delete?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download History & Delete',
          style: 'destructive',
          onPress: async () => {
            const downloaded = downloadHistoryCsv();
            if (!downloaded) return;
            try {
              await deleteClient(locationId, localClient.id);
              setEditingClient(false);
              setLocalClient(null);
              if (onClientUpdated) onClientUpdated();
              showSuccess('Client was deleted');
            } catch (e) {
              logError(e, 'Delete Client');
              showError(e, 'Failed to delete client');
            }
          }
        }
      ]
    );
  }

  if (!localClient) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Select a client to view details</Text>
      </View>
    );
  }

  const meds = (localClient.medications || []).sort((a, b) => {
    if (a.prn === b.prn) return 0;
    return a.prn ? -1 : 1;
  });

  const selectedTimelineKeys = new Set(selectedTimelineItems.map(item => `${item.medId}::${item.time}`));

  function toggleTimelineMultiSelect(item: TimelineSelectableItem) {
    if (!localClient) return;

    const status = getAdministrationStatus(item.medId, item.time, item.med);
    if (status === 'given') return;

    if (selectedTimelineClientId && selectedTimelineClientId !== localClient.id) {
      setSelectedTimelineItems([]);
    }

    setSelectedTimelineClientId(localClient.id);
    const itemKey = `${item.medId}::${item.time}`;
    setSelectedTimelineItems(prev => {
      const exists = prev.some(selected => `${selected.medId}::${selected.time}` === itemKey);
      if (exists) {
        return prev.filter(selected => `${selected.medId}::${selected.time}` !== itemKey);
      }
      return [...prev, item];
    });
  }

  function openAdministrationForSelection() {
    if (selectedTimelineItems.length === 0) return;

    const sorted = [...selectedTimelineItems].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const first = sorted[0];

    let calculatedTablets = '';
    if (first.med.totalDose && first.med.dosePerTablet) {
      const calculated = parseFloat(first.med.totalDose) / parseFloat(first.med.dosePerTablet);
      if (!isNaN(calculated) && isFinite(calculated)) {
        calculatedTablets = calculated.toFixed(2);
      }
    }

    const formatCount = (value: number): string => {
      if (!Number.isFinite(value)) return '';
      return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
    };

    const getPresetDoseSummary = (med: Medication): string => {
      const totalDoseText = formatDoseWithUnit(med.totalDose, med.unit);
      const dosePerTablet = parseFloat(String(med.dosePerTablet || ''));
      const totalDose = parseFloat(String(med.totalDose || ''));
      const route = (med.route || '').toLowerCase();

      if (totalDoseText && Number.isFinite(totalDose) && Number.isFinite(dosePerTablet) && dosePerTablet > 0) {
        const quantity = totalDose / dosePerTablet;
        const perItemStrength = formatDoseWithUnit(String(dosePerTablet), med.unit);
        const itemLabel = route.includes('capsule') ? 'caps' : route.includes('tablet') ? 'tabs' : 'units';
        return `${totalDoseText} (${formatCount(quantity)}x ${perItemStrength} ${itemLabel})`;
      }

      return totalDoseText || 'Dose not set';
    };

    const batchRecords = sorted.map(record => ({
      medId: record.medId,
      time: record.time,
      medName: record.medName,
      presetDoseSummary: getPresetDoseSummary(record.med),
      dueDisplay: `${new Date(record.time).toLocaleDateString()} - ${getSlotNameFromTime(record.time)}`,
    }));
    setAdminRecordsBatch(batchRecords);
    setAdminRecord(batchRecords[0]);
    setAdminScheduledTime(sorted.length > 1 ? `${sorted.length} selected timeline entries` : getSlotNameFromTime(first.time));
    setAdminEntrySource('timeline');
    setAdminSaveBlockReason('');
    setRecordingAdmin(true);
    setAdminStatus(null);
    setAdminActualTime('');
    setAdminActualTimesByKey({});
    setAdminTabletsGiven(calculatedTablets);
    setAdminNotes('');
    setAdministeredBy('');
    setNotGivenReason('');
    setOtherReason('');
  }

  function handleTimelineRecord(item: TimelineSelectableItem) {
    const selectedMatch = selectedTimelineItems.find(selected => selected.medId === item.medId && selected.time === item.time);
    if (selectedTimelineItems.length > 1 && selectedMatch) {
      openAdministrationForSelection();
      return;
    }

    // Check if the medication at this time is already given
    const status = getAdministrationStatus(item.medId, item.time, item.med);
    
    if (status === 'given') {
      // Show error correction modal
      setErrorCorrectionRecord({ medId: item.medId, time: item.time, medName: item.medName });
      setErrorReason('');
      setErrorNotes('');
      setShowErrorCorrection(true);
    } else {
      // Show administration recording modal
      let calculatedTablets = '';
      if (item.med.totalDose && item.med.dosePerTablet) {
        const calculated = parseFloat(item.med.totalDose) / parseFloat(item.med.dosePerTablet);
        if (!isNaN(calculated) && isFinite(calculated)) {
          calculatedTablets = calculated.toFixed(2);
        }
      }

      setAdminRecord({ medId: item.medId, time: item.time, medName: item.medName });
      setAdminRecordsBatch([]);
      setAdminScheduledTime(getSlotNameFromTime(item.time));
      setAdminEntrySource('timeline');
      setAdminSaveBlockReason('');
      setRecordingAdmin(true);
      setAdminStatus(null);
      setAdminActualTime('');
      setAdminActualTimesByKey({});
      setAdminTabletsGiven(calculatedTablets);
      setAdminNotes('');
    }
  }

  function openAddMedicationWithAcknowledgement() {
    setShowAddMedicationPrompt(true);
  }

  return (
    <View style={styles.panel}>
      <View style={styles.clientHeader}>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{localClient.name}</Text>
          <View style={styles.clientMetaRow}>
            {localClient.dob && <Text style={styles.clientMeta}>📅 {localClient.dob}</Text>}
            {localClient.gender && <Text style={styles.clientMeta}>👤 {localClient.gender}</Text>}
            {localClient.weight && <Text style={styles.clientMeta}>⚖️ {localClient.weight}</Text>}
            {localClient.allergies && <Text style={styles.clientMeta}>⚠️ {localClient.allergies}</Text>}
            {localClient.gp && <Text style={styles.clientMeta}>🩺 GP: {localClient.gp}</Text>}
            {localClient.gpClinic && <Text style={styles.clientMeta}>🏥 GP Clinic: {localClient.gpClinic}</Text>}
            {localClient.medicareNumber && <Text style={styles.clientMeta}>💳 Medicare: {localClient.medicareNumber}</Text>}
          </View>
          {localClient.contactEmail && <Text style={styles.clientEmail}>📧 {localClient.contactEmail}</Text>}
        </View>
        <View style={styles.headerActionsRow}>
          <TouchableOpacity onPress={() => { setClientDraft({ name: localClient.name, dob: localClient.dob || '', allergies: localClient.allergies || '', additionalInfo: localClient.additionalInfo || '', gender: localClient.gender, weight: localClient.weight, contactEmail: localClient.contactEmail, gp: localClient.gp || '', gpClinic: localClient.gpClinic || '', medicareNumber: localClient.medicareNumber || '', photoUri: localClient.photoUri || '' }); setEditClientLocationId(locationId || ''); setEditingClient(true); }} style={[styles.headerAction, { marginRight: 8 }]}> 
            <Text style={styles.headerActionText}>Edit Client</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSummaryOptions(true)} style={[styles.headerAction, { marginRight: 8 }]}> 
            <Text style={styles.headerActionText}>Download Summary</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('StockManagement', { clientId: localClient.id, locationId, clientName: localClient.name })} style={[styles.headerAction, { marginRight: 8 }]}>
            <Text style={styles.headerActionText}>Stock Management</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openAddMedicationWithAcknowledgement} style={styles.headerAction}>
            <Text style={styles.headerActionText}>+ Add Med</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity onPress={() => setTab('medications')} style={[styles.tabButton, tab === 'medications' && styles.tabButtonActive]}>
          <Text style={[styles.tabText, tab === 'medications' && styles.tabTextActive]}>Medications</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('timeline')} style={[styles.tabButton, tab === 'timeline' && styles.tabButtonActive]}>
          <Text style={[styles.tabText, tab === 'timeline' && styles.tabTextActive]}>Timeline</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('history')} style={[styles.tabButton, tab === 'history' && styles.tabButtonActive]}>
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>History</Text>
        </TouchableOpacity>
      </View>

      {tab === 'medications' && (
        <FlatList
          data={meds}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.medList}
          renderItem={({ item }) => (
            <View style={styles.medRow}>
              <View style={styles.medInfo}>
                <Text style={styles.medName}>
                  {item.name}
                  {item.medicationPurpose ? (
                    <Text style={{ fontSize: 12, fontWeight: '500', color: '#64748b' }}>{` (${item.medicationPurpose})`}</Text>
                  ) : null}
                </Text>
                {Number.isFinite(Number.parseFloat(String(item.totalDose || '').trim())) ? (
                  <Text style={styles.medDetail}>Prescribed dose: {formatDoseWithUnit(item.totalDose, item.unit)}</Text>
                ) : null}
                {!!String(item.variableDoseInstructions || '').trim() ? (
                  <Text style={styles.medDetail}>Dose instructions: {String(item.variableDoseInstructions || '').trim()}</Text>
                ) : null}
                {item.dosePerTablet ? <Text style={styles.medDetail}>Per tablet: {formatDoseWithUnit(item.dosePerTablet, item.unit)}</Text> : null}
                {item.route ? <Text style={styles.medDetail}>{item.route}</Text> : null}
                {item.startTime && <Text style={styles.medTimeSmall}>📅 From: {new Date(item.startTime).toLocaleDateString()}</Text>}
                {item.endTime && <Text style={styles.medTimeSmall}>📅 Until: {new Date(item.endTime).toLocaleDateString()}</Text>}
                <Text style={styles.medTimeSmall}>{(item.scheduledTimes || []).map(t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })).join(', ')}</Text>
                {item.stock !== undefined && <Text style={styles.medTimeSmall}>📦 Stock: {item.stock}</Text>}
                {item.notes && <Text style={styles.medNotes}>💬 {item.notes}</Text>}
              </View>
              <View style={styles.medActions}>
                {item.prn ? (
                  <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: '#2e7d32' }]}
                    onPress={() => {
                      let calculatedTablets = '';
                      if (item.totalDose && item.dosePerTablet) {
                        const calculated = parseFloat(item.totalDose) / parseFloat(item.dosePerTablet);
                        if (!isNaN(calculated) && isFinite(calculated)) {
                          calculatedTablets = calculated.toFixed(2);
                        }
                      }

                      const nowIso = new Date().toISOString();
                      setAdminRecord({ medId: item.id, time: nowIso, medName: item.name });
                      setAdminRecordsBatch([]);
                      setAdminScheduledTime('PRN');
                      setAdminEntrySource('medications');
                      setAdminSaveBlockReason('');
                      setRecordingAdmin(true);
                      setAdminStatus('given');
                      setAdminActualTime('');
                      setAdminTabletsGiven(calculatedTablets);
                      setAdminNotes('');
                      setAdministeredBy('');
                      setNotGivenReason('');
                      setOtherReason('');
                    }}
                  >
                    <Text style={styles.smallButtonText}>Record Administration</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.smallButton} onPress={() => openEdit(item)}>
                  <Text style={styles.smallButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {tab === 'timeline' && (
        <View style={{ flex: 1 }}>
          {selectedTimelineItems.length > 0 && (
            <View style={styles.timelineMultiSelectBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.timelineMultiSelectTitle}>{selectedTimelineItems.length} selected</Text>
                <Text style={styles.timelineMultiSelectSummary} numberOfLines={2}>
                  {selectedTimelineItems
                    .slice(0, 3)
                    .map(i => `${i.medName} @ ${new Date(i.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
                    .join(' • ')}
                  {selectedTimelineItems.length > 3 ? ` +${selectedTimelineItems.length - 3} more` : ''}
                </Text>
              </View>
              <TouchableOpacity style={styles.timelineMultiSelectAction} onPress={openAdministrationForSelection}>
                <Text style={styles.timelineMultiSelectActionText}>Record Selected</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.timelineMultiSelectClear} onPress={() => setSelectedTimelineItems([])}>
                <Text style={styles.timelineMultiSelectClearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          <TimelineList
            meds={meds}
            styles={styles}
            onRecord={handleTimelineRecord}
            selectedKeys={selectedTimelineKeys}
            onToggleSelect={toggleTimelineMultiSelect}
          />
        </View>
      )}

      {tab === 'history' && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                placeholder="Search history (medication, status, reason)..."
                value={historySearchQuery}
                onChangeText={setHistorySearchQuery}
                style={{
                  flex: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  fontSize: 13,
                  backgroundColor: '#f9fafb',
                }}
              />
              <TouchableOpacity
                onPress={() => setShowHistoryFilters(true)}
                style={{
                  marginLeft: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: activeHistoryFilterCount > 0 ? '#2563eb' : '#d1d5db',
                  backgroundColor: activeHistoryFilterCount > 0 ? '#dbeafe' : '#f8fafc',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: activeHistoryFilterCount > 0 ? '#1d4ed8' : '#334155' }}>
                  Filters{activeHistoryFilterCount > 0 ? ` (${activeHistoryFilterCount})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <HistoryList client={localClient} styles={styles} filteredRecords={getFilteredHistoryRecords()} />
        </View>
      )}

      <Modal visible={showHistoryFilters} transparent animationType="fade" onRequestClose={() => setShowHistoryFilters(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '92%', maxWidth: 520, maxHeight: '86%' }]}>
            <Text style={styles.modalTitle}>History Filters</Text>
            <ScrollView>
              <Text style={styles.modalLabel}>Date range</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'All', value: 'all' },
                  { label: 'Today', value: 'today' },
                  { label: 'Last 7 days', value: 'last7' },
                  { label: 'Last 30 days', value: 'last30' },
                ].map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={{
                      borderWidth: 1,
                      borderColor: historyDatePreset === option.value ? '#2563eb' : '#cbd5e1',
                      backgroundColor: historyDatePreset === option.value ? '#dbeafe' : '#fff',
                      borderRadius: 16,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                    onPress={() => setHistoryDatePreset(option.value as any)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: historyDatePreset === option.value ? '#1d4ed8' : '#334155' }}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Timing (given only)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'All', value: 'all' },
                  { label: 'On time', value: 'on-time' },
                  { label: 'Early', value: 'early' },
                  { label: 'Late', value: 'late' },
                ].map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={{
                      borderWidth: 1,
                      borderColor: historyTimingFilter === option.value ? '#2563eb' : '#cbd5e1',
                      backgroundColor: historyTimingFilter === option.value ? '#dbeafe' : '#fff',
                      borderRadius: 16,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                    onPress={() => setHistoryTimingFilter(option.value as any)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: historyTimingFilter === option.value ? '#1d4ed8' : '#334155' }}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Status</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {historyStatusOptions.map(status => (
                  <TouchableOpacity
                    key={status}
                    style={{
                      borderWidth: 1,
                      borderColor: historySelectedStatuses.includes(status) ? '#2563eb' : '#cbd5e1',
                      backgroundColor: historySelectedStatuses.includes(status) ? '#dbeafe' : '#fff',
                      borderRadius: 16,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                    onPress={() => toggleHistoryStatus(status)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: historySelectedStatuses.includes(status) ? '#1d4ed8' : '#334155' }}>{status}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Medication</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {historyMedicationOptions.map(medName => (
                  <TouchableOpacity
                    key={medName}
                    style={{
                      borderWidth: 1,
                      borderColor: historySelectedMeds.includes(medName) ? '#2563eb' : '#cbd5e1',
                      backgroundColor: historySelectedMeds.includes(medName) ? '#dbeafe' : '#fff',
                      borderRadius: 16,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                    onPress={() => toggleHistoryMedication(medName)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: historySelectedMeds.includes(medName) ? '#1d4ed8' : '#334155' }}>{medName}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Other options</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
                onPress={() => setHistoryHasReasonOnly(v => !v)}
              >
                <View style={{ width: 18, height: 18, borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 4, marginRight: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: historyHasReasonOnly ? '#2563eb' : '#fff' }}>
                  {historyHasReasonOnly ? <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>✓</Text> : null}
                </View>
                <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>Show entries with reason only</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
                onPress={() => setHistoryIncludeStockAdjustments(v => !v)}
              >
                <View style={{ width: 18, height: 18, borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 4, marginRight: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: historyIncludeStockAdjustments ? '#2563eb' : '#fff' }}>
                  {historyIncludeStockAdjustments ? <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>✓</Text> : null}
                </View>
                <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>Include stock adjustments</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
                onPress={() => {
                  setHistoryOnlyStockAdjustments(v => !v);
                  setHistoryIncludeStockAdjustments(true);
                }}
              >
                <View style={{ width: 18, height: 18, borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 4, marginRight: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: historyOnlyStockAdjustments ? '#2563eb' : '#fff' }}>
                  {historyOnlyStockAdjustments ? <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>✓</Text> : null}
                </View>
                <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>Only stock adjustments (includes medication creation)</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={clearAllHistoryFilters}>
                <Text style={styles.modalBtnText}>Clear all</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalSave]} onPress={() => setShowHistoryFilters(false)}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AdminRecordModal
        visible={recordingAdmin && !!adminRecord}
        adminRecord={adminRecord}
        adminRecords={adminRecordsBatch}
        adminStatus={adminStatus}
        setAdminStatus={setAdminStatus}
        adminScheduledTime={adminScheduledTime}
        adminActualTime={adminActualTime}
        setAdminActualTime={setAdminActualTime}
        adminActualTimesByKey={adminActualTimesByKey}
        setAdminActualTimesByKey={setAdminActualTimesByKey}
        adminTabletsGiven={adminTabletsGiven}
        setAdminTabletsGiven={setAdminTabletsGiven}
        thirdPartyStockHandling={adminThirdPartyStockHandling}
        setThirdPartyStockHandling={setAdminThirdPartyStockHandling}
        adminNotes={adminNotes}
        setAdminNotes={setAdminNotes}
        administeredBy={administeredBy}
        setAdministeredBy={setAdministeredBy}
        notGivenReason={notGivenReason}
        setNotGivenReason={setNotGivenReason}
        otherReason={otherReason}
        setOtherReason={setOtherReason}
        medRoute={activeAdminMedication?.route}
        medStock={activeAdminMedication?.stock}
        medTotalDose={activeAdminMedication?.totalDose}
        medDosePerTablet={activeAdminMedication?.dosePerTablet}
        isPrn={!!activeAdminMedication?.prn}
        activeMedication={activeAdminMedication}
        showStockReviewNotice
        externalBlockingReason={adminSaveBlockReason}
        onCancel={() => {
          setAdminStatus(null);
          setAdminThirdPartyStockHandling('already-transferred');
          if (!adminStatus) {
            setRecordingAdmin(false);
            setAdminRecordsBatch([]);
            setAdminActualTimesByKey({});
            setAdminEntrySource(null);
            setAdminSaveBlockReason('');
          }
        }}
        onSave={saveAdministrationRecord}
        styles={styles}
      />

      <Modal
        visible={showOutOfStockReviewPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOutOfStockReviewPrompt(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '88%', maxWidth: 420 }]}> 
            <Text style={styles.modalTitle}>Stock Review Required</Text>
            <Text style={{ fontSize: 13, color: '#4b5563', lineHeight: 20, marginBottom: 16 }}>
              {outOfStockReviewMessage}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => {
                  setShowOutOfStockReviewPrompt(false);
                  setPendingOutOfStockBypassPrn(undefined);
                }}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSave]}
                onPress={() => {
                  const bypassPrn = pendingOutOfStockBypassPrn;
                  setShowOutOfStockReviewPrompt(false);
                  setPendingOutOfStockBypassPrn(undefined);
                  saveAdministrationRecord(bypassPrn, true);
                }}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Acknowledge and Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSummaryOptions} transparent animationType="fade" onRequestClose={() => setShowSummaryOptions(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '88%', maxWidth: 420 }]}> 
            <Text style={styles.modalTitle}>Download Summary</Text>
            <Text style={{ fontSize: 13, color: '#4b5563', marginBottom: 14, lineHeight: 18 }}>
              Choose which report you want to download.
            </Text>

            <TouchableOpacity
              style={{ backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 10 }}
              onPress={() => {
                setShowSummaryOptions(false);
                downloadSummary();
              }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Complete history (ZIP)</Text>
              <Text style={{ color: '#dbeafe', fontSize: 11, marginTop: 3 }}>Full medication and administration export</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: '#0f766e', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 14 }}
              onPress={() => {
                setShowSummaryOptions(false);
                downloadSevenDayHistoryPdf();
              }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>7 day history (PDF)</Text>
              <Text style={{ color: '#ccfbf1', fontSize: 11, marginTop: 3 }}>Includes client ID details and stock events</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, styles.modalCancel]}
              onPress={() => setShowSummaryOptions(false)}
            >
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit medication modal */}
      <Modal visible={editing && !!editMed} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%', width: '95%' }]}>
            <Text style={styles.modalTitle}>Edit Medication</Text>
            <ScrollView showsVerticalScrollIndicator={true}>
              {/* Medication Name */}
              <Text style={styles.modalLabel}>Medication Name *</Text>
              <TextInput 
                value={editMed?.name || ''} 
                onChangeText={(v) => setEditMed(m => m ? { ...m, name: v } : m)} 
                style={styles.modalInput} 
                placeholder="e.g., Paracetamol" 
              />

              {/* Medication Purpose */}
              <Text style={styles.modalLabel}>Medication Purpose</Text>
              <TextInput 
                value={editMed?.medicationPurpose || ''} 
                onChangeText={(v) => setEditMed(m => m ? { ...m, medicationPurpose: v } : m)} 
                style={styles.modalInput} 
                placeholder="e.g., Pain relief, Blood pressure" 
              />
              
              {/* Medication Type */}
              <Text style={styles.modalLabel}>Medication Type *</Text>
              <TextInput 
                value={editMed?.route || ''} 
                onChangeText={(v) => setEditMed(m => m ? { ...m, route: v, dosePerTablet: v === 'Subcutaneous injection' ? '' : (m?.dosePerTablet || ''), dosePerTablet2: v === 'Subcutaneous injection' ? '' : (m?.dosePerTablet2 || ''), dosePerTablet2Unit: v === 'Subcutaneous injection' ? '' : (m?.dosePerTablet2Unit || m?.unit || 'mg'), multipleDosesPerTablet: v === 'Subcutaneous injection' ? false : m?.multipleDosesPerTablet } : m)} 
                style={styles.modalInput} 
                placeholder="e.g., Oral tablet, Oral capsule" 
              />

              {/* Multiple doses per tablet checkbox */}
              {editMed?.route !== 'Subcutaneous injection' && (
                <>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginBottom: 8 }}
                    onPress={() => {
                      setEditMultipleDosesPerTablet(!editMultipleDosesPerTablet);
                      if (editMultipleDosesPerTablet) {
                        setEditDosePerTablet2('');
                        setEditMed(m => m ? { ...m, dosePerTablet2: '', dosePerTablet2Unit: '' } : m);
                      }
                    }}
                  >
                    <View style={{ width: 18, height: 18, borderWidth: 2, borderColor: '#3b82f6', borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginRight: 10, backgroundColor: editMultipleDosesPerTablet ? '#3b82f6' : '#fff' }}>
                      {editMultipleDosesPerTablet && <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
                    </View>
                    <Text style={{ fontSize: 12, color: '#333', flex: 1 }}>
                      There is more than one medication per {editMed?.route === 'Oral tablet' || editMed?.route === 'Oral capsule' || editMed?.route === 'Oral tablet/capsule' ? 'tablet/capsule' : 'unit'}
                    </Text>
                  </TouchableOpacity>
                  
                  {/* Second dose per tablet field */}
                  {editMultipleDosesPerTablet && (
                    <>
                      <Text style={styles.modalLabel}>
                        Second {editMed?.route === 'Oral tablet' || editMed?.route === 'Oral capsule' || editMed?.route === 'Oral tablet/capsule' ? 'Dose per tablet/capsule' : 'Dose per Unit'}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        <View style={{ flex: 2 }}>
                        <TextInput 
                          value={editDosePerTablet2} 
                          onChangeText={(v) => {
                            setEditDosePerTablet2(v);
                            setEditMed(m => m ? { ...m, dosePerTablet2: v } : m);
                          }} 
                          style={styles.modalInput} 
                          placeholder="e.g., 500"
                          keyboardType="decimal-pad"
                        />
                        </View>
                        <View style={{ flex: 1 }}>
                          <TouchableOpacity
                            style={[styles.modalInput, { justifyContent: 'center' }]}
                            onPress={() => setShowEditSecondUnitDropdown(true)}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>{editMed?.dosePerTablet2Unit || editMed?.unit || 'mg'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </>
                  )}
                </>
              )}

              {/* Dose per Tablet and Unit */}
              {editMed?.route !== 'Subcutaneous injection' && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.modalLabel}>
                      {editMed?.route === 'Oral tablet' || editMed?.route === 'Oral capsule' || editMed?.route === 'Oral tablet/capsule' ? 'Dose per tablet/capsule' : 'Dose per Unit'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TextInput 
                        value={editMed?.dosePerTablet || ''} 
                        onChangeText={(v) => setEditMed(m => m ? { ...m, dosePerTablet: v } : m)} 
                        style={[styles.modalInput, { flex: 1, marginRight: 8 }]} 
                        placeholder="e.g., 250"
                        keyboardType="decimal-pad"
                      />
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#333' }}>{editMed?.unit || 'mg'}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>Unit</Text>
                    <TextInput 
                      value={editMed?.unit || ''} 
                      onChangeText={(v) => setEditMed(m => m ? { ...m, unit: v } : m)} 
                      style={styles.modalInput} 
                      placeholder="mg"
                    />
                  </View>
                </View>
              )}

              {/* Tablets to be given per administration */}
              <Text style={styles.modalLabel}>Tablets to Be Given per Administration *</Text>
              <TextInput 
                value={editTabletsToBeGiven} 
                onChangeText={setEditTabletsToBeGiven} 
                style={styles.modalInput} 
                placeholder="e.g., 2"
                keyboardType="decimal-pad"
              />

              {/* Auto-calculated total dose */}
              {editTabletsToBeGiven && editMed?.dosePerTablet && (
                <>
                  <Text style={styles.modalLabel}>Total dose per administration</Text>
                  <View style={[styles.modalInput, { backgroundColor: '#f0f9ff', borderColor: '#93c5fd', borderWidth: 2, paddingVertical: 12 }]}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#2563eb' }}>
                      {isNaN(parseFloat(editTabletsToBeGiven) * parseFloat(editMed.dosePerTablet)) || !isFinite(parseFloat(editTabletsToBeGiven) * parseFloat(editMed.dosePerTablet)) 
                        ? '—' 
                        : (parseFloat(editTabletsToBeGiven) * parseFloat(editMed.dosePerTablet)).toFixed(2)} {editMed?.unit || 'mg'}
                    </Text>
                  </View>
                </>
              )}

              {/* Medication Schedule */}
              <Text style={styles.modalLabel}>Medication Schedule</Text>
              <View style={{ gap: 8, marginBottom: 12 }}>
                <TouchableOpacity 
                  style={[styles.scheduleTypeButton, editPrn && styles.scheduleTypeButtonActive]}
                  onPress={() => {
                    setEditPrn(true);
                    setEditCourseType('long-term');
                    setEditEndDate('');
                  }}
                >
                  <Text style={[styles.scheduleTypeButtonText, editPrn && styles.scheduleTypeButtonTextActive]}>📋 Give when required</Text>
                  <Text style={[styles.scheduleTypeDesc, editPrn && styles.scheduleTypeDescActive]}>Give when required (PRN)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.scheduleTypeButton, !editPrn && editCourseType === 'long-term' && styles.scheduleTypeButtonActive]}
                  onPress={() => {
                    setEditPrn(false);
                    setEditCourseType('long-term');
                    setEditEndDate('');
                  }}
                >
                  <Text style={[styles.scheduleTypeButtonText, !editPrn && editCourseType === 'long-term' && styles.scheduleTypeButtonTextActive]}>⏰ Long term course</Text>
                  <Text style={[styles.scheduleTypeDesc, !editPrn && editCourseType === 'long-term' && styles.scheduleTypeDescActive]}>Ongoing schedule</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.scheduleTypeButton, !editPrn && editCourseType === 'short-term' && styles.scheduleTypeButtonActive]}
                  onPress={() => {
                    setEditPrn(false);
                    setEditCourseType('short-term');
                  }}
                >
                  <Text style={[styles.scheduleTypeButtonText, !editPrn && editCourseType === 'short-term' && styles.scheduleTypeButtonTextActive]}>🗓️ Short term course</Text>
                  <Text style={[styles.scheduleTypeDesc, !editPrn && editCourseType === 'short-term' && styles.scheduleTypeDescActive]}>Time-limited schedule</Text>
                </TouchableOpacity>
              </View>

              {/* PRN Variable Restrictions */}
              {editPrn && (
                <View style={{ marginBottom: 12, padding: 10, backgroundColor: '#fef9e7', borderRadius: 8, borderWidth: 1, borderColor: '#f9d84a' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#856404', marginBottom: 8 }}>PRN Safety Controls</Text>
                  
                  <Text style={styles.modalLabel}>Minimum Time Between Doses (hours) *</Text>
                  <TextInput 
                    value={editMinTimeBetweenDoses} 
                    onChangeText={setEditMinTimeBetweenDoses} 
                    style={styles.modalInput} 
                    placeholder="e.g., 4"
                    keyboardType="decimal-pad"
                  />

                  <Text style={styles.modalLabel}>Maximum Dose per Administration (tablets) *</Text>
                  <TextInput 
                    value={editMaxDosePerAdministration} 
                    onChangeText={setEditMaxDosePerAdministration} 
                    style={styles.modalInput} 
                    placeholder="e.g., 3"
                    keyboardType="decimal-pad"
                  />

                  <Text style={styles.modalLabel}>Maximum Dose in 24 Hours (tablets) *</Text>
                  <TextInput 
                    value={editMaxDosePer24Hours} 
                    onChangeText={setEditMaxDosePer24Hours} 
                    style={styles.modalInput} 
                    placeholder="e.g., 8"
                    keyboardType="decimal-pad"
                  />
                </View>
              )}

              {/* Frequency type and times for non-PRN */}
              {!editPrn && (
                <>
                  <Text style={styles.modalLabel}>Frequency</Text>
                  <TouchableOpacity style={[styles.modalInput, { justifyContent: 'center' }]} onPress={() => setShowEditFrequencyDropdown(true)}>
                    <Text style={{ color: '#111827', fontSize: 13, fontWeight: '600' }}>
                      {editFrequencyType === 'daily' ? 'Every Day' : editFrequencyType === 'every-second-day' ? 'Every Second Day' : editFrequencyType === 'weekly' ? 'Weekly' : editFrequencyType === 'fortnightly' ? 'Fortnightly' : 'Monthly'}
                    </Text>
                  </TouchableOpacity>

                  {editFrequencyType === 'daily' && (
                    <>
                      <TouchableOpacity style={[styles.modalInput, { justifyContent: 'center' }]} onPress={() => setShowEditSlotsDropdown(true)}>
                        <Text style={{ color: '#111827', fontSize: 13 }}>
                          {Object.values(slots).filter(Boolean).length === 0 ? 'Select times...' : `${Object.values(slots).filter(Boolean).length} time${Object.values(slots).filter(Boolean).length !== 1 ? 's' : ''} selected`}
                        </Text>
                      </TouchableOpacity>

                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
                        {slots.beforeBreakfast && <Text style={styles.slotTag}>Before Breakfast (05:00-10:00)</Text>}
                        {slots.breakfast && <Text style={styles.slotTag}>Breakfast (06:00-10:00)</Text>}
                        {slots.lunch && <Text style={styles.slotTag}>Lunch (10:00-15:00)</Text>}
                        {slots.dinner && <Text style={styles.slotTag}>Dinner (16:00-22:00)</Text>}
                        {slots.beforeBed && <Text style={styles.slotTag}>Before Bed (18:00-23:59)</Text>}
                        {editCustomTimes.map((time, idx) => (
                          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 8, marginBottom: 6 }}>
                            <Text style={styles.slotTag}>{formatCustomTimeRange(time)} (Specific)</Text>
                            <TouchableOpacity onPress={() => setEditCustomTimes(t => t.filter((_, i) => i !== idx))} style={{ marginLeft: 6 }}>
                              <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 14 }}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>

                      <Text style={styles.modalLabel}>Add Specific Time (HH:MM)</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        <TextInput
                          value={editNewCustomTime}
                          onChangeText={setEditNewCustomTime}
                          style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                          placeholder="e.g., 14:30"
                        />
                        <TouchableOpacity
                          style={[styles.modalBtn, styles.modalSave, { marginLeft: 0, paddingHorizontal: 14 }]}
                          onPress={() => {
                            const value = editNewCustomTime.trim();
                            if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) {
                              Alert.alert('Invalid Time', 'Please enter time in HH:MM format.');
                              return;
                            }
                            if (!editCustomTimes.includes(value)) {
                              setEditCustomTimes(prev => [...prev, value].sort());
                            }
                            setEditNewCustomTime('');
                          }}
                        >
                          <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </>
              )}

              {/* Notes */}
              <Text style={styles.modalLabel}>Notes/Instructions (optional)</Text>
              <TextInput 
                value={editMed?.notes || ''} 
                onChangeText={(v) => setEditMed(m => m ? { ...m, notes: v } : m)} 
                style={[styles.modalInput, styles.multilineInput]} 
                placeholder="e.g., Take with food, avoid dairy" 
                multiline
              />

              {/* Start/End Dates */}
              <Text style={styles.modalLabel}>Start Time</Text>
              <TextInput
                value={editStartTime}
                onChangeText={(v) => setEditStartTime(v)}
                style={styles.modalInput}
                placeholder="HH:MM"
              />

              <TouchableOpacity 
                style={[styles.modalInput, { paddingVertical: 12, justifyContent: 'center', backgroundColor: '#f9fafb' }]}
                onPress={openEditStartDatePicker}
              >
                <Text style={{ color: editStartDate ? '#000' : '#999', fontSize: 13 }}>
                  Start date: {editStartDate || 'Not set'}
                </Text>
              </TouchableOpacity>

              {!editPrn && editCourseType === 'short-term' && (
                <TouchableOpacity 
                  style={[styles.modalInput, { paddingVertical: 12, justifyContent: 'center', backgroundColor: '#f9fafb' }]}
                  onPress={openEditEndDatePicker}
                >
                  <Text style={{ color: editEndDate ? '#000' : '#999', fontSize: 13 }}>
                    End date: {editEndDate || 'Required for short-term'}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={{ marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', borderRadius: 8, padding: 10 }}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
                  onPress={() => {
                    const next = !editHasScriptRepeats;
                    setEditHasScriptRepeats(next);
                    if (!next) {
                      setEditScriptRepeatsCount('');
                      setEditPrescriptionFileUri('');
                      setEditScriptLocation('');
                      setEditScriptLocationOtherDetail('');
                    }
                  }}
                >
                  <View style={{ width: 18, height: 18, borderWidth: 2, borderColor: '#3b82f6', borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginRight: 10, backgroundColor: editHasScriptRepeats ? '#3b82f6' : '#fff' }}>
                    {editHasScriptRepeats && <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>This medication has script repeats</Text>
                </TouchableOpacity>

                {editHasScriptRepeats && (
                  <>
                    <Text style={styles.modalLabel}>Number of script repeats (optional)</Text>
                    <TextInput
                      value={editScriptRepeatsCount}
                      onChangeText={(v) => setEditScriptRepeatsCount(v.replace(/[^0-9]/g, ''))}
                      style={styles.modalInput}
                      placeholder="e.g., 5"
                      keyboardType="number-pad"
                    />

                    <Text style={styles.modalLabel}>Script location (if known)</Text>
                    <TouchableOpacity
                      style={[styles.modalInput, { justifyContent: 'center' }]}
                      onPress={() => setShowEditScriptLocationDropdown(true)}
                    >
                      <Text style={{ fontSize: 13, color: '#334155' }}>{editScriptLocation || 'Select script location'}</Text>
                    </TouchableOpacity>

                    {editScriptLocation === 'Other' && (
                      <TextInput
                        value={editScriptLocationOtherDetail}
                        onChangeText={setEditScriptLocationOtherDetail}
                        style={styles.modalInput}
                        placeholder="Please specify"
                      />
                    )}

                    <TouchableOpacity
                      style={[styles.modalInput, { justifyContent: 'center', backgroundColor: editPrescriptionFileUri ? '#ecfdf5' : '#f9fafb', borderColor: editPrescriptionFileUri ? '#22c55e' : '#e5e7eb' }]}
                      onPress={pickEditPrescriptionFile}
                    >
                      <Text style={{ color: editPrescriptionFileUri ? '#15803d' : '#334155', fontWeight: '600' }}>
                        {editPrescriptionFileUri ? '✓ Prescription file uploaded' : '+ Upload prescription file (optional)'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
              
              {/* Stock level (read-only) */}
              <View style={[styles.modalInput, { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', paddingVertical: 12, justifyContent: 'center' }]}>
                <Text style={{ color: '#16a34a', fontSize: 12, fontWeight: '600', marginBottom: 2 }}>📦 Stock Level: {editMed?.stock?.toString() || '0'}</Text>
                <Text style={{ color: '#15803d', fontSize: 10 }}>To update stock, use Stock Management</Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#dc2626' }]}
                onPress={deleteMedication}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => { setEditing(false); setEditMed(null); }}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalSave]} onPress={saveEdit}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Start Date Picker Modal */}
      <Modal visible={showEditSecondUnitDropdown} transparent animationType="fade" onRequestClose={() => setShowEditSecondUnitDropdown(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '70%', maxWidth: 320, maxHeight: 360 }]}> 
            <Text style={styles.modalTitle}>Select Second Unit</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {MED_UNITS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: (editMed?.dosePerTablet2Unit || editMed?.unit || 'mg') === u ? '#2563eb' : '#e5e7eb',
                    backgroundColor: (editMed?.dosePerTablet2Unit || editMed?.unit || 'mg') === u ? '#dbeafe' : '#fff'
                  }}
                  onPress={() => {
                    setEditMed(m => m ? { ...m, dosePerTablet2Unit: u } : m);
                    setShowEditSecondUnitDropdown(false);
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: (editMed?.dosePerTablet2Unit || editMed?.unit || 'mg') === u ? '#1d4ed8' : '#334155' }}>{u}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalCancel, { marginTop: 8 }]}
              onPress={() => setShowEditSecondUnitDropdown(false)}
            >
              <Text style={styles.modalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditScriptLocationDropdown} transparent animationType="fade" onRequestClose={() => setShowEditScriptLocationDropdown(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '70%', maxWidth: 340, maxHeight: 360 }]}> 
            <Text style={styles.modalTitle}>Select Script Location</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {SCRIPT_LOCATIONS.map((location) => (
                <TouchableOpacity
                  key={location}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: editScriptLocation === location ? '#2563eb' : '#e5e7eb',
                    backgroundColor: editScriptLocation === location ? '#dbeafe' : '#fff'
                  }}
                  onPress={() => {
                    setEditScriptLocation(location);
                    setShowEditScriptLocationDropdown(false);
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: editScriptLocation === location ? '#1d4ed8' : '#334155' }}>{location}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalCancel, { marginTop: 8 }]}
              onPress={() => setShowEditScriptLocationDropdown(false)}
            >
              <Text style={styles.modalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditSlotsDropdown} transparent animationType="fade" onRequestClose={() => setShowEditSlotsDropdown(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowEditSlotsDropdown(false)} activeOpacity={1}>
          <View style={[styles.modalContent, { width: '80%', maxWidth: 380 }]}>
            <Text style={styles.modalTitle}>Select Times</Text>
            <TouchableOpacity style={{ paddingVertical: 10 }} onPress={() => setSlots(s => ({ ...s, beforeBreakfast: !s.beforeBreakfast }))}>
              <Text style={{ fontSize: 13, color: '#334155' }}>Before Breakfast (05:00-10:00) {slots.beforeBreakfast ? '✓' : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ paddingVertical: 10 }} onPress={() => setSlots(s => ({ ...s, breakfast: !s.breakfast }))}>
              <Text style={{ fontSize: 13, color: '#334155' }}>Breakfast (06:00-10:00) {slots.breakfast ? '✓' : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ paddingVertical: 10 }} onPress={() => setSlots(s => ({ ...s, lunch: !s.lunch }))}>
              <Text style={{ fontSize: 13, color: '#334155' }}>Lunch (10:00-15:00) {slots.lunch ? '✓' : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ paddingVertical: 10 }} onPress={() => setSlots(s => ({ ...s, dinner: !s.dinner }))}>
              <Text style={{ fontSize: 13, color: '#334155' }}>Dinner (16:00-22:00) {slots.dinner ? '✓' : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ paddingVertical: 10 }} onPress={() => setSlots(s => ({ ...s, beforeBed: !s.beforeBed }))}>
              <Text style={{ fontSize: 13, color: '#334155' }}>Before Bed (18:00-23:59) {slots.beforeBed ? '✓' : ''}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showEditFrequencyDropdown} transparent animationType="fade" onRequestClose={() => setShowEditFrequencyDropdown(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowEditFrequencyDropdown(false)} activeOpacity={1}>
          <View style={[styles.modalContent, { width: '75%', maxWidth: 340 }]}> 
            <Text style={styles.modalTitle}>Select Frequency</Text>
            {[
              { key: 'daily', label: 'Every Day' },
              { key: 'every-second-day', label: 'Every Second Day' },
              { key: 'weekly', label: 'Weekly' },
              { key: 'fortnightly', label: 'Fortnightly' },
              { key: 'monthly', label: 'Monthly' },
            ].map(freq => (
              <TouchableOpacity
                key={freq.key}
                style={{ paddingVertical: 10 }}
                onPress={() => {
                  setEditFrequencyType(freq.key as any);
                  setShowEditFrequencyDropdown(false);
                }}
              >
                <Text style={{ fontSize: 13, color: '#334155' }}>{freq.label} {editFrequencyType === freq.key ? '✓' : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Start Date Picker Modal */}
      <Modal visible={showEditStartDatePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '95%', maxWidth: 550, maxHeight: '85%', padding: 12 }]}>
            <Text style={[styles.modalTitle, { marginBottom: 8 }]}>Select Start Date</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Year and Month Dropdowns */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', marginBottom: 4, color: '#666', fontSize: 12 }}>Year</Text>
                  <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, overflow: 'hidden', maxHeight: 110 }}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {Array.from({ length: 50 }, (_, i) => 2026 + i).map(year => (
                        <TouchableOpacity
                          key={year}
                          style={[
                            { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
                            editPickerYear === year && { backgroundColor: '#dbeafe' }
                          ]}
                          onPress={() => setEditPickerYear(year)}
                        >
                          <Text style={[
                            { fontSize: 13, fontWeight: '600', color: '#333', textAlign: 'center' },
                            editPickerYear === year && { color: '#2563eb', fontWeight: '700' }
                          ]}>
                            {year}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', marginBottom: 4, color: '#666', fontSize: 12 }}>Month</Text>
                  <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, overflow: 'hidden', maxHeight: 110 }}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
                        <TouchableOpacity
                          key={m}
                          style={[
                            { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
                            editPickerMonth === idx + 1 && { backgroundColor: '#dbeafe' }
                          ]}
                          onPress={() => setEditPickerMonth(idx + 1)}
                        >
                          <Text style={[
                            { fontSize: 13, fontWeight: '600', color: '#333', textAlign: 'center' },
                            editPickerMonth === idx + 1 && { color: '#2563eb', fontWeight: '700' }
                          ]}>
                            {m}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </View>

              {/* Calendar Grid - Compact */}
              <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                    <Text key={day} style={{ width: '14.2%', textAlign: 'center', fontWeight: '700', color: '#666', fontSize: 9 }}>
                      {day}
                    </Text>
                  ))}
                </View>

                {(() => {
                  const firstDay = new Date(editPickerYear, editPickerMonth - 1, 1).getDay();
                  const daysInMonth = new Date(editPickerYear, editPickerMonth, 0).getDate();
                  const days = [];
                  
                  for (let i = 0; i < firstDay; i++) {
                    days.push(null);
                  }
                  
                  for (let i = 1; i <= daysInMonth; i++) {
                    days.push(i);
                  }
                  
                  const weeks = [];
                  for (let i = 0; i < days.length; i += 7) {
                    weeks.push(days.slice(i, i + 7));
                  }
                  
                  return (
                    <View>
                      {weeks.map((week, weekIdx) => (
                        <View key={weekIdx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                          {week.map((day, dayIdx) => {
                            const isDisabled = day === null;
                            return (
                            <TouchableOpacity
                              key={dayIdx}
                              style={[
                                { 
                                  width: '14.2%', 
                                  aspectRatio: 1, 
                                  justifyContent: 'center', 
                                  alignItems: 'center',
                                  borderRadius: 3,
                                  borderWidth: 1,
                                  borderColor: '#e5e7eb',
                                  backgroundColor: '#fff'
                                },
                                day === editPickerDay && { backgroundColor: '#2563eb', borderColor: '#2563eb' },
                                isDisabled && { opacity: 0.3 }
                              ]}
                              onPress={() => day !== null && setEditPickerDay(day)}
                              disabled={isDisabled}
                            >
                              {day !== null && (
                                <Text style={[
                                  { fontSize: 14, fontWeight: '600', color: '#333' },
                                  day === editPickerDay && { color: '#fff', fontWeight: '700' }
                                ]}>
                                  {day}
                                </Text>
                              )}
                            </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </View>
            </ScrollView>

            <View style={[styles.modalActions, { marginTop: 10 }]}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalCancel]} 
                onPress={() => setShowEditStartDatePicker(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalSave]} 
                onPress={confirmEditStartDatePicker}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit End Date Picker Modal */}
      <Modal visible={showEditEndDatePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '95%', maxWidth: 550, maxHeight: '85%', padding: 12 }]}>
            <Text style={[styles.modalTitle, { marginBottom: 8 }]}>Select End Date</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Year and Month Dropdowns */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', marginBottom: 4, color: '#666', fontSize: 12 }}>Year</Text>
                  <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, overflow: 'hidden', maxHeight: 110 }}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {Array.from({ length: 50 }, (_, i) => 2026 + i).map(year => (
                        <TouchableOpacity
                          key={year}
                          style={[
                            { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
                            editPickerYear === year && { backgroundColor: '#dbeafe' }
                          ]}
                          onPress={() => setEditPickerYear(year)}
                        >
                          <Text style={[
                            { fontSize: 13, fontWeight: '600', color: '#333', textAlign: 'center' },
                            editPickerYear === year && { color: '#2563eb', fontWeight: '700' }
                          ]}>
                            {year}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', marginBottom: 4, color: '#666', fontSize: 12 }}>Month</Text>
                  <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, overflow: 'hidden', maxHeight: 110 }}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
                        <TouchableOpacity
                          key={m}
                          style={[
                            { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
                            editPickerMonth === idx + 1 && { backgroundColor: '#dbeafe' }
                          ]}
                          onPress={() => setEditPickerMonth(idx + 1)}
                        >
                          <Text style={[
                            { fontSize: 13, fontWeight: '600', color: '#333', textAlign: 'center' },
                            editPickerMonth === idx + 1 && { color: '#2563eb', fontWeight: '700' }
                          ]}>
                            {m}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </View>

              {/* Calendar Grid - Compact */}
              <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                    <Text key={day} style={{ width: '14.2%', textAlign: 'center', fontWeight: '700', color: '#666', fontSize: 9 }}>
                      {day}
                    </Text>
                  ))}
                </View>

                {(() => {
                  const firstDay = new Date(editPickerYear, editPickerMonth - 1, 1).getDay();
                  const daysInMonth = new Date(editPickerYear, editPickerMonth, 0).getDate();
                  const days = [];
                  
                  for (let i = 0; i < firstDay; i++) {
                    days.push(null);
                  }
                  
                  for (let i = 1; i <= daysInMonth; i++) {
                    days.push(i);
                  }
                  
                  const weeks = [];
                  for (let i = 0; i < days.length; i += 7) {
                    weeks.push(days.slice(i, i + 7));
                  }
                  
                  return (
                    <View>
                      {weeks.map((week, weekIdx) => (
                        <View key={weekIdx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                          {week.map((day, dayIdx) => {
                            const isBeforeMinDate = editPickerYear < 2026;
                            const isDisabled = day === null || isBeforeMinDate;
                            return (
                            <TouchableOpacity
                              key={dayIdx}
                              style={[
                                { 
                                  width: '14.2%', 
                                  aspectRatio: 1, 
                                  justifyContent: 'center', 
                                  alignItems: 'center',
                                  borderRadius: 3,
                                  borderWidth: 1,
                                  borderColor: '#e5e7eb',
                                  backgroundColor: '#fff'
                                },
                                day === editPickerDay && { backgroundColor: '#2563eb', borderColor: '#2563eb' },
                                isDisabled && { opacity: 0.3 }
                              ]}
                              onPress={() => day !== null && !isBeforeMinDate && setEditPickerDay(day)}
                              disabled={isDisabled}
                            >
                              {day !== null && (
                                <Text style={[
                                  { fontSize: 14, fontWeight: '600', color: '#333' },
                                  day === editPickerDay && { color: '#fff', fontWeight: '700' }
                                ]}>
                                  {day}
                                </Text>
                              )}
                            </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </View>
            </ScrollView>

            <View style={[styles.modalActions, { marginTop: 10 }]}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalCancel]} 
                onPress={() => setShowEditEndDatePicker(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalSave]} 
                onPress={confirmEditEndDatePicker}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit client modal */}
      <Modal visible={editingClient} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Edit Client</Text>
            <ScrollView>
              {/* Photo Section */}
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                {clientDraft.photoUri ? (
                  <Image source={{ uri: clientDraft.photoUri }} style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 12 }} />
                ) : (
                  <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 36 }}>📷</Text>
                  </View>
                )}
                <TouchableOpacity style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#2563eb', borderRadius: 6 }} onPress={pickClientPhoto}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{clientDraft.photoUri ? 'Change Photo' : 'Add Photo'}</Text>
                </TouchableOpacity>
              </View>

              <TextInput value={clientDraft.name} onChangeText={(v) => setClientDraft(d => ({ ...d, name: v }))} style={styles.modalInput} placeholder="Full name" />
            <TextInput value={clientDraft.dob} onChangeText={(v) => setClientDraft(d => ({ ...d, dob: v }))} style={styles.modalInput} placeholder="DOB (YYYY-MM-DD)" />
            
            <Text style={styles.modalLabel}>Gender</Text>
            <View style={styles.genderRow}>
              {(['Male', 'Female', 'Other'] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderButton, clientDraft.gender === g && styles.genderButtonSelected]}
                  onPress={() => setClientDraft(d => ({ ...d, gender: g }))}
                >
                  <Text style={[styles.genderButtonText, clientDraft.gender === g && styles.genderButtonTextSelected]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput value={clientDraft.weight} onChangeText={(v) => setClientDraft(d => ({ ...d, weight: v }))} style={styles.modalInput} placeholder="Weight (e.g., 75kg)" />
            <TextInput value={clientDraft.contactEmail} onChangeText={(v) => setClientDraft(d => ({ ...d, contactEmail: v }))} style={styles.modalInput} placeholder="Contact email (optional)" keyboardType="email-address" />
            <TextInput value={clientDraft.gp} onChangeText={(v) => setClientDraft(d => ({ ...d, gp: v }))} style={styles.modalInput} placeholder="GP (optional)" />
            <TextInput value={clientDraft.gpClinic} onChangeText={(v) => setClientDraft(d => ({ ...d, gpClinic: v }))} style={styles.modalInput} placeholder="GP Clinic (optional)" />
              <TextInput value={clientDraft.medicareNumber} onChangeText={(v) => setClientDraft(d => ({ ...d, medicareNumber: v }))} style={styles.modalInput} placeholder="Medicare Number (optional)" />
              <TextInput value={clientDraft.allergies} onChangeText={(v) => setClientDraft(d => ({ ...d, allergies: v }))} style={[styles.modalInput, styles.multilineInput]} placeholder="Allergies" multiline />
              <TextInput value={clientDraft.additionalInfo} onChangeText={(v) => setClientDraft(d => ({ ...d, additionalInfo: v }))} style={[styles.modalInput, styles.multilineInput]} placeholder="Additional Information (optional)" multiline />

              <Text style={styles.modalLabel}>Location *</Text>
              <TouchableOpacity
                style={[styles.modalInput, { justifyContent: 'center' }]}
                onPress={() => setShowEditClientLocationDropdown(true)}
              >
                <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>
                  {availableClientLocations.find(l => l.id === editClientLocationId)?.name || 'Select location'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#dc2626' }]} onPress={handleDeleteClient}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Delete Client</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => { setEditingClient(false); }}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalSave]} onPress={saveClientEdit}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditClientLocationDropdown} transparent animationType="fade" onRequestClose={() => setShowEditClientLocationDropdown(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowEditClientLocationDropdown(false)} activeOpacity={1}>
          <View style={[styles.modalContent, { maxHeight: 420 }]} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Select Location</Text>
            <FlatList
              data={availableClientLocations}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    {
                      backgroundColor: '#fff',
                      borderRadius: 8,
                      marginBottom: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderWidth: 1,
                      borderColor: '#e5e7eb',
                    },
                    editClientLocationId === item.id && {
                      backgroundColor: '#dbeafe',
                      borderColor: '#2563eb',
                    },
                  ]}
                  onPress={() => {
                    setEditClientLocationId(item.id);
                    setShowEditClientLocationDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      { fontSize: 13, color: '#0f172a', fontWeight: '600' },
                      editClientLocationId === item.id && { color: '#1d4ed8', fontWeight: '700' },
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <View style={[styles.modalActions, { marginTop: 10 }]}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setShowEditClientLocationDropdown(false)}>
                <Text style={styles.modalBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Medication Modal */}
      <Modal visible={showAddMedicationPrompt} transparent animationType="fade" onRequestClose={() => setShowAddMedicationPrompt(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 520 }]}> 
            <Text style={styles.modalTitle}>Before Adding Medication</Text>
            <Text style={{ fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 12 }}>
              Please use the information on the medication box to assist you in filling out the fields accurately.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setShowAddMedicationPrompt(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSave]}
                onPress={() => {
                  setShowAddMedicationPrompt(false);
                  setShowAddMedication(true);
                }}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>I Understand</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {locationId && localClient && (
        <AddMedicationModal 
          visible={showAddMedication} 
          locationId={locationId} 
          clientId={localClient.id} 
          onClose={() => setShowAddMedication(false)}
          onSuccess={refreshLocal}
        />
      )}

      {/* Error Correction Modal */}
      <Modal visible={showErrorCorrection} transparent animationType="fade">
        <View style={styles.errorCorrectionOverlay}>
          <View style={styles.errorCorrectionModal}>
            <View style={styles.errorCorrectionHeader}>
              <Text style={styles.errorCorrectionTitle}>Mark as Error</Text>
              <Text style={styles.errorCorrectionSubtitle}>{errorCorrectionRecord?.medName}</Text>
            </View>

            <ScrollView style={styles.errorCorrectionContent}>
              <View style={styles.errorField}>
                <Text style={styles.errorLabel}>Error Reason *</Text>
                <TouchableOpacity 
                  style={styles.errorDropdown} 
                  onPress={() => setShowErrorReasonDropdown(true)}
                >
                  <Text style={styles.errorDropdownText}>
                    {errorReason === 'wrong-client' ? 'Wrong Client' : 
                     errorReason === 'wrong-time' ? 'Wrong Time' : 
                     errorReason === 'wrong-medication' ? 'Wrong Medication' : 
                     errorReason === 'other' ? 'Other' : 
                     'Select error reason'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.errorField}>
                <Text style={styles.errorLabel}>Notes</Text>
                <TextInput
                  style={[styles.errorInput, styles.errorTextArea]}
                  placeholder="Additional notes about this error..."
                  placeholderTextColor="#aaa"
                  value={errorNotes}
                  onChangeText={setErrorNotes}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </ScrollView>

            <View style={styles.errorActions}>
              <TouchableOpacity 
                style={styles.errorCancel} 
                onPress={() => {
                  setShowErrorCorrection(false);
                  setErrorCorrectionRecord(null);
                  setErrorReason('');
                  setErrorNotes('');
                }}
              >
                <Text style={styles.errorActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.errorSubmit} 
                onPress={handleErrorCorrection}
              >
                <Text style={{ ...styles.errorActionText, color: '#fff' }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Reason Dropdown Modal */}
      <Modal visible={showErrorReasonDropdown} transparent animationType="fade" onRequestClose={() => setShowErrorReasonDropdown(false)}>
        <View style={styles.errorDropdownOverlay}>
          <View style={styles.errorDropdownModal}>
            <View style={styles.errorDropdownHeader}>
              <Text style={styles.errorDropdownTitle}>Select Error Reason</Text>
            </View>
            <FlatList
              data={[
                { label: 'Wrong Client', value: 'wrong-client' },
                { label: 'Wrong Time', value: 'wrong-time' },
                { label: 'Wrong Medication', value: 'wrong-medication' },
                { label: 'Other', value: 'other' }
              ]}
              keyExtractor={item => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.errorReasonOption,
                    errorReason === item.value && styles.errorReasonOptionSelected
                  ]}
                  onPress={() => {
                    setErrorReason(item.value as any);
                    setShowErrorReasonDropdown(false);
                  }}
                >
                  <Text style={[
                    styles.errorReasonOptionText,
                    errorReason === item.value && styles.errorReasonOptionTextSelected
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              scrollEnabled={false}
            />
            <TouchableOpacity
              style={styles.errorDropdownClose}
              onPress={() => setShowErrorReasonDropdown(false)}
            >
              <Text style={styles.errorDropdownCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Stock Warning Modal */}
      <Modal visible={showStockWarning} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, width: '85%', maxWidth: 400, elevation: 5 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 8 }}>Cannot Delete Medication</Text>
            <Text style={{ fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 20 }}>
              <Text style={{ fontWeight: '600' }}>{stockWarningMed?.name}</Text> has <Text style={{ fontWeight: '600' }}>{stockWarningMed?.stock} unit{(stockWarningMed?.stock || 0) === 1 ? '' : 's'}</Text> of stock remaining.
            </Text>
            <Text style={{ fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 24 }}>
              You must record the disposal of this medication in Stock Management before it can be deleted.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 10, borderRadius: 6, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setShowStockWarning(false)}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 10, borderRadius: 6, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => {
                  if (navigation && localClient) {
                    setShowStockWarning(false);
                    setEditing(false);
                    setEditMed(null);
                    navigation.navigate('StockManagement', { clientId: localClient.id, locationId, clientName: localClient.name });
                  }
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Stock Management</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DeleteConfirmModal
        visible={showDeleteConfirm}
        medName={medToDelete?.name || ''}
        onConfirm={confirmDeleteMedication}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setMedToDelete(null);
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: '#fff' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 14, color: '#666' },
  clientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  clientInfo: { flex: 1, paddingRight: 12 },
  clientName: { fontSize: 16, fontWeight: '800', color: '#1f2937' },
  clientMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  clientMeta: { color: '#475569', fontSize: 12, fontWeight: '600' },
  clientEmail: { color: '#0f4a7a', fontSize: 11, marginTop: 3, fontWeight: '600' },
  headerActionsRow: { flexDirection: 'row', alignItems: 'center' },
  tabRow: { flexDirection: 'row', justifyContent: 'center', gap: 0, paddingHorizontal: 16, paddingVertical: 3, backgroundColor: '#e5e7eb', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginHorizontal: 16, marginTop: 12 },
  tabButton: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, backgroundColor: '#e5e7eb', borderWidth: 0, flex: 1, alignItems: 'center' },
  tabButtonActive: { backgroundColor: '#f5fcff', borderColor: '#f5fcff' },
  tabText: { color: '#000000', fontWeight: '700', fontSize: 15 },
  tabTextActive: { color: '#000000', fontSize: 15, fontWeight: '700' },
  headerAction: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  headerActionText: { color: '#2563eb', fontWeight: '700' },
  medList: { padding: 12, paddingBottom: 36 },
  timelineList: { padding: 12, paddingBottom: 36 },
  emptyTimelineContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyTimelineIcon: { fontSize: 50, marginBottom: 12 },
  emptyTimelineTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  emptyTimelineDesc: { fontSize: 12, color: '#999', textAlign: 'center', maxWidth: 200 },
  medRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  medInfo: { flex: 1, marginRight: 12 },
  medName: { fontSize: 14, fontWeight: '700', color: '#223' },
  medDetail: { color: '#556', marginTop: 4 },
  medTimeSmall: { color: '#889', marginTop: 6, fontSize: 11 },
  medNotes: { color: '#666', marginTop: 6, fontSize: 11, fontStyle: 'italic', backgroundColor: '#f0f9ff', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  medActions: { flexDirection: 'row' },
  smallButton: { backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginLeft: 8 },
  smallButtonText: { color: '#fff', fontWeight: '600' },
  ghostButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#dbeafe' },
  ghostButtonText: { color: '#1e40af' },
  timelineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8, backgroundColor: '#fff', marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  timelineInfo: { flex: 1 },
  timelineActions: { flexDirection: 'row' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, marginLeft: 8 },
  actionText: { color: '#fff', fontWeight: '600' },
  timelineCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 10, backgroundColor: '#fff', marginBottom: 12, borderLeftWidth: 5, borderLeftColor: '#2563eb', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  timelineStatusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, marginRight: 12, minWidth: 85 },
  timelineStatusLabel: { color: '#fff', fontWeight: '700', fontSize: 11, textAlign: 'center' },
  timelineContent: { flex: 1 },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  timelineDate: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  timelineTime: { fontSize: 11, color: '#999', fontWeight: '600' },
  timelineMedName: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 4 },
  timelineDose: { fontSize: 11, color: '#666', marginTop: 2 },
  timelineActionButtons: { flexDirection: 'row', gap: 6, marginLeft: 10 },
  timelineActionBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  timelineActionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Larger timeline card styles
  timelineCardLarge: { position: 'relative', padding: 10, borderRadius: 12, backgroundColor: '#fff', marginBottom: 8, borderLeftWidth: 6, borderLeftColor: '#2563eb', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  timelineStatusBadgeLarge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, position: 'relative', zIndex: 3 },
  timelineStatusLabelLarge: { color: '#fff', fontWeight: '700', fontSize: 11, textAlign: 'center' },
  timelineContentLarge: { flex: 1 },
  timelineHeaderLarge: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, gap: 6 },
  timelineDateLarge: { fontSize: 14, fontWeight: '700', color: '#2563eb' },
  timelineTimeLarge: { fontSize: 12, color: '#999', fontWeight: '600' },
  timelineTimeInline: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  timelineReasonLarge: { fontSize: 11, color: '#b45309', fontWeight: '600', marginTop: 1 },
  timelineMedNameLarge: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 1 },
  timelineDoseLarge: { fontSize: 13, color: '#666', marginTop: 1, marginBottom: 2 },
  timelineClickHint: { fontSize: 10, color: '#2563eb', fontWeight: '600', marginTop: 1 },
  timelineHoverHintBubble: { position: 'absolute', top: -34, left: '50%', transform: [{ translateX: -92 }], zIndex: 20, backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 184, alignItems: 'center' },
  timelineHoverHintText: { color: '#eff6ff', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  timelineHoverHintPointer: { position: 'absolute', bottom: -6, left: '50%', marginLeft: -6, width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#2563eb' },
  timelineMultiSelectRowUnderPrompt: { marginTop: 6, alignItems: 'flex-start' },
  timelineMultiSelectStacked: { position: 'absolute', top: 32, right: 0, minWidth: 70, minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 6, backgroundColor: '#f8fbff' },
  timelineMultiSelectButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 6, paddingVertical: 5, borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 6, backgroundColor: '#f8fbff' },
  timelineMultiSelectCheckbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 2, borderColor: '#93c5fd', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  timelineMultiSelectCheckboxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  timelineMultiSelectCheckmark: { color: '#fff', fontSize: 10, fontWeight: '800' },
  timelineMultiSelectLabel: { marginLeft: 6, fontSize: 9, fontWeight: '700', color: '#1d4ed8' },
  timelineMultiSelectBar: { marginHorizontal: 12, marginTop: 10, marginBottom: 2, backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineMultiSelectTitle: { fontSize: 12, fontWeight: '800', color: '#1e3a8a', marginBottom: 2 },
  timelineMultiSelectSummary: { fontSize: 11, color: '#1d4ed8', fontWeight: '600' },
  timelineMultiSelectAction: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  timelineMultiSelectActionText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  timelineMultiSelectClear: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 8, borderWidth: 1, borderColor: '#93c5fd', backgroundColor: '#fff' },
  timelineMultiSelectClearText: { color: '#1e40af', fontSize: 11, fontWeight: '700' },
  historyRow: { padding: 12, borderRadius: 8, backgroundColor: '#f9fafb', marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },

  // modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxWidth: 520, backgroundColor: '#fff', borderRadius: 10, padding: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  modalTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  modalLabel: { fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 8, color: '#333' },
  modalInput: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, marginBottom: 10 },
  multilineInput: { minHeight: 60, textAlignVertical: 'top' },
  genderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  genderButton: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', borderRadius: 6, paddingVertical: 8, alignItems: 'center' },
  genderButtonSelected: { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
  genderButtonText: { fontWeight: '600', color: '#333', fontSize: 12 },
  genderButtonTextSelected: { color: '#1e40af' },
  slotBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 10, marginRight: 8, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  slotBtnActive: { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
  slotText: { fontWeight: '600', color: '#244' },
  slotTextActive: { color: '#1e40af' },
  slotTime: { color: '#889', fontSize: 11, marginTop: 6 },
  slotTag: { fontSize: 11, color: '#1e40af', fontWeight: '600' },
  scheduleTypeButton: { flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  scheduleTypeButtonActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  scheduleTypeButtonText: { fontSize: 12, fontWeight: '700', color: '#666', marginBottom: 2 },
  scheduleTypeButtonTextActive: { color: '#2563eb' },
  scheduleTypeDesc: { fontSize: 9, color: '#999', fontWeight: '500' },
  scheduleTypeDescActive: { color: '#1e40af' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  modalBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6, marginLeft: 8 },
  modalCancel: { backgroundColor: '#e5e7eb' },
  modalSave: { backgroundColor: '#2563eb' },
  modalBtnText: { fontWeight: '600', color: '#102a43' },
  
  // Administration modal styles
  adminModalHeader: { marginBottom: 12 },
  adminModalSubtitle: { fontSize: 12, color: '#666', fontWeight: '600', marginTop: 4 },
  adminStatusButtons: { marginBottom: 20 },
  adminStatusButton: { backgroundColor: '#f9fafb', padding: 16, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#2563eb' },
  adminStatusButtonLabel: { fontSize: 14, fontWeight: '700', color: '#2563eb', marginBottom: 4 },
  adminStatusButtonDesc: { fontSize: 12, color: '#666' },
  adminFormSection: { marginBottom: 20 },
  adminFormLabel: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 10 },
  adminFormInput: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 },
  adminTimeInput: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 },
  reasonOption: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  reasonOptionSelected: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  reasonOptionText: { fontSize: 13, color: '#333', fontWeight: '600' },
  reasonOptionTextSelected: { color: '#2563eb' },
  
  // Day divider styles
  dayDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, marginHorizontal: 12 },
  dayDividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dayDividerText: { fontSize: 12, fontWeight: '600', color: '#2563eb', marginHorizontal: 12, paddingHorizontal: 8, backgroundColor: '#fff' },

  // Date picker styles
  pickerOption: { paddingHorizontal: 10, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  pickerOptionSelected: { backgroundColor: '#dbeafe' },
  pickerOptionText: { fontSize: 13, color: '#333', fontWeight: '600' },
  pickerOptionTextSelected: { color: '#2563eb', fontWeight: '700' },

  // Error correction modal styles
  errorCorrectionOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center' },
  errorCorrectionModal: { backgroundColor: '#fff', borderRadius: 12, width: '90%', maxWidth: 480, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  errorCorrectionHeader: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  errorCorrectionTitle: { fontSize: 16, fontWeight: '700', color: '#dc2626', marginBottom: 4 },
  errorCorrectionSubtitle: { fontSize: 12, color: '#666', fontWeight: '500' },
  errorCorrectionContent: { paddingHorizontal: 16, paddingVertical: 14, maxHeight: 300 },
  errorField: { marginBottom: 16 },
  errorLabel: { fontSize: 12, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  errorDropdown: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', justifyContent: 'center' },
  errorDropdownText: { fontSize: 13, color: '#1f2937', fontWeight: '500' },
  errorInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, backgroundColor: '#fff', color: '#1f2937' },
  errorTextArea: { minHeight: 80, paddingTop: 10, textAlignVertical: 'top' },
  errorActions: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  errorCancel: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingVertical: 10, alignItems: 'center' },
  errorSubmit: { flex: 1, backgroundColor: '#dc2626', borderRadius: 6, paddingVertical: 10, alignItems: 'center' },
  errorActionText: { fontSize: 13, fontWeight: '700', color: '#dc2626' },
  
  // Error reason dropdown styles
  errorDropdownOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center' },
  errorDropdownModal: { backgroundColor: '#fff', borderRadius: 10, width: '90%', maxWidth: 400, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  errorDropdownHeader: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  errorDropdownTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  errorReasonOption: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  errorReasonOptionSelected: { backgroundColor: '#fef2f2' },
  errorReasonOptionText: { fontSize: 13, color: '#1f2937', fontWeight: '500' },
  errorReasonOptionTextSelected: { color: '#dc2626', fontWeight: '700' },
  errorDropdownClose: { paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  errorDropdownCloseText: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
});
