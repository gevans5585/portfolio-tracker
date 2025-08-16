import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Evans Family Wealth | Portfolio Tracker',
  description: 'Professional portfolio tracking and investment analysis',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Google Fonts - Inter */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        
        {/* Chart.js for data visualizations */}
        <script src="https://cdn.jsdelivr.net/npm/chart.js" async></script>
      </head>
      <body className="font-inter bg-evans-bg min-h-screen">
        {/* Header with Evans Family Wealth branding */}
        <header className="bg-evans-primary shadow-sm border-b border-evans-secondary/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
            <div className="flex items-end justify-between">
              <div className="flex items-end gap-4">
                {/* Evans Family Wealth Logo - 150% larger */}
                <img 
                  src="/Evans_Family_Wealth_Logo.jpg" 
                  alt="Evans Family Wealth" 
                  className="h-20 w-auto object-contain"
                  style={{ height: '5rem' }}
                />
                <div>
                  <h1 className="text-6xl font-bold text-white leading-none">Evans Family Wealth</h1>
                  <p className="text-evans-secondary/80 text-sm">Portfolio Management</p>
                </div>
              </div>
              <div className="flex items-end">
                <span className="text-evans-secondary/80 text-sm">
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
            </div>
          </div>
        </header>
        
        {/* Main content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}