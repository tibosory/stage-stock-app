import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

const ICON = require('../../assets/icon.png');

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Logo app : animation douce (respiration + flottement), plus lisible qu'une rotation continue.
 */
export function SplashLoadingLogo({ size = 128, style }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 950,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 950,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();
    floatLoop.start();
    return () => {
      pulseLoop.stop();
      floatLoop.stop();
    };
  }, [pulse, float]);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const rotate = float.interpolate({
    inputRange: [0, 1],
    outputRange: ['-2deg', '2deg'],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.55],
  });

  return (
    <Animated.View
      style={[{ alignItems: 'center', justifyContent: 'center' }, style, { transform: [{ translateY }] }]}
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement en cours"
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: size * 0.92,
          height: size * 0.92,
          borderRadius: size,
          backgroundColor: '#34D399',
          opacity: glowOpacity,
        }}
      />
      <Animated.Image
        source={ICON}
        resizeMode="contain"
        style={{
          width: size,
          height: size,
          transform: [{ rotate }, { scale }],
        }}
      />
    </Animated.View>
  );
}
