import {
  Linking,
  Pressable,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function TabTwoScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const contentPadding = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
    },
    ios: {
      paddingBottom: BottomTabInset + Spacing.four,
    },
    web: {
      paddingTop: Spacing.four,
      paddingBottom: Spacing.four,
    },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, contentPadding]}
      showsVerticalScrollIndicator={false}
    >
      <ThemedView style={styles.container}>
        {/* A little about the app */}
        <View style={styles.hero}>
          <ThemedText type="small" themeColor="textSecondary">
            A PERSONAL PROJECT
          </ThemedText>

          <ThemedText type="title" style={styles.headline}>
            Built to make
            {'\n'}
            <ThemedText style={{ color: theme.tint }}>
              everyday things better.
            </ThemedText>
          </ThemedText>

          <ThemedText themeColor="textSecondary" style={styles.description}>
            A little ESP32-powered controller for music, with a physical
            volume knob and two buttons. Simple hardware, made more useful
            with software.
          </ThemedText>
        </View>

        {/* About me */}
        <View style={[styles.aboutCard, { borderColor: theme.border }]}>
          <ThemedText type="small" themeColor="textSecondary">
            THE PERSON BEHIND IT
          </ThemedText>

          <ThemedText type="title" style={styles.aboutHeading}>
            Hey, I’m Aditya.
          </ThemedText>

          <ThemedText themeColor="textSecondary" style={styles.body}>
            I’m a developer who enjoys exploring technology beyond the
            screen — from software and systems to electronics and hardware.
          </ThemedText>

          <ThemedText themeColor="textSecondary" style={styles.body}>
            I like figuring out how things work, experimenting with ideas,
            and turning them into something real. For me, the fun is not
            just writing code, but seeing what it can do in the physical
            world.
          </ThemedText>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <ThemedText type="defaultSemiBold">
            Things I enjoy building
          </ThemedText>

          <View style={styles.interests}>
            {[
              { icon: 'code', label: 'Software' },
              { icon: 'cpu', label: 'Electronics' },
              { icon: 'network', label: 'Systems' },
              { icon: 'lightbulb', label: 'New ideas' },
            ].map((item) => (
              <View
                key={item.label}
                style={[
                  styles.interest,
                  { borderColor: theme.border },
                ]}
              >
                <SymbolView
                  name={item.icon}
                  size={17}
                  tintColor={theme.tint}
                />
                <ThemedText type="small">{item.label}</ThemedText>
              </View>
            ))}
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <ThemedText type="small" themeColor="textSecondary">
            Designed & developed by Aditya Sharma.
          </ThemedText>
        </View>

        {Platform.OS === 'web' && <WebBadge />}
        <View style={styles.links}>
          <Pressable
            style={styles.link}
            onPress={() => Linking.openURL('http://mraditya.in')}
          >
            <SymbolView name="globe" size={17} tintColor={theme.tint} />
            <ThemedText type="defaultSemiBold">Website</ThemedText>
            <SymbolView
              name="arrow.up.right"
              size={12}
              tintColor={theme.textSecondary}
            />
          </Pressable>

          <Pressable
            style={styles.link}
            onPress={() =>
              Linking.openURL('https://github.com/adityasharma-tech/0xHSC')
            }
          >
            <SymbolView name="chevron.left.forwardslash.chevron.right" size={17} tintColor={theme.tint} />
            <ThemedText type="defaultSemiBold">GitHub repository</ThemedText>
            <SymbolView
              name="arrow.up.right"
              size={12}
              tintColor={theme.textSecondary}
            />
          </Pressable>
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  hero: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  headline: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -1,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 440,
  },
  aboutCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  aboutHeading: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.7,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.one,
  },
  interests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  interest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 100,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  links: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
