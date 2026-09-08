import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Check, X, Wallet, RefreshCw } from 'lucide-react-native';

interface WalletRequest {
  id: string;
  technician_id: string;
  code: string;
  amount: number;
  status: string;
  created_at: string;
  profiles?: {
    full_name: string;
    phone: string;
  };
}

export default function AdminWalletRequests() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<WalletRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('recharge_requests')
      .select('id, technician_id, voucher_code, voucher_value, status, created_at, technician:profiles!recharge_requests_technician_id_fkey(full_name, phone)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRequests((data || []).map((item) => ({
        ...item,
        code: item.voucher_code,
        amount: item.voucher_value,
        profiles: item.technician,
      })) as WalletRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('admin_recharge_requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recharge_requests' },
        () => fetchRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleApprove = async (request: WalletRequest) => {
    if (!profile) return;
    setActionLoading(request.id);
    try {
      const { data, error } = await supabase.rpc('approve_recharge', {
        p_request_id: request.id,
        p_admin_id: profile.id,
      });
      if (error) throw error;
      if (!(data as { success?: boolean } | null)?.success) throw new Error((data as { error?: string } | null)?.error || 'فشلت الموافقة');

      Alert.alert('تم بنجاح', `تم إضافة ${request.amount} د.ل إلى محفظة الفني`);
      fetchRequests();
    } catch (err: any) {
      Alert.alert('خطأ', err.message || 'فشلت عملية الموافقة');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const { error } = await supabase
        .from('recharge_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      Alert.alert('تم الرفض', 'تم رفض طلب التعبئة');
      fetchRequests();
    } catch (err: any) {
      Alert.alert('خطأ', err.message || 'فشلت عملية الرفض');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>طلبات شحن المحفظة المعلقة</Text>
        <TouchableOpacity onPress={fetchRequests} style={styles.refreshBtn}>
          <RefreshCw size={18} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Wallet size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>لا توجد طلبات تعبئة معلقة حالياً</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.techName}>{item.profiles?.full_name || 'فني غير معروف'}</Text>
                <Text style={styles.amount}>+{item.amount} د.ل</Text>
              </View>

              <Text style={styles.phone}>رقم الهاتف: {item.profiles?.phone || 'غير متوفر'}</Text>
              <Text style={styles.codeText}>كود التعبئة: {item.code}</Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, styles.approveBtn]}
                  onPress={() => handleApprove(item)}
                  disabled={actionLoading === item.id}
                >
                  <Check size={18} color="#fff" />
                  <Text style={styles.btnText}>موافقة واعتماد</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.rejectBtn]}
                  onPress={() => handleReject(item.id)}
                  disabled={actionLoading === item.id}
                >
                  <X size={18} color="#fff" />
                  <Text style={styles.btnText}>رفض</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontFamily: 'Cairo-Bold', color: '#0f172a' },
  refreshBtn: { padding: 8, backgroundColor: '#eff6ff', borderRadius: 8 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  emptyText: { marginTop: 12, fontSize: 15, fontFamily: 'Cairo-Medium', color: '#64748b' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  techName: { fontSize: 16, fontFamily: 'Cairo-Bold', color: '#1e293b' },
  amount: { fontSize: 16, fontFamily: 'Cairo-Bold', color: '#16a34a' },
  phone: { fontSize: 14, color: '#64748b', fontFamily: 'Cairo-Regular', marginBottom: 4 },
  codeText: { fontSize: 14, color: '#2563eb', fontFamily: 'Cairo-Bold', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  approveBtn: { backgroundColor: '#16a34a' },
  rejectBtn: { backgroundColor: '#dc2626' },
  btnText: { color: '#fff', fontFamily: 'Cairo-Bold', fontSize: 14 },
});
