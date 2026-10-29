import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { brandOptions } from '@seam/domain/analytics';
import { brandGuideRepository, itemRepository } from '../repositories';

/**
 * Selectable brand labels for `BrandPicker`: every brand already used by an
 * item or a brand guide, one label per brand. A brand typed in for the first
 * time becomes a label once the item / guide carrying it is saved. Reloads on
 * focus so brands added on another screen show up when the user returns.
 */
export const useBrandOptions = (): { options: string[]; reload: () => Promise<void> } => {
  const [options, setOptions] = useState<string[]>([]);

  const reload = useCallback(async () => {
    const [itemBrands, guideBrands] = await Promise.all([
      itemRepository.listBrandNames(),
      brandGuideRepository.listBrandNames(),
    ]);
    setOptions(brandOptions([...itemBrands, ...guideBrands]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { options, reload };
};
