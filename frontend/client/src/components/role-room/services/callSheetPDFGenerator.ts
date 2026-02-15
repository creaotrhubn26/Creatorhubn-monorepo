/**
 * Call Sheet PDF Generator
 * Generates professional call sheets with Norwegian localization
 */

import { CallSheet, CallSheetScene, CastCallItem, CrewCallItem, MealBreak } from './productionWorkflowService';

// ============================================
// PDF TEMPLATE TYPES
// ============================================

export interface CallSheetPDFOptions {
  format: 'A4' | 'Letter';
  includeMap: boolean;
  includeWeather: boolean;
  includeContacts: boolean;
  companyLogo?: string;
  watermark?: string;
  language: 'no' | 'en';
}

export interface PDFSection {
  type: 'header' | 'info' | 'table' | 'notes' | 'footer';
  content: string | string[] | Record<string, unknown>[];
}

// Norwegian translations
const NO_TRANSLATIONS = {
  callSheet: 'Opptak',
  day: 'Dag',
  date: 'Dato',
  generalCall: 'Generelt oppmøte',
  director: 'Regissør',
  producer: 'Produsent',
  production: 'Produksjonsselskap',
  weather: 'Vær',
  sunrise: 'Soloppgang',
  sunset: 'Solnedgang',
  temperature: 'Temperatur',
  
  // Cast section
  cast: 'Skuespillere',
  character: 'Rolle',
  callTime: 'Oppmøte',
  makeupTime: 'Sminke',
  onSet: 'På sett',
  scenes: 'Scener',
  
  // Crew section
  crew: 'Crew',
  role: 'Stilling',
  department: 'Avdeling',
  
  // Scenes section
  sceneList: 'Sceneplan',
  sceneNumber: 'Scene',
  description: 'Beskrivelse',
  location: 'Lokasjon',
  intExt: 'INT/EXT',
  timeOfDay: 'Tid',
  pages: 'Sider',
  estTime: 'Estimert',
  
  // Meals
  meals: 'Måltider',
  breakfast: 'Frokost',
  lunch: 'Lunsj',
  dinner: 'Middag',
  snack: 'Mellommåltid',
  
  // Equipment
  equipment: 'Utstyr',
  
  // Locations
  locations: 'Lokasjoner',
  address: 'Adresse',
  parking: 'Parkering',
  contact: 'Kontaktperson',
  
  // Notes & Safety
  notes: 'Notater',
  safetyInfo: 'Sikkerhet',
  nearestHospital: 'Nærmeste sykehus',
  
  // Contacts
  emergencyContacts: 'Nødkontakter',
  
  // Footer
  confidential: 'KONFIDENSIELL - KUN FOR PRODUKSJONSTEAMET',
  version: 'Versjon',
  generated: 'Generert',
};

const EN_TRANSLATIONS = {
  callSheet: 'Call Sheet',
  day: 'Day',
  date: 'Date',
  generalCall: 'General Call',
  director: 'Director',
  producer: 'Producer',
  production: 'Production Company',
  weather: 'Weather',
  sunrise: 'Sunrise',
  sunset: 'Sunset',
  temperature: 'Temperature',
  
  cast: 'Cast',
  character: 'Character',
  callTime: 'Call Time',
  makeupTime: 'Makeup',
  onSet: 'On Set',
  scenes: 'Scenes',
  
  crew: 'Crew',
  role: 'Role',
  department: 'Department',
  
  sceneList: 'Scene Schedule',
  sceneNumber: 'Scene',
  description: 'Description',
  location: 'Location',
  intExt: 'INT/EXT',
  timeOfDay: 'Time',
  pages: 'Pages',
  estTime: 'Est. Time',
  
  meals: 'Meals',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  
  equipment: 'Equipment',
  
  locations: 'Locations',
  address: 'Address',
  parking: 'Parking',
  contact: 'Contact',
  
  notes: 'Notes',
  safetyInfo: 'Safety Information',
  nearestHospital: 'Nearest Hospital',
  
  emergencyContacts: 'Emergency Contacts',
  
  confidential: 'CONFIDENTIAL - FOR PRODUCTION TEAM ONLY',
  version: 'Version',
  generated: 'Generated',
};

// ============================================
// HTML TEMPLATE GENERATOR
// ============================================

function formatDate(dateStr: string, language: 'no' | 'en'): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return date.toLocaleDateString(language === 'no' ? 'nb-NO' : 'en-US', options);
}

function getMealTranslation(type: MealBreak['type'], t: typeof NO_TRANSLATIONS): string {
  switch (type) {
    case 'breakfast': return t.breakfast;
    case 'lunch': return t.lunch;
    case 'dinner': return t.dinner;
    case 'snack': return t.snack;
    default: return type;
  }
}

