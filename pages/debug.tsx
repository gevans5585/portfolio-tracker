import { useState } from 'react';

interface TestResult {
  endpoint: string;
  status: 'idle' | 'testing' | 'success' | 'failed';
  data?: any;
  error?: string;
  timestamp?: string;
}

export default function DebugPage() {
  const [tests, setTests] = useState<TestResult[]>([
    { endpoint: 'Google Sheets', status: 'idle' },
    { endpoint: 'Gmail API', status: 'idle' },
    { endpoint: 'Dashboard Data', status: 'idle' },
    { endpoint: 'Portfolio Processing', status: 'idle' },
  ]);

  const updateTest = (endpoint: string, updates: Partial<TestResult>) => {
    setTests(prev => prev.map(test => 
      test.endpoint === endpoint 
        ? { ...test, ...updates, timestamp: new Date().toISOString() }
        : test
    ));
  };

  const runTest = async (endpoint: string, url: string, method = 'GET') => {
    updateTest(endpoint, { status: 'testing' });
    
    try {
      const response = await fetch(url, { method });
      const data = await response.json();
      
      if (response.ok) {
        updateTest(endpoint, { status: 'success', data });
      } else {
        updateTest(endpoint, { 
          status: 'failed', 
          error: data.message || 'Request failed',
          data 
        });
      }
    } catch (error) {
      updateTest(endpoint, { 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  };

  const runAllTests = async () => {
    await runTest('Google Sheets', '/api/debug/test-sheets');
    await runTest('Gmail API', '/api/debug/test-gmail');
    await runTest('Dashboard Data', '/api/dashboard-data');
    await runTest('Portfolio Processing', '/api/process-portfolio', 'POST');
  };

  const clearTests = () => {
    setTests(prev => prev.map(test => ({ 
      endpoint: test.endpoint, 
      status: 'idle' as const 
    })));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Portfolio Tracker Debug Dashboard</h1>
          <p className="text-gray-600 mb-6">
            Use this dashboard to test and debug your portfolio tracker setup. Run individual tests or all tests to identify configuration issues.
          </p>
          
          <div className="flex gap-4">
            <button
              onClick={runAllTests}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
            >
              Run All Tests
            </button>
            <button
              onClick={clearTests}
              className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
            >
              Clear Results
            </button>
          </div>
        </div>

        <div className="grid gap-6">
          {tests.map((test) => (
            <TestCard
              key={test.endpoint}
              test={test}
              onRunTest={() => {
                switch (test.endpoint) {
                  case 'Google Sheets':
                    runTest(test.endpoint, '/api/debug/test-sheets');
                    break;
                  case 'Gmail API':
                    runTest(test.endpoint, '/api/debug/test-gmail');
                    break;
                  case 'Dashboard Data':
                    runTest(test.endpoint, '/api/dashboard-data');
                    break;
                  case 'Portfolio Processing':
                    runTest(test.endpoint, '/api/process-portfolio', 'POST');
                    break;
                }
              }}
            />
          ))}
        </div>

        <div className="mt-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Environment Check</h2>
          <div className="space-y-3">
            <EnvironmentCheck
              name="Service Account Key File"
              envVar="GOOGLE_SERVICE_ACCOUNT_KEY_FILE"
              required={true}
            />
            <EnvironmentCheck
              name="Gmail User Email"
              envVar="GMAIL_USER_EMAIL"
              required={true}
            />
            <EnvironmentCheck
              name="Google Sheets ID"
              envVar="ACCOUNT_MAPPINGS_SHEET_ID"
              required={false}
            />
            <EnvironmentCheck
              name="SMTP Host"
              envVar="SMTP_HOST"
              required={false}
            />
            <EnvironmentCheck
              name="Portfolio Summary Email"
              envVar="PORTFOLIO_SUMMARY_EMAIL"
              required={false}
            />
          </div>
        </div>

        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Setup Instructions</h3>
          <div className="text-yellow-700 space-y-2">
            <p><strong>1. Google Service Account:</strong> Create a service account in Google Cloud Console and download the JSON key file.</p>
            <p><strong>2. Domain-wide Delegation:</strong> Enable domain-wide delegation for your service account in Google Workspace Admin Console.</p>
            <p><strong>3. APIs:</strong> Enable Gmail API and Google Sheets API in your Google Cloud project.</p>
            <p><strong>4. Environment Variables:</strong> Copy <code>.env.example</code> to <code>.env.local</code> and fill in your values.</p>
            <p><strong>5. File Location:</strong> Place your service account JSON file in the project root or update the file path in your environment variables.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TestCardProps {
  test: TestResult;
  onRunTest: () => void;
}

function TestCard({ test, onRunTest }: TestCardProps) {
  const getStatusColor = () => {
    switch (test.status) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'failed': return 'text-red-600 bg-red-50 border-red-200';
      case 'testing': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-white border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (test.status) {
      case 'success': return '✅';
      case 'failed': return '❌';
      case 'testing': return '⏳';
      default: return '⚪';
    }
  };

  return (
    <div className={`border rounded-lg p-6 ${getStatusColor()}`}>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getStatusIcon()}</span>
          <h3 className="text-xl font-semibold">{test.endpoint} Test</h3>
        </div>
        <button
          onClick={onRunTest}
          disabled={test.status === 'testing'}
          className="px-4 py-2 bg-white border border-current rounded hover:bg-gray-50 disabled:opacity-50"
        >
          {test.status === 'testing' ? 'Testing...' : 'Run Test'}
        </button>
      </div>

      {test.status !== 'idle' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-medium">Status:</span>
            <span className="capitalize">{test.status}</span>
            {test.timestamp && (
              <span className="text-sm opacity-75">
                at {new Date(test.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>

          {test.error && (
            <div>
              <span className="font-medium">Error:</span>
              <div className="mt-1 p-3 bg-white rounded font-mono text-sm">
                {test.error}
              </div>
            </div>
          )}

          {test.data && (
            <div>
              <span className="font-medium">Response:</span>
              <details className="mt-1">
                <summary className="cursor-pointer text-sm opacity-75">
                  Click to view full response
                </summary>
                <pre className="mt-2 p-3 bg-white rounded text-xs overflow-auto max-h-96">
                  {JSON.stringify(test.data, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface EnvironmentCheckProps {
  name: string;
  envVar: string;
  required: boolean;
}

function EnvironmentCheck({ name, envVar, required }: EnvironmentCheckProps) {
  // Note: We can't actually check environment variables from the client side
  // This is just for display purposes
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
      <div className="flex items-center gap-2">
        <span>{name}</span>
        {required && <span className="text-red-500 text-sm">(Required)</span>}
      </div>
      <div className="flex items-center gap-2">
        <code className="text-sm bg-gray-100 px-2 py-1 rounded">{envVar}</code>
        <span className="text-gray-400 text-sm">Check server logs</span>
      </div>
    </div>
  );
}