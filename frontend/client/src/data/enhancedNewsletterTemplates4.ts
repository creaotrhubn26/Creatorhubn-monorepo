/**
 * Enhanced Newsletter Templates - Part 4
 * Additional engaging newsletter templates
 * 
 * Templates:
 * - Product Launch
 * - Behind the Scenes
 * - Tips & Tricks
 * - Case Study / Success Story
 */

import { NewsletterTemplate } from './enhancedNewsletterTemplates';

export const ENHANCED_NEWSLETTER_TEMPLATES_PART4: NewsletterTemplate[] = [
  // ==================== PRODUCT LAUNCH ====================
  {
    id: 'product-launch',
    title: 'Produktlansering',
    description: 'Annonsering av nytt produkt eller tjeneste',
    category: 'launch',
    subject: '🚀 {{firstName}}, noe STORT er her! Introducing {{productName}}',
    preheader: 'Den ventetiden er over. Se hva vi har laget for deg...',
    tags: ['launch','product','announcement','new'],
    cta: {
      primary: 'Se {{productName}} Nå',
      secondary: 'Les Mer'
    },
    content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
    <!-- Hero Section with Dramatic Reveal -->
    <tr>
      <td style="background: linear-gradient(180deg, #1a1a2e 0%, #0a0a0a 100%); text-align: center; padding: 60px 20px;">
        <p style="color: #00d4ff; font-size: 12px; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 20px;">✨ NY LANSERING</p>
        <h1 style="color: #ffffff; font-size: 42px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.1;">
          Introducing<br/>
          <span style="background: linear-gradient(90deg, #00d4ff, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">{{productName}}</span>
        </h1>
        <p style="color: #888; font-size: 18px; margin-bottom: 30px;">{{productTagline}}</p>
        <img src="{{productImageUrl}}" alt="{{productName}}" style="max-width: 100%; border-radius: 12px; box-shadow: 0 20px 60px rgba(0, 212, 255, 0.3);"/>
      </td>
    </tr>

    <!-- Key Features -->
    <tr>
      <td style="background: #111; padding: 50px 30px;">
        <h2 style="color: #fff; font-size: 24px; text-align: center; margin-bottom: 40px;">Hvorfor du vil elske det</h2>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 15px; text-align: center;">
              <div style="background: linear-gradient(135deg, #00d4ff20, #7c3aed20); padding: 30px; border-radius: 12px; border: 1px solid #333;">
                <span style="font-size: 36px;">⚡</span>
                <h3 style="color: #fff; margin: 15px 0 10px;">{{feature1Title}}</h3>
                <p style="color: #888; font-size: 14px; margin: 0;">{{feature1Description}}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 15px; text-align: center;">
              <div style="background: linear-gradient(135deg, #00d4ff20, #7c3aed20); padding: 30px; border-radius: 12px; border: 1px solid #333;">
                <span style="font-size: 36px;">🎯</span>
                <h3 style="color: #fff; margin: 15px 0 10px;">{{feature2Title}}</h3>
                <p style="color: #888; font-size: 14px; margin: 0;">{{feature2Description}}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 15px; text-align: center;">
              <div style="background: linear-gradient(135deg, #00d4ff20, #7c3aed20); padding: 30px; border-radius: 12px; border: 1px solid #333;">
                <span style="font-size: 36px;">✨</span>
                <h3 style="color: #fff; margin: 15px 0 10px;">{{feature3Title}}</h3>
                <p style="color: #888; font-size: 14px; margin: 0;">{{feature3Description}}</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Launch Offer -->
    <tr>
      <td style="background: linear-gradient(135deg, #7c3aed 0%, #00d4ff 100%); padding: 40px 30px; text-align: center;">
        <p style="color: rgba(255,255,255,0.9); font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">🎁 LANSERINGS-TILBUD</p>
        <h2 style="color: #fff; font-size: 32px; margin: 0 0 15px;">{{discountPercent}}% RABATT</h2>
        <p style="color: rgba(255,255,255,0.8); font-size: 16px; margin-bottom: 25px;">For de første {{limitedSpots}} kundene. Kun {{daysLeft}} dager igjen!</p>
        <a href="{{ctaUrl}}" style="display: inline-block; background: #fff; color: #7c3aed; padding: 16px 40px; border-radius: 30px; text-decoration: none; font-weight: bold; font-size: 16px;">Få Tilbudet Nå →</a>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background: #0a0a0a; padding: 40px 30px; text-align: center; border-top: 1px solid #222;">
        <p style="color: #666; font-size: 12px; margin: 0;">{{companyName}} • {{companyAddress}}</p>
        <p style="color: #444; font-size: 11px; margin-top: 15px;"><a href="{{unsubscribeUrl}}" style="color: #444;">Avslutt abonnement</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`
  },

  // ==================== BEHIND THE SCENES ====================
  {
    id: 'behind-scenes',
    title: 'Bak Kulissene',
    description: 'Del behind-the-scenes innhold og prosessen din',
    category: 'engagement',
    subject: '🎬 {{firstName}}, ta en titt bak kulissene...',
    preheader: 'Se hvordan magien skjer i vår kreative prosess',
    tags: ['bts','behind-scenes','process','creative'],
    cta: {
      primary: 'Se Hele Prosessen',
      secondary: 'Følg Oss på Instagram'
    },
    content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
    <!-- Header -->
    <tr>
      <td style="background: #fff; padding: 30px; text-align: center; border-bottom: 1px solid #eee;">
        <img src="{{logoUrl}}" alt="{{companyName}}" style="height: 40px;"/>
      </td>
    </tr>

    <!-- Hero -->
    <tr>
      <td style="background: #fff; padding: 40px 30px; text-align: center;">
        <span style="font-size: 48px;">🎬</span>
        <h1 style="color: #222; font-size: 28px; margin: 20px 0 10px;">Bak Kulissene</h1>
        <p style="color: #666; font-size: 16px;">{{projectName}} - En titt inn i prosessen</p>
      </td>
    </tr>

    <!-- Main BTS Image -->
    <tr>
      <td style="padding: 0 20px;">
        <img src="{{btsMainImage}}" alt="Behind the Scenes" style="width: 100%; border-radius: 12px;"/>
      </td>
    </tr>

    <!-- Story Section -->
    <tr>
      <td style="background: #fff; padding: 40px 30px;">
        <h2 style="color: #222; font-size: 20px; margin-bottom: 20px;">📖 Historien Bak</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.7;">
          Hei {{firstName}}! 👋
        </p>
        <p style="color: #555; font-size: 15px; line-height: 1.7;">
          {{storyParagraph1}}
        </p>
        <p style="color: #555; font-size: 15px; line-height: 1.7;">
          {{storyParagraph2}}
        </p>
      </td>
    </tr>
    <!-- CTA -->
    <tr>
      <td style="background: #fff; padding: 0 30px 40px; text-align: center;">
        <a href="{{ctaUrl}}" style="display: inline-block; background: #222; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          {{ctaPrimary}}
        </a>
        <p style="color: #888; font-size: 13px; margin-top: 12px;">{{ctaSecondary}}</p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background: #fafafa; padding: 30px; text-align: center; border-top: 1px solid #eee;">
        <p style="color: #777; font-size: 12px; margin: 0;">{{companyName}} • {{companyAddress}}</p>
        <p style="color: #999; font-size: 11px; margin-top: 12px;">
          <a href="{{unsubscribeUrl}}" style="color: #999; text-decoration: none;">Avslutt abonnement</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
  }
];

