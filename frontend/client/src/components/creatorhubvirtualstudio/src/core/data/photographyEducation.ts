/**
 * Photography Education Data
 * 
 * Educational content for training photographers on fundamentals:
 * - White Balance
 * - Exposure Triangle (ISO, Aperture, Shutter Speed)
 * - Color Temperature
 * - Metering Modes
 * - Focus Modes
 * - Composition Rules
 */

// ============================================================================
// White Balance Education
// ============================================================================

export interface WhiteBalancePreset {
  id: string;
  name: string;
  kelvin: number;
  description: string;
  scenarios: string[];
  icon: string;
  tint?: number; // Green/Magenta shift (-150 to +150)
}

export const WHITE_BALANCE_PRESETS: WhiteBalancePreset[] = [
  {
    id: 'auto, ',
    name: 'Auto (AWB)',
    kelvin: 5500,
    description: 'Camera automatically adjusts white balance based on scene analysis',
    scenarios: ['Quick shooting', 'Mixed lighting','When unsure'],
    icon: 'AutoMode',
  },
  {
    id: 'daylight',
    name: 'Daylight',
    kelvin: 5500,
    description: 'For shooting outdoors in direct sunlight around midday',
    scenarios: ['Sunny outdoor','Clear sky','Midday sun'],
    icon: 'WbSunny',
  },
  {
    id: 'cloudy',
    name: 'Cloudy',
    kelvin: 6500,
    description: 'Adds warmth to compensate for cool overcast light',
    scenarios: ['Overcast days','Open shade','Slightly warm look'],
    icon: 'Cloud',
  },
  {
    id: 'shade',
    name: 'Shade',
    kelvin: 7500,
    description: 'Even warmer than cloudy, for deep shade conditions',
    scenarios: ['Deep shade','Under trees','North-facing windows'],
    icon: 'Park',
  },
  {
    id: 'tungsten',
    name: 'Tungsten/Incandescent',
    kelvin: 3200,
    description: 'For traditional indoor light bulbs, adds blue to counter orange cast',
    scenarios: ['Indoor household bulbs','Warm room lighting','Restaurants'],
    icon: 'Lightbulb',
  },
  {
    id: 'fluorescent',
    name: 'Fluorescent',
    kelvin: 4000,
    description: 'Compensates for greenish tint of fluorescent office lights',
    scenarios: ['Office buildings','Schools','Hospitals'],
    icon: 'FlashlightOn',
    tint: -10,
  },
  {
    id: 'flash',
    name: 'Flash',
    kelvin: 5500,
    description: 'Optimized for camera flash or studio strobes',
    scenarios: ['On-camera flash','Studio strobes','Speedlights'],
    icon: 'FlashOn',
  },
  {
    id: 'custom',
    name: 'Custom/Manual',
    kelvin: 5500,
    description: 'Set exact Kelvin value for precise control',
    scenarios: ['Mixed lighting','Creative effects','Precise matching'],
    icon: 'Tune',
  },
];

export interface ColorTemperatureRange {
  min: number;
  max: number;
  name: string;
  color: string;
  examples: string[];
}

export const COLOR_TEMPERATURE_SCALE: ColorTemperatureRange[] = [
  {
    min: 1000,
    max: 2000,
    name: 'Candlelight',
    color: '#ff6b00',
    examples: ['Candles','Fire','Oil lamps'],
  },
  {
    min: 2000,
    max: 3000,
    name: 'Warm Indoor',
    color: '#ff9500',
    examples: ['Sunrise/sunset','Incandescent bulbs','40W bulbs'],
  },
  {
    min: 3000,
    max: 3500,
    name: 'Tungsten/Halogen',
    color: '#ffb347',
    examples: ['Studio tungsten','Halogen lamps','Warm LED'],
  },
  {
    min: 3500,
    max: 4500,
    name: 'Fluorescent',
    color: '#ffd89b',
    examples: ['Cool white fluorescent','Some LED panels'],
  },
  {
    min: 4500,
    max: 5500,
    name: 'Daylight/Flash',
    color: '#fff4e6',
    examples: ['Midday sun','Camera flash','Studio strobes'],
  },
  {
    min: 5500,
    max: 6500,
    name: 'Cloudy',
    color: '#e8f4ff',
    examples: ['Overcast sky','Window light','Diffused daylight'],
  },
  {
    min: 6500,
    max: 8000,
    name: 'Shade',
    color: '#d4e8ff',
    examples: ['Open shade','Blue hour','North light'],
  },
  {
    min: 8000,
    max: 12000,
    name: 'Blue Sky',
    color: '#b8d4ff',
    examples: ['Clear blue sky','Deep shade','Snow shadows'],
  },
];

// ============================================================================
// Exposure Triangle Education
// ============================================================================

