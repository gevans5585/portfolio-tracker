/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['googleapis', 'nodemailer']
  },
  // Disable SWC minification to prevent Jest worker crashes
  swcMinify: false
}

module.exports = nextConfig