import PortfolioCommentary from '@/components/PortfolioCommentary';
import AccountsOverview from '@/components/AccountsOverview';
import ModelWatchList from '@/components/ModelWatchList';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* AI-Powered Portfolio Commentary - Top Priority */}
        <PortfolioCommentary />
        
        {/* Account Portfolio Overview */}
        <AccountsOverview />
        
        {/* Model Watch List - Delayed to prevent IMAP overload */}
        <div className="mt-8">
          <ModelWatchList />
        </div>
      </div>
    </main>
  )
}