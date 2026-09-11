import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { ActivityIndicator, View, Platform } from 'react-native';
import { Home, ClipboardList, User, Wallet, LayoutDashboard, LifeBuoy } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const theme = useTheme();

  // قراءة آمنة للبيانات لتجنب الانهيار
  const session = auth?.session;
  const profile = auth?.profile;
  const loading = auth?.loading;
  const colors = theme?.colors;

  // 1. أثناء التحميل الأولي
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors?.bg || '#ffffff' }}>
        <ActivityIndicator size="large" color={colors?.primary || '#2563eb'} />
      </View>
    );
  }

  // 2. إذا لا توجد جلسة، التوجيه لصفحة الدخول
  if (!session) {
    return <Redirect href="/(auth)/" />;
  }

  // تحديد نوع الحساب بأمان
  const role = (profile?.role || 'customer').toLowerCase();

  // قائمة جميع الصفحات الموجودة في مجلد (tabs)
  const ALL_TAB_NAMES = [
    'index', 
    'orders', 
    'wallet-tab', 
    'support-tab', 
    'profile', 
    'admin', 
    'ledger'
  ];

  // دالة تحديد خيارات كل شاشة بناءً على الدور
  const getTabConfig = (name: string) => {
    if (role === 'technician') {
      switch (name) {
        case 'index': return { title: 'الرئيسية', icon: Home, show: true };
        case 'orders': return { title: 'الطلبات', icon: ClipboardList, show: true };
        case 'wallet-tab': return { title: 'المحفظة', icon: Wallet, show: true };
        case 'support-tab': return { title: 'الدعم', icon: LifeBuoy, show: true };
        case 'profile': return { title: 'حسابي', icon: User, show: true };
      }
    } else if (role === 'admin') {
      switch (name) {
        case 'index': return { title: 'الرئيسية', icon: LayoutDashboard, show: true };
        case 'orders': return { title: 'الطلبات', icon: ClipboardList, show: true };
        case 'support-tab': return { title: 'الدعم', icon: LifeBuoy, show: true };
        case 'profile': return { title: 'حسابي', icon: User, show: true };
      }
    } else {
      // حساب الزبون الافتراضي
      switch (name) {
        case 'index': return { title: 'الرئيسية', icon: Home, show: true };
        case 'orders': return { title: 'طلباتي', icon: ClipboardList, show: true };
        case 'support-tab': return { title: 'الدعم', icon: LifeBuoy, show: true };
        case 'profile': return { title: 'حسابي', icon: User, show: true };
      }
    }
    return { title: '', icon: Home, show: false };
  };

  // حساب المساحة السفلية الآمنة لمنع التداخل مع أزرار الهاتف
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 8);
  const calculatedHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors?.primary || '#2563eb',
        tabBarInactiveTintColor: colors?.subtext || '#6b7280',
        tabBarLabelStyle: {
          fontFamily: 'Cairo-Medium',
          fontSize: 11,
          paddingBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: colors?.tabBarBg || '#ffffff',
          borderTopColor: colors?.tabBarBorder || '#e5e7eb',
          borderTopWidth: 1,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          height: calculatedHeight,
        },
      }}
    >
      {ALL_TAB_NAMES.map((name) => {
        const config = getTabConfig(name);
        const IconComponent = config.icon;

        // إخفاء الشاشات التي لا تنتمي لنوع الحساب الحالي
        if (!config.show) {
          return (
            <Tabs.Screen
              key={name}
              name={name}
              options={{ href: null }}
            />
          );
        }

        return (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title: config.title,
              tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                <IconComponent color={color} size={size} />
              ),
            }}
          />
        );
      })}
    </Tabs>
  );
}