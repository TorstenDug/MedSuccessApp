import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, SafeAreaView, Modal, TextInput, Image } from 'react-native';
import { loadData, Location, Client, addLocation } from '../src/storage';
import ClientDetailsPanel from './ClientDetailsPanel';
import { generateTimelineDisplayItems } from '../src/utils/timelineGenerator';
import { COLORS } from '../src/constants';
import { logError, showError } from '../src/errorHandling';

export default function LocationClientsScreen({ navigation }: any) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  async function refresh() {
    setLoading(true);
    const data = await loadData();
    setLocations(data);
    if (data.length > 0 && !selectedLocationId) {
      setSelectedLocationId(data[0].id);
    }
    setLoading(false);
  }

  useEffect(() => { 
    refresh();
    // Auto-refresh when returning from add screens
    const unsubscribe = navigation.addListener('focus', (payload: any) => {
      refresh();
      // Check if we're returning with a new client ID
      if (payload?.params?.newClientId) {
        setSelectedClientId(payload.params.newClientId);
      }
    });
    return unsubscribe;
  }, [navigation]);

  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const clients = selectedLocation?.clients || [];

  const clientAlerts = useMemo(() => {
    const map = new Map<string, 'overdue' | 'due' | null>();
    (selectedLocation?.clients || []).forEach((client) => {
      const items = generateTimelineDisplayItems(client.medications || []);
      const hasOverdue = items.some(i => i.status === 'overdue');
      const hasDue = !hasOverdue && items.some(i => i.status === 'due');
      map.set(client.id, hasOverdue ? 'overdue' : hasDue ? 'due' : null);
    });
    return map;
  }, [selectedLocation]);

  useEffect(() => {
    if (loading) return;
    if (clients.length === 0) {
      setSelectedClientId(null);
      return;
    }
    const exists = clients.some(c => c.id === selectedClientId);
    if (!selectedClientId || !exists) {
      setSelectedClientId(clients[0].id);
    }
  }, [loading, clients, selectedClientId]);

  async function handleAddLocation() {
    if (!newLocationName.trim()) {
      showError('Please enter a location name', 'Validation');
      return;
    }
    try {
      await addLocation(newLocationName);
      setNewLocationName('');
      setShowAddLocation(false);
      refresh();
    } catch (e) {
      logError(e, 'Add Location');
      showError(e, 'Failed to add location');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Image source={require('../assets/medsuccess-logo.png')} style={styles.logoLarge} />
      </View>

      <View style={styles.splitContainer}>
        {/* LEFT SIDEBAR: Clients (locations moved to header dropdown) */}
        <View style={styles.sidebar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={styles.sectionLabel}>Location</Text>
            <TouchableOpacity style={styles.inlineButton} onPress={() => setShowAddLocation(true)}>
              <Text style={styles.inlineButtonText}>+ Add Location</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : locations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📍</Text>
              <Text style={styles.emptyTitle}>No locations yet</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.locationSelector}
              onPress={() => setShowLocationDropdown(true)}
            >
              <Text style={styles.locationSelectorLabel}>{selectedLocation ? selectedLocation.name : 'Select a location'}</Text>
              <Text style={styles.locationSelectorCount}>{selectedLocation ? `${selectedLocation.clients?.length || 0} clients` : ''}</Text>
              <Text style={styles.locationSelectorArrow}>▼</Text>
            </TouchableOpacity>
          )}

          {selectedLocation && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 }}>
                <Text style={styles.sectionLabel}>Clients</Text>
                <TouchableOpacity 
                  style={[styles.inlineButton, !selectedLocation && styles.inlineButtonDisabled]} 
                  onPress={() => selectedLocation && navigation.navigate('AddClient', { locationId: selectedLocation.id })}
                >
                  <Text style={styles.inlineButtonText}>+ Add Client</Text>
                </TouchableOpacity>
              </View>
              {selectedLocation.clients?.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>👥</Text>
                  <Text style={styles.emptyTitle}>No clients yet</Text>
                </View>
              ) : (
                <FlatList
                  data={selectedLocation.clients || []}
                  keyExtractor={(i) => i.id}
                  scrollEnabled={true}
                  style={styles.clientsList}
                  renderItem={({ item }: { item: Client }) => (
                    <TouchableOpacity
                      onPress={() => setSelectedClientId(item.id)}
                      style={[styles.clientCard, selectedClientId === item.id && styles.clientCardSelected]}
                    >
                      {item.photoUri && (
                        <Image source={{ uri: item.photoUri }} style={styles.clientPhoto} />
                      )}
                      <View style={styles.clientInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={styles.clientName}>{item.name}</Text>
                          {clientAlerts.get(item.id) && (
                            <View
                              style={[
                                styles.alertBadge,
                                clientAlerts.get(item.id) === 'overdue'
                                  ? styles.alertBadgeOverdue
                                  : styles.alertBadgeDue
                              ]}
                            >
                              <Text style={styles.alertBadgeText}>
                                {clientAlerts.get(item.id) === 'overdue' ? 'Overdue' : 'Due'}
                              </Text>
                            </View>
                          )}
                        </View>
                        {item.dob && <Text style={styles.clientMeta}>📅 {item.dob}</Text>}
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </>
          )}
        </View>

        {/* RIGHT PANEL: Client Details */}
        <View style={styles.main}>
          {selectedLocation && selectedClientId ? (
            <ClientDetailsPanel
              client={selectedLocation.clients?.find(c => c.id === selectedClientId) || null}
              locationId={selectedLocation.id}
              navigation={navigation}
              onClientUpdated={refresh}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyContainerText}>Select a client to view details</Text>
            </View>
          )}
        </View>
      </View>

      {/* Modal for Add Location */}
      {/* Modal: Location Dropdown */}
      <Modal visible={showLocationDropdown} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 400 }]}> 
            <Text style={styles.modalTitle}>Select Location</Text>
            <FlatList
              data={locations}
              keyExtractor={(i) => i.id}
              renderItem={({ item }: { item: Location }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedLocationId(item.id);
                    setSelectedClientId(null);
                    setShowLocationDropdown(false);
                  }}
                  style={[styles.locationButton, selectedLocationId === item.id && styles.locationButtonSelected]}
                >
                  <Text style={[styles.locationButtonText, selectedLocationId === item.id && styles.locationButtonTextSelected]}>📍 {item.name} ({item.clients?.length || 0})</Text>
                </TouchableOpacity>
              )}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity style={[styles.modalButton, styles.modalCancelButton]} onPress={() => setShowLocationDropdown(false)}>
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={showAddLocation} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Location</Text>
            <Text style={styles.modalLabel}>Location Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter location name (e.g., Main Office, Clinic A)"
              value={newLocationName}
              onChangeText={setNewLocationName}
              placeholderTextColor={COLORS.textTertiary}
              editable={true}
            />
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowAddLocation(false);
                  setNewLocationName('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSubmitButton]}
                onPress={handleAddLocation}
              >
                <Text style={styles.modalButtonText}>Add Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryPale },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray200 },
  logoLarge: { height: 50, maxWidth: 300, resizeMode: 'contain' },
  locationTab: { paddingHorizontal: 8, paddingVertical: 6 },
  locationTabLabel: { color: COLORS.primaryLight, fontSize: 11, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.6 },
  locationTabValue: { color: COLORS.white, fontSize: 16, fontWeight: '800', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginLeft: 8 },
  headerButtonText: { color: COLORS.white, fontWeight: '700' },
  headerButtonDisabled: { opacity: 0.5 },
  splitContainer: { flexDirection: 'row', flex: 1, paddingLeft: 20, paddingTop: 20, paddingRight: 20 },
  sidebar: { width: '30%', padding: 12, backgroundColor: COLORS.white, overflow: 'scroll', borderRadius: 12, marginRight: 12, shadowColor: COLORS.shadow, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  main: { width: '70%', backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden', shadowColor: COLORS.shadow, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 10, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inlineButton: { backgroundColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  inlineButtonText: { color: COLORS.white, fontWeight: '600', fontSize: 11 },
  inlineButtonDisabled: { opacity: 0.5 },
  loadingText: { color: COLORS.textTertiary, fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 16 },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyTitle: { fontSize: 13, color: COLORS.textTertiary },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainerText: { fontSize: 16, color: COLORS.textTertiary },
  locationButton: { backgroundColor: COLORS.white, borderRadius: 8, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 4, borderLeftColor: COLORS.gray200, shadowColor: COLORS.shadow, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  locationButtonSelected: { backgroundColor: COLORS.primaryLight, borderLeftColor: COLORS.primary },
  locationButtonText: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },
  locationButtonTextSelected: { fontWeight: '600', color: COLORS.primary },
  manageLocButton: { backgroundColor: COLORS.primary, borderRadius: 8, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10 },
  manageLocButtonText: { color: COLORS.white, fontWeight: '600', fontSize: 13, textAlign: 'center' },
  clientCard: { backgroundColor: COLORS.white, borderRadius: 8, marginBottom: 8, padding: 12, borderLeftWidth: 4, borderLeftColor: COLORS.gray200, shadowColor: COLORS.shadow, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1, flexDirection: 'row', alignItems: 'center' },
  clientCardSelected: { backgroundColor: COLORS.primaryLight, borderLeftColor: COLORS.primary },
  clientPhoto: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  clientMeta: { fontSize: 11, color: COLORS.textSecondary },
  alertBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 8 },
  alertBadgeDue: { backgroundColor: COLORS.warning },
  alertBadgeOverdue: { backgroundColor: COLORS.error },
  alertBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  addClientButton: { backgroundColor: COLORS.success, borderRadius: 8, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10 },
  addClientButtonText: { color: COLORS.white, fontWeight: '600', fontSize: 13, textAlign: 'center' },
  selectedLocationSummary: { backgroundColor: COLORS.white, padding: 12, borderRadius: 8, marginBottom: 8 },
  selectedLocationName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  selectedLocationCount: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6 },
  locationSelector: { backgroundColor: COLORS.white, padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: COLORS.shadow, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  locationSelectorLabel: { fontSize: 14, fontWeight: '700', color: COLORS.primary, flex: 1 },
  locationSelectorCount: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
  locationSelectorArrow: { color: COLORS.primary, fontSize: 12, fontWeight: '700', marginLeft: 8 },
  clientsList: { flex: 1 },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: COLORS.white, borderRadius: 12, padding: 24, width: '80%', maxWidth: 400, shadowColor: COLORS.shadow, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: COLORS.textPrimary },
  modalLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: COLORS.textSecondary },
  modalInput: { backgroundColor: COLORS.gray100, borderRadius: 8, borderWidth: 1, borderColor: COLORS.gray300, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 16, color: COLORS.textPrimary, minHeight: 44 },
  modalButtonGroup: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  modalButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  modalCancelButton: { backgroundColor: COLORS.gray300 },
  modalSubmitButton: { backgroundColor: COLORS.primary },
  modalButtonText: { fontWeight: '600', color: COLORS.white, textAlign: 'center' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
