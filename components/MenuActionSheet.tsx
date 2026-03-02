import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ActionSheet, { ActionSheetRef } from 'react-native-actions-sheet';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { semanticColors } from '../theme/semanticColors';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItemConfig {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  iconBg?: string;
  iconColor?: string;
  badge?: number;
}

interface MenuSection {
  title?: string;
  items: MenuItemConfig[];
}

interface MenuActionSheetProps {
  actionSheetRef: React.RefObject<ActionSheetRef>;
  onSignOut: () => void;
  unreadNotifications?: number;
}

// ─── MenuItem ─────────────────────────────────────────────────────────────────

const MenuItem: React.FC<MenuItemConfig> = ({
  icon,
  label,
  onPress,
  iconBg = semanticColors.accentLight,
  iconColor = semanticColors.buttonPrimary,
  badge,
}) => (
  <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
    {/* Icon pill */}
    <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={20} color={iconColor} />
      {badge !== undefined && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </View>

    {/* Label */}
    <Text style={styles.itemLabel}>{label}</Text>
  </TouchableOpacity>
);

// ─── MenuSection ──────────────────────────────────────────────────────────────

const Section: React.FC<{ section: MenuSection }> = ({ section }) => (
  <View style={styles.section}>
    {section.title && (
      <Text style={styles.sectionTitle}>{section.title}</Text>
    )}
    <View style={styles.grid}>
      {section.items.map((item) => (
        <MenuItem key={item.label} {...item} />
      ))}
    </View>
  </View>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const MenuActionSheet: React.FC<MenuActionSheetProps> = ({
  actionSheetRef,
  onSignOut,
  unreadNotifications = 0,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const handleNotifications = () => {
    actionSheetRef.current?.hide();
    navigation.navigate('Notifications');
  };

  const handleProfile = () => {
    actionSheetRef.current?.hide();
    navigation.navigate('Profile');
  };

  const handleReferral = () => {
    actionSheetRef.current?.hide();
    navigation.navigate('Referral');
  };

  const handleSettings = () => {
    actionSheetRef.current?.hide();
    navigation.navigate('Settings');
  };

  const sections: MenuSection[] = [
    {
      title: 'Finance',
      items: [
        {
          icon: 'megaphone-outline',
          label: 'Ads',
          iconBg: semanticColors.successLight,
          iconColor: semanticColors.success,
        },
        {
          icon: 'diamond-outline',
          label: 'Points',
          iconBg: semanticColors.warningLight,
          iconColor: semanticColors.warning,
        },
        {
          icon: 'notifications-outline',
          label: 'Notifications',
          iconBg: semanticColors.accentLight,
          iconColor: semanticColors.buttonPrimary,
          badge: unreadNotifications,
          onPress: handleNotifications,
        },
        {
          icon: 'person-outline',
          label: 'Profile',
          iconBg: 'rgba(99,102,241,0.12)',
          iconColor: semanticColors.buttonSecondary,
          onPress: handleProfile,
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          icon: 'settings-outline',
          label: 'Settings',
          iconBg: 'rgba(107,114,128,0.12)',
          iconColor: semanticColors.badgeNeutral,
          onPress: handleSettings,
        },
        {
          icon: 'help-circle-outline',
          label: 'Support',
          iconBg: semanticColors.infoLight,
          iconColor: semanticColors.info,
        },
        {
          icon: 'gift-outline',
          label: 'Referral',
          iconBg: 'rgba(236,72,153,0.12)',
          iconColor: semanticColors.badgePink,
          onPress: handleReferral,
        },
        {
          icon: 'document-text-outline',
          label: 'History',
          iconBg: semanticColors.accentLight,
          iconColor: semanticColors.buttonPrimary,
        },
      ],
    },
  ];

  return (
    <ActionSheet
      ref={actionSheetRef}
      gestureEnabled
      containerStyle={styles.sheet}
      indicatorStyle={styles.indicator}
    >
      <View style={styles.container}>
        {/* Handle + top label */}
        <Text style={styles.sheetHeading}>Menu</Text>

        {/* Sections */}
        {sections.map((section, i) => (
          <Section key={i} section={section} />
        ))}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOut}
          onPress={onSignOut}
          activeOpacity={0.75}
        >
          <View style={styles.signOutIconWrap}>
            <Ionicons name="log-out-outline" size={20} color={semanticColors.danger} />
          </View>
          <Text style={styles.signOutLabel}>Sign Out</Text>
          <Ionicons
            name="chevron-forward-outline"
            size={16}
            color={semanticColors.dangerLight}
            style={{ marginLeft: 'auto' }}
          />
        </TouchableOpacity>
      </View>
    </ActionSheet>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: semanticColors.containerBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  indicator: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 40,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  sheetHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: semanticColors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 20,
    marginTop: 4,
  },

  // ── Section ──
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: semanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginLeft: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  // ── Item ──
  item: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  itemLabel: {
    marginTop: 7,
    fontSize: 11,
    fontWeight: '500',
    color: semanticColors.textDescription,
    textAlign: 'center',
  },

  // ── Badge ──
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: semanticColors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: semanticColors.textInverse,
    fontSize: 9,
    fontWeight: '700',
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: semanticColors.divider,
    marginVertical: 16,
  },

  // ── Sign Out ──
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  signOutIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: semanticColors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignContent: 'center',
  },
  signOutLabel: {
    fontSize: 15,
    fontWeight: '600',
    alignItems: 'center',
    color: semanticColors.danger,
  },
});

export default MenuActionSheet;