export interface ExposureLesson {
  id: string;
  title: string;
  description: string;
  icon: string;
  settings: {
    name: string;
    range: string;
    effect: string;
    tradeoff: string;
  };
  tips: string[];
  exercises: string[];
}

export const EXPOSURE_LESSONS: ExposureLesson[] = [
  {
    id: 'aperture',
    title: 'Aperture (f-stop)',
    description: 'Controls how much light enters through the lens opening',
    icon: 'Aperture',
    settings: {
      name: 'f-stop',
      range: 'f/1.4 to f/22',
      effect: 'Controls depth of field (background blur)',
      tradeoff: 'Wider aperture = more light but shallower focus',
    },
    tips: [
      'Lower f-number (f/1.8) = wider opening = more blur','Higher f-number (f/11) = smaller opening = more in focus','Sweet spot for sharpness is usually 2-3 stops from wide open','f/5.6-f/8 often provides the sharpest results',
    ],
    exercises: [
      'Shoot the same subject at f/2.8, f/5.6, and f/11 - compare blur','Create a portrait with creamy background bokeh at f/1.8','Shoot a group photo where everyone is sharp at f/8',
    ],
  },
  {
    id: 'shutter_speed',
    title: 'Shutter Speed',
    description: 'Controls how long the sensor is exposed to light',
    icon: 'ShutterSpeed',
    settings: {
      name: 'Seconds',
      range: '30s to 1/8000s',
      effect: 'Controls motion blur and freezing action',
      tradeoff: 'Faster shutter = less light but freezes motion',
    },
    tips: [
      'Handheld minimum: 1/(focal length) - e.g., 1/85s for 85mm lens','1/250s or faster for portraits to freeze micro-movements','1/500s+ for sports and action photography','1/60s or slower for intentional motion blur',
    ],
    exercises: [
      'Freeze water droplets at 1/1000s','Create motion blur on a moving car at 1/30s with panning','Test your handheld limit - find your minimum sharp shutter speed',
    ],
  },
  {
    id: 'iso',
    title: 'ISO Sensitivity',
    description: 'Controls the sensor\'s sensitivity to light',
    icon: 'Iso',
    settings: {
      name: 'ISO',
      range: '100 to 51200+',
      effect: 'Brightens image in low light',
      tradeoff: 'Higher ISO = more noise/grain',
    },
    tips: [
      'Use lowest ISO possible for cleanest images','Modern cameras handle high ISO better - test your camera\'s limit','Noise is more visible in shadows than highlights','A sharp noisy photo beats a blurry clean one',
    ],
    exercises: [
      'Shoot the same scene at ISO 100, 800, 3200, 12800 - compare noise','Find your camera\'s "acceptable" ISO limit','Practice balancing ISO with aperture and shutter in low light',
    ],
  },
];

// ============================================================================
// Metering Modes Education
// ============================================================================

export interface MeteringMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  bestFor: string[];
  avoidFor: string[];
}

export const METERING_MODES: MeteringMode[] = [
  {
    id: 'evaluative',
    name: 'Evaluative/Matrix',
    description: 'Analyzes entire scene and balances exposure across all areas',
    icon: 'GridView',
    bestFor: ['General photography','Landscapes','Events','When unsure'],
    avoidFor: ['High contrast scenes','Backlit subjects'],
  },
  {
    id: 'center_weighted',
    name: 'Center-Weighted',
    description: 'Prioritizes center of frame but considers edges',
    icon: 'CenterFocusStrong',
    bestFor: ['Portraits','Subject in center','Traditional photography'],
    avoidFor: ['Off-center subjects','Landscapes'],
  },
  {
    id: 'spot',
    name: 'Spot Metering',
    description: 'Meters only a tiny area (1-5%) where you point',
    icon: 'Adjust',
    bestFor: ['Backlit subjects','Stage performers','High contrast','Moon photography'],
    avoidFor: ['Quick shooting','Moving subjects','Beginners'],
  },
  {
    id: 'highlight_weighted',
    name: 'Highlight-Weighted',
    description: 'Protects highlights from blowing out',
    icon: 'Highlight',
    bestFor: ['Weddings (white dress)','Snow scenes','High-key portraits'],
    avoidFor: ['Dark subjects','Low-key photography'],
  },
];

// ============================================================================
// Focus Modes Education
// ============================================================================

export interface FocusMode {
  id: string;
  name: string;
  alternateName?: string;
  description: string;
  icon: string;
  bestFor: string[];
}

