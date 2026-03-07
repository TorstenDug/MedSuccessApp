import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, Modal, FlatList, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { loadData, updateMedication, addAdministrationRecord, Medication } from '../src/storage';
import { COLORS } from '../src/constants';
import { safeParseInt } from '../src/validation';
import { showError, logError } from '../src/errorHandling';
import {
  getCurrentDate,
  getCurrentTime,
  parseDateString,
  parseTimeString,
  formatDateFromParts,
  formatTimeFromParts,
  getYearsArray,
  getMonthsArray,
  getDaysArray,
  getHoursArray,
  getMinutesArray,
} from '../src/dateTimeUtils';

type Props = {
  route: any;
  navigation: any;
};

type MedicationStockEntry = {
  medication: Medication;
  disposed: string;
  wasted: string;
  wastedReason: string;
  transferTo: 'pharmacy' | 'individual' | '';
  transferRecipient: string;
  collected: string;
  verified: boolean | null;
  actualStock: string;
  notes: string;
};

export function StockManagementScreen({ route, navigation }: Props) {
  const { clientId, locationId, clientName } = route.params;
  
  const [entries, setEntries] = useState<MedicationStockEntry[]>([]);
  const [pharmacyName, setPharmacyName] = useState('');
  const [collectionDate, setCollectionDate] = useState(getCurrentDate());
  const [collectionTime, setCollectionTime] = useState(getCurrentTime());
  const [receiptUri, setReceiptUri] = useState<string | undefined>(undefined);
  const [receiptBase64, setReceiptBase64] = useState<string | undefined>(undefined);
  const [receiptUnavailable, setReceiptUnavailable] = useState(false);
  const [receiptUnavailableReason, setReceiptUnavailableReason] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth() + 1);
  const [pickerDay, setPickerDay] = useState(new Date().getDate());
  const [pickerHours, setPickerHours] = useState(new Date().getHours());
  const [pickerMinutes, setPickerMinutes] = useState(new Date().getMinutes());
  const [loading, setLoading] = useState(true);
  const [expandedMeds, setExpandedMeds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadMedications();
  }, []);

  function toggleMedication(medId: string) {
    setExpandedMeds((prev) => ({ ...prev, [medId]: !prev[medId] }));
  }

  async function loadMedications() {
    try {
      const data = await loadData();
      const location = data.find(l => l.id === locationId);
      const foundClient = location?.clients.find(c => c.id === clientId);
      
      if (foundClient && foundClient.medications) {
        const medicationEntries: MedicationStockEntry[] = foundClient.medications.map(med => ({
          medication: med,
          disposed: '',
          wasted: '',
          wastedReason: '',
          transferTo: '',
          transferRecipient: '',
          collected: '',
          verified: null,
          actualStock: '',
          notes: ''
        }));
        setEntries(medicationEntries);
      }
      setLoading(false);
    } catch (error) {
      logError(error, 'Load Medications');
      showError(error, 'Failed to load medications');
      setLoading(false);
    }
  }

  function updateEntry(index: number, field: keyof MedicationStockEntry, value: any) {
    setEntries((prevEntries) => {
      const newEntries = [...prevEntries];
      newEntries[index] = { ...newEntries[index], [field]: value };
      return newEntries;
    });
  }

  function openDatePicker() {
    const parsed = parseDateString(collectionDate);
    if (parsed) {
      setPickerYear(parsed.year);
      setPickerMonth(parsed.month);
      setPickerDay(parsed.day);
    }
    setShowDatePicker(true);
  }

  function confirmDatePicker() {
    setCollectionDate(formatDateFromParts(pickerYear, pickerMonth, pickerDay));
    setShowDatePicker(false);
  }

  function openTimePicker() {
    const parsed = parseTimeString(collectionTime);
    if (parsed) {
      setPickerHours(parsed.hours);
      setPickerMinutes(parsed.minutes);
    }
    setShowTimePicker(true);
  }

  function confirmTimePicker() {
    setCollectionTime(formatTimeFromParts(pickerHours, pickerMinutes));
    setShowTimePicker(false);
  }

  async function pickReceiptFile() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets[0]?.base64) {
        const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setReceiptBase64(base64Uri);
        setReceiptUri(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Error picking receipt:', e);
      showError(e, 'Failed to select receipt');
    }
  }

  async function handleSubmit() {
    const hasStockMovement = entries.some((entry) => {
      const disposed = safeParseInt(entry.disposed, 0);
      const wasted = safeParseInt(entry.wasted, 0);
      const collected = safeParseInt(entry.collected, 0);
      return disposed > 0 || wasted > 0 || collected > 0;
    });

    const hasTransferOrDisposal = entries.some((entry) => {
      const disposed = safeParseInt(entry.disposed, 0);
      return disposed > 0;
    });

    if (hasTransferOrDisposal && !receiptBase64 && !receiptUnavailable) {
      showError('Please upload a transfer/disposal receipt or mark it as unavailable.', 'Required Field');
      return;
    }

    if (hasTransferOrDisposal && receiptUnavailable && !receiptUnavailableReason.trim()) {
      showError('Please provide a reason for missing transfer/disposal receipt.', 'Required Field');
      return;
    }

    if (hasStockMovement && !collectionDate.trim()) {
      showError(
        'Please select a stock movement date at the top of the screen.',
        'Required Field'
      );
      return;
    }

    if (hasStockMovement && !collectionTime.trim()) {
      showError(
        'Please select a stock movement time at the top of the screen.',
        'Required Field'
      );
      return;
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const wasted = safeParseInt(entry.wasted, 0);
      const disposed = safeParseInt(entry.disposed, 0);
      if (wasted > 0 && !entry.wastedReason.trim()) {
        showError(
          `Please describe what happened for wasted stock on ${entry.medication.name}`,
          'Required Field'
        );
        return;
      }

      if (disposed > 0 && entry.transferTo === 'individual' && !entry.transferRecipient.trim()) {
        showError(
          `Please enter who the disposal/transfer was to for ${entry.medication.name}`,
          'Required Field'
        );
        return;
      }
      
      if (entry.verified === false) {
        if (!entry.actualStock.trim()) {
          showError(
            `Please enter actual stock count for ${entry.medication.name}`,
            'Required Field'
          );
          return;
        }
        if (!entry.notes.trim()) {
          showError(
            `Please enter discrepancy notes for ${entry.medication.name}`,
            'Required Field'
          );
          return;
        }
      }
    }
    
    try {
      let changesRecorded = 0;

      for (const entry of entries) {
        const disposed = safeParseInt(entry.disposed, 0);
        const wasted = safeParseInt(entry.wasted, 0);
        const collected = safeParseInt(entry.collected, 0);
        const previousStock = entry.medication.stock || 0;
        const hasVerification = entry.verified !== null;
        const hasActualStockInput = entry.actualStock.trim().length > 0;
        const hasNotes = entry.notes.trim().length > 0;
        const hasAnyChange =
          disposed !== 0 ||
          wasted !== 0 ||
          collected !== 0 ||
          hasVerification ||
          hasActualStockInput ||
          hasNotes;

        if (!hasAnyChange) continue;
        
        let newStock: number;
        if (entry.verified === false && entry.actualStock.trim()) {
          newStock = safeParseInt(entry.actualStock, 0);
        } else {
          newStock = Math.max(0, previousStock - disposed - wasted + collected);
        }

        const stockChanged = newStock !== previousStock;
        
        if (stockChanged) {
          const updatedMed = { ...entry.medication, stock: newStock };
          await updateMedication(locationId, clientId, updatedMed);
        }
        
        const details = [
          `Current: ${previousStock}`,
          disposed > 0 ? `Disposed/Transferred: ${disposed}` : null,
          disposed > 0 && entry.transferTo ? `Transfer To: ${entry.transferTo}` : null,
          disposed > 0 && entry.transferTo === 'individual' && entry.transferRecipient.trim()
            ? `Recipient: ${entry.transferRecipient.trim()}`
            : null,
          wasted > 0 ? `Wasted: ${wasted}` : null,
          wasted > 0 && entry.wastedReason.trim() ? `Wasted Reason: ${entry.wastedReason.trim()}` : null,
          collected > 0 ? `Collected: ${collected}` : null,
          (disposed > 0 || collected > 0) && pharmacyName.trim() ? `Pharmacy: ${pharmacyName.trim()}` : null,
          (disposed > 0 || wasted > 0 || collected > 0) && collectionDate.trim() ? `Date: ${collectionDate.trim()}` : null,
          (disposed > 0 || wasted > 0 || collected > 0) && collectionTime.trim() ? `Time: ${collectionTime.trim()}` : null,
          `New: ${newStock}`,
          stockChanged ? `Change: ${newStock - previousStock}` : 'Change: 0',
          entry.verified === true ? 'Verified: Match' : entry.verified === false ? 'Verified: Mismatch' : null,
          entry.verified === false && entry.actualStock.trim() ? `Actual Count: ${entry.actualStock.trim()}` : null,
          entry.notes ? `Notes: ${entry.notes}` : null,
          disposed > 0 && receiptBase64 ? `Receipt: ${receiptBase64}` : null,
          disposed > 0 && receiptUnavailable ? 'Receipt: Unavailable' : null,
          disposed > 0 && receiptUnavailable && receiptUnavailableReason.trim()
            ? `Receipt Unavailable Reason: ${receiptUnavailableReason.trim()}`
            : null
        ].filter(Boolean).join(' | ');
        
        await addAdministrationRecord(
          locationId,
          clientId,
          entry.medication.id,
          new Date().toISOString(),
          'stock-adjustment',
          undefined,
          details
        );

        changesRecorded += 1;
      }

      if (changesRecorded === 0) {
        showError('Enter at least one stock change before updating.', 'No Changes');
        return;
      }
      
      navigation.goBack();
    } catch (error) {
      logError(error, 'Stock Update');
      showError(error, 'Failed to update stock');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Stock Management</Text>
        <Text style={styles.clientName}>{clientName}</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medications</Text>
          <View style={styles.field}>
            <Text style={styles.adjLabel}>Pharmacy Name (Optional)</Text>
            <TextInput
              style={styles.adjInput}
              placeholder="e.g. City Pharmacy"
              placeholderTextColor={COLORS.textPlaceholder}
              value={pharmacyName}
              onChangeText={setPharmacyName}
            />
          </View>

          <View style={styles.adjustmentRow}>
            <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.adjLabel}>Stock Movement Date</Text>
              <TouchableOpacity style={styles.pickerButton} onPress={openDatePicker}>
                <Text style={styles.pickerButtonText}>{collectionDate}</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.adjLabel}>Stock Movement Time</Text>
              <TouchableOpacity style={styles.pickerButton} onPress={openTimePicker}>
                <Text style={styles.pickerButtonText}>{collectionTime}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.adjLabel}>
              📋 Receipt of Disposal / Transfer {receiptBase64 ? '✓' : '(Optional)'}
            </Text>
            <TouchableOpacity
              style={[
                styles.receiptUploadButton,
                receiptBase64 && { backgroundColor: COLORS.successLight, borderColor: COLORS.success }
              ]}
              onPress={pickReceiptFile}
            >
              <Text
                style={[
                  styles.receiptUploadText,
                  receiptBase64 && { color: COLORS.successDark, fontWeight: '700' }
                ]}
              >
                {receiptBase64 ? '✓ Receipt Uploaded' : '+ Upload Receipt Image'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <TouchableOpacity
              style={styles.receiptUnavailableRow}
              onPress={() => setReceiptUnavailable((prev) => !prev)}
            >
              <View style={[styles.receiptCheckbox, receiptUnavailable && styles.receiptCheckboxChecked]}>
                {receiptUnavailable ? <Text style={styles.receiptCheckboxTick}>✓</Text> : null}
              </View>
              <Text style={styles.receiptUnavailableText}>Unable to supply transfer form</Text>
            </TouchableOpacity>
          </View>

          {receiptUnavailable && (
            <View style={styles.field}>
              <Text style={styles.adjLabel}>Reason (Required)</Text>
              <TextInput
                style={[styles.adjInput, { minHeight: 60, textAlignVertical: 'top', paddingTop: 8 }]}
                placeholder="e.g. Pharmacy did not provide a receipt"
                placeholderTextColor={COLORS.textPlaceholder}
                value={receiptUnavailableReason}
                onChangeText={setReceiptUnavailableReason}
                multiline
                numberOfLines={2}
              />
            </View>
          )}
          
          {entries.length === 0 ? (
            <Text style={styles.noMedsText}>No medications for this client</Text>
          ) : (
            entries.map((entry, index) => {
              const currentStock = entry.medication.stock || 0;
              const disposed = safeParseInt(entry.disposed, 0);
              const wasted = safeParseInt(entry.wasted, 0);
              const collected = safeParseInt(entry.collected, 0);
              const projectedStock = Math.max(0, currentStock - disposed - wasted + collected);
              
              const isExpanded = !!expandedMeds[entry.medication.id];
              const strengthLabel = entry.medication.totalDose || 'N/A';

              return (
                <View key={`${entry.medication.id}-${entry.verified}`} style={styles.medicationCard}>
                  <TouchableOpacity
                    style={styles.medHeader}
                    onPress={() => toggleMedication(entry.medication.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.medHeaderRow}>
                        <Text style={styles.expandArrow}>{isExpanded ? 'v' : '>'}</Text>
                        <Text style={styles.medName}>{entry.medication.name}</Text>
                      </View>
                      <Text style={styles.medStrength}>Strength: {strengthLabel}</Text>
                    </View>
                    <View style={styles.stockHeaderValues}>
                      <Text style={styles.currentStock}>Current: {currentStock}</Text>
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View>
                      <View style={styles.adjustmentRow}>
                    <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                      <Text style={styles.adjLabel}>Disposed/Transferred</Text>
                      <TextInput
                        style={styles.adjInput}
                        placeholder="0"
                        placeholderTextColor={COLORS.textPlaceholder}
                        keyboardType="number-pad"
                        value={entry.disposed}
                        onChangeText={(text) => updateEntry(index, 'disposed', text)}
                      />
                    </View>

                    <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
                      <Text style={styles.adjLabel}>Collected</Text>
                      <TextInput
                        style={styles.adjInput}
                        placeholder="0"
                        placeholderTextColor={COLORS.textPlaceholder}
                        keyboardType="number-pad"
                        value={entry.collected}
                        onChangeText={(text) => updateEntry(index, 'collected', text)}
                      />
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.adjLabel}>Transfer Destination (if disposed/transferred)</Text>
                    <View style={styles.transferRow}>
                      <TouchableOpacity
                        style={[
                          styles.transferOption,
                          entry.transferTo === 'pharmacy' && styles.transferOptionActive
                        ]}
                        onPress={() => updateEntry(index, 'transferTo', entry.transferTo === 'pharmacy' ? '' : 'pharmacy')}
                      >
                        <Text
                          style={[
                            styles.transferOptionText,
                            entry.transferTo === 'pharmacy' && styles.transferOptionTextActive
                          ]}
                        >
                          Pharmacy
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.transferOption,
                          entry.transferTo === 'individual' && styles.transferOptionActive
                        ]}
                        onPress={() => updateEntry(index, 'transferTo', entry.transferTo === 'individual' ? '' : 'individual')}
                      >
                        <Text
                          style={[
                            styles.transferOptionText,
                            entry.transferTo === 'individual' && styles.transferOptionTextActive
                          ]}
                        >
                          Individual/Organisation
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {entry.transferTo === 'individual' && (
                    <View style={styles.field}>
                      <Text style={styles.adjLabel}>Who was it transferred to?</Text>
                      <TextInput
                        style={styles.adjInput}
                        placeholder="e.g. John Smith, ABC Support"
                        placeholderTextColor={COLORS.textPlaceholder}
                        value={entry.transferRecipient}
                        onChangeText={(text) => updateEntry(index, 'transferRecipient', text)}
                      />
                    </View>
                  )}

                      <View style={styles.field}>
                        <Text style={styles.adjLabel}>Projected New Stock</Text>
                        <Text style={styles.projectedStockValue}>New: {projectedStock}</Text>
                      </View>

                  <View style={styles.field}>
                    <Text style={styles.adjLabel}>Wasted (No receipt required)</Text>
                    <TextInput
                      style={styles.adjInput}
                      placeholder="0"
                      placeholderTextColor={COLORS.textPlaceholder}
                      keyboardType="number-pad"
                      value={entry.wasted}
                      onChangeText={(text) => updateEntry(index, 'wasted', text)}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.adjLabel}>Wasted Reason (Required if wasted)</Text>
                    <TextInput
                      style={[styles.adjInput, { minHeight: 60, textAlignVertical: 'top', paddingTop: 8 }]}
                      placeholder="e.g. Client spat out tablets"
                      placeholderTextColor={COLORS.textPlaceholder}
                      value={entry.wastedReason}
                      onChangeText={(text) => updateEntry(index, 'wastedReason', text)}
                      multiline
                      numberOfLines={2}
                    />
                  </View>

                      <View style={styles.verificationSection}>
                    <Text style={styles.verificationLabel}>Stock Count Matches?</Text>
                    <View style={styles.verificationButtonsRow}>
                      <TouchableOpacity
                        key={`yes-${entry.verified}`}
                        style={{
                          flex: 1,
                          borderWidth: entry.verified === true ? 3 : 2,
                          borderColor: entry.verified === true ? COLORS.success : COLORS.gray300,
                          backgroundColor: entry.verified === true ? COLORS.successLight : COLORS.white,
                          borderRadius: 6,
                          paddingVertical: 12,
                          alignItems: 'center',
                          marginHorizontal: 4
                        }}
                        onPress={() => {
                          if (entry.verified === true) {
                            updateEntry(index, 'verified', null);
                          } else {
                            updateEntry(index, 'verified', true);
                            updateEntry(index, 'actualStock', '');
                            updateEntry(index, 'notes', '');
                          }
                        }}
                      >
                        <Text style={{
                          fontSize: entry.verified === true ? 15 : 14,
                          fontWeight: entry.verified === true ? '700' : '600',
                          color: entry.verified === true ? COLORS.successDark : COLORS.textSecondary
                        }}>
                          ✓ Yes
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        key={`no-${entry.verified}`}
                        style={{
                          flex: 1,
                          borderWidth: entry.verified === false ? 3 : 2,
                          borderColor: entry.verified === false ? COLORS.error : COLORS.gray300,
                          backgroundColor: entry.verified === false ? COLORS.errorLight : COLORS.white,
                          borderRadius: 6,
                          paddingVertical: 12,
                          alignItems: 'center',
                          marginHorizontal: 4
                        }}
                        onPress={() => {
                          if (entry.verified === false) {
                            updateEntry(index, 'verified', null);
                            updateEntry(index, 'actualStock', '');
                            updateEntry(index, 'notes', '');
                          } else {
                            updateEntry(index, 'verified', false);
                          }
                        }}
                      >
                        <Text style={{
                          fontSize: entry.verified === false ? 15 : 14,
                          fontWeight: entry.verified === false ? '700' : '600',
                          color: entry.verified === false ? COLORS.errorDark : COLORS.textSecondary
                        }}>
                          ✗ No
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {entry.verified === false && (
                      <>
                        <View style={styles.field}>
                          <Text style={styles.adjLabel}>Actual Stock Count *</Text>
                          <TextInput
                            style={styles.adjInput}
                            placeholder="Enter actual stock count"
                            placeholderTextColor={COLORS.textPlaceholder}
                            keyboardType="number-pad"
                            value={entry.actualStock}
                            onChangeText={(text) => updateEntry(index, 'actualStock', text)}
                          />
                        </View>

                        <View style={styles.field}>
                          <Text style={styles.adjLabel}>Discrepancy Notes *</Text>
                          <TextInput
                            style={[styles.adjInput, { minHeight: 60, textAlignVertical: 'top', paddingTop: 8 }]}
                            placeholder="Describe the discrepancy..."
                            placeholderTextColor={COLORS.textPlaceholder}
                            value={entry.notes}
                            onChangeText={(text) => updateEntry(index, 'notes', text)}
                            multiline
                            numberOfLines={3}
                          />
                        </View>
                      </>
                    )}

                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>Select Date</Text>
            <View style={styles.pickerSelectors}>
              <View style={styles.selectorColumn}>
                <Text style={styles.selectorLabel}>Year</Text>
                <FlatList
                  data={getYearsArray(2020, 2076)}
                  keyExtractor={(item) => item.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setPickerYear(item)}
                      style={[styles.selectorItem, pickerYear === item && styles.selectorItemActive]}
                    >
                      <Text style={[styles.selectorItemText, pickerYear === item && styles.selectorItemTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  )}
                  style={styles.pickerList}
                />
              </View>
              <View style={styles.selectorColumn}>
                <Text style={styles.selectorLabel}>Month</Text>
                <FlatList
                  data={getMonthsArray().map((month, index) => ({ label: month, value: index + 1 }))}
                  keyExtractor={(item) => item.value.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setPickerMonth(item.value)}
                      style={[styles.selectorItem, pickerMonth === item.value && styles.selectorItemActive]}
                    >
                      <Text style={[styles.selectorItemText, pickerMonth === item.value && styles.selectorItemTextActive]}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                  style={styles.pickerList}
                />
              </View>
              <View style={styles.selectorColumn}>
                <Text style={styles.selectorLabel}>Day</Text>
                <FlatList
                  data={getDaysArray(pickerYear, pickerMonth)}
                  keyExtractor={(item) => item.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setPickerDay(item)}
                      style={[styles.selectorItem, pickerDay === item && styles.selectorItemActive]}
                    >
                      <Text style={[styles.selectorItemText, pickerDay === item && styles.selectorItemTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  )}
                  style={styles.pickerList}
                />
              </View>
            </View>
            <View style={styles.pickerActions}>
              <TouchableOpacity style={[styles.pickerActionButton, styles.pickerCancel]} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.pickerActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickerActionButton, styles.pickerConfirm]} onPress={confirmDatePicker}>
                <Text style={[styles.pickerActionText, { color: COLORS.white }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showTimePicker} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>Select Time</Text>
            <View style={styles.pickerSelectors}>
              <View style={styles.selectorColumn}>
                <Text style={styles.selectorLabel}>Hours</Text>
                <FlatList
                  data={getHoursArray()}
                  keyExtractor={(item) => item.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setPickerHours(item)}
                      style={[styles.selectorItem, pickerHours === item && styles.selectorItemActive]}
                    >
                      <Text style={[styles.selectorItemText, pickerHours === item && styles.selectorItemTextActive]}>{String(item).padStart(2, '0')}</Text>
                    </TouchableOpacity>
                  )}
                  style={styles.pickerList}
                />
              </View>
              <View style={styles.selectorColumn}>
                <Text style={styles.selectorLabel}>Minutes</Text>
                <FlatList
                  data={getMinutesArray()}
                  keyExtractor={(item) => item.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setPickerMinutes(item)}
                      style={[styles.selectorItem, pickerMinutes === item && styles.selectorItemActive]}
                    >
                      <Text style={[styles.selectorItemText, pickerMinutes === item && styles.selectorItemTextActive]}>{String(item).padStart(2, '0')}</Text>
                    </TouchableOpacity>
                  )}
                  style={styles.pickerList}
                />
              </View>
            </View>
            <View style={styles.pickerActions}>
              <TouchableOpacity style={[styles.pickerActionButton, styles.pickerCancel]} onPress={() => setShowTimePicker(false)}>
                <Text style={styles.pickerActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickerActionButton, styles.pickerConfirm]} onPress={confirmTimePicker}>
                <Text style={[styles.pickerActionText, { color: COLORS.white }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Update Stock</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  loadingText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: COLORS.textSecondary },
  header: { 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.gray200, 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    backgroundColor: COLORS.gray50 
  },
  backButton: { fontSize: 16, color: COLORS.primary, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  clientName: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  content: { flex: 1 },
  contentContainer: { paddingBottom: 20 },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: COLORS.textPrimary },
  field: { marginBottom: 12 },
  medicationCard: { 
    backgroundColor: COLORS.gray50, 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: COLORS.gray200 
  },
  medHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  medName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  medStrength: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  medHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expandArrow: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    width: 26,
    height: 26,
    borderRadius: 13,
    textAlign: 'center',
    lineHeight: 26,
  },
  currentStock: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  stockHeaderValues: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  newStockHeader: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  expandLabel: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  projectedStockValue: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  
  adjustmentRow: { flexDirection: 'row', marginBottom: 12 },
  adjLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, color: COLORS.gray700 },
  adjInput: { 
    borderWidth: 1, 
    borderColor: COLORS.gray300, 
    borderRadius: 6, 
    paddingHorizontal: 10, 
    paddingVertical: 8, 
    fontSize: 14, 
    backgroundColor: COLORS.white 
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
  },
  pickerButtonText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModal: {
    width: '90%',
    maxWidth: 520,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  pickerSelectors: {
    flexDirection: 'row',
    gap: 8,
  },
  selectorColumn: {
    flex: 1,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    textAlign: 'center',
  },
  pickerList: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 6,
  },
  selectorItem: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
    backgroundColor: COLORS.white,
  },
  selectorItemActive: {
    backgroundColor: COLORS.primaryLight,
  },
  selectorItemText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontWeight: '600',
  },
  selectorItemTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  pickerActionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  pickerCancel: {
    backgroundColor: COLORS.gray300,
  },
  pickerConfirm: {
    backgroundColor: COLORS.primary,
  },
  pickerActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  verificationSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.gray200 },
  verificationLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  verificationButtonsRow: { flexDirection: 'row', marginBottom: 12 },

  transferRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  transferOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  transferOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  transferOptionText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  transferOptionTextActive: { color: COLORS.primary, fontWeight: '700' },
  
  receiptUploadButton: {
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptUploadText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  receiptUnavailableRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  receiptCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: COLORS.gray400,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  receiptCheckboxChecked: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  receiptCheckboxTick: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  receiptUnavailableText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  
  noMedsText: { fontSize: 13, color: COLORS.textTertiary, textAlign: 'center', paddingVertical: 16 },
  
  footer: { 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderTopWidth: 1, 
    borderTopColor: COLORS.gray200, 
    backgroundColor: COLORS.white 
  },
  submitButton: { backgroundColor: COLORS.primary, paddingVertical: 13, borderRadius: 6, alignItems: 'center' },
  submitButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
