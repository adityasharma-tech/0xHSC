import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedIcon } from '@/components/animated-icon';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  Box,
  HorizontalFloatingToolbar,
  Host,
  Icon,
  IconButton,
} from '@expo/ui/jetpack-compose';
import {
  align,
  fillMaxSize,
  offset,
  size,
} from '@expo/ui/jetpack-compose/modifiers';
import GaugeComp from '@/components/gauge';


export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedView style={{
            flex: 1,
            justifyContent: 'center',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <View style={{flex: 1}}/>
            <GaugeComp value={50} color='#fff'/>
          <ThemedView style={{
            flexDirection: 'row',
            flex: 1
          }}>
          <FloatingToolbarExample />
          </ThemedView>
          </ThemedView>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

function FloatingToolbarExample() {
  return (
    <Host style={styles.host}>
      <Box
        modifiers={[fillMaxSize()]}
        floatingToolbarExitAlwaysScrollBehavior="bottom">
        <HorizontalFloatingToolbar
          variant="vibrant"
          modifiers={[align('bottomCenter'), offset(0, -16)]}>
          <IconButton modifiers={[size(68, 60)]} onClick={() => console.log('Play/Pause pressed')}>
            <Icon size={56} source={require('../../assets/images/play_pause.png')} />
          </IconButton>
          <HorizontalFloatingToolbar.FloatingActionButton
            onPress={() => console.log('Next pressed')}>
            <Icon size={36} source={require('../../assets/images/skip_next.png')} />
          </HorizontalFloatingToolbar.FloatingActionButton>
        </HorizontalFloatingToolbar>
      </Box>
    </Host>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    padding: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    flex: 1
  },
  host: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
  },
});
