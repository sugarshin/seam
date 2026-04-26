import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import type { SaleInfo } from '@seam/shared';
import { Button } from './Button';
import { TextField } from './TextField';
import { colors, font, radii, space } from '../theme';

export type SaleInfoDraft = Omit<SaleInfo, 'itemId'>;

type Props = {
  visible: boolean;
  submitting?: boolean;
  initial?: SaleInfoDraft | null;
  onCancel: () => void;
  onSubmit: (draft: SaleInfoDraft) => void;
};

const todayIsoDate = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const isValidDate = (s: string): boolean => {
  if (s.trim() === '') return true; // optional
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
};

const parsePriceInput = (raw: string): number | undefined => {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
};

export const SaleInfoModal = ({
  visible,
  submitting,
  initial,
  onCancel,
  onSubmit,
}: Props) => {
  const [soldPrice, setSoldPrice] = useState('');
  const [soldAt, setSoldAt] = useState('');
  const [soldSource, setSoldSource] = useState('');
  const [notes, setNotes] = useState('');
  const [priceError, setPriceError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!visible) return;
    setSoldPrice(initial?.soldPrice !== undefined ? String(initial.soldPrice) : '');
    // soldAt may be ISO datetime; show date portion if so for easier editing.
    const at = initial?.soldAt ?? '';
    setSoldAt(at === '' ? todayIsoDate() : at.slice(0, 10));
    setSoldSource(initial?.soldSource ?? '');
    setNotes(initial?.notes ?? '');
    setPriceError(undefined);
  }, [visible, initial]);

  const dateValid = isValidDate(soldAt);

  const handleSubmit = (): void => {
    if (soldPrice.trim() !== '' && parsePriceInput(soldPrice) === undefined) {
      setPriceError('数値で入力してください');
      return;
    }
    if (!dateValid) return;
    const trimmedSource = soldSource.trim();
    const trimmedNotes = notes.trim();
    onSubmit({
      soldPrice: parsePriceInput(soldPrice),
      soldAt:
        soldAt.trim() === '' ? undefined : new Date(soldAt).toISOString(),
      soldSource: trimmedSource === '' ? undefined : trimmedSource,
      notes: trimmedNotes === '' ? undefined : trimmedNotes,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={overlay}
      >
        <Pressable style={backdrop} onPress={onCancel} />
        <View style={card}>
          <Text style={title}>売却情報</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
            <TextField
              label="売却価格（円）"
              placeholder="3000"
              value={soldPrice}
              onChangeText={(v) => {
                setSoldPrice(v);
                setPriceError(undefined);
              }}
              keyboardType="number-pad"
              error={priceError}
            />
            <TextField
              label="売却日"
              placeholder="2026-04-26"
              value={soldAt}
              onChangeText={setSoldAt}
              autoCapitalize="none"
              error={dateValid ? undefined : '日付の形式が不正です'}
              hint="例: 2026-04-26（空欄も可）"
            />
            <TextField
              label="販売元"
              placeholder="メルカリ / 古着屋 / 友人 など"
              value={soldSource}
              onChangeText={setSoldSource}
            />
            <TextField
              label="メモ（任意）"
              multiline
              placeholder="購入者・状態・送料負担など"
              value={notes}
              onChangeText={setNotes}
            />
          </ScrollView>
          <View style={actions}>
            <Button label="キャンセル" variant="ghost" onPress={onCancel} />
            <Button label="保存" onPress={handleSubmit} loading={submitting} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const overlay: ViewStyle = {
  flex: 1,
  justifyContent: 'flex-end',
};

const backdrop: ViewStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.4)',
};

const card: ViewStyle = {
  backgroundColor: colors.bg,
  borderTopLeftRadius: radii.lg,
  borderTopRightRadius: radii.lg,
  padding: space.lg,
  gap: space.sm,
};

const title = {
  fontSize: font.size.lg,
  fontWeight: font.weight.bold,
  color: colors.text,
  marginBottom: space.sm,
} as const;

const actions: ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'flex-end',
  gap: space.sm,
  marginTop: space.md,
};