export const FOCUS_MODES: FocusMode[] = [
  {
    id: 'single',
    name: 'Single/One-Shot',
    alternateName: 'AF-S (Nikon) / One-Shot (Canon)',
    description: 'Focuses once when half-pressing shutter, locks focus',
    icon: 'CenterFocusWeak',
    bestFor: ['Still subjects','Portraits','Landscapes','Products'],
  },
  {
    id: 'continuous',
    name: 'Continuous/Servo',
    alternateName: 'AF-C (Nikon) / AI Servo (Canon)',
    description: 'Continuously adjusts focus while half-pressing shutter',
    icon: 'CenterFocusStrong',
    bestFor: ['Moving subjects','Sports','Wildlife','Children'],
  },
  {
    id: 'auto',
    name: 'Auto/Hybrid',
    alternateName: 'AF-A (Nikon) / AI Focus (Canon)',
    description: 'Camera switches between single and continuous automatically',
    icon: 'AutoMode',
    bestFor: ['Unpredictable subjects','Events','When unsure'],
  },
  {
    id: 'manual',
    name: 'Manual Focus',
    description: 'You control focus ring manually',
    icon: 'TouchApp',
    bestFor: ['Macro','Low light','Precise control','Video','Astrophotography'],
  },
];

// ============================================================================
// Composition Rules Education
// ============================================================================

export interface CompositionRule {
  id: string;
  name: string;
  description: string;
  icon: string;
  howTo: string[];
  examples: string[];
}

export const COMPOSITION_RULES: CompositionRule[] = [
  {
    id: 'rule_of_thirds',
    name: 'Rule of Thirds',
    description: 'Divide frame into 9 equal parts, place subjects on intersections',
    icon: 'Grid3x3',
    howTo: [
      'Enable grid overlay in camera/viewfinder','Place horizon on top or bottom third line','Position eyes at top third intersection','Place main subject at any intersection point',
    ],
    examples: ['Portraits','Landscapes','Product photography'],
  },
  {
    id: 'leading_lines',
    name: 'Leading Lines',
    description: 'Use natural lines to guide viewer\'s eye to the subject',
    icon: 'Timeline',
    howTo: [
      'Look for roads, fences, rivers, shadows','Position lines to lead toward your subject','Diagonal lines create more dynamic images','Lines can lead into or out of frame',
    ],
    examples: ['Architecture','Roads/paths','Bridges','Railways'],
  },
  {
    id: 'framing',
    name: 'Natural Framing',
    description: 'Use elements in scene to create a frame around subject',
    icon: 'CropFree',
    howTo: [
      'Look for doorways, windows, arches','Use tree branches or foliage','Shoot through objects in foreground','Frame doesn\'t need to be complete',
    ],
    examples: ['Architecture','Environmental portraits','Landscapes'],
  },
  {
    id: 'symmetry',
    name: 'Symmetry & Patterns',
    description: 'Create balance through mirrored or repeating elements',
    icon: 'ViewQuilt',
    howTo: [
      'Center subject for perfect symmetry','Look for reflections in water/glass','Find repeating patterns in architecture','Break pattern with one different element',
    ],
    examples: ['Architecture','Reflections','Abstract','Product'],
  },
  {
    id: 'depth',
    name: 'Depth & Layers',
    description: 'Include foreground, middle ground, and background elements',
    icon: 'Layers',
    howTo: [
      'Position interesting elements in foreground','Use aperture to control which layers are sharp','Overlapping elements suggest depth','Leading lines enhance depth perception',
    ],
    examples: ['Landscapes','Environmental portraits','Street photography'],
  },
  {
    id: 'negative_space',
    name: 'Negative Space',
    description: 'Use empty space to emphasize and isolate subject',
    icon: 'Crop',
    howTo: [
      'Leave breathing room around subject','Simple backgrounds work best','Negative space can be any color/texture','Creates clean, minimalist look',
    ],
    examples: ['Minimalist','Product','Editorial','Portraits'],
  },
];

// ============================================================================
// School Photography Specific Training
// ============================================================================

export interface SchoolPhotoTip {
  id: string;
  title: string;
  description: string;
  category: 'workflow' | 'technical' | 'posing' | 'lighting' | 'business';
  tips: string[];
}