function generateCastTable(cast: CastCallItem[], scenes: string, t: typeof NO_TRANSLATIONS): string {
  if (cast.length === 0) return '';
  
  const rows = cast.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.character}</td>
      <td class="time-cell">${c.callTime}</td>
      <td class="time-cell">${c.makeupTime || '-'}</td>
      <td class="time-cell">${c.onSetTime || '-'}</td>
      <td>${c.scenes.join(', ')}</td>
      <td class="phone">${c.phone || '-'}</td>
    </tr>
  `).join('');
  
  return `
    <div class="section">
      <h2>🎭 ${t.cast}${scenes ? ` · ${scenes}` : ''}</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>Navn</th>
            <th>${t.character}</th>
            <th>${t.callTime}</th>
            <th>${t.makeupTime}</th>
            <th>${t.onSet}</th>
            <th>${t.scenes}</th>
            <th>Telefon</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function generateCrewTable(crew: CrewCallItem[], t: typeof NO_TRANSLATIONS): string {
  if (crew.length === 0) return '';
  
  // Group by department
  const departments: Record<string, CrewCallItem[]> = {};
  crew.forEach(c => {
    if (!departments[c.department]) {
      departments[c.department] = [];
    }
    departments[c.department].push(c);
  });
  
  let html = `<div class="section"><h2>🎬 ${t.crew}</h2>`;
  
  for (const [dept, members] of Object.entries(departments)) {
    html += `
      <h3 class="department-header">${dept}</h3>
      <table class="data-table compact">
        <thead>
          <tr>
            <th>Navn</th>
            <th>${t.role}</th>
            <th>${t.callTime}</th>
            <th>Telefon</th>
          </tr>
        </thead>
        <tbody>
          ${members.map(m => `
            <tr>
              <td><strong>${m.name}</strong></td>
              <td>${m.role}</td>
              <td class="time-cell">${m.callTime}</td>
              <td class="phone">${m.phone || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
  
  html += '</div>';
  return html;
}

function generateSceneTable(scenes: CallSheetScene[], t: typeof NO_TRANSLATIONS): string {
  if (scenes.length === 0) return '';
  
  const rows = scenes.map(s => `
    <tr>
      <td class="scene-number">${s.sceneNumber}</td>
      <td>${s.intExt}</td>
      <td>${s.location}</td>
      <td>${s.timeOfDay}</td>
      <td>${s.pages}</td>
      <td>${s.cast.join(', ')}</td>
      <td>${s.estimatedTime}</td>
    </tr>
  `).join('');
  
  return `
    <div class="section">
      <h2>📋 ${t.sceneList}</h2>
      <table class="data-table scene-table">
        <thead>
          <tr>
            <th>${t.sceneNumber}</th>
            <th>${t.intExt}</th>
            <th>${t.location}</th>
            <th>${t.timeOfDay}</th>
            <th>${t.pages}</th>
            <th>${t.cast}</th>
            <th>${t.estTime}</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

export function generateCallSheetHTML(callSheet: CallSheet, options: CallSheetPDFOptions): string {
  const t = options.language === 'no' ? NO_TRANSLATIONS : EN_TRANSLATIONS;
  
  const weatherSection = options.includeWeather && callSheet.weather ? `
    <div class="weather-box">
      <h3>☀️ ${t.weather}</h3>
      <div class="weather-grid">
        <div class="weather-item">
          <span class="weather-icon">${getWeatherIcon(callSheet.weather.condition)}</span>
          <span>${callSheet.weather.condition}</span>
        </div>
        <div class="weather-item">
          <span>🌡️</span>
          <span>${callSheet.weather.temperature}°C</span>
        </div>
        <div class="weather-item">
          <span>🌅</span>
          <span>${t.sunrise}: ${callSheet.weather.sunrise}</span>
        </div>
        <div class="weather-item">
          <span>🌇</span>
          <span>${t.sunset}: ${callSheet.weather.sunset}</span>
        </div>
      </div>
      ${callSheet.weather.forecast ? `<p class="forecast">${callSheet.weather.forecast}</p>` : ''}
    </div>
  ` : '';
  
  const mealsSection = callSheet.meals.length > 0 ? `
    <div class="info-box meals-box">
      <h3>🍽️ ${t.meals}</h3>
      <ul class="meals-list">
        ${callSheet.meals.map(m => `
          <li><strong>${getMealTranslation(m.type, t)}</strong>: ${m.time}${m.location ? ` - ${m.location}` : ''}${m.caterer ? ` (${m.caterer})` : ''}</li>
        `).join('')}
      </ul>
    </div>
  ` : '';
  
  const equipmentSection = callSheet.equipment.length > 0 ? `
    <div class="info-box">
      <h3>🎥 ${t.equipment}</h3>
      <ul class="equipment-list">
        ${callSheet.equipment.map(e => `<li>${e}</li>`).join('')}
      </ul>
    </div>
  ` : '';
  
  const locationsSection = callSheet.locations.length > 0 ? `
    <div class="section">
      <h2>📍 ${t.locations}</h2>
      ${callSheet.locations.map(loc => `
        <div class="location-card">
          <h3>${loc.name}</h3>
          <p><strong>${t.address}:</strong> ${loc.address}</p>
          ${loc.parking ? `<p><strong>${t.parking}:</strong> ${loc.parking}</p>` : ''}
          ${loc.contactPerson ? `<p><strong>${t.contact}:</strong> ${loc.contactPerson} ${loc.contactPhone || ''}</p>` : ''}
          ${loc.accessNotes ? `<p class="access-notes">${loc.accessNotes}</p>` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';
  
  const notesSection = callSheet.notes.length > 0 ? `
    <div class="section notes-section">
      <h2>📝 ${t.notes}</h2>
      <ul>
        ${callSheet.notes.map(n => `<li>${n}</li>`).join('')}
      </ul>
    </div>
  ` : '';
  
  const safetySection = callSheet.nearestHospital ? `
    <div class="safety-box">
      <h3>🏥 ${t.safetyInfo}</h3>
      <p><strong>${t.nearestHospital}:</strong> ${callSheet.nearestHospital}</p>
    </div>
  ` : '';
  
  const contactsSection = options.includeContacts && callSheet.contacts.length > 0 ? `
    <div class="section contacts-section">
      <h2>📞 ${t.emergencyContacts}</h2>
      <div class="contacts-grid">
        ${callSheet.contacts.map(c => `
          <div class="contact-card">
            <strong>${c.name}</strong>
            <span>${c.role}</span>
            <span class="phone">${c.phone}</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="${options.language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${callSheet.projectTitle} - ${t.callSheet} ${t.day} ${callSheet.dayNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #1a1a1a;
      background: white;
      padding: 20px;
    }
    
    @media print {
      body {
        padding: 0;
      }
      .page-break {
        page-break-before: always;
      }
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #1a1a1a;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    
    .header-left {
      flex: 1;
    }
    
    .project-title {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 2px;
      margin-bottom: 5px;
    }
    
    .call-sheet-title {
      font-size: 18px;
      color: #666;
    }
    
    .header-right {
      text-align: right;
    }
    
    .day-badge {
      display: inline-block;
      background: #1a1a1a;
      color: white;
      padding: 10px 20px;
      font-size: 20px;
      font-weight: bold;
      border-radius: 4px;
      margin-bottom: 10px;
    }
    
    .date-display {
      font-size: 14px;
      color: #333;
    }
    
    .general-call {
      margin-top: 10px;
      font-size: 16px;
      background: #f0f0f0;
      padding: 8px 15px;
      border-radius: 4px;
    }
    
    .general-call strong {
      color: #d32f2f;
    }
    
    .meta-info {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .meta-item {
      padding: 10px;
      background: #f5f5f5;
      border-radius: 4px;
    }
    
    .meta-item label {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 3px;
    }
    
    .meta-item span {
      font-weight: 600;
      font-size: 13px;
    }
    
    .section {
      margin-bottom: 25px;
    }
    
    .section h2 {
      font-size: 14px;
      padding: 8px 12px;
      background: #333;
      color: white;
      margin-bottom: 10px;
      border-radius: 3px;
    }
    
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    
    .data-table th {
      background: #e0e0e0;
      padding: 8px 6px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #999;
    }
    
    .data-table td {
      padding: 6px;
      border-bottom: 1px solid #ddd;
      vertical-align: top;
    }
    
    .data-table tr:hover {
      background: #f9f9f9;
    }
    
    .data-table.compact td,
    .data-table.compact th {
      padding: 4px 6px;
    }
    
    .time-cell {
      font-weight: 600;
      font-family: monospace;
      font-size: 11px;
    }
    
    .scene-number {
      font-weight: bold;
      font-size: 12px;
      text-align: center;
      background: #fff9c4;
      padding: 4px 8px !important;
    }
    
    .phone {
      font-family: monospace;
      white-space: nowrap;
    }
    
    .department-header {
      font-size: 12px;
      color: #555;
      margin: 15px 0 8px 0;
      padding-left: 10px;
      border-left: 3px solid #666;
    }
    
    .info-box {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 15px;
    }
    
    .info-box h3 {
      font-size: 12px;
      margin-bottom: 8px;
    }
    
    .weather-box {
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 15px;
    }
    
    .weather-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-top: 10px;
    }
    
    .weather-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .weather-icon {
      font-size: 18px;
    }
    
    .forecast {
      margin-top: 8px;
      font-style: italic;
      color: #555;
    }
    
    .meals-list, .equipment-list {
      list-style: none;
      padding: 0;
    }
    
    .meals-list li, .equipment-list li {
      padding: 4px 0;
      border-bottom: 1px dashed #ddd;
    }
    
    .meals-list li:last-child, .equipment-list li:last-child {
      border-bottom: none;
    }
    
    .equipment-list {
      column-count: 2;
    }
    
    .location-card {
      background: #fff;
      border: 1px solid #ddd;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 10px;
    }
    
    .location-card h3 {
      font-size: 13px;
      margin-bottom: 8px;
      color: #333;
    }
    
    .location-card p {
      margin-bottom: 4px;
    }
    
    .access-notes {
      font-style: italic;
      color: #666;
      margin-top: 8px;
    }
    
    .safety-box {
      background: #ffebee;
      border: 2px solid #f44336;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 15px;
    }
    
    .safety-box h3 {
      color: #c62828;
      margin-bottom: 8px;
    }
    
    .notes-section ul {
      list-style: disc;
      padding-left: 20px;
    }
    
    .notes-section li {
      margin-bottom: 5px;
    }
    
    .contacts-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    
    .contact-card {
      background: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    
    .contact-card strong {
      font-size: 12px;
    }
    
    .contact-card span {
      font-size: 10px;
      color: #666;
    }
    
    .contact-card .phone {
      font-size: 11px;
      color: #1a1a1a;
      font-weight: 500;
    }
    
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #666;
    }
    
    .confidential {
      background: #ff9800;
      color: white;
      padding: 4px 10px;
      border-radius: 3px;
      font-weight: bold;
    }
    
    ${options.watermark ? `
    body::before {
      content: '${options.watermark}';
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 80px;
      font-weight: bold;
      color: rgba(0, 0, 0, 0.03);
      z-index: -1;
      white-space: nowrap;
    }
    ` : ''}
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${options.companyLogo ? `<img src="${options.companyLogo}" alt="Logo" class="logo" />` : ''}
      <div class="project-title">${callSheet.projectTitle}</div>
      <div class="call-sheet-title">${t.callSheet}</div>
      <div class="meta-small">${callSheet.productionCompany}</div>
    </div>
    <div class="header-right">
      <div class="day-badge">${t.day} ${callSheet.dayNumber} / ${callSheet.totalDays}</div>
      <div class="date-display">${formatDate(callSheet.date, options.language)}</div>
      <div class="general-call">
        ${t.generalCall}: <strong>${callSheet.generalCallTime}</strong>
      </div>
    </div>
  </div>
  
  <div class="meta-info">
    <div class="meta-item">
      <label>${t.director}</label>
      <span>${callSheet.director}</span>
    </div>
    <div class="meta-item">
      <label>${t.producer}</label>
      <span>${callSheet.producer}</span>
    </div>
    <div class="meta-item">
      <label>${t.production}</label>
      <span>${callSheet.productionCompany}</span>
    </div>
  </div>
  
  ${weatherSection}
  
  <div class="two-column">
    ${mealsSection}
    ${equipmentSection}
  </div>
  
  ${generateSceneTable(callSheet.scenes, t)}
  
  ${generateCastTable(callSheet.castCallTimes, '', t)}
  
  ${generateCrewTable(callSheet.crewCallTimes, t)}
  
  ${locationsSection}
  
  ${safetySection}
  
  ${notesSection}
  
  ${contactsSection}
  
  <div class="footer">
    <div class="confidential">${t.confidential}</div>
    <div>
      ${t.version} ${callSheet.version} | ${t.generated}: ${new Date().toLocaleString(options.language === 'no' ? 'nb-NO' : 'en-US')}
    </div>
  </div>
</body>
</html>
  `;
}

function getWeatherIcon(condition: string): string {
  switch (condition) {
    case 'sunny': return '☀️';
    case 'cloudy': return '☁️';
    case 'rain': return '🌧️';
    case 'snow': return '❄️';
    case 'fog': return '🌫️';
    case 'wind': return '💨';
    default: return '🌤️';
  }
}

// ============================================
// PDF GENERATION (using browser print or jsPDF)
// ============================================

export async function downloadCallSheetPDF(callSheet: CallSheet, options: CallSheetPDFOptions): Promise<void> {
  const html = generateCallSheetHTML(callSheet, options);
  
  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Kunne ikke åpne utskriftsvindu. Sjekk popup-blokkering.');
  }
  
  printWindow.document.write(html);
  printWindow.document.close();
  
  // Wait for content to load
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

export async function previewCallSheet(callSheet: CallSheet, options: CallSheetPDFOptions): Promise<string> {
  return generateCallSheetHTML(callSheet, options);
}

// Default options
export const DEFAULT_CALL_SHEET_OPTIONS: CallSheetPDFOptions = {
  format: 'A4',
  includeMap: false,
  includeWeather: true,
  includeContacts: true,
  language: 'no',
};
