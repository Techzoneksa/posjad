const supabasePublicUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL;

const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    ...(supabasePublicUrl ? { NEXT_PUBLIC_SUPABASE_URL: supabasePublicUrl } : {}),
    ...(supabasePublishableKey
      ? { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey }
      : {}),
  },
};

export default nextConfig;