export const SCHOOL_PHOTOGRAPHY_TIPS: SchoolPhotoTip[] = [
  {
    id: 'volume_workflow',
    title: 'High-Volume Workflow',
    description: 'Efficiently photograph hundreds of students per day',
    category: 'workflow',
    tips: [
      'Set up a consistent lighting setup that works for all skin tones','Use a posing stool at a fixed position - mark the floor','Pre-focus at a fixed distance and lock it','Shoot tethered for immediate review and backup','Have an assistant manage student flow','Use a barcode/QR system to match photos to students',
    ],
  },
  {
    id: 'consistent_exposure',
    title: 'Consistent Exposure',
    description: 'Ensure every photo has identical exposure',
    category: 'technical',
    tips: [
      'Use manual mode - never auto exposure','Set flash power manually, not TTL','Take test shots with gray card','Check histogram regularly','Use same settings all day - only adjust for extreme cases','Bracket difficult skin tones if needed',
    ],
  },
  {
    id: 'white_balance_school',
    title: 'White Balance for Schools',
    description: 'Handle mixed lighting in school environments',
    category: 'technical',
    tips: [
      'Use flash white balance (5500K) as your baseline','Gel your flash to match ambient if needed','Schools often have fluorescent lights - be aware of green cast','Custom white balance with gray card is most accurate','Consistent white balance is more important than "perfect"','Batch correct in post if all shots are consistent',
    ],
  },
  {
    id: 'posing_kids',
    title: 'Posing Children',
    description: 'Get natural expressions from kids of all ages',
    category: 'posing',
    tips: [
      'Keep energy high and positive','Have jokes ready for each age group','For young kids: ask about pets, favorite characters','For teens: be respectful, not overly enthusiastic','Slight head tilt toward higher shoulder','Turn body slightly, head toward camera','Real smiles come from interaction, not "say cheese"',
    ],
  },
  {
    id: 'group_photos',
    title: 'Class Group Photos',
    description: 'Organize and light large groups effectively',
    category: 'lighting',
    tips: [
      'Use risers/benches to create rows','Shorter students in front, taller in back','Everyone should be able to see the camera','Use wider aperture (f/8-f/11) for group depth','Light from both sides to minimize shadows','Take multiple shots - someone always blinks','Count down "3, 2, 1" before shooting',
    ],
  },
  {
    id: 'business_school',
    title: 'School Photo Business',
    description: 'Professional practices for school photography',
    category: 'business',
    tips: [
      'Get contracts signed well in advance','Clarify retake policies before shoot','Have backup equipment ready','Understand school\'s privacy requirements','Deliver on time - schools have yearbook deadlines','Offer package options at different price points',
    ],
  },
];

// ============================================================================
// Interactive Quiz Questions
// ============================================================================

export interface QuizQuestion {
  id: string;
  topic: 'white_balance' | 'exposure' | 'metering' | 'focus' | 'composition';
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // White Balance Questions
  {
    id: 'wb_1',
    topic: 'white_balance',
    question: 'You\'re shooting indoors under standard household light bulbs. What white balance should you use?',
    options: ['Daylight (5500K)','Tungsten (3200K)','Shade (7500K)','Flash (5500K)'],
    correctAnswer: 1,
    explanation: 'Household incandescent bulbs are around 2700-3200K. Using Tungsten WB adds blue to neutralize the orange color cast.',
  },
  {
    id: 'wb_2',
    topic: 'white_balance',
    question: 'Your outdoor photos in shade look too blue. What should you do?',
    options: ['Use a lower Kelvin value','Use a higher Kelvin value','Increase ISO','Decrease aperture'],
    correctAnswer: 1,
    explanation: 'Shade is cooler (bluer) than direct sun. Using a higher Kelvin value (6500-8000K) or Shade WB preset adds warmth to compensate.',
  },
  {
    id: 'wb_3',
    topic: 'white_balance',
    question: 'What is the approximate color temperature of camera flash?',
    options: ['3200K','4000K','5500K','7500K'],
    correctAnswer: 2,
    explanation: 'Camera flash and studio strobes are designed to match daylight at approximately 5500K.',
  },
  // Exposure Questions
  {
    id: 'exp_1',
    topic: 'exposure',
    question: 'You want more background blur in your portrait. What should you do?',
    options: ['Use smaller aperture (f/11)','Use wider aperture (f/2.8)','Increase ISO','Use faster shutter speed'],
    correctAnswer: 1,
    explanation: 'Wider apertures (lower f-numbers like f/2.8) create shallower depth of field, resulting in more background blur (bokeh).',
  },
  {
    id: 'exp_2',
    topic: 'exposure',
    question: 'You\'re shooting a school sports event. What shutter speed would freeze the action?',
    options: ['1/60s','1/125s','1/500s or faster','1/30s'],
    correctAnswer: 2,
    explanation: 'To freeze fast action like sports, you need 1/500s or faster. 1/1000s is even better for very fast movement.',
  },
  {
    id: 'exp_3',
    topic: 'exposure',
    question: 'Your image is too dark. You\'re already at max aperture. What\'s the next best option?',
    options: ['Decrease shutter speed','Increase ISO','Both could work','Neither will help'],
    correctAnswer: 2,
    explanation: 'Both decreasing shutter speed (letting in more light) or increasing ISO (making sensor more sensitive) will brighten the image. Choose based on whether motion blur is acceptable.',
  },
  // Metering Questions
  {
    id: 'meter_1',
    topic: 'metering',
    question: 'You\'re photographing a performer on stage with bright spotlights and dark background. Which metering mode?',
    options: ['Evaluative/Matrix','Center-Weighted','Spot Metering','Any will work'],
    correctAnswer: 2,
    explanation: 'Spot metering lets you meter specifically on the performer\'s face, ignoring the dark background that would otherwise cause overexposure.',
  },
  // Focus Questions
  {
    id: 'focus_1',
    topic: 'focus',
    question: 'Which focus mode is best for photographing a running child?',
    options: ['Single/One-Shot (AF-S)','Continuous/Servo (AF-C)','Manual Focus','Auto (AF-A)'],
    correctAnswer: 1,
    explanation: 'Continuous/Servo focus mode continuously adjusts focus as the subject moves, keeping them sharp even while running toward or away from you.',
  },
  // Composition Questions
  {
    id: 'comp_1',
    topic: 'composition',
    question: 'According to the Rule of Thirds, where should you typically place a person\'s eyes in a portrait?',
    options: ['Dead center','Bottom third','Top third intersection','Anywhere is fine'],
    correctAnswer: 2,
    explanation: 'The Rule of Thirds suggests placing the subject\'s eyes at the top third intersection points, creating a more balanced and engaging composition.',
  },
];

