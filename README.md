# Portfolio Tracker

A comprehensive portfolio tracking system that fetches daily portfolio emails from Gmail, parses performance data, compares holdings, and generates automated summaries.

## Features

- 📧 **Email Integration**: Fetches portfolio emails from Gmail using Google APIs
- 📊 **HTML Parsing**: Extracts portfolio data from HTML tables in emails
- 📈 **Performance Tracking**: Compares today's vs yesterday's portfolio holdings
- 📋 **Account Mapping**: Uses Google Sheets for account name/number mappings
- 📨 **Email Summaries**: Generates beautiful HTML email summaries
- 🌐 **Web Dashboard**: Interactive dashboard for portfolio visualization
- ⏰ **Automated Processing**: Daily automated processing via Vercel Cron Jobs

## Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd portfolio-tracker
npm install
```

### 2. Google API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API and Google Sheets API
4. Create a Service Account
5. Download the service account JSON key file
6. Save it as `service-account-key.json` in the project root

### 3. Gmail Configuration

1. Enable domain-wide delegation for your service account
2. In Google Workspace Admin Console, add the required scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/spreadsheets.readonly`

### 4. Google Sheets Setup

1. Create a Google Sheet with account mappings
2. Structure: Email Account | Display Name | Account Number | Category
3. Share the sheet with your service account email
4. Copy the Sheet ID from the URL

### 5. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

### 6. Local Development

```bash
npm run dev
```

Visit `http://localhost:3000` to see the dashboard.

## Deployment to Vercel

### 1. Connect to Vercel

```bash
vercel login
vercel
```

### 2. Set Environment Variables

In Vercel Dashboard, add all environment variables from `.env.example`.

For the service account key, you can either:
- Upload the JSON file and reference it with `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`
- Or paste the entire JSON content as `GOOGLE_SERVICE_ACCOUNT_KEY` and modify the code to use it directly

### 3. Deploy

```bash
vercel --prod
```

## Automated Daily Processing

The system is configured to run automatically Monday-Friday at 9:00 AM using Vercel Cron Jobs.

The cron job:
1. Fetches portfolio emails from the current day
2. Parses HTML tables to extract portfolio data
3. Compares with previous day's data
4. Generates alerts for significant changes
5. Sends HTML email summary
6. Updates the web dashboard

## API Endpoints

- `GET /api/dashboard-data` - Get current portfolio data for dashboard
- `POST /api/process-portfolio` - Manually trigger portfolio processing
- `POST /api/cron/daily-portfolio` - Daily automated processing (protected)

## Project Structure

```
├── app/                    # Next.js app directory
├── components/            # React components
├── lib/                   # Core business logic
│   ├── gmail.ts          # Gmail API integration
│   ├── emailParser.ts    # HTML email parsing
│   ├── portfolioComparison.ts  # Portfolio comparison logic
│   ├── googleSheets.ts   # Google Sheets integration
│   ├── emailGenerator.ts # Email summary generation
│   └── portfolioService.ts # Main orchestration service
├── pages/api/            # API routes
├── types/                # TypeScript type definitions
└── vercel.json          # Vercel configuration
```

## Email Parser

The email parser supports multiple formats and uses intelligent heuristics to extract data:

- **Standard Format**: Looks for common table structures with headers
- **Brokerage Format**: Handles specific brokerage email layouts
- **Custom Format**: Fallback parser for unknown formats

### Supported Data Fields

- Symbol/Ticker
- Security Name
- Quantity/Shares
- Current Price
- Market Value
- Day Change ($ and %)
- Account Information

## Customization

### Adding New Email Formats

1. Extend the `EmailParser` class in `lib/emailParser.ts`
2. Add format-specific parsing methods
3. Test with sample emails

### Modifying Alerts

1. Update thresholds in `PortfolioComparisonService`
2. Add new alert types in `generateAlerts()` method
3. Customize email templates in `EmailSummaryGenerator`

## Security

- Service account keys are stored securely
- Cron endpoints are protected with secret tokens
- No sensitive data is logged
- SMTP credentials use app-specific passwords

## Troubleshooting

### Common Issues

1. **Gmail API errors**: Check service account permissions and domain-wide delegation
2. **Parsing failures**: Review email HTML structure and update parser rules
3. **Cron job failures**: Check Vercel function logs and timeout settings
4. **Email delivery issues**: Verify SMTP settings and app passwords

### Debug Mode

Add `DEBUG=true` to environment variables for verbose logging.

### Manual Testing

Use the `/api/process-portfolio` endpoint to manually trigger processing and test the system.

## License

MIT License - see LICENSE file for details.