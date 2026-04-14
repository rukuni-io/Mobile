import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { D } from '../theme/tokens';

type Variant = 'primary' | 'success' | 'ghost' | 'danger';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const gradients: Record<string, readonly [string, string]> = {
  primary: D.accentGrad,          // #2a52a0 → #CADCFC
  success: D.successGrad,         // #00c896 → #008f6b
  ghost:   ['transparent', 'transparent'],
  danger:  ['#ff5c7c', '#c0183a'],
};

export default function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  textStyle,
  fullWidth = true,
}: PrimaryButtonProps) {
  const isGhost = variant === 'ghost';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
      style={[fullWidth && { width: '100%' }, style]}
    >
      <LinearGradient
        colors={gradients[variant] as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.btn,
          isGhost && styles.btnGhost,
          (disabled || loading) && styles.btnDisabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isGhost ? D.accent : D.primary} size="small" />
        ) : (
          <Text
            style={[
              styles.label,
              isGhost && styles.labelGhost,
              textStyle,
            ]}
          >
            {label}
          </Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: D.radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  btnGhost: {
    borderWidth: 1.5,
    borderColor: D.borderAccent,  // rgba(202,220,252,0.45)
  },
  btnDisabled: {
    opacity: 0.5,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  labelGhost: {
    color: D.accent,              // #CADCFC
  },
});
