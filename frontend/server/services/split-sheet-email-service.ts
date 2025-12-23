/**
 * Split Sheet Email Service
 * Sends professional emails with PDF attachments for split sheets
 */

import nodemailer from 'nodemailer';
import { generateSplitSheetPDF } from './split-sheet-pdf-service';

interface SendSplitSheetEmailOptions {
  to: string;
  splitSheetId: string;
  splitSheetTitle: string;
  contributorName?: string;
  includePDF?: boolean;
  emailType: 'signature_confirmation' | 'signature_request' | 'completed';
}

/**
 * Get email transporter (Gmail)
 */
function getEmailTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER || process.env.GOOGLE_WORKSPACE_EMAIL,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

/**
 * Generate email HTML template
 */
function generateEmailHTML(options: SendSplitSheetEmailOptions): string {
  const { splitSheetTitle, contributorName, emailType } = options;
  const baseUrl = process.env.APP_URL || 'https://creatorhubnorge.no';
  const brandColor = '#9f7aea';

  let subjectPrefix = '';
  let mainContent = '';
  let buttonText = '';
  let buttonLink = '';

  switch (emailType) {
    case 'signature_confirmation':
      subjectPrefix = 'Signert Split Sheet';
      mainContent = `
        <h2 style="color: ${brandColor}; font-family: Arial, sans-serif;">Takk for din signatur!</h2>
        <p style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          Hei ${contributorName || 'Bidragsyter'},
        </p>
        <p style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          Du har signert split sheet: <strong>${splitSheetTitle}</strong>
        </p>
        <p style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          En kopi av den signerte kontrakten er vedlagt som PDF.
        </p>
        <p style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          Du kan også se og administrere split sheet i vår portal.
        </p>
      `;
      buttonText = 'Se Split Sheet';
      buttonLink = `${baseUrl}/split-sheet/portal`;
      break;

    case 'signature_request':
      subjectPrefix = 'Vennligst signer Split Sheet';
      mainContent = `
        <h2 style="color: ${brandColor}; font-family: Arial, sans-serif;">Signatur påkrevd</h2>
        <p style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          Hei ${contributorName || 'Bidragsyter'},
        </p>
        <p style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          Du er invitert til å signere split sheet: <strong>${splitSheetTitle}</strong>
        </p>
        <p style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          Vennligst klikk på knappen nedenfor for å se og signere kontrakten.
        </p>
      `;
      buttonText = 'Signer Split Sheet';
      buttonLink = `${baseUrl}/split-sheet/portal`;
      break;

    case 'completed':
      subjectPrefix = 'Split Sheet fullført';
      mainContent = `
        <h2 style="color: ${brandColor}; font-family: Arial, sans-serif;">Split Sheet fullført!</h2>
        <p style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          Hei ${contributorName || 'Bidragsyter'},
        </p>
        <p style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          Alle bidragsytere har signert split sheet: <strong>${splitSheetTitle}</strong>
        </p>
        <p style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          Kontrakten er nå fullført og vedlagt som PDF.
        </p>
      `;
      buttonText = 'Se Split Sheet';
      buttonLink = `${baseUrl}/split-sheet/portal`;
      break;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 20px 0; text-align: center; background-color: ${brandColor};">
            <h1 style="margin: 0; color: white; font-size: 24px;">CreatorHub Norge</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 20px; background-color: #ffffff;">
            ${mainContent}
            <div style="margin: 30px 0; text-align: center;">
              <a href="${buttonLink}" 
                 style="display: inline-block; padding: 12px 30px; background-color: ${brandColor}; 
                        color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                ${buttonText}
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-family: Arial, sans-serif; font-size: 12px; color: #666;">
              Dette er en automatisk generert e-post fra CreatorHub Norge.<br>
              Hvis du har spørsmål, vennligst kontakt oss.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px; text-align: center; background-color: #f5f5f5; font-size: 12px; color: #666;">
            <p style="margin: 0;">© ${new Date().getFullYear()} CreatorHub Norge. Alle rettigheter reservert.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Send split sheet email with PDF attachment
 */
export async function sendSplitSheetEmail(options: SendSplitSheetEmailOptions): Promise<void> {
  const { to, splitSheetId, splitSheetTitle, contributorName, includePDF = true, emailType } = options;

  const transporter = getEmailTransporter();
  const fromEmail = process.env.GMAIL_USER || process.env.GOOGLE_WORKSPACE_EMAIL || 'noreply@creatorhub.no';

  let subject = '';
  switch (emailType) {
    case 'signature_confirmation':
      subject = `Signert Split Sheet: ${splitSheetTitle}`;
      break;
    case 'signature_request':
      subject = `Vennligst signer Split Sheet: ${splitSheetTitle}`;
      break;
    case 'completed':
      subject = `Split Sheet fullført: ${splitSheetTitle}`;
      break;
  }

  const mailOptions: any = {
    from: `CreatorHub Norge <${fromEmail}>`,
    to,
    subject,
    html: generateEmailHTML(options),
  };

  // Add PDF attachment if requested
  if (includePDF) {
    try {
      const pdfBuffer = await generateSplitSheetPDF(splitSheetId, {
        includeSignatures: emailType === 'signature_confirmation' || emailType === 'completed',
        includeRevenue: false,
        template: 'standard',
      });

      mailOptions.attachments = [
        {
          filename: `${splitSheetTitle.replace(/[^a-z0-9]/gi, '_')}_split_sheet.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ];
    } catch (error) {
      console.error('Error generating PDF for email:', error);
      // Continue without PDF attachment if generation fails
    }
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Split sheet email sent to ${to} for ${splitSheetTitle}`);
  } catch (error) {
    console.error('Error sending split sheet email:', error);
    throw error;
  }
}























