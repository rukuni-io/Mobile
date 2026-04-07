import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { D } from '../../theme/tokens';
import PrimaryButton from '../../components/PrimaryButton';

type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Signin: undefined;
  Signup: undefined;
};

const { width, height } = Dimensions.get('window');

const features = [
  { icon: '👥', label: 'Save Together' },
  { icon: '📊', label: 'Track Progress' },
  { icon: '🚀', label: 'Reach Goals' },
];

export default function SplashScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const heroScale = useRef(new Animated.Value(0.7)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const pillsY = useRef(new Animated.Value(40)).current;
  const pillsOpacity = useRef(new Animated.Value(0)).current;
  const btnsY = useRef(new Animated.Value(60)).current;
  const btnsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(heroScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
        Animated.timing(heroOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(pillsY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 9 }),
        Animated.timing(pillsOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(btnsY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 9 }),
        Animated.timing(btnsOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={D.bg} />

      {/* Background decoration circles */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      {/* Hero illustration area */}
      <Animated.View
        style={[
          styles.heroArea,
          { transform: [{ scale: heroScale }], opacity: heroOpacity },
        ]}
      >
        <LinearGradient
          colors={['#161616', '#00d68f1a']}
          style={styles.heroGradient}
        >
          <Text style={styles.heroEmoji}>💰</Text>
          <View style={styles.heroOrbits}>
            <View style={[styles.orbit, { top: 10, right: 20 }]}>
              <Text style={styles.orbitEmoji}>👫</Text>
            </View>
            <View style={[styles.orbit, { bottom: 20, left: 10 }]}>
              <Text style={styles.orbitEmoji}>📈</Text>
            </View>
            <View style={[styles.orbit, { top: 20, left: 30 }]}>
              <Text style={styles.orbitEmoji}>🎯</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Title */}
      <Animated.View style={{ opacity: heroOpacity }}>
        <Text style={styles.appName}>{Constants.expoConfig?.extra?.appName}</Text>
        <Text style={styles.tagline}>Save smarter,{'\n'}achieve together.</Text>
      </Animated.View>

      {/* Feature pills */}
      <Animated.View
        style={[
          styles.pillsRow,
          { transform: [{ translateY: pillsY }], opacity: pillsOpacity },
        ]}
      >
        {features.map(f => (
          <View key={f.label} style={styles.pill}>
            <Text style={styles.pillIcon}>{f.icon}</Text>
            <Text style={styles.pillLabel}>{f.label}</Text>
          </View>
        ))}
      </Animated.View>

      {/* CTA Buttons */}
      <Animated.View
        style={[
          styles.btnArea,
          { transform: [{ translateY: btnsY }], opacity: btnsOpacity },
        ]}
      >
        <PrimaryButton
          label="Create Free Account"
          onPress={() => navigation.navigate('Signup')}
        />
        <View style={styles.btnSpacer} />
        <PrimaryButton
          label="I already have an account"
          onPress={() => navigation.navigate('Signin')}
          variant="ghost"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: D.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 48,
    overflow: 'hidden',
  },
  bgCircle1: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: D.accentGlow,
    top: -80,
    right: -80,
  },
  bgCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,214,143,0.06)',
    bottom: 80,
    left: -60,
  },
  heroArea: {
    marginBottom: 32,
  },
  heroGradient: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: D.accentGlow,
  },
  heroEmoji: {
    fontSize: 72,
  },
  heroOrbits: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  orbit: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: D.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: D.border,
  },
  orbitEmoji: {
    fontSize: 18,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: D.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 17,
    color: D.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 32,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 40,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: D.surfaceCard,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: D.border,
  },
  pillIcon: {
    fontSize: 15,
  },
  pillLabel: {
    color: D.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  btnArea: {
    width: '100%',
  },
  btnSpacer: {
    height: 12,
  },
});
