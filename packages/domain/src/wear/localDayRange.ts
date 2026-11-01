export type LocalDayRange = {
  from: string;
  to: string;
};

/**
 * `day` のローカル日付を表す ISO 8601 (UTC) の半開区間 [from, to) を返す。
 * wornAt は toISOString() 形式で保存され、画面ではローカル日付で表示されるので、
 * この区間と文字列比較すれば画面の表示と同じ基準で日付を判定できる。
 */
export const localDayRange = (day: Date): LocalDayRange => ({
  from: new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString(),
  to: new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).toISOString(),
});
