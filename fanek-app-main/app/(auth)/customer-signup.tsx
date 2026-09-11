import { useState } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Platform, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Phone, MapPin, Check, Star } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { CURRENCY, PROMO_CUSTOMER_DISCOUNT, TERMS_TEXT, BRAND_NAME, BRAND_LOGO } from '@/lib/constants';
import { useTheme } from '@/lib/theme-context';
import * as Location from 'expo-location';
import { getAuthEmailForPhone, isValidLibyaPhone, normalizeLibyaPhone } from '@/lib/phone';

export default function CustomerSignupScreen() {
  const { colors } = useTheme();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getLocation = async () => {
    try {
      if (Platform.OS !== 'web') {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          setError('يجب السماح باستخدام الموقع لإكمال التسجيل');
          return;
        }
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLat(current.coords.latitude);
        setLng(current.coords.longitude);
        setAddress(`${current.coords.latitude.toFixed(4)}, ${current.coords.longitude.toFixed(4)}`);
      } else if (typeof navigator !== 'undefined' && navigator?.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLat(pos.coords.latitude);
            setLng(pos.coords.longitude);
            setAddress(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
          },
          () => setError('تعذر الحصول على الموقع. تأكد من تفعيل GPS'),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        setError('تعذر الوصول إلى خدمة الموقع');
      }
    } catch {
      setError('تعذر الحصول على موقعك الحالي');
    }
  };

  const handleSignup = async () => {
    setError('');
    if (!fullName.trim()) { setError('الرجاء إدخال الاسم الكامل'); return; }
    if (!isValidLibyaPhone(phone)) { setError('الرجاء إدخال رقم هاتف ليبي صحيح'); return; }
    if (!password.trim() || password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (!lat || !lng) { setError('الرجاء تحديد موقعك الجغرافي'); return; }
    if (!agreed) { setError('الرجاء الموافقة على الشروط والأحكام'); return; }

    setLoading(true);
    try {
      const normalizedPhone = normalizeLibyaPhone(phone);
      const email = getAuthEmailForPhone(normalizedPhone);

      // 1. إنشاء حساب المصادقة وإمرارية البيانات في metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'customer',
            full_name: fullName.trim(),
          },
        },
      });

      if (authError || !authData?.user) {
        throw new Error(authError?.message || 'فشل إنشاء الحساب');
      }

      const user = authData.user;

      // 2. تحديث الملف الشخصي عبر upsert لتجنب التعارض
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: fullName.trim(),
        phone: normalizedPhone,
        role: 'customer',
        location_lat: lat,
        location_lng: lng,
        location_address: address,
        verification_status: 'approved',
      });

      if (profileError) throw new Error(profileError.message);

      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  };

  if (showTerms) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0B0E" />
        <LinearGradient colors={['#16161A', '#0B0B0E']} style={styles.termsHeader}>
          <TouchableOpacity onPress={() => setShowTerms(false)} style={styles.backBtn}>
            <ChevronRight color="#D4AF37" size={24} />
          </TouchableOpacity>
          <Text style={styles.termsTitle}>الشروط والأحكام</Text>
        </LinearGradient>
        <ScrollView contentContainerStyle={styles.termsBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.termsText}>{TERMS_TEXT}</Text>
          <TouchableOpacity
            style={[styles.agreeBtn, agreed && styles.agreeBtnActive]}
            onPress={() => { setAgreed(true); setShowTerms(false); }}
          >
            <Check color={agreed ? '#0B0B0E' : '#A1A1AA'} size={20} />
            <Text style={[styles.agreeBtnText, agreed && styles.agreeBtnTextActive]}>موافق على الشروط</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0B0E" />
      <LinearGradient colors={['#16161A', '#0B0B0E']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronRight color="#D4AF37" size={24} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Star color="#D4AF37" size={18} fill="#D4AF37" />
          <Text style={styles.headerTitle}>{BRAND_NAME} {BRAND_LOGO}</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>تسجيل زبون جديد</Text>
        <View style={styles.promoCard}>
          <Text style={styles.promoTitle}>عرض خاص!</Text>
          <Text style={styles.promoDesc}>
            احصل على خصم {PROMO_CUSTOMER_DISCOUNT} {CURRENCY} على أول طلب صيانة
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>الاسم الكامل</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="أدخل اسمك الكامل"
            placeholderTextColor="#6B7280"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>رقم الهاتف</Text>
          <View style={styles.phoneInput}>
            <Phone color="#D4AF37" size={20} style={{ marginLeft: 8 }} />
            <TextInput
              style={styles.phoneField}
              value={phone}
              onChangeText={setPhone}
              placeholder="091XXXXXXX"
              placeholderTextColor="#6B7280"
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>كلمة المرور</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="6 أحرف على الأقل"
            placeholderTextColor="#6B7280"
            secureTextEntry
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>الموقع الجغرافي</Text>
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={getLocation}
          >
            <MapPin color={lat ? '#D4AF37' : '#A1A1AA'} size={20} />
            <Text style={styles.locationText} numberOfLines={1}>
              {lat ? address : 'اضغط لتحديد موقعك'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.termsRow} onPress={() => setShowTerms(true)}>
          <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
            {agreed && <Check color="#0B0B0E" size={16} strokeWidth={3} />}
          </View>
          <Text style={styles.termsTextSmall}>
            أوافق على الشروط والأحكام
          </Text>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.signupBtn, loading && styles.signupBtnDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          <Text style={styles.signupBtnText}>
            {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0E' },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontFamily: 'Cairo-Bold',
    fontSize: 18,
    color: '#D4AF37',
  },
  pageTitle: {
    fontFamily: 'Cairo-Bold',
    fontSize: 22,
    color: '#D4AF37',
    marginBottom: 16,
    marginTop: 8,
  },
  body: { padding: 24, paddingBottom: 40 },
  promoCard: {
    backgroundColor: '#16161A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  promoTitle: {
    fontFamily: 'Cairo-Bold',
    fontSize: 16,
    color: '#D4AF37',
    marginBottom: 4,
  },
  promoDesc: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    color: '#E4E4E7',
  },
  inputGroup: { marginBottom: 18 },
  label: {
    fontFamily: 'Cairo-Medium',
    fontSize: 14,
    color: '#E4E4E7',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Cairo-Regular',
    fontSize: 16,
    backgroundColor: '#16161A',
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderWidth: 1,
    color: '#FFFFFF',
  },
  phoneInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#16161A',
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderWidth: 1,
  },
  phoneField: {
    flex: 1,
    fontFamily: 'Cairo-Regular',
    fontSize: 16,
    textAlign: 'left',
    color: '#FFFFFF',
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#16161A',
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderWidth: 1,
    gap: 10,
  },
  locationText: {
    fontFamily: 'Cairo-Regular',
    fontSize: 15,
    color: '#E4E4E7',
    flex: 1,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#D4AF37',
  },
  termsTextSmall: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    color: '#E4E4E7',
  },
  errorText: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  signupBtn: {
    backgroundColor: '#D4AF37',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  signupBtnDisabled: { opacity: 0.6 },
  signupBtnText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 16,
    color: '#0B0B0E',
  },
  termsHeader: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  termsTitle: {
    fontFamily: 'Cairo-Bold',
    fontSize: 20,
    color: '#D4AF37',
  },
  termsBody: { padding: 24, paddingBottom: 40 },
  termsText: {
    fontFamily: 'Cairo-Regular',
    fontSize: 15,
    lineHeight: 26,
    color: '#E4E4E7',
  },
  agreeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#27272A',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  agreeBtnActive: {
    backgroundColor: '#D4AF37',
  },
  agreeBtnText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 16,
    color: '#A1A1AA',
  },
  agreeBtnTextActive: {
    color: '#0B0B0E',
  },
});