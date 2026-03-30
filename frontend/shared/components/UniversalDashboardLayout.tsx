/**
 * Universal Dashboard Layout Component
 * Apple Liquid Glass Design System Implementation
 * Provides consistent layout structure across all professional dashboards
 */

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { Avatar, Box, Typography } from '@mui/material';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Camera,
  ChevronDown,
  Film,
  LogOut,
  Menu,
  Music,
  Search,
  Settings,
  User,
  X,
} from 'lucide-react';
import { designTokens } from '../design-tokens';

export interface UniversalDashboardLayoutProps {
  children: React.ReactNode;
  userType: 'photographer' | 'videographer' | 'musicProducer' | 'admin';
  user?: {
    name: string;
    email: string;
    avatar?: string;
    role: string;
  };
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  tabs?: Array<{
    id: string;
    label: string;
    icon: React.ElementType;
    content?: React.ReactNode;
    disabled?: boolean;
  }>;
  actions?: Array<{
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    variant?: 'default' | 'primary' | 'secondary';
    disabled?: boolean;
  }>;
  notifications?: number;
  className?: string;
}

type LayoutActionVariant = 'default' | 'secondary' | 'ghost';

const layoutTokens = {
  sidebarWidth: 280,
  sidebarCollapsedWidth: 84,
  headerHeight: 80,
  contentPadding: designTokens.spacing.desktop.md,
};

const glassStyles = {
  card: {
    background: designTokens.glass.background.light,
    backdropFilter: `blur(${designTokens.glass.blur.medium})`,
    border: `1px solid ${designTokens.glass.border.light}`,
    boxShadow: designTokens.shadows.glass.medium,
    borderRadius: 16,
  },
  cardHover: {
    background: designTokens.glass.background.medium,
    backdropFilter: `blur(${designTokens.glass.blur.heavy})`,
    transform: 'scale(1.02)',
    transition: `all ${designTokens.motion.duration.normal} ${designTokens.motion.spring}`,
  },
  button: {
    background: designTokens.glass.background.light,
    backdropFilter: `blur(${designTokens.glass.blur.light})`,
    border: `1px solid ${designTokens.glass.border.light}`,
    borderRadius: 12,
    transition: `all ${designTokens.motion.duration.normal} ${designTokens.motion.spring}`,
  },
  buttonHover: {
    background: designTokens.glass.background.medium,
    backdropFilter: `blur(${designTokens.glass.blur.medium})`,
    transform: 'scale(1.03)',
  },
  sidebar: {
    background: 'rgba(15, 23, 42, 0.72)',
    backdropFilter: `blur(${designTokens.glass.blur.ultra})`,
    borderRight: `1px solid ${designTokens.glass.border.medium}`,
  },
  header: {
    background: 'rgba(15, 23, 42, 0.58)',
    backdropFilter: `blur(${designTokens.glass.blur.ultra})`,
    borderBottom: `1px solid ${designTokens.glass.border.medium}`,
  },
};

const userTypeConfig = {
  photographer: {
    color: designTokens.userTypes.photographer.primary,
    border: designTokens.userTypes.photographer.border,
    label: 'Fotograf',
    icon: Camera,
    bgGradient: 'from-amber-500/20 to-orange-500/20',
  },
  videographer: {
    color: designTokens.userTypes.videographer.primary,
    border: designTokens.userTypes.videographer.border,
    label: 'Videograf',
    icon: Film,
    bgGradient: 'from-blue-500/20 to-cyan-500/20',
  },
  musicProducer: {
    color: designTokens.userTypes.musicProducer.primary,
    border: designTokens.userTypes.musicProducer.border,
    label: 'Musikkprodusent',
    icon: Music,
    bgGradient: 'from-violet-500/20 to-fuchsia-500/20',
  },
  admin: {
    color: designTokens.userTypes.admin.primary,
    border: designTokens.userTypes.admin.border,
    label: 'Administrator',
    icon: Settings,
    bgGradient: 'from-slate-500/20 to-zinc-500/20',
  },
} as const;