// ============================================================================
// Focal Length Education
// ============================================================================

export interface FocalLengthInfo {
  id: string;
  range: string;
  name: string;
  fieldOfView: string;
  bestFor: string[];
  characteristics: string[];
  distortion: string;
  subjectDistance: string;
  icon: string;
}

export const FOCAL_LENGTH_GUIDE: FocalLengthInfo[] = [
  {
    id: 'ultra_wide',
    range: '14-24mm',
    name: 'Ultra Wide',
    fieldOfView: '84-114 degrees',
    bestFor: ['Real estate interiors','Architecture','Landscapes','Astrophotography','Creative distortion'],
    characteristics: [
      'Exaggerates perspective and depth','Makes spaces look larger','Dramatic leading lines','Not flattering for portraits (distortion)',
    ],
    distortion: 'High barrel distortion - edges stretch outward',
    subjectDistance: '1-3 meters for environmental shots',
    icon: 'Panorama',
  },
  {
    id: 'wide',
    range: '24-35mm',
    name: 'Wide Angle',
    fieldOfView: '63-84 degrees',
    bestFor: ['Environmental portraits','Street photography','Group photos','Event coverage','Vlogging'],
    characteristics: [
      'Includes more context/environment','Good for storytelling','Moderate perspective distortion','Subject must be closer for same framing',
    ],
    distortion: 'Noticeable at edges, manageable in center',
    subjectDistance: '1-2 meters for full body',
    icon: 'Landscape',
  },
  {
    id: 'standard',
    range: '35-50mm',
    name: 'Standard/Normal',
    fieldOfView: '46-63 degrees',
    bestFor: ['Documentary','Street photography','Full-body portraits','Product photography','General use'],
    characteristics: [
      'Closest to human eye perspective','Natural-looking images','Versatile for many situations','Minimal distortion',
    ],
    distortion: 'Minimal - very natural look',
    subjectDistance: '2-3 meters for full body, 1-1.5m for half body',
    icon: 'PhotoCamera',
  },
  {
    id: 'short_tele',
    range: '50-85mm',
    name: 'Short Telephoto',
    fieldOfView: '28-46 degrees',
    bestFor: ['Headshots','Portrait photography','Fashion','Product details','Food photography'],
    characteristics: [
      'Flattering facial compression','Beautiful background separation','Classic portrait perspective','Comfortable working distance',
    ],
    distortion: 'None - ideal for faces',
    subjectDistance: '2-4 meters for headshots',
    icon: 'Face',
  },
  {
    id: 'portrait',
    range: '85-135mm',
    name: 'Portrait Telephoto',
    fieldOfView: '18-28 degrees',
    bestFor: ['Headshots','Beauty photography','Fashion details','Compressed backgrounds','Tight crops'],
    characteristics: [
      'Maximum facial flattering','Strong background compression','Creamy bokeh at wide apertures','Requires more distance from subject',
    ],
    distortion: 'Slight compression - very flattering',
    subjectDistance: '3-5 meters for headshots',
    icon: 'Portrait',
  },
  {
    id: 'telephoto',
    range: '135-200mm',
    name: 'Telephoto',
    fieldOfView: '10-18 degrees',
    bestFor: ['Sports','Wildlife','Compressed portraits','Details from distance','Stage/concerts'],
    characteristics: [
      'Strong background compression','Isolates subject from environment','Requires significant distance','Can feel "flat" or compressed',
    ],
    distortion: 'Strong compression effect',
    subjectDistance: '5-10+ meters',
    icon: 'CameraAlt',
  },
];

