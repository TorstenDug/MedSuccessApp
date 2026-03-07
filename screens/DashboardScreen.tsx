import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { COLORS } from '../src/constants';

export default function DashboardScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Overview and Analytics</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardIcon}>📊</Text>
          <Text style={styles.cardTitle}>Overview</Text>
          <Text style={styles.cardText}>Coming soon: Dashboard analytics and reports</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardIcon}>⏰</Text>
          <Text style={styles.cardTitle}>Medication Alerts</Text>
          <Text style={styles.cardText}>Real-time notification system for due medications</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardIcon}>📈</Text>
          <Text style={styles.cardTitle}>Reports</Text>
          <Text style={styles.cardText}>Generate and view medication compliance reports</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray200 },
  title: { fontSize: 32, fontWeight: '700', color: COLORS.primary, marginBottom: 8 },
  subtitle: { fontSize: 16, color: COLORS.textSecondary },
  content: { paddingHorizontal: 16, paddingVertical: 24 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 24, marginBottom: 16, alignItems: 'center', shadowColor: COLORS.shadow, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  cardIcon: { fontSize: 48, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  cardText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
});
