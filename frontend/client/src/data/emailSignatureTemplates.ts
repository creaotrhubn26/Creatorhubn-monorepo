/**
 * Email Signature Templates - Professional signatures for creative professionals
 * 
 * Categories:
 * - Minimal & Clean
 * - Professional & Corporate
 * - Creative & Modern
 * - Social Media Focused
 * - Photography/Videography Specific
 */

export interface EmailSignatureTemplate {
  id: string;
  title: string;
  description: string;
  category: 'minimal' | 'professional' | 'creative' | 'social' | 'industry';
  preview: string;
  html: string;
}

export const EMAIL_SIGNATURE_TEMPLATES: EmailSignatureTemplate[] = [
  // ==================== MINIMAL & CLEAN ====================
  {
    id: 'minimal-elegant',
    title: 'Minimal Elegant',
    description: 'Clean, simple signature with essential info only',
    category: 'minimal',
    preview: '✨ Clean & Simple',
    html: `<table cellpadding="0" cellspacing="0" style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: #333;">
  <tr>
    <td style="padding-bottom: 8px; border-bottom: 2px solid #333;">
      <strong style="font-size: 16px; color: #000;">{{fullName}}</strong>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 8px;">
      <span style="color: #666;">{{jobTitle}}</span><br/>
      <span style="color: #666;">{{companyName}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 12px;">
      <a href="mailto:{{email}}" style="color: #333; text-decoration: none;">{{email}}</a>
      <span style="color: #ccc; margin: 0 8px;">|</span>
      <a href="tel:{{phone}}" style="color: #333; text-decoration: none;">{{phone}}</a>
    </td>
  </tr>
</table>`
  },
  {
    id: 'minimal-line',
    title: 'Single Line Minimal',
    description: 'Ultra-compact single line signature',
    category: 'minimal',
    preview: '📝 One Line',
    html: `<table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 13px; color: #444;">
  <tr>
    <td>
      <strong>{{fullName}}</strong>
      <span style="color: #999; margin: 0 6px;">•</span>
      {{jobTitle}}
      <span style="color: #999; margin: 0 6px;">•</span>
      <a href="mailto:{{email}}" style="color: #0066cc; text-decoration: none;">{{email}}</a>
      <span style="color: #999; margin: 0 6px;">•</span>
      {{phone}}
    </td>
  </tr>
</table>`
  },

  // ==================== PROFESSIONAL & CORPORATE ====================
  {
    id: 'professional-classic',
    title: 'Professional Classic',
    description: 'Traditional corporate signature with logo space',
    category: 'professional',
    preview: '💼 Corporate Style',
    html: `<table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 13px; color: #333; max-width: 500px;">
  <tr>
    <td style="vertical-align: top; padding-right: 15px; border-right: 3px solid {{brandColor}};">
      <img src="{{logoUrl}}" alt="{{companyName}}" style="width: 80px; height: auto;"/>
    </td>
    <td style="vertical-align: top; padding-left: 15px;">
      <strong style="font-size: 15px; color: #222;">{{fullName}}</strong><br/>
      <span style="color: {{brandColor}}; font-weight: 500;">{{jobTitle}}</span><br/>
      <span style="color: #666;">{{companyName}}</span>
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
        <span style="color: #666;">📧</span> <a href="mailto:{{email}}" style="color: #333; text-decoration: none;">{{email}}</a><br/>
        <span style="color: #666;">📱</span> <a href="tel:{{phone}}" style="color: #333; text-decoration: none;">{{phone}}</a><br/>
        <span style="color: #666;">🌐</span> <a href="{{website}}" style="color: {{brandColor}}; text-decoration: none;">{{website}}</a>
      </div>
    </td>
  </tr>
</table>`
  },
  {
    id: 'professional-card',
    title: 'Business Card Style',
    description: 'Signature styled like a business card',
    category: 'professional',
    preview: '🪪 Business Card',
    html: `<table cellpadding="0" cellspacing="0" style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; max-width: 400px;">
  <tr>
    <td style="background: #fff; padding: 20px; border-radius: 6px;">
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td>
            <strong style="font-size: 18px; color: #333;">{{fullName}}</strong><br/>
            <span style="color: #667eea; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">{{jobTitle}}</span>
          </td>
        </tr>
        <tr>
          <td style="padding-top: 15px; border-top: 1px solid #eee; margin-top: 15px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 4px 0;"><span style="color: #667eea;">✉</span></td>
                <td style="padding: 4px 0 4px 8px;"><a href="mailto:{{email}}" style="color: #333; text-decoration: none; font-size: 12px;">{{email}}</a></td>
              </tr>
              <tr>
                <td style="padding: 4px 0;"><span style="color: #667eea;">📞</span></td>
                <td style="padding: 4px 0 4px 8px;"><a href="tel:{{phone}}" style="color: #333; text-decoration: none; font-size: 12px;">{{phone}}</a></td>
              </tr>
              <tr>
                <td style="padding: 4px 0;"><span style="color: #667eea;">🌍</span></td>
                <td style="padding: 4px 0 4px 8px;"><a href="{{website}}" style="color: #333; text-decoration: none; font-size: 12px;">{{website}}</a></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  },

  // ==================== CREATIVE & MODERN ====================
  {
    id: 'creative-gradient',
    title: 'Creative Gradient',
    description: 'Modern signature with gradient accent',
    category: 'creative',
    preview: '🎨 Colorful Modern',
    html: `<table cellpadding="0" cellspacing="0" style="font-family: 'Poppins', Arial, sans-serif; font-size: 13px; max-width: 450px;">
  <tr>
    <td style="background: linear-gradient(90deg, {{brandColor}} 0%, {{accentColor}} 100%); height: 4px; border-radius: 2px;"></td>
  </tr>
  <tr>
    <td style="padding-top: 15px;">
      <strong style="font-size: 18px; color: #222;">{{fullName}}</strong>
      <span style="display: inline-block; background: linear-gradient(90deg, {{brandColor}}, {{accentColor}}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 600; margin-left: 8px;">{{jobTitle}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 10px; color: #666;">
      {{companyName}} • {{location}}
    </td>
  </tr>
  <tr>
    <td style="padding-top: 15px;">
      <a href="mailto:{{email}}" style="color: {{brandColor}}; text-decoration: none; margin-right: 15px;">{{email}}</a>
      <a href="tel:{{phone}}" style="color: #666; text-decoration: none;">{{phone}}</a>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 15px;">
      <a href="{{instagram}}" style="display: inline-block; width: 28px; height: 28px; background: #E4405F; border-radius: 50%; text-align: center; line-height: 28px; color: white; text-decoration: none; margin-right: 8px; font-size: 14px;">📷</a>
      <a href="{{linkedin}}" style="display: inline-block; width: 28px; height: 28px; background: #0077B5; border-radius: 50%; text-align: center; line-height: 28px; color: white; text-decoration: none; margin-right: 8px; font-size: 14px;">in</a>
      <a href="{{website}}" style="display: inline-block; width: 28px; height: 28px; background: #333; border-radius: 50%; text-align: center; line-height: 28px; color: white; text-decoration: none; font-size: 14px;">🌐</a>
    </td>
  </tr>
</table>`
  },
  {
    id: 'creative-dark',
    title: 'Dark Mode Creative',
    description: 'Sleek dark themed signature',
    category: 'creative',
    preview: '🌙 Dark & Sleek',
    html: `<table cellpadding="0" cellspacing="0" style="font-family: 'Inter', Arial, sans-serif; font-size: 13px; background: #1a1a2e; padding: 20px; border-radius: 12px; max-width: 420px;">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align: middle; padding-right: 15px;">
            <img src="{{avatarUrl}}" alt="{{fullName}}" style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid #6366f1;"/>
          </td>
          <td style="vertical-align: middle;">
            <strong style="font-size: 16px; color: #fff;">{{fullName}}</strong><br/>
            <span style="color: #6366f1; font-size: 12px;">{{jobTitle}}</span><br/>
            <span style="color: #888; font-size: 11px;">{{companyName}}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 15px; border-top: 1px solid #333; margin-top: 15px;">
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="padding: 5px 0;">
            <a href="mailto:{{email}}" style="color: #a5b4fc; text-decoration: none; font-size: 12px;">✉️ {{email}}</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">
            <a href="tel:{{phone}}" style="color: #a5b4fc; text-decoration: none; font-size: 12px;">📱 {{phone}}</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">
            <a href="{{website}}" style="color: #a5b4fc; text-decoration: none; font-size: 12px;">🌐 {{website}}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  },

  // ==================== SOCIAL MEDIA FOCUSED ====================
  {
    id: 'social-influencer',
    title: 'Social Media Influencer',
    description: 'Signature emphasizing social media presence',
    category: 'social',
    preview: '📱 Social First',
    html: `<table cellpadding="0" cellspacing="0" style="font-family: 'Nunito', Arial, sans-serif; font-size: 13px; max-width: 400px;">
  <tr>
    <td style="text-align: center; padding-bottom: 15px;">
      <img src="{{avatarUrl}}" alt="{{fullName}}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid #E4405F;"/>
    </td>
  </tr>
  <tr>
    <td style="text-align: center;">
      <strong style="font-size: 18px; color: #333;">{{fullName}}</strong><br/>
      <span style="color: #666; font-size: 13px;">{{jobTitle}} • {{niche}}</span>
    </td>
  </tr>
  <tr>
    <td style="text-align: center; padding-top: 15px;">
      <a href="{{instagram}}" style="display: inline-block; padding: 8px 16px; background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); color: white; text-decoration: none; border-radius: 20px; font-size: 12px; margin: 4px;">📸 Instagram</a>
      <a href="{{youtube}}" style="display: inline-block; padding: 8px 16px; background: #FF0000; color: white; text-decoration: none; border-radius: 20px; font-size: 12px; margin: 4px;">▶️ YouTube</a>
      <a href="{{tiktok}}" style="display: inline-block; padding: 8px 16px; background: #000; color: white; text-decoration: none; border-radius: 20px; font-size: 12px; margin: 4px;">🎵 TikTok</a>
    </td>
  </tr>
  <tr>
    <td style="text-align: center; padding-top: 15px; color: #999; font-size: 11px;">
      {{email}} • {{phone}}
    </td>
  </tr>
</table>`
  },

  // ==================== PHOTOGRAPHY/VIDEOGRAPHY ====================
  {
    id: 'photographer-portfolio',
    title: 'Photographer Portfolio',
    description: 'Signature with portfolio showcase for photographers',
    category: 'industry',
    preview: '📷 Photographer',
    html: `<table cellpadding="0" cellspacing="0" style="font-family: 'Playfair Display', Georgia, serif; font-size: 13px; max-width: 500px;">
  <tr>
    <td style="border-bottom: 1px solid #ddd; padding-bottom: 10px;">
      <strong style="font-size: 22px; color: #222; letter-spacing: 1px;">{{fullName}}</strong><br/>
      <span style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">{{specialty}} Photographer</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 15px 0;">
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="width: 33%; padding: 2px;"><img src="{{portfolioImage1}}" style="width: 100%; height: 60px; object-fit: cover; border-radius: 4px;"/></td>
          <td style="width: 33%; padding: 2px;"><img src="{{portfolioImage2}}" style="width: 100%; height: 60px; object-fit: cover; border-radius: 4px;"/></td>
          <td style="width: 33%; padding: 2px;"><img src="{{portfolioImage3}}" style="width: 100%; height: 60px; object-fit: cover; border-radius: 4px;"/></td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-family: Arial, sans-serif; font-size: 12px; color: #666;">
      📧 <a href="mailto:{{email}}" style="color: #333; text-decoration: none;">{{email}}</a><br/>
      📱 {{phone}}<br/>
      🌐 <a href="{{portfolio}}" style="color: #333; text-decoration: none;">{{portfolio}}</a>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 10px; font-family: Arial, sans-serif; font-size: 11px; color: #999;">
      <em>"{{tagline}}"</em>
    </td>
  </tr>
</table>`
  },
  {
    id: 'videographer-cinematic',
    title: 'Videographer Cinematic',
    description: 'Cinematic signature for video professionals',
    category: 'industry',
    preview: '🎬 Videographer',
    html: `<table cellpadding="0" cellspacing="0" style="font-family: 'Montserrat', Arial, sans-serif; font-size: 13px; background: #0d0d0d; padding: 20px; max-width: 480px;">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right: 15px; border-right: 2px solid #e50914;">
            <span style="font-size: 28px;">🎬</span>
          </td>
          <td style="padding-left: 15px;">
            <strong style="font-size: 18px; color: #fff; letter-spacing: 1px;">{{fullName}}</strong><br/>
            <span style="color: #e50914; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">{{specialty}}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 15px;">
      <span style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Featured Work</span>
      <div style="margin-top: 8px;">
        <a href="{{showreelUrl}}" style="display: inline-block; padding: 10px 20px; background: #e50914; color: white; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: bold;">▶ Watch Showreel</a>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 15px; border-top: 1px solid #333; margin-top: 15px;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 4px 15px 4px 0;"><a href="mailto:{{email}}" style="color: #888; text-decoration: none; font-size: 11px;">{{email}}</a></td>
          <td style="padding: 4px 15px 4px 0;"><span style="color: #888; font-size: 11px;">{{phone}}</span></td>
          <td style="padding: 4px 0;"><a href="{{website}}" style="color: #e50914; text-decoration: none; font-size: 11px;">{{website}}</a></td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 12px;">
      <a href="{{vimeo}}" style="color: #1ab7ea; text-decoration: none; margin-right: 12px; font-size: 11px;">Vimeo</a>
      <a href="{{youtube}}" style="color: #ff0000; text-decoration: none; margin-right: 12px; font-size: 11px;">YouTube</a>
      <a href="{{instagram}}" style="color: #E4405F; text-decoration: none; font-size: 11px;">Instagram</a>
    </td>
  </tr>
</table>`
  },
  {
    id: 'music-producer',
    title: 'Music Producer',
    description: 'Signature for music producers and audio professionals',
    category: 'industry',
    preview: '🎵 Music Producer',
    html: `<table cellpadding="0" cellspacing="0" style="font-family: 'Roboto', Arial, sans-serif; font-size: 13px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 20px; border-radius: 10px; max-width: 450px;">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align: middle;">
            <span style="font-size: 36px;">🎧</span>
          </td>
          <td style="vertical-align: middle; padding-left: 12px;">
            <strong style="font-size: 20px; color: #fff;">{{fullName}}</strong><br/>
            <span style="color: #00d4ff; font-size: 12px;">{{specialty}} • Music Producer</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 15px;">
      <a href="{{spotifyUrl}}" style="display: inline-block; padding: 8px 16px; background: #1DB954; color: white; text-decoration: none; border-radius: 20px; font-size: 11px; margin-right: 8px;">🎵 Spotify</a>
      <a href="{{soundcloudUrl}}" style="display: inline-block; padding: 8px 16px; background: #ff5500; color: white; text-decoration: none; border-radius: 20px; font-size: 11px;">☁️ SoundCloud</a>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 15px; color: #888; font-size: 11px;">
      📧 {{email}}<br/>
      📱 {{phone}}<br/>
      🎹 Available for: {{services}}
    </td>
  </tr>
</table>`
  },
];

export default EMAIL_SIGNATURE_TEMPLATES;
