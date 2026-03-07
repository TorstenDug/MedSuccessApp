import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { loadData, addLocation, Location } from '../src/storage';

export default function LocationsScreen({ navigation }: any) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const focused = useIsFocused();

  async function refresh() {
    setLoading(true);
    const data = await loadData();
    setLocations(data);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [focused]);

  async function handleAddLocation() {
    if (!name.trim()) {
      Alert.alert('Validation', 'Please enter a location name');
      return;
    }
    await addLocation(name);
    setName('');
    await refresh();
    Alert.alert('Success', 'Location added');
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Locations</Text>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : locations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={styles.emptyTitle}>No locations yet</Text>
          <Text style={styles.emptyDesc}>Add your first location to get started</Text>
        </View>
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate('LocationClients', { locationId: item.id, name: item.name })} style={styles.locationCard}>
              <View style={styles.locationHeader}>
                <Text style={styles.locationName}>{item.name}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.clients.length} client{item.clients.length !== 1 ? 's' : ''}</Text>
                </View>
              </View>
              <Text style={styles.locationTip}>→ Tap to view clients</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput placeholder="Location name (e.g., Main Office)" value={name} onChangeText={setName} style={styles.input} />
        <TouchableOpacity style={styles.addButton} onPress={handleAddLocation}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 24, fontWeight: '700', color: '#2563eb' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#666' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8, color: '#333' },
  emptyDesc: { fontSize: 14, color: '#999', textAlign: 'center' },
  listContent: { padding: 12 },
  locationCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  locationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  locationName: { fontSize: 16, fontWeight: '600', color: '#333' },
  badge: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, color: '#2563eb', fontWeight: '500' },
  locationTip: { fontSize: 13, color: '#999' },
  inputContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#f9fafb' },
  addButton: { backgroundColor: '#2563eb', paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center' },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
