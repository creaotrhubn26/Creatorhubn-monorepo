import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import {
  useAdminPageCustomizations,
  usePublishPage,
  useSavePageCustomizations,
} from '@/hooks/usePageCustomizations';
import LandingPageSectionEditor from './LandingPageSectionEditor';

type LandingPageId = 'landing-desktop' | 'landing-mobile';

const getDefaultSections = (pageId: LandingPageId) => {
  if (pageId === 'landing-mobile') {
    return {
      hero: {
        id: 'hero',
        title: 'Hero',
        subtitle: 'Mobil hero',
        content: 'Alt du trenger for a drive en profesjonell kreativ virksomhet i Norge',
        items: [
          { title: 'Prosjektadministrasjon', description: 'Hold oversikt over prosjekter og leveranser.' },
          { title: 'StoryArc Studio', description: 'Automatisk videoredigering med NLE-eksport.' },
          { title: 'Academy & Community', description: 'Laer nye ferdigheter og nettverk med andre.' },
        ],
        fields: [
          { key: 'titleLineOne', label: 'Title line 1' },
          { key: 'titleLineTwo', label: 'Title line 2' },
          { key: 'subtitle', label: 'Subtitle', type: 'multiline' },
          { key: 'primaryCtaLabel', label: 'Primary CTA label' },
        ],
      },
      features: {
        id: 'features',
        title: 'Features',
        subtitle: 'Plattformen for de kreative',
        content: 'Alt du trenger for a drive en profesjonell kreativ virksomhet i Norge',
        items: [
          { title: 'Prosjektadministrasjon', description: 'Effektiv prosjektstyring og planlegging.' },
          { title: 'StoryArc Studio', description: 'Videoredigering og story arcs automatisk.' },
          { title: 'Integrasjoner', description: 'Google Workspace, DaVinci Resolve, Premiere Pro.' },
          { title: 'Academy & Community', description: 'Kurs, tutorials og community.' },
        ],
        fields: [
          { key: 'badgeLabel', label: 'Badge label' },
          { key: 'title', label: 'Title' },
          { key: 'highlight', label: 'Highlight' },
          { key: 'subtitle', label: 'Subtitle', type: 'multiline' },
        ],
      },
      cta: {
        id: 'cta',
        title: 'CTA',
        subtitle: 'Klar til a revolusjonere din kreative virksomhet?',
        content: 'Bli med i CreatorHub Norge i dag og opplev forskjellen profesjonelle verktoy kan gjore.',
        fields: [
          { key: 'titlePrefix', label: 'Title prefix' },
          { key: 'highlight', label: 'Title highlight' },
          { key: 'titleSuffix', label: 'Title suffix' },
          { key: 'subtitle', label: 'Subtitle', type: 'multiline' },
          { key: 'ctaLabel', label: 'CTA label' },
        ],
      },
      partner: {
        id: 'partner',
        title: 'Samarbeidspartner',
        content: 'Evendi gir brudeparene flyt og forutsigbarhet. CreatorHub Norge sorger for at du leverer med profesjonalitet og lonnsomhet.',
        fields: [
          { key: 'enabled', label: 'Show section', type: 'switch' },
          { key: 'title', label: 'Section title' },
          { key: 'description', label: 'Description', type: 'multiline' },
          { key: 'logoUrl', label: 'Logo URL' },
          { key: 'ctaLabel', label: 'CTA label' },
          { key: 'dialogTitle', label: 'Dialog title' },
          { key: 'dialogBody', label: 'Dialog body', type: 'multiline' },
          { key: 'dialogBullets', label: 'Dialog bullets', type: 'multiline', helperText: 'One bullet per line' },
        ],
      },
      video: {
        id: 'video',
        title: 'Video',
        content: 'Plassholder for video som viser samarbeid, flyt og resultater.',
        fields: [
          { key: 'enabled', label: 'Show section', type: 'switch' },
          { key: 'showEmbeddedVideo', label: 'Embedded video', type: 'switch' },
          { key: 'title', label: 'Title' },
          { key: 'description', label: 'Description', type: 'multiline' },
          { key: 'videoUrl', label: 'Video URL' },
          { key: 'posterUrl', label: 'Poster URL' },
          { key: 'autoPlay', label: 'Autoplay', type: 'switch' },
          { key: 'loop', label: 'Loop', type: 'switch' },
          { key: 'showControls', label: 'Show controls', type: 'switch' },
          { key: 'showLoadingLogo', label: 'Show loading logo', type: 'switch' },
        ],
      },
      cinematic: {
        id: 'cinematic',
        title: 'Cinematic',
        fields: [
          { key: 'enabled', label: 'Enable cinematic', type: 'switch' },
          { key: 'contrast', label: 'Contrast', type: 'number' },
          { key: 'saturate', label: 'Saturate', type: 'number' },
          { key: 'overlayTopOpacity', label: 'Overlay top opacity', type: 'number' },
          { key: 'overlayBottomOpacity', label: 'Overlay bottom opacity', type: 'number' },
          { key: 'glowWarmOpacity', label: 'Warm glow opacity', type: 'number' },
          { key: 'glowCoolOpacity', label: 'Cool glow opacity', type: 'number' },
        ],
      },
      footer: {
        id: 'footer',
        title: 'Footer',
        content: 'Profesjonell prosjektadministrasjon og kreative verktoy for norske fotografer, videografer og musikkprodusenter.',
        fields: [
          { key: 'contactEmail', label: 'Contact email' },
          { key: 'contactPhone', label: 'Contact phone' },
          { key: 'contactLocation', label: 'Contact location' },
          { key: 'privacyLabel', label: 'Privacy link label' },
        ],
        items: [
          { title: 'Hjem', description: '/' },
          { title: 'Om Oss', description: '/about-us' },
          { title: 'Logg Inn', description: 'login' },
          { title: 'Kom i Gang', description: 'cta' },
        ],
      },
      faq: {
        id: 'faq',
        title: 'FAQ',
        subtitle: 'Finn raskt svar pa de vanligste sporsmalene om CreatorHub Norge',
        fields: [
          { key: 'badgeLabel', label: 'Badge label' },
          { key: 'title', label: 'Title' },
          { key: 'highlight', label: 'Highlight' },
          { key: 'subtitle', label: 'Subtitle', type: 'multiline' },
        ],
        items: [
          { title: 'Er CreatorHub Norge gratis?', description: 'CreatorHub Norge tilbyr bade gratis og betalte planer. Du kan starte med en gratis konto for a utforske plattformen.' },
          { title: 'Hvordan kommer jeg i gang?', description: 'Klikk pa "Kom i Gang" knappen og velg din kreative rolle. Du blir guidet gjennom en enkel onboarding.' },
          { title: 'Hvilke yrker stottes?', description: 'Vi stotter fotografer, videografer, musikkprodusenter og leverandorer.' },
        ],
      },
    };
  }

  return {
    hero: {
      id: 'hero',
      title: 'Hero',
      subtitle: 'Profesjonell Kreativ Plattform',
      content: 'Alt-i-ett plattform for kreative i Norge.',
      items: [
        { title: 'Prosjektadministrasjon', description: 'Hold oversikt over alle prosjekter, klienter og leveranser pa ett sted.' },
        { title: 'StoryArc Studio', description: 'Automatisk videoredigering med eksport til DaVinci Resolve, Final Cut Pro og Premiere.' },
        { title: 'Academy & Community', description: 'Laer nye ferdigheter og koble deg til andre norske kreative.' },
      ],
      fields: [
        { key: 'titleLineOne', label: 'Title line 1' },
        { key: 'titleLineTwo', label: 'Title line 2' },
        { key: 'subtitle', label: 'Subtitle', type: 'multiline' },
        { key: 'primaryCtaLabel', label: 'Primary CTA label' },
        { key: 'secondaryCtaLabel', label: 'Secondary CTA label' },
      ],
    },
    howItWorks: {
      id: 'howItWorks',
      title: 'Hvordan fungerer det?',
      subtitle: 'Tre enkle steg til a komme i gang med CreatorHub Norge',
      items: [
        { title: 'Velg din rolle', description: 'Velg om du er fotograf, videograf, musikkprodusent eller leverandor.' },
        { title: 'Opprett din konto', description: 'Registrer deg gratis og kom raskt i gang.' },
        { title: 'Start a jobbe', description: 'Last opp prosjekter, inviter klienter og lever.' },
      ],
    },
    features: {
      id: 'features',
      title: 'Hvorfor CreatorHub Norge?',
      subtitle: 'Alt du trenger for a drive en profesjonell kreativ virksomhet i Norge',
      items: [
        { title: 'Prosjektadministrasjon', description: 'Effektiv prosjektstyring med intelligente losninger.' },
        { title: 'StoryArc Studio', description: 'Profesjonell videoredigering som analyserer innholdet ditt.' },
        { title: 'Integrasjoner', description: 'Google Workspace, DaVinci Resolve, Final Cut Pro, Premiere Pro.' },
        { title: 'Academy & Community', description: 'Laer nye ferdigheter med kurs og tutorials.' },
      ],
      fields: [
        { key: 'badgeLabel', label: 'Badge label' },
        { key: 'title', label: 'Title' },
        { key: 'highlight', label: 'Highlight' },
        { key: 'subtitle', label: 'Subtitle', type: 'multiline' },
      ],
    },
    cta: {
      id: 'cta',
      title: 'Klar til a revolusjonere din kreative virksomhet?',
      subtitle: 'Bli med i CreatorHub Norge i dag og opplev forskjellen profesjonelle verktoy kan gjore.',
      fields: [
        { key: 'titlePrefix', label: 'Title prefix' },
        { key: 'highlight', label: 'Title highlight' },
        { key: 'titleSuffix', label: 'Title suffix' },
        { key: 'subtitle', label: 'Subtitle', type: 'multiline' },
        { key: 'ctaLabel', label: 'CTA label' },
      ],
    },
    partner: {
      id: 'partner',
      title: 'Samarbeidspartner',
      content: 'CreatorHub Norge og Evendi bygger en somlos opplevelse der kreative leverandorer moter brudepar med hoyere kvalitet, bedre flyt og mer fornoyde kunder.',
      fields: [
        { key: 'enabled', label: 'Show section', type: 'switch' },
        { key: 'title', label: 'Section title' },
        { key: 'description', label: 'Description', type: 'multiline' },
        { key: 'logoUrl', label: 'Logo URL' },
        { key: 'ctaLabel', label: 'CTA label' },
        { key: 'dialogTitle', label: 'Dialog title' },
        { key: 'dialogBody', label: 'Dialog body', type: 'multiline' },
        { key: 'dialogBullets', label: 'Dialog bullets', type: 'multiline', helperText: 'One bullet per line' },
      ],
    },
    video: {
      id: 'video',
      title: 'Brukscase og resultater - fortalt visuelt',
      content: 'Her legger vi inn en use case-video som viser hvordan CreatorHub Norge og Evendi skaper bedre flyt, tryggere leveranser og mer fornoyde kunder.',
      fields: [
        { key: 'enabled', label: 'Show section', type: 'switch' },
        { key: 'showEmbeddedVideo', label: 'Embedded video', type: 'switch' },
        { key: 'title', label: 'Title' },
        { key: 'description', label: 'Description', type: 'multiline' },
        { key: 'videoUrl', label: 'Video URL' },
        { key: 'posterUrl', label: 'Poster URL' },
        { key: 'autoPlay', label: 'Autoplay', type: 'switch' },
        { key: 'loop', label: 'Loop', type: 'switch' },
        { key: 'showControls', label: 'Show controls', type: 'switch' },
        { key: 'showLoadingLogo', label: 'Show loading logo', type: 'switch' },
      ],
    },
    cinematic: {
      id: 'cinematic',
      title: 'Cinematic',
      fields: [
        { key: 'enabled', label: 'Enable cinematic', type: 'switch' },
        { key: 'contrast', label: 'Contrast', type: 'number' },
        { key: 'saturate', label: 'Saturate', type: 'number' },
        { key: 'overlayTopOpacity', label: 'Overlay top opacity', type: 'number' },
        { key: 'overlayBottomOpacity', label: 'Overlay bottom opacity', type: 'number' },
        { key: 'glowWarmOpacity', label: 'Warm glow opacity', type: 'number' },
        { key: 'glowCoolOpacity', label: 'Cool glow opacity', type: 'number' },
      ],
    },
    footer: {
      id: 'footer',
      title: 'Footer',
      content: 'Profesjonell prosjektadministrasjon og kreative verktoy for norske fotografer, videografer og musikkprodusenter.',
      fields: [
        { key: 'contactEmail', label: 'Contact email' },
        { key: 'contactPhone', label: 'Contact phone' },
        { key: 'contactLocation', label: 'Contact location' },
        { key: 'privacyLabel', label: 'Privacy link label' },
      ],
      items: [
        { title: 'Hjem', description: '/' },
        { title: 'Om Oss', description: '/about-us' },
        { title: 'Logg Inn', description: 'login' },
        { title: 'Kom i Gang', description: 'cta' },
      ],
    },
    faq: {
      id: 'faq',
      title: 'FAQ',
      subtitle: 'Finn raskt svar pa de vanligste sporsmalene om CreatorHub Norge',
      fields: [
        { key: 'badgeLabel', label: 'Badge label' },
        { key: 'title', label: 'Title' },
        { key: 'highlight', label: 'Highlight' },
        { key: 'subtitle', label: 'Subtitle', type: 'multiline' },
      ],
      items: [
        { title: 'Er CreatorHub Norge gratis?', description: 'CreatorHub Norge tilbyr bade gratis og betalte planer. Du kan starte med en gratis konto for a utforske plattformen.' },
        { title: 'Hvordan kommer jeg i gang?', description: 'Klikk pa "Kom i Gang" knappen og velg din kreative rolle. Du blir guidet gjennom en enkel onboarding.' },
        { title: 'Hvilke yrker stottes?', description: 'Vi stotter fotografer, videografer, musikkprodusenter og leverandorer.' },
      ],
    },
  };
};

