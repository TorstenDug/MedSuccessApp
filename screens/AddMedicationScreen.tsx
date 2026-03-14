import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Alert, Modal, FlatList, Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { addMedication, addAdministrationRecord } from '../src/storage';
import { getCurrentDate, getCurrentTime, getYearsArray, getHoursArray, getMinutesArray, formatDateFromParts, formatTimeFromParts, parseDateString, parseTimeString } from '../src/dateTimeUtils';

const ROUTES = [
  'Oral tablet/capsule',
  'Oral lozenges',
  'Liquid solution',
  'Topical (cream/lotion)',
  'Eye drops',
  'Subcutaneous injection',
  'Sublingual (under the tung)',
  'Other',
];

const UNITS = ['mg', 'g', 'mcg', 'ml', 'L', 'IU', 'mmol', '%', 'units'];
const INJECTION_STOCK_UNITS = ['Pens', 'single use injections', 'units', 'ml'] as const;

const MIN_HOURS_OPTIONS = [0.5, 1, 2, 3, 4, 6, 8, 12, 24];
const MAX_DOSE_PER_ADMIN_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
const MAX_DOSE_24H_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 30];
const PLACEHOLDER_TEXT_COLOR = '#94a3b8';
const SCRIPT_LOCATIONS = ['Pharmacy file', 'Home office', 'Clients possession', 'Management office', 'Other'] as const;

