import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { D } from '../theme/tokens';

interface SessionExpiryModalProps {
  visible: boolean;
  countdown: number;
  onStayLoggedIn: () => Promise<void>;
  onLogout: () => void;
}

const SessionExpiryModal: React.FC<SessionExpiryModalProps> = ({
  visible,
  countdown,
  onStayLoggedIn,
  onLogout,
}) => {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Animate modal entrance
  useEffect(() => {
    if (visible) {
      progressAnim.setValue(1);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim, progressAnim]);

  // Animate countdown progress
  useEffect(() => {
    if (visible) {
      Animated.timing(progressAnim, {
        toValue: countdown / 10,
        duration: 900,
        useNativeDriver: false,
      }).start();
    }
  }, [countdown, visible, progressAnim]);

  const handleStayLoggedIn = async () => {
    setIsRefreshing(true);
    try {
      await onStayLoggedIn();
    } finally {
      setIsRefreshing(false);
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const progressColor = progressAnim.interpolate({
    inputRange: [0, 0.3, 0.6, 1],
    outputRange: [D.danger, D.warn, D.accent, D.success],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modal,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="time-outline" size={32} color={D.warn} />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Session Expiring</Text>

          {/* Message */}
          <Text style={styles.message}>
            Your session is about to expire. Would you like to stay logged in?
          </Text>

          {/* Countdown */}
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownText}>
              Logging out in{' '}
              <Text style={styles.countdownNumber}>{countdown}</Text>
              {' '}seconds
            </Text>
            
            {/* Progress bar */}
            <View style={styles.progressBarBg}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressWidth,
                    backgroundColor: progressColor,
                  },
                ]}
              />
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={onLogout}
              disabled={isRefreshing}
            >
              <Ionicons name="log-out-outline" size={18} color={D.textSub} />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.stayButton, isRefreshing && styles.stayButtonDisabled]}
              onPress={handleStayLoggedIn}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.stayButtonText}>Stay Logged In</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: D.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modal: {
    backgroundColor: D.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: D.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: D.warnSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: D.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: D.textSub,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  countdownContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  countdownText: {
    fontSize: 14,
    color: D.textSecondary,
    marginBottom: 12,
  },
  countdownNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: D.warn,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: D.surfaceInput,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  logoutButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: D.surfaceInput,
    borderWidth: 1,
    borderColor: D.border,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: D.textSub,
  },
  stayButton: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: D.accent,
  },
  stayButtonDisabled: {
    opacity: 0.7,
  },
  stayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default SessionExpiryModal;
