export const ACADEMY_GOOGLE_VIDS_URL = "https://docs.google.com/videos/";

export type AcademyVidsRecordingMode =
  | "camera"
  | "camera-and-screen"
  | "screen"
  | "voiceover";

export interface AcademyVidsPresenterScene {
  id: string;
  title: string;
  objective: string;
  recordingMode: AcademyVidsRecordingMode;
  durationMinutes: number;
  visualCue: string;
  whyThisMode: string;
  teleprompterScript: string;
}

export interface AcademyVidsPresenterPlan {
  title: string;
  subtitle: string;
  readiness: number;
  primaryMode: AcademyVidsRecordingMode;
  totalDurationMinutes: number;
  missingFields: string[];
  setupChecklist: string[];
  productionNotes: string[];
  starterPrompt: string;
  brief: string;
  teleprompterScript: string;
  scenes: AcademyVidsPresenterScene[];
}

export interface AcademyVidsPresenterPlanInput {
  courseTitle?: string;
  purpose?: string;
  audience?: string;
  transformation?: string;
  competencies?: string[];
  skills?: string[];
  problemsSolved?: string[];
  learningJourney?: string;
  practiceDesign?: string;
  proofOfLearning?: string;
}

interface AcademyVidsPresenterPlanOptions {
  useNorwegian?: boolean;
}

type AcademyVidsPresenterPlanContext = {
  useNorwegian: boolean;
  title: string;
  purpose: string;
  audience: string;
  transformation: string;
  competencies: string[];
  skills: string[];
  problemsSolved: string[];
  learningJourney: string;
  practiceDesign: string;
  proofOfLearning: string;
  missingFields: string[];
  roadmapSkills: string[];
  heroProblem: string;
  readiness: number;
  subtitle: string;
  setupChecklist: string[];
  productionNotes: string[];
};

const SCREEN_HINT_PATTERN =
  /\b(google|drive|docs|vids|notebooklm|academy|studio|app|tool|system|platform|portal|dashboard|workflow|screen|editor|upload|setup|configure|report|crm|excel|slides?)\b/i;
const VOICEOVER_HINT_PATTERN =
  /\b(summary|recap|reflection|debrief|assessment|proof|quiz|faq|checklist)\b/i;

const normalizeText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const normalizeList = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
};

const sentence = (value: string, fallback: string): string => {
  const normalized = normalizeText(value) || fallback;
  return /[.!?]\s*$/u.test(normalized) ? normalized : `${normalized}.`;
};

const joinHumanList = (values: string[], useNorwegian: boolean): string => {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) {
    return `${values[0]} ${useNorwegian ? "og" : "and"} ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")} ${
    useNorwegian ? "og" : "and"
  } ${values[values.length - 1]}`;
};

const labelForRecordingMode = (
  mode: AcademyVidsRecordingMode,
  useNorwegian: boolean,
): string => {
  if (mode === "camera") {
    return useNorwegian ? "Kamera" : "Camera";
  }
  if (mode === "camera-and-screen") {
    return useNorwegian ? "Kamera + skjerm" : "Camera + screen";
  }
  if (mode === "screen") {
    return useNorwegian ? "Skjerm" : "Screen";
  }
  return useNorwegian ? "Voiceover" : "Voiceover";
};

const modeReason = (
  mode: AcademyVidsRecordingMode,
  useNorwegian: boolean,
): string => {
  if (mode === "camera") {
    return useNorwegian
      ? "Bruk instruktøren i bildet for tillit, energi og tydelig ledelse."
      : "Use the instructor on camera for trust, energy, and clear leadership.";
  }
  if (mode === "camera-and-screen") {
    return useNorwegian
      ? "Bruk eget ansikt samtidig som du viser verktøyet eller arbeidsflaten."
      : "Keep the presenter visible while showing the tool or working surface.";
  }
  if (mode === "screen") {
    return useNorwegian
      ? "La skjermen være i fokus, men behold manus og rytme fra teleprompteren."
      : "Keep the screen in focus while still following the teleprompter script.";
  }
  return useNorwegian
    ? "Bruk voiceover kun der oppsummering eller evaluering er viktigere enn kameratilstedeværelse."
    : "Use voiceover only when recap or assessment matters more than camera presence.";
};

