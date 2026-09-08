import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Home, Wrench, Shield, ChevronLeft, Sparkles, Star } from 'lucide-react-native';
import { BRAND_NAME, BRAND_NAME_EN, BRAND_LOGO } from '@/lib/constants';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth'; // تم تصحيح المسار من auth-context إلى auth

export default function RoleSelectionScreen() {
  const theme = useTheme();
  const auth = useAuth();

  // قراءة آمنة مع قيم افتراضية لتفادي الانهيار
  const colors = theme?.colors || {};
  const session = auth?.session;
  const loading = auth?.loading;

  useEffect(() => {
    if (!loading && session) {
      router.replace('/(tabs)');
    }
  }, [session, loading]);

  const roles = [
    {
      id: 'customer',
      title: 'زبون',
      subtitle: 'اطلب خدمات الصيانة المنزلية',
      icon: Home,
      color: ['#2563eb', '#1d4ed8'] as [string, string],
      route: '/(auth)/customer-signup' as const,
    },
    {
      id: 'technician',
      title: 'فني',
      subtitle: 'قدّم خدماتك واكسب الدخل',
      icon: Wrench,
      color: ['#16a34a', '#15803d'] as [string, string],
      route: '/(auth)/technician-signup' as const,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg || '#ffffff' }]}>
      <LinearGradient colors={['#2563eb', '#1d4ed8']} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logoCircle}>
            <Star color="#fff" size={36} fill="#fff" />
          </View>
          <Text style={styles.appName}>{BRAND_NAME} {BRAND_LOGO}</Text>
          <Text style={styles.appNameEn}>{BRAND_NAME_EN}</Text>
          <Text style={styles.tagline}>خدمات الصيانة المنزلية في ليبيا</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.promoBanner, { backgroundColor: colors.promoBg || '#f3f4f6', borderColor: colors.promoBorder || '#e5e7eb' }]}>
          <Sparkles color={colors.accent || '#2563eb'} size={20} />
          <Text style={[styles.promoText, { color: colors.promoText || '#1f2937' }]}>
            عروض الانطلاق: خصم 10 د.ل للزبون على أول صيانة • 20 د.ل رصيد مجاني للفني عند التوثيق
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text || '#111827' }]}>اختر نوع الحساب</Text>

        {roles.map((role) => {
          const Icon = role.icon;
          return (
            <TouchableOpacity
              key={role.id}
              style={[styles.roleCard, { backgroundColor: colors.cardBg || '#ffffff', borderColor: colors.border || '#e5e7eb' }]}
              onPress={() => router.push(role.route)}
              activeOpacity={0.85}
            >
              <LinearGradient colors={role.color} style={styles.roleIcon}>
                <Icon color="#fff" size={28} />
              </LinearGradient>
              <View style={styles.roleInfo}>
                <Text style={[styles.roleTitle, { color: colors.text || '#111827' }]}>{role.title}</Text>
                <Text style={[styles.roleSubtitle, { color: colors.subtext || '#6b7280' }]}>{role.subtitle}</Text>
              </View>
              <ChevronLeft color={colors.subtext || '#6b7280'} size={24} />
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={styles.adminLink}
          onPress={() => router.push('/(auth)/login')}
        >
          <Shield color={colors.subtext || '#6b7280'} size={18} />
          <Text style={[styles.adminText, { color: colors.subtext || '#6b7280' }]}>دخول الأدمن / تسجيل الدخول</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: { alignItems: 'center' },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appName: {
    fontFamily: 'Cairo-Bold',
    fontSize: 32,
    color: '#fff',
  },
  appNameEn: {
    fontFamily: 'Cairo-Bold',
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    letterSpacing: 2,
  },
  tagline: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
  },
  body: { padding: 24 },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 10,
  },
  promoText: {
    fontFamily: 'Cairo-Regular',
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
  },
  sectionTitle: {
    fontFamily: 'Cairo-SemiBold',
    fontSize: 18,
    marginBottom: 16,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  roleIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleInfo: { flex: 1, marginRight: 16 },
  roleTitle: {
    fontFamily: 'Cairo-Bold',
    fontSize: 18,
  },
  roleSubtitle: {
    fontFamily: 'Cairo-Regular',
    fontSize: 13,
    marginTop: 2,
  },
  adminLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
  },
  adminText: {
    fontFamily: 'Cairo-Medium',
    fontSize: 14,
  },
});