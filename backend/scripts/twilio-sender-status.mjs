#!/usr/bin/env node
// Sjekk status på alfanumeriske sender-IDs registrert via twilio-onboarding.
// Bruk:
//   TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... node backend/scripts/twilio-sender-status.mjs
// Eller (etter at .env.twilio.local er kopiert til Render): hent verdier
// fra Render UI eller skriv dem inn for hånd.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const twilio = require('twilio');

const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
if (!sid || !token) {
  console.error('Mangler TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN i env.');
  process.exit(2);
}
const client = twilio(sid, token);

const services = await client.messaging.v1.services.list({ limit: 50 });
const ours = services.filter((s) =>
  s.friendlyName.includes('Role Room') || s.friendlyName.includes('CreatorHub'),
);

if (!ours.length) {
  console.log('Ingen Messaging Services funnet for Role Room / CreatorHub.');
  process.exit(0);
}

console.log(`\n${'─'.repeat(70)}`);
console.log(`STATUS PER ${new Date().toLocaleString('nb-NO')}`);
console.log('─'.repeat(70));

for (const svc of ours) {
  console.log(`\n${svc.friendlyName}`);
  console.log(`  Service SID: ${svc.sid}`);
  const senders = await client.messaging.v1
    .services(svc.sid)
    .alphaSenders.list({ limit: 20 });
  if (!senders.length) {
    console.log('  (ingen alfanumeriske sendere registrert)');
    continue;
  }
  for (const s of senders) {
    const tag =
      s.capabilities?.includes('SMS') ? '[SMS]' : '[?]';
    console.log(`  ${tag} ${s.alphaSender} → ${s.sid}`);
    console.log(`         opprettet: ${s.dateCreated?.toISOString?.() ?? s.dateCreated}`);
    console.log(`         capabilities: ${(s.capabilities || []).join(', ') || '(ingen ennå)'}`);
  }
}

console.log('\n─'.repeat(70));
console.log('Tomt capabilities-felt = venter på operator-godkjenning.');
console.log('Når feltet inkluderer "SMS" er senderen aktiv og kan brukes.');
console.log('─'.repeat(70));