// ============================================================================
// Light Angle & Placement Education
// ============================================================================

export interface LightAngle {
  id: string;
  name: string;
  angle: number; // degrees from camera axis
  height: string;
  effect: string;
  bestFor: string[];
  avoid: string[];
  diagram?: string;
}

export const LIGHT_ANGLES: LightAngle[] = [
  {
    id: 'front',
    name: 'Front/Flat Lighting',
    angle: 0,
    height: 'Eye level or slightly above',
    effect: 'Even illumination, minimal shadows, flattering but flat',
    bestFor: ['Beauty photography','Passport photos','ID photos','Hiding skin texture'],
    avoid: ['Dramatic portraits','When you want dimension'],
  },
  {
    id: 'loop',
    name: 'Loop Lighting',
    angle: 30,
    height: 'Above eye level (30-45 degrees up)',
    effect: 'Small shadow loop under nose, slightly to one side',
    bestFor: ['Most portraits','Commercial headshots','Flattering for most faces'],
    avoid: ['Subjects with very prominent noses'],
  },
  {
    id: 'rembrandt',
    name: 'Rembrandt Lighting',
    angle: 45,
    height: 'Above eye level (45 degrees up)',
    effect: 'Triangle of light on shadow-side cheek, dramatic',
    bestFor: ['Dramatic portraits','Character studies','Men','Editorial'],
    avoid: ['Corporate headshots','When client wants minimal shadows'],
  },
  {
    id: 'split',
    name: 'Split Lighting',
    angle: 90,
    height: 'Eye level',
    effect: 'Half face in light, half in shadow',
    bestFor: ['Very dramatic portraits','Film noir style','Moody editorial'],
    avoid: ['Commercial work','Clients who want to look approachable'],
  },
  {
    id: 'butterfly',
    name: 'Butterfly/Paramount',
    angle: 0,
    height: 'High above, angled down (45-60 degrees)',
    effect: 'Butterfly shadow under nose, defines cheekbones',
    bestFor: ['Beauty','Glamour','Subjects with great bone structure','Fashion'],
    avoid: ['Deep-set eyes','Prominent brow ridges'],
  },
  {
    id: 'rim',
    name: 'Rim/Edge Light',
    angle: 135,
    height: 'Behind and above subject',
    effect: 'Bright edge around subject, separates from background',
    bestFor: ['Adding dimension','Hair light','Separating dark hair from dark background'],
    avoid: ['As sole light source (unless very dramatic)'],
  },
];

export interface LightHeight {
  position: string;
  degrees: number;
  effect: string;
  catchlights: string;
}

export const LIGHT_HEIGHTS: LightHeight[] = [
  {
    position: 'Below eye level',
    degrees: -15,
    effect: 'Horror/monster lighting - shadows go up, unnatural',
    catchlights: 'Bottom of eye - very unusual',
  },
  {
    position: 'Eye level',
    degrees: 0,
    effect: 'Flat, even lighting - can look boring',
    catchlights: 'Middle of eye',
  },
  {
    position: 'Slightly above (15-30 deg)',
    degrees: 22,
    effect: 'Natural, like sun - most flattering',
    catchlights: 'Upper portion of eye - looks natural',
  },
  {
    position: 'High above (45 deg)',
    degrees: 45,
    effect: 'Dramatic shadows under brows, nose, chin',
    catchlights: 'Top of eye - very dramatic',
  },
  {
    position: 'Directly above (90 deg)',
    degrees: 90,
    effect: 'Deep eye sockets in shadow, raccoon eyes',
    catchlights: 'May not be visible at all',
  },
];

// ============================================================================
// Distance Guidelines
// ============================================================================

export interface DistanceGuideline {
  id: string;
  scenario: string;
  subjectToBackground: {
    minimum: string;
    recommended: string;
    reason: string;
  };
  lightToSubject: {
    keyLight: string;
    fillLight: string;
    reason: string;
  };
  cameraToSubject: string;
  tips: string[];
}