const motionVariants: {
  sidebar: Variants;
  content: Variants;
  card: Variants;
} = {
  sidebar: {
    open: {
      width: layoutTokens.sidebarWidth,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 40,
      },
    },
    closed: {
      width: layoutTokens.sidebarCollapsedWidth,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 40,
      },
    },
  },
  content: {
    enter: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3,
        ease: 'easeOut',
      },
    },
    exit: {
      opacity: 0,
      x: -20,
      transition: {
        duration: 0.2,
        ease: 'easeIn',
      },
    },
  },
  card: {
    hover: {
      scale: 1.02,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 14,
      },
    },
  },
};

export function UniversalDashboardLayout({
  children,
  userType,
  user,
  activeTab,
  onTabChange,
  tabs = [],
  actions = [],
  notifications = 0,
  className = '',
}: UniversalDashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const config = userTypeConfig[userType];
  const IconComponent = config.icon;

  const userInitials = useMemo(() => {
    const name = user?.name?.trim();
    if (!name) return 'U';
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }, [user?.name]);

  const headerLeftOffset = sidebarOpen
    ? layoutTokens.sidebarWidth
    : layoutTokens.sidebarCollapsedWidth;

  const mappedActionVariant = (variant?: 'default' | 'primary' | 'secondary'): LayoutActionVariant => {
    if (variant === 'secondary') return 'secondary';
    if (variant === 'primary') return 'default';
    return 'ghost';
  };

  const Sidebar = () => (
    <motion.aside
      className={`fixed left-0 top-0 z-40 h-full ${sidebarOpen ? 'w-[280px]' : 'w-[84px]'}`}
      style={glassStyles.sidebar}
      variants={motionVariants.sidebar}
      animate={sidebarOpen ? 'open' : 'closed'}
    >
      <div className="flex h-full flex-col p-4">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${config.color}22, ${config.color}44)`,
                border: `1px solid ${config.border}`,
                backdropFilter: `blur(${designTokens.glass.blur.medium})`,
              }}
            >
              <IconComponent className="h-5 w-5" style={{ color: config.color }} />
            </div>
            <AnimatePresence>
              {sidebarOpen ? (
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="text-sm font-medium text-white"
                >
                  CreatorHub Norge
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen((open) => !open)}
            className="text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-2">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <motion.button
                key={tab.id}
                type="button"
                onClick={() => onTabChange?.(tab.id)}
                disabled={tab.disabled}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-all duration-200 ${
                  isActive
                    ? 'bg-white/20 text-white backdrop-blur-md'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                } ${tab.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                whileHover={{ scale: tab.disabled ? 1 : 1.02 }}
                whileTap={{ scale: tab.disabled ? 1 : 0.98 }}
              >
                <TabIcon className="h-5 w-5 shrink-0" />
                <AnimatePresence>
                  {sidebarOpen ? (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="truncate text-sm font-medium"
                    >
                      {tab.label}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </nav>

        <div className="mt-auto">
          <motion.div
            className="flex items-center gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-md"
            whileHover={{ scale: 1.02 }}
          >
            <Avatar
              src={user?.avatar}
              alt={user?.name || 'Bruker'}
              sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 12 }}
            >
              {userInitials}
            </Avatar>
            <AnimatePresence>
              {sidebarOpen ? (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="min-w-0 flex-1"
                >
                  <div className="truncate text-sm font-medium text-white">
                    {user?.name || 'Bruker'}
                  </div>
                  <div className="truncate text-xs text-white/70">{config.label}</div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </motion.aside>
  );

  const Header = () => (
    <header
      className="fixed right-0 top-0 z-30 flex h-20 items-center justify-between px-6"
      style={{
        ...glassStyles.header,
        left: headerLeftOffset,
      }}
    >
      <div className="flex items-center gap-4">
        <motion.div className="relative" initial={false} animate={searchOpen ? { width: 320 } : { width: 40 }}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen((open) => !open)}
            className="absolute left-0 top-0 z-10 text-white/70 hover:bg-white/10 hover:text-white"
          >
            {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </Button>
          <AnimatePresence>
            {searchOpen ? (
              <motion.input
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                type="text"
                placeholder="Søk..."
                className="w-full rounded-xl border border-white/20 bg-white/10 py-2 pl-12 pr-4 text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-white/30"
              />
            ) : null}
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="flex items-center gap-4">
        {actions.map((action) => {
          const ActionIcon = action.icon;
          const variant = mappedActionVariant(action.variant);
          return (
            <motion.div key={action.label} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant={variant}
                size="sm"
                onClick={action.onClick}
                disabled={action.disabled}
                className={`h-10 border border-white/20 backdrop-blur-md ${
                  action.variant === 'primary'
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <ActionIcon className="mr-2 h-4 w-4" />
                {action.label}
              </Button>
            </motion.div>
          );
        })}

        <motion.div className="relative" whileHover={{ scale: 1.05 }}>
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Bell className="h-4 w-4" />
          </Button>
          {notifications > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 min-w-[20px] border-0 bg-red-500 px-1 text-[10px]"
            >
              {notifications > 9 ? '9+' : notifications}
            </Badge>
          ) : null}
        </motion.div>

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUserMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white hover:bg-white/15"
          >
            <Avatar
              src={user?.avatar}
              alt={user?.name || 'Bruker'}
              sx={{ width: 28, height: 28, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 11 }}
            >
              {userInitials}
            </Avatar>
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <Typography variant="body2" sx={{ color: '#fff', lineHeight: 1.1 }}>
                {user?.name || 'Bruker'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>
                {user?.role || config.label}
              </Typography>
            </Box>
            <ChevronDown className="h-4 w-4" />
          </Button>

          <AnimatePresence>
            {userMenuOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="absolute right-0 top-[calc(100%+12px)] w-60 rounded-2xl border border-white/20 bg-slate-900/85 p-3 shadow-2xl backdrop-blur-xl"
              >
                <div className="mb-3 rounded-xl bg-white/5 p-3">
                  <div className="text-sm font-medium text-white">{user?.name || 'Bruker'}</div>
                  <div className="truncate text-xs text-white/70">{user?.email || 'Ingen e-post'}</div>
                </div>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <User className="h-4 w-4" />
                  Profil
                </button>
                <button
                  type="button"
                  className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  Logg ut
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );

  return (
    <div className={`min-h-screen bg-gradient-to-br ${config.bgGradient} ${className}`}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent)]" />
      <Sidebar />
      <Header />

      <main
        className="pt-20 transition-all duration-300"
        style={{
          marginLeft: headerLeftOffset,
          padding: layoutTokens.contentPadding,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={motionVariants.content}
            initial="exit"
            animate="enter"
            exit="exit"
            className="space-y-6"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
}

export const GlassCard = ({ children, className = '', style, ...props }: GlassCardProps) => (
  <motion.div
    className={`rounded-2xl p-6 ${className}`}
    style={{ ...glassStyles.card, ...style }}
    variants={motionVariants.card}
    whileHover="hover"
    {...props}
  >
    {children}
  </motion.div>
);

export interface GlassButtonProps extends HTMLMotionProps<'button'> {
  children: React.ReactNode;
}

export const GlassButton = ({ children, className = '', style, ...props }: GlassButtonProps) => (
  <motion.button
    className={`rounded-xl px-4 py-2 font-medium text-white ${className}`}
    style={{ ...glassStyles.button, ...style }}
    whileHover={glassStyles.buttonHover}
    whileTap={{ scale: 0.96 }}
    {...props}
  >
    {children}
  </motion.button>
);

export type GlassInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const GlassInput = ({ className = '', ...props }: GlassInputProps) => (
  <input
    className={`rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-white/30 ${className}`}
    {...props}
  />
);

export default UniversalDashboardLayout;
