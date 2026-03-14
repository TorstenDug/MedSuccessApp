import React from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  navigation: any;
};

export default function MarketingLandingScreen({ navigation }: Props) {
  const goToApp = () => {
    navigation.navigate('LocationClients');
  };

  const goToHelp = () => {
    navigation.navigate('HelpCenter');
  };

  const features = [
    {
      title: 'More confident teams',
      text: 'Give every shift a single, reliable view so staff make safer decisions with less second-guessing.',
    },
    {
      title: 'Less admin pressure',
      text: 'Reduce paperwork stress and save time on every round with streamlined records and cleaner handovers.',
    },
    {
      title: 'Fewer preventable issues',
      text: 'Stay ahead of medication gaps, missed follow-ups, and stock surprises before they become incidents.',
    },
    {
      title: 'Clear accountability',
      text: 'Show what happened, when, and by whom with records that stand up in reviews and compliance checks.',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundLayerOne} />
      <View style={styles.backgroundLayerTwo} />
      <View style={styles.backgroundLayerThree} />

      <View style={styles.topBar}>
        <Image source={require('../assets/medsuccess-logo.png')} style={styles.logo} />
        <View style={styles.topLinksRow}>
          <TouchableOpacity onPress={goToHelp} style={styles.helpTopLink}>
            <Text style={styles.helpTopLinkText}>Help</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToApp} style={styles.getStartedLink}>
            <Text style={styles.getStartedText}>Get started</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Medication Management, Without the Chaos</Text>
          <Text style={styles.heroTitle}>Safer care. Calmer shifts. Better outcomes.</Text>
          <Text style={styles.heroBody}>
            MedSuccess helps teams reduce stress, improve consistency, and protect clients by making medication
            delivery clearer and easier to manage.
          </Text>

          <View style={styles.heroPillsRow}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>Designed for high-trust care</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>Built to reduce team stress</Text>
            </View>
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity onPress={goToApp} style={styles.primaryCta}>
              <Text style={styles.primaryCtaText}>Start with MedSuccess</Text>
            </TouchableOpacity>
            <View style={styles.secondaryMeta}>
              <Text style={styles.secondaryMetaText}>Built for care homes, clinics, and supported living teams that value safety and clarity.</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>Safer</Text>
            <Text style={styles.statLabel}>More consistent medication rounds across every shift</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>Faster</Text>
            <Text style={styles.statLabel}>Less time spent documenting and chasing missing details</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>Clearer</Text>
            <Text style={styles.statLabel}>Stronger handovers and better visibility for leaders</Text>
          </View>
        </View>

        <View style={styles.sectionHeaderBlock}>
          <Text style={styles.sectionEyebrow}>Why teams choose MedSuccess</Text>
          <Text style={styles.sectionTitle}>Turn medication rounds into a safer, smoother part of the day</Text>
        </View>

        <View style={styles.featureGrid}>
          {features.map((feature, idx) => (
            <View key={feature.title} style={styles.featureCard}>
              <View style={styles.featureTag}>
                <Text style={styles.featureTagText}>{`0${idx + 1}`}</Text>
              </View>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.processPanel}>
          <Text style={styles.processTitle}>What changes for your team</Text>
          <View style={styles.processStep}>
            <Text style={styles.processStepNumber}>1</Text>
            <Text style={styles.processStepText}>Everyone starts from the same clear picture, reducing missed communication.</Text>
          </View>
          <View style={styles.processStep}>
            <Text style={styles.processStepNumber}>2</Text>
            <Text style={styles.processStepText}>Medication rounds feel calmer and more predictable, even on busy shifts.</Text>
          </View>
          <View style={styles.processStep}>
            <Text style={styles.processStepNumber}>3</Text>
            <Text style={styles.processStepText}>Managers and auditors get confidence from clear, trustworthy records.</Text>
          </View>
        </View>

        <View style={styles.quoteCard}>
          <Text style={styles.quoteText}>
            "Before MedSuccess, handover took too long and records were hard to follow. Now every shift sees the same
            timeline and we can export proof instantly."
          </Text>
          <Text style={styles.quoteAuthor}>Senior Care Coordinator</Text>
        </View>

        <View style={styles.faqPanel}>
          <Text style={styles.faqTitle}>Quick answers</Text>
          <View style={styles.faqItem}>
            <Text style={styles.faqQ}>Will this help with team consistency?</Text>
            <Text style={styles.faqA}>Yes. MedSuccess gives every staff member the same structure and visibility, reducing variation between shifts.</Text>
          </View>
          <View style={styles.faqItem}>
            <Text style={styles.faqQ}>Can this reduce handover stress?</Text>
            <Text style={styles.faqA}>Yes. Clear records make handovers quicker, with fewer gaps and fewer follow-up questions.</Text>
          </View>
          <View style={styles.faqItem}>
            <Text style={styles.faqQ}>Is it useful for oversight and compliance?</Text>
            <Text style={styles.faqA}>Yes. Managers can quickly review clear records that support accountability and quality assurance.</Text>
          </View>
        </View>

        <View style={styles.helpLinkCard}>
          <Text style={styles.helpLinkTitle}>Need help getting started?</Text>
          <Text style={styles.helpLinkText}>Open the Help Center for step-by-step guidance on setup, medications, timeline use, and reports.</Text>
          <TouchableOpacity onPress={goToHelp} style={styles.helpLinkButton}>
            <Text style={styles.helpLinkButtonText}>Open Help Center</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.finalCtaCard}>
          <Text style={styles.finalCtaTitle}>Ready for safer rounds and calmer handovers?</Text>
          <Text style={styles.finalCtaBody}>Start with MedSuccess and give your team a clearer way to deliver care.</Text>
          <TouchableOpacity onPress={goToApp} style={styles.finalCtaButton}>
            <Text style={styles.finalCtaButtonText}>Get started now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f7fb',
  },
  backgroundLayerOne: {
    position: 'absolute',
    top: -120,
    right: -60,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#d9edff',
  },
  backgroundLayerTwo: {
    position: 'absolute',
    bottom: -140,
    left: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#d6f5f0',
  },
  backgroundLayerThree: {
    position: 'absolute',
    top: 280,
    right: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 6,
  },
  logo: {
    height: 42,
    width: 220,
    resizeMode: 'contain',
  },
  topLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helpTopLink: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(11, 45, 87, 0.07)',
  },
  helpTopLinkText: {
    color: '#0b2d57',
    fontSize: 13,
    fontWeight: '700',
  },
  getStartedLink: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(7, 36, 73, 0.08)',
  },
  getStartedText: {
    color: '#072449',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 36,
  },
  heroCard: {
    marginTop: 14,
    backgroundColor: '#072449',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 20,
    shadowColor: '#0b2445',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  heroEyebrow: {
    color: '#8cd6ff',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '800',
    fontFamily: 'Georgia',
    marginBottom: 10,
  },
  heroBody: {
    color: '#d7e9ff',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  heroPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  heroPill: {
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(153, 201, 255, 0.55)',
    backgroundColor: 'rgba(153, 201, 255, 0.12)',
  },
  heroPillText: {
    color: '#d8ebff',
    fontSize: 11,
    fontWeight: '700',
  },
  heroActions: {
    marginTop: 2,
  },
  primaryCta: {
    backgroundColor: '#1ed3a0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryCtaText: {
    color: '#073f33',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryMeta: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(201, 221, 248, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryMetaText: {
    color: '#cfe4ff',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  statsRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '31.5%',
    minWidth: 100,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe7f5',
    paddingHorizontal: 10,
    paddingVertical: 11,
    shadowColor: '#0b2e56',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statNumber: {
    color: '#0d3b73',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    color: '#4b6077',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  sectionHeaderBlock: {
    marginTop: 18,
    marginBottom: 8,
  },
  sectionEyebrow: {
    color: '#2c5689',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  sectionTitle: {
    color: '#0b2d57',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
    fontFamily: 'Georgia',
  },
  featureGrid: {
    marginTop: 10,
  },
  featureCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dbe7f5',
    shadowColor: '#2f4f72',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureTag: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
    marginBottom: 8,
  },
  featureTagText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '800',
  },
  featureTitle: {
    color: '#0d2c54',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  featureText: {
    color: '#435871',
    fontSize: 13,
    lineHeight: 19,
  },
  processPanel: {
    marginTop: 8,
    backgroundColor: '#f8fbff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e3f5',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  processTitle: {
    color: '#0f335f',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  processStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  processStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0f4c81',
    color: '#ffffff',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '800',
    marginRight: 10,
    paddingTop: 2,
  },
  processStepText: {
    flex: 1,
    color: '#39516e',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  quoteCard: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#082444',
    borderWidth: 1,
    borderColor: '#204b7a',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  quoteText: {
    color: '#deecff',
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  quoteAuthor: {
    color: '#8fd0ff',
    fontSize: 12,
    fontWeight: '700',
  },
  faqPanel: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe7f5',
  },
  faqTitle: {
    color: '#0c325e',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  faqItem: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e7eef8',
  },
  faqQ: {
    color: '#143f70',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 3,
  },
  faqA: {
    color: '#4f6278',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  helpLinkCard: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#eef7ff',
    borderWidth: 1,
    borderColor: '#cfe2f6',
  },
  helpLinkTitle: {
    color: '#0b3c6f',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  helpLinkText: {
    color: '#48627d',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginBottom: 10,
  },
  helpLinkButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  helpLinkButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  finalCtaCard: {
    marginTop: 12,
    backgroundColor: '#0a7f66',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 6,
  },
  finalCtaTitle: {
    color: '#e9fff9',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    marginBottom: 6,
    fontFamily: 'Georgia',
  },
  finalCtaBody: {
    color: '#cbfff2',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  finalCtaButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  finalCtaButtonText: {
    color: '#086451',
    fontSize: 14,
    fontWeight: '800',
  },
});