const LandingSettingsPanel: React.FC = () => {
  const [pageId, setPageId] = useState<LandingPageId>('landing-desktop');
  const { data, isLoading } = useAdminPageCustomizations(pageId);
  const saveMutation = useSavePageCustomizations();
  const publishMutation = usePublishPage();

  const defaultSections = useMemo(() => getDefaultSections(pageId), [pageId]);
  const initialSections = data?.draftSections || data?.sections || defaultSections;
  const [sections, setSections] = useState<Record<string, any>>(initialSections);

  React.useEffect(() => {
    setSections(initialSections);
  }, [initialSections]);

  const handleSectionSave = (sectionId: string, updatedSection: any) => {
    setSections((prev) => ({ ...prev, [sectionId]: updatedSection }));
  };

  const handleSaveAll = () => {
    saveMutation.mutate({
      pageId,
      customizations: { sections },
      saveAsDraft: true,
    });
  };

  const handlePublish = () => {
    saveMutation.mutate(
      { pageId, customizations: { sections }, saveAsDraft: false },
      { onSuccess: () => publishMutation.mutate(pageId) }
    );
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Landing Settings</Typography>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Page</InputLabel>
            <Select
              label="Page"
              value={pageId}
              onChange={(event) => setPageId(event.target.value as LandingPageId)}
            >
              <MenuItem value="landing-desktop">Landing Desktop</MenuItem>
              <MenuItem value="landing-mobile">Landing Mobile</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Typography variant="body2" color="text.secondary">
          Edit all landing page content, toggles, and cinematic settings. Save as draft or publish.
        </Typography>

        <Divider />

        <Stack spacing={2}>
          {Object.entries(sections).map(([sectionId, section]) => (
            <LandingPageSectionEditor
              key={sectionId}
              sectionId={sectionId}
              sectionName={section.title || sectionId}
              section={section}
              onSave={(updated) => handleSectionSave(sectionId, updated)}
              onVisibilityChange={(visible) =>
                handleSectionSave(sectionId, { ...section, visible })
              }
            />
          ))}
        </Stack>

        <Divider />

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            variant="outlined"
            onClick={handleSaveAll}
            disabled={isLoading || saveMutation.isPending}
          >
            Save Draft
          </Button>
          <Button
            variant="contained"
            onClick={handlePublish}
            disabled={isLoading || publishMutation.isPending}
          >
            Publish
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default LandingSettingsPanel;
