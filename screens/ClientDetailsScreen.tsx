import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView } from 'react-native';
import { loadData, Location, Client, Medication, updateClient } from '../src/storage';

function timelineStatusFromTime(timeIso: string) {
  const now = new Date();
  const t = new Date(timeIso);
  if (t < now) return 'previous';
  if ((t.getTime() - now.getTime()) < 60 * 60 * 1000) return 'due';
  return 'upcoming';
}

export default function ClientDetailsScreen({ route, navigation }: any) {
  const { locationId, clientId } = route.params;
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const data = await loadData();
    const loc = data.find((l) => l.id === locationId);
    const c = loc?.clients.find((x) => x.id === clientId) || null;
    setClient(c);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  if (loading) return <View style={styles.container}><Text>Loading...</Text></View>;
  if (!client) return <View style={styles.container}><Text>Client not found</Text></View>;

  const meds = client.medications || [];
  type MedInstance = { id: string; name: string; time: string; totalDose?: string; dosePerTablet?: string; route?: string };
  const instances: MedInstance[] = meds.flatMap(m => (m.scheduledTimes || []).map(t => ({ id: m.id + '::' + t, name: m.name, time: t, totalDose: m.totalDose, dosePerTablet: m.dosePerTablet, route: m.route })));

  const previous = instances.filter(m => timelineStatusFromTime(m.time) === 'previous');
  const due = instances.filter(m => timelineStatusFromTime(m.time) === 'due');
  const upcoming = instances.filter(m => timelineStatusFromTime(m.time) === 'upcoming');

  const MedListItem = ({ item }: { item: MedInstance }) => {
    const time = new Date(item.time);
    const status = timelineStatusFromTime(item.time);
    const statusColors = { due: '#ff6b6b', upcoming: '#4ecdc4', previous: '#999' };
    const statusLabels = { due: '🔔 Due', upcoming: '⏳ Upcoming', previous: '✓ Taken' };

    return (
      <View style={styles.medCard}>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[status] }]}>
          <Text style={styles.statusBadgeText}>{statusLabels[status]}</Text>
        </View>
        <View style={styles.medInfo}>
          <Text style={styles.medName}>{item.name}</Text>
          {item.totalDose && <Text style={styles.medDetail}>{item.totalDose}</Text>}
          {item.dosePerTablet && <Text style={styles.medDetail}>Per tablet: {item.dosePerTablet}</Text>}
          {item.route && <Text style={styles.medDetail}>{item.route}</Text>}
          <Text style={styles.medTime}>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{client.name}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.clientCard}>
        <Text style={styles.label}>📄 Client Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date of Birth:</Text>
          <Text style={styles.detailValue}>{client.dob || 'Not recorded'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Allergies:</Text>
          <Text style={styles.detailValue}>{client.allergies || 'None recorded'}</Text>
        </View>
      </View>

      {meds.length === 0 ? (
        <View style={styles.emptyMeds}>
          <Text style={styles.emptyIcon}>🐊</Text>
          <Text style={styles.emptyTitle}>No medications</Text>
          <Text style={styles.emptyDesc}>Add a medication to get started</Text>
        </View>
      ) : (
        <FlatList
          data={[...due, ...upcoming, ...previous]}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.medList}
          ListHeaderComponent={() => (
            <View style={styles.timelineHeader}>
              <Text style={styles.timelineLabel}>📅 Medication Timeline</Text>
              <View style={styles.statusSummary}>
                {due.length > 0 && <View style={styles.summaryItem}><Text style={styles.summaryDue}>🔔 {due.length}</Text><Text style={styles.summaryLabel}>Due</Text></View>}
                {upcoming.length > 0 && <View style={styles.summaryItem}><Text style={styles.summaryUpcoming}>⏳ {upcoming.length}</Text><Text style={styles.summaryLabel}>Upcoming</Text></View>}
              </View>
            </View>
          )}
          renderItem={({ item }) => <MedListItem item={item} />}
        />
      )}

      {/* Add Med button moved into ClientDetailsPanel header; FAB removed */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backButton: { color: '#2563eb', fontSize: 16, fontWeight: '500' },
  title: { fontSize: 18, fontWeight: '700', color: '#333', flex: 1, textAlign: 'center' },
  clientCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, marginBottom: 8, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#e5e7eb' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 },
  detailRow: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  detailLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 4 },
  detailValue: { fontSize: 14, color: '#333' },
  timelineHeader: { paddingHorizontal: 16, paddingVertical: 12 },
  timelineLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  statusSummary: { flexDirection: 'row', gap: 12 },
  summaryItem: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  summaryDue: { fontSize: 16, fontWeight: '600', color: '#ff6b6b', marginBottom: 2 },
  summaryUpcoming: { fontSize: 16, fontWeight: '600', color: '#4ecdc4', marginBottom: 2 },
  summaryLabel: { fontSize: 11, color: '#999' },
  emptyMeds: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 4 },
  emptyDesc: { fontSize: 14, color: '#999' },
  medList: { paddingHorizontal: 16, paddingBottom: 20 },
  medCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, flexDirection: 'row', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  statusBadge: { paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  statusBadgeText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  medInfo: { flex: 1, padding: 12 },
  medName: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 4 },
  medDetail: { fontSize: 13, color: '#666', marginBottom: 2 },
  medTime: { fontSize: 12, color: '#999', marginTop: 4, fontWeight: '500' },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  fabText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
