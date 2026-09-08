import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/lib/theme-context';
import { ToastProvider } from '@/lib/toast';
import { StatusBar } from 'expo-status-bar';
import { I18nManager, ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from '@expo-google-fonts/cairo';

// تفعيل اتجاه RTL للغة العربية
try {
  if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  }
} catch (e) {
  console.log('RTL Error:', e);
}

// منع إخفاء الشاشة المؤقتة بطريقة آمنة
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Cairo-Regular': Cairo_400Regular,
    'Cairo-Medium': Cairo_500Medium,
    'Cairo-SemiBold': Cairo_600SemiBold,
    'Cairo-Bold': Cairo_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="support" />
            <Stack.Screen name="order/[id]" />
            <Stack.Screen name="wallet" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="certificates" />
            <Stack.Screen name="rate-order" />
            <Stack.Screen name="ledger" />
            <Stack.Screen name="dispute/[id]" />
            <Stack.Screen name="admin" />
            <Stack.Screen name="admin/users" />
            <Stack.Screen name="admin/recharges" />
            <Stack.Screen name="admin/disputes" />
            <Stack.Screen name="admin/offers" />
            <Stack.Screen name="admin/services" />
            <Stack.Screen name="admin/financials" />
            <Stack.Screen name="admin/support-config" />
            <Stack.Screen name="admin/notifications" />
            <Stack.Screen name="chat/[orderId]" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <RootStatusBar />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}