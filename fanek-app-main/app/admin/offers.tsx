import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Activity, ChevronLeft, Plus, Trash2, Users, Wrench, X } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';

interface Offer {
  id: string;
  title: string;
  description: string;
  target_type: 'customers' | 'technicians';
  discount_amount: number;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
}

type TargetType = Offer['target_type'];

export default function AdminOffersScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const { show } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discount, setDiscount] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('customers');
  const [endsAt, setEndsAt] = useState('');

  const loadOffers = useCallback(async () => {
    const { data, error } = await supabase.from('offers').select('*').order('created_at', { ascending: false });
    if (error) show(error.message, 'error');
    setOffers((data as Offer[]) || []);
    setLoading(false);
  }, [show]);

  useEffect(() => { loadOffers(); }, [loadOffers]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDiscount('');
    setTargetType('customers');
    setEndsAt('');
  };

  const createOffer = async () => {
    if (!profile || !title.trim() || !description.trim()) {
      show('أدخل عنوان العرض ووصفه', 'error');
      return;
    }
    const amount = Number(discount);
    if (!Number.isFinite(amount) || amount < 0) {
      show('أدخل قيمة خصم صحيحة', 'error');
      return;
    }
    const parsedEnd = endsAt.trim() ? new Date(endsAt.trim()) : null;
    if (parsedEnd && Number.isNaN(parsedEnd.getTime())) {
      show('صيغة تاريخ الانتهاء غير صحيحة', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('offers').insert({
      title: title.trim(),
      description: description.trim(),
      target_type: targetType,
      discount_amount: amount,
      ends_at: parsedEnd?.toISOString() || null,
      created_by: profile.id,
    });
    setSaving(false);
    if (error) {
      show(error.message, 'error');
      return;
    }
    show('تم إنشاء العرض', 'success');
    setModalVisible(false);
    resetForm();
    loadOffers();
  };

  const toggleOffer = async (offer: Offer) => {
    const { error } = await supabase.from('offers').update({ active: !offer.active }).eq('id', offer.id);
    if (error) show(error.message, 'error');
    else loadOffers();
  };

  const deleteOffer = (offer: Offer) => {
    Alert.alert('حذف العرض', `هل تريد حذف «${offer.title}»؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('offers').delete().eq('id', offer.id);
        if (error) show(error.message, 'error');
        else { show('تم حذف العرض', 'success'); loadOffers(); }
      } },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}><ChevronLeft color={colors.text} size={24} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>العروض الترويجية</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={[styles.iconButton, { backgroundColor: colors.primary }]}><Plus color="#fff" size={20} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <TouchableOpacity style={[styles.createButton, { backgroundColor: colors.primary }]} onPress={() => setModalVisible(true)}>
          <Plus color="#fff" size={18} /><Text style={styles.createText}>إنشاء عرض جديد</Text>
        </TouchableOpacity>
        {loading ? <Text style={[styles.empty, { color: colors.subtext }]}>جاري التحميل...</Text> : offers.length === 0 ? <Text style={[styles.empty, { color: colors.subtext }]}>لا توجد عروض بعد</Text> : offers.map((offer) => (
          <View key={offer.id} style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border, opacity: offer.active ? 1 : 0.62 }]}>
            <View style={styles.cardTop}>
              {offer.target_type === 'customers' ? <Users color={colors.primary} size={20} /> : <Wrench color={colors.success} size={20} />}
              <View style={styles.cardHeading}><Text style={[styles.title, { color: colors.text }]}>{offer.title}</Text><Text style={[styles.target, { color: colors.subtext }]}>{offer.target_type === 'customers' ? 'للزبائن' : 'للفنيين'}</Text></View>
              <Text style={[styles.discount, { color: colors.primary }]}>{offer.discount_amount} د.ل</Text>
            </View>
            <Text style={[styles.description, { color: colors.subtext }]}>{offer.description}</Text>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => toggleOffer(offer)} style={[styles.action, { borderColor: colors.border }]}><Activity color={offer.active ? colors.success : colors.subtext} size={16} /><Text style={[styles.actionText, { color: colors.text }]}>{offer.active ? 'مفعل' : 'متوقف'}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => deleteOffer(offer)} style={[styles.action, { borderColor: colors.error + '55' }]}><Trash2 color={colors.error} size={16} /><Text style={[styles.actionText, { color: colors.error }]}>حذف</Text></TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}><View style={[styles.modal, { backgroundColor: colors.cardBg }]}>
          <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.text }]}>إنشاء عرض</Text><TouchableOpacity onPress={() => setModalVisible(false)}><X color={colors.text} size={22} /></TouchableOpacity></View>
          <TextInput value={title} onChangeText={setTitle} placeholder="عنوان العرض" placeholderTextColor={colors.subtext} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]} />
          <TextInput value={description} onChangeText={setDescription} placeholder="وصف العرض" placeholderTextColor={colors.subtext} multiline style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]} />
          <TextInput value={discount} onChangeText={setDiscount} placeholder="قيمة الخصم بالدينار" placeholderTextColor={colors.subtext} keyboardType="decimal-pad" style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]} />
          <View style={styles.targetRow}>{(['customers', 'technicians'] as TargetType[]).map((target) => <TouchableOpacity key={target} onPress={() => setTargetType(target)} style={[styles.targetButton, { borderColor: colors.border }, targetType === target && { backgroundColor: colors.primary, borderColor: colors.primary }]}><Text style={{ color: targetType === target ? '#fff' : colors.text, fontFamily: 'Cairo-Medium' }}>{target === 'customers' ? 'الزبائن' : 'الفنيون'}</Text></TouchableOpacity>)}</View>
          <TextInput value={endsAt} onChangeText={setEndsAt} placeholder="تاريخ الانتهاء ISO اختياري" placeholderTextColor={colors.subtext} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]} />
          <TouchableOpacity onPress={createOffer} disabled={saving} style={[styles.saveButton, { backgroundColor: colors.primary }]}><Text style={styles.saveText}>{saving ? 'جاري الحفظ...' : 'حفظ العرض'}</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, iconButton: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 19 }, body: { padding: 16, paddingBottom: 40 }, createButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, marginBottom: 16 }, createText: { color: '#fff', fontFamily: 'Cairo-Bold' }, empty: { textAlign: 'center', fontFamily: 'Cairo-Regular', marginTop: 36 }, card: { borderWidth: 1, borderRadius: 14, padding: 15, marginBottom: 12 }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 }, cardHeading: { flex: 1 }, title: { fontFamily: 'Cairo-Bold', fontSize: 16 }, target: { fontFamily: 'Cairo-Regular', fontSize: 12 }, discount: { fontFamily: 'Cairo-Bold', fontSize: 16 }, description: { fontFamily: 'Cairo-Regular', fontSize: 13, marginTop: 10 }, actions: { flexDirection: 'row', gap: 8, marginTop: 14 }, action: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7 }, actionText: { fontFamily: 'Cairo-Medium', fontSize: 12 }, overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }, modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 11 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }, modalTitle: { fontFamily: 'Cairo-Bold', fontSize: 18 }, input: { borderWidth: 1, borderRadius: 10, padding: 12, fontFamily: 'Cairo-Regular', textAlign: 'right' }, textArea: { minHeight: 76, textAlignVertical: 'top' }, targetRow: { flexDirection: 'row', gap: 8 }, targetButton: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 11 }, saveButton: { alignItems: 'center', padding: 14, borderRadius: 10, marginTop: 4 }, saveText: { color: '#fff', fontFamily: 'Cairo-Bold' },
});
