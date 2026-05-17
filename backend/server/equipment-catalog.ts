/**
 * equipment-catalog.ts
 *
 * Kuratert katalog over kamera-utstyr fotografer i Norge typisk eier.
 * Brukes som picker når Stine legger til nytt utstyr — slipper å
 * skrive inn merke/modell manuelt og får automatisk bilde + firmware-link
 * + standard garanti-måneder.
 *
 * Bilde-URLs er fra produsentenes egne pressrom (offentlig tilgjengelige).
 * Firmware-URLs peker til offisielle support-sider, ikke nedlastings-link
 * direkte (siden disse endrer seg ofte).
 *
 * Garanti-tall er typiske for Norge/EU per 2026. Stine kan overskrive
 * per utstyr i UI om hun har annen avtale.
 */

export interface EquipmentCatalogEntry {
  id: string;                          // stabil id, brukes som catalog_id
  brand: string;
  model: string;
  category: 'camera_body' | 'lens' | 'flash' | 'tripod' | 'lighting' | 'audio' | 'computer' | 'storage' | 'other';
  releasedYear: number | null;
  msrpNok: number | null;              // veiledende pris ved lansering (NOK)
  warrantyMonths: number;              // standard garanti i Norge
  reklamasjonMonths: number;           // 60 = 5 år (forbrukerkjøp av produkt som skal vare lenge)
  imageUrl: string;                    // produkt-bilde fra produsent
  firmwareUrl: string | null;          // hvor man sjekker/laster firmware
  notes?: string;
  // Slice 9X.24 — batteri-data for kameraer (CIPA-standard)
  cipaBatteryShots?: number;           // ant bilder per lading (LP-E6NH / NP-FZ100 / EN-EL15c)
  cipaBatteryShotsEvf?: number;        // hvis EVF gir lavere
  hasBatteryGripOption?: boolean;      // støtter dedikert grip
  batteryGripMultiplier?: number;      // grip-modeller dobler typisk antall (~2.0x)
  batteryModel?: string;               // f.eks. "LP-E6NH" (for kjøps-info)

  // Slice 9X.25 — batteri-data for blits / lys-utstyr
  flashesPerCharge?: number;           // ant blits ved full output før batteri går tom
  flashesAt32Power?: number;           // ved 1/32 output (vanlig fyll-blits)
  isRechargeable?: boolean;            // true for li-ion (Godox V1, Profoto A10/B10),
                                       // false for AA-blitser
  chargingTimeMinutes?: number;        // tid for full lading hvis rechargeable
  batteryType?: 'li-ion-built-in' | 'li-ion-removable' | 'aa-removable' | 'd-removable';
}

