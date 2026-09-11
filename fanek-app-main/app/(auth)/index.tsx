import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Home, Wrench, Shield, ChevronLeft, Sparkles, Star } from 'lucide-react-native';
import { BRAND_NAME, BRAND_NAME_EN, BRAND_LOGO } from '@/lib/constants';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth';

export default function RoleSelectionScreen() {
  const theme = useTheme();
  const auth = useAuth();

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
      color: ['#D4AF37', '#AA771C'] as [string, string],
      route: '/(auth)/customer-signup' as const,
    },
    {
      id: 'technician',
      title: 'فني',
      subtitle: 'قدّم خدماتك واكسب الدخل',
      icon: Wrench,
      color: ['#F3CA63', '#B87B10'] as [string, string],
      route: '/(auth)/technician-signup' as const,
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0B0E" />
      
      {/* Header / الهيدر الملكي */}
      <LinearGradient colors={['#16161A', '#0B0B0E']} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logoCircle}>
            <Star color="#D4AF37" size={36} fill="#D4AF37" />
          </View>
          <Text style={styles.appName}>{BRAND_NAME} {BRAND_LOGO}</Text>
          <Text style={styles.appNameEn}>{BRAND_NAME_EN}</Text>
          <Text style={styles.tagline}>خدمات الصيانة المنزلية في ليبيا</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Banner / كرت العروض */}
        <View style={styles.promoBanner}>
          <Sparkles color="#D4AF37" size={20} />
          <Text style={styles.promoText}>
            عروض الانطلاق: خصم 10 د.ل للزبون على أول صيانة • 20 د.ل رصيد مجاني للفني عند التوثيق
          </Text>
        </View>

        <Text style={styles.sectionTitle}>اختر نوع الحساب</Text>

        {/* Roles Cards / كروت الخيارات */}
        {roles.map((role) => {
          const Icon = role.icon;
          return (
            <TouchableOpacity
              key={role.id}
              style={styles.roleCard}
              onPress={() => router.push(role.route)}
              activeOpacity={0.85}
            >
              <LinearGradient colors={role.color} style={styles.roleIcon}>
                <Icon color="#0B0B0E" size={28} />
              </LinearGradient>
              <View style={styles.roleInfo}>
                <Text style={styles.roleTitle}>{role.title}</Text>
                <Text style={styles.roleSubtitle}>{role.subtitle}</Text>
              </View>
              <ChevronLeft color="#D4AF37" size={24} />
            </TouchableOpacity>
          );
        })}

        {/* Admin Login Link / رابط دخول الأدمن */}
        <TouchableOpacity
          style={styles.adminLink}
          onPress={() => router.push('/(auth)/login')}
        >
          <Shield color="#A1A1AA" size={18} />
          <Text style={styles.adminText}>دخول الأدمن / تسجيل الدخول</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0E' },
  header: {
    paddingTop: 60,
    paddingBottom: 36,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    borderBottomWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  headerContent: { alignItems: 'center' },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  appName: {
    fontFamily: 'Cairo-Bold',
    fontSize: 30,
    color: '#D4AF37',
  },
  appNameEn: {
    fontFamily: 'Cairo-Bold',
    fontSize: 15,
    color: '#F3CA63',
    marginTop: 2,
    letterSpacing: 2,
  },
  tagline: {
    fontFamily: 'Cairo-Regular',
    fontSize: 13,
    color: '#A1A1AA',
    marginTop: 6,
  },
  body: { padding: 24 },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161A',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 10,
  },
  promoText: {
    fontFamily: 'Cairo-Regular',
    fontSize: 13,
    color: '#E4E4E7',
    flex: 1,
    lineHeight: 20,
  },
  sectionTitle: {
    fontFamily: 'Cairo-SemiBold',
    fontSize: 17,
    color: '#E4E4E7',
    marginBottom: 16,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  roleIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleInfo: { flex: 1, marginRight: 16 },
  roleTitle: {
    fontFamily: 'Cairo-Bold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  roleSubtitle: {
    fontFamily: 'Cairo-Regular',
    fontSize: 13,
    color: '#A1A1AA',
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
    color: '#A1A1AA',
  },
});