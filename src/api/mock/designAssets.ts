export const designAssetNames = [
  'poster-summer-drink', 'brand-logo-upgrade', 'tea-gift-box', 'double11-flowers',
  'cafe-menu', 'store-opening', 'member-card', 'product-detail-sofa',
] as const;

const assets = import.meta.glob<string>('./assets/*.webp', { eager: true, query: '?url', import: 'default' });

export function designImage(index: number): string | null {
  return designImageById(designAssetNames[Math.abs(index) % designAssetNames.length]);
}

export function designImageById(assetId: string): string | null {
  return assets[`./assets/${assetId}.webp`] ?? null;
}

export function designAssetId(path: string): string {
  let hash = 0;
  for (const character of path) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return designAssetNames[Math.abs(hash) % designAssetNames.length];
}

export function designImageForPath(path: string): string | null {
  return designImageById(designAssetId(path));
}
