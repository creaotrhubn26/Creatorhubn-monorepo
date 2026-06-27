// @ts-nocheck
/**
 * WorkspaceShell — dark CreatorHub-ramme for per-prosjekt Team Workspace.
 *
 * Venstre nav (HOVEDMENY + SMART ROM + KUNDEPORTAL) + prosjekt-header, eksakt
 * som Daniels design. Innholdet (aktivt tab) rendres i `children`. Hele
 * skallet pakkes i adminDarkTheme så alle MUI-flater arver dark-paletten.
 */

import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import {
  Box, Stack, Typography, Avatar, AvatarGroup, Chip, Button, IconButton, Badge, Tooltip,
} from '@mui/material';
import Dashboard from '@mui/icons-material/Dashboard';
import AccountTree from '@mui/icons-material/AccountTree';
import Map from '@mui/icons-material/Map';
import PhotoCameraBack from '@mui/icons-material/PhotoCameraBack';
import GridView from '@mui/icons-material/GridView';
import PermMedia from '@mui/icons-material/PermMedia';
import LocalShipping from '@mui/icons-material/LocalShipping';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import Group from '@mui/icons-material/Group';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import Videocam from '@mui/icons-material/Videocam';
import Movie from '@mui/icons-material/Movie';
import GraphicEq from '@mui/icons-material/GraphicEq';
import Visibility from '@mui/icons-material/Visibility';
import EventNote from '@mui/icons-material/EventNote';
import CalendarToday from '@mui/icons-material/CalendarToday';
import LocationOn from '@mui/icons-material/LocationOn';
import MoreVert from '@mui/icons-material/MoreVert';
import PersonAdd from '@mui/icons-material/PersonAdd';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import Settings from '@mui/icons-material/Settings';
import HexagonOutlined from '@mui/icons-material/HexagonOutlined';
import { ws, workspaceDarkTheme, WS_NAV } from './workspaceTheme';

const ICONS: Record<string, React.ElementType> = {
  Dashboard, AccountTree, Map, PhotoCameraBack, GridView, PermMedia, LocalShipping,
  CheckCircleOutline, Group, ChatBubbleOutline, PhotoCamera, Videocam, Movie, GraphicEq,
  Visibility, EventNote,
};

const GROUP_LABEL: Record<string, string> = {
  hoved: 'HOVEDMENY',
  rom: 'SMART ROM',
  klient: 'KUNDEPORTAL',
};

export interface WorkspaceProject {
  id: string;
  name: string;
  type?: string;        // f.eks. "Wedding" / "Bryllup – Foto & Video"
  status?: string;      // f.eks. "In Production" / "Pågående"
  date?: string;        // visningsklar dato
  location?: string;
  coverUrl?: string | null;
  members?: { id: string; name?: string; avatarUrl?: string | null }[];
  memberOverflow?: number; // "+3"
}

export interface WorkspaceUser {
  name: string;
  role?: string;
  avatarUrl?: string | null;
}

interface ShellProps {
  project: WorkspaceProject;
  user: WorkspaceUser;
  activeTab: string;
  onTab: (key: string) => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

function NavItem({ item, active, onClick }: any) {
  const Icon = ICONS[item.icon] || Dashboard;
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1, mx: 1,
        borderRadius: `${ws.radiusSm}px`, cursor: 'pointer', userSelect: 'none',
        color: active ? ws.text : ws.textDim,
        bgcolor: active ? ws.accentSoft : 'transparent',
        border: active ? `1px solid ${ws.accentBorder}` : '1px solid transparent',
        transition: 'background .12s, color .12s',
        '&:hover': { bgcolor: active ? ws.accentSoft : 'rgba(255,255,255,0.05)', color: ws.text },
      }}
    >
      <Icon sx={{ fontSize: 20, color: active ? ws.accent : 'inherit' }} />
      <Typography sx={{ fontSize: 14, fontWeight: active ? 700 : 500, flex: 1 }}>{item.label}</Typography>
      {item.online && (
        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ws.green }} />
      )}
      {item.badge ? (
        <Box sx={{
          minWidth: 20, height: 20, px: 0.5, borderRadius: '10px', bgcolor: ws.accent,
          color: ws.accentContrast, fontSize: 11, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{item.badge}</Box>
      ) : null}
    </Box>
  );
}

