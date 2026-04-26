import { Text, View, type ViewStyle } from 'react-native';
import { Button } from './Button';
import { colors, font, space } from '../theme';

type Props = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const EmptyState = ({ title, message, actionLabel, onAction }: Props) => {
  return (
    <View style={wrapper}>
      <Text style={titleStyle}>{title}</Text>
      {message !== undefined && message !== '' && <Text style={messageStyle}>{message}</Text>}
      {actionLabel !== undefined && onAction !== undefined && (
        <View style={{ marginTop: space.lg }}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      )}
    </View>
  );
};

const wrapper: ViewStyle = {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: space.xl,
  paddingVertical: space.xxl,
};

const titleStyle = {
  fontSize: font.size.lg,
  fontWeight: font.weight.semibold,
  color: colors.text,
  textAlign: 'center' as const,
} as const;

const messageStyle = {
  marginTop: space.sm,
  fontSize: font.size.sm,
  color: colors.textMuted,
  textAlign: 'center' as const,
  lineHeight: 20,
} as const;
