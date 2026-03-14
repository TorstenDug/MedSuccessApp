import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  navigation: any;
};

export default function HelpCenterScreen({ navigation }: Props) {
  const quickStart = [
    { title: 'Create your first location', text: 'Add one location for each service site or unit so records stay organized and easy to find.' },
    { title: 'Add client profiles', text: 'Enter key client details, allergies, and contact information before adding medications.' },
    { title: 'Set medication schedules', text: 'Choose long term, short term, or PRN and confirm dose/unit details before saving.' },
    { title: 'Use timeline during rounds', text: 'Record given and not given events in real time to reduce missed documentation.' },
    { title: 'Check history every handover', text: 'Review what changed, what was missed, and what needs follow-up on the next shift.' },
  ];

  const timelineStatuses = [
    'Given: administration recorded successfully for that scheduled event.',
    'Due: event is ready for action now.',
    'Overdue: event has passed the expected window and needs urgent review.',
    'Pending or Upcoming: event is scheduled for later.',
    'Not given or Missed: not administered, with reason recorded where possible.',
  ];

  const troubleshooting = [
    { issue: 'A medication does not appear in timeline', fix: 'Check medication start date, end date, schedule type, and selected times/frequency.' },
    { issue: 'Cannot save medication', fix: 'Review required fields in the validation message. Notes are optional; key clinical fields are required.' },
    { issue: 'PRN limits feel unclear', fix: 'Use the PRN help icon (`?`). Enter values exactly from prescription wording when possible.' },
    { issue: 'Stock actions look incorrect', fix: 'Open stock management and confirm each adjustment reason and quantity.' },
    { issue: 'Export does not match expectation', fix: 'Confirm the selected export type and date range, then refresh and export again.' },
  ];

  const bestPractices = [
    'Record administrations at the time they happen, not at end-of-shift.',
    'Use clear not-given reasons so the next shift can act safely.',
    'Review overdue items early in each shift.',
    'Audit stock levels daily for critical medications.',
    'Run regular exports for manager reviews and quality assurance.',
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
        <TouchableOpacity onPress={() => navigation.navigate('LocationClients')} style={styles.getStartedButton}>
          <Text style={styles.getStartedText}>Get started</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>How to use MedSuccess</Text>
          <Text style={styles.heroText}>Use this guide as your full reference for setup, daily workflow, safety checks, and reporting.</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Quick start checklist</Text>
          {quickStart.map((step, idx) => (
            <View key={step.title} style={styles.stepRow}>
              <Text style={styles.stepBadge}>{idx + 1}</Text>
              <View style={styles.stepBody}>
                <Text style={styles.stepHeading}>{step.title}</Text>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Medication setup guide</Text>
          <Text style={styles.paragraph}><Text style={styles.strong}>Long term course:</Text> use for ongoing medications. End date is not required unless clinically needed.</Text>
          <Text style={styles.paragraph}><Text style={styles.strong}>Short term course:</Text> use when treatment is time-limited. Always set an end date.</Text>
          <Text style={styles.paragraph}><Text style={styles.strong}>PRN:</Text> use for "when required" medicines. Enter safety limits clearly:</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>Example instruction:</Text>
            <Text style={styles.infoText}>Take one to two tablets every four to six hours when required. Maximum of 8 tablets per day.</Text>
            <Text style={styles.infoText}>Enter as: minimum time between doses = 4 hours, maximum dose per administration = 2, maximum dose in 24 hours = 8.</Text>
          </View>
          <Text style={styles.paragraph}>If one medicine contains more than one active ingredient or strength, tick the multiple-dose option and enter both dose values (and units if different).</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Daily workflow for teams</Text>
          <Text style={styles.paragraph}>1. Open timeline at shift start and identify due or overdue items first.</Text>
          <Text style={styles.paragraph}>2. Record each administration during rounds, including who administered and when.</Text>
          <Text style={styles.paragraph}>3. If not given, record the correct reason so follow-up is clear for the next shift.</Text>
          <Text style={styles.paragraph}>4. Review history before handover and confirm unresolved events.</Text>
          <Text style={styles.paragraph}>5. Update stock changes immediately after receiving, using, or disposing of medication.</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Timeline status guide</Text>
          {timelineStatuses.map((line) => (
            <Text key={line} style={styles.bulletText}>- {line}</Text>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>History, corrections, and accountability</Text>
          <Text style={styles.paragraph}>Use history to review all administration and stock-related events in sequence.</Text>
          <Text style={styles.paragraph}>If an entry was recorded in error, use correction actions promptly and include clear notes.</Text>
          <Text style={styles.paragraph}>Accurate notes improve safety, manager reviews, and audit confidence.</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Reporting and exports</Text>
          <Text style={styles.paragraph}>Use complete history export when a full record is required for governance or review.</Text>
          <Text style={styles.paragraph}>Use short-range summary exports for handovers, incident follow-up, and quick oversight.</Text>
          <Text style={styles.paragraph}>Before exporting, refresh client data and confirm selected period/report type.</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Stock management: detailed guide</Text>
          <Text style={styles.paragraph}><Text style={styles.strong}>Purpose:</Text> Stock management keeps medication quantities accurate so teams can deliver safely and avoid preventable missed doses.</Text>
          <Text style={styles.paragraph}><Text style={styles.strong}>When to update stock:</Text></Text>
          <Text style={styles.bulletText}>- When medication is received from pharmacy.</Text>
          <Text style={styles.bulletText}>- After each administration where stock should reduce.</Text>
          <Text style={styles.bulletText}>- When medication is disposed, returned, wasted, or corrected.</Text>
          <Text style={styles.bulletText}>- During end-of-shift or daily reconciliation checks.</Text>

          <Text style={styles.paragraph}><Text style={styles.strong}>How to use it safely:</Text></Text>
          <Text style={styles.paragraph}>1. Open the client, then enter Stock Management from the client actions.</Text>
          <Text style={styles.paragraph}>2. Confirm the medication name and current quantity before applying any change.</Text>
          <Text style={styles.paragraph}>3. Record the quantity movement and include a clear reason (received, administration use, disposal, correction, return).</Text>
          <Text style={styles.paragraph}>4. Save immediately so timeline and history stay aligned for other staff.</Text>
          <Text style={styles.paragraph}>5. Recheck low or zero stock items and escalate before next administration window.</Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>Good documentation example</Text>
            <Text style={styles.infoText}>"Stock adjusted -10 units after morning round for scheduled administrations."</Text>
            <Text style={styles.infoText}>"Stock adjusted +56 units received from pharmacy delivery."</Text>
          </View>

          <Text style={styles.paragraph}><Text style={styles.strong}>Rules to follow:</Text></Text>
          <Text style={styles.bulletText}>- Do not delete medications with remaining stock. Record disposal/return first.</Text>
          <Text style={styles.bulletText}>- Keep reasons specific enough that another shift can understand the change without asking.</Text>
          <Text style={styles.bulletText}>- If stock seems wrong, correct it with a note instead of silently overwriting values.</Text>
          <Text style={styles.bulletText}>- Prioritize rapid follow-up for out-of-stock medications shown in timeline.</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Troubleshooting</Text>
          {troubleshooting.map((item) => (
            <View key={item.issue} style={styles.troubleRow}>
              <Text style={styles.troubleIssue}>Problem: {item.issue}</Text>
              <Text style={styles.troubleFix}>What to check: {item.fix}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Best practices for safe use</Text>
          {bestPractices.map((tip) => (
            <Text key={tip} style={styles.tipText}>- {tip}</Text>
          ))}
        </View>

        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>Need additional support?</Text>
          <Text style={styles.contactText}>If your team needs onboarding support, policy alignment, or workflow review, collect example records and contact your internal MedSuccess lead or support channel.</Text>
          <TouchableOpacity onPress={() => navigation.navigate('LocationClients')} style={styles.contactButton}>
            <Text style={styles.contactButtonText}>Return to MedSuccess</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f8ff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dbe7f5',
    backgroundColor: '#ffffff',
  },
  backButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  backButtonText: {
    color: '#1f2937',
    fontWeight: '700',
    fontSize: 12,
  },
  headerTitle: {
    color: '#0b2d57',
    fontSize: 18,
    fontWeight: '800',
  },
  getStartedButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
  },
  getStartedText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 12,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: '#0b2d57',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  heroTitle: {
    color: '#f1f7ff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 5,
  },
  heroText: {
    color: '#cde2fb',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe7f5',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#0d3768',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  paragraph: {
    color: '#506a83',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  strong: {
    color: '#0d3768',
    fontWeight: '800',
  },
  infoBox: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  infoText: {
    color: '#1e3a8a',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2563eb',
    color: '#ffffff',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '800',
    marginRight: 9,
    paddingTop: 1,
  },
  stepBody: { flex: 1 },
  stepHeading: {
    color: '#0f3d70',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  stepText: {
    color: '#506a83',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  bulletText: {
    color: '#4f6780',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  troubleRow: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e6eef8',
  },
  troubleIssue: {
    color: '#0f3d70',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
  },
  troubleFix: {
    color: '#506a83',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  tipText: {
    color: '#526c87',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  contactCard: {
    backgroundColor: '#082444',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f4a7a',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 6,
  },
  contactTitle: {
    color: '#e6f1ff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  contactText: {
    color: '#c8dcf5',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  contactButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#1ed3a0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  contactButtonText: {
    color: '#073f33',
    fontSize: 12,
    fontWeight: '800',
  },
});
