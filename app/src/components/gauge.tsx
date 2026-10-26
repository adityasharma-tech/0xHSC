import { useEffect, useRef } from "react";
import { Alert, Animated } from "react-native";
import Svg, { Path, Text } from "react-native-svg";

interface Props {
  value: number;
  color: string;
}

export default function GaugeComp({ value, color }: Props) {
  const pathRef = useRef<Path>(null);
  const animationValue = useRef(new Animated.Value(0)).current;
  const AnimatedPath = Animated.createAnimatedComponent(Path);

  useEffect(() => {
    const animatePath = () => {
      Animated.loop(
        Animated.timing(animationValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ).start();
    };

    animatePath();

    return () => {
      animationValue.setValue(0);
    };
  }, []);
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
        ref={pathRef}
      />
      <Text
        x="50"
        y="60"
        textAnchor="middle"
        alignmentBaseline="middle"
        fill="none"
        stroke="#fff"
      >
        12
      </Text>
      <AnimatedPath
        d="M22.37 60.987a30.3 30.3 0 0 1-2.357-11.76C20.013 32.54 33.44 19.012 50 19.012S79.987 32.54 79.987 49.226c0 4.172-.84 8.146-2.357 11.76"
        strokeDasharray={animationValue.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: ["0 119", `${(119 * value) / 100} 119`, "0 119"],
        })}
        fill="none"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke={color}
      />
    </Svg>
  );
}