export const DISTANCE_GUIDELINES: DistanceGuideline[] = [
  {
    id: 'headshot',
    scenario: 'Headshot Portrait (1 person)',
    subjectToBackground: {
      minimum: '1.5 meters (5 feet)',
      recommended: '2-3 meters (6-10 feet)',
      reason: 'Creates separation, allows background to blur, prevents spill shadows',
    },
    lightToSubject: {
      keyLight: '1-2 meters (3-6 feet)',
      fillLight: '1.5-2.5 meters (5-8 feet) or use reflector at 0.5-1m',
      reason: 'Close enough for soft light quality, far enough for even coverage',
    },
    cameraToSubject: '2-4 meters with 85-135mm lens',
    tips: [
      'Closer light = softer shadows but quicker falloff','Farther background = more blur (bokeh)','Keep subject away from walls to avoid harsh shadows',
    ],
  },
  {
    id: 'full_body',
    scenario: 'Full Body Portrait (1 person)',
    subjectToBackground: {
      minimum: '2 meters (6 feet)',
      recommended: '3-4 meters (10-13 feet)',
      reason: 'Even background illumination, no floor shadow spill',
    },
    lightToSubject: {
      keyLight: '2-3 meters (6-10 feet)',
      fillLight: '2.5-4 meters (8-13 feet)',
      reason: 'Covers full body evenly, larger modifier or move back',
    },
    cameraToSubject: '3-5 meters with 50-85mm lens',
    tips: [
      'Raise light higher for full body coverage','May need larger modifier or second light for even coverage','Watch for floor shadows',
    ],
  },
  {
    id: 'group_small',
    scenario: 'Small Group (2-5 people)',
    subjectToBackground: {
      minimum: '2 meters (6 feet)',
      recommended: '3-4 meters (10-13 feet)',
      reason: 'Prevents shadow overlap on background',
    },
    lightToSubject: {
      keyLight: '2.5-4 meters (8-13 feet)',
      fillLight: '3-5 meters (10-16 feet) or large reflector',
      reason: 'Must cover width of group evenly',
    },
    cameraToSubject: '4-6 meters with 35-50mm lens',
    tips: [
      'Position subjects in slight arc facing camera','Use f/5.6-f/8 for adequate depth of field','Light from both sides may be needed',
    ],
  },
  {
    id: 'class_photo',
    scenario: 'Class/Large Group (10-30 people)',
    subjectToBackground: {
      minimum: '3 meters (10 feet)',
      recommended: '4-6 meters (13-20 feet)',
      reason: 'Multiple rows need space, even background coverage',
    },
    lightToSubject: {
      keyLight: '4-6 meters (13-20 feet) - two lights recommended',
      fillLight: '5-7 meters (16-23 feet) or large bounce',
      reason: 'Must cover 3-5 meter width evenly, use two key lights at 45 degrees',
    },
    cameraToSubject: '6-10 meters with 24-35mm lens',
    tips: [
      'Use risers/benches to create rows','Two key lights at 45 degrees each side is essential','f/8-f/11 for depth of field across all rows','Front row sitting, back rows standing on risers','Everyone must see the camera lens',
    ],
  },
  {
    id: 'school_portrait',
    scenario: 'School Portrait (High Volume)',
    subjectToBackground: {
      minimum: '1.5 meters (5 feet)',
      recommended: '2 meters (6 feet)',
      reason: 'Consistent backdrop, easy to move between subjects',
    },
    lightToSubject: {
      keyLight: '1.5-2 meters (5-6 feet) - fixed position',
      fillLight: '2-2.5 meters (6-8 feet) or reflector at 1m',
      reason: 'Consistent exposure for every student',
    },
    cameraToSubject: '2.5-3 meters with 85-105mm lens',
    tips: [
      'Mark floor positions with tape','Lock focus at fixed distance','Use posing stool at exact marked position','Same settings for all students','Hair light 1.5m behind and 1m above subject',
    ],
  },
];

// ============================================================================
// Equipment Setup Recommendations
// ============================================================================

export interface EquipmentSetup {
  id: string;
  name: string;
  equipment: string[];
  description: string;
  setup: {
    keyPosition: string;
    fillPosition: string;
    backgroundLight?: string;
    rimLight?: string;
  };
  diagram?: string;
  bestFor: string[];
  limitations: string[];
  tips: string[];
}

