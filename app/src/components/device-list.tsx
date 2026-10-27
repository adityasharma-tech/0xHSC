
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ListItem = {
  id: string;
  title: string;
  subtitle?: string;
};

type Props = {
  title?: string;
  items?: ListItem[];
  onSelect?: (item: ListItem) => void;
};

const DEFAULT_ITEMS: ListItem[] = Array.from(
  { length: 30 },
  (_, index) => ({
    id: String(index + 1),
    title: `Item ${index + 1}`,
    subtitle: `Description for item ${index + 1}`,
  })
);

export default function ScrollableListDialog({
  title = 'Select an item',
  items = DEFAULT_ITEMS,
  onSelect,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        style={styles.openButton}
        onPress={() => setVisible(true)}
      >
        <Text style={styles.openButtonText}>Open List</Text>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <SafeAreaView style={styles.dialog}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>

              <Pressable onPress={() => setVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
            </View>

            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              style={styles.list}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={styles.item}
                  onPress={() => {
                    onSelect?.(item);
                    setVisible(false);
                  }}
                >
                  <View style={styles.itemContent}>
                    <Text style={styles.itemTitle}>
                      {item.title}
                    </Text>

                    {item.subtitle && (
                      <Text style={styles.subtitle}>
                        {item.subtitle}
                      </Text>
                    )}
                  </View>
                </Pressable>
              )}
              ItemSeparatorComponent={() => (
                <View style={styles.separator} />
              )}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  openButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  openButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    backgroundColor: '#ffffff',
    width: '100%',
    maxWidth: 440,
    maxHeight: '75%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dddddd',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#171717',
  },
  closeButton: {
    fontSize: 20,
    color: '#666666',
    paddingHorizontal: 4,
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  item: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  itemContent: {
    gap: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#171717',
  },
  subtitle: {
    fontSize: 13,
    color: '#737373',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#eeeeee',
  },
});