const WorkspaceShell: React.FC<ShellProps> = ({ project, user, activeTab, onTab, headerActions, children }) => {
  const groups: Array<'hoved' | 'rom' | 'klient'> = ['hoved', 'rom', 'klient'];

  return (
    <ThemeProvider theme={workspaceDarkTheme}>
      <Box sx={{ display: 'flex', height: '100vh', bgcolor: ws.bg, color: ws.text, overflow: 'hidden' }}>
        {/* ───────── Venstre nav ───────── */}
        <Box sx={{
          width: 260, flexShrink: 0, bgcolor: ws.bgSidebar, borderRight: `1px solid ${ws.border}`,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Logo */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 2 }}>
            <HexagonOutlined sx={{ color: ws.accent }} />
            <Typography sx={{ fontWeight: 800, letterSpacing: 1, fontSize: 15 }}>CREATORHUB</Typography>
          </Stack>

          {/* Prosjekt-kort */}
          <Box sx={{ mx: 1.5, mb: 1, p: 1, borderRadius: `${ws.radiusSm}px`, bgcolor: 'rgba(255,255,255,0.04)', border: `1px solid ${ws.borderSoft}` }}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Avatar variant="rounded" src={project.coverUrl || undefined} sx={{ width: 44, height: 44, borderRadius: 2 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 700 }}>{project.name}</Typography>
                <Typography noWrap sx={{ fontSize: 11.5, color: ws.textDim }}>{project.type}</Typography>
                <Typography noWrap sx={{ fontSize: 11, color: ws.textFaint }}>{project.date}{project.location ? ` · ${project.location}` : ''}</Typography>
              </Box>
            </Stack>
          </Box>

          {/* Nav-grupper */}
          <Box sx={{ flex: 1, overflowY: 'auto', py: 0.5 }}>
            {groups.map((g) => (
              <Box key={g} sx={{ mb: 1 }}>
                <Typography sx={{ px: 2.5, py: 0.75, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, color: ws.textFaint }}>
                  {GROUP_LABEL[g]}
                </Typography>
                {WS_NAV.filter((n) => n.group === g).map((item) => (
                  <NavItem key={item.key} item={item} active={activeTab === item.key} onClick={() => onTab(item.key)} />
                ))}
              </Box>
            ))}
          </Box>

          {/* Bruker-footer */}
          <Box sx={{ borderTop: `1px solid ${ws.border}`, px: 1.5, py: 1.25 }}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Avatar src={user.avatarUrl || undefined} sx={{ width: 34, height: 34 }}>{user.name?.[0]}</Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 13, fontWeight: 700 }}>{user.name}</Typography>
                <Typography noWrap sx={{ fontSize: 11.5, color: ws.textDim }}>{user.role}</Typography>
              </Box>
              <IconButton size="small" sx={{ color: ws.textDim }}><KeyboardArrowDown fontSize="small" /></IconButton>
              <IconButton size="small" sx={{ color: ws.textDim }}><Settings fontSize="small" /></IconButton>
            </Stack>
          </Box>
        </Box>

        {/* ───────── Innholdsområde ───────── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Prosjekt-header */}
          <Box sx={{
            px: 3, py: 2, borderBottom: `1px solid ${ws.border}`,
            display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
          }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 22, fontWeight: 800 }} noWrap>{project.name}</Typography>
              {project.status && (
                <Chip
                  size="small"
                  label={project.status}
                  sx={{ bgcolor: ws.accentSoft, color: ws.accent, border: `1px solid ${ws.accentBorder}`, fontWeight: 700 }}
                />
              )}
            </Stack>

            <Stack direction="row" alignItems="center" spacing={2} sx={{ color: ws.textDim }}>
              {project.date && (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <CalendarToday sx={{ fontSize: 15 }} /><Typography sx={{ fontSize: 13 }}>{project.date}</Typography>
                </Stack>
              )}
              {project.location && (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <LocationOn sx={{ fontSize: 16 }} /><Typography sx={{ fontSize: 13 }}>{project.location}</Typography>
                </Stack>
              )}
            </Stack>

            <Box sx={{ flex: 1 }} />

            <AvatarGroup max={5} sx={{ '& .MuiAvatar-root': { width: 30, height: 30, fontSize: 12, border: `2px solid ${ws.bg}` } }}>
              {(project.members || []).map((m) => (
                <Avatar key={m.id} src={m.avatarUrl || undefined}>{m.name?.[0]}</Avatar>
              ))}
            </AvatarGroup>

            <Stack direction="row" spacing={1} alignItems="center">
              {headerActions ?? (
                <>
                  <Button size="small" startIcon={<Visibility sx={{ fontSize: 16 }} />}
                    sx={{ color: ws.text, borderColor: ws.border, textTransform: 'none' }} variant="outlined">
                    Kundevisning
                  </Button>
                  <Button size="small" startIcon={<PersonAdd sx={{ fontSize: 16 }} />}
                    sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }} variant="contained">
                    Inviter medlem
                  </Button>
                  <IconButton size="small" sx={{ color: ws.textDim }}><MoreVert fontSize="small" /></IconButton>
                </>
              )}
            </Stack>
          </Box>

          {/* Aktivt tab */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
            {children}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default WorkspaceShell;
