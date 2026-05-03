import { useCallback, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StatusBar,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, space } from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

type Props = {
  visible: boolean;
  uris: readonly string[];
  initialIndex?: number;
  onRequestClose: () => void;
};

export const ImageViewerModal = ({ visible, uris, initialIndex = 0, onRequestClose }: Props) => {
  const insets = useSafeAreaInsets();
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
      const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
      if (i !== activeIndex) setActiveIndex(i);
    },
    [activeIndex],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<string>) => (
      <ZoomableImage uri={item} onZoomChange={setScrollEnabled} />
    ),
    [],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={backdrop}>
          {visible && (
            <FlatList
              key={`${initialIndex}-${uris.length}`}
              data={uris as string[]}
              keyExtractor={(uri, i) => `${i}-${uri}`}
              horizontal
              pagingEnabled
              scrollEnabled={scrollEnabled}
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={initialIndex}
              getItemLayout={(_, index) => ({
                length: SCREEN_W,
                offset: SCREEN_W * index,
                index,
              })}
              onScroll={onScroll}
              scrollEventThrottle={16}
              renderItem={renderItem}
            />
          )}
          {uris.length > 1 && (
            <View style={[counter, { top: insets.top + space.sm }]} pointerEvents="none">
              <Text style={counterText}>
                {activeIndex + 1} / {uris.length}
              </Text>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="閉じる"
            onPress={onRequestClose}
            hitSlop={12}
            style={[closeBtn, { top: insets.top + space.sm }]}
          >
            <Text style={closeMark}>×</Text>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

type ZoomableImageProps = {
  uri: string;
  onZoomChange: (canScroll: boolean) => void;
};

const ZoomableImage = ({ uri, onZoomChange }: ZoomableImageProps) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * e.scale));
      scale.value = next;
    })
    .onEnd(() => {
      if (scale.value < 1.01) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(onZoomChange)(true);
      } else {
        savedScale.value = scale.value;
        runOnJS(onZoomChange)(false);
      }
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .minPointers(1)
    .maxPointers(2)
    .onUpdate((e) => {
      if (savedScale.value <= 1.01) return;
      const maxX = (SCREEN_W * (savedScale.value - 1)) / 2;
      const maxY = (SCREEN_H * (savedScale.value - 1)) / 2;
      const nextX = savedTranslateX.value + e.translationX;
      const nextY = savedTranslateY.value + e.translationY;
      translateX.value = Math.min(maxX, Math.max(-maxX, nextX));
      translateY.value = Math.min(maxY, Math.max(-maxY, nextY));
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd(() => {
      if (savedScale.value > 1.01) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(onZoomChange)(true);
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
        runOnJS(onZoomChange)(false);
      }
    });

  const composed = Gesture.Simultaneous(Gesture.Race(doubleTap, pinch), pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={page}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[pageInner, animatedStyle]}>
          <Image source={{ uri }} resizeMode="contain" style={image} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const backdrop: ViewStyle = {
  flex: 1,
  backgroundColor: '#000000',
};

const page: ViewStyle = {
  width: SCREEN_W,
  height: SCREEN_H,
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
};

const pageInner: ViewStyle = {
  width: SCREEN_W,
  height: SCREEN_H,
  alignItems: 'center',
  justifyContent: 'center',
};

const image = {
  width: SCREEN_W,
  height: SCREEN_H,
} as const;

const closeBtn: ViewStyle = {
  position: 'absolute',
  right: space.lg,
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: 'rgba(0,0,0,0.55)',
  alignItems: 'center',
  justifyContent: 'center',
};

const closeMark = {
  color: '#FFFFFF',
  fontSize: 26,
  lineHeight: 28,
  fontWeight: font.weight.semibold,
} as const;

const counter: ViewStyle = {
  position: 'absolute',
  alignSelf: 'center',
  paddingHorizontal: space.md,
  paddingVertical: 4,
  borderRadius: 12,
  backgroundColor: 'rgba(0,0,0,0.55)',
};

const counterText = {
  color: '#FFFFFF',
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
} as const;
