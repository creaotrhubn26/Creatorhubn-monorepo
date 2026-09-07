/**
 * navSections — én definisjon av workspace-navigasjonen.
 *
 * Sidebaren (desktop) og drawer-en (mobil) leser samme struktur. Uten
 * det ville de to drevet fra hverandre — og det var nettopp en slik
 * drift som gjorde at mobilbrukere satt igjen med fem destinasjoner
 * mens desktop hadde tretti.
 *
 * Grupperingen følger arbeidet: daglig arbeid øverst, drift under, så de
 * fagvise teamspacene.
 */

import type { ReactNode } from 'react';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import LeaderboardOutlinedIcon from '@mui/icons-material/LeaderboardOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import SsidChartOutlinedIcon from '@mui/icons-material/SsidChartOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';

import type { WorkspaceItemId } from './workspaceItems';

export interface NavItem {
  id: WorkspaceItemId;
  label: string;
  icon: ReactNode;
  badge?: number;
}

export interface NavSection {
  id: string;
  label?: string;
  items: NavItem[];
}

export function buildNavSections(inboxBadge: number): NavSection[] {
  return [
    {
      id: 'main',
      items: [
        { id: 'overview', label: 'Oversikt', icon: <DashboardOutlinedIcon /> },
        { id: 'inbox', label: 'Innboks', icon: <InboxOutlinedIcon />, badge: inboxBadge },
        { id: 'cases', label: 'Saker', icon: <GavelOutlinedIcon /> },
        { id: 'tasks', label: 'Oppgaver', icon: <TaskAltOutlinedIcon /> },
        { id: 'calendar', label: 'Kalender', icon: <EventOutlinedIcon /> },
      ],
    },
    {
      id: 'operations',
      label: 'Drift',
      items: [
        { id: 'projects', label: 'Prosjekter', icon: <FolderOpenOutlinedIcon /> },
        { id: 'kundeprosjekt', label: 'Kundeprosjekt', icon: <GroupsOutlinedIcon /> },
        { id: 'documents', label: 'Dokumenter', icon: <DescriptionOutlinedIcon /> },
        { id: 'files', label: 'Filer', icon: <InsertDriveFileOutlinedIcon /> },
        { id: 'teamchat', label: 'Teamchat', icon: <ChatBubbleOutlineOutlinedIcon /> },
        { id: 'automations', label: 'Automatiseringer', icon: <AutoFixHighOutlinedIcon /> },
      ],
    },
    {
      id: 'ledelse-group',
      label: 'Ledelse',
      items: [
        { id: 'business-plan', label: 'Forretningsplan', icon: <ArticleOutlinedIcon /> },
        { id: 'funding', label: 'Søknader (IN/EU)', icon: <DescriptionOutlinedIcon /> },
        { id: 'investors', label: 'Investor-pipeline', icon: <LeaderboardOutlinedIcon /> },
        { id: 'partners', label: 'Samarbeidspartnere', icon: <HubOutlinedIcon /> },
        { id: 'role-room-economy', label: 'RR Økonomi', icon: <SsidChartOutlinedIcon /> },
      ],
    },
    {
      id: 'marketing-group',
      label: 'Markedsføring',
      items: [
        { id: 'marketing-cockpit', label: 'Marketing Cockpit', icon: <SsidChartOutlinedIcon /> },
        { id: 'industry-crm', label: 'Tier-1 outreach', icon: <LeaderboardOutlinedIcon /> },
        { id: 'marketing-segments', label: 'Målgrupper', icon: <GroupsOutlinedIcon /> },
        { id: 'newsletter-studio', label: 'Newsletter Studio', icon: <EmailOutlinedIcon /> },
        { id: 'content-calendar', label: 'Content-kalender', icon: <CampaignOutlinedIcon /> },
      ],
    },
    {
      id: 'product-group',
      label: 'Produkt',
      items: [
        { id: 'role-room-agent', label: 'Role Room Agent', icon: <SmartToyOutlinedIcon /> },
        { id: 'operating-system', label: 'Operativsystem', icon: <HubOutlinedIcon /> },
        { id: 'migrations', label: 'Migrasjoner', icon: <StorageOutlinedIcon /> },
        { id: 'activity', label: 'Aktivitetslogg', icon: <HistoryOutlinedIcon /> },
      ],
    },
    {
      id: 'teamspaces',
      label: 'Teamspaces',
      items: [
        { id: 'ledelse', label: 'Ledelse', icon: <BusinessCenterOutlinedIcon /> },
        { id: 'markedsforing', label: 'Markedsføring', icon: <CampaignOutlinedIcon /> },
        { id: 'produkt', label: 'Produkt', icon: <ScienceOutlinedIcon /> },
        { id: 'hr', label: 'HR', icon: <PersonOutlineOutlinedIcon /> },
      ],
    },
  ];
}
