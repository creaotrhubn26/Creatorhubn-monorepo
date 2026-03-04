/**
 * Enhanced Newsletter Templates Part 2
 * Additional 4 templates: Seasonal, Re-engagement, Educational, Event
 */

import type { NewsletterTemplate } from './enhancedNewsletterTemplates';

export const ENHANCED_NEWSLETTER_TEMPLATES_PART2: NewsletterTemplate[] = [
  {
    id: 'seasonal-enhanced',
    title: 'Sesongkampanje (Enhanced)',
    description: 'Seasonal campaign with holiday theme, gift guide, and limited-time offer',
    category: 'Seasonal',
    subject: '🎄 {{firstName}}, perfekte julegaver + 25% rabatt (kun i desember)',
    preheader: 'Gi bort minner som varer evig – se vår julegaveguide',
    tags: ['seasonal','holiday','gift','christmas'],
    cta: {
      primary: 'Se Gaveguiden',
      secondary: 'Book Juleshooting',
    },
    content: `
      <!-- Festive Header -->
      <div style="background: linear-gradient(135deg, #c94b4b 0%, #4b134f 100%); padding: 60px 20px; text-align: center; position: relative;">
        <p style="color: white; font-size: 48px; margin: 0;">🎄</p>
        <h1 style="color: white; font-size: 38px; margin: 15px 0; font-weight: bold;">
          Julegaveguide 2024
        </h1>
        <p style="color: rgba(255,255,255,0.95); font-size: 18px; margin: 15px 0 0 0;">
          Gi bort minner som varer evig, {{firstName}}
        </p>
      </div>
      
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif;">
        
        <!-- Intro -->
        <p style="font-size: 18px; line-height: 1.8; color: #333; margin: 30px 0;">
          Hei {{firstName}},
        </p>
        <p style="font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 30px;">
          Julen nærmer seg, og vi vet at du leter etter den perfekte gaven. 
          Hva om du kunne gi bort noe som virkelig betyr noe? 
          Noe som vil bli verdsatt i generasjoner?
        </p>
        
        <!-- Gift Ideas -->
        <h2 style="font-size: 28px; color: #c94b4b; text-align: center; margin: 40px 0 30px 0;">
          🎁 Våre mest populære julegaver
        </h2>
        
        <!-- Gift 1 -->
        <div style="background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); margin: 30px 0;">
          <div style="background: linear-gradient(135deg, #c94b4b 0%, #4b134f 100%); height: 200px; display: flex; align-items: center; justify-content: center;">
            <p style="color: white; font-size: 24px; margin: 0;">👨‍👩‍👧‍👦 Familiefotografering</p>
          </div>
          <div style="padding: 25px;">
            <h3 style="font-size: 20px; color: #333; margin: 0 0 10px 0;">Familiefotografering</h3>
            <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0 0 15px 0;">
              Perfekt for besteforeldre! Samle hele familien for et minne som varer evig.
            </p>
            <p style="font-size: 18px; color: #c94b4b; font-weight: bold; margin: 0;">
              Fra 2.500 kr <span style="text-decoration: line-through; color: #999; font-size: 14px;">3.500 kr</span>
            </p>
          </div>
        </div>
        
        <!-- Gift 2 -->
        <div style="background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); margin: 30px 0;">
          <div style="background: linear-gradient(135deg, #4b134f 0%, #c94b4b 100%); height: 200px; display: flex; align-items: center; justify-content: center;">
            <p style="color: white; font-size: 24px; margin: 0;">💑 Parphotoshoot</p>
          </div>
          <div style="padding: 25px;">
            <h3 style="font-size: 20px; color: #333; margin: 0 0 10px 0;">Romantisk Parphotoshoot</h3>
            <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0 0 15px 0;">
              Feir kjærligheten! Perfekt gave til din partner eller et forlovet par.
            </p>
            <p style="font-size: 18px; color: #c94b4b; font-weight: bold; margin: 0;">
              Fra 1.800 kr <span style="text-decoration: line-through; color: #999; font-size: 14px;">2.500 kr</span>
            </p>
          </div>
        </div>
        
        <!-- Gift 3 -->
        <div style="background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); margin: 30px 0;">
          <div style="background: linear-gradient(135deg, #c94b4b 0%, #4b134f 100%); height: 200px; display: flex; align-items: center; justify-content: center;">
            <p style="color: white; font-size: 24px; margin: 0;">🎨 Gavekort</p>
          </div>
          <div style="padding: 25px;">
            <h3 style="font-size: 20px; color: #333; margin: 0 0 10px 0;">Fleksibelt Gavekort</h3>
            <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0 0 15px 0;">
              La mottakeren velge selv! Gyldig i 12 måneder på alle våre tjenester.
            </p>
            <p style="font-size: 18px; color: #c94b4b; font-weight: bold; margin: 0;">
              Valgfritt beløp (min. 500 kr)
            </p>
          </div>
        </div>
        
        <!-- Special Offer -->
        <div style="background: linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%); border: 3px solid #c94b4b; padding: 35px; border-radius: 15px; text-align: center; margin: 40px 0;">
          <p style="font-size: 14px; color: #c94b4b; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">
            🎄 Juletilbud
          </p>
          <h3 style="color: #c94b4b; font-size: 32px; margin: 0 0 15px 0; font-weight: bold;">
            25% RABATT
          </h3>
          <p style="font-size: 16px; color: #2d3436; margin: 0 0 20px 0;">
            på alle julegaver bestilt i desember
          </p>
          <div style="margin: 25px 0;">
            <a href="{{bookingLink}}" style="background: #c94b4b; color: white; padding: 18px 50px; text-decoration: none; border-radius: 50px; font-size: 18px; font-weight: bold; display: inline-block; box-shadow: 0 4px 15px rgba(201, 75, 75, 0.4);">
              🎁 Bestill Julegave →
            </a>
          </div>
          <p style="font-size: 13px; color: #c94b4b; margin: 15px 0 0 0;">
            ⏰ Siste bestillingsfrist: 20. desember
          </p>
        </div>
        
        <!-- Why Choose Us -->
        <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin: 35px 0;">
          <h3 style="font-size: 22px; color: #333; margin-top: 0; text-align: center;">
            ✨ Hvorfor velge oss?
          </h3>
          <ul style="font-size: 15px; line-height: 2; color: #555; padding-left: 20px;">
            <li><strong>Fleksibel booking</strong> – Gavemottaker velger dato selv</li>
            <li><strong>Vakker emballasje</strong> – Gavekort i elegant konvolutt</li>
            <li><strong>Digital levering</strong> – Få gavekortet på e-post samme dag</li>
            <li><strong>12 måneders gyldighet</strong> – Ingen stress med booking</li>
            <li><strong>Gratis ombooking</strong> – Hvis noe skulle komme i veien</li>
          </ul>
        </div>
        
        <!-- Testimonial -->
        <div style="background: white; padding: 25px; border-radius: 15px; margin: 35px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
          <div style="border-left: 4px solid #c94b4b; padding-left: 20px;">
            <p style="font-style: italic; color: #555; margin: 0; font-size: 15px; line-height: 1.6;">"Beste julegaven jeg har gitt! Mamma gråt av glede når hun så bildene. 
              Takk for at dere gjorde dette så enkelt!"
            </p>
            <p style="font-size: 13px; color: #888; margin: 15px 0 0 0;">
              – Sofie H., Fornøyd kunde ⭐⭐⭐⭐⭐
            </p>
          </div>
        </div>
        
        <!-- CTA -->
        <div style="text-align: center; margin: 40px 0;">
          <p style="font-size: 18px; color: #333; margin-bottom: 20px; font-weight: bold;">
            Gi en gave som varer evig 🎄
          </p>
          <a href="{{bookingLink}}" style="background: linear-gradient(135deg, #c94b4b 0%, #4b134f 100%); color: white; padding: 20px 60px; text-decoration: none; border-radius: 50px; font-size: 20px; font-weight: bold; display: inline-block; box-shadow: 0 6px 20px rgba(201, 75, 75, 0.4);">
            Se Alle Gavealternativer →
          </a>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; margin-top: 50px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 14px; color: #666; margin-bottom: 15px;">
            God jul fra oss i {{businessName}}! 🎄✨
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
    id: 'reengagement-enhanced',
    title: 'Re-engagement (Enhanced)',
    description: 'Win-back email with emotional appeal, special comeback offer, and easy return',
    category: 'Retention',
    subject: '💔 {{firstName}}, vi savner deg... Her er 30% rabatt for å komme tilbake',
    preheader: 'Det har vært stille – la oss gjøre det godt igjen',
    tags: ['re-engagement','win-back','retention','comeback'],
    cta: {
      primary: 'Kom Tilbake Med 30% Rabatt',
      secondary: 'Se Hva Du Har Gått Glipp Av',
    },
    content: `
      <!-- Emotional Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 60px 20px; text-align: center;">
        <p style="color: white; font-size: 48px; margin: 0;">💔</p>
        <h1 style="color: white; font-size: 36px; margin: 20px 0; font-weight: bold; line-height: 1.3;">
          Vi savner deg, {{firstName}}
        </h1>
        <p style="color: rgba(255,255,255,0.95); font-size: 18px; margin: 15px 0 0 0;">
          Det har vært stille fra deg i det siste...
        </p>
      </div>

      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif;">

        <!-- Personal Message -->
        <p style="font-size: 18px; line-height: 1.8; color: #333; margin: 30px 0;">
          Hei {{firstName}},
        </p>
        <p style="font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 20px;">
          Jeg la merke til at det har gått en stund siden sist vi hørte fra deg.
          Kanskje livet ble travelt? Eller kanskje vi ikke levde opp til forventningene dine?
        </p>
        <p style="font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 30px;">
          Uansett grunn – vi vil gjerne ha deg tilbake.
          Og vi vil gjøre det verdt din tid.
        </p>

        <!-- What You've Missed -->
        <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin: 35px 0;">
          <h2 style="font-size: 24px; color: #667eea; margin-top: 0; text-align: center;">
            ✨ Hva du har gått glipp av
          </h2>

          <div style="margin: 25px 0;">
            <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
              <div style="background: #667eea; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0;">
                1
              </div>
              <div>
                <h4 style="font-size: 16px; color: #333; margin: 0 0 5px 0;">Nye tjenester</h4>
                <p style="font-size: 14px; color: #666; margin: 0; line-height: 1.6;">
                  Vi har lansert 3 nye pakker som våre kunder elsker
                </p>
              </div>
            </div>

            <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
              <div style="background: #667eea; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0;">
                2
              </div>
              <div>
                <h4 style="font-size: 16px; color: #333; margin: 0 0 5px 0;">Forbedret kvalitet</h4>
                <p style="font-size: 14px; color: #666; margin: 0; line-height: 1.6;">
                  Nytt utstyr og teknikker for enda bedre resultater
                </p>
              </div>
            </div>

            <div style="display: flex; align-items: flex-start;">
              <div style="background: #667eea; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0;">
                3
              </div>
              <div>
                <h4 style="font-size: 16px; color: #333; margin: 0 0 5px 0;">Raskere levering</h4>
                <p style="font-size: 14px; color: #666; margin: 0; line-height: 1.6;">
                  Få bildene dine innen 48 timer (tidligere 7 dager)
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Comeback Offer -->
        <div style="background: linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%); border: 3px solid #667eea; padding: 40px 30px; border-radius: 15px; text-align: center; margin: 40px 0; box-shadow: 0 6px 25px rgba(102, 126, 234, 0.3);">
          <p style="font-size: 14px; color: #667eea; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">
            💝 Velkommen Tilbake-Tilbud
          </p>
          <h3 style="color: #667eea; font-size: 36px; margin: 0 0 15px 0; font-weight: bold;">
            30% RABATT
          </h3>
          <p style="font-size: 18px; color: #2d3436; margin: 0 0 10px 0; font-weight: bold;">
            + Gratis oppgradering til premium pakke
          </p>
          <p style="font-size: 15px; color: #666; margin: 0 0 25px 0;">
            Kun for deg, {{firstName}}
          </p>
          <div style="background: white; display: inline-block; padding: 12px 25px; border-radius: 10px; margin: 20px 0;">
            <p style="font-size: 16px; color: #2d3436; margin: 0;">
              Bruk kode: <strong style="font-size: 24px; color: #667eea; letter-spacing: 2px;">COMEBACK30</strong>
            </p>
          </div>
          <div style="margin: 30px 0;">
            <a href="{{bookingLink}}" style="background: #667eea; color: white; padding: 20px 60px; text-decoration: none; border-radius: 50px; font-size: 20px; font-weight: bold; display: inline-block; box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);">
              💙 Kom Tilbake Nå →
            </a>
          </div>
          <p style="font-size: 13px; color: #667eea; margin: 15px 0 0 0; font-weight: bold;">
            ⏰ Tilbudet utløper om 7 dager
          </p>
        </div>

        <!-- Social Proof -->
        <div style="background: white; padding: 30px; border-radius: 15px; margin: 35px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <h3 style="font-size: 20px; color: #333; margin-top: 0; text-align: center;">
            💬 Hva andre sier
          </h3>

          <div style="border-left: 4px solid #667eea; padding-left: 20px; margin: 20px 0;">
            <p style="font-style: italic; color: #555; margin: 0; font-size: 15px; line-height: 1.6;">"Jeg kom tilbake etter et år, og wow! Kvaliteten er enda bedre enn jeg husket.
              Så glad jeg ga dem en ny sjanse!"
            </p>
            <p style="font-size: 13px; color: #888; margin: 15px 0 0 0;">
              – Linda M. ⭐⭐⭐⭐⭐
            </p>
          </div>
        </div>

        <!-- Easy Return -->
        <div style="background: #f0f9ff; padding: 30px; border-radius: 15px; margin: 35px 0; text-align: center;">
          <h3 style="font-size: 22px; color: #333; margin-top: 0;">
            Ingen forpliktelser
          </h3>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0;">
            Book en gratis konsultasjon først. Ingen binding, ingen skjulte kostnader.
            Hvis vi ikke er riktig match, er det helt greit.
          </p>
        </div>

        <!-- Final CTA -->
        <div style="text-align: center; margin: 40px 0;">
          <p style="font-size: 18px; color: #333; margin-bottom: 20px; font-weight: bold;">
            La oss prøve igjen? 💙
          </p>
          <a href="{{bookingLink}}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 60px; text-decoration: none; border-radius: 50px; font-size: 20px; font-weight: bold; display: inline-block; box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);">
            Ja, jeg vil komme tilbake →
          </a>
          <p style="font-size: 13px; color: #999; margin-top: 15px;">
            Eller <a href="{{feedbackLink}}" style="color: #667eea; text-decoration: none;">fortell oss hvorfor du forlot oss</a>
          </p>
        </div>

        <!-- P.S. -->
        <div style="margin-top: 50px; padding-top: 30px; border-top: 2px solid #e0e0e0;">
          <p style="font-size: 15px; color: #666; line-height: 1.6;">
            <strong style="color: #667eea;">P.S.</strong> Hvis du ikke er interessert,
            kan du <a href="{{unsubscribeLink}}" style="color: #667eea; text-decoration: none;">avslutte abonnementet her</a>.
            Vi vil ikke plage deg mer. Men vi håper virkelig du gir oss en ny sjanse! 💙
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 50px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 12px; color: #999; margin: 5px 0;">
            {{businessName}} | {{businessAddress}}
          </p>
        </div>
      </div>
    `,
  },

  {
    id: 'educational-enhanced',
    title: 'Utdannelsesinnhold (Enhanced)',
    description: 'Value-packed educational email with step-by-step guide, tips, and free resource',
    category: 'Education',
    subject: '📚 {{firstName}}, 5 hemmeligheter for perfekte bilder (+ gratis guide)',
    preheader: 'Lær triksene profesjonelle fotografer bruker hver dag',
    tags: ['educational','tutorial','tips','value','guide'],
    cta: {
      primary: 'Last Ned Gratis Guide',
      secondary: 'Book Fotokurs',
    },
    content: `
      <!-- Educational Header -->
      <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 60px 20px; text-align: center;">
        <p style="color: white; font-size: 48px; margin: 0;">📚</p>
        <h1 style="color: white; font-size: 36px; margin: 20px 0; font-weight: bold; line-height: 1.3;">
          5 Hemmeligheter for<br/>Perfekte Bilder
        </h1>
        <p style="color: rgba(255,255,255,0.95); font-size: 18px; margin: 15px 0 0 0;">
          Lær triksene profesjonelle fotografer bruker
        </p>
      </div>

      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif;">

        <!-- Intro -->
        <p style="font-size: 18px; line-height: 1.8; color: #333; margin: 30px 0;">
          Hei {{firstName}},
        </p>
        <p style="font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 30px;">
          Etter 10 år som profesjonell {{profession}}, har jeg lært noen triks som
          gjør en enorm forskjell. I dag deler jeg 5 av mine beste hemmeligheter med deg – gratis!
        </p>

        <!-- Tip 1 -->
        <div style="background: white; border-radius: 15px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-left: 5px solid #f093fb;">
          <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; margin-right: 15px;">
              1
            </div>
            <h3 style="font-size: 22px; color: #333; margin: 0;">Golden Hour er magisk</h3>
          </div>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0 0 15px 0;">
            <strong>Hva:</strong> Fotografer 1 time før solnedgang eller etter soloppgang.
          </p>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0 0 15px 0;">
            <strong>Hvorfor:</strong> Lyset er mykt, varmt og flaterende. Ingen harde skygger!
          </p>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0;">
            <strong>Pro-tips:</strong> Bruk apper som "Golden Hour Calculator" for å finne perfekt tidspunkt.
          </p>
        </div>

        <!-- Tip 2 -->
        <div style="background: white; border-radius: 15px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-left: 5px solid #f5576c;">
          <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <div style="background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%); color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; margin-right: 15px;">
              2
            </div>
            <h3 style="font-size: 22px; color: #333; margin: 0;">Tredjedelsregelen</h3>
          </div>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0 0 15px 0;">
            <strong>Hva:</strong> Del bildet i 9 like deler (3x3 rutenett). Plasser motivet på skjæringspunktene.
          </p>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0 0 15px 0;">
            <strong>Hvorfor:</strong> Skaper mer interessante og balanserte bilder enn sentrert komposisjon.
          </p>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0;">
            <strong>Pro-tips:</strong> Slå på rutenett i kamerainnstillingene dine!
          </p>
        </div>

        <!-- Tip 3 -->
        <div style="background: white; border-radius: 15px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-left: 5px solid #f093fb;">
          <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; margin-right: 15px;">
              3
            </div>
            <h3 style="font-size: 22px; color: #333; margin: 0;">Bakgrunnen er like viktig</h3>
          </div>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0 0 15px 0;">
            <strong>Hva:</strong> Sjekk alltid hva som er bak motivet ditt før du tar bildet.
          </p>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0 0 15px 0;">
            <strong>Hvorfor:</strong> En rotete bakgrunn distraherer fra hovedmotivet.
          </p>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0;">
            <strong>Pro-tips:</strong> Bruk lav f-stop (f/1.8-f/2.8) for å gjøre bakgrunnen uskarp.
          </p>
        </div>

        <!-- Tip 4 -->
        <div style="background: white; border-radius: 15px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-left: 5px solid #f5576c;">
          <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <div style="background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%); color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; margin-right: 15px;">
              4
            </div>
            <h3 style="font-size: 22px; color: #333; margin: 0;">Naturlig posering</h3>
          </div>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0 0 15px 0;">
            <strong>Hva:</strong> Be folk om å bevege seg, le, snakke – ikke bare stå stille.
          </p>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0 0 15px 0;">
            <strong>Hvorfor:</strong> Naturlige øyeblikk ser bedre ut enn stive poser.
          </p>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0;">
            <strong>Pro-tips:</strong> Ta mange bilder! De beste øyeblikkene skjer mellom posene.
          </p>
        </div>

        <!-- Tip 5 -->
        <div style="background: white; border-radius: 15px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-left: 5px solid #f093fb;">
          <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; margin-right: 15px;">
              5
            </div>
            <h3 style="font-size: 22px; color: #333; margin: 0;">Redigering er nøkkelen</h3>
          </div>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0 0 15px 0;">
            <strong>Hva:</strong> Alle profesjonelle bilder er redigert. Alltid.
          </p>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0 0 15px 0;">
            <strong>Hvorfor:</strong> Redigering løfter bildene fra "bra" til "wow!"
          </p>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0;">
            <strong>Pro-tips:</strong> Start med Lightroom presets for konsistent look.
          </p>
        </div>

        <!-- Free Resource -->
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 30px; border-radius: 15px; text-align: center; margin: 40px 0; box-shadow: 0 6px 25px rgba(240, 147, 251, 0.4);">
          <p style="font-size: 48px; margin: 0 0 15px 0;">🎁</p>
          <h3 style="color: white; font-size: 26px; margin: 0 0 15px 0; font-weight: bold;">
            Gratis Nedlastbar Guide
          </h3>
          <p style="color: rgba(255,255,255,0.95); font-size: 16px; margin: 0 0 25px 0;">"10 Fotograferingstips for Nybegynnere"<br/>
            PDF-guide med illustrasjoner og eksempler
          </p>
          <a href="{{guideLink}}" style="background: white; color: #f5576c; padding: 18px 50px; text-decoration: none; border-radius: 50px; font-size: 18px; font-weight: bold; display: inline-block; box-shadow: 0 4px 15px rgba(255,255,255,0.3);">
            📥 Last Ned Gratis →
          </a>
        </div>

        <!-- Want More? -->
        <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin: 35px 0; text-align: center;">
          <h3 style="font-size: 22px; color: #333; margin-top: 0;">
            Vil du lære mer?
          </h3>
          <p style="font-size: 15px; line-height: 1.7; color: #666; margin: 0 0 20px 0;">
            Vi holder fotokurs hver måned! Lær fra profesjonelle fotografer i små grupper.
          </p>
          <a href="{{courseLink}}" style="color: #f5576c; text-decoration: none; font-weight: bold; font-size: 16px;">
            Se Kommende Kurs →
          </a>
        </div>

        <!-- CTA -->
        <div style="text-align: center; margin: 40px 0;">
          <p style="font-size: 18px; color: #333; margin-bottom: 20px; font-weight: bold;">
            Eller la oss ta bildene for deg! 📸
          </p>
          <a href="{{bookingLink}}" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px 60px; text-decoration: none; border-radius: 50px; font-size: 20px; font-weight: bold; display: inline-block; box-shadow: 0 6px 20px rgba(240, 147, 251, 0.4);">
            Book Profesjonell Fotografering →
          </a>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 50px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 14px; color: #666; margin-bottom: 15px;">
            Fant du denne guiden nyttig? Del den gjerne med venner! 💙
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

