import type { NextApiRequest, NextApiResponse } from 'next';
import { ChangeDetectionService } from '@/lib/changeDetectionService';
import { EmailAlertService } from '@/lib/emailAlertService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Starting portfolio change detection and alert process...');
    
    const { date, sendEmail = true } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Initialize services
    const changeDetectionService = new ChangeDetectionService();
    const emailAlertService = new EmailAlertService();

    console.log(`Detecting portfolio changes for ${targetDate}...`);

    // Detect changes
    const changeAlert = await changeDetectionService.detectChanges(targetDate);
    
    console.log(`Change detection complete:`, {
      totalChanges: changeAlert.totalChanges,
      affectedAccounts: changeAlert.affectedAccounts.length,
      accounts: changeAlert.affectedAccounts
    });

    let emailSent = false;
    let emailError = null;

    // Send email alert if there are changes and sendEmail is true
    if (changeAlert.totalChanges > 0 && sendEmail) {
      try {
        console.log('Sending email alert...');
        await emailAlertService.sendChangeAlert(changeAlert);
        emailSent = true;
        console.log('Email alert sent successfully');
      } catch (error) {
        console.error('Failed to send email alert:', error);
        emailError = error instanceof Error ? error.message : 'Unknown email error';
      }
    } else if (changeAlert.totalChanges === 0) {
      console.log('No changes detected, skipping email alert');
    } else {
      console.log('Email sending disabled by request');
    }

    // Prepare detailed response
    const response = {
      timestamp: new Date().toISOString(),
      success: true,
      message: changeAlert.totalChanges > 0 
        ? `Detected ${changeAlert.totalChanges} portfolio changes across ${changeAlert.affectedAccounts.length} accounts`
        : 'No portfolio changes detected',
      data: {
        date: targetDate,
        changeAlert,
        email: {
          sent: emailSent,
          error: emailError,
          recipient: process.env.PORTFOLIO_SUMMARY_EMAIL,
          skipped: changeAlert.totalChanges === 0 || !sendEmail
        }
      }
    };

    // Return success even if email failed (change detection worked)
    return res.status(200).json(response);

  } catch (error) {
    console.error('Portfolio change alert API error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Portfolio change alert failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
    });
  }
}