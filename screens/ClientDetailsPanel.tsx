import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, Image, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import JSZip from 'jszip';
import { Client, Medication, loadData, updateMedication, addAdministrationRecord, updateClient, deleteClient } from '../src/storage';
import { AddMedicationModal } from './AddMedicationScreen';
import { AdminRecordModal } from '../src/components/AdminRecordModal';
import { TimelineList } from '../src/components/TimelineList';
import { HistoryList } from '../src/components/HistoryList';
import { DeleteConfirmModal } from '../src/components/DeleteConfirmModal';
import { getSlotNameFromTime, getAdministrationStatus } from '../src/utils/medicationTimingHelpers';
import { formatIsoDate, toIsoDate } from '../src/dateTimeUtils';
import { safeParseInt } from '../src/validation';
import { logError, showError, showSuccess } from '../src/errorHandling';

type Props = {
  client: Client | null;
  locationId?: string;
  navigation?: any;
  onClientUpdated?: () => void;
};

export default function ClientDetailsPanel({ client, locationId, navigation, onClientUpdated }: Props) {

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
  const [editFrequencyType, setEditFrequencyType] = useState<'daily' | 'every-second-day' | 'weekly' | 'fortnightly'>('daily');
  const [editCustomTimes, setEditCustomTimes] = useState<string[]>([]);
  const [editMinTimeBetweenDoses, setEditMinTimeBetweenDoses] = useState('');
  const [editMaxDosePerAdministration, setEditMaxDosePerAdministration] = useState('');
  const [editMaxDosePer24Hours, setEditMaxDosePer24Hours] = useState('');
  const [editTabletsToBeGiven, setEditTabletsToBeGiven] = useState('');
  const [editMultipleDosesPerTablet, setEditMultipleDosesPerTablet] = useState(false);
  const [editDosePerTablet2, setEditDosePerTablet2] = useState('');
  
  const [editingClient, setEditingClient] = useState(false);
  const [clientDraft, setClientDraft] = useState<{ name: string; dob?: string; allergies?: string; gender?: string; weight?: string; contactEmail?: string; gp?: string; gpClinic?: string; medicareNumber?: string; photoUri?: string }>({ name: client?.name || '', dob: client?.dob || '', allergies: client?.allergies || '', gender: client?.gender || '', weight: client?.weight || '', contactEmail: client?.contactEmail || '', gp: client?.gp || '', gpClinic: client?.gpClinic || '', medicareNumber: client?.medicareNumber || '', photoUri: client?.photoUri || '' });
  
  // Administration recording modal state
  const [recordingAdmin, setRecordingAdmin] = useState(false);
  const [adminRecord, setAdminRecord] = useState<{ medId: string; time: string; medName: string } | null>(null);
  const [adminStatus, setAdminStatus] = useState<'given' | 'not-given' | 'third-party' | null>(null);
  const [givenTime, setGivenTime] = useState('');
  const [notGivenReason, setNotGivenReason] = useState<'refused' | 'out-of-stock' | 'missed' | 'schedule-conflict' | 'other' | ''>('');
  const [otherReason, setOtherReason] = useState('');
  const [administeredBy, setAdministeredBy] = useState('');
  
  // New administration recording fields
  const [adminScheduledTime, setAdminScheduledTime] = useState('');
  const [adminActualTime, setAdminActualTime] = useState('');
  const [adminTabletsGiven, setAdminTabletsGiven] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // PRN warning modal state
  const [showPrnWarning, setShowPrnWarning] = useState(false);
  const [prnWarningMessage, setPrnWarningMessage] = useState('');

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
  
  // History search state
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Refresh local client state when selection changes
  useEffect(() => {
    setLocalClient(client ?? null);
    setClientDraft({
      name: client?.name || '',
      dob: client?.dob || '',
      allergies: client?.allergies || '',
      gender: client?.gender || '',
      weight: client?.weight || '',
      contactEmail: client?.contactEmail || '',
      gp: client?.gp || '',
      gpClinic: client?.gpClinic || '',
      medicareNumber: client?.medicareNumber || '',
      photoUri: client?.photoUri || ''
    });
    setTab('timeline');
    setEditing(false);
    setEditingClient(false);
  }, [client?.id]);

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

  const canSaveAdmin =
    !!adminStatus &&
    !(
      (adminStatus === 'given' && (!adminTabletsGiven || !adminActualTime)) ||
      (adminStatus === 'not-given' && notGivenReason === '')
    );

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
    setEditPrn(!!med.prn);
    setEditFrequencyType(med.frequencyType || 'daily');
    setEditTabletsToBeGiven(((med.totalDose && med.dosePerTablet) ? (parseFloat(med.totalDose) / parseFloat(med.dosePerTablet)).toString() : '') || '');
    setEditMultipleDosesPerTablet(!!med.multipleDosesPerTablet);
    setEditDosePerTablet2(med.dosePerTablet2 || '');
    setEditMinTimeBetweenDoses(med.prnVariableMinHoursBetween?.toString() || '');
    setEditMaxDosePerAdministration(med.prnVariableMaxDosePerAdministration?.toString() || '');
    setEditMaxDosePer24Hours(med.prnVariableMaxDosePer24Hours?.toString() || '');
    setEditing(true);
  }

  async function saveEdit() {
    if (!editMed || !locationId || !localClient) return;
    
    // Calculate total dose from tablets to be given and dose per tablet
    if (editTabletsToBeGiven && editMed.dosePerTablet) {
      editMed.totalDose = (parseFloat(editTabletsToBeGiven) * parseFloat(editMed.dosePerTablet)).toString();
    }
    
    // update scheduledTimes from slots and custom times
    editMed.scheduledTimes = editFrequencyType === 'daily' && !editPrn ? makeScheduledTimesFromSlots(slots, editCustomTimes) : [];
    editMed.prn = !!editPrn;
    editMed.frequencyType = editFrequencyType !== 'daily' ? editFrequencyType : undefined;
    editMed.startTime = toIsoDate(editStartDate);
    editMed.endTime = toIsoDate(editEndDate);
    
    // Handle subcutaneous injection
    if (editMed.route === 'Subcutaneous injection') {
      editMed.dosePerTablet = undefined;
      editMed.dosePerTablet2 = undefined;
      editMed.multipleDosesPerTablet = undefined;
    } else {
      editMed.multipleDosesPerTablet = editMultipleDosesPerTablet || undefined;
      editMed.dosePerTablet2 = editMultipleDosesPerTablet ? editDosePerTablet2 : undefined;
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
    
    if (stockCount > 0) {
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
    if (!localClient || !historySearchQuery.trim()) {
      const allRecords = Array.from(localClient?.medications || [])
        .flatMap(m => (m.administrationRecords || []).map(r => ({ medName: m.name, ...r })));
      const archivedRecords = Array.from(localClient?.archivedMedicationHistory || []).flatMap(archived =>
        (archived.records || []).map(r => ({ medName: archived.medName, time: r.time, status: r.status as any, actualTime: r.actualTime, reason: r.reason }))
      );
      return allRecords.concat(archivedRecords as any);
    }
    
    const query = historySearchQuery.toLowerCase();
    const allRecords = Array.from(localClient?.medications || [])
      .flatMap(m => (m.administrationRecords || []).map(r => ({ medName: m.name, ...r })));
    const archivedRecords = Array.from(localClient?.archivedMedicationHistory || []).flatMap(archived =>
      (archived.records || []).map(r => ({ medName: archived.medName, time: r.time, status: r.status as any, actualTime: r.actualTime, reason: r.reason }))
    );
    
    return allRecords.concat(archivedRecords as any)
      .filter(record => 
        record.medName.toLowerCase().includes(query) ||
        record.status.toLowerCase().includes(query) ||
        (record.reason && record.reason.toLowerCase().includes(query))
      );
  }

  async function markAdministration(medId: string, timeIso: string, status: 'given' | 'missed') {
    if (!locationId || !localClient) return;
    try {
      await addAdministrationRecord(locationId, localClient.id, medId, timeIso, status);
      await refreshLocal();
    } catch (e) {
      logError(e, 'Mark Administration');
      showError(e, 'Failed to record administration');
    }
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
    if (!locationId || !localClient) return;
    const updated: Client = { 
      ...localClient, 
      name: clientDraft.name, 
      dob: clientDraft.dob, 
      allergies: clientDraft.allergies,
      gender: clientDraft.gender as any,
      weight: clientDraft.weight,
      contactEmail: clientDraft.contactEmail,
      gp: clientDraft.gp,
      gpClinic: clientDraft.gpClinic,
      medicareNumber: clientDraft.medicareNumber,
      photoUri: clientDraft.photoUri || undefined,
    };
    try {
      await updateClient(locationId, updated);
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
      const record = (localClient.medications || [])
        .flatMap(m => (m.administrationRecords || []).map(r => ({ ...r, medId: m.id })))
        .find(r => r.medId === errorCorrectionRecord.medId && r.time === errorCorrectionRecord.time);

      if (record) {
        // Delete the incorrect "given" record
        const med = localClient.medications?.find(m => m.id === errorCorrectionRecord.medId);
        if (med) {
          const updatedRecords = (med.administrationRecords || []).filter(r => r.time !== errorCorrectionRecord.time);
          const updatedMed = { ...med, administrationRecords: updatedRecords };
          await updateMedication(locationId, localClient.id, updatedMed);
        }
      }

      // Log the error correction
      const originalScheduledTime = new Date(errorCorrectionRecord.time).toLocaleString();
      const correctionTime = new Date().toLocaleString();
      const errorLog = `Error correction: ${errorReason}${errorNotes ? ` - ${errorNotes}` : ''} | Marked as error: ${correctionTime} | Originally scheduled: ${originalScheduledTime}`;
      await addAdministrationRecord(locationId, localClient.id, errorCorrectionRecord.medId, errorCorrectionRecord.time, 'missed', undefined, errorLog);

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

  async function saveAdministrationRecord(bypassPrnLimit?: boolean) {
    if (!adminRecord || !adminStatus || !locationId || !localClient) {
      console.log('[SAVE_ADMIN] Early return - missing required data:', { adminRecord: !!adminRecord, adminStatus, locationId: !!locationId, localClient: !!localClient });
      return;
    }
    
    try {
      console.log('[SAVE_ADMIN] Starting save attempt. Status:', adminStatus, 'Tablets:', adminTabletsGiven, 'ActualTime:', adminActualTime);
      
      if (adminStatus === 'given' || adminStatus === 'third-party') {
        // Validate that tablets given is provided
        if (!adminTabletsGiven) {
          Alert.alert('Validation', 'Please enter the number of tablets/capsules given');
          return;
        }
        
        // Validate that actual time is provided
        if (!adminActualTime) {
          Alert.alert('Validation', 'Please record the actual time the medication was given');
          return;
        }

        // Enforce PRN limits (max per day and minimum hours apart)
        console.log('[SAVE_ADMIN] Loading fresh data for PRN check...');
        const freshData = await loadData();
        console.log('[SAVE_ADMIN] Fresh data loaded. Locations:', freshData.length);
        
        const freshLoc = freshData.find(l => l.id === locationId);
        console.log('[SAVE_ADMIN] Fresh location found?', !!freshLoc);
        
        const freshClient = freshLoc?.clients.find(c => c.id === localClient.id);
        console.log('[SAVE_ADMIN] Fresh client found?', !!freshClient, 'medications:', freshClient?.medications?.length);
        
        const prnMed = freshClient?.medications?.find(m => m.id === adminRecord.medId) || localClient.medications?.find(m => m.id === adminRecord.medId);
        console.log('[SAVE_ADMIN] Med lookup - Fresh found?', !!freshClient?.medications?.find(m => m.id === adminRecord.medId), 'Fallback found?', !!localClient.medications?.find(m => m.id === adminRecord.medId));
        
        console.log('[SAVE_ADMIN] Med found:', prnMed?.name, 'PRN:', prnMed?.prn, 'bypassPrnLimit:', bypassPrnLimit);
        console.log('[SAVE_ADMIN] Will run PRN check?', (prnMed?.prn && !bypassPrnLimit) ? 'YES' : 'NO - Condition failed');
        
        if (prnMed?.prn && !bypassPrnLimit) {
          console.log('[PRN_CHECK] ✅ ENTERING PRN CHECK LOGIC');
          const newTimeMs = new Date(adminActualTime || adminRecord.time).getTime();
          const tabletsGivenNow = parseFloat(adminTabletsGiven);
          
          if (!isNaN(newTimeMs)) {
            const givenRecords = (prnMed.administrationRecords || []).filter(r => r.status === 'given');
            const recordTimes = givenRecords
              .map(r => new Date(r.actualTime || r.time).getTime())
              .filter(t => !isNaN(t));

            console.log(`[PRN_CHECK] Med: ${prnMed.name}, New time (ms): ${newTimeMs} (${new Date(newTimeMs).toISOString()})`);
            console.log(`[PRN_CHECK] Existing doses (${recordTimes.length}):`, recordTimes.map(t => ({ ms: t, iso: new Date(t).toISOString() })));

            // Variable PRN restrictions check (for medications with variable doses)
            if (prnMed.prnVariableMinHoursBetween || prnMed.prnVariableMaxDosePerAdministration || prnMed.prnVariableMaxDosePer24Hours) {
              console.log('[PRN_CHECK] Checking variable PRN restrictions...');
              
              // Check max dose per administration
              if (prnMed.prnVariableMaxDosePerAdministration && tabletsGivenNow > prnMed.prnVariableMaxDosePerAdministration) {
                const msg = `${prnMed.name} cannot exceed ${prnMed.prnVariableMaxDosePerAdministration} tablet${prnMed.prnVariableMaxDosePerAdministration === 1 ? '' : 's'} per administration. You entered ${tabletsGivenNow} tablet${tabletsGivenNow === 1 ? '' : 's'}.`;
                console.log('[PRN_CHECK] ⚠️ MAX DOSE PER ADMIN VIOLATION!');
                setPrnWarningMessage(msg);
                setShowPrnWarning(true);
                return;
              }

              // Check minimum time between doses
              if (prnMed.prnVariableMinHoursBetween && prnMed.prnVariableMinHoursBetween > 0 && recordTimes.length > 0) {
                const lastTimeMs = Math.max(...recordTimes);
                const timeSinceLastMs = newTimeMs - lastTimeMs;
                const hoursSinceLast = timeSinceLastMs / (1000 * 60 * 60);
                console.log(`[PRN_CHECK] Variable - Last dose: ${new Date(lastTimeMs).toISOString()}, hours since: ${hoursSinceLast.toFixed(1)}, min required: ${prnMed.prnVariableMinHoursBetween}`);
                
                if (hoursSinceLast < prnMed.prnVariableMinHoursBetween) {
                  const msg = `${prnMed.name} doses must be at least ${prnMed.prnVariableMinHoursBetween} hour${prnMed.prnVariableMinHoursBetween === 1 ? '' : 's'} apart. The last dose was ${hoursSinceLast.toFixed(1)} hour${hoursSinceLast.toFixed(1) === '1.0' ? '' : 's'} ago.`;
                  console.log('[PRN_CHECK] ⚠️ VARIABLE MIN-HOURS VIOLATION!');
                  setPrnWarningMessage(msg);
                  setShowPrnWarning(true);
                  return;
                }
              }

              // Check max tablets in 24 hours
              if (prnMed.prnVariableMaxDosePer24Hours && prnMed.prnVariableMaxDosePer24Hours > 0) {
                const twentyFourHoursAgo = newTimeMs - (24 * 60 * 60 * 1000);
                const recentRecords = givenRecords.filter(r => {
                  const recTime = new Date(r.actualTime || r.time).getTime();
                  return !isNaN(recTime) && recTime >= twentyFourHoursAgo;
                });
                
                // Sum up tablets given in last 24 hours (parsing from notes or using default calculation)
                let tabletsInLast24Hours = 0;
                for (const rec of recentRecords) {
                  // Try to extract tablets from the record - this is a simplified approach
                  // In a real scenario, you'd want to store tablets given in the record itself
                  const recMed = prnMed;
                  if (recMed.totalDose && recMed.dosePerTablet) {
                    const calculated = parseFloat(recMed.totalDose) / parseFloat(recMed.dosePerTablet);
                    if (!isNaN(calculated) && isFinite(calculated)) {
                      tabletsInLast24Hours += calculated;
                    }
                  }
                }
                
                const totalAfterThisDose = tabletsInLast24Hours + tabletsGivenNow;
                console.log(`[PRN_CHECK] Variable - Tablets in last 24hrs: ${tabletsInLast24Hours}, this dose: ${tabletsGivenNow}, total would be: ${totalAfterThisDose}, limit: ${prnMed.prnVariableMaxDosePer24Hours}`);
                
                if (totalAfterThisDose > prnMed.prnVariableMaxDosePer24Hours) {
                  const msg = `${prnMed.name} cannot exceed ${prnMed.prnVariableMaxDosePer24Hours} tablet${prnMed.prnVariableMaxDosePer24Hours === 1 ? '' : 's'} in 24 hours. Currently ${tabletsInLast24Hours} tablet${tabletsInLast24Hours === 1 ? '' : 's'} have been given in the last 24 hours. This dose would bring the total to ${totalAfterThisDose} tablet${totalAfterThisDose === 1 ? '' : 's'}.`;
                  console.log('[PRN_CHECK] ⚠️ 24-HOUR LIMIT VIOLATION!');
                  setPrnWarningMessage(msg);
                  setShowPrnWarning(true);
                  return;
                }
              }
            }

            console.log('[PRN_CHECK] ✅ All PRN checks passed');
          } else {
            console.log('[PRN_CHECK] ❌ Invalid newTimeMs:', newTimeMs);
          }
        } else {
          console.log('[PRN_CHECK] ❌ Skipping PRN check - PRN:', prnMed?.prn, 'bypassPrnLimit:', bypassPrnLimit);
        }
        
        // Record against the scheduled time with the actual time taken
        console.log('[SAVE_ADMIN] PRN checks passed. Recording administration...');
        await addAdministrationRecord(locationId, localClient.id, adminRecord.medId, adminRecord.time, 'given', adminActualTime);
        console.log('[SAVE_ADMIN] Administration recorded.');
        
        // Re-fetch fresh data from storage to get updated medication with new administration record
        const data = await loadData();
        const loc = data.find(l => l.id === locationId);
        const client = loc?.clients.find(c => c.id === localClient.id);
        const med = client?.medications?.find(m => m.id === adminRecord.medId);
        
        // Decrease stock if medication has stock tracking
        if (med && med.stock !== undefined && med.stock > 0) {
          const tabletsToDeduct = safeParseInt(adminTabletsGiven, 0);
          if (tabletsToDeduct > 0) {
            const updatedMed = { ...med, stock: Math.max(0, med.stock - tabletsToDeduct) };
            await updateMedication(locationId, localClient.id, updatedMed);
          }
        }
      } else {
        const reason = notGivenReason === 'other' ? otherReason : notGivenReason;
        const scheduledTime = new Date(adminRecord.time).toLocaleString();
        const markedTime = new Date().toLocaleString();
        const detailedReason = [
          `Reason: ${reason}`,
          `Marked as not given: ${markedTime}`,
          `Originally scheduled: ${scheduledTime}`,
          `Scheduled slot: ${adminScheduledTime}`
        ].join(' | ');
        await addAdministrationRecord(locationId, localClient.id, adminRecord.medId, adminRecord.time, 'missed', undefined, detailedReason);
      }
      
      // Clear all state
      setRecordingAdmin(false);
      setAdminRecord(null);
      setAdminStatus(null);
      setGivenTime('');
      setNotGivenReason('');
      setOtherReason('');
      setAdministeredBy('');
      setAdminScheduledTime('');
      setAdminActualTime('');
      setAdminTabletsGiven('');
      setAdminNotes('');
      
      // Refresh data from storage
      await refreshLocal();
      
      console.log('[SAVE_ADMIN] Success!');
      showSuccess('Medication recorded successfully');
    } catch (e) {
      console.error('[SAVE_ADMIN] Error:', e);
      logError(e, 'Save Administration Record');
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

  function handleTimelineRecord(item: { medId: string; medName: string; time: string; totalDose?: string; med: Medication }) {
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
      setAdminScheduledTime(getSlotNameFromTime(item.time));
      setRecordingAdmin(true);
      setAdminStatus(null);
      setAdminActualTime('');
      setAdminTabletsGiven(calculatedTablets);
      setAdminNotes('');
    }
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
          <TouchableOpacity onPress={() => { setClientDraft({ name: localClient.name, dob: localClient.dob || '', allergies: localClient.allergies || '', gender: localClient.gender, weight: localClient.weight, contactEmail: localClient.contactEmail, gp: localClient.gp || '', gpClinic: localClient.gpClinic || '', medicareNumber: localClient.medicareNumber || '', photoUri: localClient.photoUri || '' }); setEditingClient(true); }} style={[styles.headerAction, { marginRight: 8 }]}> 
            <Text style={styles.headerActionText}>Edit Client</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={downloadSummary} style={[styles.headerAction, { marginRight: 8 }]}> 
            <Text style={styles.headerActionText}>Download Summary</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('StockManagement', { clientId: localClient.id, locationId, clientName: localClient.name })} style={[styles.headerAction, { marginRight: 8 }]}>
            <Text style={styles.headerActionText}>Stock Management</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAddMedication(true)} style={styles.headerAction}>
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
                <Text style={styles.medName}>{item.name}</Text>
                {item.totalDose ? <Text style={styles.medDetail}>{item.totalDose}</Text> : null}
                {item.dosePerTablet ? <Text style={styles.medDetail}>Per tablet: {item.dosePerTablet}</Text> : null}
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
                      setAdminScheduledTime('PRN');
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
        <TimelineList meds={meds} styles={styles} onRecord={handleTimelineRecord} />
      )}

      {tab === 'history' && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            <TextInput
              placeholder="Search history (medication, status, reason)..."
              value={historySearchQuery}
              onChangeText={setHistorySearchQuery}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: '#d1d5db',
                fontSize: 13,
                backgroundColor: '#f9fafb',
              }}
            />
          </View>
          <HistoryList client={localClient} styles={styles} filteredRecords={getFilteredHistoryRecords()} />
        </View>
      )}

      <AdminRecordModal
        visible={recordingAdmin && !!adminRecord}
        adminRecord={adminRecord}
        adminStatus={adminStatus}
        setAdminStatus={setAdminStatus}
        adminScheduledTime={adminScheduledTime}
        adminActualTime={adminActualTime}
        setAdminActualTime={setAdminActualTime}
        adminTabletsGiven={adminTabletsGiven}
        setAdminTabletsGiven={setAdminTabletsGiven}
        adminNotes={adminNotes}
        setAdminNotes={setAdminNotes}
        administeredBy={administeredBy}
        setAdministeredBy={setAdministeredBy}
        notGivenReason={notGivenReason}
        setNotGivenReason={setNotGivenReason}
        otherReason={otherReason}
        setOtherReason={setOtherReason}
        medRoute={localClient?.medications?.find(m => m.id === adminRecord?.medId)?.route}
        isPrn={!!localClient?.medications?.find(m => m.id === adminRecord?.medId)?.prn}
        onCancel={() => {
          setAdminStatus(null);
          if (!adminStatus) setRecordingAdmin(false);
        }}
        onSave={saveAdministrationRecord}
        canSave={canSaveAdmin}
        styles={styles}
      />

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
                onChangeText={(v) => setEditMed(m => m ? { ...m, route: v, dosePerTablet: v === 'Subcutaneous injection' ? '' : (m?.dosePerTablet || ''), dosePerTablet2: v === 'Subcutaneous injection' ? '' : (m?.dosePerTablet2 || ''), multipleDosesPerTablet: v === 'Subcutaneous injection' ? false : m?.multipleDosesPerTablet } : m)} 
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
                        setEditMed(m => m ? { ...m, dosePerTablet2: '' } : m);
                      }
                    }}
                  >
                    <View style={{ width: 18, height: 18, borderWidth: 2, borderColor: '#3b82f6', borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginRight: 10, backgroundColor: editMultipleDosesPerTablet ? '#3b82f6' : '#fff' }}>
                      {editMultipleDosesPerTablet && <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
                    </View>
                    <Text style={{ fontSize: 12, color: '#333', flex: 1 }}>
                      There is more than one medication per {editMed?.route === 'Oral tablet' ? 'tablet' : editMed?.route === 'Oral capsule' ? 'capsule' : 'unit'}
                    </Text>
                  </TouchableOpacity>
                  
                  {/* Second dose per tablet field */}
                  {editMultipleDosesPerTablet && (
                    <>
                      <Text style={styles.modalLabel}>
                        Second {editMed?.route === 'Oral tablet' ? 'Dose per Tablet' : editMed?.route === 'Oral capsule' ? 'Dose per Capsule' : 'Dose per Unit'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <TextInput 
                          value={editDosePerTablet2} 
                          onChangeText={(v) => {
                            setEditDosePerTablet2(v);
                            setEditMed(m => m ? { ...m, dosePerTablet2: v } : m);
                          }} 
                          style={[styles.modalInput, { flex: 1, marginRight: 8 }]} 
                          placeholder="e.g., 500"
                          keyboardType="decimal-pad"
                        />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#333' }}>{editMed?.unit || 'mg'}</Text>
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
                      {editMed?.route === 'Oral tablet' ? 'Dose per Tablet' : editMed?.route === 'Oral capsule' ? 'Dose per Capsule' : 'Dose per Unit'}
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
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity 
                  style={[styles.scheduleTypeButton, !editPrn && styles.scheduleTypeButtonActive]}
                  onPress={() => setEditPrn(false)}
                >
                  <Text style={[styles.scheduleTypeButtonText, !editPrn && styles.scheduleTypeButtonTextActive]}>⏰ Regular</Text>
                  <Text style={[styles.scheduleTypeDesc, !editPrn && styles.scheduleTypeDescActive]}>Set times</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.scheduleTypeButton, editPrn && styles.scheduleTypeButtonActive]}
                  onPress={() => setEditPrn(true)}
                >
                  <Text style={[styles.scheduleTypeButtonText, editPrn && styles.scheduleTypeButtonTextActive]}>📋 PRN</Text>
                  <Text style={[styles.scheduleTypeDesc, editPrn && styles.scheduleTypeDescActive]}>As needed</Text>
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
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                    {[
                      { key: 'daily', label: 'Every Day' },
                      { key: 'every-second-day', label: 'Every 2nd Day' },
                      { key: 'weekly', label: 'Weekly' },
                      { key: 'fortnightly', label: 'Fortnightly' }
                    ].map(freq => (
                      <TouchableOpacity
                        key={freq.key}
                        onPress={() => setEditFrequencyType(freq.key as any)}
                        style={[
                          { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1.5, borderColor: editFrequencyType === freq.key ? '#2563eb' : '#d1d5db', backgroundColor: editFrequencyType === freq.key ? '#dbeafe' : '#f9fafb', flex: 1, minWidth: '47%' },
                        ]}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: editFrequencyType === freq.key ? '#2563eb' : '#666', textAlign: 'center' }}>{freq.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {editFrequencyType === 'daily' && (
                    <>
                      <Text style={{ fontWeight: '600', marginBottom: 8, color: '#333', fontSize: 12 }}>Select Times</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 6 }}>
                        <TouchableOpacity onPress={() => setSlots(s => ({ ...s, beforeBreakfast: !s.beforeBreakfast }))} style={[styles.slotBtn, slots.beforeBreakfast && styles.slotBtnActive]}>
                          <Text style={[styles.slotText, slots.beforeBreakfast && styles.slotTextActive]}>Before breakfast</Text>
                          <Text style={[styles.slotTime, slots.beforeBreakfast && styles.slotTextActive]}>07:30</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setSlots(s => ({ ...s, breakfast: !s.breakfast }))} style={[styles.slotBtn, slots.breakfast && styles.slotBtnActive]}>
                          <Text style={[styles.slotText, slots.breakfast && styles.slotTextActive]}>Breakfast</Text>
                          <Text style={[styles.slotTime, slots.breakfast && styles.slotTextActive]}>08:00</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 6 }}>
                        <TouchableOpacity onPress={() => setSlots(s => ({ ...s, lunch: !s.lunch }))} style={[styles.slotBtn, slots.lunch && styles.slotBtnActive]}>
                          <Text style={[styles.slotText, slots.lunch && styles.slotTextActive]}>Lunch</Text>
                          <Text style={[styles.slotTime, slots.lunch && styles.slotTextActive]}>12:00</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setSlots(s => ({ ...s, dinner: !s.dinner }))} style={[styles.slotBtn, slots.dinner && styles.slotBtnActive]}>
                          <Text style={[styles.slotText, slots.dinner && styles.slotTextActive]}>Dinner</Text>
                          <Text style={[styles.slotTime, slots.dinner && styles.slotTextActive]}>18:00</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 12 }}>
                        <TouchableOpacity onPress={() => setSlots(s => ({ ...s, beforeBed: !s.beforeBed }))} style={[styles.slotBtn, slots.beforeBed && styles.slotBtnActive, { width: '48%' }]}>
                          <Text style={[styles.slotText, slots.beforeBed && styles.slotTextActive]}>Before Bed</Text>
                          <Text style={[styles.slotTime, slots.beforeBed && styles.slotTextActive]}>22:00</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Custom times display */}
                      {editCustomTimes.length > 0 && (
                        <View style={{ marginBottom: 12 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#333', marginBottom: 6 }}>Custom Times</Text>
                          {editCustomTimes.map((time, idx) => (
                            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, backgroundColor: '#dbeafe', borderRadius: 6, marginBottom: 4 }}>
                              <Text style={{ fontSize: 12, color: '#1e40af', fontWeight: '600' }}>{time}</Text>
                              <TouchableOpacity onPress={() => setEditCustomTimes(t => t.filter((_, i) => i !== idx))}>
                                <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 14 }}>✕</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}
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
              <TouchableOpacity 
                style={[styles.modalInput, { paddingVertical: 12, justifyContent: 'center', backgroundColor: '#f9fafb' }]}
                onPress={openEditStartDatePicker}
              >
                <Text style={{ color: editStartDate ? '#000' : '#999', fontSize: 13 }}>
                  Start date: {editStartDate || 'Not set'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalInput, { paddingVertical: 12, justifyContent: 'center', backgroundColor: '#f9fafb' }]}
                onPress={openEditEndDatePicker}
              >
                <Text style={{ color: editEndDate ? '#000' : '#999', fontSize: 13 }}>
                  End date: {editEndDate || 'Optional'}
                </Text>
              </TouchableOpacity>
              
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

      {/* Add Medication Modal */}
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

      {/* PRN Warning Modal */}
      <Modal visible={showPrnWarning} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, width: '85%', maxWidth: 400, elevation: 5 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#dc2626', marginBottom: 8 }}>⚠️ PRN Dose Limit</Text>
            <Text style={{ fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 24 }}>
              {prnWarningMessage}
            </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 12, borderRadius: 6, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setShowPrnWarning(false)}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 12, borderRadius: 6, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => {
                  setShowPrnWarning(false);
                  saveAdministrationRecord(true);
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Record Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  tabRow: { flexDirection: 'row', justifyContent: 'center', gap: 0, paddingHorizontal: 16, paddingVertical: 5, backgroundColor: '#e5e7eb', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginHorizontal: 16, marginTop: 12 },
  tabButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#e5e7eb', borderWidth: 0, flex: 1, alignItems: 'center' },
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
  timelineCardLarge: { padding: 14, borderRadius: 12, backgroundColor: '#fff', marginBottom: 12, borderLeftWidth: 6, borderLeftColor: '#2563eb', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  timelineStatusBadgeLarge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  timelineStatusLabelLarge: { color: '#fff', fontWeight: '700', fontSize: 11, textAlign: 'center' },
  timelineContentLarge: { flex: 1 },
  timelineHeaderLarge: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 },
  timelineDateLarge: { fontSize: 14, fontWeight: '700', color: '#2563eb' },
  timelineTimeLarge: { fontSize: 12, color: '#999', fontWeight: '600' },
  timelineReasonLarge: { fontSize: 11, color: '#b45309', fontWeight: '600', marginTop: 2 },
  timelineMedNameLarge: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 4 },
  timelineDoseLarge: { fontSize: 13, color: '#666', marginTop: 2, marginBottom: 4 },
  timelineClickHint: { fontSize: 11, color: '#2563eb', fontWeight: '600', marginTop: 2 },
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
