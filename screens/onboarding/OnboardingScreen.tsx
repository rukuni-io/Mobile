import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ListRenderItemInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { D } from '../../theme/tokens';
import PrimaryButton from '../../components/PrimaryButton';
import StepDots from '../../components/StepDots';

type RootStackParamList = {
  Onboarding: undefined;
  Signin: undefined;
  Signup: undefined;
};

interface Slide {
  key: string;
  emoji: string;
  bgColors: string[];
  title: string;
  subtitle: string;
  bullets: string[];
}

const { width } = Dimensions.get('window');

const slides: Slide[] = [
  {
    key: 'save',
    emoji: '👥',
    bgColors: ['#1a1f3e', '#252a52'],
    title: 'Save Together',
    subtitle: 'Create or join savings groups with friends, family, or colleagues.',
    bullets: ['Set a shared goal', 'Contribute regularly', 'Watch your savings grow'],
  },
  {
    key: 'track',
    emoji: '📊',
    bgColors: ['#0f2a27', '#1a3e3a'],
    title: 'Track Every Naira',
    subtitle: 'Real-time dashboards keep everyone on the same page.',
    bullets: ['Live contribution updates', 'Progress charts', 'Smart notifications'],
  },
  {
    key: 'grow',
    emoji: '🚀',
    bgColors: ['#1e1630', '#2a2050'],
    title: 'Reach Your Goals',
    subtitle: 'Celebrate milestones together and unlock new saving levels.',
    bullets: ['Milestone celebrations', 'Auto payouts', 'Repeat & level up'],
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [currentIdx, setCurrentIdx] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);

  const goNext = () => {
    if (currentIdx < slides.length - 1) {
      const next = currentIdx + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIdx(next);
    } else {
      navigation.navigate('Signup');
    }
  };

  const goBack = () => {
    if (currentIdx > 0) {
      const prev = currentIdx - 1;
      flatListRef.current?.scrollToIndex({ index: prev, animated: true });
      setCurrentIdx(prev);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIdx(viewableItems[0].index ?? 0);
    }
  }).current;

  const renderSlide = ({ item }: ListRenderItemInfo<Slide>) => (
    <View style={styles.slide}>
      {/* Illustration card */}
      <LinearGradient colors={item.bgColors as [string, string]} style={styles.illustration}>
        <View style={styles.emojiCircle}>
          <Text style={styles.emojiLarge}>{item.emoji}</Text>
        </View>
        {/* Decorative blobs */}
        <View style={styles.blob1} />
        <View style={styles.blob2} />
      </LinearGradient>

      {/* Text content */}
      <Text style={styles.slideTitle}>{item.title}</Text>
      <Text style={styles.slideSubtitle}>{item.subtitle}</Text>

      <View style={styles.bullets}>
        {item.bullets.map(b => (
          <View key={b} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{b}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const isLast = currentIdx === slides.length - 1;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={D.bg} />

      {/* Skip */}
      <TouchableOpacity
        style={styles.skipBtn}
        onPress={() => navigation.navigate('Signin')}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={item => item.key}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        scrollEnabled
        style={styles.flatList}
      />

      {/* Footer */}
      <View style={styles.footer}>
        <StepDots total={slides.length} current={currentIdx} />

        <View style={styles.navRow}>
          {currentIdx > 0 ? (
            <TouchableOpacity onPress={goBack} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}

          <PrimaryButton
            label={isLast ? "Let's Go 🎉" : 'Next'}
            onPress={goNext}
            fullWidth={false}
            style={{ paddingHorizontal: 0, minWidth: 130 }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: D.bg,
  },
  skipBtn: {
    position: 'absolute',
    top: 52,
    right: 24,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: D.surfaceCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: D.border,
  },
  skipText: {
    color: D.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width,
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 100,
    alignItems: 'center',
  },
  illustration: {
    width: width * 0.72,
    height: width * 0.72,
    borderRadius: width * 0.36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: D.border,
    overflow: 'hidden',
  },
  emojiCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiLarge: {
    fontSize: 52,
  },
  blob1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(124,140,255,0.1)',
    top: 20,
    right: 20,
  },
  blob2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,200,150,0.08)',
    bottom: 30,
    left: 20,
  },
  slideTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: D.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  slideSubtitle: {
    fontSize: 15,
    color: D.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  bullets: {
    alignSelf: 'stretch',
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: D.accent,
  },
  bulletText: {
    color: D.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 50,
    gap: 20,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    minWidth: 80,
    paddingVertical: 10,
  },
  backBtnText: {
    color: D.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