export const EQUIPMENT_CATALOG: EquipmentCatalogEntry[] = [
  // ─── Canon Mirrorless ────────────────────────────────────────────────
  {
    id: 'canon-eos-r5',
    brand: 'Canon',
    model: 'EOS R5',
    category: 'camera_body',
    releasedYear: 2020,
    msrpNok: 47990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://www.canon.no/-/media/cpe/cameras/eos-r/eos-r5/eos-r5-front-1.png?w=480',
    firmwareUrl: 'https://www.canon.no/support/consumer_products/products/cameras/dslr_and_mirrorless/eos-r5.html',
    cipaBatteryShots: 320, cipaBatteryShotsEvf: 220,
    hasBatteryGripOption: true, batteryGripMultiplier: 2.0,
    batteryModel: 'LP-E6NH',
  },
  {
    id: 'canon-eos-r5-mk2',
    brand: 'Canon',
    model: 'EOS R5 Mark II',
    category: 'camera_body',
    releasedYear: 2024,
    msrpNok: 56990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://www.canon.no/-/media/cpe/cameras/eos-r/eos-r5-mark-ii/eos-r5-mark-ii-front-1.png?w=480',
    firmwareUrl: 'https://www.canon.no/support/consumer_products/products/cameras/dslr_and_mirrorless/eos-r5-mark-ii.html',
    cipaBatteryShots: 630, cipaBatteryShotsEvf: 340,
    hasBatteryGripOption: true, batteryGripMultiplier: 2.0,
    batteryModel: 'LP-E6P',
  },
  {
    id: 'canon-eos-r6-mk2',
    brand: 'Canon',
    model: 'EOS R6 Mark II',
    category: 'camera_body',
    releasedYear: 2022,
    msrpNok: 29990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://www.canon.no/-/media/cpe/cameras/eos-r/eos-r6-mark-ii/eos-r6-mark-ii-front-1.png?w=480',
    firmwareUrl: 'https://www.canon.no/support/consumer_products/products/cameras/dslr_and_mirrorless/eos-r6-mark-ii.html',
    cipaBatteryShots: 580, cipaBatteryShotsEvf: 320,
    hasBatteryGripOption: true, batteryGripMultiplier: 2.0,
    batteryModel: 'LP-E6NH',
  },
  {
    id: 'canon-eos-r3',
    brand: 'Canon',
    model: 'EOS R3',
    category: 'camera_body',
    releasedYear: 2021,
    msrpNok: 65990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://www.canon.no/-/media/cpe/cameras/eos-r/eos-r3/eos-r3-front-1.png?w=480',
    firmwareUrl: 'https://www.canon.no/support/consumer_products/products/cameras/dslr_and_mirrorless/eos-r3.html',
    cipaBatteryShots: 760, cipaBatteryShotsEvf: 440,
    hasBatteryGripOption: false, // integrert grip
    batteryGripMultiplier: 1.0,
    batteryModel: 'LP-E19',
  },

  // ─── Sony Alpha Mirrorless ───────────────────────────────────────────
  {
    id: 'sony-a7-iv',
    brand: 'Sony',
    model: 'A7 IV',
    category: 'camera_body',
    releasedYear: 2021,
    msrpNok: 33990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://www.sony.no/image/4d23e64a8a06e4dba9b7ac6ea3f9a30d?fmt=png-alpha&wid=480',
    firmwareUrl: 'https://www.sony.no/electronics/support/digital-cameras-ilce-7-series/ilce-7m4/downloads',
    cipaBatteryShots: 580, cipaBatteryShotsEvf: 520,
    hasBatteryGripOption: true, batteryGripMultiplier: 2.0,
    batteryModel: 'NP-FZ100',
  },
  {
    id: 'sony-a7r-v',
    brand: 'Sony',
    model: 'A7R V',
    category: 'camera_body',
    releasedYear: 2022,
    msrpNok: 45990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://www.sony.no/image/sony-a7r-v?fmt=png-alpha&wid=480',
    firmwareUrl: 'https://www.sony.no/electronics/support/digital-cameras-ilce-7-series/ilce-7rm5/downloads',
    cipaBatteryShots: 530, cipaBatteryShotsEvf: 440,
    hasBatteryGripOption: true, batteryGripMultiplier: 2.0,
    batteryModel: 'NP-FZ100',
  },
  {
    id: 'sony-a1',
    brand: 'Sony',
    model: 'A1',
    category: 'camera_body',
    releasedYear: 2021,
    msrpNok: 75990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://www.sony.no/image/sony-alpha-1?fmt=png-alpha&wid=480',
    firmwareUrl: 'https://www.sony.no/electronics/support/digital-cameras-ilce-1-series/ilce-1/downloads',
    cipaBatteryShots: 530, cipaBatteryShotsEvf: 430,
    hasBatteryGripOption: true, batteryGripMultiplier: 2.0,
    batteryModel: 'NP-FZ100',
  },
  {
    id: 'sony-a9-iii',
    brand: 'Sony',
    model: 'A9 III',
    category: 'camera_body',
    releasedYear: 2023,
    msrpNok: 69990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://www.sony.no/image/sony-alpha-9-iii?fmt=png-alpha&wid=480',
    firmwareUrl: 'https://www.sony.no/electronics/support/digital-cameras-ilce-9-series/ilce-9m3/downloads',
    cipaBatteryShots: 530, cipaBatteryShotsEvf: 400,
    hasBatteryGripOption: true, batteryGripMultiplier: 2.0,
    batteryModel: 'NP-FZ100',
  },

  // ─── Nikon Z-serien ──────────────────────────────────────────────────
  {
    id: 'nikon-z8',
    brand: 'Nikon',
    model: 'Z 8',
    category: 'camera_body',
    releasedYear: 2023,
    msrpNok: 47990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://www.nikon.no/sitecore/shell/Themes/Standard/Images/Z8.png?w=480',
    firmwareUrl: 'https://www.nikon.no/no_NO/product/digital-cameras/slr/professional/z-8',
  },
  {
    id: 'nikon-z9',
    brand: 'Nikon',
    model: 'Z 9',
    category: 'camera_body',
    releasedYear: 2021,
    msrpNok: 65990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://www.nikon.no/sitecore/shell/Themes/Standard/Images/Z9.png?w=480',
    firmwareUrl: 'https://www.nikon.no/no_NO/product/digital-cameras/slr/professional/z-9',
  },
  {
    id: 'nikon-zf',
    brand: 'Nikon',
    model: 'Zf',
    category: 'camera_body',
    releasedYear: 2023,
    msrpNok: 25990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://www.nikon.no/sitecore/shell/Themes/Standard/Images/Zf.png?w=480',
    firmwareUrl: 'https://www.nikon.no/no_NO/product/digital-cameras/slr/enthusiast/zf',
  },

  // ─── Fujifilm ────────────────────────────────────────────────────────
  {
    id: 'fuji-x-t5',
    brand: 'Fujifilm',
    model: 'X-T5',
    category: 'camera_body',
    releasedYear: 2022,
    msrpNok: 20990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://fujifilm-x.com/wp-content/uploads/2022/11/x-t5_silver_front.png',
    firmwareUrl: 'https://fujifilm-x.com/global/support/download/firmware/cameras/x-t5/',
  },
  {
    id: 'fuji-x-h2s',
    brand: 'Fujifilm',
    model: 'X-H2S',
    category: 'camera_body',
    releasedYear: 2022,
    msrpNok: 27990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://fujifilm-x.com/wp-content/uploads/2022/05/x-h2s_front.png',
    firmwareUrl: 'https://fujifilm-x.com/global/support/download/firmware/cameras/x-h2s/',
  },
  {
    id: 'fuji-gfx-100s-ii',
    brand: 'Fujifilm',
    model: 'GFX 100S II',
    category: 'camera_body',
    releasedYear: 2024,
    msrpNok: 56990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://fujifilm-x.com/wp-content/uploads/2024/05/gfx100s-ii_front.png',
    firmwareUrl: 'https://fujifilm-x.com/global/support/download/firmware/cameras/gfx100s-ii/',
  },

  // ─── Vanlige Canon objektiver ───────────────────────────────────────
  {
    id: 'canon-rf-24-70-28',
    brand: 'Canon',
    model: 'RF 24-70mm f/2.8L IS USM',
    category: 'lens',
    releasedYear: 2019,
    msrpNok: 29990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://www.canon.no/-/media/cpe/lenses/rf-24-70-2-8.png?w=480',
    firmwareUrl: 'https://www.canon.no/support/consumer_products/products/cameras/rf-lenses/rf24-70mm-f2-8l-is-usm.html',
  },
  {
    id: 'canon-rf-70-200-28',
    brand: 'Canon',
    model: 'RF 70-200mm f/2.8L IS USM',
    category: 'lens',
    releasedYear: 2019,
    msrpNok: 31990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://www.canon.no/-/media/cpe/lenses/rf-70-200-2-8.png?w=480',
    firmwareUrl: 'https://www.canon.no/support/consumer_products/products/cameras/rf-lenses/rf70-200mm-f2-8l-is-usm.html',
  },
  {
    id: 'canon-rf-50-12',
    brand: 'Canon',
    model: 'RF 50mm f/1.2L USM',
    category: 'lens',
    releasedYear: 2018,
    msrpNok: 25990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://www.canon.no/-/media/cpe/lenses/rf-50-1-2.png?w=480',
    firmwareUrl: 'https://www.canon.no/support/consumer_products/products/cameras/rf-lenses/rf50mm-f1-2l-usm.html',
  },

  // ─── Vanlige Sony objektiver ────────────────────────────────────────
  {
    id: 'sony-fe-24-70-28-gm-ii',
    brand: 'Sony',
    model: 'FE 24-70mm f/2.8 GM II',
    category: 'lens',
    releasedYear: 2022,
    msrpNok: 26990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://www.sony.no/image/sel2470gm2?fmt=png-alpha&wid=480',
    firmwareUrl: 'https://www.sony.no/electronics/support/e-mount-body-sel-lens-e-mount-prime-lens/sel2470gm2/downloads',
  },
  {
    id: 'sony-fe-70-200-28-gm-ii',
    brand: 'Sony',
    model: 'FE 70-200mm f/2.8 GM OSS II',
    category: 'lens',
    releasedYear: 2021,
    msrpNok: 29990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://www.sony.no/image/sel70200gm2?fmt=png-alpha&wid=480',
    firmwareUrl: 'https://www.sony.no/electronics/support/e-mount-body-sel-lens-e-mount-zoom-lens/sel70200gm2/downloads',
  },

  // ─── Blitser ─────────────────────────────────────────────────────────
  {
    id: 'profoto-a10',
    brand: 'Profoto',
    model: 'A10',
    category: 'flash',
    releasedYear: 2020,
    msrpNok: 11990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://profoto.com/dam/jcr:abc/profoto-a10.png?width=480',
    firmwareUrl: 'https://profoto.com/no/support',
    flashesPerCharge: 450, flashesAt32Power: 4500,
    isRechargeable: true, chargingTimeMinutes: 70,
    batteryType: 'li-ion-removable',
  },
  {
    id: 'profoto-b10',
    brand: 'Profoto',
    model: 'B10',
    category: 'flash',
    releasedYear: 2018,
    msrpNok: 21990,
    warrantyMonths: 24,
    reklamasjonMonths: 60,
    imageUrl: 'https://profoto.com/dam/jcr:abc/profoto-b10.png?width=480',
    firmwareUrl: 'https://profoto.com/no/support',
    flashesPerCharge: 400, flashesAt32Power: 4000,
    isRechargeable: true, chargingTimeMinutes: 90,
    batteryType: 'li-ion-removable',
  },
  {
    id: 'godox-v1',
    brand: 'Godox',
    model: 'V1',
    category: 'flash',
    releasedYear: 2019,
    msrpNok: 2990,
    warrantyMonths: 12,
    reklamasjonMonths: 24,
    imageUrl: 'https://www.godox.com/EN/dam/v1.png?width=480',
    firmwareUrl: 'https://www.godox.com/EN/Support_Download.html',
    flashesPerCharge: 480, flashesAt32Power: 4800,
    isRechargeable: true, chargingTimeMinutes: 150,
    batteryType: 'li-ion-removable',
  },
  {
    id: 'godox-ad200',
    brand: 'Godox',
    model: 'AD200',
    category: 'flash',
    releasedYear: 2017,
    msrpNok: 3990,
    warrantyMonths: 12,
    reklamasjonMonths: 24,
    imageUrl: 'https://www.godox.com/EN/dam/ad200.png?width=480',
    firmwareUrl: 'https://www.godox.com/EN/Support_Download.html',
    flashesPerCharge: 500, flashesAt32Power: 5000,
    isRechargeable: true, chargingTimeMinutes: 240,
    batteryType: 'li-ion-removable',
  },
  {
    id: 'godox-tt685',
    brand: 'Godox',
    model: 'TT685',
    category: 'flash',
    releasedYear: 2015,
    msrpNok: 1490,
    warrantyMonths: 12,
    reklamasjonMonths: 24,
    imageUrl: 'https://www.godox.com/EN/dam/tt685.png?width=480',
    firmwareUrl: 'https://www.godox.com/EN/Support_Download.html',
    flashesPerCharge: 230, flashesAt32Power: 2000, // 4×AA, ny set
    isRechargeable: false,  // AA-batterier — kan IKKE lades direkte
    batteryType: 'aa-removable',
  },
];

export function findCatalogEntry(id: string): EquipmentCatalogEntry | null {
  return EQUIPMENT_CATALOG.find((e) => e.id === id) ?? null;
}

export function searchCatalog(query: string): EquipmentCatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return EQUIPMENT_CATALOG;
  return EQUIPMENT_CATALOG.filter((e) => {
    const haystack = `${e.brand} ${e.model}`.toLowerCase();
    return haystack.includes(q);
  });
}
