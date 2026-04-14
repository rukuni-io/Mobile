import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Animated,
  StyleSheet,
  TouchableWithoutFeedback,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { D } from '../theme/tokens';

interface FloatingLabelInputProps extends Omit<TextInputProps, 'onChangeText' | 'value'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  hint?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  containerStyle?: ViewStyle;
  secureToggle?: boolean;
}

export default function FloatingLabelInput({
  label,
  value,
  onChangeText,
  error,
  hint,
  iconName,
  containerStyle,
  secureToggle = false,
  secureTextEntry,
  ...rest
}: FloatingLabelInputProps) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const [focused, setFocused] = useState(false);
  const [secure, setSecure] = useState(secureTextEntry ?? false);
  const inputRef = useRef<TextInput>(null);

  const floatUp = () => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: false, speed: 20 }).start();
  };
  const floatDown = () => {
    if (!value) {
      Animated.spring(anim, { toValue: 0, useNativeDriver: false, speed: 20 }).start();
    }
  };

  // Float label up whenever value is set externally (e.g. autofill)
  useEffect(() => {
    if (value) {
      floatUp();
    } else if (!focused) {
      Animated.spring(anim, { toValue: 0, useNativeDriver: false, speed: 20 }).start();
    }
  }, [value]);

  const labelTop = anim.interpolate({ inputRange: [0, 1], outputRange: [16, -8] });
  const labelSize = anim.interpolate({ inputRange: [0, 1], outputRange: [15, 12] });
  const labelColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [D.textPlaceholder, focused ? D.accent : D.textSecondary],
  });

  const borderColor = error ? D.danger : focused ? D.borderFocus : D.border;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <TouchableWithoutFeedback onPress={() => inputRef.current?.focus()}>
        <View style={[styles.container, { borderColor }]}>
          {/* Floating label */}
          <Animated.Text
            style={[
              styles.label,
              { top: labelTop, fontSize: labelSize, color: labelColor },
              iconName && { left: 44 },
            ]}
          >
            {label}
          </Animated.Text>

          {/* Left icon */}
          {iconName && (
            <Ionicons
              name={iconName}
              size={18}
              color={focused ? D.accent : D.textMuted}
              style={styles.leftIcon}
            />
          )}

          {/* Text input */}
          <TextInput
            ref={inputRef}
            style={[styles.input, iconName && { paddingLeft: 40 }]}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => { setFocused(true); floatUp(); }}
            onBlur={() => { setFocused(false); floatDown(); }}
            placeholderTextColor="transparent"
            secureTextEntry={secure}
            autoCorrect={false}
            autoCapitalize="none"
            {...rest}
          />

          {/* Secure toggle */}
          {secureToggle && (
            <TouchableWithoutFeedback onPress={() => setSecure(s => !s)}>
              <Ionicons
                name={secure ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={D.textMuted}
                style={styles.rightIcon}
              />
            </TouchableWithoutFeedback>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Error / hint */}
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  container: {
    backgroundColor: D.surfaceInput,
    borderWidth: 1.5,
    borderRadius: D.radiusSm,
    height: 58,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  label: {
    position: 'absolute',
    left: 14,
    backgroundColor: D.surfaceInput,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  input: {
    color: D.textPrimary,
    fontSize: 15,
    paddingTop: 10,
    paddingBottom: 2,
  },
  leftIcon: {
    position: 'absolute',
    left: 14,
    top: '50%',
    marginTop: -9,
  },
  rightIcon: {
    position: 'absolute',
    right: 14,
    top: '50%',
    marginTop: -10,
  },
  error: {
    color: D.danger,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  hint: {
    color: D.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});
