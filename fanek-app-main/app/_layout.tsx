import { useEffect } from 'react';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/lib/theme-context';
import { ToastProvider } from '@/lib/toast';
import { I18nManager, ActivityIndicator, View, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from '@expo-google-fonts/cairo';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '@/lib/supabase';
import { registerForPushNotificationsAsync } from '@/lib/notifications';

// تفعيل اتجاه اللغة العربية
try {
  if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  }
} catch (e) {
  console.log('RTL Error:', e);
}

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  useFrameworkReady();

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

  // تسجيل الإشعارات بطريقة آمنة لا تسبب شاشة بيضاء في حال الفشل
  useEffect(() => {
    let listener: any;

    const setupNotifications = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) {
          await registerForPushNotificationsAsync(data.user.id);
        }

        const authListener = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user?.id) {
            registerForPushNotificationsAsync(session.user.id).catch(() => {});
          }
        });
        listener = authListener.data?.subscription;
      } catch (err) {
        console.log('Notification setup skipped or failed:', err);
      }
    };

    setupNotifications();

    return () => {
      if (listener) listener.unsubscribe();
    };
  }, []);

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
          {Platform.OS === 'web' && (
            <Head>
              <link rel="apple-touch-icon" href="./assets/images/icon.png" />
              <link rel="icon" href="./assets/images/favicon.png" />
            </Head>
          )}
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