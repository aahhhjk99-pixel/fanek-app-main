import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, TextInput,
  Modal, ActivityIndicator,
} from 'react-native';
import { Search, Star, ChevronLeft, Sparkles, ShieldCheck, BrainCircuit, Tag } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/lib/supabase';
import { getServiceIcon } from '@/components/ServiceIcon';
import { calculateDistance } from '@/lib/format';
import { CURRENCY, SERVICE_CATEGORIES, PROMO_CUSTOMER_DISCOUNT, BRAND_NAME, BRAND_LOGO } from '@/lib/constants';
import type { Service, Profile, Offer } from '@/types/database';

type DiagnosisResult = {
  specialty: string;
  confidence: number;
  summary: string;
};

export default function CustomerHome() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topTechnicians, setTopTechnicians] = useState<Profile[]>([]);
  const [diagnosisModal, setDiagnosisModal] = useState(false);
  const [diagnosisText, setDiagnosisText] = useState('');
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);

  const loadData = useCallback(async () => {
    try {
      const { data: servicesData } = await supabase.from('services').select('*').eq('active', true).order('category');
      setServices((servicesData as Service[]) || []);

      const { data: offerData } = await supabase
        .from('offers')
        .select('*')
        .eq('target_type', 'customers')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(3);
      setOffers((offerData as Offer[]) || []);

      const { data: techs } = await supabase
        .from('technician_public_profiles')
        .select('*')
        .eq('technician_status', 'available')
        .limit(10);
      
      const technicians = (techs as Profile[]) || [];
      if (technicians.length > 0) {
        const { data: reviews } = await supabase
          .from('reviews')
          .select('reviewed_id, rating')
          .in('reviewed_id', technicians.map((tech) => tech.id));

        const ratings = new Map<string, number[]>();
        (reviews || []).forEach((review) => {
          const values = ratings.get(review.reviewed_id) || [];
          values.push(Number(review.rating));
          ratings.set(review.reviewed_id, values);
        });

        setTopTechnicians(
          technicians.map((tech) => {
            const values = ratings.get(tech.id) || [];
            return {
              ...tech,
              average_rating: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
              review_count: values.length,
            };
          })
        );
      } else {
        setTopTechnicians([]);
      }
    } catch (err) {
      console.error('Error loading home data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredServices = services.filter((s) => {
    const matchesSearch = !search || s.name.includes(search) || s.description?.includes(search);
    const matchesCategory = !selectedCategory || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOrderService = (service: Service) => {
    router.push({ pathname: '/order/[id]', params: { id: 'new', serviceId: service.id } } as any);
  };

  const runDiagnosis = async () => {
    if (!diagnosisText.trim()) return;
    setDiagnosing(true);
    setDiagnosisResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('gemini-diagnose', {
        body: { description: diagnosisText.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDiagnosisResult(data as DiagnosisResult);
    } catch (err: any) {
      setDiagnosisResult({ specialty: 'أجهزة', confidence: 0, summary: err.message || 'فشل التشخيص' });
    } finally {
      setDiagnosing(false);
    }
  };

  const createOrderFromDiagnosis = async () => {
    if (!diagnosisResult || !profile) return;
    try {
      const { data: service } = await supabase
        .from('services')
        .select('id')
        .eq('category', diagnosisResult.specialty)
        .limit(1)
        .maybeSingle();

      let serviceId = service?.id;
      if (!serviceId) {
        const { data: fallback } = await supabase.from('services').select('id').limit(1).maybeSingle();
        serviceId = fallback?.id;
      }
      if (!serviceId) return;

      const { data: order } = await supabase
        .from('orders')
        .insert({
          customer_id: profile.id,
          service_id: serviceId,
          status: 'new',
          location_lat: profile.location_lat,
          location_lng: profile.location_lng,
          location_address: profile.location_address || '',
          description: `${diagnosisResult.summary} (تشخيص آلي: ${diagnosisResult.specialty})`,
        })
        .select('id')
        .single();

      if (order) {
        setDiagnosisModal(false);
        setDiagnosisText('');
        setDiagnosisResult(null);
        router.push(`/order/${order.id}` as any);
      }
    } catch {
      setDiagnosisModal(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerUserText}>
            <Text style={[styles.greeting, { color: colors.subtext }]}>مرحباً،</Text>
            <Text style={[styles.userName, { color: colors.text }]}>{profile?.full_name || 'زبون'}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.brandBadge, { backgroundColor: colors.primaryLight }]}>
              <Star color={colors.primary} size={14} fill={colors.primary} />
              <Text style={[styles.brandText, { color: colors.primary }]}>
                {BRAND_NAME} {BRAND_LOGO}
              </Text>
            </View>
            <ThemeToggle compact />
          </View>
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.inputBg }]}>
          <Search color={colors.subtext} size={20} style={{ marginHorizontal: 10 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="ابحث عن خدمة..."
            placeholderTextColor={colors.subtext}
            value={search}
            onChangeText={setSearch}
            textAlign="right"
          />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} colors={[colors.primary]} />}
      >
        {/* Active Offers */}
        {offers.map((offer) => (
          <View key={offer.id} style={[styles.offerBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
            <Tag color={colors.primary} size={22} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.promoTitle, { color: colors.text }]}>{offer.title}</Text>
              <Text style={[styles.promoDesc, { color: colors.subtext }]}>
                {offer.description} • خصم {offer.discount_amount} {CURRENCY}
              </Text>
            </View>
          </View>
        ))}

        {/* First Order Discount Promo */}
        {!profile?.promo_discount_used && (
          <View style={[styles.promoBanner, { backgroundColor: colors.promoBg, borderColor: colors.promoBorder }]}>
            <Sparkles color={colors.accent} size={22} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.promoTitle, { color: colors.promoTitle }]}>خصم أول طلب</Text>
              <Text style={[styles.promoDesc, { color: colors.promoText }]}>
                احصل على خصم {PROMO_CUSTOMER_DISCOUNT} {CURRENCY} على أول صيانة
              </Text>
            </View>
          </View>
        )}

        {/* AI Diagnosis Button */}
        <TouchableOpacity
          style={[styles.aiDiagnosisBtn, { backgroundColor: colors.primary }]}
          onPress={() => setDiagnosisModal(true)}
          activeOpacity={0.88}
        >
          <BrainCircuit color="#fff" size={24} />
          <View style={{ flex: 1 }}>
            <Text style={styles.aiDiagnosisTitle}>تشخيص العطل بالذكاء الاصطناعي</Text>
            <Text style={styles.aiDiagnosisDesc}>صوّر العطل أو اصفه وسيحدد التطبيق التخصص المطلوب</Text>
          </View>
          <ChevronLeft color="#fff" size={20} />
        </TouchableOpacity>

        {/* Categories Horizontal Scroll */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>الأقسام</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          <TouchableOpacity
            style={[
              styles.categoryChip,
              { backgroundColor: colors.chipBg, borderColor: colors.border },
              !selectedCategory && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.categoryText, { color: colors.chipText }, !selectedCategory && { color: colors.chipActiveText }]}>
              الكل
            </Text>
          </TouchableOpacity>
          {SERVICE_CATEGORIES.map((cat) => {
            const Icon = getServiceIcon(cat.icon);
            const active = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  { backgroundColor: colors.chipBg, borderColor: colors.border },
                  active && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Icon color={active ? '#fff' : cat.color} size={16} />
                <Text style={[styles.categoryText, { color: colors.chipText }, active && { color: colors.chipActiveText }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Available Services Grid */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>الخدمات المتاحة</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: 30 }} />
        ) : filteredServices.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>لا توجد خدمات متاحة حالياً</Text>
        ) : (
          <View style={styles.servicesGrid}>
            {filteredServices.map((service) => {
              const Icon = getServiceIcon(service.icon);
              return (
                <TouchableOpacity
                  key={service.id}
                  style={[styles.serviceCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                  onPress={() => handleOrderService(service)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.serviceIconBox, { backgroundColor: colors.iconBg }]}>
                    <Icon color={colors.primary} size={24} />
                  </View>
                  <Text style={[styles.serviceName, { color: colors.text }]} numberOfLines={2}>
                    {service.name}
                  </Text>
                  <Text style={[styles.servicePrice, { color: colors.subtext }]}>يُحدد بعد معاينة الفني</Text>

                  <View style={[styles.warrantyBadge, { backgroundColor: colors.success + '15' }]}>
                    <ShieldCheck color={colors.success} size={14} />
                    <Text style={[styles.warrantyText, { color: colors.success }]}>ضمان 3 أيام</Text>
                  </View>

                  <View style={[styles.orderBtn, { backgroundColor: colors.iconBg }]}>
                    <Text style={[styles.orderBtnText, { color: colors.primary }]}>اطلب الآن</Text>
                    <ChevronLeft color={colors.primary} size={16} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Top Technicians Section */}
        {topTechnicians.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 12 }]}>فنيون متاحون بالقرب منك</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.techsScroll}>
              {topTechnicians.map((tech) => {
                const dist =
                  profile?.location_lat && tech.location_lat
                    ? calculateDistance(profile.location_lat, profile.location_lng!, tech.location_lat, tech.location_lng!)
                    : null;
                return (
                  <View key={tech.id} style={[styles.techCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                    <View style={[styles.techAvatar, { backgroundColor: colors.iconBg }]}>
                      <Text style={[styles.techInitial, { color: colors.primary }]}>{tech.full_name?.charAt(0) || 'ف'}</Text>
                    </View>
                    <Text style={[styles.techName, { color: colors.text }]} numberOfLines={1}>
                      {tech.full_name}
                    </Text>
                    <Text style={[styles.techSpecialty, { color: colors.subtext }]} numberOfLines={1}>
                      {tech.specialty || 'فني صيانة'}
                    </Text>
                    <View style={styles.techInfo}>
                      <Star color={colors.accent} size={14} fill={colors.accent} />
                      <Text style={[styles.techRating, { color: colors.accent }]}>
                        {tech.review_count ? `${tech.average_rating?.toFixed(1)} (${tech.review_count})` : 'جديد'}
                      </Text>
                    </View>
                    {dist !== null && <Text style={[styles.techDist, { color: colors.subtext }]}>{dist} كم</Text>}
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}
      </ScrollView>

      {/* AI Diagnosis Modal */}
      <Modal visible={diagnosisModal} animationType="slide" transparent onRequestClose={() => setDiagnosisModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>تشخيص العطل بالذكاء الاصطناعي</Text>
              <TouchableOpacity
                onPress={() => {
                  setDiagnosisModal(false);
                  setDiagnosisResult(null);
                }}
              >
                <Text style={[styles.modalClose, { color: colors.subtext }]}>إغلاق</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, { color: colors.text }]}>اكتب وصف المشكلة أو العطل:</Text>
            <TextInput
              style={[styles.diagnosisInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
              value={diagnosisText}
              onChangeText={setDiagnosisText}
              placeholder="مثال: المكيف لا يبرد والهواء الخارج منه دافئ ويصدر صوتاً عريضاً..."
              placeholderTextColor={colors.subtext}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              textAlign="right"
            />

            <TouchableOpacity
              style={[styles.diagnoseBtn, { backgroundColor: colors.primary }, (diagnosing || !diagnosisText.trim()) && styles.submitBtnDisabled]}
              onPress={runDiagnosis}
              disabled={diagnosing || !diagnosisText.trim()}
            >
              {diagnosing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <BrainCircuit color="#fff" size={18} />
                  <Text style={styles.diagnoseBtnText}>بدء التشخيص الآن</Text>
                </>
              )}
            </TouchableOpacity>

            {diagnosisResult && (
              <View style={[styles.resultBox, { backgroundColor: colors.inputBg, borderColor: colors.primary }]}>
                <View style={styles.resultHeader}>
                  <ShieldCheck color={colors.success} size={20} />
                  <Text style={[styles.resultSpecialty, { color: colors.text }]}>التخصص المطلوب: {diagnosisResult.specialty}</Text>
                  {diagnosisResult.confidence > 0 && (
                    <Text style={[styles.resultConfidence, { color: colors.subtext }]}>
                      دقة {Math.round(diagnosisResult.confidence * 100)}%
                    </Text>
                  )}
                </View>
                <Text style={[styles.resultSummary, { color: colors.subtext }]}>{diagnosisResult.summary}</Text>
                <TouchableOpacity style={[styles.createOrderBtn, { backgroundColor: colors.success }]} onPress={createOrderFromDiagnosis}>
                  <Text style={styles.createOrderBtnText}>إنشاء الطلب وتوجيهه للفنيين</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerUserText: { alignItems: 'flex-end' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  brandText: { fontFamily: 'Cairo-Bold', fontSize: 12 },
  greeting: { fontFamily: 'Cairo-Regular', fontSize: 13 },
  userName: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  searchBox: { flexDirection: 'row-reverse', alignItems: 'center', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 6 },
  searchInput: { flex: 1, fontFamily: 'Cairo-Regular', fontSize: 14, paddingVertical: 6 },
  scrollView: { flex: 1 },
  body: { padding: 16, paddingBottom: 40 },
  promoBanner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1 },
  offerBanner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  promoTitle: { fontFamily: 'Cairo-Bold', fontSize: 14, textAlign: 'right' },
  promoDesc: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2, textAlign: 'right' },
  aiDiagnosisBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16, marginBottom: 20 },
  aiDiagnosisTitle: { fontFamily: 'Cairo-Bold', fontSize: 15, color: '#fff', textAlign: 'right' },
  aiDiagnosisDesc: { fontFamily: 'Cairo-Regular', fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2, textAlign: 'right' },
  sectionTitle: { fontFamily: 'Cairo-SemiBold', fontSize: 17, marginBottom: 12, textAlign: 'right' },
  categoriesScroll: { marginBottom: 20, marginHorizontal: -16, paddingHorizontal: 16 },
  categoryChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, marginLeft: 8 },
  categoryText: { fontFamily: 'Cairo-Medium', fontSize: 13 },
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  serviceCard: { width: '48%', flexGrow: 1, borderRadius: 18, padding: 14, borderWidth: 1, elevation: 2 },
  serviceIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10, alignSelf: 'flex-end' },
  serviceName: { fontFamily: 'Cairo-SemiBold', fontSize: 14, marginBottom: 4, textAlign: 'right' },
  servicePrice: { fontFamily: 'Cairo-Regular', fontSize: 12, marginBottom: 8, textAlign: 'right' },
  warrantyBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 10, alignSelf: 'flex-end' },
  warrantyText: { fontFamily: 'Cairo-Medium', fontSize: 11 },
  orderBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  orderBtnText: { fontFamily: 'Cairo-Medium', fontSize: 12 },
  emptyText: { fontFamily: 'Cairo-Regular', fontSize: 14, textAlign: 'center', marginVertical: 30 },
  techsScroll: { marginBottom: 10 },
  techCard: { width: 135, borderRadius: 18, padding: 12, marginLeft: 12, alignItems: 'center', borderWidth: 1 },
  techAvatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  techInitial: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  techName: { fontFamily: 'Cairo-SemiBold', fontSize: 13, marginBottom: 2, textAlign: 'center' },
  techSpecialty: { fontFamily: 'Cairo-Regular', fontSize: 11, marginBottom: 6, textAlign: 'center' },
  techInfo: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  techRating: { fontFamily: 'Cairo-Medium', fontSize: 12 },
  techDist: { fontFamily: 'Cairo-Regular', fontSize: 11, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  modalClose: { fontFamily: 'Cairo-Medium', fontSize: 14 },
  modalLabel: { fontFamily: 'Cairo-Medium', fontSize: 14, marginBottom: 8, textAlign: 'right' },
  diagnosisInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Cairo-Regular', fontSize: 14, borderWidth: 1, minHeight: 90, marginBottom: 14 },
  diagnoseBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12 },
  submitBtnDisabled: { opacity: 0.6 },
  diagnoseBtnText: { fontFamily: 'Cairo-Bold', fontSize: 14, color: '#fff' },
  resultBox: { borderRadius: 14, padding: 14, marginTop: 14, borderWidth: 1 },
  resultHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 8 },
  resultSpecialty: { flex: 1, fontFamily: 'Cairo-Bold', fontSize: 14, textAlign: 'right' },
  resultConfidence: { fontFamily: 'Cairo-Regular', fontSize: 11 },
  resultSummary: { fontFamily: 'Cairo-Regular', fontSize: 13, lineHeight: 20, marginBottom: 12, textAlign: 'right' },
  createOrderBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  createOrderBtnText: { fontFamily: 'Cairo-Bold', fontSize: 13, color: '#fff' },
});