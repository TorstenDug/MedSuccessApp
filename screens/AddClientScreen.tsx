import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, SafeAreaView, Image, Modal, FlatList } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { addClient, loadData } from '../src/storage';
import { getYearsArray, getMonthsArray, getDaysArray, formatDateFromParts, parseDateString, formatDateForDisplay } from '../src/dateTimeUtils';

export default function AddClientScreen({ route, navigation }: any) {
  const { locationId } = route.params;
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [allergies, setAllergies] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [weight, setWeight] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [gp, setGp] = useState('');
  const [gpClinic, setGpClinic] = useState('');
  const [medicareNumber, setMedicareNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState(locationId);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  
  // Load locations on mount
  React.useEffect(() => {
    async function loadLocations() {
      const data = await loadData();
      setLocations(data);
    }
    loadLocations();
  }, []);
  
  // Date picker state for DOB
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear() - 30);
  const [pickerMonth, setPickerMonth] = useState(1);
  const [pickerDay, setPickerDay] = useState(1);

  // Calculate age from DOB
  function calculateAge(dobStr: string): number | null {
    if (!dobStr) return null;
    try {
      const birthDate = new Date(dobStr);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age >= 0 ? age : null;
    } catch {
      return null;
    }
  }

  function openDatePicker() {
    if (dob) {
      const parsed = parseDateString(dob);
      if (parsed) {
        setPickerYear(parsed.year);
        setPickerMonth(parsed.month);
        setPickerDay(parsed.day);
      }
    }
    setShowDatePicker(true);
  }

  function confirmDatePicker() {
    setDob(formatDateFromParts(pickerYear, pickerMonth, pickerDay));
    setShowDatePicker(false);
  }

  // Photo picker
  async function pickPhoto() {
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
        setPhotoUri(base64Uri);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image');
    }
  }

  async function submit() {
    if (!name.trim()) {
      Alert.alert('Validation', 'Please enter client name');
      return;
    }
    if (!dob.trim()) {
      Alert.alert('Validation', 'Please select date of birth');
      return;
    }
    if (!allergies.trim()) {
      Alert.alert('Validation', 'Please enter allergies (enter "Nil" if none)');
      return;
    }
    if (!selectedLocationId) {
      Alert.alert('Validation', 'Please select a location');
      return;
    }
    setLoading(true);
    try {
      const newClient = await addClient(selectedLocationId, { 
        name, 
        dob, 
        allergies, 
        additionalInfo: additionalInfo.trim() || undefined,
        medications: [],
        photoUri: photoUri || undefined,
        gender: gender ? (gender as 'Male' | 'Female' | 'Other') : undefined,
        weight: weight || undefined,
        contactEmail: contactEmail || undefined,
        gp: gp || undefined,
        gpClinic: gpClinic || undefined,
        medicareNumber: medicareNumber || undefined,
      });
      Alert.alert('Success', 'Client added successfully');
      navigation.goBack({ newClientId: newClient.id });
    } catch (e) {
      Alert.alert('Error', 'Failed to add client');
    } finally {
      setLoading(false);
    }
  }

  const age = calculateAge(dob);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add Client</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.form}>
          {/* Photo Section */}
          <View style={styles.photoSection}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderText}>📷</Text>
              </View>
            )}
            <TouchableOpacity style={styles.photoButton} onPress={pickPhoto} disabled={loading}>
              <Text style={styles.photoButtonText}>{photoUri ? 'Change Photo' : 'Add Photo'}</Text>
            </TouchableOpacity>
          </View>

          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput placeholder="Enter client's full name" value={name} onChangeText={setName} style={styles.input} editable={!loading} />
          </View>

          {/* DOB and Age */}
          <View style={styles.field}>
            <Text style={styles.label}>Date of Birth *</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => openDatePicker()} disabled={loading}>
              <Text style={styles.pickerButtonText}>
                {dob ? formatDateForDisplay(dob) : '📅 Select Date of Birth'}
              </Text>
            </TouchableOpacity>
            {age !== null && <Text style={styles.ageDisplay}>Age: {age} years old</Text>}
          </View>

          {/* Gender */}
          <View style={styles.field}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderRow}>
              {(['Male', 'Female', 'Other'] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderButton, gender === g && styles.genderButtonSelected]}
                  onPress={() => setGender(g)}
                  disabled={loading}
                >
                  <Text style={[styles.genderButtonText, gender === g && styles.genderButtonTextSelected]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Weight */}
          <View style={styles.field}>
            <Text style={styles.label}>Weight (Optional)</Text>
            <TextInput placeholder="e.g., 75 kg" value={weight} onChangeText={setWeight} style={styles.input} editable={!loading} />
          </View>

          {/* Contact Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Contact Email (Optional)</Text>
            <TextInput placeholder="contact@example.com" value={contactEmail} onChangeText={setContactEmail} style={styles.input} keyboardType="email-address" editable={!loading} />
          </View>

          {/* GP */}
          <View style={styles.field}>
            <Text style={styles.label}>GP (Optional)</Text>
            <TextInput placeholder="Dr. Smith" value={gp} onChangeText={setGp} style={styles.input} editable={!loading} />
          </View>

          {/* GP Clinic */}
          <View style={styles.field}>
            <Text style={styles.label}>GP Clinic (Optional)</Text>
            <TextInput placeholder="Medical Centre Name" value={gpClinic} onChangeText={setGpClinic} style={styles.input} editable={!loading} />
          </View>

          {/* Medicare Number */}
          <View style={styles.field}>
            <Text style={styles.label}>Medicare Number (Optional)</Text>
            <TextInput placeholder="1234 56789 0" value={medicareNumber} onChangeText={setMedicareNumber} style={styles.input} editable={!loading} />
          </View>

          {/* Allergies */}
          <View style={styles.field}>
            <Text style={styles.label}>Allergies *</Text>
            <TextInput placeholder="List any known allergies" value={allergies} onChangeText={setAllergies} style={[styles.input, styles.multilineInput]} multiline editable={!loading} />
            <Text style={styles.helperText}>If no allergies, enter "Nil"</Text>
          </View>

          {/* Additional Information */}
          <View style={styles.field}>
            <Text style={styles.label}>Additional Information (Optional)</Text>
            <TextInput
              placeholder="Any extra care notes or client information"
              value={additionalInfo}
              onChangeText={setAdditionalInfo}
              style={[styles.input, styles.multilineInput]}
              multiline
              editable={!loading}
            />
          </View>

          {/* Location */}
          <View style={styles.field}>
            <Text style={styles.label}>Location *</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowLocationPicker(true)} disabled={loading}>
              <Text style={styles.pickerButtonText}>
                {locations.find(l => l.id === selectedLocationId)?.name || 'Select Location'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={[styles.submitButton, loading && styles.submitButtonDisabled]} onPress={submit} disabled={loading}>
          <Text style={styles.submitButtonText}>{loading ? 'Creating...' : '✓ Create Client'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerModal, { width: '95%', maxWidth: 550, maxHeight: '85%', padding: 12 }]}
          >
            <Text style={[styles.pickerTitle, { marginBottom: 8 }]}>Select Date of Birth</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', marginBottom: 4, color: '#666', fontSize: 12 }}>Year</Text>
                  <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, overflow: 'hidden', maxHeight: 110 }}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {getYearsArray(1950, 2050).map(year => (
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
                      {getMonthsArray().map((m, idx) => (
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

                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', marginBottom: 4, color: '#666', fontSize: 12 }}>Day</Text>
                  <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, overflow: 'hidden', maxHeight: 110 }}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {getDaysArray(pickerYear, pickerMonth).map(day => (
                        <TouchableOpacity
                          key={day}
                          style={[
                            { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
                            pickerDay === day && { backgroundColor: '#2563eb' }
                          ]}
                          onPress={() => setPickerDay(day)}
                        >
                          <Text style={[
                            { fontSize: 13, fontWeight: '600', color: '#333', textAlign: 'center' },
                            pickerDay === day && { color: '#fff', fontWeight: '700' }
                          ]}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.pickerActions}>
              <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.pickerActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickerConfirm} onPress={confirmDatePicker}>
                <Text style={[styles.pickerActionText, { color: '#fff' }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Location Picker Modal */}
      <Modal visible={showLocationPicker} transparent animationType="fade" onRequestClose={() => setShowLocationPicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Location</Text>
            </View>
            <FlatList
              data={locations}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.locationItem,
                    selectedLocationId === item.id && styles.locationItemSelected
                  ]}
                  onPress={() => {
                    setSelectedLocationId(item.id);
                    setShowLocationPicker(false);
                  }}
                >
                  <Text style={[
                    styles.locationItemText,
                    selectedLocationId === item.id && styles.locationItemTextSelected
                  ]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              scrollEnabled={locations.length > 5}
              nestedScrollEnabled={true}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backButton: { color: '#2563eb', fontSize: 16, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700', color: '#1f2937', flex: 1, textAlign: 'center' },
  content: { padding: 16, paddingBottom: 32, alignItems: 'center' },
  form: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb', width: '100%', maxWidth: 420 },
  photoSection: { alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  photoPreview: { width: 110, height: 110, borderRadius: 55, marginBottom: 12, borderWidth: 2, borderColor: '#2563eb' },
  photoPlaceholder: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#d1d5db', borderStyle: 'dashed' },
  photoPlaceholderText: { fontSize: 44 },
  photoButton: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  photoButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#1f2937', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, backgroundColor: '#fff', color: '#1f2937' },
  multilineInput: { minHeight: 80, paddingTop: 9, textAlignVertical: 'top' },
  ageDisplay: { fontSize: 12, color: '#666', marginTop: 6, fontWeight: '500' },
  helperText: { fontSize: 12, color: '#888', marginTop: 5, fontStyle: 'italic' },
  genderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  genderButton: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingVertical: 9, alignItems: 'center', backgroundColor: '#fff' },
  genderButtonSelected: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  genderButtonText: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  genderButtonTextSelected: { color: '#2563eb', fontWeight: '700' },
  submitButton: { backgroundColor: '#2563eb', paddingVertical: 13, borderRadius: 6, alignItems: 'center', marginBottom: 16 },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  pickerButton: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fff', justifyContent: 'center' },
  pickerButtonText: { fontSize: 14, color: '#1f2937', textAlign: 'center', fontWeight: '500' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerModal: { backgroundColor: '#fff', borderRadius: 12, width: '88%', maxWidth: 480, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  pickerHeader: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937', textAlign: 'center' },
  pickerSelectors: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'space-around' },
  selectorColumn: { flex: 1, alignItems: 'center', maxHeight: 180 },
  selectorLabel: { fontSize: 11, fontWeight: '600', color: '#666', marginBottom: 6, textAlign: 'center' },
  pickerList: { width: 52, maxHeight: 140 },
  selectorItem: { paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center', borderRadius: 4 },
  selectorItemActive: { backgroundColor: '#dbeafe' },
  selectorItemText: { fontSize: 13, color: '#666' },
  selectorItemTextActive: { color: '#2563eb', fontWeight: '700' },
  pickerActions: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 11, gap: 8 },
  pickerCancel: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingVertical: 9, alignItems: 'center' },
  pickerConfirm: { flex: 1, backgroundColor: '#2563eb', borderRadius: 6, paddingVertical: 9, alignItems: 'center' },
  pickerActionText: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
  locationItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  locationItemSelected: { backgroundColor: '#dbeafe' },
  locationItemText: { fontSize: 14, color: '#1f2937', fontWeight: '500' },
  locationItemTextSelected: { fontWeight: '700', color: '#2563eb' },
});
