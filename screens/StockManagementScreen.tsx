import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { loadData, updateMedication, addAdministrationRecord, Medication } from '../src/storage';
import { COLORS } from '../src/constants';
import { safeParseInt } from '../src/validation';
import { showError, logError } from '../src/errorHandling';

const SCRIPT_LOCATIONS = ['Pharmacy file', 'Home office', 'Clients possession', 'Management office', 'Other'] as const;

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
  scriptRepeatsCount: string;
  prescriptionFileUri?: string;
  scriptLocation: (typeof SCRIPT_LOCATIONS)[number] | '';
  scriptLocationOtherDetail: string;
  receiptBase64?: string;
  receiptUnavailable: boolean;
  receiptUnavailableReason: string;
};

export function StockManagementScreen({ route, navigation }: Props) {
  const { clientId, locationId, clientName } = route.params;

  const usesApproximateStock = (medication: Medication): boolean => {
    const route = String(medication.route || '').toLowerCase();
    return route.includes('liquid') || route.includes('eye drops');
  };
  
  const [entries, setEntries] = useState<MedicationStockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showValidationPopup, setShowValidationPopup] = useState(false);
  const [validationPopupText, setValidationPopupText] = useState('');
  const [expandedMeds, setExpandedMeds] = useState<Record<string, boolean>>({});
  const [showScriptLocationDropdown, setShowScriptLocationDropdown] = useState(false);
  const [scriptLocationTargetIndex, setScriptLocationTargetIndex] = useState<number | null>(null);

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
          notes: '',
          scriptRepeatsCount: med.scriptRepeatsCount?.toString() || '',
          prescriptionFileUri: med.prescriptionFileUri,
          scriptLocation: med.scriptLocation || '',
          scriptLocationOtherDetail: med.scriptLocationOtherDetail || '',
          receiptBase64: undefined,
          receiptUnavailable: false,
          receiptUnavailableReason: '',
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

  async function pickReceiptFile(index: number) {
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
        updateEntry(index, 'receiptBase64', base64Uri);
        updateEntry(index, 'receiptUnavailable', false);
        updateEntry(index, 'receiptUnavailableReason', '');
      }
    } catch (e) {
      console.error('Error picking receipt:', e);
      showError(e, 'Failed to select receipt');
    }
  }

  async function pickPrescriptionFile(index: number) {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]?.base64) {
        const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        updateEntry(index, 'prescriptionFileUri', base64Uri);
      }
    } catch (e) {
      showError(e, 'Failed to select prescription file');
    }
  }

  function openScriptLocationDropdown(index: number) {
    setScriptLocationTargetIndex(index);
    setShowScriptLocationDropdown(true);
  }

  function selectScriptLocation(location: (typeof SCRIPT_LOCATIONS)[number]) {
    if (scriptLocationTargetIndex !== null) {
      updateEntry(scriptLocationTargetIndex, 'scriptLocation', location);
      if (location !== 'Other') {
        updateEntry(scriptLocationTargetIndex, 'scriptLocationOtherDetail', '');
      }
    }
    setShowScriptLocationDropdown(false);
    setScriptLocationTargetIndex(null);
  }

  async function handleSubmit() {
    const validationIssues: string[] = [];

    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      const wasted = safeParseInt(entry.wasted, 0);
      const disposed = safeParseInt(entry.disposed, 0);
      const collected = safeParseInt(entry.collected, 0);

      if (wasted > 0 && !entry.wastedReason.trim()) {
        validationIssues.push(`${entry.medication.name}: enter wasted reason.`);
      }

      if ((disposed > 0 || collected > 0) && !entry.transferRecipient.trim()) {
        validationIssues.push(`${entry.medication.name}: enter organisation/pharmacy/individual name.`);
      }

      if (disposed > 0 && !entry.receiptBase64 && !entry.receiptUnavailable) {
        validationIssues.push(`${entry.medication.name}: upload transfer/disposal/collection receipt or mark as unavailable.`);
      }

      if (disposed > 0 && entry.receiptUnavailable && !entry.receiptUnavailableReason.trim()) {
        validationIssues.push(`${entry.medication.name}: provide reason for missing transfer/disposal/collection receipt.`);
      }

      if (entry.verified === false && !entry.actualStock.trim()) {
        validationIssues.push(`${entry.medication.name}: enter actual stock count.`);
      }

      if (entry.verified === false && !entry.notes.trim()) {
        validationIssues.push(`${entry.medication.name}: enter discrepancy notes.`);
      }
    }

    if (validationIssues.length > 0) {
      const message = validationIssues.map(issue => `- ${issue}`).join('\n');
      setValidationPopupText(message);
      setShowValidationPopup(true);
      return;
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
        const scriptRepeatsCountChanged = safeParseInt(entry.scriptRepeatsCount, -1) !== (entry.medication.scriptRepeatsCount ?? -1);
        const prescriptionFileChanged = (entry.prescriptionFileUri || '') !== (entry.medication.prescriptionFileUri || '');
        const scriptLocationChanged = (entry.scriptLocation || '') !== (entry.medication.scriptLocation || '');
        const scriptLocationOtherDetailChanged = (entry.scriptLocationOtherDetail || '') !== (entry.medication.scriptLocationOtherDetail || '');
        const hasScriptChange = !!entry.medication.hasScriptRepeats && (scriptRepeatsCountChanged || prescriptionFileChanged || scriptLocationChanged || scriptLocationOtherDetailChanged);
        const hasAnyChange =
          disposed !== 0 ||
          wasted !== 0 ||
          collected !== 0 ||
          hasVerification ||
          hasActualStockInput ||
          hasNotes ||
          hasScriptChange;

        if (!hasAnyChange) continue;
        
        let newStock: number;
        if (entry.verified === false && entry.actualStock.trim()) {
          newStock = safeParseInt(entry.actualStock, 0);
        } else {
          newStock = Math.max(0, previousStock - disposed - wasted + collected);
        }

        const stockChanged = newStock !== previousStock;
        
        if (stockChanged || hasScriptChange) {
          const updatedMed = {
            ...entry.medication,
            stock: newStock,
            scriptRepeatsCount: entry.medication.hasScriptRepeats
              ? (entry.scriptRepeatsCount.trim() ? safeParseInt(entry.scriptRepeatsCount, 0) : undefined)
              : entry.medication.scriptRepeatsCount,
            prescriptionFileUri: entry.medication.hasScriptRepeats
              ? entry.prescriptionFileUri
              : entry.medication.prescriptionFileUri,
            scriptLocation: entry.medication.hasScriptRepeats
              ? (entry.scriptLocation || undefined)
              : entry.medication.scriptLocation,
            scriptLocationOtherDetail: entry.medication.hasScriptRepeats && entry.scriptLocation === 'Other'
              ? (entry.scriptLocationOtherDetail.trim() || undefined)
              : undefined,
          };
          await updateMedication(locationId, clientId, updatedMed);
        }
        
        const details = [
          `${usesApproximateStock(entry.medication) ? 'Current (approx.)' : 'Current'}: ${previousStock}`,
          disposed > 0 ? `Disposed/Transferred: ${disposed}` : null,
          disposed > 0 && entry.transferTo ? `Transfer To: ${entry.transferTo}` : null,
          (disposed > 0 || collected > 0) && entry.transferRecipient.trim()
            ? `Organisation/Pharmacy/Individual: ${entry.transferRecipient.trim()}`
            : null,
          wasted > 0 ? `Wasted: ${wasted}` : null,
          wasted > 0 && entry.wastedReason.trim() ? `Wasted Reason: ${entry.wastedReason.trim()}` : null,
          collected > 0 ? `Collected: ${collected}` : null,
          `${usesApproximateStock(entry.medication) ? 'New (approx.)' : 'New'}: ${newStock}`,
          stockChanged ? `Change: ${newStock - previousStock}` : 'Change: 0',
          entry.verified === true ? 'Verified: Match' : entry.verified === false ? 'Verified: Mismatch' : null,
          entry.verified === false && entry.actualStock.trim() ? `Actual Count: ${entry.actualStock.trim()}` : null,
          entry.notes ? `Notes: ${entry.notes}` : null,
          hasScriptChange && entry.medication.hasScriptRepeats ? `Script Repeats: ${entry.scriptRepeatsCount.trim() || 'Not set'}` : null,
          hasScriptChange && entry.medication.hasScriptRepeats ? `Script Location: ${entry.scriptLocation || 'Not set'}` : null,
          hasScriptChange && entry.medication.hasScriptRepeats && entry.scriptLocation === 'Other' && entry.scriptLocationOtherDetail.trim()
            ? `Script Location Other: ${entry.scriptLocationOtherDetail.trim()}`
            : null,
          hasScriptChange && entry.medication.hasScriptRepeats && entry.prescriptionFileUri ? 'Prescription File: Uploaded' : null,
          (disposed > 0 || collected > 0) && entry.receiptBase64 ? `Receipt: ${entry.receiptBase64}` : null,
          (disposed > 0 || collected > 0) && entry.receiptUnavailable ? 'Receipt: Unavailable' : null,
          (disposed > 0 || collected > 0) && entry.receiptUnavailable && entry.receiptUnavailableReason.trim()
            ? `Receipt Unavailable Reason: ${entry.receiptUnavailableReason.trim()}`
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
          
          {entries.length === 0 ? (
            <Text style={styles.noMedsText}>No medications for this client</Text>
          ) : (
            entries.map((entry, index) => {
              const currentStock = entry.medication.stock || 0;
              const disposed = safeParseInt(entry.disposed, 0);
              const wasted = safeParseInt(entry.wasted, 0);
              const collected = safeParseInt(entry.collected, 0);
              const projectedStock = Math.max(0, currentStock - disposed - wasted + collected);
              const isApproximate = usesApproximateStock(entry.medication);
              
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
                      <Text style={styles.currentStock}>{isApproximate ? `Current: approx. ${currentStock}` : `Current: ${currentStock}`}</Text>
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View>
                      {entry.medication.hasScriptRepeats && (
                        <View style={[styles.field, { backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, padding: 10 }]}> 
                          <Text style={[styles.adjLabel, { color: COLORS.primary, fontWeight: '700' }]}>Script Repeat Details</Text>
                          <TextInput
                            style={styles.adjInput}
                            placeholder="Number of script repeats (optional)"
                            placeholderTextColor={COLORS.textPlaceholder}
                            keyboardType="number-pad"
                            value={entry.scriptRepeatsCount}
                            onChangeText={(text) => updateEntry(index, 'scriptRepeatsCount', text.replace(/[^0-9]/g, ''))}
                          />
                          <TouchableOpacity
                            style={[styles.pickerButton, { marginTop: 8 }]}
                            onPress={() => openScriptLocationDropdown(index)}
                          >
                            <Text style={styles.pickerButtonText}>{entry.scriptLocation || 'Select script location (if known)'}</Text>
                          </TouchableOpacity>
                          {entry.scriptLocation === 'Other' && (
                            <TextInput
                              style={[styles.adjInput, { marginTop: 8 }]}
                              placeholder="Please specify"
                              placeholderTextColor={COLORS.textPlaceholder}
                              value={entry.scriptLocationOtherDetail}
                              onChangeText={(text) => updateEntry(index, 'scriptLocationOtherDetail', text)}
                            />
                          )}
                          <TouchableOpacity
                            style={[
                              styles.receiptUploadButton,
                              { marginTop: 8 },
                              entry.prescriptionFileUri && { backgroundColor: COLORS.successLight, borderColor: COLORS.success }
                            ]}
                            onPress={() => pickPrescriptionFile(index)}
                          >
                            <Text
                              style={[
                                styles.receiptUploadText,
                                entry.prescriptionFileUri && { color: COLORS.successDark, fontWeight: '700' }
                              ]}
                            >
                              {entry.prescriptionFileUri ? '✓ Prescription File Uploaded' : '+ Upload Prescription File'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

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

                  {(disposed > 0 || collected > 0) && (
                    <View style={styles.field}>
                      <Text style={styles.adjLabel}>Organisation / Pharmacy / Individual Name *</Text>
                      <TextInput
                        style={styles.adjInput}
                        placeholder="e.g. City Pharmacy, ABC Support, John Smith"
                        placeholderTextColor={COLORS.textPlaceholder}
                        value={entry.transferRecipient}
                        onChangeText={(text) => updateEntry(index, 'transferRecipient', text)}
                      />
                    </View>
                  )}

                  {(disposed > 0 || collected > 0) && (
                    <View style={[styles.field, { backgroundColor: COLORS.gray50, borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 8, padding: 10 }]}>
                      <Text style={styles.adjLabel}>Receipt of Transfer / Disposal / Collection</Text>
                      <TouchableOpacity
                        style={[
                          styles.receiptUploadButton,
                          entry.receiptBase64 && { backgroundColor: COLORS.successLight, borderColor: COLORS.success }
                        ]}
                        onPress={() => pickReceiptFile(index)}
                      >
                        <Text
                          style={[
                            styles.receiptUploadText,
                            entry.receiptBase64 && { color: COLORS.successDark, fontWeight: '700' }
                          ]}
                        >
                          {entry.receiptBase64 ? '✓ Receipt Uploaded' : '+ Upload Receipt Image'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.receiptUnavailableRow, { marginTop: 10 }]}
                        onPress={() => updateEntry(index, 'receiptUnavailable', !entry.receiptUnavailable)}
                      >
                        <View style={[styles.receiptCheckbox, entry.receiptUnavailable && styles.receiptCheckboxChecked]}>
                          {entry.receiptUnavailable ? <Text style={styles.receiptCheckboxTick}>✓</Text> : null}
                        </View>
                        <Text style={styles.receiptUnavailableText}>Unable to supply transfer form</Text>
                      </TouchableOpacity>

                      {entry.receiptUnavailable && (
                        <View style={{ marginTop: 8 }}>
                          <Text style={styles.adjLabel}>Reason (Required)</Text>
                          <TextInput
                            style={[styles.adjInput, { minHeight: 60, textAlignVertical: 'top', paddingTop: 8 }]}
                            placeholder="e.g. Receipt not provided"
                            placeholderTextColor={COLORS.textPlaceholder}
                            value={entry.receiptUnavailableReason}
                            onChangeText={(text) => updateEntry(index, 'receiptUnavailableReason', text)}
                            multiline
                            numberOfLines={2}
                          />
                        </View>
                      )}
                    </View>
                  )}

                      <View style={styles.field}>
                        <Text style={styles.adjLabel}>Projected New Stock</Text>
                        <Text style={styles.projectedStockValue}>{isApproximate ? `New: approx. ${projectedStock}` : `New: ${projectedStock}`}</Text>
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

      <Modal
        visible={showScriptLocationDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowScriptLocationDropdown(false);
          setScriptLocationTargetIndex(null);
        }}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowScriptLocationDropdown(false);
            setScriptLocationTargetIndex(null);
          }}
        >
          <View style={[styles.pickerModal, { maxWidth: 420 }]}> 
            <Text style={styles.pickerTitle}>Select Script Location</Text>
            {SCRIPT_LOCATIONS.map((location) => (
              <TouchableOpacity
                key={location}
                style={styles.dropdownItem}
                onPress={() => selectScriptLocation(location)}
              >
                <Text style={styles.dropdownItemText}>{location}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Update Stock</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showValidationPopup}
        transparent
        animationType="fade"
        onRequestClose={() => setShowValidationPopup(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerModal, { maxWidth: 460 }]}> 
            <Text style={styles.pickerTitle}>Cannot Save: Missing Information</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              <Text style={{ fontSize: 13, lineHeight: 20, color: COLORS.textSecondary }}>{validationPopupText}</Text>
            </ScrollView>
            <View style={styles.pickerActions}>
              <TouchableOpacity
                style={[styles.pickerActionButton, styles.pickerConfirm]}
                onPress={() => setShowValidationPopup(false)}
              >
                <Text style={[styles.pickerActionText, { color: COLORS.white }]}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  contentContainer: { padding: 16, paddingBottom: 20, alignItems: 'center' },
  section: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.gray50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    padding: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: COLORS.textPrimary },
  field: { marginBottom: 12 },
  medicationCard: { 
    backgroundColor: COLORS.white,
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
  dropdownItem: {
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: COLORS.white,
  },
  dropdownItemText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  
  noMedsText: { fontSize: 13, color: COLORS.textTertiary, textAlign: 'center', paddingVertical: 16 },
  
  footer: { 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderTopWidth: 1, 
    borderTopColor: COLORS.gray200, 
    backgroundColor: COLORS.white,
    alignItems: 'center',
  },
  submitButton: { backgroundColor: COLORS.primary, paddingVertical: 13, borderRadius: 6, alignItems: 'center', width: '100%', maxWidth: 420 },
  submitButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