type AddMedicationModalProps = {
  visible: boolean;
  locationId: string;
  clientId: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export function AddMedicationModal({ visible, locationId, clientId, onClose, onSuccess }: AddMedicationModalProps) {
  const [name, setName] = useState('');
  const [medicationPurpose, setMedicationPurpose] = useState('');
  const [unit, setUnit] = useState(UNITS[0]);
  const [dosePerTablet2Unit, setDosePerTablet2Unit] = useState(UNITS[0]);
  const [dosePerTablet, setDosePerTablet] = useState('');
  const [routeSel, setRouteSel] = useState(ROUTES[0]);
  const [customRouteType, setCustomRouteType] = useState('');
  const [slots, setSlots] = useState({ beforeBreakfast: false, breakfast: false, lunch: false, dinner: false, beforeBed: false });
  const [prn, setPrn] = useState(false);
  const [courseType, setCourseType] = useState<'long-term' | 'short-term'>('long-term');
  const [notes, setNotes] = useState('');
  const [stock, setStock] = useState('');
  const [injectionStockUnit, setInjectionStockUnit] = useState<(typeof INJECTION_STOCK_UNITS)[number]>(INJECTION_STOCK_UNITS[0]);
  const [frequencyType, setFrequencyType] = useState<'daily' | 'every-second-day' | 'weekly' | 'fortnightly' | 'monthly'>('daily');
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(getCurrentDate());
  const [startTime, setStartTime] = useState(getCurrentTime());
  const [endDate, setEndDate] = useState('');
  const [noEndDate, setNoEndDate] = useState(false);
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showSecondUnitDropdown, setShowSecondUnitDropdown] = useState(false);
  const [showSlotsDropdown, setShowSlotsDropdown] = useState(false);
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
  const [showMinHoursDropdown, setShowMinHoursDropdown] = useState(false);
  const [showMaxDosePerAdminDropdown, setShowMaxDosePerAdminDropdown] = useState(false);
  const [showMaxDose24hDropdown, setShowMaxDose24hDropdown] = useState(false);
  const [showScriptLocationDropdown, setShowScriptLocationDropdown] = useState(false);
  const [showInjectionStockUnitDropdown, setShowInjectionStockUnitDropdown] = useState(false);
  const [customTimes, setCustomTimes] = useState<string[]>([]);
  const [showCustomTimePicker, setShowCustomTimePicker] = useState(false);
  const [customTimeHours, setCustomTimeHours] = useState(9);
  const [customTimeMinutes, setCustomTimeMinutes] = useState(0);
  const [enableCustomSpecificTime, setEnableCustomSpecificTime] = useState(false);
  const [pharmacyCollectedDate, setPharmacyCollectedDate] = useState(getCurrentDate());
  const [pharmacyCollectedInitials, setPharmacyCollectedInitials] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');
  const [hasScriptRepeats, setHasScriptRepeats] = useState(false);
  const [scriptRepeatsCount, setScriptRepeatsCount] = useState('');
  const [prescriptionFileUri, setPrescriptionFileUri] = useState('');
  const [scriptLocation, setScriptLocation] = useState<(typeof SCRIPT_LOCATIONS)[number] | ''>('');
  const [scriptLocationOtherDetail, setScriptLocationOtherDetail] = useState('');
  const [tabletsToBeGiven, setTabletsToBeGiven] = useState('');
  const [minTimeBetweenDoses, setMinTimeBetweenDoses] = useState('');
  const [maxDosePerAdministration, setMaxDosePerAdministration] = useState('');
  const [maxDosePer24Hours, setMaxDosePer24Hours] = useState('');
  const [multipleDosesPerTablet, setMultipleDosesPerTablet] = useState(false);
  const [dosePerTablet2, setDosePerTablet2] = useState('');
  const [showMultipleDoseHelp, setShowMultipleDoseHelp] = useState(false);
  const [showAdministrationQuantityHelp, setShowAdministrationQuantityHelp] = useState(false);
  const [showPrnRangeHelp, setShowPrnRangeHelp] = useState(false);
  const [showMedicationNameHelp, setShowMedicationNameHelp] = useState(false);
  const [validationNotice, setValidationNotice] = useState('');

  const routeDoseMeta = React.useMemo(() => {
    switch (routeSel) {
      case 'Oral tablet/capsule':
        return { perItemTitle: 'tablet/capsule', perItemLower: 'tablet/capsule', quantityTitle: 'Tablets/Capsules', quantityLower: 'tablets/capsules' };
      case 'Oral tablet':
        return { perItemTitle: 'Tablet', perItemLower: 'tablet', quantityTitle: 'Tablets', quantityLower: 'tablets' };
      case 'Oral capsule':
        return { perItemTitle: 'Capsule', perItemLower: 'capsule', quantityTitle: 'Capsules', quantityLower: 'capsules' };
      case 'Oral lozenges':
        return { perItemTitle: 'Lozenge', perItemLower: 'lozenge', quantityTitle: 'Lozenges', quantityLower: 'lozenges' };
      case 'Eye drops':
        return { perItemTitle: 'Drop', perItemLower: 'drop', quantityTitle: 'Drops', quantityLower: 'drops' };
      case 'Liquid solution':
        return { perItemTitle: 'Unit', perItemLower: 'unit', quantityTitle: 'Volume', quantityLower: 'ml' };
      case 'Topical (cream/lotion)':
        return { perItemTitle: 'Application', perItemLower: 'application', quantityTitle: 'Applications', quantityLower: 'applications' };
      default:
        return { perItemTitle: 'Unit', perItemLower: 'unit', quantityTitle: 'Doses', quantityLower: 'doses' };
    }
  }, [routeSel]);

  const usesPerItemDose = routeSel !== 'Subcutaneous injection' && routeSel !== 'Oral lozenges';
  const needsAdministrationQuantity = !prn && routeSel !== 'Topical (cream/lotion)';
  const usesMlStockUnit = routeSel === 'Liquid solution' || routeSel === 'Topical (cream/lotion)';
  const usesInjectionStockUnit = routeSel === 'Subcutaneous injection';

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      setName('');
      setMedicationPurpose('');
      setUnit(UNITS[0]);
      setDosePerTablet2Unit(UNITS[0]);
      setDosePerTablet('');
      setRouteSel(ROUTES[0]);
      setCustomRouteType('');
      setSlots({ beforeBreakfast: false, breakfast: false, lunch: false, dinner: false, beforeBed: false });
      setPrn(false);
      setCourseType('long-term');
      setNotes('');
      setStock('');
      setInjectionStockUnit(INJECTION_STOCK_UNITS[0]);
      setFrequencyType('daily');
      setCustomTimes([]);
      setEnableCustomSpecificTime(false);
      setPharmacyCollectedDate(getCurrentDate());
      setPharmacyCollectedInitials('');
      setPharmacyName('');
      setHasScriptRepeats(false);
      setScriptRepeatsCount('');
      setPrescriptionFileUri('');
      setScriptLocation('');
      setScriptLocationOtherDetail('');
      setTabletsToBeGiven('');
      setMinTimeBetweenDoses('');
      setMaxDosePerAdministration('');
      setMaxDosePer24Hours('');
      setMultipleDosesPerTablet(false);
      setDosePerTablet2('');
      setShowMultipleDoseHelp(false);
      setShowAdministrationQuantityHelp(false);
      setShowPrnRangeHelp(false);
      setShowMedicationNameHelp(false);
      setStartDate(getCurrentDate());
      setStartTime(getCurrentTime());
      setEndDate('');
      setNoEndDate(false);
      setValidationNotice('');
    }
  }, [visible]);
  
  // Date/time picker state
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | 'pharmacy-collection' | null>(null);
  const [showTimePicker, setShowTimePicker] = useState<'start' | null>(null);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth() + 1);
  const [pickerDay, setPickerDay] = useState(new Date().getDate());
  const [pickerHours, setPickerHours] = useState(new Date().getHours());
  const [pickerMinutes, setPickerMinutes] = useState(new Date().getMinutes());
  const [showAdminStyleDateTimePicker, setShowAdminStyleDateTimePicker] = useState(false);
  const [adminStyleDateTimeTarget, setAdminStyleDateTimeTarget] = useState<'start' | 'end' | null>(null);
  const [focusedFieldKey, setFocusedFieldKey] = useState<string | null>(null);
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function placeholderFor(fieldKey: string, placeholder: string): string {
    return focusedFieldKey === fieldKey ? '' : placeholder;
  }

  function sanitizeDecimalInput(value: string): string {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const firstDot = cleaned.indexOf('.');
    if (firstDot === -1) return cleaned;
    return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }

  function toggleSlot(k: keyof typeof slots) {
    setSlots(s => ({ ...s, [k]: !s[k] }));
  }

  function formatCustomTimeRange(time: string): string {
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
  }

  function computeTimes(): string[] {
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
    
    return out;
  }

  function openDatePicker(type: 'start' | 'end' | 'pharmacy-collection') {
    if (type === 'start' && startDate) {
      const parsed = parseDateString(startDate);
      if (parsed) {
        setPickerYear(parsed.year);
        setPickerMonth(parsed.month);
        setPickerDay(parsed.day);
      }
    } else if (type === 'end' && endDate) {
      const parsed = parseDateString(endDate);
      if (parsed) {
        setPickerYear(parsed.year);
        setPickerMonth(parsed.month);
        setPickerDay(parsed.day);
      }
    } else if (type === 'pharmacy-collection' && pharmacyCollectedDate) {
      const parsed = parseDateString(pharmacyCollectedDate);
      if (parsed) {
        setPickerYear(parsed.year);
        setPickerMonth(parsed.month);
        setPickerDay(parsed.day);
      }
    }
    setShowDatePicker(type);
  }

  function confirmDatePicker() {
    if (showDatePicker === 'start') {
      setStartDate(formatDateFromParts(pickerYear, pickerMonth, pickerDay));
    } else if (showDatePicker === 'end') {
      setEndDate(formatDateFromParts(pickerYear, pickerMonth, pickerDay));
    } else if (showDatePicker === 'pharmacy-collection') {
      setPharmacyCollectedDate(formatDateFromParts(pickerYear, pickerMonth, pickerDay));
    }
    setShowDatePicker(null);
  }

  function shiftDatePickerByMonths(delta: number) {
    const nextMonthIndex = (pickerMonth - 1) + delta;
    const nextYear = pickerYear + Math.floor(nextMonthIndex / 12);
    const normalizedMonth = ((nextMonthIndex % 12) + 12) % 12;
    const nextMonth = normalizedMonth + 1;
    const maxDay = new Date(nextYear, nextMonth, 0).getDate();

    setPickerYear(nextYear);
    setPickerMonth(nextMonth);
    if (pickerDay > maxDay) setPickerDay(maxDay);
  }

  function selectDatePickerCalendarDay(day: number, offset: -1 | 0 | 1) {
    if (offset === 0) {
      setPickerDay(day);
      return;
    }
    const nextMonthIndex = (pickerMonth - 1) + offset;
    const nextYear = pickerYear + Math.floor(nextMonthIndex / 12);
    const normalizedMonth = ((nextMonthIndex % 12) + 12) % 12;
    const nextMonth = normalizedMonth + 1;
    setPickerYear(nextYear);
    setPickerMonth(nextMonth);
    setPickerDay(day);
  }

  function openTimePicker() {
    if (startTime) {
      const parsed = parseTimeString(startTime);
      if (parsed) {
        setPickerHours(parsed.hours);
        setPickerMinutes(parsed.minutes);
      }
    }
    setShowTimePicker('start');
  }

  async function pickPrescriptionFile() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets[0]?.base64) {
        const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setPrescriptionFileUri(base64Uri);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to select prescription file');
    }
  }

  function confirmTimePicker() {
    setStartTime(formatTimeFromParts(pickerHours, pickerMinutes));
    setShowTimePicker(null);
  }

  function openAdminStyleDateTimePicker(target: 'start' | 'end') {
    setAdminStyleDateTimeTarget(target);

    if (target === 'start') {
      const parsedDate = parseDateString(startDate || getCurrentDate());
      const parsedTime = parseTimeString(startTime || getCurrentTime());
      if (parsedDate) {
        setPickerYear(parsedDate.year);
        setPickerMonth(parsedDate.month);
        setPickerDay(parsedDate.day);
      }
      if (parsedTime) {
        setPickerHours(parsedTime.hours);
        setPickerMinutes(parsedTime.minutes);
      }
    } else {
      const parsedDate = parseDateString(endDate || startDate || getCurrentDate());
      if (parsedDate) {
        setPickerYear(parsedDate.year);
        setPickerMonth(parsedDate.month);
        setPickerDay(parsedDate.day);
      }
      const parsedTime = parseTimeString(startTime || getCurrentTime());
      if (parsedTime) {
        setPickerHours(parsedTime.hours);
        setPickerMinutes(parsedTime.minutes);
      }
    }

    setShowAdminStyleDateTimePicker(true);
  }

  function confirmAdminStyleDateTimePicker() {
    const selectedDate = formatDateFromParts(pickerYear, pickerMonth, pickerDay);
    if (adminStyleDateTimeTarget === 'start') {
      setStartDate(selectedDate);
      setStartTime(formatTimeFromParts(pickerHours, pickerMinutes));
    } else if (adminStyleDateTimeTarget === 'end') {
      setEndDate(selectedDate);
    }
    setShowAdminStyleDateTimePicker(false);
    setAdminStyleDateTimeTarget(null);
  }

  async function submit() {
    const isCleanNumberInput = (value: string): boolean => /^\d+(\.\d+)?$/.test(value.trim());

    const missingFields: string[] = [];
    const invalidFields: string[] = [];

    if (!name.trim()) missingFields.push('Medication name');
    if (!medicationPurpose.trim()) missingFields.push('Medication purpose');
    if (routeSel === 'Other' && !customRouteType.trim()) missingFields.push('Medication type (Other)');
    if (usesPerItemDose && !dosePerTablet.trim()) missingFields.push(`Dose per ${routeDoseMeta.perItemLower}`);
    if (needsAdministrationQuantity && !tabletsToBeGiven.trim()) missingFields.push(`${routeDoseMeta.quantityTitle} to be given`);
    if (usesPerItemDose && multipleDosesPerTablet && !dosePerTablet2.trim()) missingFields.push(`Second dose per ${routeDoseMeta.perItemLower}`);
    if (!startDate) missingFields.push('Start date');

    // For all non-PRN medications, start time is required.
    if (!prn && !startTime) missingFields.push('Start time');

    if (!stock.trim()) {
      missingFields.push('Stock received');
    } else if (isNaN(parseInt(stock, 10))) {
      invalidFields.push('Stock received (must be a number)');
    }

    if (!pharmacyName.trim()) missingFields.push('Collected from: pharmacy name');
    if (!pharmacyCollectedDate) missingFields.push('Collected from: date');
    if (!pharmacyCollectedInitials.trim()) missingFields.push('Collected from: person who received the medication');

    if (!prn && courseType === 'short-term' && !endDate) missingFields.push('End date (short term course)');

    if (prn) {
      if (!minTimeBetweenDoses.trim()) missingFields.push('Minimum time between doses');
      else if (isNaN(parseFloat(minTimeBetweenDoses))) invalidFields.push('Minimum time between doses (must be a number)');

      if (!maxDosePerAdministration.trim()) missingFields.push(`Maximum dose per administration (${routeDoseMeta.quantityLower})`);
      else if (isNaN(parseFloat(maxDosePerAdministration))) invalidFields.push(`Maximum dose per administration (${routeDoseMeta.quantityLower}) must be a number`);

      if (!maxDosePer24Hours.trim()) missingFields.push(`Maximum dose in 24 hours (${routeDoseMeta.quantityLower})`);
      else if (isNaN(parseFloat(maxDosePer24Hours))) invalidFields.push(`Maximum dose in 24 hours (${routeDoseMeta.quantityLower}) must be a number`);
    }

    if (!prn && frequencyType === 'daily') {
      const hasPresetSlot = slots.beforeBreakfast || slots.breakfast || slots.lunch || slots.dinner || slots.beforeBed;
      const hasCustomTime = customTimes.length > 0;
      if (!hasPresetSlot && !hasCustomTime) {
        missingFields.push('At least one schedule time');
      }
    }

    if (missingFields.length > 0 || invalidFields.length > 0) {
      const missingMsg = missingFields.length > 0
        ? `Missing required fields:\n- ${missingFields.join('\n- ')}`
        : '';
      const invalidMsg = invalidFields.length > 0
        ? `Invalid fields:\n- ${invalidFields.join('\n- ')}`
        : '';
      const notice = [missingMsg, invalidMsg].filter(Boolean).join('\n\n');
      setValidationNotice(notice);
      Alert.alert('Cannot save medication', notice);
      return;
    }

    setValidationNotice('');
    
    const scheduledTimes = computeTimes();
    // Skip time validation for interval-based medications (they don't use scheduled times)
    // Time selection is now optional - medications can be added without specific times
    setLoading(true);
    try {
      const effectiveStartTime = prn ? '00:00' : startTime;
      const startIso = startDate + 'T' + effectiveStartTime + ':00';
      const endIso = !prn && courseType === 'short-term' && endDate
        ? (endDate + 'T00:00:00')
        : (prn && !noEndDate && endDate ? (endDate + 'T00:00:00') : undefined);
      const resolvedRoute = routeSel === 'Other' ? customRouteType.trim() : routeSel;
      
      // For interval medications, don't use scheduledTimes (use frequencyType instead)
      const shouldUseScheduledTimes = !prn && frequencyType === 'daily';
      const shouldStorePerItemDose = usesPerItemDose;
      
      // Calculate totalDose only when both inputs are clean numeric values.
      const hasCleanAdministrationQuantity = isCleanNumberInput(tabletsToBeGiven);
      const hasCleanPerItemDose = isCleanNumberInput(dosePerTablet);
      const quantityPerAdministration = hasCleanAdministrationQuantity ? Number.parseFloat(tabletsToBeGiven) : Number.NaN;
      const perItemDose = hasCleanPerItemDose ? Number.parseFloat(dosePerTablet) : Number.NaN;
      const hasNumericDoseInputs =
        Number.isFinite(quantityPerAdministration) && Number.isFinite(perItemDose);
      const calculatedTotalDose =
        needsAdministrationQuantity && shouldStorePerItemDose && hasNumericDoseInputs
          ? (quantityPerAdministration * perItemDose).toString()
          : '';

      // Keep free-text dose instructions when quantity isn't a clean number.
      const administrationQuantityText = tabletsToBeGiven.trim();
      const variableDoseInstructions =
        needsAdministrationQuantity && administrationQuantityText && !hasCleanAdministrationQuantity
          ? administrationQuantityText
          : undefined;
      
      const newMed = await addMedication(locationId, clientId, { 
        name,
        medicationPurpose: medicationPurpose || undefined,
        totalDose: calculatedTotalDose, 
        dosePerTablet: shouldStorePerItemDose ? dosePerTablet : undefined,
        dosePerTablet2: shouldStorePerItemDose ? (multipleDosesPerTablet ? dosePerTablet2 : undefined) : undefined,
        dosePerTablet2Unit: shouldStorePerItemDose ? (multipleDosesPerTablet ? dosePerTablet2Unit : undefined) : undefined,
        multipleDosesPerTablet: shouldStorePerItemDose ? (multipleDosesPerTablet || undefined) : undefined,
        unit,
        route: resolvedRoute,
        prnVariableMinHoursBetween: prn ? parseFloat(minTimeBetweenDoses) : undefined,
        prnVariableMaxDosePerAdministration: prn ? parseFloat(maxDosePerAdministration) : undefined,
        prnVariableMaxDosePer24Hours: prn ? parseFloat(maxDosePer24Hours) : undefined,
        scheduledTimes: shouldUseScheduledTimes ? scheduledTimes : [], 
        prn, 
        startTime: startIso, 
        endTime: endIso,
        notes: notes || undefined,
        stock: stock ? parseInt(stock, 10) : undefined,
        stockUnit: routeSel === 'Subcutaneous injection' ? injectionStockUnit : (usesMlStockUnit ? 'ml' : undefined),
        frequencyType: frequencyType !== 'daily' ? frequencyType : undefined,
        courseType: !prn ? courseType : undefined,
        variableDoseInstructions,
        pharmacyCollectedDate: pharmacyCollectedDate || undefined,
        pharmacyCollectedInitials: pharmacyCollectedInitials || undefined,
        pharmacyName: pharmacyName || undefined,
        hasScriptRepeats: hasScriptRepeats || undefined,
        scriptRepeatsCount: hasScriptRepeats && scriptRepeatsCount.trim() ? parseInt(scriptRepeatsCount, 10) : undefined,
        prescriptionFileUri: hasScriptRepeats && prescriptionFileUri ? prescriptionFileUri : undefined,
        scriptLocation: hasScriptRepeats && scriptLocation ? scriptLocation : undefined,
        scriptLocationOtherDetail: hasScriptRepeats && scriptLocation === 'Other' && scriptLocationOtherDetail.trim()
          ? scriptLocationOtherDetail.trim()
          : undefined,
      });
      
      // Record the medication creation in the history log
      const createdTime = new Date().toISOString();
      const creationDetails: string[] = [];
      if (stock.trim()) {
        creationDetails.push(`Stock: ${stock}`);
      }
      if (pharmacyName || pharmacyCollectedDate || pharmacyCollectedInitials) {
        const collectionParts: string[] = [];
        if (pharmacyName) collectionParts.push(pharmacyName);
        if (pharmacyCollectedDate) collectionParts.push(pharmacyCollectedDate);
        if (pharmacyCollectedInitials) collectionParts.push(`Received by ${pharmacyCollectedInitials}`);
        creationDetails.push(`Collected: ${collectionParts.join(' ')}`);
      }
      const creationReason = creationDetails.length > 0 ? creationDetails.join(' | ') : undefined;
      await addAdministrationRecord(locationId, clientId, newMed.id, createdTime, 'created', undefined, creationReason);
      
      Alert.alert('Success', 'Medication added');
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to add medication');
    } finally {
      setLoading(false);
    }
  }

  const selectedSlots = Object.values(slots).filter(Boolean).length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.backButton}>← Close</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add Medication</Text>
          <View style={{ width: 60 }} />
        </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.form}>
          {/* Basic Info */}
          <View style={styles.field}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[styles.label, { flex: 1, marginBottom: 0 }]}>Medication Name *</Text>
              <Pressable
                onHoverIn={() => setShowMedicationNameHelp(true)}
                onHoverOut={() => setShowMedicationNameHelp(false)}
                onPress={() => setShowMedicationNameHelp(v => !v)}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  borderWidth: 1,
                  borderColor: '#93c5fd',
                  backgroundColor: '#eff6ff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 8,
                }}
              >
                <Text style={{ color: '#1d4ed8', fontSize: 11, fontWeight: '800' }}>?</Text>
              </Pressable>
            </View>

            {showMedicationNameHelp && (
              <View style={{ marginBottom: 10, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
                <Text style={{ fontSize: 12, color: '#1e3a8a', lineHeight: 17 }}>
                  Include both the brand name and the drug (generic) name when possible to reduce confusion.
                  Example: Paramax paracetamol.
                </Text>
              </View>
            )}

            <TextInput
              placeholder={placeholderFor('name', 'e.g., Paracetamol')}
              placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
              value={name}
              onChangeText={setName}
              onFocus={() => setFocusedFieldKey('name')}
              onBlur={() => setFocusedFieldKey(null)}
              style={styles.input}
              editable={!loading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Medication Purpose *</Text>
            <TextInput
              placeholder={placeholderFor('medicationPurpose', 'e.g., Pain relief, Blood pressure')}
              placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
              value={medicationPurpose}
              onChangeText={setMedicationPurpose}
              onFocus={() => setFocusedFieldKey('medicationPurpose')}
              onBlur={() => setFocusedFieldKey(null)}
              style={styles.input}
              editable={!loading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Medication Type *</Text>
            <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowRouteDropdown(true)} disabled={loading}>
              <Text style={styles.dropdownButtonText}>{routeSel}</Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          {routeSel === 'Other' && (
            <View style={styles.field}>
              <Text style={styles.label}>Other Medication Type *</Text>
              <TextInput
                placeholder={placeholderFor('customRouteType', 'e.g., Rectal')}
                placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                value={customRouteType}
                onChangeText={setCustomRouteType}
                onFocus={() => setFocusedFieldKey('customRouteType')}
                onBlur={() => setFocusedFieldKey(null)}
                style={styles.input}
                editable={!loading}
              />
            </View>
          )}

          {/* Schedule Type Selection */}
          <View style={styles.field}>
            <Text style={styles.label}>Medication Schedule</Text>
            <View style={styles.scheduleTypeRow}>
              <TouchableOpacity 
                style={[styles.scheduleTypeButton, prn && styles.scheduleTypeButtonActive]}
                onPress={() => setPrn(true)}
                disabled={loading}
              >
                <Text style={[styles.scheduleTypeButtonText, prn && styles.scheduleTypeButtonTextActive]}>📋 Give when required</Text>
                <Text style={[styles.scheduleTypeDesc, prn && styles.scheduleTypeDescActive]}>Give when required (PRN)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.scheduleTypeButton, !prn && courseType === 'long-term' && styles.scheduleTypeButtonActive]}
                onPress={() => {
                  setPrn(false);
                  setCourseType('long-term');
                  setEndDate('');
                  setNoEndDate(true);
                }}
                disabled={loading}
              >
                <Text style={[styles.scheduleTypeButtonText, !prn && courseType === 'long-term' && styles.scheduleTypeButtonTextActive]}>⏰ Long term course</Text>
                <Text style={[styles.scheduleTypeDesc, !prn && courseType === 'long-term' && styles.scheduleTypeDescActive]}>Ongoing schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.scheduleTypeButton, !prn && courseType === 'short-term' && styles.scheduleTypeButtonActive]}
                onPress={() => {
                  setPrn(false);
                  setCourseType('short-term');
                  setNoEndDate(false);
                }}
                disabled={loading}
              >
                <Text style={[styles.scheduleTypeButtonText, !prn && courseType === 'short-term' && styles.scheduleTypeButtonTextActive]}>🗓️ Short term course</Text>
                <Text style={[styles.scheduleTypeDesc, !prn && courseType === 'short-term' && styles.scheduleTypeDescActive]}>Time-limited schedule</Text>
              </TouchableOpacity>
            </View>

            {prn && (
              <View style={styles.field}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={[styles.label, { flex: 1, marginBottom: 0 }]}>PRN safety limits</Text>
                  <Pressable
                    onHoverIn={() => setShowPrnRangeHelp(true)}
                    onHoverOut={() => setShowPrnRangeHelp(false)}
                    onPress={() => setShowPrnRangeHelp(v => !v)}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 1,
                      borderColor: '#93c5fd',
                      backgroundColor: '#eff6ff',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 8,
                    }}
                  >
                    <Text style={{ color: '#1d4ed8', fontSize: 11, fontWeight: '800' }}>?</Text>
                  </Pressable>
                </View>

                {showPrnRangeHelp && (
                  <View style={{ marginBottom: 10, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
                    <Text style={{ fontSize: 12, color: '#1e3a8a', lineHeight: 17 }}>
                      Example: "Take one to two tablets every four to six hours when required. maximum of 8 tablets per day".
                      Enter minimum time between doses as 4 hours, maximum dose per administration as 2 {routeDoseMeta.quantityLower},
                      and maximum dose in 24 hours as 8 {routeDoseMeta.quantityLower}.
                    </Text>
                  </View>
                )}
                
                <View style={{ marginBottom: 10 }}>
                  <Text style={styles.label}>Minimum Time Between Doses (hours) *</Text>
                  <TouchableOpacity 
                    style={[styles.dropdownButton, styles.prnDropdownButton]} 
                    onPress={() => setShowMinHoursDropdown(true)} 
                    disabled={loading}
                  >
                    <Text style={[styles.dropdownButtonText, styles.prnDropdownValue]} numberOfLines={2} ellipsizeMode="tail">
                      {minTimeBetweenDoses ? `${minTimeBetweenDoses}h between doses` : 'Select hours'}
                    </Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ marginBottom: 10 }}>
                  <Text style={styles.label}>Maximum Dose per Administration ({routeDoseMeta.quantityLower}) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={`Enter ${routeDoseMeta.quantityLower}`}
                    placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                    value={maxDosePerAdministration}
                    onChangeText={(value) => setMaxDosePerAdministration(sanitizeDecimalInput(value))}
                    keyboardType="decimal-pad"
                    editable={!loading}
                  />
                </View>

                <View>
                  <Text style={styles.label}>Maximum Dose in 24 Hours ({routeDoseMeta.quantityLower}) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={`Enter ${routeDoseMeta.quantityLower}`}
                    placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                    value={maxDosePer24Hours}
                    onChangeText={(value) => setMaxDosePer24Hours(sanitizeDecimalInput(value))}
                    keyboardType="decimal-pad"
                    editable={!loading}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Multiple doses per tablet checkbox */}
          {usesPerItemDose && (
            <View style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                  style={{
                    width: 18,
                    height: 18,
                    borderWidth: 2,
                    borderColor: '#3b82f6',
                    borderRadius: 4,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 10,
                    backgroundColor: multipleDosesPerTablet ? '#3b82f6' : '#fff',
                  }}
                  onPress={() => {
                    const newValue = !multipleDosesPerTablet;
                    setMultipleDosesPerTablet(newValue);
                    if (!newValue) {
                      setDosePerTablet2('');
                      setDosePerTablet2Unit(unit);
                    }
                  }}
                >
                  {multipleDosesPerTablet && <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                </TouchableOpacity>

                <Text style={{ fontSize: 14, color: '#333', flex: 1 }}>There is more than one medication per {routeDoseMeta.perItemLower}</Text>

                <Pressable
                  onHoverIn={() => setShowMultipleDoseHelp(true)}
                  onHoverOut={() => setShowMultipleDoseHelp(false)}
                  onPress={() => setShowMultipleDoseHelp(v => !v)}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: 1,
                    borderColor: '#93c5fd',
                    backgroundColor: '#eff6ff',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 8,
                  }}
                >
                  <Text style={{ color: '#1d4ed8', fontSize: 11, fontWeight: '800' }}>?</Text>
                </Pressable>
              </View>

              {showMultipleDoseHelp && (
                <View style={{ marginTop: 8, marginLeft: 28, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
                  <Text style={{ fontSize: 12, color: '#1e3a8a', lineHeight: 17 }}>
                    Use this if one {routeDoseMeta.perItemLower} contains multiple active ingredients or strengths that need separate dose entries. Common example: a cough medicine dose containing dextromethorphan 10 mg and guaifenesin 100 mg in the same medicine.
                  </Text>
                </View>
              )}
            </View>
          )}

          {usesPerItemDose && (
            <View style={styles.rowFields}>
              <View style={[styles.field, { flex: 2, marginRight: 8 }]}>
                <Text style={styles.label}>
                  {routeSel === 'Liquid solution' ? 'Amount of drug in the liquid per administration?' : `Dose per ${routeDoseMeta.perItemTitle} *`}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput 
                    placeholder={placeholderFor('dosePerTablet', 'e.g., 250')} 
                    placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                    value={dosePerTablet} 
                    onChangeText={(value) => setDosePerTablet(sanitizeDecimalInput(value))} 
                    onFocus={() => setFocusedFieldKey('dosePerTablet')}
                    onBlur={() => setFocusedFieldKey(null)}
                    style={[styles.input, { flex: 1 }]} 
                    keyboardType="decimal-pad"
                    editable={!loading} 
                  />
                </View>
              </View>
              <View style={[styles.field, { flex: 1, marginTop: routeSel === 'Liquid solution' ? 20 : 0 }]}>
                <Text style={styles.label}>Unit</Text>
                <TouchableOpacity
                  style={[styles.input, { justifyContent: 'center', paddingHorizontal: 12 }]}
                  onPress={() => setShowUnitDropdown(true)}
                >
                  <Text style={{ fontSize: 14, color: '#333', fontWeight: '500' }}>{unit}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Second dose per tablet field */}
          {usesPerItemDose && multipleDosesPerTablet && (
            <View style={styles.rowFields}>
              <View style={[styles.field, { flex: 2, marginRight: 8 }]}>
                <Text style={styles.label}>
                  {`Second Dose per ${routeDoseMeta.perItemTitle}`}
                </Text>
                <TextInput 
                  placeholder={placeholderFor('dosePerTablet2', 'e.g., 500')} 
                  placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                  value={dosePerTablet2} 
                  onChangeText={(value) => setDosePerTablet2(sanitizeDecimalInput(value))} 
                  onFocus={() => setFocusedFieldKey('dosePerTablet2')}
                  onBlur={() => setFocusedFieldKey(null)}
                  style={[styles.input, { flex: 1 }]} 
                  keyboardType="decimal-pad"
                  editable={!loading} 
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Second Unit</Text>
                <TouchableOpacity
                  style={[styles.input, { justifyContent: 'center', paddingHorizontal: 12 }]}
                  onPress={() => setShowSecondUnitDropdown(true)}
                >
                  <Text style={{ fontSize: 14, color: '#333', fontWeight: '500' }}>{dosePerTablet2Unit}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {needsAdministrationQuantity && (
            <>
              <View style={styles.field}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.label, { flex: 1 }]}> 
                    {routeSel === 'Liquid solution'
                      ? 'Volume (ml) to Be Given per Administration *'
                      : routeSel === 'Eye drops'
                        ? 'Drops to Be Given per Effected Eye *'
                      : `${routeDoseMeta.quantityTitle} to Be Given per Administration *`}
                  </Text>
                  {routeSel !== 'Oral lozenges' && (
                    <Pressable
                      onHoverIn={() => setShowAdministrationQuantityHelp(true)}
                      onHoverOut={() => setShowAdministrationQuantityHelp(false)}
                      onPress={() => setShowAdministrationQuantityHelp(v => !v)}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        borderWidth: 1,
                        borderColor: '#93c5fd',
                        backgroundColor: '#eff6ff',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 8,
                      }}
                    >
                      <Text style={{ color: '#1d4ed8', fontSize: 11, fontWeight: '800' }}>?</Text>
                    </Pressable>
                  )}
                </View>

                {routeSel !== 'Oral lozenges' && showAdministrationQuantityHelp && (
                  <View style={{ marginBottom: 8, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
                    <Text style={{ fontSize: 12, color: '#1e3a8a', lineHeight: 17 }}>
                      For medications where the dose varies, put dose instructions in this box and the Additional Information box.
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput 
                    placeholder={placeholderFor('tabletsToBeGiven', routeSel === 'Liquid solution' ? 'e.g., 5' : 'e.g., 2')} 
                    placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                    value={tabletsToBeGiven} 
                    onChangeText={setTabletsToBeGiven} 
                    onFocus={() => setFocusedFieldKey('tabletsToBeGiven')}
                    onBlur={() => setFocusedFieldKey(null)}
                    style={[styles.input, { flex: 1, marginRight: 8 }]} 
                    keyboardType="default"
                    editable={!loading} 
                  />
                  {routeSel === 'Liquid solution' && (
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>ml</Text>
                  )}
                </View>
              </View>

              {/* Auto-calculated total dose */}
              {tabletsToBeGiven && dosePerTablet && (
                <View style={styles.field}>
                  <Text style={styles.label}>Total dose per administration</Text>
                  <View style={[styles.input, { justifyContent: 'center', backgroundColor: '#f0f9ff', borderColor: '#93c5fd', borderWidth: 2 }]}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#2563eb' }}>
                      {isNaN(parseFloat(tabletsToBeGiven) * parseFloat(dosePerTablet)) || !isFinite(parseFloat(tabletsToBeGiven) * parseFloat(dosePerTablet)) 
                        ? '—' 
                        : (parseFloat(tabletsToBeGiven) * parseFloat(dosePerTablet)).toFixed(2)} {unit}
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}

          {/* Select Times and Frequency for Regular (non-PRN) medications */}
          {!prn && (
            <>
              {/* Frequency Selector */}
              <View style={styles.field}>
                <Text style={styles.label}>Frequency</Text>
                <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowFrequencyDropdown(true)} disabled={loading}>
                  <Text style={styles.dropdownButtonText}>
                    {frequencyType === 'daily' ? 'Every Day' : frequencyType === 'every-second-day' ? 'Every Second Day' : frequencyType === 'weekly' ? 'Weekly' : frequencyType === 'fortnightly' ? 'Fortnightly' : 'Monthly'}
                  </Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
              </View>

              {frequencyType === 'daily' ? (
                <>
                  <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowSlotsDropdown(true)} disabled={loading}>
                <Text style={styles.dropdownButtonText}>
                  {selectedSlots === 0 ? 'Select times...' : `${selectedSlots} time${selectedSlots !== 1 ? 's' : ''} selected`}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
              <View style={styles.selectedSlots}>
                  {slots.beforeBreakfast && <Text style={styles.slotTag}>Before Breakfast (05:00-10:00)</Text>}
                  {slots.breakfast && <Text style={styles.slotTag}>Breakfast (06:00-10:00)</Text>}
                  {slots.lunch && <Text style={styles.slotTag}>Lunch (10:00-15:00)</Text>}
                  {slots.dinner && <Text style={styles.slotTag}>Dinner (16:00-22:00)</Text>}
                  {slots.beforeBed && <Text style={styles.slotTag}>Before Bed (18:00-23:59)</Text>}
                {customTimes.map((time, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 8, marginBottom: 6 }}>
                      <Text style={styles.slotTag}>{formatCustomTimeRange(time)} (Specific)</Text>
                    <TouchableOpacity onPress={() => setCustomTimes(ct => ct.filter((_, i) => i !== idx))} style={{ marginLeft: 6 }}>
                      <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 14 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginTop: 6 }}
                onPress={() => {
                  const next = !enableCustomSpecificTime;
                  setEnableCustomSpecificTime(next);
                  if (!next) {
                    setCustomTimes([]);
                  }
                }}
                disabled={loading}
              >
                <View style={{ width: 18, height: 18, borderWidth: 2, borderColor: '#3b82f6', borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginRight: 10, backgroundColor: enableCustomSpecificTime ? '#3b82f6' : '#fff' }}>
                  {enableCustomSpecificTime && <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                </View>
                <Text style={{ fontSize: 14, color: '#333', flex: 1 }}>Add a Specific Time (optional)</Text>
              </TouchableOpacity>

              {enableCustomSpecificTime && (
                <TouchableOpacity
                  style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#94a3b8', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 6 }}
                  onPress={() => {
                    const now = new Date();
                    setCustomTimeHours(now.getHours());
                    setCustomTimeMinutes(now.getMinutes());
                    setShowCustomTimePicker(true);
                  }}
                  disabled={loading}
                >
                  <Text style={{ color: '#1e293b', fontWeight: '600', fontSize: 13 }}>+ Choose Specific Time</Text>
                </TouchableOpacity>
              )}
                </>
              ) : (
                <View style={[styles.field, { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#86efac', borderRadius: 8, padding: 12 }]}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#16a34a', textAlign: 'center' }}>
                    📅 Marked as due throughout the day
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Notes/Instructions */}
          <View style={styles.field}>
            <Text style={styles.label}>Notes/Instructions (optional)</Text>
            <TextInput
              placeholder={placeholderFor('notes', 'e.g., Take with food, avoid dairy')}
              placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
              value={notes}
              onChangeText={setNotes}
              onFocus={() => setFocusedFieldKey('notes')}
              onBlur={() => setFocusedFieldKey(null)}
              style={[styles.input, styles.multilineInput]}
              multiline
              editable={!loading}
            />
          </View>

          {/* Stock received */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {usesMlStockUnit
                ? 'Stock received (ml) *'
                : usesInjectionStockUnit
                  ? `Stock received (${injectionStockUnit}) *`
                  : 'Stock received *'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                placeholder={placeholderFor('stock', 'e.g., 100')}
                placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                value={stock}
                onChangeText={(value) => setStock(value.replace(/[^0-9]/g, ''))}
                onFocus={() => setFocusedFieldKey('stock')}
                onBlur={() => setFocusedFieldKey(null)}
                style={[styles.input, { flex: 1, marginRight: usesMlStockUnit ? 8 : 0 }]}
                keyboardType="number-pad"
                editable={!loading}
              />
              {usesMlStockUnit && (
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>ml</Text>
              )}
            </View>
            {usesInjectionStockUnit && (
              <TouchableOpacity
                style={[styles.dropdownButton, { marginTop: 8 }]}
                onPress={() => setShowInjectionStockUnitDropdown(true)}
                disabled={loading}
              >
                <Text style={styles.dropdownButtonText}>{injectionStockUnit}</Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Collected From Tracking (Optional) */}
          <View style={[styles.field, { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginVertical: 8 }]}>
            <Text style={[styles.label, { marginBottom: 8, color: '#475569', fontWeight: '600' }]}>Collected from *</Text>
            
            {/* Pharmacy Name */}
            <View style={{ marginBottom: 10 }}>
              <TextInput 
                placeholder={placeholderFor('pharmacyName', 'e.g., Main Street Pharmacy')} 
                placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                value={pharmacyName} 
                onChangeText={setPharmacyName} 
                onFocus={() => setFocusedFieldKey('pharmacyName')}
                onBlur={() => setFocusedFieldKey(null)}
                style={[styles.input, { backgroundColor: '#fff' }]} 
                editable={!loading}
              />
            </View>
            
            <View style={styles.rowFields}>
              <View style={[{ flex: 1, marginRight: 6 }]}>
                <Text style={[styles.label, { fontSize: 12, color: '#64748b', marginBottom: 4, minHeight: 34, lineHeight: 14 }]}>Date collected *</Text>
                <TouchableOpacity 
                  style={[styles.pickerButton, { backgroundColor: '#fff' }]} 
                  onPress={() => openDatePicker('pharmacy-collection')} 
                  disabled={loading}
                >
                  <Text style={styles.pickerButtonText}>
                    {pharmacyCollectedDate ? new Date(pharmacyCollectedDate + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '📅'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[{ flex: 1 }]}>
                <Text style={[styles.label, { fontSize: 12, color: '#64748b', marginBottom: 4, minHeight: 34, lineHeight: 14 }]}>Person who received the medication *</Text>
                <TextInput 
                  placeholder={placeholderFor('pharmacyCollectedInitials', '')} 
                  placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                  value={pharmacyCollectedInitials} 
                  onChangeText={(text) => setPharmacyCollectedInitials(text.toUpperCase())} 
                  onFocus={() => setFocusedFieldKey('pharmacyCollectedInitials')}
                  onBlur={() => setFocusedFieldKey(null)}
                  style={[styles.input, { backgroundColor: '#fff' }]} 
                  maxLength={4}
                  editable={!loading}
                />
              </View>
            </View>

            <View style={{ marginTop: 10 }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
                onPress={() => {
                  const next = !hasScriptRepeats;
                  setHasScriptRepeats(next);
                  if (!next) {
                    setScriptRepeatsCount('');
                    setPrescriptionFileUri('');
                    setScriptLocation('');
                    setScriptLocationOtherDetail('');
                  }
                }}
                disabled={loading}
              >
                <View style={{ width: 18, height: 18, borderWidth: 2, borderColor: '#3b82f6', borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginRight: 10, backgroundColor: hasScriptRepeats ? '#3b82f6' : '#fff' }}>
                  {hasScriptRepeats && <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                </View>
                <Text style={{ fontSize: 14, color: '#334155', fontWeight: '600' }}>This medication has script repeats</Text>
              </TouchableOpacity>

              {hasScriptRepeats && (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.label, { fontSize: 12, color: '#64748b' }]}>Number of script repeats (optional)</Text>
                  <TextInput
                    placeholder={placeholderFor('scriptRepeatsCount', 'e.g., 5')}
                    placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                    value={scriptRepeatsCount}
                    onChangeText={(value) => setScriptRepeatsCount(value.replace(/[^0-9]/g, ''))}
                    onFocus={() => setFocusedFieldKey('scriptRepeatsCount')}
                    onBlur={() => setFocusedFieldKey(null)}
                    style={[styles.input, { backgroundColor: '#fff', marginBottom: 8 }]}
                    keyboardType="number-pad"
                    editable={!loading}
                  />

                  <Text style={[styles.label, { fontSize: 12, color: '#64748b' }]}>Script location (if known)</Text>
                  <TouchableOpacity
                    style={[styles.dropdownButton, { backgroundColor: '#fff', marginBottom: 8 }]}
                    onPress={() => setShowScriptLocationDropdown(true)}
                    disabled={loading}
                  >
                    <Text style={styles.dropdownButtonText}>{scriptLocation || 'Select script location'}</Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>

                  {scriptLocation === 'Other' && (
                    <TextInput
                      placeholder={placeholderFor('scriptLocationOtherDetail', 'Please specify')}
                      placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                      value={scriptLocationOtherDetail}
                      onChangeText={setScriptLocationOtherDetail}
                      onFocus={() => setFocusedFieldKey('scriptLocationOtherDetail')}
                      onBlur={() => setFocusedFieldKey(null)}
                      style={[styles.input, { backgroundColor: '#fff', marginBottom: 8 }]}
                      editable={!loading}
                    />
                  )}

                  <TouchableOpacity
                    style={[styles.input, { backgroundColor: prescriptionFileUri ? '#ecfdf5' : '#fff', borderColor: prescriptionFileUri ? '#22c55e' : '#e5e7eb', justifyContent: 'center' }]}
                    onPress={pickPrescriptionFile}
                    disabled={loading}
                  >
                    <Text style={{ color: prescriptionFileUri ? '#15803d' : '#334155', fontWeight: '600' }}>
                      {prescriptionFileUri ? '✓ Prescription file uploaded' : '+ Upload prescription file (optional)'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Start/End Dates */}
          <View style={styles.rowFields}>
            <View style={[styles.field, { flex: 1, marginRight: (!prn && courseType === 'short-term') ? 6 : 0 }]}>
              <Text style={styles.label}>Start Date & Time *</Text>
              <TouchableOpacity style={styles.pickerButton} onPress={() => openAdminStyleDateTimePicker('start')} disabled={loading}>
                <Text style={styles.pickerButtonText}>
                  {startDate
                    ? `${new Date(startDate + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })} ${startTime || ''}`.trim()
                    : '📅'}
                </Text>
              </TouchableOpacity>
            </View>
            {(!prn && courseType === 'short-term') && (
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>End Date *</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => openAdminStyleDateTimePicker('end')}
                  disabled={loading}
                >
                  <Text style={styles.pickerButtonText}>
                    {endDate
                      ? new Date(endDate + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })
                      : 'Select date'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {prn && (
              <View style={[styles.field, { flex: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.label}>End Date</Text>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    onPress={() => {
                      setNoEndDate(v => {
                        const next = !v;
                        if (next) setEndDate('');
                        return next;
                      });
                    }}
                    disabled={loading}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderWidth: 1,
                        borderColor: '#94a3b8',
                        borderRadius: 3,
                        backgroundColor: noEndDate ? '#2563eb' : '#fff',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {noEndDate && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                    </View>
                    <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600' }}>No end date</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => openAdminStyleDateTimePicker('end')}
                  disabled={loading || noEndDate}
                >
                  <Text style={styles.pickerButtonText}>
                    {noEndDate
                      ? '—'
                      : endDate
                        ? new Date(endDate + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })
                        : '—'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {validationNotice ? (
          <View style={styles.validationNoticeBox}>
            <Text style={styles.validationNoticeTitle}>Cannot save medication</Text>
            <Text style={styles.validationNoticeText}>{validationNotice}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={[styles.submitButton, loading && styles.submitButtonDisabled]} onPress={submit} disabled={loading}>
          <Text style={styles.submitButtonText}>{loading ? 'Saving...' : '✓ Save Medication'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Route Dropdown Modal */}
      <Modal visible={showRouteDropdown} transparent animationType="fade" onRequestClose={() => setShowRouteDropdown(false)}>
        <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setShowRouteDropdown(false)} activeOpacity={1}>
          <View style={styles.dropdownContent} onStartShouldSetResponder={() => true}>
            <ScrollView showsVerticalScrollIndicator persistentScrollbar>
              {ROUTES.map(r => (
                <TouchableOpacity 
                  key={r} 
                  style={styles.dropdownItem} 
                  onPress={() => {
                    setRouteSel(r);
                    if (r !== 'Other') {
                      setCustomRouteType('');
                    }
                    if (r === 'Liquid solution') {
                      setUnit('mg');
                      setDosePerTablet2Unit('mg');
                    }
                    if (r === 'Topical (cream/lotion)') {
                      setUnit('ml');
                      setDosePerTablet2Unit('ml');
                      setTabletsToBeGiven('');
                    }
                    if (r === 'Subcutaneous injection') {
                      setDosePerTablet('');
                      setDosePerTablet2('');
                      setDosePerTablet2Unit(UNITS[0]);
                      setMultipleDosesPerTablet(false);
                    }
                    if (r === 'Oral lozenges') {
                      setDosePerTablet('');
                      setDosePerTablet2('');
                      setDosePerTablet2Unit(UNITS[0]);
                      setMultipleDosesPerTablet(false);
                    }
                    setShowRouteDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, r === routeSel && styles.dropdownItemTextSelected]}>{r}</Text>
                  {r === routeSel && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Start/End Date-Time Picker Modal (Record Administration style) */}
      <Modal visible={showAdminStyleDateTimePicker} transparent animationType="fade" onRequestClose={() => setShowAdminStyleDateTimePicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerModal, { width: '90%', maxWidth: 520, maxHeight: '90%', padding: 16 }]}>
            <Text style={[styles.pickerTitle, { marginBottom: 10 }]}>Select {adminStyleDateTimeTarget === 'start' ? 'Start Date & Time' : 'End Date'}</Text>

            <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, backgroundColor: '#f3f4f6', padding: 12, marginBottom: 8 }}>
              {(() => {
                const firstOfMonth = new Date(pickerYear, pickerMonth - 1, 1);
                const firstWeekday = firstOfMonth.getDay();
                const daysInMonth = new Date(pickerYear, pickerMonth, 0).getDate();
                const prevMonthDays = new Date(pickerYear, pickerMonth - 1, 0).getDate();
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
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'flex-start', marginBottom: 8 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 8 }}>
                        <View style={{ borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>{`${monthLabels[pickerMonth - 1]} ${pickerYear}`}</Text>
                        </View>
                        <View style={{ marginLeft: 6, flexDirection: 'row', alignItems: 'center' }}>
                          <TouchableOpacity
                            style={{ backgroundColor: '#e5e7eb', borderRadius: 6, width: 26, height: 22, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}
                            onPress={() => shiftDatePickerByMonths(1)}
                          >
                            <Text style={{ fontWeight: '800', color: '#111827', fontSize: 12 }}>↑</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ backgroundColor: '#e5e7eb', borderRadius: 6, width: 26, height: 22, alignItems: 'center', justifyContent: 'center' }}
                            onPress={() => shiftDatePickerByMonths(-1)}
                          >
                            <Text style={{ fontWeight: '800', color: '#111827', fontSize: 12 }}>↓</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 6 }}>
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, idx) => (
                          <Text key={`${w}-${idx}`} style={{ width: '14.2857%', textAlign: 'center', fontSize: 10, color: '#374151', fontWeight: '700' }}>{w}</Text>
                        ))}
                      </View>

                      {rows.map((row, rowIdx) => (
                        <View key={`row-${rowIdx}`} style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 0 }}>
                          {row.map((cell, cellIdx) => {
                            const isSelected = cell.offset === 0 && cell.day === pickerDay;
                            const isOutside = cell.offset !== 0;
                            return (
                              <TouchableOpacity
                                key={`cell-${rowIdx}-${cellIdx}`}
                                style={{
                                  width: '14.2857%',
                                  height: 22,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: 6,
                                  backgroundColor: isSelected ? '#3b82f6' : 'transparent',
                                }}
                                onPress={() => selectDatePickerCalendarDay(cell.day, cell.offset)}
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

                    <View style={{ width: 150, marginLeft: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ width: 72, textAlign: 'center', fontSize: 12, fontWeight: '800', color: '#475569' }}>Hour</Text>
                        <Text style={{ width: 72, textAlign: 'center', fontSize: 12, fontWeight: '800', color: '#475569' }}>Min</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <ScrollView style={{ width: 72, height: 220 }} showsVerticalScrollIndicator={false}>
                          {Array.from({ length: 24 }, (_, i) => i).map((hour24) => {
                            const selected = hour24 === pickerHours;
                            return (
                              <TouchableOpacity
                                key={`h-${hour24}`}
                                style={{
                                  borderRadius: 6,
                                  height: 34,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: selected ? '#3b82f6' : 'transparent',
                                }}
                                onPress={() => setPickerHours(hour24)}
                              >
                                <Text style={{ color: selected ? '#fff' : '#111827', fontWeight: selected ? '800' : '600', fontSize: 14 }}>
                                  {String(hour24).padStart(2, '0')}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>

                        <ScrollView style={{ width: 72, height: 220 }} showsVerticalScrollIndicator={false}>
                          {Array.from({ length: 60 }, (_, i) => i).map((minute) => {
                            const selected = minute === pickerMinutes;
                            return (
                              <TouchableOpacity
                                key={`m-${minute}`}
                                style={{
                                  borderRadius: 6,
                                  height: 34,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: selected ? '#3b82f6' : 'transparent',
                                }}
                                onPress={() => setPickerMinutes(minute)}
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
                );
              })()}
            </View>

            <View style={{ backgroundColor: '#f0f9ff', borderRadius: 8, padding: 12, marginTop: 4, marginBottom: 12, borderWidth: 1, borderColor: '#93c5fd' }}>
              <Text style={{ fontSize: 12, color: '#666', fontWeight: '600', marginBottom: 4 }}>Selected</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#2563eb' }}>
                {adminStyleDateTimeTarget === 'start'
                  ? new Date(pickerYear, pickerMonth - 1, pickerDay, pickerHours, pickerMinutes).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : new Date(pickerYear, pickerMonth - 1, pickerDay).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
              </Text>
            </View>

            <View style={styles.pickerActions}>
              <TouchableOpacity
                style={[styles.pickerButton, styles.pickerCancel]}
                onPress={() => {
                  setShowAdminStyleDateTimePicker(false);
                  setAdminStyleDateTimeTarget(null);
                }}
              >
                <Text style={styles.pickerActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickerButton, styles.pickerConfirm]} onPress={confirmAdminStyleDateTimePicker}>
                <Text style={[styles.pickerActionText, { color: '#fff' }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Unit Dropdown Modal */}
      <Modal visible={showUnitDropdown} transparent animationType="fade" onRequestClose={() => setShowUnitDropdown(false)}>
        <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setShowUnitDropdown(false)} activeOpacity={1}>
          <View style={styles.dropdownContent} onStartShouldSetResponder={() => true}>
          {UNITS.map(u => (
            <TouchableOpacity 
              key={u} 
              style={styles.dropdownItem} 
              onPress={() => {
                setUnit(u);
                if (!multipleDosesPerTablet) {
                  setDosePerTablet2Unit(u);
                }
                setShowUnitDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, u === unit && styles.dropdownItemTextSelected]}>{u}</Text>
              {u === unit && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Second Unit Dropdown Modal */}
      <Modal visible={showSecondUnitDropdown} transparent animationType="fade" onRequestClose={() => setShowSecondUnitDropdown(false)}>
        <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setShowSecondUnitDropdown(false)} activeOpacity={1}>
          <View style={styles.dropdownContent} onStartShouldSetResponder={() => true}>
          {UNITS.map(u => (
            <TouchableOpacity
              key={u}
              style={styles.dropdownItem}
              onPress={() => {
                setDosePerTablet2Unit(u);
                setShowSecondUnitDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, u === dosePerTablet2Unit && styles.dropdownItemTextSelected]}>{u}</Text>
              {u === dosePerTablet2Unit && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Script Location Dropdown Modal */}
      <Modal visible={showScriptLocationDropdown} transparent animationType="fade" onRequestClose={() => setShowScriptLocationDropdown(false)}>
        <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setShowScriptLocationDropdown(false)} activeOpacity={1}>
          <View style={styles.dropdownContent} onStartShouldSetResponder={() => true}>
          {SCRIPT_LOCATIONS.map(location => (
            <TouchableOpacity
              key={location}
              style={styles.dropdownItem}
              onPress={() => {
                setScriptLocation(location);
                if (location !== 'Other') {
                  setScriptLocationOtherDetail('');
                }
                setShowScriptLocationDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, location === scriptLocation && styles.dropdownItemTextSelected]}>{location}</Text>
              {location === scriptLocation && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Injection Stock Unit Dropdown Modal */}
      <Modal visible={showInjectionStockUnitDropdown} transparent animationType="fade" onRequestClose={() => setShowInjectionStockUnitDropdown(false)}>
        <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setShowInjectionStockUnitDropdown(false)} activeOpacity={1}>
          <View style={styles.dropdownContent} onStartShouldSetResponder={() => true}>
          {INJECTION_STOCK_UNITS.map(stockUnitOption => (
            <TouchableOpacity
              key={stockUnitOption}
              style={styles.dropdownItem}
              onPress={() => {
                setInjectionStockUnit(stockUnitOption);
                setShowInjectionStockUnitDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, stockUnitOption === injectionStockUnit && styles.dropdownItemTextSelected]}>{stockUnitOption}</Text>
              {stockUnitOption === injectionStockUnit && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Schedule Times Dropdown Modal */}
      <Modal visible={showSlotsDropdown} transparent animationType="fade" onRequestClose={() => setShowSlotsDropdown(false)}>
        <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setShowSlotsDropdown(false)} activeOpacity={1}>
          <View style={styles.dropdownContent} onStartShouldSetResponder={() => true}>
          <TouchableOpacity 
            style={styles.dropdownItem} 
            onPress={() => toggleSlot('beforeBreakfast')}
          >
            <Text style={styles.dropdownItemText}>Before Breakfast (05:00-10:00)</Text>
            {slots.beforeBreakfast && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownItem} 
            onPress={() => toggleSlot('breakfast')}
          >
            <Text style={styles.dropdownItemText}>Breakfast (06:00-10:00)</Text>
            {slots.breakfast && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownItem} 
            onPress={() => toggleSlot('lunch')}
          >
            <Text style={styles.dropdownItemText}>Lunch (10:00-15:00)</Text>
            {slots.lunch && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownItem} 
            onPress={() => toggleSlot('dinner')}
          >
            <Text style={styles.dropdownItemText}>Dinner (16:00-22:00)</Text>
            {slots.dinner && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownItem} 
            onPress={() => toggleSlot('beforeBed')}
          >
            <Text style={styles.dropdownItemText}>Before Bed (18:00-23:59)</Text>
            {slots.beforeBed && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Frequency Dropdown Modal */}
      <Modal visible={showFrequencyDropdown} transparent animationType="fade" onRequestClose={() => setShowFrequencyDropdown(false)}>
        <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setShowFrequencyDropdown(false)} activeOpacity={1}>
          <View style={styles.dropdownContent} onStartShouldSetResponder={() => true}>
          <TouchableOpacity 
            style={styles.dropdownItem} 
            onPress={() => {
              setFrequencyType('daily');
              setShowFrequencyDropdown(false);
            }}
          >
            <Text style={[styles.dropdownItemText, frequencyType === 'daily' && styles.dropdownItemTextSelected]}>Every Day</Text>
            {frequencyType === 'daily' && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownItem} 
            onPress={() => {
              setFrequencyType('every-second-day');
              setShowFrequencyDropdown(false);
            }}
          >
            <Text style={[styles.dropdownItemText, frequencyType === 'every-second-day' && styles.dropdownItemTextSelected]}>Every Second Day</Text>
            {frequencyType === 'every-second-day' && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownItem} 
            onPress={() => {
              setFrequencyType('weekly');
              setShowFrequencyDropdown(false);
            }}
          >
            <Text style={[styles.dropdownItemText, frequencyType === 'weekly' && styles.dropdownItemTextSelected]}>Weekly</Text>
            {frequencyType === 'weekly' && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownItem} 
            onPress={() => {
              setFrequencyType('fortnightly');
              setShowFrequencyDropdown(false);
            }}
          >
            <Text style={[styles.dropdownItemText, frequencyType === 'fortnightly' && styles.dropdownItemTextSelected]}>Fortnightly</Text>
            {frequencyType === 'fortnightly' && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownItem} 
            onPress={() => {
              setFrequencyType('monthly');
              setShowFrequencyDropdown(false);
            }}
          >
            <Text style={[styles.dropdownItemText, frequencyType === 'monthly' && styles.dropdownItemTextSelected]}>Monthly</Text>
            {frequencyType === 'monthly' && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>


        {/* Date Picker Modal */}
        <Modal visible={!!showDatePicker} transparent animationType="fade">
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerModal, { width: '95%', maxWidth: 550, maxHeight: '85%', padding: 12 }]}>
              <Text style={[styles.pickerTitle, { marginBottom: 8 }]}>Select Date</Text>
              
              {showDatePicker === 'pharmacy-collection' ? (
                <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, backgroundColor: '#f3f4f6', padding: 12, marginBottom: 8 }}>
                  {(() => {
                    const firstOfMonth = new Date(pickerYear, pickerMonth - 1, 1);
                    const firstWeekday = firstOfMonth.getDay();
                    const daysInMonth = new Date(pickerYear, pickerMonth, 0).getDate();
                    const prevMonthDays = new Date(pickerYear, pickerMonth - 1, 0).getDate();
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 8 }}>
                          <View style={{ borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>{`${monthLabels[pickerMonth - 1]} ${pickerYear}`}</Text>
                          </View>
                          <View style={{ marginLeft: 6, flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity
                              style={{ backgroundColor: '#e5e7eb', borderRadius: 6, width: 26, height: 22, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}
                              onPress={() => shiftDatePickerByMonths(1)}
                            >
                              <Text style={{ fontWeight: '800', color: '#111827', fontSize: 12 }}>↑</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ backgroundColor: '#e5e7eb', borderRadius: 6, width: 26, height: 22, alignItems: 'center', justifyContent: 'center' }}
                              onPress={() => shiftDatePickerByMonths(-1)}
                            >
                              <Text style={{ fontWeight: '800', color: '#111827', fontSize: 12 }}>↓</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 6 }}>
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, idx) => (
                            <Text key={`${w}-${idx}`} style={{ width: '14.2857%', textAlign: 'center', fontSize: 10, color: '#374151', fontWeight: '700' }}>{w}</Text>
                          ))}
                        </View>

                        {rows.map((row, rowIdx) => (
                          <View key={`row-${rowIdx}`} style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 0 }}>
                            {row.map((cell, cellIdx) => {
                              const isSelected = cell.offset === 0 && cell.day === pickerDay;
                              const isOutside = cell.offset !== 0;
                              return (
                                <TouchableOpacity
                                  key={`cell-${rowIdx}-${cellIdx}`}
                                  style={{
                                    width: '14.2857%',
                                    height: 26,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 6,
                                    backgroundColor: isSelected ? '#3b82f6' : 'transparent',
                                  }}
                                  onPress={() => selectDatePickerCalendarDay(cell.day, cell.offset)}
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
                      </>
                    );
                  })()}
                </View>
              ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Year and Month Dropdowns */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', marginBottom: 4, color: '#666', fontSize: 12 }}>Year</Text>
                    <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, overflow: 'hidden', maxHeight: 110 }}>
                      <ScrollView showsVerticalScrollIndicator={false}>
                        {getYearsArray(2026, 2076).map(year => (
                          <TouchableOpacity
                            key={year}
                            style={[
                              { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
                              pickerYear === year && { backgroundColor: '#dbeafe' }
                            ]}
                            onPress={() => setPickerYear(year)}
                          >
                            <Text style={[
                              { fontSize: 13, fontWeight: '600', color: '#333', textAlign: 'center' },
                              pickerYear === year && { color: '#2563eb', fontWeight: '700' }
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
                              pickerMonth === idx + 1 && { backgroundColor: '#dbeafe' }
                            ]}
                            onPress={() => setPickerMonth(idx + 1)}
                          >
                            <Text style={[
                              { fontSize: 13, fontWeight: '600', color: '#333', textAlign: 'center' },
                              pickerMonth === idx + 1 && { color: '#2563eb', fontWeight: '700' }
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
                    const firstDay = new Date(pickerYear, pickerMonth - 1, 1).getDay();
                    const daysInMonth = new Date(pickerYear, pickerMonth, 0).getDate();
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
                              const isBeforeMinDate = pickerYear < 2026;
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
                                  day === pickerDay && { backgroundColor: '#2563eb', borderColor: '#2563eb' },
                                  isDisabled && { opacity: 0.3 }
                                ]}
                                onPress={() => day !== null && !isBeforeMinDate && setPickerDay(day)}
                                disabled={isDisabled}
                              >
                                {day !== null && (
                                  <Text style={[
                                    { fontSize: 14, fontWeight: '600', color: '#333' },
                                    day === pickerDay && { color: '#fff', fontWeight: '700' }
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
              )}

              <View style={styles.pickerActions}>
                <TouchableOpacity style={[styles.pickerButton, styles.pickerCancel]} onPress={() => setShowDatePicker(null)}>
                  <Text style={styles.pickerActionText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.pickerButton, styles.pickerConfirm]} onPress={confirmDatePicker}>
                  <Text style={[styles.pickerActionText, { color: '#fff' }]}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Time Picker Modal */}
        <Modal visible={!!showTimePicker} transparent animationType="slide">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerModal}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Time</Text>
              </View>
              <View style={styles.pickerSelectors}>
                <View style={styles.selectorColumn}>
                  <Text style={styles.selectorLabel}>Hours</Text>
                  <FlatList data={getHoursArray()} keyExtractor={(i) => i.toString()} scrollEnabled={true} renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => setPickerHours(item)} style={[styles.selectorItem, pickerHours === item && styles.selectorItemActive]}>
                      <Text style={[styles.selectorItemText, pickerHours === item && styles.selectorItemTextActive]}>{String(item).padStart(2, '0')}</Text>
                    </TouchableOpacity>
                  )} style={styles.pickerList} />
                </View>
                <View style={styles.selectorColumn}>
                  <Text style={styles.selectorLabel}>Minutes</Text>
                  <FlatList data={getMinutesArray()} keyExtractor={(i) => i.toString()} scrollEnabled={true} renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => setPickerMinutes(item)} style={[styles.selectorItem, pickerMinutes === item && styles.selectorItemActive]}>
                      <Text style={[styles.selectorItemText, pickerMinutes === item && styles.selectorItemTextActive]}>{String(item).padStart(2, '0')}</Text>
                    </TouchableOpacity>
                  )} style={styles.pickerList} />
                </View>
              </View>
              <View style={styles.pickerActions}>
                <TouchableOpacity style={[styles.pickerButton, styles.pickerCancel]} onPress={() => setShowTimePicker(null)}>
                  <Text style={styles.pickerActionText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.pickerButton, styles.pickerConfirm]} onPress={confirmTimePicker}>
                  <Text style={[styles.pickerActionText, { color: '#fff' }]}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Specific Time Picker Modal */}
        <Modal visible={showCustomTimePicker} transparent animationType="slide">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerModal}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Add a Specific Time</Text>
              </View>
              <View style={styles.pickerSelectors}>
                <View style={styles.selectorColumn}>
                  <Text style={styles.selectorLabel}>Hours</Text>
                  <FlatList data={getHoursArray()} keyExtractor={(i) => i.toString()} scrollEnabled={true} renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => setCustomTimeHours(item)} style={[styles.selectorItem, customTimeHours === item && styles.selectorItemActive]}>
                      <Text style={[styles.selectorItemText, customTimeHours === item && styles.selectorItemTextActive]}>{String(item).padStart(2, '0')}</Text>
                    </TouchableOpacity>
                  )} style={styles.pickerList} />
                </View>
                <View style={styles.selectorColumn}>
                  <Text style={styles.selectorLabel}>Minutes</Text>
                  <FlatList data={getMinutesArray()} keyExtractor={(i) => i.toString()} scrollEnabled={true} renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => setCustomTimeMinutes(item)} style={[styles.selectorItem, customTimeMinutes === item && styles.selectorItemActive]}>
                      <Text style={[styles.selectorItemText, customTimeMinutes === item && styles.selectorItemTextActive]}>{String(item).padStart(2, '0')}</Text>
                    </TouchableOpacity>
                  )} style={styles.pickerList} />
                </View>
              </View>
              <View style={styles.pickerActions}>
                <TouchableOpacity style={[styles.pickerButton, styles.pickerCancel]} onPress={() => setShowCustomTimePicker(false)}>
                  <Text style={styles.pickerActionText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.pickerButton, styles.pickerConfirm]} 
                  onPress={() => {
                    const timeStr = `${String(customTimeHours).padStart(2, '0')}:${String(customTimeMinutes).padStart(2, '0')}`;
                    if (!customTimes.includes(timeStr)) {
                      setCustomTimes([...customTimes, timeStr]);
                    }
                    setShowCustomTimePicker(false);
                  }}
                >
                  <Text style={[styles.pickerActionText, { color: '#fff' }]}>Add Time</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      {/* Minimum Hours Between Doses Dropdown Modal */}
      <Modal visible={showMinHoursDropdown} transparent animationType="fade" onRequestClose={() => setShowMinHoursDropdown(false)}>
        <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setShowMinHoursDropdown(false)} activeOpacity={1}>
          <View style={styles.dropdownContent} onStartShouldSetResponder={() => true}>
          {MIN_HOURS_OPTIONS.map(hours => (
            <TouchableOpacity 
              key={hours} 
              style={styles.dropdownItem} 
              onPress={() => {
                setMinTimeBetweenDoses(hours.toString());
                setShowMinHoursDropdown(false);
              }}
            >
              <Text
                style={[styles.dropdownItemText, styles.prnDropdownItemText, minTimeBetweenDoses === hours.toString() && styles.dropdownItemTextSelected]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {hours}h minimum gap
              </Text>
              {minTimeBetweenDoses === hours.toString() && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Maximum Dose per Administration Dropdown Modal */}
      <Modal visible={showMaxDosePerAdminDropdown} transparent animationType="fade" onRequestClose={() => setShowMaxDosePerAdminDropdown(false)}>
        <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setShowMaxDosePerAdminDropdown(false)} activeOpacity={1}>
          <View style={styles.dropdownContent} onStartShouldSetResponder={() => true}>
          {MAX_DOSE_PER_ADMIN_OPTIONS.map(dose => (
            <TouchableOpacity 
              key={dose} 
              style={styles.dropdownItem} 
              onPress={() => {
                setMaxDosePerAdministration(dose.toString());
                setShowMaxDosePerAdminDropdown(false);
              }}
            >
              <Text
                style={[styles.dropdownItemText, styles.prnDropdownItemText, maxDosePerAdministration === dose.toString() && styles.dropdownItemTextSelected]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {dose} per administration
              </Text>
              {maxDosePerAdministration === dose.toString() && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Maximum Dose in 24 Hours Dropdown Modal */}
      <Modal visible={showMaxDose24hDropdown} transparent animationType="fade" onRequestClose={() => setShowMaxDose24hDropdown(false)}>
        <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setShowMaxDose24hDropdown(false)} activeOpacity={1}>
          <View style={styles.dropdownContent} onStartShouldSetResponder={() => true}>
          {MAX_DOSE_24H_OPTIONS.map(dose => (
            <TouchableOpacity 
              key={dose} 
              style={styles.dropdownItem} 
              onPress={() => {
                setMaxDosePer24Hours(dose.toString());
                setShowMaxDose24hDropdown(false);
              }}
            >
              <Text
                style={[styles.dropdownItemText, styles.prnDropdownItemText, maxDosePer24Hours === dose.toString() && styles.dropdownItemTextSelected]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {dose} in 24h
              </Text>
              {maxDosePer24Hours === dose.toString() && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
          </View>
        </TouchableOpacity>
      </Modal>

      </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

// Default export for backwards compatibility
export default AddMedicationModal;

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', maxWidth: 600, maxHeight: '90%', backgroundColor: '#f0f9ff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  container: { flex: 1, backgroundColor: '#f0f9ff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backButton: { color: '#2563eb', fontSize: 20, fontWeight: '500' },
  title: { fontSize: 22.5, fontWeight: '700', color: '#333', flex: 1, textAlign: 'center' },
  content: { padding: 24, alignItems: 'center' },
  form: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, width: '100%', maxWidth: 480 },
  field: { marginBottom: 12 },
  rowFields: { flexDirection: 'row', gap: 0 },
  label: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, backgroundColor: '#f9fafb' },
  multilineInput: { minHeight: 60, paddingTop: 8, textAlignVertical: 'top' },
  
  // Dropdown styles
  dropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#f9fafb' },
  dropdownButtonText: { fontSize: 16.25, color: '#333', fontWeight: '500', flex: 1 },
  prnDropdownButton: { minHeight: 48, alignItems: 'center' },
  prnDropdownValue: { fontSize: 13.5, lineHeight: 17, paddingRight: 8, flexShrink: 1, minWidth: 0 },
  dropdownArrow: { color: '#999', fontSize: 15, marginLeft: 6 },
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  dropdownContent: { backgroundColor: '#fff', borderRadius: 12, maxHeight: '60%', paddingVertical: 8, width: '86%', maxWidth: 420, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  dropdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dropdownItemText: { fontSize: 16.25, color: '#333', fontWeight: '500', flex: 1, flexShrink: 1, minWidth: 0, paddingRight: 12 },
  prnDropdownItemText: { fontSize: 14 },
  dropdownItemTextSelected: { color: '#2563eb', fontWeight: '600' },
  
  // Selected slots display
  selectedSlots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  slotTag: { backgroundColor: '#dbeafe', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13.75, color: '#2563eb', fontWeight: '500' },
  
  // Schedule type selection (PRN vs Regular)
  scheduleTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  scheduleTypeButton: { flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  scheduleTypeButtonActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  scheduleTypeButtonText: { fontSize: 14, fontWeight: '700', color: '#666', marginBottom: 2 },
  scheduleTypeButtonTextActive: { color: '#2563eb' },
  scheduleTypeDesc: { fontSize: 11, color: '#999', fontWeight: '500' },
  scheduleTypeDescActive: { color: '#1e40af' },
  
  // PRN toggle (legacy - can be removed)
  prnToggle: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f0f0f0', borderRadius: 4 },
  
  checkmark: { color: '#2563eb', fontSize: 17.5, fontWeight: '700', marginLeft: 8, width: 18, textAlign: 'right' },
  validationNoticeBox: { width: '100%', maxWidth: 480, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10 },
  validationNoticeTitle: { color: '#be123c', fontSize: 13, fontWeight: '800', marginBottom: 4 },
  validationNoticeText: { color: '#9f1239', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  submitButton: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 20, width: '100%', maxWidth: 480 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontWeight: '600', fontSize: 18.75 },
  
  pickerButton: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 8, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center' },
  pickerButtonText: { fontSize: 15, color: '#333', fontWeight: '500' },
  
  // Date/Time Picker Styles
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  pickerModal: { backgroundColor: '#fff', borderRadius: 10, padding: 16, maxHeight: '85%', width: '95%', maxWidth: 550, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  pickerHeader: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  pickerTitle: { fontSize: 22.5, fontWeight: '700', color: '#333' },
  pickerSelectors: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20, paddingHorizontal: 12 },
  selectorColumn: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  selectorLabel: { fontSize: 15, fontWeight: '600', color: '#666', marginBottom: 8 },
  pickerList: { height: 150 },
  selectorItem: { paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  selectorItemActive: { backgroundColor: '#dbeafe', borderRadius: 6, paddingHorizontal: 12 },
  selectorItemText: { fontSize: 17.5, color: '#666', fontWeight: '500' },
  selectorItemTextActive: { color: '#2563eb', fontWeight: '700' },
  pickerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  pickerCancel: { flex: 0.4, backgroundColor: '#e5e7eb' },
  pickerConfirm: { flex: 0.6, backgroundColor: '#2563eb' },
  pickerActionText: { color: '#333', fontWeight: '700', fontSize: 17.5 },
});
