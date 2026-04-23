import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

const ICON = require('../../assets/icon.png');

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Logo app (tête de chat) : rotation continue + léger rebond pour les écrans d’attente.
 */
export function SplashLoadingLogo({ size = 128, style }: Props) {
  const rotation = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: 480,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 480,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    spin.start();
    bounceLoop.start();
    return () => {
      spin.stop();
      bounceLoop.stop();
    };
  }, [rotation, bounce]);

  const spinDeg = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const translateY = bounce.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -22],
  });

  return (
    <Animated.View
      style={[{ alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement en cours"
    >
      <Animated.Image
        source={ICON}
        resizeMode="contain"
        style={{
          width: size,
          height: size,
          transform: [{ rotate: spinDeg }, { translateY }],
        }}
      />
    </Animated.View>
  );
}
