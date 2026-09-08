import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Phone, Star, Check } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/lib/theme-context';
import { useToast } from '@/lib/toast';
import { BRAND_NAME, BRAND_LOGO } from '@/lib/constants';

const REMEMBERED_PHONE_KEY = 'fanek.remembered_phone';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(REMEMBERED_PHONE_KEY)
      .then((savedPhone) => {
        if (savedPhone) setPhone(savedPhone);
      })
      .catch(() => {});
  }, []);

  const handleLogin = async () => {
    setError('');

    if (!phone.trim() || !password.trim()) {
      const msg = 'الرجاء إدخال رقم الهاتف وكلمة المرور';
      setError(msg);
      show(msg, 'error');
      return;
    }

    setLoading(true);

    try {
      const cleanPhone = phone.trim().replace(/\s+/g, '');
      const email = `${cleanPhone}@services.ly`;

      // 1. تسجيل الدخول
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !data.session) {
        throw new Error('رقم الهاتف أو كلمة المرور غير صحيحة');
      }

      // 2. حفظ الرقم دائماً لضمان عدم طرد المستخدم عند فتح التطبيق
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBERED_PHONE_KEY, cleanPhone);
      } else {
        await AsyncStorage.removeItem(REMEMBERED_PHONE_KEY);
      }

      // 3. التحقق من وجود ملف شخصي (Profile) وتوليده إن لم يوجد
      const userId = data.session.user.id;
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!profileData) {
        // إنشاء بروفايل تلقائي في حال كان الحساب جديداً أو ينقصه سجل
        await supabase.from('profiles').insert([
          {
            id: userId,
            phone: cleanPhone,
            role: 'user',
            account_status: 'active',
          },
        ]);
      }

      show('تم تسجيل الدخول بنجاح', 'success');

      // 4. مهلة بسيطة (150ms) لاستقرار الجلسة في AuthContext قبل التوجيه
      setTimeout(() => {
        setLoading(false);
        router.replace('/(tabs)');
      }, 150);

    } catch (err: any) {
      const msg = err.message || 'حدث خطأ أثناء تسجيل الدخول';
      setError(msg);
      show(msg, 'error');
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <LinearGradient colors={['#2563eb', '#1d4ed8']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronRight color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تسجيل الدخول</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.iconCircle}>
          <Star color="#2563eb" size={32} fill="#2563eb" />
        </View>

        <Text style={[styles.brandName, { color: colors.text }]}>
          {BRAND_NAME} {BRAND_LOGO}
        </Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          أدخل رقم هاتفك وكلمة المرور للمتابعة
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>رقم الهاتف</Text>
          <View style={[styles.phoneInput, { backgroundColor: colors.cardBg, borderColor: colors.inputBorder }]}>
            <Phone color={colors.subtext} size={20} style={{ marginLeft: 8 }} />
            <TextInput
              style={[styles.phoneField, { color: colors.text }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="091XXXXXXX"
              placeholderTextColor={colors.subtext}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>كلمة المرور</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.inputBorder }]}
            value={password}
            onChangeText={setPassword}
            placeholder="******"
            placeholderTextColor={colors.subtext}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={styles.rememberMeRow}
          onPress={() => setRememberMe(!rememberMe)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
            {rememberMe && <Check color="#fff" size={14} />}
          </View>
          <Text style={[styles.rememberMeText, { color: colors.text }]}>تذكرني دائماً</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.loginBtnText}>دخول</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/')} style={styles.signupLink}>
          <Text style={styles.signupLinkText}>ليس لديك حساب؟ سجل الآن</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontFamily: 'Cairo-Bold',
    fontSize: 20,
    color: '#fff',
  },
  body: { padding: 24, paddingTop: 40 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  brandName: {
    fontFamily: 'Cairo-Bold',
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  inputGroup: { marginBottom: 16 },
  label: {
    fontFamily: 'Cairo-Medium',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Cairo-Regular',
    fontSize: 16,
    borderWidth: 1,
  },
  phoneInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  phoneField: {
    flex: 1,
    fontFamily: 'Cairo-Regular',
    fontSize: 16,
    textAlign: 'left',
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#9ca3af',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  rememberMeText: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
  },
  errorText: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    color: '#ef4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  loginBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 16,
    color: '#fff',
  },
  signupLink: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  signupLinkText: {
    fontFamily: 'Cairo-Medium',
    fontSize: 14,
    color: '#2563eb',
  },
});