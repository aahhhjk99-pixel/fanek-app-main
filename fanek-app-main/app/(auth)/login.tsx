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
  KeyboardAvoidingView,
  Platform,
  StatusBar,
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0B0B0E" />

      {/* Header / الهيدر الملكي */}
      <LinearGradient colors={['#16161A', '#0B0B0E']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronRight color="#D4AF37" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تسجيل الدخول</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Icon / الأيقونة الملكية */}
        <View style={styles.iconCircle}>
          <Star color="#D4AF37" size={32} fill="#D4AF37" />
        </View>

        <Text style={styles.brandName}>
          {BRAND_NAME} {BRAND_LOGO}
        </Text>
        <Text style={styles.subtitle}>
          أدخل رقم هاتفك وكلمة المرور للمتابعة
        </Text>

        {/* Input: Phone */}
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

        {/* Input: Password */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>كلمة المرور</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="******"
            placeholderTextColor="#6B7280"
            secureTextEntry
          />
        </View>

        {/* Remember Me */}
        <TouchableOpacity
          style={styles.rememberMeRow}
          onPress={() => setRememberMe(!rememberMe)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
            {rememberMe && <Check color="#0B0B0E" size={14} strokeWidth={3} />}
          </View>
          <Text style={styles.rememberMeText}>تذكرني دائماً</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#0B0B0E" size="small" />
          ) : (
            <Text style={styles.loginBtnText}>دخول</Text>
          )}
        </TouchableOpacity>

        {/* Signup Link */}
        <TouchableOpacity onPress={() => router.push('/(auth)/')} style={styles.signupLink}>
          <Text style={styles.signupLinkText}>ليس لديك حساب؟ سجل الآن</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
    fontSize: 20,
    color: '#D4AF37',
  },
  body: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 30,
    paddingBottom: 40,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  brandName: {
    fontFamily: 'Cairo-Bold',
    fontSize: 22,
    textAlign: 'center',
    color: '#D4AF37',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    textAlign: 'center',
    color: '#A1A1AA',
    marginBottom: 32,
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
    borderColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  rememberMeText: {
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
  loginBtn: {
    backgroundColor: '#D4AF37',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 16,
    color: '#0B0B0E',
  },
  signupLink: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  signupLinkText: {
    fontFamily: 'Cairo-Medium',
    fontSize: 14,
    color: '#F3CA63',
  },
});