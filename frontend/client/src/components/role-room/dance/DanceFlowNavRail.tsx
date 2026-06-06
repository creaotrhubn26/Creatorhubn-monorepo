/**
 * DanceFlowNavRail — vertikal icon-rail som erstatter horisontal Tabs på lg+.
 *
 * Mockup-referanse: DanceFlow har en venstre nav-kolonne med ikoner per
 * panel (dashboard, formations, pieces, rehearsal, dancers, video, …).
 * Tooltip på hover viser fullt label så ikonet ikke trenger tekst.
 *
 * På mindre skjermer (under lg) skjules rail og DanceWorkspace faller
 * tilbake til den horisontale `<Tabs>`-komponenten — rail tar for mye plass
 * på mobil/tablet, og horisontal scroll har bedre touch-affordance der.
 *
 * Ikon-mappet til tab-id er en eksplisitt tabell (TAB_ICONS). Tabs uten
 * eksplisitt icon faller tilbake til generic `RadioButtonChecked`. Holder
 * NavRail framework-agnostisk om DanceWorkspace's tab-katalog vokser.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import {
  Dashboard as DashboardIcon,
  PlayCircleOutline as PiecesIcon,
  GroupWork as FormationsIcon,
  EventNote as RehearsalIcon,
  School as StudentsIcon,
  CalendarMonth as SeasonIcon,
  HealthAndSafety as InjuriesIcon,
  Videocam as VideoIcon,
  Class as ClassesIcon,
  Person as InstructorIcon,
  MeetingRoom as RoomsIcon,
  Style as VocabIcon,
  Theaters as PerformancesIcon,
  MusicNote as MusicIcon,
  FilterFrames as ReelIcon,
  Insights as AnalysisIcon,
  CardGiftcard as GrantsIcon,
  Receipt as BillingIcon,
  Workspaces as UnionIcon,
  Groups as TeamIcon,
  Extension as AddonsIcon,
  AttachMoney as PricingIcon,
  AdminPanelSettings as AdminIcon,
  Science as TestersIcon,
  Settings as SettingsIcon,
  RadioButtonChecked as DefaultIcon,
} from '@mui/icons-material';

import { danceFlowColors } from './danceFlowTheme';

/** Tab-id → ikon. Tabs uten oppføring viser DefaultIcon. */
const TAB_ICONS: Record<string, React.ReactElement> = {
  dashboard: <DashboardIcon fontSize="small" />,
  pieces: <PiecesIcon fontSize="small" />,
  formations: <FormationsIcon fontSize="small" />,
  rehearsal_log: <RehearsalIcon fontSize="small" />,
  students: <StudentsIcon fontSize="small" />,
  season: <SeasonIcon fontSize="small" />,
  injuries: <InjuriesIcon fontSize="small" />,
  video: <VideoIcon fontSize="small" />,
  classes: <ClassesIcon fontSize="small" />,
  instructors: <InstructorIcon fontSize="small" />,
  rooms: <RoomsIcon fontSize="small" />,
  movement_vocab: <VocabIcon fontSize="small" />,
  performances: <PerformancesIcon fontSize="small" />,
  music: <MusicIcon fontSize="small" />,
  reel: <ReelIcon fontSize="small" />,
  analysis: <AnalysisIcon fontSize="small" />,
  grants: <GrantsIcon fontSize="small" />,
  billing: <BillingIcon fontSize="small" />,
  union: <UnionIcon fontSize="small" />,
  team: <TeamIcon fontSize="small" />,
  addons: <AddonsIcon fontSize="small" />,
  pricing: <PricingIcon fontSize="small" />,
  admin_plans: <AdminIcon fontSize="small" />,
  admin_testers: <TestersIcon fontSize="small" />,
  admin_settings: <SettingsIcon fontSize="small" />,
};

export interface DanceFlowNavRailItem {
  id: string;
  label: string;
  /** Gruppering — viser en tynn divider mellom grupper. */
  feature?: string;
}

export interface DanceFlowNavRailProps {
  items: readonly DanceFlowNavRailItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Test-id-override. */
  'data-testid'?: string;
}

const RAIL_WIDTH = 56;
const ITEM_SIZE = 40;

export default function DanceFlowNavRail({
  items,
  activeId,
  onSelect,
  'data-testid': testId = 'dance-flow-nav-rail',
}: DanceFlowNavRailProps): React.ReactElement {
  // Beregn divider-posisjoner: når feature endrer seg mellom items i.
  const renderRowsWithDividers = (): React.ReactElement[] => {
    const rows: React.ReactElement[] = [];
    let prevFeature: string | undefined;
    items.forEach((item, idx) => {
      const isActive = item.id === activeId;
      if (idx > 0 && item.feature && item.feature !== prevFeature) {
        rows.push(
          <Divider
            key={`div-${idx}`}
            sx={{
              borderColor: danceFlowColors.borderStrong,
              mx: 1,
              my: 0.25,
            }}
          />,
        );
      }
      prevFeature = item.feature;
      rows.push(
        <Tooltip key={item.id} title={item.label} placement="right" arrow>
          <Box
            component="button"
            type="button"
            onClick={() => onSelect(item.id)}
            data-testid={`${testId}-${item.id}`}
            aria-pressed={isActive}
            aria-label={item.label}
            sx={{
              width: ITEM_SIZE,
              height: ITEM_SIZE,
              mx: 'auto',
              p: 0,
              border: 'none',
              borderRadius: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              bgcolor: isActive
                ? 'rgba(167,139,250,0.16)'
                : 'transparent',
              color: isActive
                ? danceFlowColors.lavender
                : danceFlowColors.textMuted,
              transition: 'background-color 120ms, color 120ms',
              '&:hover': {
                bgcolor: 'rgba(167,139,250,0.08)',
                color: danceFlowColors.lavender,
              },
              '&:focus-visible': {
                outline: `2px solid ${danceFlowColors.lavender}`,
                outlineOffset: 1,
              },
              // Venstre-kant-accent for aktiv item
              '&::before': isActive
                ? {
                    content: '""',
                    position: 'absolute',
                    left: -8,
                    top: 6,
                    bottom: 6,
                    width: 3,
                    borderRadius: 1.5,
                    bgcolor: danceFlowColors.lavender,
                  }
                : undefined,
            }}
          >
            {TAB_ICONS[item.id] ?? <DefaultIcon fontSize="small" />}
          </Box>
        </Tooltip>,
      );
    });
    return rows;
  };

  return (
    <Box
      component="nav"
      role="tablist"
      aria-orientation="vertical"
      data-testid={testId}
      sx={{
        width: RAIL_WIDTH,
        flex: `0 0 ${RAIL_WIDTH}px`,
        bgcolor: danceFlowColors.bgPanel,
        borderRight: `1px solid ${danceFlowColors.borderStrong}`,
        py: 1,
        overflowY: 'auto',
        overflowX: 'visible',
        // For aktive ::before-accent skal kunne tegne utenfor item-bounds
        // men ikke utenfor rail-bounds — overflow-x: visible mens parent
        // klipper er greit.
      }}
    >
      <Stack spacing={0.25}>{renderRowsWithDividers()}</Stack>
    </Box>
  );
}
