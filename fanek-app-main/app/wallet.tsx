import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { ChevronLeft, Wallet as WalletIcon, TrendingUp, Receipt, AlertCircle, Smartphone, Send, X } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import type { Wallet } from '@/types/database';
import type { RechargeCompany } from '@/types/database';

export default function WalletScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRecharge, setShowRecharge] = useState(false);
  const [company, setCompany] = useState<RechargeCompany>('libyana');
  const [voucherValue, setVoucherValue] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [notification, setNotification] = useState<{ title: string; body: string } | null>(null);

  const loadWallet = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('wallets').select('*').eq('technician_id', profile.id).maybeSingle();
    setWallet(data as Wallet | null);
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadWallet(); }, [loadWallet]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase.channel(`wallet-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `technician_id=eq.${profile.id}` }, loadWallet)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, loadWallet]);

  useEffect(() => {
    if (!profile) return;
    const loadNotifications = async () => {
      const { data } = await supabase.from('notifications').select('title, body')
        .eq('recipient_id', profile.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data) setNotification(data);
    };
    loadNotifications();
    const channel = supabase.channel(`wallet-notifications-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${profile.id}` }, (payload) => {
        const next = payload.new as { title: string; body: string };
        setNotification({ title: next.title, body: next.body });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const submitRecharge = async () => {
    if (!profile) return;
    const amount = Number(voucherValue);
    if (!Number.isFinite(amount) || amount <= 0 || !voucherCode.trim()) {
      setMessage('أدخل قيمة صحيحة وكود التعبئة');
      return;
    }
    setSubmitting(true);
    setMessage('');
    const { error } = await supabase.from('recharge_requests').insert({
      technician_id: profile.id,
      company,
      voucher_value: amount,
      voucher_code: voucherCode.trim(),
      status: 'pending',
    });
    setSubmitting(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setVoucherValue('');
    setVoucherCode('');
    setShowRecharge(false);
    setMessage('تم إرسال طلب التعبئة للمراجعة');
  };

  // قراءة الرصيد الفعلي وحالة التوقف
  const effectiveBalance = wallet?.balance ?? 0;
  const isBlocked = effectiveBalance <= 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>المحفظة</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.body}>
        <View style={[styles.balanceCard, { backgroundColor: colors.walletCardBg }]}>
          <View style={styles.balanceRow}>
            <WalletIcon color="rgba(255,255,255,0.8)" size={24} />
            <Text style={styles.balanceLabel}>الرصيد الحالي</Text>
          </View>
          <Text style={[styles.balanceAmount, { color: colors.walletCardText }]}>{formatCurrency(effectiveBalance)}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <TrendingUp color="rgba(255,255,255,0.7)" size={16} />
              <Text style={styles.statLabel}>إجمالي الأرباح</Text>
              <Text style={styles.statValue}>{formatCurrency(wallet?.total_earnings ?? 0)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Receipt color="rgba(255,255,255,0.7)" size={16} />
              <Text style={styles.statLabel}>إجمالي العمولات</Text>
              <Text style={styles.statValue}>{formatCurrency(wallet?.total_commission ?? 0)}</Text>
            </View>
          </View>
        </View>

        {isBlocked && (
          <View style={[styles.blockedBanner, { backgroundColor: colors.blockedBg, borderColor: colors.blockedBorder }]}>
            <AlertCircle color={colors.error} size={20} />
            <Text style={[styles.blockedText, { color: colors.error }]}>
              رصيدك الحالي غير كافٍ واستقبال الطلبات متوقف. يرجى التواصل مع إدارة التطبيق لشحن الرصيد.
            </Text>
          </View>
        )}

        <TouchableOpacity style={[styles.ledgerBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={() => router.push('/ledger')}>
          <Receipt color={colors.primary} size={22} />
          <Text style={[styles.ledgerBtnText, { color: colors.text }]}>عرض السجل المالي الكامل</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.rechargeBtn, { backgroundColor: colors.primary }]} onPress={() => setShowRecharge(true)}>
          <Send color="#fff" size={18} />
          <Text style={styles.rechargeBtnText}>إرسال طلب تعبئة</Text>
        </TouchableOpacity>

        {message ? <Text style={[styles.message, { color: colors.primary }]}>{message}</Text> : null}
        {notification ? (
          <View style={[styles.notification, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}> 
            <Text style={[styles.notificationTitle, { color: colors.text }]}>{notification.title}</Text>
            <Text style={[styles.notificationBody, { color: colors.subtext }]}>{notification.body}</Text>
          </View>
        ) : null}

        {loading && <Text style={[styles.loadingText, { color: colors.subtext }]}>جاري التحميل...</Text>}
      </View>

      <Modal visible={showRecharge} transparent animationType="slide" onRequestClose={() => setShowRecharge(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.cardBg }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>طلب تعبئة الرصيد</Text>
              <TouchableOpacity onPress={() => setShowRecharge(false)}><X color={colors.text} size={22} /></TouchableOpacity>
            </View>
            <View style={styles.companyRow}>
              {(['libyana', 'al_madar'] as RechargeCompany[]).map((item) => (
                <TouchableOpacity key={item} onPress={() => setCompany(item)} style={[styles.companyBtn, { borderColor: colors.border }, company === item && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  <Smartphone color={company === item ? '#fff' : colors.primary} size={16} />
                  <Text style={{ color: company === item ? '#fff' : colors.text, fontFamily: 'Cairo-Medium' }}>{item === 'libyana' ? 'ليبيانا' : 'المدار'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={[styles.rechargeInput, { color: colors.text, borderColor: colors.border }]} value={voucherValue} onChangeText={setVoucherValue} placeholder="قيمة الكرت" placeholderTextColor={colors.subtext} keyboardType="decimal-pad" />
            <TextInput style={[styles.rechargeInput, { color: colors.text, borderColor: colors.border }]} value={voucherCode} onChangeText={setVoucherCode} placeholder="كود التعبئة" placeholderTextColor={colors.subtext} keyboardType="number-pad" />
            <TouchableOpacity onPress={submitRecharge} disabled={submitting} style={[styles.submitRecharge, { backgroundColor: colors.primary }, submitting && { opacity: 0.65 }]}>
              {submitting ? <ActivityIndicator color="#fff" /> : <><Send color="#fff" size={17} /><Text style={styles.rechargeBtnText}>إرسال للمراجعة</Text></>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 20 },
  body: { padding: 16 },
  balanceCard: { borderRadius: 20, padding: 24, marginBottom: 16 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  balanceLabel: { fontFamily: 'Cairo-Regular', fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  balanceAmount: { fontFamily: 'Cairo-Bold', fontSize: 36, marginBottom: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
  statLabel: { fontFamily: 'Cairo-Regular', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  statValue: { fontFamily: 'Cairo-Bold', fontSize: 16, color: '#fff', marginTop: 4 },
  blockedBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  blockedText: { flex: 1, fontFamily: 'Cairo-Medium', fontSize: 13, lineHeight: 18 },
  ledgerBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 16, borderWidth: 1 },
  ledgerBtnText: { fontFamily: 'Cairo-Medium', fontSize: 15 },
  loadingText: { fontFamily: 'Cairo-Regular', fontSize: 14, textAlign: 'center', marginTop: 20 },
  rechargeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, padding: 15, marginTop: 12 },
  rechargeBtnText: { color: '#fff', fontFamily: 'Cairo-Bold', fontSize: 14 },
  message: { fontFamily: 'Cairo-Medium', textAlign: 'center', marginTop: 12 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modal: { padding: 20, borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  companyRow: { flexDirection: 'row', gap: 8 },
  companyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 10, padding: 11 },
  rechargeInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontFamily: 'Cairo-Regular', textAlign: 'right' },
  submitRecharge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, padding: 14 },
  notification: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 },
  notificationTitle: { fontFamily: 'Cairo-Bold', fontSize: 14 },
  notificationBody: { fontFamily: 'Cairo-Regular', fontSize: 13, marginTop: 3 },
});
