/**
 * Universal Dashboard Layout Component
 * Apple Liquid Glass Design System Implementation
 * Provides consistent layout structure across all professional dashboards
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Menu,
  X,
  Settings,
  Bell,
  Search,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  Home,
  Camera,
  Film,
  Music,
} from 'lucide-react';
import { designTokens } from '../design-tokens';

// ============ TYPES ============

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

// ============ GLASS STYLES ============

const glassStyles = {
  card: {
    background: designTokens.glass.backgrounds.light,
    backdropFilter: designTokens.glass.blur.medium,
    border: designTokens.glass.borders.light,
    boxShadow: designTokens.glass.shadows.medium,
    borderRadius: '16px',
  },
  cardHover: {
    background: designTokens.glass.backgrounds.medium,
    backdropFilter: designTokens.glass.blur.heavy,
    transform: designTokens.motion.scale.subtle,
    transition: `all ${designTokens.motion.duration.medium} ${designTokens.motion.easing.spring}`,
  },
  button: {
    background: designTokens.glass.backgrounds.light,
    backdropFilter: designTokens.glass.blur.light,
    border: designTokens.glass.borders.light,
    borderRadius: '12px',
    transition: `all ${designTokens.motion.duration.medium} ${designTokens.motion.easing.spring}`,
  },
  buttonHover: {
    background: designTokens.glass.backgrounds.medium,
    backdropFilter: designTokens.glass.blur.medium,
    transform: designTokens.motion.scale.medium,
  },
  sidebar: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(40px)',
    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
  },
  header: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(40px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
};

// ============ USER TYPE CONFIGURATIONS ============

const userTypeConfig = {
  photographer: {
    color: designTokens.color.dashboard.photographer,
    label: 'Fotograf',
    icon: Camera,
    bgGradient: 'from-amber-500/20 to-orange-500/20',
  },
  videographer: {
    color: designTokens.color.dashboard.videographer,
    label: 'Videograf',
    icon: Film,
    bgGradient: 'from-blue-500/20 to-cyan-500/20',
  },
  musicProducer: {
    color: designTokens.color.dashboard.musicProducer,
    label: 'Musikkprodusent',
    icon: Music,
    bgGradient: 'from-purple-500/20 to-pink-500/20',
  },
  admin: {
    color: designTokens.color.dashboard.admin,
    label: 'Administrator',
    icon: Settings,
    bgGradient: 'from-green-500/20 to-teal-500/20',
  },
};

// ============ MOTION VARIANTS ============

const motionVariants = {
  sidebar: {
    open: {
      width: designTokens.layout.dashboard.sidebar.width,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 40,
      },
    },
    closed: {
      width: designTokens.layout.dashboard.sidebar.collapsedWidth,
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
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
    exit: {
      opacity: 0,
      x: -20,
      transition: {
        duration: 0.2,
      },
    },
  },
  card: {
    hover: {
      scale: 1.02,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 10,
      },
    },
  },
};

// ============ MAIN COMPONENT ============

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

  // ============ SIDEBAR COMPONENT ============

  const Sidebar = () => (
    <motion.div
      className={`fixed left-0 top-0 h-full z-40 ${sidebarOpen ? 'w-70' : 'w-20'}`}
      style={glassStyles.sidebar}
      variants={motionVariants.sidebar}
      animate={sidebarOpen ? 'open' : 'closed'}
    >
      <div className="flex flex-col h-full p-4">
        {/* Logo Section */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${config.color}20, ${config.color}40)`,
                backdropFilter: 'blur(20px)',
                border: `1px solid ${config.color}30`,
              }}
            >
              <IconComponent className="w-5 h-5" style={{ color: config.color }} />
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="text-sm font-medium text-white"
                >
                  CreatorHub Norge
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 p-0 text-white/70 hover:text-white hover:bg-white/10"
          >
            <Menu className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex-1 space-y-2">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <motion.button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                disabled={tab.disabled}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-white/20 text-white backdrop-blur-md'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                whileHover={{ scale: tab.disabled ? 1 : 1.02 }}
                whileTap={{ scale: tab.disabled ? 1 : 0.98 }}
              >
                <TabIcon className="w-5 h-5" />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="text-sm font-medium"
                    >
                      {tab.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>

        {/* User Profile */}
        <div className="mt-auto">
          <motion.div
            className="flex items-center space-x-3 p-3 rounded-xl bg-white/10 backdrop-blur-md"
            whileHover={{ scale: 1.02 }}
          >
            <Avatar className="w-8 h-8">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-white/20 text-white text-xs">
                {user?.name?.slice(0, 2).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex-1 min-w-0"
                >
                  <div className="text-sm font-medium text-white truncate">
                    {user?.name || 'Bruker'}
                  </div>
                  <div className="text-xs text-white/70 truncate">{config.label}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );

  // ============ HEADER COMPONENT ============

  const Header = () => (
    <div
      className="fixed top-0 right-0 h-20 flex items-center justify-between px-6 z-30"
      style={{
        ...glassStyles.header,
        left: sidebarOpen
          ? designTokens.layout.dashboard.sidebar.width
          : designTokens.layout.dashboard.sidebar.collapsedWidth,
      }}
    >
      {/* Search Section */}
      <div className="flex items-center space-x-4">
        <motion.div
          className="relative"
          initial={false}
          animate={searchOpen ? { width: '320px' } : { width: '40px' }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchOpen(!searchOpen)}
            className="absolute left-0 top-0 w-10 h-10 p-0 text-white/70 hover:text-white hover:bg-white/10"
          >
            <Search className="w-4 h-4" />
          </Button>
          <AnimatePresence>
            {searchOpen && (
              <motion.input
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                type="text"
                placeholder="Søk..."
                className="w-full pl-12 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Actions Section */}
      <div className="flex items-center space-x-4">
        {/* Action Buttons */}
        {actions.map((action, index) => {
          const ActionIcon = action.icon;
          return (
            <motion.div key={index} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant={action.variant || 'ghost'}
                size="sm"
                onClick={action.onClick}
                disabled={action.disabled}
                className={`h-10 px-4 ${
                  action.variant === 'primary'
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                } backdrop-blur-md border border-white/20`}
              >
                <ActionIcon className="w-4 h-4 mr-2" />
                {action.label}
              </Button>
            </motion.div>
          );
        })}

        {/* Notifications */}
        <motion.div className="relative" whileHover={{ scale: 1.05 }}>
          <Button
            variant="ghost"
            size="sm"
            className="w-10 h-10 p-0 text-white/70 hover:text-white hover:bg-white/10"
          >
            <Bell className="w-4 h-4" />
          </Button>
          {notifications > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 w-5 h-5 p-0 text-xs bg-red-500 border-0"
            >
              {notifications > 9 ? '9+' : notifications}
            </Badge>
          )}
        </motion.div>
      </div>
    </div>
  );

  // ============ MAIN RENDER ============

  return (
    <div className={`min-h-screen bg-gradient-to-br ${config.bgGradient} ${className}`}>
      {/* Background Pattern */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent)] pointer-events-none" />

      {/* Sidebar */}
      <Sidebar />

      {/* Header */}
      <Header />

      {/* Main Content */}
      <main
        className="pt-20 transition-all duration-300"
        style={{
          marginLeft: sidebarOpen
            ? designTokens.layout.dashboard.sidebar.width
            : designTokens.layout.dashboard.sidebar.collapsedWidth,
          padding: designTokens.layout.dashboard.content.padding,
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

// ============ EXPORT GLASS COMPONENTS ============

export const GlassCard = ({ children, className = '', ...props }: any) => (
  <motion.div
    className={`rounded-2xl p-6 ${className}`}
    style={glassStyles.card}
    whileHover={glassStyles.cardHover}
    variants={motionVariants.card}
    {...props}
  >
    {children}
  </motion.div>
);

export const GlassButton = ({ children, className = '', ...props }: any) => (
  <motion.button
    className={`px-4 py-2 rounded-xl font-medium text-white ${className}`}
    style={glassStyles.button}
    whileHover={glassStyles.buttonHover}
    whileTap={{ scale: 0.95 }}
    {...props}
  >
    {children}
  </motion.button>
);

export const GlassInput = ({ className = '', ...props }: any) => (
  <input
    className={`px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 ${className}`}
    {...props}
  />
);

export default UniversalDashboardLayout;