export const EQUIPMENT_SETUPS: EquipmentSetup[] = [
  {
    id: 'one_light_reflector',
    name: 'One Light + Reflector',
    equipment: ['1x Flash/Strobe with modifier','1x Reflector (silver or white)'],
    description: 'The most basic professional setup - surprisingly versatile',
    setup: {
      keyPosition: '45 degrees to side, slightly above eye level (1.5-2m from subject)',
      fillPosition: 'Reflector on opposite side, angled to bounce key light into shadows (0.5-1m from subject)',
    },
    bestFor: ['Headshots','Simple portraits','Budget setups','Location work','Learning lighting'],
    limitations: [
      'Limited control over fill intensity (move reflector closer/farther)','No rim/hair light separation','Difficult for full body (may need larger modifier)',
    ],
    tips: [
      'Silver reflector = more fill, contrasty','White reflector = softer, more subtle fill','Move reflector closer for more fill','Angle reflector toward shadow side of face','Can achieve Rembrandt, Loop, or Butterfly with one light','Use a large softbox (90cm+) for softer light',
    ],
  },
  {
    id: 'two_light_basic',
    name: 'Two Light Setup',
    equipment: ['1x Key light with softbox','1x Fill light with umbrella or softbox'],
    description: 'Classic two-light setup with independent control of key and fill',
    setup: {
      keyPosition: '45 degrees to side, 30-45 degrees above (1.5-2m from subject)',
      fillPosition: 'Opposite side of key, closer to camera axis, lower power (2-2.5m from subject)',
    },
    bestFor: ['Professional headshots','Corporate portraits','Consistent results'],
    limitations: [
      'No background or rim separation','Can look "flat" if fill is too strong',
    ],
    tips: [
      'Key-to-fill ratio: start at 2:1 (fill at half power of key)','3:1 ratio = more dramatic','4:1 ratio = very dramatic with deep shadows','Fill should be softer and larger than key',
    ],
  },
  {
    id: 'three_light_classic',
    name: 'Classic Three Light Setup',
    equipment: ['1x Key light with modifier','1x Fill light or reflector','1x Rim/hair light'],
    description: 'The professional standard - key, fill, and separation',
    setup: {
      keyPosition: '45 degrees to side, above eye level',
      fillPosition: 'Opposite side, softer, 1-2 stops less than key',
      rimLight: 'Behind subject, opposite key, aimed at hair/shoulders',
    },
    bestFor: ['Professional portraits','Headshots','Beauty','Commercial work'],
    limitations: [
      'Requires more equipment and space','More complex to balance',
    ],
    tips: [
      'Rim light should not overpower - subtle is better','Use grid on rim light to control spill','Rim light typically 1 stop below key','Position rim to not flare into lens',
    ],
  },
  {
    id: 'group_setup',
    name: 'Group Photo Setup',
    equipment: ['2x Key lights with large modifiers','1-2x Fill lights or reflectors','Background lights if needed'],
    description: 'Setup for groups of 5-30+ people',
    setup: {
      keyPosition: 'TWO key lights at 45 degrees each side, 4-6m from group, high',
      fillPosition: 'Large reflector or umbrella from camera position, or fill light centered',
      backgroundLight: 'Optional: 1-2 lights on background for even illumination',
    },
    bestFor: ['Class photos','Team photos','Group portraits','Events'],
    limitations: [
      'Requires large space','Difficult to control individual faces','Even lighting prioritized over drama',
    ],
    tips: [
      'Both key lights at EQUAL power for even coverage','Higher lights prevent front-row shadows on back row','Use f/8-f/11 for depth of field','Position people in slight arc for equal distance to camera','Tall people in back, short in front',
    ],
  },
  {
    id: 'clamshell',
    name: 'Clamshell Beauty Setup',
    equipment: ['1x Overhead key light (beauty dish or softbox)','1x Fill below (smaller softbox or reflector)'],
    description: 'Classic beauty/glamour lighting with fill from below',
    setup: {
      keyPosition: 'Directly in front, above eye level (45 degrees down)',
      fillPosition: 'Directly below key, angled up at face (reflector on lap or low stand)',
    },
    bestFor: ['Beauty photography','Makeup shots','Glamour','Skin detail'],
    limitations: [
      'Works best for head/shoulders only','Requires subject to look at camera',
    ],
    tips: [
      'Creates signature butterfly catchlights','Minimizes under-eye shadows','Great for showing makeup/skin products','Fill should be 1-2 stops less than key',
    ],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

export function getWhiteBalanceByKelvin(kelvin: number): WhiteBalancePreset | undefined {
  // Find closest match
  return WHITE_BALANCE_PRESETS.reduce((closest, preset) => {
    const currentDiff = Math.abs(preset.kelvin - kelvin);
    const closestDiff = Math.abs(closest.kelvin - kelvin);
    return currentDiff < closestDiff ? preset : closest;
  });
}

export function getColorTemperatureRange(kelvin: number): ColorTemperatureRange | undefined {
  return COLOR_TEMPERATURE_SCALE.find(range => kelvin >= range.min && kelvin < range.max);
}

export function kelvinToRGB(kelvin: number): { r: number; g: number; b: number } {
  // Algorithm based on Tanner Helland's method
  const temp = kelvin / 100;
  let r: number, g: number, b: number;

  if (temp <= 66) {
    r = 255;
    g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(temp) - 161.1195681661));
  } else {
    r = Math.min(255, Math.max(0, 329.698727446 * Math.pow(temp - 60, -0.1332047592)));
    g = Math.min(255, Math.max(0, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)));
  }

  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = Math.min(255, Math.max(0, 138.5177312231 * Math.log(temp - 10) - 305.0447927307));
  }

  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

export function kelvinToHex(kelvin: number): string {
  const { r, g, b } = kelvinToRGB(kelvin);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2, '0')}`;
}

