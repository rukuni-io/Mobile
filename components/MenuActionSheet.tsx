import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ActionSheet, { ActionSheetRef } from 'react-native-actions-sheet';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { D } from '../theme/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuActionSheetProps {
  actionSheetRef: React.RefObject<ActionSheetRef>;
  onSignOut: () => void;
  unreadNotifications?: number;
  userName?: string;
}

// ─── Big Nav Tile ─────────────────────────────────────────────────────────────

const NavTile: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  grad: readonly [string, string];
  badge?: number;
  onPress?: () => void;
}> = ({ icon, label, sublabel, grad, badge, onPress }) => (
  <TouchableOpacity style={styles.navTile} onPress={onPress} activeOpacity={0.8}>
    <LinearGradient colors={grad} style={styles.navTileGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <Ionicons name={icon} size={26} color="#fff" style={{ opacity: 0.95 }} />
      {badge !== undefined && badge > 0 && (
        <View style={styles.tileBadge}>
          <Text style={styles.tileBadgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </LinearGradient>
    <Text style={styles.navTileLabel}>{label}</Text>
    {sublabel ? <Text style={styles.navTileSub}>{sublabel}</Text> : null}
  </TouchableOpacity>
);

// ─── Slim Row Item ─────────────────────────────────────────────────────────────

const RowItem: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  iconColor: string;
  iconBg: string;
  onPress?: () => void;
  chevron?: boolean;
}> = ({ icon, label, iconColor, iconBg, onPress, chevron = true }) => (
  <TouchableOpacity style={styles.rowItem} onPress={onPress} activeOpacity={0.75}>
    <View style={[styles.rowIconWrap, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
    </View>
    <Text style={styles.rowLabel}>{label}</Text>
    {chevron && (
      <Ionicons name="chevron-forward" size={15} color={D.textMuted} style={styles.rowChevron} />
    )}
  </TouchableOpacity>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const MenuActionSheet: React.FC<MenuActionSheetProps> = ({
  actionSheetRef,
  onSignOut,
  unreadNotifications = 0,
  userName,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const go = (screen: string) => {
    actionSheetRef.current?.hide();
    navigation.navigate(screen);
  };

  const initials = userName
    ? userName.trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  return (
    <ActionSheet
      ref={actionSheetRef}
      gestureEnabled
      containerStyle={styles.sheet}
      indicatorStyle={styles.indicator}
    >
      <View style={styles.container}>

        {/* ── Profile pill ── */}
        <View style={styles.profileRow}>
          <LinearGradient colors={['#00d68f', '#6eb5ff']} style={styles.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={1}>{userName ?? 'My Account'}</Text>
            <Text style={styles.profileSub}>View your profile →</Text>
          </View>
          <TouchableOpacity style={styles.profileArrow} onPress={() => go('Profile')} activeOpacity={0.7}>
            <Ionicons name="person-circle-outline" size={22} color={D.accent} />
          </TouchableOpacity>
        </View>

        {/* ── 4 big tiles ── */}
        <View style={styles.tilesRow}>
          <NavTile
            icon="notifications-outline"
            label="Alerts"
            sublabel={unreadNotifications > 0 ? `${unreadNotifications} new` : 'All clear'}
            grad={['#00d68f', '#00bb7a']}
            badge={unreadNotifications}
            onPress={() => go('Notifications')}
          />
          <NavTile
            icon="diamond-outline"
            label="Points"
            sublabel="Earn rewards"
            grad={['#f59e0b', '#d97706']}
            onPress={() => go('EarnPoints')}
          />
          <NavTile
            icon="gift-outline"
            label="Refer"
            sublabel="Invite friends"
            grad={['#ec4899', '#a855f7']}
            onPress={() => go('Referral')}
          />
          <NavTile
            icon="help-circle-outline"
            label="Support"
            sublabel="Get help"
            grad={['#6eb5ff', '#4a9eff']}
            onPress={() => go('Support')}
          />
        </View>

        {/* ── Slim settings row ── */}
        <View style={styles.rowGroup}>
          <RowItem
            icon="settings-outline"
            label="Settings"
            iconBg="rgba(107,114,128,0.15)"
            iconColor="rgba(255,255,255,0.6)"
            onPress={() => go('Settings')}
          />
          <View style={styles.rowDivider} />
          <RowItem
            icon="log-out-outline"
            label="Sign Out"
            iconBg="rgba(239,68,68,0.12)"
            iconColor={D.danger}
            chevron={false}
            onPress={onSignOut}
          />
        </View>

      </View>
    </ActionSheet>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  indicator: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    width: 36,
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 18,
  },

  // ── Profile pill ──
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: D.border,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  profileName: {
    color: D.text,
    fontWeight: '700',
    fontSize: 15,
  },
  profileSub: {
    color: D.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  profileArrow: {
    padding: 4,
  },

  // ── Big tiles ──
  tilesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  navTile: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
  },
  navTileGrad: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTileLabel: {
    color: D.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  navTileSub: {
    color: D.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: -4,
  },
  tileBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: D.danger,
    borderRadius: 8,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#1e1e1e',
  },
  tileBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },

  // ── Slim row ──
  rowGroup: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: D.text,
  },
  rowChevron: {
    marginLeft: 'auto',
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 16,
  },
});

export default MenuActionSheet;
