import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';

/**
 * Generates the PWA icon set from public/logo.svg:
 *  - pwa-64x64.png, pwa-192x192.png, pwa-512x512.png (any)
 *  - maskable-icon-512x512.png (maskable)
 *  - apple-touch-icon-180x180.png
 *
 * The minimal-2023 preset pads the maskable + apple variants onto the brand
 * near-black background so the lime "R" sits safely inside the safe zone.
 */
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: {
      ...minimal2023Preset.apple,
      // Apple touch icons render on a solid tile — use the brand background.
      resizeOptions: {
        background: '#0c0d0f',
        fit: 'contain',
      },
      padding: 0.1,
    },
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: {
        background: '#0c0d0f',
        fit: 'contain',
      },
    },
  },
  images: ['public/logo.svg'],
});
