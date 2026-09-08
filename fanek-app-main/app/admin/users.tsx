import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import {
  ChevronLeft,
  Search,
  Trash2,
  Ban,
  CheckCircle2,
  Percent,
  PlusCircle,
  MinusCircle,
} from 'lucide-react-native';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import type { Profile } from '@/types/database';

export default function AdminUsersScreen() {
  const { colors } = useTheme();
  const { show } = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<'all' | 'customer' | 'technician'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedRole !== 'all') {
        query = query.eq('role', selectedRole);
      }

      const { data, error } = await query;
      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      show('خطأ في جلب المستخدمين: ' + (err.message || ''), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedRole, show]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // 1. تبديل الحظر والتفعيل
  const toggleBanUser = async (user: Profile) => {
    const isBanned = user.account_status === 'banned';
    const newStatus = isBanned ? 'active' : 'banned';
    const confirmMessage = isBanned
      ? `هل أنت متأكد من تفعيل حساب: ${user.full_name || user.phone}؟`
      : `هل أنت متأكد من حظر حساب: ${user.full_name || user.phone}؟`;

    if (Platform.OS === 'web') {
      if (!window.confirm(confirmMessage)) return;
    }

    setActionLoadingId(user.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ account_status: newStatus })
        .eq('id', user.id);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, account_status: newStatus } : u))
      );
      show(isBanned ? 'تم تفعيل الحساب بنجاح' : 'تم حظر الحساب بنجاح', 'success');
    } catch (err: any) {
      show('فشلت العملية: ' + (err.message || ''), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 2. حذف الحساب
  const handleDeleteUser = async (user: Profile) => {
    const confirmMessage = `تحذير: هل أنت متأكد من حذف الحساب (${user.full_name || user.phone})؟`;

    if (Platform.OS === 'web') {
      if (!window.confirm(confirmMessage)) return;
    }

    setActionLoadingId(user.id);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', user.id);

      if (error) {
        if (error.code === '23503') {
          show('تعذر الحذف المباشر لوجود بيانات مرتبطة بالحساب، تم حظره تلقائياً.', 'warning');
          await supabase.from('profiles').update({ account_status: 'banned' }).eq('id', user.id);
        } else {
          throw error;
        }
      } else {
        show('تم حذف الحساب بنجاح', 'success');
      }
      fetchUsers();
    } catch (err: any) {
      show('فشل الحذف: ' + (err.message || ''), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 3. تعديل نسبة العمولة للفني
  const handleEditCommission = async (user: Profile) => {
    const currentRate = (user as any).custom_commission_rate ?? 15;
    const input = window.prompt(`أدخل نسبة العمولة الجديدة للفني (${user.full_name}):`, String(currentRate));
    if (!input) return;

    const newRate = parseFloat(input);
    if (isNaN(newRate) || newRate < 0 || newRate > 100) {
      show('يرجى إدخال نسبة مئوية صحيحة بين 0 و 100', 'error');
      return;
    }

    setActionLoadingId(user.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ custom_commission_rate: newRate })
        .eq('id', user.id);

      if (error) throw error;

      show('تم تحديث نسبة العمولة بنجاح', 'success');
      fetchUsers();
    } catch (err: any) {
      show('فشل تحديث العمولة: ' + (err.message || ''), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 4. شحن الرصيد يدوياً
  const handleRechargeBalance = async (user: Profile) => {
    const currentBalance = (user as any).wallet_balance ?? (user as any).balance ?? 0;
    const input = window.prompt(`أدخل المبلغ المراد شحنه لحساب (${user.full_name || user.phone}):`, '10');
    if (!input) return;

    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      show('يرجى إدخال قيمة شحن صالحة أكبر من صفر', 'error');
      return;
    }

    const newBalance = currentBalance + amount;

    setActionLoadingId(user.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', user.id);

      if (error) throw error;

      show(`تم شحن ${amount} د.ل بنجاح للحساب`, 'success');
      fetchUsers();
    } catch (err: any) {
      show('فشل شحن الرصيد: ' + (err.message || ''), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 5. خصم الرصيد يدوياً
  const handleDeductBalance = async (user: Profile) => {
    const currentBalance = (user as any).wallet_balance ?? (user as any).balance ?? 0;
    const input = window.prompt(`أدخل المبلغ المراد خصمه من حساب (${user.full_name || user.phone}):`, '10');
    if (!input) return;

    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      show('يرجى إدخال قيمة خصم صالحة أكبر من صفر', 'error');
      return;
    }

    const newBalance = Math.max(0, currentBalance - amount);

    setActionLoadingId(user.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', user.id);

      if (error) throw error;

      show(`تم خصم ${amount} د.ل بنجاح من الحساب`, 'success');
      fetchUsers();
    } catch (err: any) {
      show('فشل خصم الرصيد: ' + (err.message || ''), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const name = u.full_name || '';
    const phone = u.phone || '';
    const q = searchQuery.toLowerCase();
    return name.toLowerCase().includes(q) || phone.includes(q);
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* الهيدر */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>إدارة الحسابات والعمولات</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.body}>
        {/* شريط البحث */}
        <View style={[styles.searchBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Search color={colors.subtext} size={18} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="بحث بالاسم أو الهاتف..."
            placeholderTextColor={colors.subtext}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* أزرار الفلترة */}
        <View style={styles.tabsRow}>
          {[
            { id: 'all', label: 'الكل' },
            { id: 'customer', label: 'الزبائن' },
            { id: 'technician', label: 'الفنيون' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabBtn,
                {
                  backgroundColor: selectedRole === tab.id ? colors.primary : colors.cardBg,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setSelectedRole(tab.id as any)}
            >
              <Text style={[styles.tabText, { color: selectedRole === tab.id ? '#FFF' : colors.text }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* قائمة المستخدمين */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.listContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          >
            {filteredUsers.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.subtext }]}>لا يوجد مستخدمون مطبق عليهم البحث</Text>
            ) : (
              filteredUsers.map((user) => {
                const isBanned = user.account_status === 'banned';
                const isLoading = actionLoadingId === user.id;
                const commissionRate = (user as any).custom_commission_rate ?? 15;
                const userBalance = (user as any).wallet_balance ?? (user as any).balance ?? 0;

                return (
                  <View
                    key={user.id}
                    style={[styles.userCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                  >
                    <View style={styles.userInfo}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.userName, { color: colors.text }]}>
                          {user.full_name || 'بدون اسم'}
                        </Text>
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor:
                                user.role === 'technician'
                                  ? colors.primary + '20'
                                  : colors.success + '20',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              { color: user.role === 'technician' ? colors.primary : colors.success },
                            ]}
                          >
                            {user.role === 'technician' ? 'فني' : 'زبون'}
                          </Text>
                        </View>

                        {isBanned && (
                          <View style={[styles.badge, { backgroundColor: colors.error + '20' }]}>
                            <Text style={[styles.badgeText, { color: colors.error }]}>محظور</Text>
                          </View>
                        )}
                      </View>

                      <Text style={[styles.userPhone, { color: colors.subtext }]}>
                        {user.phone || 'بدون رقم هاتف'}
                      </Text>

                      <View style={styles.metaRow}>
                        <Text style={[styles.metaText, { color: colors.text }]}>
                          الرصيد: <Text style={{ color: colors.success, fontFamily: 'Cairo-Bold' }}>{userBalance} د.ل</Text>
                        </Text>
                        {user.role === 'technician' && (
                          <Text style={[styles.metaText, { color: colors.primary }]}>
                            نسبة العمولة: %{commissionRate}
                          </Text>
                        )}
                      </View>
                    </View>

                    {isLoading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <View style={styles.actionsRow}>
                        {/* تعديل النسبة للفنيين فقط */}
                        {user.role === 'technician' && (
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: colors.primary + '20' }]}
                            onPress={() => handleEditCommission(user)}
                          >
                            <Percent color={colors.primary} size={15} />
                            <Text style={[styles.actionBtnText, { color: colors.primary }]}>تعديل النسبة</Text>
                          </TouchableOpacity>
                        )}

                        {/* شحن الرصيد */}
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: colors.success + '20' }]}
                          onPress={() => handleRechargeBalance(user)}
                        >
                          <PlusCircle color={colors.success} size={15} />
                          <Text style={[styles.actionBtnText, { color: colors.success }]}>شحن</Text>
                        </TouchableOpacity>

                        {/* خصم الرصيد */}
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#FF980020' }]}
                          onPress={() => handleDeductBalance(user)}
                        >
                          <MinusCircle color="#FF9800" size={15} />
                          <Text style={[styles.actionBtnText, { color: '#FF9800' }]}>خصم</Text>
                        </TouchableOpacity>

                        {/* زر الحظر والتفعيل (أخضر عند الحظر للتفعيل، أحمر عند النشاط للحظر) */}
                        <TouchableOpacity
                          style={[
                            styles.actionBtn,
                            { backgroundColor: isBanned ? colors.success + '20' : colors.error + '20' },
                          ]}
                          onPress={() => toggleBanUser(user)}
                        >
                          {isBanned ? (
                            <CheckCircle2 color={colors.success} size={15} />
                          ) : (
                            <Ban color={colors.error} size={15} />
                          )}
                          <Text
                            style={[
                              styles.actionBtnText,
                              { color: isBanned ? colors.success : colors.error },
                            ]}
                          >
                            {isBanned ? 'تفعيل' : 'حظر'}
                          </Text>
                        </TouchableOpacity>

                        {/* حذف الحساب */}
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: colors.error + '20' }]}
                          onPress={() => handleDeleteUser(user)}
                        >
                          <Trash2 color={colors.error} size={15} />
                          <Text style={[styles.actionBtnText, { color: colors.error }]}>حذف</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  body: { flex: 1, padding: 16 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontFamily: 'Cairo-Regular', fontSize: 14, textAlign: 'right' },

  tabsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabText: { fontFamily: 'Cairo-SemiBold', fontSize: 13 },

  listContainer: { paddingBottom: 30 },
  emptyText: { fontFamily: 'Cairo-Regular', textAlign: 'center', marginTop: 20 },

  userCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  userInfo: { gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  userName: { fontFamily: 'Cairo-Bold', fontSize: 15 },
  userPhone: { fontFamily: 'Cairo-Regular', fontSize: 13 },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 4, flexWrap: 'wrap' },
  metaText: { fontFamily: 'Cairo-SemiBold', fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontFamily: 'Cairo-Medium', fontSize: 11 },

  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
    marginTop: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: { fontFamily: 'Cairo-Bold', fontSize: 12 },
});