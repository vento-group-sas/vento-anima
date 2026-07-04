import { useEffect, useMemo, useRef } from "react"
import { StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"

import { ANIMA_BRAND } from "@/brand/anima/config/app-brand"
import { AnimaLogo } from "@/components/anima-logo"
import { COLORS } from "@/constants/colors"

type SplashScreenProps = {
  isAppReady: boolean
  minDurationMs?: number
  onFinish: () => void
}

type GridDot = { id: string; x: number; y: number }

const DOT_SPACING = 28
const DOT_SIZE = 2
const ENTRY_DURATION_MS = 560
const EXIT_DURATION_MS = 360
const MIN_DURATION_DEFAULT_MS = 3500
const RING_DURATION_MS = 5200
const DOT_PULSE_MS = 380
const DOT_DELAY_MS = 200

const RING_SIZE = 172
const RING_BORDER = 2
const MEDALLION_SIZE = 116

export default function SplashScreen({ isAppReady, minDurationMs, onFinish }: SplashScreenProps) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const minDuration = Math.max(0, minDurationMs ?? MIN_DURATION_DEFAULT_MS)

  const isReadyRef = useRef(isAppReady)
  const minDoneRef = useRef(false)
  const exitStartedRef = useRef(false)
  const finishCalledRef = useRef(false)
  const finishRef = useRef(onFinish)

  useEffect(() => {
    isReadyRef.current = isAppReady
  }, [isAppReady])

  useEffect(() => {
    finishRef.current = onFinish
  }, [onFinish])

  const dots = useMemo<GridDot[]>(() => {
    const list: GridDot[] = []
    const offset = DOT_SPACING / 2
    const cols = Math.ceil(width / DOT_SPACING)
    const rows = Math.ceil(height / DOT_SPACING)

    for (let row = 0; row <= rows; row += 1) {
      for (let col = 0; col <= cols; col += 1) {
        list.push({
          id: `d-${row}-${col}`,
          x: col * DOT_SPACING + offset,
          y: row * DOT_SPACING + offset,
        })
      }
    }
    return list
  }, [width, height])

  const contentOpacity = useSharedValue(0)
  const contentScale = useSharedValue(0.96)
  const ringRotate = useSharedValue(0)
  const dot1 = useSharedValue(0)
  const dot2 = useSharedValue(0)
  const dot3 = useSharedValue(0)

  const triggerExit = () => {
    if (exitStartedRef.current) return
    if (!isReadyRef.current || !minDoneRef.current) return

    exitStartedRef.current = true

    const finishOnce = () => {
      if (finishCalledRef.current) return
      finishCalledRef.current = true
      finishRef.current()
    }

    contentOpacity.value = withTiming(0, {
      duration: EXIT_DURATION_MS,
      easing: Easing.in(Easing.cubic),
    })
    contentScale.value = withTiming(
      0.98,
      { duration: EXIT_DURATION_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishOnce)()
      },
    )

    setTimeout(finishOnce, EXIT_DURATION_MS + 250)
  }

  useEffect(() => {
    contentOpacity.value = withTiming(1, {
      duration: ENTRY_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    })
    contentScale.value = withTiming(1, {
      duration: ENTRY_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    })

    ringRotate.value = withRepeat(
      withTiming(360, { duration: RING_DURATION_MS, easing: Easing.linear }),
      -1,
      false,
    )

    const pulse = (delayMs: number) =>
      withDelay(
        delayMs,
        withRepeat(
          withSequence(
            withTiming(1, { duration: DOT_PULSE_MS, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: DOT_PULSE_MS, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        ),
      )

    dot1.value = pulse(0)
    dot2.value = pulse(DOT_DELAY_MS)
    dot3.value = pulse(DOT_DELAY_MS * 2)

    return () => {
      cancelAnimation(ringRotate)
      cancelAnimation(dot1)
      cancelAnimation(dot2)
      cancelAnimation(dot3)
    }
  }, [contentOpacity, contentScale, ringRotate, dot1, dot2, dot3])

  useEffect(() => {
    const timer = setTimeout(() => {
      minDoneRef.current = true
      triggerExit()
    }, minDuration)

    return () => clearTimeout(timer)
  }, [minDuration])

  useEffect(() => {
    if (!isAppReady) return
    triggerExit()
  }, [isAppReady])

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }))

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotate.value}deg` }],
  }))

  const dotActiveStyle1 = useAnimatedStyle(() => ({
    opacity: dot1.value,
    transform: [{ scale: 0.95 + dot1.value * 0.05 }],
  }))
  const dotActiveStyle2 = useAnimatedStyle(() => ({
    opacity: dot2.value,
    transform: [{ scale: 0.95 + dot2.value * 0.05 }],
  }))
  const dotActiveStyle3 = useAnimatedStyle(() => ({
    opacity: dot3.value,
    transform: [{ scale: 0.95 + dot3.value * 0.05 }],
  }))

  const cornerOffset = 18
  const cornerTop = insets.top + cornerOffset
  const cornerBottom = insets.bottom + cornerOffset

  return (
    <View style={styles.root}>
      <View style={styles.background} pointerEvents="none">
        {dots.map((dot) => (
          <View key={dot.id} style={[styles.gridDot, { left: dot.x, top: dot.y }]} />
        ))}

        <View style={[styles.corner, styles.cornerTL, { top: cornerTop, left: cornerOffset }]} />
        <View style={[styles.corner, styles.cornerTR, { top: cornerTop, right: cornerOffset }]} />
        <View style={[styles.corner, styles.cornerBL, { bottom: cornerBottom, left: cornerOffset }]} />
        <View style={[styles.corner, styles.cornerBR, { bottom: cornerBottom, right: cornerOffset }]} />
      </View>

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <Animated.View style={[styles.content, contentStyle]}>
          <View style={styles.emblemWrap}>
            <Animated.View style={[styles.ring, ringStyle]} />
            <View style={styles.medallion}>
              <View style={styles.medallionHighlight} />
              <AnimaLogo size={72} tintColor={COLORS.porcelain} />
            </View>
          </View>

          <Text style={styles.title}>{ANIMA_BRAND.appName}</Text>

          <View style={styles.subtitleRow}>
            <View style={styles.subtitleLine} />
            <Text style={styles.subtitle}>{ANIMA_BRAND.welcomeLabel}</Text>
            <View style={styles.subtitleLine} />
          </View>

          <View style={styles.dotsRow}>
            <View style={styles.dotShell}>
              <View style={styles.dotInactive} />
              <Animated.View style={[styles.dotActive, dotActiveStyle1]} />
            </View>
            <View style={styles.dotShell}>
              <View style={styles.dotInactive} />
              <Animated.View style={[styles.dotActive, dotActiveStyle2]} />
            </View>
            <View style={styles.dotShell}>
              <View style={styles.dotInactive} />
              <Animated.View style={[styles.dotActive, dotActiveStyle3]} />
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.footer, { bottom: insets.bottom + 18 }, contentStyle]}>
          <Text style={styles.footerText}>{ANIMA_BRAND.companyFooter}</Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
  },
  safe: {
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.porcelain,
  },
  gridDot: {
    position: "absolute",
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: "rgba(230, 225, 234, 0.35)",
  },
  corner: {
    position: "absolute",
    width: 76,
    height: 76,
    borderColor: "rgba(183, 110, 121, 0.3)",
  },
  cornerTL: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopLeftRadius: 18,
  },
  cornerTR: {
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderTopRightRadius: 18,
  },
  cornerBL: {
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderBottomLeftRadius: 18,
  },
  cornerBR: {
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderBottomRightRadius: 18,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -24,
  },
  emblemWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_BORDER,
    borderStyle: "dotted",
    borderColor: "rgba(183, 110, 121, 0.55)",
    shadowColor: COLORS.accentViolet,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  medallion: {
    width: MEDALLION_SIZE,
    height: MEDALLION_SIZE,
    borderRadius: MEDALLION_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 8,
    overflow: "hidden",
  },
  medallionHighlight: {
    position: "absolute",
    width: MEDALLION_SIZE * 0.7,
    height: MEDALLION_SIZE * 0.7,
    borderRadius: MEDALLION_SIZE * 0.35,
    top: -10,
    left: -10,
    backgroundColor: "rgba(242, 198, 192, 0.14)",
  },
  title: {
    marginTop: 18,
    fontSize: 34,
    fontWeight: "600",
    letterSpacing: 7,
    color: COLORS.text,
  },
  subtitleRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  subtitleLine: {
    width: 46,
    height: 1,
    backgroundColor: COLORS.border,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    color: COLORS.neutral,
  },
  dotsRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
  },
  dotShell: {
    width: 7,
    height: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  dotInactive: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "rgba(230, 225, 234, 0.8)",
  },
  dotActive: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.accent,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  footerText: {
    fontSize: 11,
    color: COLORS.neutral,
  },
})
