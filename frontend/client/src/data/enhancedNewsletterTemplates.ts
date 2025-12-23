/**
 * Enhanced Newsletter Templates - Engaging & Impactful
 * 
 * Features:
 * - Visual hierarchy with hero images and clear sections
 * - Compelling, personalized subject lines with emojis
 * - Storytelling approach (Hook → Problem → Solution → Results → CTA)
 * - Clear CTAs with contrasting colors
 * - Social proof (testimonials, stats, case studies)
 * - Urgency/scarcity elements
 * - Mobile-optimized responsive design
 * - Personalization tokens
 */

export interface NewsletterTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  subject: string;
  preheader: string;
  content: string;
  tags: string[];
  cta: {
    primary: string;
    secondary?: string;
  };
}

export const ENHANCED_NEWSLETTER_TEMPLATES: NewsletterTemplate[] = [
  {
    id: 'welcome-enhanced',
    title: 'Velkomstmail (Enhanced)',
    description: 'Engaging welcome email with personal story, social proof, and exclusive offer',
    category: 'Onboarding',
    subject: '🎉 {{firstName}}, velkommen! Her er din eksklusive gave...',
    preheader: 'Få 20% rabatt på din første booking + gratis konsultasjon',
    tags: ['welcome','onboarding','discount','storytelling'],
    cta: {
      primary: 'Book Din Gratis Konsultasjon',
      secondary: 'Se Våre Tjenester',
    },
    content: `
      <!-- Hero Section with Gradient Background -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 60px 20px; text-align: center;">
        <h1 style="color: white; font-size: 36px; margin: 0; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
          Velkommen til {{businessName}}! 🎉
        </h1>
        <p style="color: white; font-size: 20px; margin: 15px 0 0 0; opacity: 0.95;">
          Vi er glade for å ha deg med oss, {{firstName}}
        </p>
      </div>
      
      <!-- Main Content Container -->
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif;">
        
        <!-- Personal Story Hook -->
        <p style="font-size: 18px; line-height: 1.8; color: #333; margin-bottom: 20px;">
          Hei {{firstName}},
        </p>
        <p style="font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 20px;">
          For 5 år siden startet jeg som {{profession}} med én kamera og en drøm. 
          Jeg husker følelsen av usikkerhet – ville noen virkelig betale for mine tjenester?
        </p>
        <p style="font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 30px;">
          I dag har jeg hjulpet over <strong style="color: #667eea;">500 kunder</strong> med å fange deres viktigste øyeblikk. 
          Og nå er jeg her for å hjelpe <strong style="color: #667eea;">deg</strong>.
        </p>
        
        <!-- Primary CTA Button -->
        <div style="text-align: center; margin: 40px 0;">
          <a href="{{bookingLink}}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 18px 50px; text-decoration: none; border-radius: 50px; font-size: 18px; font-weight: bold; display: inline-block; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: all 0.3s;">
            📅 Book Din Gratis Konsultasjon →
          </a>
          <p style="font-size: 13px; color: #999; margin-top: 12px; font-style: italic;">
            ⏰ Kun 3 plasser igjen denne uken
          </p>
        </div>
        
        <!-- What You'll Get Section -->
        <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin: 40px 0;">
          <h2 style="font-size: 26px; color: #333; margin-top: 0; text-align: center;">
            ✨ Hva får du som abonnent?
          </h2>
          <ul style="font-size: 16px; line-height: 2; color: #555; list-style: none; padding: 0;">
            <li style="margin-bottom: 15px; padding-left: 30px; position: relative;">
              <span style="position: absolute; left: 0; color: #667eea; font-size: 20px;">💎</span>
              <strong>Eksklusive tilbud</strong> – Spar opptil 30% på alle tjenester
            </li>
            <li style="margin-bottom: 15px; padding-left: 30px; position: relative;">
              <span style="position: absolute; left: 0; color: #667eea; font-size: 20px;">📚</span>
              <strong>Gratis ressurser</strong> – Tips og triks fra bransjen hver uke
            </li>
            <li style="margin-bottom: 15px; padding-left: 30px; position: relative;">
              <span style="position: absolute; left: 0; color: #667eea; font-size: 20px;">🎁</span>
              <strong>Månedlige konkurranser</strong> – Vinn gratis fotoshoot verdt 5000 kr
            </li>
            <li style="margin-bottom: 0; padding-left: 30px; position: relative;">
              <span style="position: absolute; left: 0; color: #667eea; font-size: 20px;">⚡</span>
              <strong>Tidlig tilgang</strong> – Vær først til å booke nye tjenester
            </li>
          </ul>
        </div>
        
        <!-- Social Proof Section -->
        <div style="background: white; padding: 30px; border-radius: 15px; margin: 40px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <h3 style="font-size: 22px; color: #333; margin-top: 0; text-align: center;">
            💬 Hva sier våre kunder?
          </h3>
          
          <!-- Testimonial 1 -->
          <div style="border-left: 4px solid #667eea; padding-left: 20px; margin: 25px 0;">
            <p style="font-style: italic; color: #555; margin: 0; font-size: 15px; line-height: 1.6;">"Beste beslutningen jeg tok! Bildene var fantastiske og prosessen var så enkel. 
              Jeg følte meg som en stjerne hele dagen!"
            </p>
            <div style="display: flex; align-items: center; margin-top: 15px;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: #667eea; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 10px;">
                M
              </div>
              <div>
                <p style="font-size: 14px; color: #333; margin: 0; font-weight: bold;">Maria S.</p>
                <p style="font-size: 12px; color: #888; margin: 3px 0 0 0;">
                  Bryllupskunde ⭐⭐⭐⭐⭐
                </p>
              </div>
            </div>
          </div>
          
          <!-- Testimonial 2 -->
          <div style="border-left: 4px solid #764ba2; padding-left: 20px; margin: 25px 0;">
            <p style="font-style: italic; color: #555; margin: 0; font-size: 15px; line-height: 1.6;">"Profesjonell, kreativ og punktlig. Mine produktbilder økte salget med 40% på første måned!"
            </p>
            <div style="display: flex; align-items: center; margin-top: 15px;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: #764ba2; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 10px;">
                J
              </div>
              <div>
                <p style="font-size: 14px; color: #333; margin: 0; font-weight: bold;">Jonas K.</p>
                <p style="font-size: 12px; color: #888; margin: 3px 0 0 0;">
                  E-handel Eier ⭐⭐⭐⭐⭐
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Special Offer Box -->
        <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffe8a1 100%); border: 3px solid #ffc107; padding: 30px; border-radius: 15px; text-align: center; margin: 40px 0; box-shadow: 0 4px 15px rgba(255, 193, 7, 0.3);">
          <h3 style="color: #856404; margin-top: 0; font-size: 24px;">🎁 Din Velkomstgave</h3>
          <p style="font-size: 28px; color: #856404; margin: 15px 0; font-weight: bold;">
            20% RABATT
          </p>
          <p style="font-size: 16px; color: #856404; margin: 10px 0;">
            på din første booking
          </p>
          <div style="background: white; display: inline-block; padding: 10px 20px; border-radius: 8px; margin: 15px 0;">
            <p style="font-size: 14px; color: #856404; margin: 0;">
              Bruk kode: <strong style="font-size: 20px; letter-spacing: 2px;">VELKOMMEN20</strong>
            </p>
          </div>
          <p style="font-size: 13px; color: #856404; margin: 10px 0; font-weight: bold;">
            ⏰ Tilbudet utløper om 7 dager
          </p>
        </div>

        <!-- Secondary CTA -->
        <div style="text-align: center; margin: 40px 0;">
          <a href="{{bookingLink}}" style="background: #28a745; color: white; padding: 18px 50px; text-decoration: none; border-radius: 50px; font-size: 18px; font-weight: bold; display: inline-block; box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);">
            ✅ Ja, jeg vil ha 20% rabatt! →
          </a>
        </div>

        <!-- P.S. with Urgency -->
        <div style="margin-top: 50px; padding-top: 30px; border-top: 2px solid #e0e0e0;">
          <p style="font-size: 15px; color: #666; line-height: 1.6;">
            <strong style="color: #667eea;">P.S.</strong> Ikke gå glipp av dette!
            Kun de første 50 abonnentene får denne eksklusive rabatten.
            <a href="{{bookingLink}}" style="color: #667eea; text-decoration: none; font-weight: bold;">
              Book nå →
            </a>
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 50px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 12px; color: #999; margin: 5px 0;">
            {{businessName}} | {{businessAddress}}
          </p>
          <p style="font-size: 12px; color: #999; margin: 5px 0;">
            <a href="{{unsubscribeLink}}" style="color: #999; text-decoration: underline;">Avslutt abonnement</a>
          </p>
        </div>
      </div>
    `,
  },

  {
    id: 'monthly-enhanced',
    title: 'Månedlig Nyhetsbrev (Enhanced)',
    description: 'Curated monthly content with featured work, tips, and exclusive offers',
    category: 'Engagement',
    subject: '📸 {{firstName}}, dine favoritter fra {{month}} + eksklusivt tilbud',
    preheader: 'Se våre beste prosjekter, få eksperttips, og spar 15% denne måneden',
    tags: ['monthly','newsletter','content','engagement'],
    cta: {
      primary: 'Se Alle Prosjekter',
      secondary: 'Få Ditt Tilbud',
    },
    content: `
      <!-- Header with Month -->
      <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 50px 20px; text-align: center;">
        <p style="color: white; font-size: 14px; margin: 0; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9;">
          {{businessName}} Nyhetsbrev
        </p>
        <h1 style="color: white; font-size: 38px; margin: 15px 0 0 0; font-weight: bold;">
          {{month}} Høydepunkter 🌟
        </h1>
      </div>

      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif;">

        <!-- Personal Greeting -->
        <p style="font-size: 18px; line-height: 1.8; color: #333; margin-bottom: 30px;">
          Hei {{firstName}},
        </p>
        <p style="font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 30px;">
          Hvilken måned det har vært! Vi har jobbet med utrolige prosjekter,
          møtt fantastiske mennesker, og lært masse nytt. Her er høydepunktene vi vil dele med deg.
        </p>

        <!-- Featured Project Section -->
        <div style="background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); margin: 40px 0;">
          <!-- Project Image Placeholder -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 300px; display: flex; align-items: center; justify-content: center;">
            <p style="color: white; font-size: 24px; margin: 0;">📷 Månedens Prosjekt</p>
          </div>

          <div style="padding: 30px;">
            <h2 style="font-size: 24px; color: #333; margin: 0 0 15px 0;">
              Drømmebryllupet til Emma & Lars
            </h2>
            <p style="font-size: 15px; line-height: 1.7; color: #666; margin-bottom: 20px;">
              Et magisk bryllup i Lofoten med midnattssol som bakteppe.
              Dette prosjektet minnet oss på hvorfor vi elsker det vi gjør –
              å fange øyeblikk som varer evig.
            </p>
            <a href="{{projectLink}}" style="color: #4facfe; text-decoration: none; font-weight: bold; font-size: 15px;">
              Se hele historien →
            </a>
          </div>
        </div>

        <!-- Quick Tips Section -->
        <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin: 40px 0;">
          <h2 style="font-size: 24px; color: #333; margin-top: 0; text-align: center;">
            💡 Eksperttips fra oss
          </h2>

          <div style="margin: 25px 0;">
            <h3 style="font-size: 18px; color: #4facfe; margin: 0 0 10px 0;">
              1. Planlegg i god tid
            </h3>
            <p style="font-size: 15px; line-height: 1.6; color: #666; margin: 0;">
              De beste datoene blir raskt booket. Vi anbefaler å booke 6-12 måneder i forveien
              for bryllup og store arrangementer.
            </p>
          </div>

          <div style="margin: 25px 0;">
            <h3 style="font-size: 18px; color: #4facfe; margin: 0 0 10px 0;">
              2. Velg riktig tidspunkt
            </h3>
            <p style="font-size: 15px; line-height: 1.6; color: #666; margin: 0;">
              Golden hour (1 time før solnedgang) gir det vakreste lyset.
              Perfekt for utendørs fotografering!
            </p>
          </div>

          <div style="margin: 25px 0;">
            <h3 style="font-size: 18px; color: #4facfe; margin: 0 0 10px 0;">
              3. Vær deg selv
            </h3>
            <p style="font-size: 15px; line-height: 1.6; color: #666; margin: 0;">
              De beste bildene kommer når du er avslappet og naturlig.
              Vi hjelper deg med å føle deg komfortabel foran kameraet.
            </p>
          </div>
        </div>

        <!-- Stats/Numbers Section -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; border-radius: 15px; margin: 40px 0; text-align: center;">
          <h2 style="color: white; font-size: 24px; margin: 0 0 30px 0;">
            {{month}} i tall
          </h2>

          <div style="display: flex; justify-content: space-around; flex-wrap: wrap;">
            <div style="margin: 15px;">
              <p style="color: white; font-size: 42px; font-weight: bold; margin: 0;">12</p>
              <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 5px 0 0 0;">Prosjekter</p>
            </div>
            <div style="margin: 15px;">
              <p style="color: white; font-size: 42px; font-weight: bold; margin: 0;">2,500+</p>
              <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 5px 0 0 0;">Bilder tatt</p>
            </div>
            <div style="margin: 15px;">
              <p style="color: white; font-size: 42px; font-weight: bold; margin: 0;">100%</p>
              <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 5px 0 0 0;">Fornøyde kunder</p>
            </div>
          </div>
        </div>

        <!-- Exclusive Offer -->
        <div style="background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%); border: 3px solid #fdcb6e; padding: 30px; border-radius: 15px; text-align: center; margin: 40px 0;">
          <h3 style="color: #2d3436; margin-top: 0; font-size: 22px;">
            🎁 Eksklusivt tilbud for abonnenter
          </h3>
          <p style="font-size: 26px; color: #2d3436; margin: 15px 0; font-weight: bold;">
            15% RABATT
          </p>
          <p style="font-size: 15px; color: #2d3436; margin: 10px 0;">
            på alle bookinger gjort i {{nextMonth}}
          </p>
          <div style="margin: 25px 0;">
            <a href="{{bookingLink}}" style="background: #2d3436; color: white; padding: 15px 40px; text-decoration: none; border-radius: 50px; font-size: 16px; font-weight: bold; display: inline-block;">
              Book Nå →
            </a>
          </div>
          <p style="font-size: 12px; color: #2d3436; margin: 10px 0;">
            ⏰ Tilbudet gjelder til {{offerEndDate}}
          </p>
        </div>

        <!-- CTA Section -->
        <div style="text-align: center; margin: 40px 0;">
          <p style="font-size: 16px; color: #666; margin-bottom: 20px;">
            Klar for å lage noe fantastisk sammen?
          </p>
          <a href="{{bookingLink}}" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 18px 50px; text-decoration: none; border-radius: 50px; font-size: 18px; font-weight: bold; display: inline-block; box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);">
            La oss snakke! →
          </a>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 50px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 14px; color: #666; margin-bottom: 15px;">
            Takk for at du er en del av {{businessName}}-familien! 💙
          </p>
          <p style="font-size: 12px; color: #999; margin: 5px 0;">
            {{businessName}} | {{businessAddress}}
          </p>
          <p style="font-size: 12px; color: #999; margin: 5px 0;">
            <a href="{{unsubscribeLink}}" style="color: #999; text-decoration: underline;">Avslutt abonnement</a>
          </p>
        </div>
      </div>
    `,
  },

  {
    id: 'campaign-enhanced',
    title: 'Kampanje/Tilbud (Enhanced)',
    description: 'High-impact campaign email with urgency, scarcity, and compelling offer',
    category: 'Promotion',
    subject: '🔥 {{firstName}}, SISTE SJANSE: 40% rabatt utløper i kveld!',
    preheader: 'Ikke gå glipp av årets beste tilbud – kun 6 timer igjen',
    tags: ['campaign','promotion','urgency','discount'],
    cta: {
      primary: 'Få 40% Rabatt Nå',
      secondary: 'Se Alle Tilbud',
    },
    content: `
      <!-- Urgent Header -->
      <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); padding: 50px 20px; text-align: center; position: relative;">
        <div style="background: #fff; color: #ff6b6b; display: inline-block; padding: 8px 20px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px;">
          ⏰ SISTE SJANSE
        </div>
        <h1 style="color: white; font-size: 42px; margin: 15px 0; font-weight: bold; line-height: 1.2;">
          40% RABATT<br/>Utløper i kveld! 🔥
        </h1>
        <p style="color: rgba(255,255,255,0.95); font-size: 18px; margin: 15px 0 0 0;">
          Kun 6 timer igjen, {{firstName}}
        </p>
      </div>

      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif;">

        <!-- Countdown Timer Visual -->
        <div style="background: #2d3436; padding: 30px; border-radius: 15px; text-align: center; margin: 30px 0;">
          <p style="color: white; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 2px;">
            Tilbudet utløper om
          </p>
          <div style="display: flex; justify-content: center; gap: 15px;">
            <div style="background: #ff6b6b; padding: 15px 20px; border-radius: 10px;">
              <p style="color: white; font-size: 32px; font-weight: bold; margin: 0;">06</p>
              <p style="color: rgba(255,255,255,0.8); font-size: 12px; margin: 5px 0 0 0;">Timer</p>
            </div>
            <div style="background: #ff6b6b; padding: 15px 20px; border-radius: 10px;">
              <p style="color: white; font-size: 32px; font-weight: bold; margin: 0;">23</p>
              <p style="color: rgba(255,255,255,0.8); font-size: 12px; margin: 5px 0 0 0;">Minutter</p>
            </div>
            <div style="background: #ff6b6b; padding: 15px 20px; border-radius: 10px;">
              <p style="color: white; font-size: 32px; font-weight: bold; margin: 0;">45</p>
              <p style="color: rgba(255,255,255,0.8); font-size: 12px; margin: 5px 0 0 0;">Sekunder</p>
            </div>
          </div>
        </div>

        <!-- Main Message -->
        <p style="font-size: 18px; line-height: 1.8; color: #333; margin: 30px 0;">
          Hei {{firstName}},
        </p>
        <p style="font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 25px;">
          Dette er det! Årets største tilbud utløper i kveld kl. 23:59.
          Vi har aldri tilbudt så mye rabatt før, og vi kommer ikke til å gjøre det igjen på lang tid.
        </p>

        <!-- Offer Details -->
        <div style="background: linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%); border: 3px solid #ff6b6b; padding: 35px; border-radius: 15px; text-align: center; margin: 35px 0;">
          <h2 style="color: #ff6b6b; font-size: 32px; margin: 0 0 20px 0; font-weight: bold;">
            40% RABATT
          </h2>
          <p style="font-size: 18px; color: #2d3436; margin: 15px 0; line-height: 1.6;">
            På alle {{profession}} tjenester
          </p>
          <div style="background: white; display: inline-block; padding: 12px 25px; border-radius: 10px; margin: 20px 0;">
            <p style="font-size: 16px; color: #2d3436; margin: 0;">
              Bruk kode: <strong style="font-size: 24px; color: #ff6b6b; letter-spacing: 2px;">SISTE40</strong>
            </p>
          </div>
          <div style="margin: 30px 0;">
            <a href="{{bookingLink}}" style="background: #ff6b6b; color: white; padding: 20px 60px; text-decoration: none; border-radius: 50px; font-size: 20px; font-weight: bold; display: inline-block; box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4); text-transform: uppercase;">
              Få Rabatten Nå! →
            </a>
          </div>
          <p style="font-size: 13px; color: #ff6b6b; margin: 15px 0 0 0; font-weight: bold;">
            ⚠️ Kun 8 plasser igjen!
          </p>
        </div>

        <!-- Why Act Now -->
        <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin: 35px 0;">
          <h3 style="font-size: 22px; color: #333; margin-top: 0; text-align: center;">
            Hvorfor handle nå?
          </h3>
          <ul style="font-size: 15px; line-height: 2; color: #555; padding-left: 20px;">
            <li><strong>40% rabatt</strong> – Vår største rabatt noensinne</li>
            <li><strong>Begrenset kapasitet</strong> – Kun 8 plasser igjen</li>
            <li><strong>Utløper i kveld</strong> – Ingen forlengelse</li>
            <li><strong>Gratis konsultasjon</strong> – Verdt 1500 kr inkludert</li>
            <li><strong>Fleksibel booking</strong> – Velg dato innen 6 måneder</li>
          </ul>
        </div>

        <!-- Social Proof -->
        <div style="background: white; padding: 25px; border-radius: 15px; margin: 35px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
          <p style="font-size: 14px; color: #999; text-align: center; margin: 0 0 20px 0; text-transform: uppercase; letter-spacing: 1px;">
            Hva andre sier
          </p>
          <div style="border-left: 4px solid #ff6b6b; padding-left: 20px; margin: 20px 0;">
            <p style="font-style: italic; color: #555; margin: 0; font-size: 15px;">"Jeg var skeptisk til rabatten, men kvaliteten var 100%! Beste investering jeg har gjort."
            </p>
            <p style="font-size: 13px; color: #888; margin: 10px 0 0 0;">
              – Kristine L. ⭐⭐⭐⭐⭐
            </p>
          </div>
        </div>

        <!-- Final CTA -->
        <div style="text-align: center; margin: 40px 0;">
          <p style="font-size: 18px; color: #333; margin-bottom: 20px; font-weight: bold;">
            Ikke la denne sjansen gå fra deg!
          </p>
          <a href="{{bookingLink}}" style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white; padding: 20px 60px; text-decoration: none; border-radius: 50px; font-size: 20px; font-weight: bold; display: inline-block; box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);">
            🔥 Få 40% Rabatt Nå →
          </a>
          <p style="font-size: 13px; color: #999; margin-top: 15px; font-style: italic;">
            Tilbudet utløper kl. 23:59 i kveld
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 50px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 12px; color: #999; margin: 5px 0;">
            {{businessName}} | {{businessAddress}}
          </p>
          <p style="font-size: 12px; color: #999; margin: 5px 0;">
            <a href="{{unsubscribeLink}}" style="color: #999; text-decoration: underline;">Avslutt abonnement</a>
          </p>
        </div>
      </div>
    `,
  },

  {
    id: 'testimonial-enhanced',
    title: 'Kundehistorier (Enhanced)',
    description: 'Powerful customer success story with before/after, results, and social proof',
    category: 'Social Proof',
    subject: '💎 {{firstName}}, hvordan Emma økte salget med 300% på 3 måneder',
    preheader: 'En inspirerende kundehistorie + hva du kan lære av den',
    tags: ['testimonial','case-study','social-proof','results'],
    cta: {
      primary: 'Få Samme Resultater',
      secondary: 'Les Flere Historier',
    },
    content: `
      <!-- Hero with Customer Quote -->
      <div style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); padding: 60px 20px; text-align: center;">
        <p style="color: #2d3436; font-size: 14px; margin: 0; text-transform: uppercase; letter-spacing: 2px;">
          Kundehistorie
        </p>
        <h1 style="color: #2d3436; font-size: 36px; margin: 20px 0; font-weight: bold; line-height: 1.3;">"Mine produktbilder økte salget<br/>med 300% på 3 måneder"
        </h1>
        <p style="color: #2d3436; font-size: 18px; margin: 15px 0 0 0; opacity: 0.8;">
          – Emma Johansen, Gründer av NordicHome
        </p>
      </div>

      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif;">

        <!-- Personal Intro -->
        <p style="font-size: 18px; line-height: 1.8; color: #333; margin: 30px 0;">
          Hei {{firstName}},
        </p>
        <p style="font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 30px;">
          I dag vil jeg dele en historie som virkelig inspirerer meg.
          Emma startet sin nettbutikk for 6 måneder siden, men salget gikk tregt.
          Så tok hun en beslutning som endret alt...
        </p>

        <!-- Customer Profile -->
        <div style="background: white; padding: 30px; border-radius: 15px; margin: 35px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <div style="display: flex; align-items: center; margin-bottom: 20px;">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: bold; color: white; margin-right: 20px;">
              E
            </div>
            <div>
              <h3 style="font-size: 22px; color: #2d3436; margin: 0;">Emma Johansen</h3>
              <p style="font-size: 14px; color: #888; margin: 5px 0 0 0;">Gründer, NordicHome</p>
            </div>
          </div>

          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0;">
            <strong>Bransje:</strong> E-handel (Interiør)<br/>
            <strong>Utfordring:</strong> Lave konverteringsrater<br/>
            <strong>Løsning:</strong> Profesjonell produktfotografering<br/>
            <strong>Resultat:</strong> 300% økning i salg på 3 måneder
          </p>
        </div>

        <!-- The Problem -->
        <div style="background: #fff5f5; border-left: 4px solid #ff6b6b; padding: 25px; border-radius: 10px; margin: 35px 0;">
          <h3 style="font-size: 20px; color: #ff6b6b; margin: 0 0 15px 0;">
            ❌ Utfordringen
          </h3>
          <p style="font-size: 15px; line-height: 1.7; color: #555; margin: 0;">"Jeg tok bildene selv med mobilen. De så OK ut, men salget var skuffende.
            Besøkende kom til nettbutikken, men få kjøpte. Jeg visste ikke hva jeg gjorde feil."
          </p>
        </div>

        <!-- The Solution -->
        <div style="background: #f0f9ff; border-left: 4px solid #4facfe; padding: 25px; border-radius: 10px; margin: 35px 0;">
          <h3 style="font-size: 20px; color: #4facfe; margin: 0 0 15px 0;">
            💡 Løsningen
          </h3>
          <p style="font-size: 15px; line-height: 1.7; color: #555; margin: 0;">"Jeg bestemte meg for å investere i profesjonell produktfotografering.
            {{businessName}} hjalp meg med å lage bilder som virkelig viste kvaliteten på produktene mine."
          </p>
        </div>

        <!-- The Results -->
        <div style="background: #f0fff4; border-left: 4px solid #28a745; padding: 25px; border-radius: 10px; margin: 35px 0;">
          <h3 style="font-size: 20px; color: #28a745; margin: 0 0 15px 0;">
            ✅ Resultatet
          </h3>
          <p style="font-size: 15px; line-height: 1.7; color: #555; margin: 0 0 20px 0;">"Forskjellen var umiddelbar. Innen første måned økte salget med 120%.
            Etter 3 måneder hadde jeg tredoblet omsetningen!"
          </p>

          <!-- Stats -->
          <div style="background: white; padding: 20px; border-radius: 10px;">
            <div style="display: flex; justify-content: space-around; text-align: center;">
              <div>
                <p style="font-size: 32px; font-weight: bold; color: #28a745; margin: 0;">+300%</p>
                <p style="font-size: 12px; color: #888; margin: 5px 0 0 0;">Salg</p>
              </div>
              <div>
                <p style="font-size: 32px; font-weight: bold; color: #28a745; margin: 0;">+180%</p>
                <p style="font-size: 12px; color: #888; margin: 5px 0 0 0;">Konvertering</p>
              </div>
              <div>
                <p style="font-size: 32px; font-weight: bold; color: #28a745; margin: 0;">-40%</p>
                <p style="font-size: 12px; color: #888; margin: 5px 0 0 0;">Returer</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Key Takeaways -->
        <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin: 35px 0;">
          <h3 style="font-size: 22px; color: #333; margin-top: 0; text-align: center;">
            🎯 Hva kan du lære?
          </h3>
          <ul style="font-size: 15px; line-height: 2; color: #555; padding-left: 20px;">
            <li><strong>Første inntrykk teller</strong> – Profesjonelle bilder bygger tillit</li>
            <li><strong>Vis kvalitet</strong> – Gode bilder reduserer returer</li>
            <li><strong>Invester smart</strong> – ROI på produktfoto er ofte 300-500%</li>
            <li><strong>Konkurransefortrinn</strong> – Skill deg ut fra konkurrentene</li>
          </ul>
        </div>

        <!-- CTA -->
        <div style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); padding: 40px 30px; border-radius: 15px; text-align: center; margin: 40px 0;">
          <h3 style="color: #2d3436; font-size: 24px; margin: 0 0 15px 0;">
            Klar for samme resultater?
          </h3>
          <p style="color: #2d3436; font-size: 16px; margin: 0 0 25px 0; opacity: 0.9;">
            La oss hjelpe deg med å øke salget ditt
          </p>
          <a href="{{bookingLink}}" style="background: #2d3436; color: white; padding: 18px 50px; text-decoration: none; border-radius: 50px; font-size: 18px; font-weight: bold; display: inline-block; box-shadow: 0 4px 15px rgba(45, 52, 54, 0.3);">
            Book Gratis Konsultasjon →
          </a>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 50px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 14px; color: #666; margin-bottom: 15px;">
            Vil du dele din historie? <a href="{{contactLink}}" style="color: #4facfe; text-decoration: none;">Kontakt oss</a>
          </p>
          <p style="font-size: 12px; color: #999; margin: 5px 0;">
            {{businessName}} | {{businessAddress}}
          </p>
          <p style="font-size: 12px; color: #999; margin: 5px 0;">
            <a href="{{unsubscribeLink}}" style="color: #999; text-decoration: underline;">Avslutt abonnement</a>
          </p>
        </div>
      </div>
    `,
  },
];

// Import additional templates
import { ENHANCED_NEWSLETTER_TEMPLATES_PART2 } from './enhancedNewsletterTemplates2';
import { ENHANCED_NEWSLETTER_TEMPLATES_PART3 } from'./enhancedNewsletterTemplates3';

// Export all enhanced templates combined
export const ALL_ENHANCED_NEWSLETTER_TEMPLATES: NewsletterTemplate[] = [
  ...ENHANCED_NEWSLETTER_TEMPLATES,
  ...ENHANCED_NEWSLETTER_TEMPLATES_PART2,
  ...ENHANCED_NEWSLETTER_TEMPLATES_PART3,
];

