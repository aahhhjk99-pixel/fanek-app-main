import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Send, Bell, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

interface NotificationRecord {
  id: string;
  title: string;
  body: string;
  target_type: 'all' | 'customers' | 'technicians';
  created_at: string;
}

export default function AdminNotificationsScreen() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'customers' | 'technicians'>('all');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (e: any) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const showAlert = (titleMsg: string, bodyMsg: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${titleMsg}: ${bodyMsg}`);
    } else {
      Alert.alert(titleMsg, bodyMsg);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      showAlert('تنبيه', 'يرجى كتابة عنوان الإشعار ونصل الرسالة');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          title: title.trim(),
          body: body.trim(),
          target_type: targetType,
          created_by: profile?.id || null,
        });

      if (error) throw error;

      showAlert('نجاح', 'تم إرسال الإشعار وحفظه بنجاح');
      setTitle('');
      setBody('');
      await fetchHistory();
    } catch (err: any) {
      showAlert('خطأ', err.message || 'حدث خطأ أثناء الإرسال');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmDelete = Platform.OS === 'web' 
      ? (typeof window !== 'undefined' && window.confirm('هل أنت تأكد من حذف هذا الإشعار؟'))
      : true;

    if (!confirmDelete) return;

    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      showAlert('خطأ', 'فشل حذف الإشعار من السجل');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>إدارة الإشعارات</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>الجمهور المستهدف</Text>
          <View style={styles.targetRow}>
            {[
              { id: 'all', label: 'الجميع' },
              { id: 'customers', label: 'الزبائن' },
              { id: 'technicians', label: 'الفنيين' },
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.targetBtn,
                  { borderColor: colors.border },
                  targetType === item.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setTargetType(item.id as any)}
              >
                <Text
                  style={[
                    styles.targetBtnText,
                    { color: colors.text },
                    targetType === item.id && { color: '#fff' },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>عنوان الإشعار</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
            placeholder="أدخل عنوان الإشعار..."
            placeholderTextColor={colors.subtext}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={[styles.label, { color: colors.text }]}>نص الرسالة</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
            placeholder="اكتب نص الإشعار هنا..."
            placeholderTextColor={colors.subtext}
            multiline
            numberOfLines={4}
            value={body}
            onChangeText={setBody}
          />

          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary }]}
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Send color="#fff" size={18} />
                <Text style={styles.sendBtnText}>إرسال الإشعار الآن</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>سجل الإشعارات المرسلة</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : history.length === 0 ? (
          <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 20, fontFamily: 'Cairo-Regular' }}>
            لا توجد إشعارات مرسلة سابقة
          </Text>
        ) : (
          history.map((item) => (
            <View key={item.id} style={[styles.historyCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <View style={styles.historyHeader}>
                <View style={styles.historyTitleRow}>
                  <Bell color={colors.primary} size={18} />
                  <Text style={[styles.historyTitle, { color: colors.text }]}>{item.title}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => handleDelete(item.id)} 
                  style={styles.deleteBtn}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Trash2 color="#ef4444" size={18} />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={[styles.historyBody, { color: colors.subtext }]}>{item.body}</Text>
              <Text style={[styles.historyMeta, { color: colors.subtext }]}>
                المستهدفين: {item.target_type === 'all' ? 'الجميع' : item.target_type === 'customers' ? 'الزبائن' : 'الفنيين'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  body: { padding: 16, paddingBottom: 40 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 24 },
  label: { fontFamily: 'Cairo-SemiBold', fontSize: 14, marginBottom: 8, marginTop: 10 },
  targetRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  targetBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  targetBtnText: { fontFamily: 'Cairo-Medium', fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontFamily: 'Cairo-Regular', fontSize: 14 },
  textArea: { height: 100, textAlignVertical: 'top' },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 10, marginTop: 20 },
  sendBtnText: { color: '#fff', fontFamily: 'Cairo-Bold', fontSize: 15 },
  sectionTitle: { fontFamily: 'Cairo-SemiBold', fontSize: 18, marginBottom: 12 },
  historyCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  deleteBtn: { padding: 6 },
  historyTitle: { fontFamily: 'Cairo-Bold', fontSize: 15 },
  historyBody: { fontFamily: 'Cairo-Regular', fontSize: 13, marginBottom: 6 },
  historyMeta: { fontFamily: 'Cairo-Regular', fontSize: 11 },
});
