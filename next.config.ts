/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["*"], 
  
  experimental: {
    allowedRevalidateHeaderKeys: ["*"],
  },
  
  devIndicators: {
    appIsrStatus: false,
  }
};

export default nextConfig;