const recordingModeForSkill = (
  skill: string,
  useNorwegian: boolean,
): AcademyVidsRecordingMode => {
  const normalized = normalizeText(skill);
  if (!normalized) return "camera";
  if (VOICEOVER_HINT_PATTERN.test(normalized)) {
    return "voiceover";
  }
  if (SCREEN_HINT_PATTERN.test(normalized)) {
    return useNorwegian ? "camera-and-screen" : "camera-and-screen";
  }
  return "camera";
};

const roundToQuarter = (value: number): number =>
  Math.max(0.5, Math.round(value * 4) / 4);

const buildStarterPrompt = (
  title: string,
  audience: string,
  transformation: string,
  scenes: AcademyVidsPresenterScene[],
  useNorwegian: boolean,
): string => {
  const sceneLines = scenes.map(
    (scene, index) =>
      `${index + 1}. ${scene.title} [${labelForRecordingMode(
        scene.recordingMode,
        useNorwegian,
      )}] - ${scene.objective}`,
  );

  if (useNorwegian) {
    return [
      `Lag et presenterdrevet kursutkast i Google Vids med tittelen "${title}".`,
      `Maalgruppe: ${audience}.`,
      `Transformasjon: ${transformation}.`,
      "Prioriter opptak av instruktoren selv. Bruk Record myself og teleprompter for alle scener.",
      "Naar en scene er merket Kamera + skjerm, bruk Camera and screen-opptak i stedet for ren AI-video.",
      "Hold uttrykket rolig, pedagogisk og troverdig. Bruk AI kun til enkel intro/outro eller B-roll hvis det faktisk trengs.",
      "Foreslaa et enkelt storyboard med disse scenene:",
      ...sceneLines,
      "Avslutt med en tydelig CTA og eksporter finalen som MP4 til Google Drive.",
    ].join("\n");
  }

  return [
    `Create a presenter-led training video draft in Google Vids titled "${title}".`,
    `Audience: ${audience}.`,
    `Transformation: ${transformation}.`,
    "Prioritize the real instructor on camera. Use Record myself and teleprompter for every scene.",
    "Whenever a scene is marked Camera + screen, use camera-and-screen capture instead of pure AI video.",
    "Keep the style calm, practical, and credible. Use AI only for light intro/outro or B-roll if needed.",
    "Suggest a simple storyboard with these scenes:",
    ...sceneLines,
    "End with a clear CTA and export the final video as an MP4 to Google Drive.",
  ].join("\n");
};

