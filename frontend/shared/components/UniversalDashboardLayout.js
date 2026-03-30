"use strict";
/**
 * Universal Dashboard Layout Component
 * Apple Liquid Glass Design System Implementation
 * Provides consistent layout structure across all professional dashboards
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlassInput = exports.GlassButton = exports.GlassCard = void 0;
exports.UniversalDashboardLayout = UniversalDashboardLayout;
var react_1 = require("react");
var framer_motion_1 = require("framer-motion");
var material_1 = require("@mui/material");
var button_1 = require("@/components/ui/button");
var badge_1 = require("@/components/ui/badge");
var lucide_react_1 = require("lucide-react");
var design_tokens_1 = require("../design-tokens");
var layoutTokens = {
    sidebarWidth: 280,
    sidebarCollapsedWidth: 84,
    headerHeight: 80,
    contentPadding: design_tokens_1.designTokens.spacing.desktop.md,
};
var glassStyles = {
    card: {
        background: design_tokens_1.designTokens.glass.background.light,
        backdropFilter: "blur(".concat(design_tokens_1.designTokens.glass.blur.medium, ")"),
        border: "1px solid ".concat(design_tokens_1.designTokens.glass.border.light),
        boxShadow: design_tokens_1.designTokens.shadows.glass.medium,
        borderRadius: 16,
    },
    cardHover: {
        background: design_tokens_1.designTokens.glass.background.medium,
        backdropFilter: "blur(".concat(design_tokens_1.designTokens.glass.blur.heavy, ")"),
        transform: 'scale(1.02)',
        transition: "all ".concat(design_tokens_1.designTokens.motion.duration.normal, " ").concat(design_tokens_1.designTokens.motion.spring),
    },
    button: {
        background: design_tokens_1.designTokens.glass.background.light,
        backdropFilter: "blur(".concat(design_tokens_1.designTokens.glass.blur.light, ")"),
        border: "1px solid ".concat(design_tokens_1.designTokens.glass.border.light),
        borderRadius: 12,
        transition: "all ".concat(design_tokens_1.designTokens.motion.duration.normal, " ").concat(design_tokens_1.designTokens.motion.spring),
    },
    buttonHover: {
        background: design_tokens_1.designTokens.glass.background.medium,
        backdropFilter: "blur(".concat(design_tokens_1.designTokens.glass.blur.medium, ")"),
        transform: 'scale(1.03)',
    },
    sidebar: {
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: "blur(".concat(design_tokens_1.designTokens.glass.blur.ultra, ")"),
        borderRight: "1px solid ".concat(design_tokens_1.designTokens.glass.border.medium),
    },
    header: {
        background: 'rgba(15, 23, 42, 0.58)',
        backdropFilter: "blur(".concat(design_tokens_1.designTokens.glass.blur.ultra, ")"),
        borderBottom: "1px solid ".concat(design_tokens_1.designTokens.glass.border.medium),
    },
};
var userTypeConfig = {
    photographer: {
        color: design_tokens_1.designTokens.userTypes.photographer.primary,
        border: design_tokens_1.designTokens.userTypes.photographer.border,
        label: 'Fotograf',
        icon: lucide_react_1.Camera,
        bgGradient: 'from-amber-500/20 to-orange-500/20',
    },
    videographer: {
        color: design_tokens_1.designTokens.userTypes.videographer.primary,
        border: design_tokens_1.designTokens.userTypes.videographer.border,
        label: 'Videograf',
        icon: lucide_react_1.Film,
        bgGradient: 'from-blue-500/20 to-cyan-500/20',
    },
    musicProducer: {
        color: design_tokens_1.designTokens.userTypes.musicProducer.primary,
        border: design_tokens_1.designTokens.userTypes.musicProducer.border,
        label: 'Musikkprodusent',
        icon: lucide_react_1.Music,
        bgGradient: 'from-violet-500/20 to-fuchsia-500/20',
    },
    admin: {
        color: design_tokens_1.designTokens.userTypes.admin.primary,
        border: design_tokens_1.designTokens.userTypes.admin.border,
        label: 'Administrator',
        icon: lucide_react_1.Settings,
        bgGradient: 'from-slate-500/20 to-zinc-500/20',
    },
};
var motionVariants = {
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
function UniversalDashboardLayout(_a) {
    var children = _a.children, userType = _a.userType, user = _a.user, activeTab = _a.activeTab, onTabChange = _a.onTabChange, _b = _a.tabs, tabs = _b === void 0 ? [] : _b, _c = _a.actions, actions = _c === void 0 ? [] : _c, _d = _a.notifications, notifications = _d === void 0 ? 0 : _d, _e = _a.className, className = _e === void 0 ? '' : _e;
    var _f = (0, react_1.useState)(true), sidebarOpen = _f[0], setSidebarOpen = _f[1];
    var _g = (0, react_1.useState)(false), searchOpen = _g[0], setSearchOpen = _g[1];
    var _h = (0, react_1.useState)(false), userMenuOpen = _h[0], setUserMenuOpen = _h[1];
    var config = userTypeConfig[userType];
    var IconComponent = config.icon;
    var userInitials = (0, react_1.useMemo)(function () {
        var _a;
        var name = (_a = user === null || user === void 0 ? void 0 : user.name) === null || _a === void 0 ? void 0 : _a.trim();
        if (!name)
            return 'U';
        return name
            .split(/\s+/)
            .slice(0, 2)
            .map(function (part) { var _a, _b; return (_b = (_a = part[0]) === null || _a === void 0 ? void 0 : _a.toUpperCase()) !== null && _b !== void 0 ? _b : ''; })
            .join('');
    }, [user === null || user === void 0 ? void 0 : user.name]);
    var headerLeftOffset = sidebarOpen
        ? layoutTokens.sidebarWidth
        : layoutTokens.sidebarCollapsedWidth;
    var mappedActionVariant = function (variant) {
        if (variant === 'secondary')
            return 'secondary';
        if (variant === 'primary')
            return 'default';
        return 'ghost';
    };
    var Sidebar = function () { return (<framer_motion_1.motion.aside className={"fixed left-0 top-0 z-40 h-full ".concat(sidebarOpen ? 'w-[280px]' : 'w-[84px]')} style={glassStyles.sidebar} variants={motionVariants.sidebar} animate={sidebarOpen ? 'open' : 'closed'}>
      <div className="flex h-full flex-col p-4">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{
            background: "linear-gradient(135deg, ".concat(config.color, "22, ").concat(config.color, "44)"),
            border: "1px solid ".concat(config.border),
            backdropFilter: "blur(".concat(design_tokens_1.designTokens.glass.blur.medium, ")"),
        }}>
              <IconComponent className="h-5 w-5" style={{ color: config.color }}/>
            </div>
            <framer_motion_1.AnimatePresence>
              {sidebarOpen ? (<framer_motion_1.motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="text-sm font-medium text-white">
                  CreatorHub Norge
                </framer_motion_1.motion.div>) : null}
            </framer_motion_1.AnimatePresence>
          </div>
          <button_1.Button variant="ghost" size="icon" onClick={function () { return setSidebarOpen(function (open) { return !open; }); }} className="text-white/70 hover:bg-white/10 hover:text-white">
            <lucide_react_1.Menu className="h-4 w-4"/>
          </button_1.Button>
        </div>

        <nav className="flex-1 space-y-2">
          {tabs.map(function (tab) {
            var TabIcon = tab.icon;
            var isActive = activeTab === tab.id;
            return (<framer_motion_1.motion.button key={tab.id} type="button" onClick={function () { return onTabChange === null || onTabChange === void 0 ? void 0 : onTabChange(tab.id); }} disabled={tab.disabled} className={"flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-all duration-200 ".concat(isActive
                    ? 'bg-white/20 text-white backdrop-blur-md'
                    : 'text-white/70 hover:bg-white/10 hover:text-white', " ").concat(tab.disabled ? 'cursor-not-allowed opacity-50' : '')} whileHover={{ scale: tab.disabled ? 1 : 1.02 }} whileTap={{ scale: tab.disabled ? 1 : 0.98 }}>
                <TabIcon className="h-5 w-5 shrink-0"/>
                <framer_motion_1.AnimatePresence>
                  {sidebarOpen ? (<framer_motion_1.motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="truncate text-sm font-medium">
                      {tab.label}
                    </framer_motion_1.motion.span>) : null}
                </framer_motion_1.AnimatePresence>
              </framer_motion_1.motion.button>);
        })}
        </nav>

        <div className="mt-auto">
          <framer_motion_1.motion.div className="flex items-center gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-md" whileHover={{ scale: 1.02 }}>
            <material_1.Avatar src={user === null || user === void 0 ? void 0 : user.avatar} alt={(user === null || user === void 0 ? void 0 : user.name) || 'Bruker'} sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 12 }}>
              {userInitials}
            </material_1.Avatar>
            <framer_motion_1.AnimatePresence>
              {sidebarOpen ? (<framer_motion_1.motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">
                    {(user === null || user === void 0 ? void 0 : user.name) || 'Bruker'}
                  </div>
                  <div className="truncate text-xs text-white/70">{config.label}</div>
                </framer_motion_1.motion.div>) : null}
            </framer_motion_1.AnimatePresence>
          </framer_motion_1.motion.div>
        </div>
      </div>
    </framer_motion_1.motion.aside>); };
    var Header = function () { return (<header className="fixed right-0 top-0 z-30 flex h-20 items-center justify-between px-6" style={__assign(__assign({}, glassStyles.header), { left: headerLeftOffset })}>
      <div className="flex items-center gap-4">
        <framer_motion_1.motion.div className="relative" initial={false} animate={searchOpen ? { width: 320 } : { width: 40 }}>
          <button_1.Button variant="ghost" size="icon" onClick={function () { return setSearchOpen(function (open) { return !open; }); }} className="absolute left-0 top-0 z-10 text-white/70 hover:bg-white/10 hover:text-white">
            {searchOpen ? <lucide_react_1.X className="h-4 w-4"/> : <lucide_react_1.Search className="h-4 w-4"/>}
          </button_1.Button>
          <framer_motion_1.AnimatePresence>
            {searchOpen ? (<framer_motion_1.motion.input initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} type="text" placeholder="Søk..." className="w-full rounded-xl border border-white/20 bg-white/10 py-2 pl-12 pr-4 text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-white/30"/>) : null}
          </framer_motion_1.AnimatePresence>
        </framer_motion_1.motion.div>
      </div>

      <div className="flex items-center gap-4">
        {actions.map(function (action) {
            var ActionIcon = action.icon;
            var variant = mappedActionVariant(action.variant);
            return (<framer_motion_1.motion.div key={action.label} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <button_1.Button variant={variant} size="sm" onClick={action.onClick} disabled={action.disabled} className={"h-10 border border-white/20 backdrop-blur-md ".concat(action.variant === 'primary'
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'text-white/70 hover:bg-white/10 hover:text-white')}>
                <ActionIcon className="mr-2 h-4 w-4"/>
                {action.label}
              </button_1.Button>
            </framer_motion_1.motion.div>);
        })}

        <framer_motion_1.motion.div className="relative" whileHover={{ scale: 1.05 }}>
          <button_1.Button variant="ghost" size="icon" className="text-white/70 hover:bg-white/10 hover:text-white">
            <lucide_react_1.Bell className="h-4 w-4"/>
          </button_1.Button>
          {notifications > 0 ? (<badge_1.Badge variant="destructive" className="absolute -right-1 -top-1 h-5 min-w-[20px] border-0 bg-red-500 px-1 text-[10px]">
              {notifications > 9 ? '9+' : notifications}
            </badge_1.Badge>) : null}
        </framer_motion_1.motion.div>

        <div className="relative">
          <button_1.Button variant="ghost" size="sm" onClick={function () { return setUserMenuOpen(function (open) { return !open; }); }} className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white hover:bg-white/15">
            <material_1.Avatar src={user === null || user === void 0 ? void 0 : user.avatar} alt={(user === null || user === void 0 ? void 0 : user.name) || 'Bruker'} sx={{ width: 28, height: 28, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 11 }}>
              {userInitials}
            </material_1.Avatar>
            <material_1.Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <material_1.Typography variant="body2" sx={{ color: '#fff', lineHeight: 1.1 }}>
                {(user === null || user === void 0 ? void 0 : user.name) || 'Bruker'}
              </material_1.Typography>
              <material_1.Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>
                {(user === null || user === void 0 ? void 0 : user.role) || config.label}
              </material_1.Typography>
            </material_1.Box>
            <lucide_react_1.ChevronDown className="h-4 w-4"/>
          </button_1.Button>

          <framer_motion_1.AnimatePresence>
            {userMenuOpen ? (<framer_motion_1.motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="absolute right-0 top-[calc(100%+12px)] w-60 rounded-2xl border border-white/20 bg-slate-900/85 p-3 shadow-2xl backdrop-blur-xl">
                <div className="mb-3 rounded-xl bg-white/5 p-3">
                  <div className="text-sm font-medium text-white">{(user === null || user === void 0 ? void 0 : user.name) || 'Bruker'}</div>
                  <div className="truncate text-xs text-white/70">{(user === null || user === void 0 ? void 0 : user.email) || 'Ingen e-post'}</div>
                </div>
                <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-white">
                  <lucide_react_1.User className="h-4 w-4"/>
                  Profil
                </button>
                <button type="button" className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-white">
                  <lucide_react_1.LogOut className="h-4 w-4"/>
                  Logg ut
                </button>
              </framer_motion_1.motion.div>) : null}
          </framer_motion_1.AnimatePresence>
        </div>
      </div>
    </header>); };
    return (<div className={"min-h-screen bg-gradient-to-br ".concat(config.bgGradient, " ").concat(className)}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent)]"/>
      <Sidebar />
      <Header />

      <main className="pt-20 transition-all duration-300" style={{
            marginLeft: headerLeftOffset,
            padding: layoutTokens.contentPadding,
        }}>
        <framer_motion_1.AnimatePresence mode="wait">
          <framer_motion_1.motion.div key={activeTab} variants={motionVariants.content} initial="exit" animate="enter" exit="exit" className="space-y-6">
            {children}
          </framer_motion_1.motion.div>
        </framer_motion_1.AnimatePresence>
      </main>
    </div>);
}
var GlassCard = function (_a) {
    var children = _a.children, _b = _a.className, className = _b === void 0 ? '' : _b, style = _a.style, props = __rest(_a, ["children", "className", "style"]);
    return (<framer_motion_1.motion.div className={"rounded-2xl p-6 ".concat(className)} style={__assign(__assign({}, glassStyles.card), style)} variants={motionVariants.card} whileHover="hover" {...props}>
    {children}
  </framer_motion_1.motion.div>);
};
exports.GlassCard = GlassCard;
var GlassButton = function (_a) {
    var children = _a.children, _b = _a.className, className = _b === void 0 ? '' : _b, style = _a.style, props = __rest(_a, ["children", "className", "style"]);
    return (<framer_motion_1.motion.button className={"rounded-xl px-4 py-2 font-medium text-white ".concat(className)} style={__assign(__assign({}, glassStyles.button), style)} whileHover={glassStyles.buttonHover} whileTap={{ scale: 0.96 }} {...props}>
    {children}
  </framer_motion_1.motion.button>);
};
exports.GlassButton = GlassButton;
var GlassInput = function (_a) {
    var _b = _a.className, className = _b === void 0 ? '' : _b, props = __rest(_a, ["className"]);
    return (<input className={"rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-white/30 ".concat(className)} {...props}/>);
};
exports.GlassInput = GlassInput;
exports.default = UniversalDashboardLayout;
