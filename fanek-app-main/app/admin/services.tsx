import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Check, ChevronLeft, Edit3, Plus, Power, Trash2, X } from 'lucide-react-native';
import { useTheme } from '@/lib/theme-context';
import { useToast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import type { Service } from '@/types/database';

interface ServiceForm {
  name: string;
  name_en: string;
  description: string;
  category: string;
  icon: string;
  price_min: string;
  price_max: string;
  active: boolean;
}

const emptyForm: ServiceForm = {
  name: '',
  name_en: '',
  description: '',
  category: '',
  icon: 'wrench',
  price_min: '0',
  price_max: '0',
  active: true,
};

export default function AdminServicesScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Service | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<ServiceForm>(emptyForm);

  const loadServices = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('category')
        .order('name');

      if (error) throw error;
      setServices((data as Service[]) || []);
    } catch (error: any) {
      show(error.message || 'حدث خطأ أثناء تحميل الخدمات', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [show]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const openCreate = () => {
    setSelected(null);
    setForm(emptyForm);
    setFormVisible(true);
  };

  const openEdit = (service: Service) => {
    setSelected(service);
    setFormVisible(true);
    setForm({
      name: service.name || '',
      name_en: service.name_en || '',
      description: service.description || '',
      category: service.category || '',
      icon: service.icon || 'wrench',
      price_min: String(service.price_min ?? 0),
      price_max: String(service.price_max ?? 0),
      active: service.active ?? true,
    });
  };

  const updateForm = <K extends keyof ServiceForm>(key: K, value: ServiceForm[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const saveService = async () => {
    const min = Number(form.price_min);
    const max = Number(form.price_max);

    if (!form.name.trim() || !form.category.trim() || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
      show('أدخل الاسم والتصنيف وأسعاراً صحيحة (يجب أن يكون السعر الأدنى أقل من أو يساوي الأعلى)', 'error');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      name_en: form.name_en.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      icon: form.icon.trim() || 'wrench',
      price_min: min,
      price_max: max,
      active: form.active,
    };

    try {
      const result = selected
        ? await supabase.from('services').update(payload).eq('id', selected.id)
        : await supabase.from('services').insert(payload);

      if (result.error) throw result.error;

      show(selected ? 'تم تحديث الخدمة بنجاح' : 'تمت إضافة الخدمة بنجاح', 'success');
      setSelected(null);
      setFormVisible(false);
      loadServices();
    } catch (err: any) {
      show(err.message || 'حدث خطأ أثناء حفظ الخدمة', 'error');
    } finally {
      setSaving(false);
    }
  };

  // تبديل حالة التفعيل بشكل فوري
  const toggleService = async (service: Service) => {
    const newStatus = !service.active;

    // تحديث فوري في الشاشة
    setServices((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, active: newStatus } : s))
    );

    try {
      const { error } = await supabase.from('services').update({ active: newStatus }).eq('id', service.id);
      if (error) throw error;
      show(newStatus ? 'تم تفعيل الخدمة' : 'تم تعطيل الخدمة', 'info');
    } catch (error: any) {
      show(error.message || 'تعذر تغيير حالة الخدمة', 'error');
      loadServices();
    }
  };

  // التنفيذ الفعلي للحذف
  const executeDeleteService = async (serviceId: string) => {
    // تحديث فوري في الشاشة
    setServices((prev) => prev.filter((s) => s.id !== serviceId));

    try {
      const { error } = await supabase.from('services').delete().eq('id', serviceId);
      if (error) throw error;
      show('تم حذف الخدمة بنجاح', 'success');
    } catch (error: any) {
      show(error.message || 'تعذر حذف الخدمة', 'error');
      loadServices();
    }
  };

  // تأكيد الحذف توافقي بين الويب والموبايل
  const deleteService = (service: Service) => {
    const title = 'حذف الخدمة';
    const message = `هل أنت متأكد من حذف «${service.name}»؟`;

    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        executeDeleteService(service.id);
      }
    } else {
      Alert.alert(title, message, [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => executeDeleteService(service.id),
        },
      ]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft color={colors.text} size={25} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>إدارة الخدمات</Text>
        <TouchableOpacity onPress={openCreate} style={[styles.addIcon, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
          <Plus color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadServices(); }} />
        }
      >
        <TouchableOpacity onPress={openCreate} style={[styles.addButton, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
          <Plus color="#fff" size={18} />
          <Text style={styles.addText}>إضافة خدمة جديدة</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
        ) : services.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>لا توجد خدمات حالياً</Text>
        ) : (
          services.map((service) => (
            <View
              key={service.id}
              style={[
                styles.card,
                { backgroundColor: colors.cardBg, borderColor: colors.border, opacity: service.active ? 1 : 0.6 },
              ]}
            >
              <View style={styles.cardTop}>
                <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.iconText, { color: colors.primary }]}>{service.icon || 'wrench'}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.name, { color: colors.text }]}>{service.name}</Text>
                  <Text style={[styles.meta, { color: colors.subtext }]}>
                    {service.category} • {service.price_min} - {service.price_max} د.ل
                  </Text>
                </View>
                <Text style={[styles.activeText, { color: service.active ? colors.success : colors.subtext }]}>
                  {service.active ? 'مفعلة' : 'متوقفة'}
                </Text>
              </View>

              {service.description ? (
                <Text style={[styles.description, { color: colors.subtext }]}>{service.description}</Text>
              ) : null}

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => openEdit(service)}
                  style={[styles.action, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <Edit3 color={colors.primary} size={16} />
                  <Text style={[styles.actionText, { color: colors.text }]}>تعديل</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => toggleService(service)}
                  style={[styles.action, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <Power color={service.active ? colors.warning : colors.success} size={16} />
                  <Text style={[styles.actionText, { color: colors.text }]}>
                    {service.active ? 'تعطيل' : 'تفعيل'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => deleteService(service)}
                  style={[styles.action, { borderColor: colors.error + '50' }]}
                  activeOpacity={0.7}
                >
                  <Trash2 color={colors.error} size={16} />
                  <Text style={[styles.actionText, { color: colors.error }]}>حذف</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* نافذة إضافة / تعديل خدمة */}
      <Modal
        visible={formVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setSelected(null); setFormVisible(false); }}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selected ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}
              </Text>
              <TouchableOpacity onPress={() => { setSelected(null); setFormVisible(false); }}>
                <X color={colors.text} size={22} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={form.name}
              onChangeText={(value) => updateForm('name', value)}
              placeholder="اسم الخدمة *"
              placeholderTextColor={colors.subtext}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <TextInput
              value={form.category}
              onChangeText={(value) => updateForm('category', value)}
              placeholder="التصنيف *"
              placeholderTextColor={colors.subtext}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <TextInput
              value={form.name_en}
              onChangeText={(value) => updateForm('name_en', value)}
              placeholder="الاسم التقني / بالإنجليزية"
              placeholderTextColor={colors.subtext}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <TextInput
              value={form.icon}
              onChangeText={(value) => updateForm('icon', value)}
              placeholder="اسم الأيقونة (مثل wrench)"
              placeholderTextColor={colors.subtext}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />

            <View style={styles.priceRow}>
              <TextInput
                value={form.price_min}
                onChangeText={(value) => updateForm('price_min', value)}
                placeholder="السعر الأدنى"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.subtext}
                style={[styles.input, styles.priceInput, { color: colors.text, borderColor: colors.border }]}
              />
              <TextInput
                value={form.price_max}
                onChangeText={(value) => updateForm('price_max', value)}
                placeholder="السعر الأعلى"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.subtext}
                style={[styles.input, styles.priceInput, { color: colors.text, borderColor: colors.border }]}
              />
            </View>

            <TextInput
              value={form.description}
              onChangeText={(value) => updateForm('description', value)}
              placeholder="وصف الخدمة"
              placeholderTextColor={colors.subtext}
              multiline
              style={[styles.input, styles.descriptionInput, { color: colors.text, borderColor: colors.border }]}
            />

            <TouchableOpacity
              onPress={() => updateForm('active', !form.active)}
              style={styles.activeRow}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, form.active && { backgroundColor: colors.success, borderColor: colors.success }]}>
                {form.active && <Check color="#fff" size={14} />}
              </View>
              <Text style={{ color: colors.text, fontFamily: 'Cairo-Medium' }}>الخدمة مفعلة</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={saveService}
              disabled={saving}
              style={[styles.saveButton, { backgroundColor: colors.primary }, saving && { opacity: 0.65 }]}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>حفظ</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'space-between',
  },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 20 },
  addIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, paddingBottom: 40 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
  },
  addText: { color: '#fff', fontFamily: 'Cairo-Bold' },
  emptyText: { textAlign: 'center', fontFamily: 'Cairo-Regular', marginTop: 30 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 10, fontFamily: 'Cairo-Bold' },
  cardInfo: { flex: 1 },
  name: { fontFamily: 'Cairo-Bold', fontSize: 16 },
  meta: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 3 },
  activeText: { fontFamily: 'Cairo-Medium', fontSize: 11 },
  description: { fontFamily: 'Cairo-Regular', fontSize: 13, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionText: { fontFamily: 'Cairo-Medium', fontSize: 12 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modal: { padding: 20, borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  input: { borderWidth: 1, borderRadius: 10, padding: 11, fontFamily: 'Cairo-Regular', textAlign: 'right' },
  priceRow: { flexDirection: 'row', gap: 8 },
  priceInput: { flex: 1 },
  descriptionInput: { minHeight: 70, textAlignVertical: 'top' },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justify: 'center',
  },
  saveButton: { alignItems: 'center', borderRadius: 10, padding: 14, marginTop: 4 },
  saveText: { color: '#fff', fontFamily: 'Cairo-Bold', fontSize: 15 },
});