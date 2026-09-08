import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import {
  Users,
  Wrench,
  ClipboardList,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Tag,
  ListChecks,
  ChevronLeft,
  ShieldCheck,
  Clock,
  Shield,
  Settings,
  Bell,
  CheckCircle2,
  XCircle,
} from 'lucide-react-native';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/constants';
import type { Order, Dispute, Profile } from '@/types/database';

export default function AdminDashboardScreen() {
  const { colors } = useTheme();
  const { show } = useToast();

  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalTechnicians: 0,
    verifiedTechs: 0,
    pendingTechs: 0,
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalRevenue: 0,
    platformCommission: 0,
    openDisputes: 0,
    bannedUsers: 0,
  });

  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [pendingTechs, setPendingTechs] = useState<Profile[]>([]);
  const [openDisputes, setOpenDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingTechId, setProcessingTechId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      // 1. جلب إحصائيات المستخدمين
      const { count: customers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer');

      const { count: techs } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'technician');

      const { count: verified } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'technician')
        .eq('verification_status', 'approved');

      const { count: pending } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'technician')
        .eq('verification_status', 'pending');

      const { count: banned } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('account_status', 'banned');

      // 2. جلب إحصائيات الطلبات
      const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      const { count: activeOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '("completed","cancelled")');

      const { count: completedOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      const { count: cancelledOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cancelled');

      // 3. جلب الحسابات الماليّة والأرباح
      const { data: resetData } = await supabase
        .from('admin_financial_resets')
        .select('profits_reset_at, invoices_reset_at')
        .eq('id', 1)
        .maybeSingle();

      const earningsResetAt = new Date(resetData?.profits_reset_at || '1970-01-01T00:00:00Z');
      const invoicesResetAt = new Date(resetData?.invoices_reset_at || '1970-01-01T00:00:00Z');

      const { data: invoices } = await supabase
        .from('invoices')
        .select('total, commission_amount, status, created_at');

      const totalRev = (invoices || [])
        .filter((inv) => new Date(inv.created_at) > invoicesResetAt && inv.status !== 'cancelled')
        .reduce((sum, inv) => sum + Number(inv.total || 0), 0);

      const totalComm = (invoices || [])
        .filter((inv) => new Date(inv.created_at) > earningsResetAt && inv.status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.commission_amount || 0), 0);

      // 4. النزاعات المفتوحة
      const { count: disputes } = await supabase
        .from('disputes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');

      setStats({
        totalCustomers: customers || 0,
        totalTechnicians: techs || 0,
        verifiedTechs: verified || 0,
        pendingTechs: pending || 0,
        totalOrders: totalOrders || 0,
        activeOrders: activeOrders || 0,
        completedOrders: completedOrders || 0,
        cancelledOrders: cancelledOrders || 0,
        totalRevenue: totalRev,
        platformCommission: totalComm,
        openDisputes: disputes || 0,
        bannedUsers: banned || 0,
      });

      // 5. أحدث 10 طلبات
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          *, service:services(*), customer:profiles!orders_customer_id_fkey(*),
          technician:profiles!orders_technician_id_fkey(*)
        `)
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentOrders((orders as Order[]) || []);

      // 6. الفنيون بانتظار التوثيق
      const { data: pTechs } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'technician')
        .eq('verification_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);
      setPendingTechs((pTechs as Profile[]) || []);

      // 7. النزاعات النشطة
      const { data: disp } = await supabase
        .from('disputes')
        .select(`
          *, order:orders(*), invoice:invoices(*),
          customer:profiles!disputes_customer_id_fkey(*),
          technician:profiles!disputes_technician_id_fkey(*)
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10);
      setOpenDisputes((disp as Dispute[]) || []);

    } catch (err: any) {
      show('خطأ في تحميل البيانات: ' + (err.message || ''), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [show]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const verifyTech = async (tech: Profile, status: 'approved' | 'rejected') => {
    setProcessingTechId(tech.id);
    try {
      const { error } = await supabase.rpc('admin_update_profile', {
        p_profile_id: tech.id,
        p_verification_status: status,
      });

      if (error) {
        const { error: directErr } = await supabase
          .from('profiles')
          .update({ verification_status: status })
          .eq('id', tech.id);

        if (directErr) throw directErr;
      }

      show(status === 'approved' ? 'تم توثيق الفني وتفعيل حسابه' : 'تم رفض طلب التوثيق', 'success');
      loadData();
    } catch (err: any) {
      show('فشل التحديث: ' + (err.message || ''), 'error');
    } finally {
      setProcessingTechId(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.subtext }]}>جاري تحميل لوحة التحكم...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* الهيدر الرئيسي */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color={colors.text} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>لوحة التحكم الإدارية</Text>
          <View style={{ width: 28 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* ملخص الأرباح والمالية */}
        <View style={[styles.profitsCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.profitsHeader}>
            <View style={styles.profitsHeaderLeft}>
              <DollarSign color={colors.primary} size={22} />
              <Text style={[styles.profitsTitle, { color: colors.text }]}>أرباح المنصة والمالية</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/admin/financials' as any)}>
              <Text style={[styles.viewDetailsText, { color: colors.primary }]}>التفاصيل ←</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.profitsGrid}>
            <View style={[styles.profitBox, { backgroundColor: colors.primary + '10' }]}>
              <Text style={[styles.profitLabel, { color: colors.subtext }]}>صافي عمولة المنصة</Text>
              <Text style={[styles.profitValue, { color: colors.success }]}>
                {formatCurrency(stats.platformCommission)}
              </Text>
            </View>
            <View style={[styles.profitBox, { backgroundColor: colors.primary + '10' }]}>
              <Text style={[styles.profitLabel, { color: colors.subtext }]}>إجمالي الفواتير</Text>
              <Text style={[styles.profitValue, { color: colors.primary }]}>
                {formatCurrency(stats.totalRevenue)}
              </Text>
            </View>
          </View>
        </View>

        {/* أزرار الوصول السريع */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>الوصول السريع</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            onPress={() => router.push('/admin/users')}
          >
            <Users color={colors.primary} size={20} />
            <Text style={[styles.quickBtnText, { color: colors.text }]}>الحسابات</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            onPress={() => router.push('/admin/disputes')}
          >
            <AlertTriangle color={colors.error} size={20} />
            <Text style={[styles.quickBtnText, { color: colors.text }]}>النزاعات</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            onPress={() => router.push('/admin/notifications' as any)}
          >
            <Bell color="#d97706" size={20} />
            <Text style={[styles.quickBtnText, { color: colors.text }]}>الإشعارات</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            onPress={() => router.push('/admin/offers' as any)}
          >
            <Tag color={colors.primary} size={20} />
            <Text style={[styles.quickBtnText, { color: colors.text }]}>العروض</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            onPress={() => router.push('/admin/services' as any)}
          >
            <ListChecks color={colors.success} size={20} />
            <Text style={[styles.quickBtnText, { color: colors.text }]}>الخدمات</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            onPress={() => router.push('/admin/support-config')}
          >
            <Settings color="#6b7280" size={20} />
            <Text style={[styles.quickBtnText, { color: colors.text }]}>الإعدادات</Text>
          </TouchableOpacity>
        </View>

        {/* شبكة الإحصائيات العامة */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>الإحصائيات العامة</Text>
        <View style={styles.statsGrid}>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => router.push('/admin/users')}
          >
            <Users color="#2563eb" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalCustomers}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>الزبائن</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => router.push('/admin/users')}
          >
            <Wrench color="#16a34a" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalTechnicians}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>الفنيون</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => router.push('/admin/users')}
          >
            <ShieldCheck color="#10b981" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.verifiedTechs}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>موثقون</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => router.push('/admin/users')}
          >
            <Clock color="#f59e0b" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.pendingTechs}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>بانتظار التوثيق</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/orders' as any)}
          >
            <ClipboardList color="#6366f1" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalOrders}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>إجمالي الطلبات</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/orders' as any)}
          >
            <TrendingUp color="#3b82f6" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.activeOrders}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>طلبات نشطة</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => router.push('/admin/disputes')}
          >
            <AlertTriangle color="#ef4444" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.openDisputes}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>نزاعات مفتوحة</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => router.push('/admin/users')}
          >
            <Shield color="#9ca3af" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.bannedUsers}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>حسابات محظورة</Text>
          </TouchableOpacity>
        </View>

        {/* قائمة التوثيق المعلقة */}
        {pendingTechs.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>طلب توثيق فنيين جدد</Text>
            {pendingTechs.map((tech) => (
              <View key={tech.id} style={[styles.techCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.techName, { color: colors.text }]}>{tech.full_name || 'بدون اسم'}</Text>
                  <Text style={[styles.techInfo, { color: colors.subtext }]}>
                    {tech.specialty || 'تخصص غير محدد'} • {tech.phone || 'بدون هاتف'}
                  </Text>
                </View>

                {processingTechId === tech.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View style={styles.actionBtnsRow}>
                    <TouchableOpacity
                      style={[styles.verifyBtn, { backgroundColor: colors.success + '20' }]}
                      onPress={() => verifyTech(tech, 'approved')}
                    >
                      <CheckCircle2 color={colors.success} size={16} />
                      <Text style={[styles.verifyText, { color: colors.success }]}>قبول</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.verifyBtn, { backgroundColor: colors.error + '20' }]}
                      onPress={() => verifyTech(tech, 'rejected')}
                    >
                      <XCircle color={colors.error} size={16} />
                      <Text style={[styles.verifyText, { color: colors.error }]}>رفض</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        {/* النزاعات المفتوحة */}
        {openDisputes.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>نزاعات تتطلب التدخل</Text>
            {openDisputes.map((dispute) => (
              <TouchableOpacity
                key={dispute.id}
                style={[styles.disputeRow, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                onPress={() => router.push(`/dispute/${dispute.id}` as any)}
              >
                <AlertTriangle color="#ef4444" size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.disputeReason, { color: colors.text }]} numberOfLines={1}>
                    {dispute.reason}
                  </Text>
                  <Text style={[styles.disputeTime, { color: colors.subtext }]}>
                    {formatDateTime(dispute.created_at)}
                  </Text>
                </View>
                <ChevronLeft color={colors.subtext} size={20} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* أحدث الطلبات */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>أحدث الطلبات</Text>
        {recentOrders.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>لا توجد طلبات حالياً</Text>
        ) : (
          recentOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={[styles.orderRow, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              onPress={() => router.push(`/order/${order.id}` as any)}
            >
              <View style={[styles.orderDot, { backgroundColor: ORDER_STATUS_COLORS[order.status] || colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.orderService, { color: colors.text }]}>
                  {order.service?.name || 'خدمة صيانة'}
                </Text>
                <Text style={[styles.orderCustomer, { color: colors.subtext }]}>
                  {order.customer?.full_name || 'عميل'} ← {order.technician?.full_name || 'غير محدد'}
                </Text>
              </View>
              <Text style={[styles.orderStatus, { color: ORDER_STATUS_COLORS[order.status] || colors.primary }]}>
                {ORDER_STATUS_LABELS[order.status] || order.status}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontFamily: 'Cairo-Medium', fontSize: 14, marginTop: 12 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  body: { padding: 16, paddingBottom: 40 },

  profitsCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 20 },
  profitsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  profitsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profitsTitle: { fontFamily: 'Cairo-Bold', fontSize: 16 },
  viewDetailsText: { fontFamily: 'Cairo-SemiBold', fontSize: 13 },
  profitsGrid: { flexDirection: 'row', gap: 10 },
  profitBox: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  profitLabel: { fontFamily: 'Cairo-Regular', fontSize: 12, marginBottom: 4 },
  profitValue: { fontFamily: 'Cairo-Bold', fontSize: 16 },

  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  quickBtn: {
    width: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  quickBtnText: { fontFamily: 'Cairo-Medium', fontSize: 12 },

  sectionTitle: { fontFamily: 'Cairo-Bold', fontSize: 16, marginBottom: 12, marginTop: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    width: '23%',
    flexGrow: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontFamily: 'Cairo-Bold', fontSize: 16 },
  statLabel: { fontFamily: 'Cairo-Regular', fontSize: 11, textAlign: 'center' },

  techCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // تم التصحيح هنا
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  techName: { fontFamily: 'Cairo-SemiBold', fontSize: 14 },
  techInfo: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  actionBtnsRow: { flexDirection: 'row', gap: 6 },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  verifyText: { fontFamily: 'Cairo-Bold', fontSize: 12 },

  disputeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  disputeReason: { fontFamily: 'Cairo-Medium', fontSize: 14 },
  disputeTime: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },

  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  orderDot: { width: 10, height: 10, borderRadius: 5 },
  orderService: { fontFamily: 'Cairo-SemiBold', fontSize: 14 },
  orderCustomer: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  orderStatus: { fontFamily: 'Cairo-Medium', fontSize: 12 },
  emptyText: { fontFamily: 'Cairo-Regular', fontSize: 13, textAlign: 'center', marginVertical: 10 },
});