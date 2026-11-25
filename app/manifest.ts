import type { MetadataRoute } from 'next';

// Lets tablets and phones "install" the register to the home screen and open it full-screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  const org = process.env.ORG_NAME || 'Parliament';
  return {
    name: `${org} Daily Register`,
    short_name: 'Register',
    description: 'Daily sign-in register for directors and officers',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4f1ea',
    theme_color: '#12395f',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
