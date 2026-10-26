import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Path, Text } from "react-native-svg";

interface Props {
  value: number;
  color: string;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function GaugeComp({ value, color }: Props) {

  const animatedValue = useRef(new Animated.Value(value)).current;
   const previousValue = useRef(value);

   useEffect(() => {
     if (previousValue.current === value) return;

     previousValue.current = value;

     animatedValue.stopAnimation();

     Animated.timing(animatedValue, {
       toValue: Math.max(0, Math.min(100, value)),
       duration: 600,
       easing: Easing.out(Easing.cubic),
       useNativeDriver: false,
     }).start();
   }, [value, animatedValue]);

   const strokeDasharray = animatedValue.interpolate({
     inputRange: [0, 100],
     outputRange: ["0 119", "119 119"],
     extrapolate: "clamp",
   });



  return (
    <Svg width="200" height="200" viewBox="0 0 100 80">
      {/* Background path (grey arc) */}
      <Path
        d="M22.37 60.987a30.3 30.3 0 0 1-2.357-11.76C20.013 32.54 33.44 19.012 50 19.012S79.987 32.54 79.987 49.226c0 4.172-.84 8.146-2.357 11.76"
        fill="none"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="#3a393e"
      />
      <Text
        x="50"
        y="60"
        textAnchor="middle"
        alignmentBaseline="middle"
        fill="none"
        stroke="#fff"
      >
        {String(value)}
      </Text>
      <AnimatedPath
        d="M22.37 60.987a30.3 30.3 0 0 1-2.357-11.76C20.013 32.54 33.44 19.012 50 19.012S79.987 32.54 79.987 49.226c0 4.172-.84 8.146-2.357 11.76"
        strokeDasharray={strokeDasharray}
        fill="none"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke={color}
      />
    </Svg>
  );
}