const buildBrief = (
  title: string,
  purpose: string,
  audience: string,
  transformation: string,
  competencies: string[],
  skills: string[],
  problemsSolved: string[],
  learningJourney: string,
  practiceDesign: string,
  proofOfLearning: string,
  scenes: AcademyVidsPresenterScene[],
  useNorwegian: boolean,
): string => {
  const sceneLines = scenes.map(
    (scene, index) =>
      `${index + 1}. ${scene.title} (${labelForRecordingMode(
        scene.recordingMode,
        useNorwegian,
      )})\n   ${scene.objective}\n   ${scene.visualCue}`,
  );

  if (useNorwegian) {
    return [
      `Google Vids opptaksbrief: ${title}`,
      "",
      `Formaal: ${purpose}`,
      `Maalgruppe: ${audience}`,
      `Transformasjon: ${transformation}`,
      competencies.length > 0
        ? `Kompetanser: ${joinHumanList(competencies, true)}`
        : "",
      skills.length > 0 ? `Ferdigheter: ${joinHumanList(skills, true)}` : "",
      problemsSolved.length > 0
        ? `Problemer kurset loeser: ${joinHumanList(problemsSolved, true)}`
        : "",
      learningJourney ? `Laeringsreise: ${learningJourney}` : "",
      practiceDesign ? `Praksisdesign: ${practiceDesign}` : "",
      proofOfLearning ? `Bevis paa laering: ${proofOfLearning}` : "",
      "",
      "Opptaksstrategi:",
      "Dette skal vaere en presenterdrevet video der instruktoren hovedsakelig spiller inn seg selv i Google Vids. AI brukes kun som hjelp til storyboard, manusforbedring og enkel visuell støtte.",
      "",
      "Scener:",
      ...sceneLines,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Google Vids recording brief: ${title}`,
    "",
    `Purpose: ${purpose}`,
    `Audience: ${audience}`,
    `Transformation: ${transformation}`,
    competencies.length > 0
      ? `Competencies: ${joinHumanList(competencies, false)}`
      : "",
    skills.length > 0 ? `Skills: ${joinHumanList(skills, false)}` : "",
    problemsSolved.length > 0
      ? `Problems solved: ${joinHumanList(problemsSolved, false)}`
      : "",
    learningJourney ? `Learning journey: ${learningJourney}` : "",
    practiceDesign ? `Practice design: ${practiceDesign}` : "",
    proofOfLearning ? `Proof of learning: ${proofOfLearning}` : "",
    "",
    "Recording strategy:",
    "This should be a presenter-led video where the instructor mainly records themselves in Google Vids. AI should only support storyboard generation, script refinement, and light visual support.",
    "",
    "Scenes:",
    ...sceneLines,
  ]
    .filter(Boolean)
    .join("\n");
};

const buildTeleprompterScript = (
  scenes: AcademyVidsPresenterScene[],
  useNorwegian: boolean,
): string => {
  return scenes
    .map((scene, index) =>
      [
        `${useNorwegian ? "Scene" : "Scene"} ${index + 1}: ${scene.title}`,
        scene.teleprompterScript,
      ].join("\n"),
    )
    .join("\n\n");
};

const resolvePresenterPlanContext = (
  input: AcademyVidsPresenterPlanInput,
  options: AcademyVidsPresenterPlanOptions = {},
): AcademyVidsPresenterPlanContext => {
  const useNorwegian = options.useNorwegian !== false;
  const title =
    normalizeText(input.courseTitle) ||
    (useNorwegian ? "Nytt kurs" : "New course");
  const purpose = sentence(
    normalizeText(input.purpose),
    useNorwegian
      ? "Dette kurset skal gi deltakerne et tydelig neste steg i praksis"
      : "This course should give learners a clear next practical step",
  );
  const audience =
    normalizeText(input.audience) ||
    (useNorwegian
      ? "målgruppen du ønsker å trene opp"
      : "the audience you want to train");
  const transformation = sentence(
    normalizeText(input.transformation),
    useNorwegian
      ? "Deltakerne skal gå fra usikker utførelse til trygg gjennomføring"
      : "Learners should move from uncertain execution to confident delivery",
  );
  const competencies = normalizeList(input.competencies).slice(0, 3);
  const skills = normalizeList(input.skills).slice(0, 4);
  const problemsSolved = normalizeList(input.problemsSolved).slice(0, 3);
  const learningJourney = sentence(
    normalizeText(input.learningJourney),
    useNorwegian
      ? "Videoen skal starte enkelt, gi mestring tidlig og bygge mot trygg bruk i arbeidshverdagen"
      : "The video should start simple, create early wins, and build toward confident workplace use",
  );
  const practiceDesign = sentence(
    normalizeText(input.practiceDesign),
    useNorwegian
      ? "Vis hva deltakeren skal gjøre, ikke bare hva de skal forstå"
      : "Show what the learner should do, not only what they should understand",
  );
  const proofOfLearning = sentence(
    normalizeText(input.proofOfLearning),
    useNorwegian
      ? "Avslutt med en konkret oppgave, sjekkliste eller demonstrasjon av mestring"
      : "End with a concrete task, checklist, or demonstration of mastery",
  );

  const missingFields = [
    normalizeText(input.purpose)
      ? null
      : useNorwegian
        ? "Formål mangler"
        : "Purpose is missing",
    normalizeText(input.audience)
      ? null
      : useNorwegian
        ? "Målgruppe mangler"
        : "Audience is missing",
    normalizeText(input.transformation)
      ? null
      : useNorwegian
        ? "Transformasjon mangler"
        : "Transformation is missing",
    skills.length > 0
      ? null
      : useNorwegian
        ? "Ferdigheter mangler"
        : "Skills are missing",
    normalizeText(input.proofOfLearning)
      ? null
      : useNorwegian
        ? "Proof of learning mangler"
        : "Proof of learning is missing",
  ].filter((value): value is string => Boolean(value));

  const roadmapSkills =
    skills.length > 0
      ? skills
      : competencies.length > 0
        ? competencies
        : [useNorwegian ? "hovedkompetansen" : "the core competency"];
  const heroProblem =
    problemsSolved[0] ||
    (useNorwegian
      ? "uklar gjennomføring i praksis"
      : "unclear real-world execution");
  const readiness = Math.max(
    1,
    Math.round(((5 - missingFields.length) / 5) * 100),
  );
  const subtitle = useNorwegian
    ? "Presenter-led Vids-opptak med teleprompter og ekte instruktør i sentrum."
    : "Presenter-led Vids recording with teleprompter and the real instructor at the center.";
  const setupChecklist = useNorwegian
    ? [
        "Start med et nytt Google Vids-prosjekt eller bruk Help me create med briefen under.",
        "Bruk Record myself som standard. Naar en scene er merket Kamera + skjerm, velger du Camera and screen.",
        "Lim inn scene-manuset i teleprompteren scene for scene i stedet for aa lese fra et langt dokument.",
        "Hold hver scene kort. Spill heller inn flere korte scener enn ett langt take.",
        "Eksporter sluttvideoen som MP4 til Google Drive og koble den tilbake i Academy via Media Studio.",
      ]
    : [
        "Start a new Google Vids project or use Help me create with the brief below.",
        "Use Record myself as the default. When a scene is marked Camera + screen, choose Camera and screen.",
        "Paste the scene script into the teleprompter one scene at a time instead of reading from one long document.",
        "Keep scenes short. It is better to record several short scenes than one long take.",
        "Export the final video as an MP4 to Google Drive and connect it back into Academy through Media Studio.",
      ];
  const productionNotes = useNorwegian
    ? [
        "AI skal være støtte, ikke erstatning for instruktøren. Bruk AI-klipp kun hvis de gjør forklaringen tydeligere.",
        "Velg kamera-scener for tillit og energi. Bruk kamera + skjerm bare der seeren faktisk trenger å se arbeidsflaten.",
        "Teleprompter-manuset bør høres ut som muntlig undervisning, ikke som kursnotater.",
      ]
    : [
        "AI should support the instructor, not replace them. Use AI clips only if they make the explanation clearer.",
        "Choose camera scenes for trust and energy. Use camera + screen only where the viewer truly needs to see the workspace.",
        "The teleprompter script should sound like spoken teaching, not course notes.",
      ];

  return {
    useNorwegian,
    title,
    purpose,
    audience,
    transformation,
    competencies,
    skills,
    problemsSolved,
    learningJourney,
    practiceDesign,
    proofOfLearning,
    missingFields,
    roadmapSkills,
    heroProblem,
    readiness,
    subtitle,
    setupChecklist,
    productionNotes,
  };
};

const buildPresenterPlanOutput = (
  context: AcademyVidsPresenterPlanContext,
  scenes: AcademyVidsPresenterScene[],
): AcademyVidsPresenterPlan => {
  const totalDurationMinutes = roundToQuarter(
    scenes.reduce((sum, scene) => sum + scene.durationMinutes, 0),
  );
  const primaryMode = scenes.some(
    (scene) => scene.recordingMode === "camera-and-screen",
  )
    ? "camera-and-screen"
    : scenes.some((scene) => scene.recordingMode === "camera")
      ? "camera"
      : scenes[0]?.recordingMode || "camera";
  const starterPrompt = buildStarterPrompt(
    context.title,
    context.audience,
    context.transformation,
    scenes,
    context.useNorwegian,
  );
  const brief = buildBrief(
    context.title,
    context.purpose,
    context.audience,
    context.transformation,
    context.competencies,
    context.roadmapSkills,
    context.problemsSolved,
    context.learningJourney,
    context.practiceDesign,
    context.proofOfLearning,
    scenes,
    context.useNorwegian,
  );
  const teleprompterScript = buildTeleprompterScript(
    scenes,
    context.useNorwegian,
  );

  return {
    title: context.title,
    subtitle: context.subtitle,
    readiness: context.readiness,
    primaryMode,
    totalDurationMinutes,
    missingFields: context.missingFields,
    setupChecklist: context.setupChecklist,
    productionNotes: context.productionNotes,
    starterPrompt,
    brief,
    teleprompterScript,
    scenes,
  };
};

export const buildAcademyVidsPresenterPlan = (
  input: AcademyVidsPresenterPlanInput,
  options: AcademyVidsPresenterPlanOptions = {},
): AcademyVidsPresenterPlan => {
  const context = resolvePresenterPlanContext(input, options);

  const scenes: AcademyVidsPresenterScene[] = [
    {
      id: "hook",
      title: context.useNorwegian ? "Hook og løfte" : "Hook and promise",
      objective: context.useNorwegian
        ? "Vis hva seeren får ut av videoen og hvorfor instruktøren er verdt å følge."
        : "Show what the viewer will gain and why the instructor is worth following.",
      recordingMode: "camera",
      durationMinutes: 0.75,
      visualCue: context.useNorwegian
        ? "Snakk rett til kamera med rolig bakgrunn og tydelig tittel som lower third."
        : "Talk straight to camera with a calm background and a clear title lower third.",
      whyThisMode: modeReason("camera", context.useNorwegian),
      teleprompterScript: context.useNorwegian
        ? `Hei, og velkommen. I denne videoen skal vi jobbe med ${context.title}. Hvis du er ${context.audience}, er maalet at du skal kunne ${context.transformation.toLowerCase()} Når vi er ferdige, vet du hva du skal gjøre først, hva du skal se etter, og hvordan du kan bruke dette trygt i praksis.`
        : `Hi, and welcome. In this video, we are working on ${context.title}. If you are ${context.audience}, the goal is that you will ${context.transformation.toLowerCase()} By the end, you will know what to do first, what to look for, and how to use this confidently in practice.`,
    },
    {
      id: "why-now",
      title: context.useNorwegian ? "Hvorfor dette er viktig" : "Why this matters",
      objective: context.useNorwegian
        ? "Knytt kurset til den faktiske situasjonen målgruppen står i."
        : "Connect the course to the real situation the audience is facing.",
      recordingMode: "camera",
      durationMinutes: 0.75,
      visualCue: context.useNorwegian
        ? "Bruk eget ansikt og ett enkelt støtteord eller stikkord ved siden av deg."
        : "Use your face and one simple supporting keyword beside you.",
      whyThisMode: modeReason("camera", context.useNorwegian),
      teleprompterScript: context.useNorwegian
        ? `Mange som jobber med dette strever fordi ${context.heroProblem}. Derfor holder det ikke å bare kjenne teorien. Du trenger et tydelig handlingsmønster du kan bruke med en gang. Det er akkurat det denne videoen skal gi deg.`
        : `Many people struggle here because of ${context.heroProblem}. That is why theory alone is not enough. You need a clear action pattern you can use right away. That is exactly what this video is designed to give you.`,
    },
    {
      id: "roadmap",
      title: context.useNorwegian
        ? "Slik er videoen bygget opp"
        : "How this video is structured",
      objective: context.useNorwegian
        ? "Gi seeren trygghet ved å vise rekkefølgen og læringsløftet."
        : "Give the viewer confidence by showing the sequence and learning promise.",
      recordingMode: context.skills.some((skill) => SCREEN_HINT_PATTERN.test(skill))
        ? "camera-and-screen"
        : "camera",
      durationMinutes: 0.75,
      visualCue: context.useNorwegian
        ? "Vis en enkel scene- eller punktoversikt mens du fortsatt er synlig i bildet."
        : "Show a simple scene or bullet roadmap while you remain visible on screen.",
      whyThisMode: modeReason(
        context.skills.some((skill) => SCREEN_HINT_PATTERN.test(skill))
          ? "camera-and-screen"
          : "camera",
        context.useNorwegian,
      ),
      teleprompterScript: context.useNorwegian
        ? `Vi tar dette i en enkel rekkefølge. Først setter vi rammen. Deretter går vi gjennom ${joinHumanList(
            context.roadmapSkills.slice(0, 3),
            true,
          )}. Til slutt viser jeg deg hvordan du kan sjekke at du faktisk mestrer dette selv.`
        : `We will move through this in a simple order. First, we set the frame. Then we walk through ${joinHumanList(
            context.roadmapSkills.slice(0, 3),
            false,
          )}. Finally, I will show you how to check that you can actually do this yourself.`,
    },
    ...context.roadmapSkills.slice(0, 3).map((skill, index) => {
      const mode = recordingModeForSkill(skill, context.useNorwegian);
      return {
        id: `skill-${index + 1}`,
        title: skill,
        objective: context.useNorwegian
          ? `La seeren forstå og utføre ${skill.toLowerCase()} i en realistisk arbeidssituasjon.`
          : `Help the viewer understand and perform ${skill.toLowerCase()} in a realistic work situation.`,
        recordingMode: mode,
        durationMinutes: roundToQuarter(mode === "camera" ? 1.25 : 1.5),
        visualCue:
          mode === "camera-and-screen"
            ? context.useNorwegian
              ? "Hold kameraet på deg selv mens du viser arbeidsflaten, verktøyet eller systemet."
              : "Keep yourself on camera while showing the workspace, tool, or system."
            : mode === "voiceover"
              ? context.useNorwegian
                ? "Bruk enkel støttegrafikk eller en sjekkliste mens du leser manus rolig."
                : "Use simple support graphics or a checklist while reading the script calmly."
              : context.useNorwegian
                ? "Forklar med eget ansikt i kamera og bruk hender, pauser og eksempler aktivt."
                : "Explain on camera and use your hands, pauses, and examples actively.",
        whyThisMode: modeReason(mode, context.useNorwegian),
        teleprompterScript: context.useNorwegian
          ? `Naa ser vi paa ${skill.toLowerCase()}. Legg merke til hva jeg gjør først, hva jeg vurderer underveis, og hva som viser at vi er paa rett spor. Poenget er ikke bare aa kjenne trinnene, men aa kunne gjenta dem selv etterpaa.`
          : `Now we are looking at ${skill.toLowerCase()}. Notice what I do first, what I evaluate as I go, and what shows we are on the right track. The goal is not only to know the steps, but to be able to repeat them yourself afterward.`,
      };
    }),
    {
      id: "proof-and-cta",
      title: context.useNorwegian
        ? "Mestringssjekk og neste steg"
        : "Mastery check and next step",
      objective: context.useNorwegian
        ? "Knytt videoen til praksis, oppgave eller refleksjon som viser mestring."
        : "Connect the video to a practice step, assignment, or reflection that proves mastery.",
      recordingMode: "camera",
      durationMinutes: 0.75,
      visualCue: context.useNorwegian
        ? "Avslutt på kamera, gjerne med en enkel sjekkliste eller oppgave ved siden av deg."
        : "End on camera, ideally with a simple checklist or task beside you.",
      whyThisMode: modeReason("camera", context.useNorwegian),
      teleprompterScript: context.useNorwegian
        ? `${context.proofOfLearning} Etter denne videoen vil jeg at du gjennomfører ett konkret forsøk selv, og sammenligner det du gjør med punktene vi nettopp gikk gjennom. Da blir dette ikke bare noe du har sett, men noe du faktisk kan bruke.`
        : `${context.proofOfLearning} After this video, I want you to complete one concrete attempt on your own and compare what you do with the points we just covered. That is how this becomes something you can actually use, not just something you watched.`,
    },
  ];

  return buildPresenterPlanOutput(context, scenes);
};

export const buildAcademyVidsPresenterPlanFromScenes = (
  input: AcademyVidsPresenterPlanInput,
  scenesInput: AcademyVidsPresenterScene[],
  options: AcademyVidsPresenterPlanOptions = {},
): AcademyVidsPresenterPlan => {
  const context = resolvePresenterPlanContext(input, options);
  const fallbackPlan = buildAcademyVidsPresenterPlan(input, options);
  const scenes = Array.isArray(scenesInput)
    ? scenesInput
        .map((scene, index) => {
          const fallbackScene = fallbackPlan.scenes[index] || fallbackPlan.scenes[0];
          if (!scene || typeof scene !== "object") {
            return fallbackScene || null;
          }
          const title = normalizeText(scene.title) || fallbackScene?.title || "";
          const objective =
            normalizeText(scene.objective) || fallbackScene?.objective || "";
          const visualCue =
            normalizeText(scene.visualCue) || fallbackScene?.visualCue || "";
          const whyThisMode =
            normalizeText(scene.whyThisMode) || fallbackScene?.whyThisMode || "";
          const teleprompterScript =
            normalizeText(scene.teleprompterScript) ||
            fallbackScene?.teleprompterScript ||
            "";
          const recordingMode =
            scene.recordingMode === "camera" ||
            scene.recordingMode === "camera-and-screen" ||
            scene.recordingMode === "screen" ||
            scene.recordingMode === "voiceover"
              ? scene.recordingMode
              : fallbackScene?.recordingMode || "camera";
          const durationMinutes = roundToQuarter(
            Math.max(
              0.5,
              Number.isFinite(Number(scene.durationMinutes))
                ? Number(scene.durationMinutes)
                : fallbackScene?.durationMinutes || 0.75,
            ),
          );

          if (!title || !objective || !visualCue || !teleprompterScript) {
            return fallbackScene || null;
          }

          return {
            id: normalizeText(scene.id) || fallbackScene?.id || `scene-${index + 1}`,
            title,
            objective,
            recordingMode,
            durationMinutes,
            visualCue,
            whyThisMode,
            teleprompterScript,
          };
        })
        .filter((scene): scene is AcademyVidsPresenterScene => Boolean(scene))
    : [];

  return buildPresenterPlanOutput(
    context,
    scenes.length > 0 ? scenes : fallbackPlan.scenes,
  );
};

export const academyVidsRecordingModeLabel = labelForRecordingMode;
