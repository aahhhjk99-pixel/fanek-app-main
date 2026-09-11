import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import CustomerHome from '@/components/CustomerHome';
import TechnicianHome from '@/components/TechnicianHome';
import AdminHome from '@/components/AdminHome';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';

export default function HomeScreen() {
  const { profile, loading } = useAuth();
  const { colors, isDark } = useTheme();

  // لون التحميل الذهبي الثابت ليتناسب مع الهوية في الوضعين
  const goldColor = '#D4AF37';

  if (loading || !profile) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <StatusBar 
          barStyle={isDark ? 'light-content' : 'dark-content'} 
          backgroundColor={colors.bg} 
        />
        <ActivityIndicator size="large" color={colors.primary || goldColor} />
      </View>
    );
  }

  // التوجيه بناءً على دور المستخدم
  switch (profile.role) {
    case 'customer':
      return <CustomerHome />;
    case 'technician':
      return <TechnicianHome />;
    case 'admin':
      return <AdminHome />;
    default:
      return <CustomerHome />;
  }
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});