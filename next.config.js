const supabasePublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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
    ...(supabaseAnonKey ? { NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey } : {}),
    ...(supabasePublishableKey
      ? { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey }
      : {}),
  },
};

export default nextConfig;
