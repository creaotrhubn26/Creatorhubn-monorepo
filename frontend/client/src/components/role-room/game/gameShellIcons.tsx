/** Ikoner per fane i Story Graph-skallet (Fase 7b). */
import React from 'react';
import {
  HomeOutlined, AutoStoriesOutlined, MovieOutlined, PeopleOutlined, PlaceOutlined, DevicesOutlined, AccountTreeOutlined,
  CategoryOutlined, DataObjectOutlined, TimelineOutlined, PlayCircleOutline, TranslateOutlined, IosShareOutlined,
  ImageOutlined, HistoryOutlined, GroupsOutlined, SellOutlined, CreditCardOutlined, AdminPanelSettingsOutlined, LinkOutlined,
} from '@mui/icons-material';

const ICONS: Record<string, React.ElementType> = {
  home: HomeOutlined, story: AutoStoriesOutlined, scenes: MovieOutlined, characters: PeopleOutlined, locations: PlaceOutlined,
  platform: DevicesOutlined, boards: AccountTreeOutlined, components: CategoryOutlined, variables: DataObjectOutlined,
  plan: TimelineOutlined, play: PlayCircleOutline, translations: TranslateOutlined, exports: IosShareOutlined,
  assets: ImageOutlined, history: HistoryOutlined, team: GroupsOutlined, pricing: SellOutlined, billing: CreditCardOutlined,
  admin_plans: AdminPanelSettingsOutlined, integrations: LinkOutlined,
};

export function gameTabIcon(tabId: string, fontSize = 18): React.ReactElement | null {
  const Icon = ICONS[tabId];
  return Icon ? <Icon sx={{ fontSize }} /> : null;
}

export const GAME_SECTION_LABELS: Record<'core' | 'production' | 'resources' | 'finance', string> = {
  core: 'Prosjekt', production: 'Produksjon', resources: 'Ressurser', finance: 'Studio',
};
