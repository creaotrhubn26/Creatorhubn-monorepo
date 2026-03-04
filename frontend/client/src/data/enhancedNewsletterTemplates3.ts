/**
 * Enhanced Newsletter Templates Part 3
 * Final template: Event Invitation
 */

import type { NewsletterTemplate } from './enhancedNewsletterTemplates';

export const ENHANCED_NEWSLETTER_TEMPLATES_PART3: NewsletterTemplate[] = [
  {
    id: 'event-enhanced',
    title: 'Event Invitasjon (Enhanced)',
    description: 'Compelling event invitation with agenda, speakers, early bird pricing, and RSVP',
    category: 'Events',
    subject: '🎉 {{firstName}}, du er invitert! Eksklusivt fotoevent 15. mars',
    preheader: 'Lær fra bransjens beste + nettverking + gratis goodie bag',
    tags: ['event','invitation','workshop','networking'],
    cta: {
      primary: 'Meld Deg På Nå',
      secondary: 'Se Full Agenda',
    },
    content: `
      <!-- Event Header -->
      <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 60px 20px; text-align: center;">
        <p style="color: #2d3436; font-size: 14px; margin: 0; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">
          Du er invitert!
        </p>
        <h1 style="color: #2d3436; font-size: 38px; margin: 20px 0; font-weight: bold; line-height: 1.3;">
          Fotografi Masterclass 2024
        </h1>
        <p style="color: #2d3436; font-size: 20px; margin: 15px 0 0 0; font-weight: 600;">
          📅 15. mars 2024 | 🕐 10:00-17:00 | 📍 Oslo Kongressenter
        </p>
      </div>
      
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif;">
        
        <!-- Personal Invitation -->
        <p style="font-size: 18px; line-height: 1.8; color: #333; margin: 30px 0;">
          Hei {{firstName}},
        </p>
        <p style="font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 20px;">
          Vi er stolte av å invitere deg til årets største fotoevent i Norge! 
          En hel dag fylt med inspirasjon, læring og nettverking med bransjens beste.
        </p>
        <p style="font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 30px;">
          Dette er en eksklusiv mulighet til å ta dine ferdigheter til neste nivå.
        </p>
        
        <!-- Event Highlights -->
        <div style="background: white; border-radius: 15px; padding: 30px; margin: 35px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <h2 style="font-size: 24px; color: #fa709a; margin-top: 0; text-align: center;">
            ✨ Hva venter deg
          </h2>
          
          <div style="margin: 25px 0;">
            <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
              <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; width: 50px; height: 50px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-right: 15px; flex-shrink: 0;">
                🎓
              </div>
              <div>
                <h4 style="font-size: 17px; color: #333; margin: 0 0 5px 0; font-weight: bold;">3 Masterclasses</h4>
                <p style="font-size: 14px; color: #666; margin: 0; line-height: 1.6;">
                  Lær fra Norges beste fotografer innen portrett, bryllup og produktfoto
                </p>
              </div>
            </div>
            
            <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
              <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; width: 50px; height: 50px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-right: 15px; flex-shrink: 0;">
                🤝
              </div>
              <div>
                <h4 style="font-size: 17px; color: #333; margin: 0 0 5px 0; font-weight: bold;">Nettverking</h4>
                <p style="font-size: 14px; color: #666; margin: 0; line-height: 1.6;">
                  Møt 200+ fotografer, kreative og potensielle samarbeidspartnere
                </p>
              </div>
            </div>
            
            <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
              <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; width: 50px; height: 50px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-right: 15px; flex-shrink: 0;">
                📸
              </div>
              <div>
                <h4 style="font-size: 17px; color: #333; margin: 0 0 5px 0; font-weight: bold;">Hands-on Workshop</h4>
                <p style="font-size: 14px; color: #666; margin: 0; line-height: 1.6;">
                  Praktisk øving med profesjonelt utstyr og modeller
                </p>
              </div>
            </div>
            
            <div style="display: flex; align-items: flex-start;">
              <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; width: 50px; height: 50px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-right: 15px; flex-shrink: 0;">
                🎁
              </div>
              <div>
                <h4 style="font-size: 17px; color: #333; margin: 0 0 5px 0; font-weight: bold;">Goodie Bag</h4>
                <p style="font-size: 14px; color: #666; margin: 0; line-height: 1.6;">
                  Verdt 2000 kr med produkter fra våre sponsorer
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Agenda -->
        <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin: 35px 0;">
          <h2 style="font-size: 24px; color: #333; margin-top: 0; text-align: center;">
            📋 Program
          </h2>
          
          <div style="margin: 20px 0;">
            <div style="border-left: 4px solid #fa709a; padding-left: 20px; margin-bottom: 20px;">
              <p style="font-size: 14px; color: #fa709a; margin: 0; font-weight: bold;">10:00 - 10:30</p>
              <h4 style="font-size: 16px; color: #333; margin: 5px 0;">Registrering & Kaffe</h4>
              <p style="font-size: 14px; color: #666; margin: 5px 0 0 0;">Nettverking og goodie bag utdeling</p>
            </div>
            
            <div style="border-left: 4px solid #fa709a; padding-left: 20px; margin-bottom: 20px;">
              <p style="font-size: 14px; color: #fa709a; margin: 0; font-weight: bold;">10:30 - 12:00</p>
              <h4 style="font-size: 16px; color: #333; margin: 5px 0;">Masterclass: Portrettfotografering</h4>
              <p style="font-size: 14px; color: #666; margin: 5px 0 0 0;">Med Lisa Andersen, Årets Fotograf 2023</p>
            </div>
            
            <div style="border-left: 4px solid #fee140; padding-left: 20px; margin-bottom: 20px;">
              <p style="font-size: 14px; color: #fa709a; margin: 0; font-weight: bold;">12:00 - 13:00</p>
              <h4 style="font-size: 16px; color: #333; margin: 5px 0;">Lunsj & Nettverking</h4>
              <p style="font-size: 14px; color: #666; margin: 5px 0 0 0;">Gourmet lunsj inkludert</p>
            </div>
            
            <div style="border-left: 4px solid #fa709a; padding-left: 20px; margin-bottom: 20px;">
              <p style="font-size: 14px; color: #fa709a; margin: 0; font-weight: bold;">13:00 - 14:30</p>
              <h4 style="font-size: 16px; color: #333; margin: 5px 0;">Workshop: Bryllupsfotografering</h4>
              <p style="font-size: 14px; color: #666; margin: 5px 0 0 0;">Med Thomas Berg, 15 års erfaring</p>
            </div>
            
            <div style="border-left: 4px solid #fa709a; padding-left: 20px; margin-bottom: 20px;">
              <p style="font-size: 14px; color: #fa709a; margin: 0; font-weight: bold;">14:30 - 16:00</p>
              <h4 style="font-size: 16px; color: #333; margin: 5px 0;">Hands-on: Produktfotografering</h4>
              <p style="font-size: 14px; color: #666; margin: 5px 0 0 0;">Praktisk øving med profesjonelt utstyr</p>
            </div>
            
            <div style="border-left: 4px solid #fee140; padding-left: 20px;">
              <p style="font-size: 14px; color: #fa709a; margin: 0; font-weight: bold;">16:00 - 17:00</p>
              <h4 style="font-size: 16px; color: #333; margin: 5px 0;">Mingel & Avslutning</h4>
              <p style="font-size: 14px; color: #666; margin: 5px 0 0 0;">Drikke, snacks og nettverking</p>
            </div>
          </div>
        </div>

        <!-- Pricing -->
        <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 40px 30px; border-radius: 15px; text-align: center; margin: 40px 0; box-shadow: 0 6px 25px rgba(250, 112, 154, 0.4);">
          <h3 style="color: white; font-size: 28px; margin: 0 0 25px 0; font-weight: bold;">
            💰 Billettpriser
          </h3>

          <div style="background: white; border-radius: 10px; padding: 25px; margin: 20px 0;">
            <p style="font-size: 14px; color: #fa709a; margin: 0; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">
              Early Bird (Utløper 1. mars)
            </p>
            <p style="font-size: 42px; color: #2d3436; margin: 10px 0; font-weight: bold;">
              1.495 kr
            </p>
            <p style="font-size: 16px; color: #666; margin: 0;">
              <span style="text-decoration: line-through;">Ordinær pris: 2.495 kr</span>
            </p>
            <p style="font-size: 14px; color: #28a745; margin: 10px 0 0 0; font-weight: bold;">
              ✅ Spar 1.000 kr!
            </p>
          </div>

          <div style="background: rgba(255,255,255,0.3); border-radius: 10px; padding: 20px; margin: 20px 0;">
            <p style="font-size: 14px; color: white; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
              Ordinær pris (Etter 1. mars)
            </p>
            <p style="font-size: 32px; color: white; margin: 10px 0; font-weight: bold;">
              2.495 kr
            </p>
          </div>

          <div style="margin: 30px 0;">
            <a href="{{rsvpLink}}" style="background: #2d3436; color: white; padding: 20px 60px; text-decoration: none; border-radius: 50px; font-size: 20px; font-weight: bold; display: inline-block; box-shadow: 0 6px 20px rgba(45, 52, 54, 0.4); text-transform: uppercase;">
              🎟️ Meld Deg På Nå →
            </a>
          </div>

          <p style="color: white; font-size: 13px; margin: 15px 0 0 0; font-weight: bold;">
            ⏰ Kun 15 plasser igjen til Early Bird-pris!
          </p>
        </div>

        <!-- What's Included -->
        <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin: 35px 0;">
          <h3 style="font-size: 22px; color: #333; margin-top: 0; text-align: center;">
            ✅ Inkludert i billetten
          </h3>
          <ul style="font-size: 15px; line-height: 2; color: #555; padding-left: 20px;">
            <li>Tilgang til alle 3 masterclasses</li>
            <li>Hands-on workshop med profesjonelt utstyr</li>
            <li>Gourmet lunsj og drikke hele dagen</li>
            <li>Goodie bag verdt 2.000 kr</li>
            <li>Sertifikat ved fullført kurs</li>
            <li>Tilgang til eksklusiv Facebook-gruppe</li>
            <li>20% rabatt på fremtidige kurs</li>
            <li>Gratis parkering</li>
          </ul>
        </div>

        <!-- Testimonials from Previous Events -->
        <div style="background: white; padding: 30px; border-radius: 15px; margin: 35px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <h3 style="font-size: 22px; color: #333; margin-top: 0; text-align: center;">
            💬 Hva deltakere fra 2023 sier
          </h3>

          <div style="border-left: 4px solid #fa709a; padding-left: 20px; margin: 20px 0;">
            <p style="font-style: italic; color: #555; margin: 0; font-size: 15px; line-height: 1.6;">"Beste investering jeg har gjort i min karriere! Lærte mer på én dag enn jeg har gjort på ett år."
            </p>
            <p style="font-size: 13px; color: #888; margin: 15px 0 0 0;">
              – Martin K., Deltaker 2023 ⭐⭐⭐⭐⭐
            </p>
          </div>

          <div style="border-left: 4px solid #fee140; padding-left: 20px; margin: 20px 0;">
            <p style="font-style: italic; color: #555; margin: 0; font-size: 15px; line-height: 1.6;">"Nettverkingen alene var verdt prisen! Fikk 3 nye klienter samme uke."
            </p>
            <p style="font-size: 13px; color: #888; margin: 15px 0 0 0;">
              – Ingrid S., Deltaker 2023 ⭐⭐⭐⭐⭐
            </p>
          </div>
        </div>

        <!-- FAQ -->
        <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin: 35px 0;">
          <h3 style="font-size: 22px; color: #333; margin-top: 0; text-align: center;">
            ❓ Ofte stilte spørsmål
          </h3>

          <div style="margin: 20px 0;">
            <h4 style="font-size: 16px; color: #fa709a; margin: 0 0 8px 0;">Må jeg ta med eget utstyr?</h4>
            <p style="font-size: 14px; color: #666; margin: 0; line-height: 1.6;">
              Nei! Vi har alt utstyr du trenger. Men du er velkommen til å ta med ditt eget hvis du vil.
            </p>
          </div>

          <div style="margin: 20px 0;">
            <h4 style="font-size: 16px; color: #fa709a; margin: 0 0 8px 0;">Er dette for nybegynnere eller profesjonelle?</h4>
            <p style="font-size: 14px; color: #666; margin: 0; line-height: 1.6;">
              Begge deler! Vi har innhold for alle nivåer, fra nybegynnere til erfarne fotografer.
            </p>
          </div>

          <div style="margin: 20px 0;">
            <h4 style="font-size: 16px; color: #fa709a; margin: 0 0 8px 0;">Kan jeg få refundert hvis jeg ikke kan komme?</h4>
            <p style="font-size: 14px; color: #666; margin: 0; line-height: 1.6;">
              Ja! Full refusjon frem til 7 dager før eventet. Etter det kan du overføre billetten til noen andre.
            </p>
          </div>
        </div>

        <!-- Urgency -->
        <div style="background: linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%); border: 3px solid #ff6b6b; padding: 30px; border-radius: 15px; text-align: center; margin: 40px 0;">
          <p style="font-size: 48px; margin: 0;">⚠️</p>
          <h3 style="color: #ff6b6b; font-size: 24px; margin: 15px 0;">
            Begrenset kapasitet!
          </h3>
          <p style="font-size: 16px; color: #2d3436; margin: 0;">
            Kun 50 plasser totalt. 35 allerede solgt.<br/>
            Early Bird-prisen utløper om <strong>5 dager</strong>.
          </p>
        </div>

        <!-- Final CTA -->
        <div style="text-align: center; margin: 40px 0;">
          <p style="font-size: 20px; color: #333; margin-bottom: 20px; font-weight: bold;">
            Sikre din plass nå! 🎉
          </p>
          <a href="{{rsvpLink}}" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 22px 70px; text-decoration: none; border-radius: 50px; font-size: 22px; font-weight: bold; display: inline-block; box-shadow: 0 6px 20px rgba(250, 112, 154, 0.4); text-transform: uppercase;">
            Meld Deg På Nå →
          </a>
          <p style="font-size: 13px; color: #999; margin-top: 15px;">
            Eller <a href="{{agendaLink}}" style="color: #fa709a; text-decoration: none;">se full agenda her</a>
          </p>
        </div>

        <!-- Contact -->
        <div style="background: #f8f9fa; padding: 25px; border-radius: 15px; margin: 35px 0; text-align: center;">
          <p style="font-size: 15px; color: #666; margin: 0;">
            Har du spørsmål? Kontakt oss på<br/>
            <a href="mailto:{{contactEmail}}" style="color: #fa709a; text-decoration: none; font-weight: bold;">{{contactEmail}}</a>
            eller ring <a href="tel:{{contactPhone}}" style="color: #fa709a; text-decoration: none; font-weight: bold;">{{contactPhone}}</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 50px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 14px; color: #666; margin-bottom: 15px;">
            Vi gleder oss til å se deg! 🎉
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

// Export combined templates
export const ALL_ENHANCED_NEWSLETTER_TEMPLATES = [
  ...ENHANCED_NEWSLETTER_TEMPLATES_PART3,
];


