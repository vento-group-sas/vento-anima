import { useEffect, useMemo, useRef, useState } from "react";
import Constants from "expo-constants";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import type { TextInput as RNTextInput } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { COLORS } from "@/constants/colors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { getUserFacingAuthError } from "@/utils/error-messages";
import LoginBackground from "@/components/auth/login/LoginBackground";
import LoginHeader from "@/components/auth/login/LoginHeader";
import LoginForm from "@/components/auth/login/LoginForm";
import { createStarField } from "@/components/auth/login/starfield";
import { ANIMA_RUNTIME } from "@/brand/anima/config/runtime";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const qaEndpoint = useMemo(() => {
    if (!__DEV__ || Constants.expoConfig?.extra?.appVariant !== "development") return null;
    const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!configuredUrl) {
      return { label: "QA • Falta configurar Supabase", qaLocalRoute: false };
    }
    try {
      const url = new URL(configuredUrl);
      const port = url.port || (url.protocol === "https:" ? "443" : "80");
      // Perfil QA GAP-PKG-004: unico puerto aislado; Android usa 10.0.2.2 o ADB reverse.
      const qaLocalRoute = url.protocol === "http:" && port === "23151" &&
        ["10.0.2.2", "127.0.0.1", "localhost"].includes(url.hostname) &&
        !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
      if (qaLocalRoute) {
        return { label: `QA • API ${url.hostname}:${port} (HTTP sin verificar)`, qaLocalRoute: true };
      }
      return { label: "QA • API fuera del perfil local aislado", qaLocalRoute: false };
    } catch {
      return { label: "QA • URL de Supabase inválida", qaLocalRoute: false };
    }
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const [qaHttpHealth, setQaHttpHealth] = useState<"REACHABLE" | "UNAVAILABLE" | null>(null);

  // Development-only read-only probe from Android, not from the Windows host.
  // A configured API URL alone cannot attest an actual HTTP response.
  useEffect(() => {
    if (!qaEndpoint?.qaLocalRoute) return;
    const apiUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const publicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!apiUrl || !publicKey) {
      setQaHttpHealth("UNAVAILABLE");
      return;
    }
    const controller = new AbortController();
    let mounted = true;
    const timeout = setTimeout(() => controller.abort(), 8000);
    void fetch(`${apiUrl.replace(/\/+$/u, "")}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: publicKey, Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return false;
        const payload: unknown = await response.json();
        return typeof payload === "object" && payload !== null &&
          (payload as { name?: unknown }).name === "GoTrue";
      })
      .then((verified) => {
        if (mounted) setQaHttpHealth(verified ? "REACHABLE" : "UNAVAILABLE");
      })
      .catch(() => {
        if (mounted) setQaHttpHealth("UNAVAILABLE");
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      mounted = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [qaEndpoint?.qaLocalRoute]);

  const passwordRef = useRef<RNTextInput>(null);
  const loginInFlightRef = useRef(false);

  const { width: W, height: H } = Dimensions.get("window");

  const stars = useMemo(() => createStarField(2026, W, H), [W, H]);

  const headerOpacity = useSharedValue(0);
  const headerTranslateY = useSharedValue(14);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(22);
  const scanOpacity = useSharedValue(0);
  const scanTranslateY = useSharedValue(-120);

  useEffect(() => {
    headerOpacity.value = withTiming(1, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
    headerTranslateY.value = withTiming(0, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });

    cardOpacity.value = withDelay(
      120,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
    cardTranslateY.value = withDelay(
      120,
      withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );

    scanOpacity.value = withDelay(300, withTiming(0.08, { duration: 300 }));
    scanTranslateY.value = withDelay(
      300,
      withRepeat(
        withTiming(H + 120, { duration: 5200, easing: Easing.linear }),
        -1,
        false,
      ),
    );

    return () => {
      cancelAnimation(scanTranslateY);
    };
  }, [H, headerOpacity, headerTranslateY, cardOpacity, cardTranslateY, scanOpacity, scanTranslateY]);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const scanStyle = useAnimatedStyle(() => ({
    opacity: scanOpacity.value,
    transform: [{ translateY: scanTranslateY.value }],
  }));

  const getRateLimitCooldownSeconds = (error: unknown): number => {
    const anyErr = error as any;
    const explicitRetry = Number(anyErr?.retry_after_seconds);
    if (Number.isFinite(explicitRetry) && explicitRetry > 0) {
      return Math.ceil(explicitRetry);
    }
    const status = anyErr?.status;
    const message = String(anyErr?.message ?? "").toLowerCase();
    const code = String(anyErr?.code ?? "").toLowerCase();

    const isRateLimit =
      status === 429 ||
      message.includes("rate limit") ||
      message.includes("too many") ||
      code.includes("over_request_rate_limit");

    if (!isRateLimit) return 0;

    const secondsMatch = message.match(/(\d+)\s*(seconds|second|secs|sec|s)\b/);
    if (secondsMatch) {
      return Math.max(15, Number(secondsMatch[1]));
    }

    const minutesMatch = message.match(/(\d+)\s*(minutes|minute|mins|min|m)\b/);
    if (minutesMatch) {
      return Math.max(30, Number(minutesMatch[1]) * 60);
    }

    return 60;
  };

  useEffect(() => {
    if (retryAfterSeconds <= 0) return;
    const timer = setInterval(() => {
      setRetryAfterSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAfterSeconds]);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || loading || loginInFlightRef.current || retryAfterSeconds > 0) {
      return;
    }
    if (qaEndpoint && trimmedEmail.toLowerCase().endsWith("@example.invalid") &&
        (!qaEndpoint.qaLocalRoute || qaHttpHealth !== "REACHABLE")) {
      setErrorMsg("QA: GoTrue del entorno aislado no respondió desde Android. No se enviaron credenciales.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setErrorMsg("Escribe un correo válido.");
      return;
    }
    loginInFlightRef.current = true;
    setLoading(true);
    setErrorMsg(null);

    try {
      await signIn(trimmedEmail, password);
    } catch (e: any) {
      const cooldown = getRateLimitCooldownSeconds(e);
      if (cooldown > 0) {
        setRetryAfterSeconds((prev) => Math.max(prev, cooldown));
      }
      setErrorMsg(
        getUserFacingAuthError(
          e,
          "No pudimos iniciar sesión. Intenta nuevamente.",
        ),
      );
    } finally {
      loginInFlightRef.current = false;
      setLoading(false);
    }
  };

  const canSubmit = !!email && !!password && !loading;
  const Container: any = KeyboardAvoidingView;
  const containerProps = {
    behavior: Platform.OS === "ios" ? "padding" : "height",
    keyboardVerticalOffset: 0,
    style: styles.root,
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (errorMsg) setErrorMsg(null);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (errorMsg) setErrorMsg(null);
  };

  // Reset password debe llevar a la web de crear contraseña, no al deep link de la app
  const authRedirectUrl = ANIMA_RUNTIME.authRedirectUrl;

  const handleForgotPassword = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg("Escribe tu correo para enviarte el enlace.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setErrorMsg("Escribe un correo válido.");
      return;
    }
    setErrorMsg(null);
    supabase.auth
      .resetPasswordForEmail(trimmedEmail, { redirectTo: authRedirectUrl })
      .then(({ error }) => {
        if (error) {
          Alert.alert(
            "Enlace de contraseña",
            getUserFacingAuthError(
              error,
              "No se pudo enviar el enlace. Intenta nuevamente.",
            ),
          );
          return;
        }
        Alert.alert(
          "Revisa tu correo",
          "Te enviamos un enlace para crear una nueva contraseña. Ábrelo en este dispositivo para continuar.",
        );
      });
  };

  return (
    <Container {...containerProps}>
      <LoginBackground stars={stars} scanStyle={scanStyle} />

      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={headerStyle}>
          <LoginHeader />
        </Animated.View>

        <LoginForm
          email={email}
          password={password}
          showPassword={showPassword}
          loading={loading}
          errorMsg={errorMsg}
          canSubmit={canSubmit}
          passwordRef={passwordRef}
          cardStyle={cardStyle}
          onEmailChange={handleEmailChange}
          onPasswordChange={handlePasswordChange}
          onToggleShowPassword={() => setShowPassword((v) => !v)}
          onSubmit={handleLogin}
          onForgotPasswordPress={handleForgotPassword}
        />
        {qaEndpoint ? (
          <>
            <Text style={styles.qaEndpointLabel}>{qaEndpoint.label}</Text>
            {qaEndpoint.qaLocalRoute ? (
              <Text style={styles.qaEndpointLabel}>
                {qaHttpHealth === null
                  ? "QA • HTTP desde Android: comprobando"
                  : qaHttpHealth === "REACHABLE"
                    ? "QA • GoTrue HTTP desde Android: RESPONDIÓ"
                    : "QA • GoTrue HTTP desde Android: SIN RESPUESTA"}
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
  },
  qaEndpointLabel: {
    fontSize: 12,
    textAlign: "center",
    color: COLORS.neutral,
    marginTop: 12,
  },
  page: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 64,
    paddingBottom: 34,
    justifyContent: "center",
  },
});

