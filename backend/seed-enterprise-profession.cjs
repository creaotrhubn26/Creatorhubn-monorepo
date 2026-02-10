/**
 * Seed Enterprise profession data into the database
 * Persists the enterprise (combined photo+video team) profession across all related tables:
 *  - profession_types
 *  - profession_configurations
 *  - profession_dashboard_configs
 *  - profession_tabs
 *  - profession_project_types
 *  - profession_stats
 *
 * Also seeds a Norwedfilm team in enterprise_team_members
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({ connectionString: DATABASE_URL });

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // =========================================================================
    // 1. PROFESSION_TYPES — insert enterprise if not exists
    // =========================================================================
    const existingType = await client.query(
      "SELECT id FROM profession_types WHERE name = 'enterprise'"
    );

    if (existingType.rows.length === 0) {
      await client.query(`
        INSERT INTO profession_types (name, display_name, description, category, sort_order, is_active)
        VALUES (
          'enterprise',
          'Enterprise Team',
          'Combined photo & video team — full creative production house',
          'team',
          5,
          true
        )
      `);
      console.log('✅ profession_types: enterprise inserted');
    } else {
      console.log('⏭️  profession_types: enterprise already exists');
    }

    // =========================================================================
    // 2. PROFESSION_CONFIGURATIONS — insert enterprise config
    // =========================================================================
    const existingConfig = await client.query(
      "SELECT id FROM profession_configurations WHERE profession = 'enterprise'"
    );

    if (existingConfig.rows.length === 0) {
      await client.query(`
        INSERT INTO profession_configurations (profession, display_name, configuration, features, is_active)
        VALUES (
          'enterprise',
          'Enterprise Team',
          $1::jsonb,
          $2::jsonb,
          true
        )
      `, [
        JSON.stringify({
          color: '#6c3483',
          iconColor: '#6c3483',
          icon: 'Business',
          description: 'Team- og bedriftskonto som kombinerer foto og video',
          combinesProfessions: ['photographer', 'videographer'],
          teamEnabled: true,
          maxTeamMembers: 25,
          defaultProjectType: 'bryllup'
        }),
        JSON.stringify([
          'Team Management', 'Photo Suite', 'Video Suite', 'Showcase Galleri',
          'Analytics', 'Wedding Timeline', 'Contracts', 'AI Enhancement',
          'Video AI', 'Equipment Sharing', 'Academy', 'Community',
          'enterprise-team-management', 'enterprise-combined-projects',
          'enterprise-photo-suite', 'enterprise-video-suite',
          'enterprise-team-analytics', 'enterprise-team-portfolio',
          'enterprise-billing', 'enterprise-subscription',
          'enterprise-workload-balance', 'enterprise-equipment-sharing'
        ])
      ]);
      console.log('✅ profession_configurations: enterprise inserted');
    } else {
      console.log('⏭️  profession_configurations: enterprise already exists');
    }

    // =========================================================================
    // 3. PROFESSION_DASHBOARD_CONFIGS — insert dashboard layout
    // =========================================================================
    const existingDash = await client.query(
      "SELECT id FROM profession_dashboard_configs WHERE profession = 'enterprise'"
    );

    if (existingDash.rows.length === 0) {
      await client.query(`
        INSERT INTO profession_dashboard_configs (profession, layout_template, header_config, sidebar_config, grid_layout, custom_sections, is_active)
        VALUES (
          'enterprise',
          'expanded',
          $1::jsonb,
          $2::jsonb,
          $3::jsonb,
          $4::jsonb,
          true
        )
      `, [
        JSON.stringify({
          showSearch: true,
          showNotifications: true,
          showTeamSwitcher: true,
          showLogo: true,
          logoPath: '/norwed.png',
          brandColor: '#6c3483'
        }),
        JSON.stringify({
          collapsed: false,
          pinnedItems: ['overview', 'projects', 'team-management', 'wedding-timeline'],
          showTeamMembers: true,
          showQuickActions: true
        }),
        JSON.stringify({
          columns: 12,
          gap: 2,
          breakpoints: {
            xs: { columns: 1, gap: 1 },
            sm: { columns: 2, gap: 1.5 },
            md: { columns: 3, gap: 2 },
            lg: { columns: 4, gap: 2 }
          }
        }),
        JSON.stringify([
          { id: 'team-overview', label: 'Team Oversikt', position: 'top', size: 'full' },
          { id: 'combined-project-board', label: 'Prosjekttavle', position: 'main', size: 'large' },
          { id: 'team-calendar', label: 'Felles Kalender', position: 'sidebar', size: 'medium' },
          { id: 'team-activity', label: 'Teamaktivitet', position: 'bottom', size: 'full' }
        ])
      ]);
      console.log('✅ profession_dashboard_configs: enterprise inserted');
    } else {
      console.log('⏭️  profession_dashboard_configs: enterprise already exists');
    }

    // =========================================================================
    // 4. PROFESSION_TABS — insert all enterprise dashboard tabs
    // =========================================================================
    const existingTabs = await client.query(
      "SELECT tab_id FROM profession_tabs WHERE profession = 'enterprise'"
    );

    if (existingTabs.rows.length === 0) {
      const tabs = [
        { tabId: 'overview',          label: 'Team Oversikt',       icon: 'Assessment',        order: 0,  enabled: true, isDefault: true },
        { tabId: 'projects',          label: 'Prosjekter',          icon: 'Folder',            order: 1,  enabled: true, isDefault: false },
        { tabId: 'academy',           label: 'Academy',             icon: 'School',            order: 2,  enabled: true, isDefault: false },
        { tabId: 'wedding-timeline',  label: 'Bryllupstidslinje',   icon: 'Event',             order: 3,  enabled: true, isDefault: false },
        { tabId: 'showcase-admin',    label: 'Showcase Admin',      icon: 'Collections',       order: 4,  enabled: true, isDefault: false },
        { tabId: 'showcase-viewer',   label: 'Showcase Viewer',     icon: 'Visibility',        order: 5,  enabled: true, isDefault: false },
        { tabId: 'downloads',         label: 'Downloads',           icon: 'GetApp',            order: 6,  enabled: true, isDefault: false },
        { tabId: 'file-upload',       label: 'File Upload',         icon: 'CloudUpload',       order: 7,  enabled: true, isDefault: false },
        { tabId: 'ai-enhancement',    label: 'AI Forbedring',       icon: 'AutoFixHigh',       order: 8,  enabled: true, isDefault: false },
        { tabId: 'video-enhancement', label: 'Video AI',            icon: 'MovieCreation',     order: 9,  enabled: true, isDefault: false },
        { tabId: 'email-center',      label: 'E-post',              icon: 'Email',             order: 10, enabled: true, isDefault: false },
        { tabId: 'worklog',           label: 'Worklog',             icon: 'AccessTime',        order: 11, enabled: true, isDefault: false },
        { tabId: 'clients',           label: 'Kunder',              icon: 'Group',             order: 12, enabled: true, isDefault: false },
        { tabId: 'team-management',   label: 'Team',                icon: 'Group',             order: 13, enabled: true, isDefault: false },
        { tabId: 'equipment',         label: 'Utstyr',              icon: 'CameraAlt',         order: 14, enabled: true, isDefault: false },
        { tabId: 'files',             label: 'Filer',               icon: 'FolderOpen',        order: 15, enabled: true, isDefault: false },
        { tabId: 'support',           label: 'Support',             icon: 'HelpCenter',        order: 16, enabled: true, isDefault: false },
        { tabId: 'settings',          label: 'Innstillinger',       icon: 'Settings',          order: 17, enabled: true, isDefault: false },
        { tabId: 'administration',    label: 'Administrasjon',      icon: 'AdminPanelSettings',order: 18, enabled: true, isDefault: false },
        { tabId: 'communication',     label: 'Kommunikasjon',       icon: 'Chat',              order: 19, enabled: true, isDefault: false },
        { tabId: 'integration-test',  label: 'Integration Test',    icon: 'Build',             order: 20, enabled: true, isDefault: false },
      ];

      for (const tab of tabs) {
        await client.query(`
          INSERT INTO profession_tabs (profession, tab_id, label, icon, sort_order, is_enabled, is_default)
          VALUES ('enterprise', $1, $2, $3, $4, $5, $6)
        `, [tab.tabId, tab.label, tab.icon, tab.order, tab.enabled, tab.isDefault]);
      }
      console.log(`✅ profession_tabs: ${tabs.length} enterprise tabs inserted`);
    } else {
      console.log(`⏭️  profession_tabs: enterprise already has ${existingTabs.rows.length} tabs`);
    }

    // =========================================================================
    // 5. PROFESSION_PROJECT_TYPES — insert enterprise project types
    // =========================================================================
    const existingPT = await client.query(
      "SELECT type_id FROM profession_project_types WHERE profession = 'enterprise'"
    );

    if (existingPT.rows.length === 0) {
      const projectTypes = [
        { typeId: 'bryllup',     displayName: 'Bryllup (Foto+Video)', description: 'Komplett bryllupsdokumentasjon', icon: 'Favorite', color: '#e74c3c' },
        { typeId: 'corporate',   displayName: 'Bedriftsoppdrag',      description: 'Bedriftsfoto og -video',         icon: 'Business', color: '#2980b9' },
        { typeId: 'event',       displayName: 'Event',                 description: 'Eventfotografering og -filming', icon: 'Event',    color: '#27ae60' },
        { typeId: 'musikkvideo', displayName: 'Musikkvideo',           description: 'Musikkvideoproduksjon',          icon: 'MusicNote', color: '#8e44ad' },
        { typeId: 'portrett',    displayName: 'Portrett',              description: 'Portrettfoto og video',         icon: 'Person',   color: '#f39c12' },
        { typeId: 'reklame',     displayName: 'Reklame',               description: 'Reklamefilm og -foto',          icon: 'Campaign', color: '#e67e22' },
      ];

      for (const pt of projectTypes) {
        await client.query(`
          INSERT INTO profession_project_types (profession, type_id, display_name, description, icon, color, is_enabled, sort_order)
          VALUES ('enterprise', $1, $2, $3, $4, $5, true, $6)
        `, [pt.typeId, pt.displayName, pt.description, pt.icon, pt.color, projectTypes.indexOf(pt)]);
      }
      console.log(`✅ profession_project_types: ${projectTypes.length} enterprise types inserted`);
    } else {
      console.log(`⏭️  profession_project_types: enterprise already has ${existingPT.rows.length} types`);
    }

    // =========================================================================
    // 6. PROFESSION_STATS — insert enterprise dashboard stats
    // =========================================================================
    const existingStats = await client.query(
      "SELECT stat_id FROM profession_stats WHERE profession = 'enterprise'"
    );

    if (existingStats.rows.length === 0) {
      const stats = [
        { statId: 'projects',      displayName: 'Aktive Prosjekter', icon: 'Folder',       color: '#6c3483', dataSource: '/api/projects/count',       format: 'number' },
        { statId: 'team_members',  displayName: 'Teammedlemmer',     icon: 'Group',        color: '#2980b9', dataSource: '/api/team/members/count',   format: 'number' },
        { statId: 'revenue',       displayName: 'Månedens Inntekt',  icon: 'AttachMoney',  color: '#27ae60', dataSource: '/api/revenue/monthly',      format: 'currency' },
        { statId: 'bookings',      displayName: 'Bookinger',         icon: 'CalendarToday',color: '#e74c3c', dataSource: '/api/bookings/count',       format: 'number' },
      ];

      for (const stat of stats) {
        await client.query(`
          INSERT INTO profession_stats (profession, stat_id, display_name, icon, color, data_source, format, is_enabled, sort_order, trend_enabled)
          VALUES ('enterprise', $1, $2, $3, $4, $5, $6, true, $7, true)
        `, [stat.statId, stat.displayName, stat.icon, stat.color, stat.dataSource, stat.format, stats.indexOf(stat)]);
      }
      console.log(`✅ profession_stats: ${stats.length} enterprise stats inserted`);
    } else {
      console.log(`⏭️  profession_stats: enterprise already has ${existingStats.rows.length} stats`);
    }

    // =========================================================================
    // 7. ENTERPRISE_TEAM_MEMBERS — seed Norwedfilm team
    // =========================================================================
    const existingTeam = await client.query(
      "SELECT id FROM enterprise_team_members WHERE organization_id = 'norwedfilm'"
    );

    if (existingTeam.rows.length === 0) {
      const teamMembers = [
        { email: 'admin@norwedfilm.no',     role: 'admin',  status: 'active' },
        { email: 'fotograf@norwedfilm.no',   role: 'member', status: 'active' },
        { email: 'videograf@norwedfilm.no',  role: 'member', status: 'active' },
      ];

      for (const member of teamMembers) {
        await client.query(`
          INSERT INTO enterprise_team_members (organization_id, email, role, status, invited_at, joined_at)
          VALUES ('norwedfilm', $1, $2, $3, NOW(), NOW())
        `, [member.email, member.role, member.status]);
      }
      console.log(`✅ enterprise_team_members: ${teamMembers.length} Norwedfilm members seeded`);
    } else {
      console.log(`⏭️  enterprise_team_members: Norwedfilm team already has ${existingTeam.rows.length} members`);
    }

    // =========================================================================
    // Also ensure photographer, videographer, music_producer, vendor configs exist
    // =========================================================================
    const coreProfessions = [
      {
        profession: 'photographer',
        displayName: 'Fotograf',
        config: { color: '#ff8c00', iconColor: '#ff8c00', icon: 'PhotoCamera', description: 'Profesjonell fotograf' },
        features: ['Showcase Galleri', 'Klienthåndtering', 'Academy', 'Community', 'Wedding Timeline', 'Photo Enhancement']
      },
      {
        profession: 'videographer',
        displayName: 'Videograf',
        config: { color: '#e74c3c', iconColor: '#e74c3c', icon: 'Videocam', description: 'Profesjonell videograf' },
        features: ['StoryArc Studio', 'Smart Redigering', 'NLE-eksport', 'Academy', 'Video AI', 'Community']
      },
      {
        profession: 'music_producer',
        displayName: 'Musikkprodusent',
        config: { color: '#1976d2', iconColor: '#1976d2', icon: 'LibraryMusic', description: 'Profesjonell musikkprodusent' },
        features: ['Audio Suite', 'Mastering', 'Distribution', 'Academy', 'Split Sheets']
      },
      {
        profession: 'vendor',
        displayName: 'Leverandør',
        config: { color: '#27ae60', iconColor: '#27ae60', icon: 'Store', description: 'Leverandør av tjenester og produkter' },
        features: ['Produktkatalog', 'Lagerstyring', 'Ordrehåndtering']
      },
    ];

    for (const prof of coreProfessions) {
      const exists = await client.query(
        "SELECT id FROM profession_configurations WHERE profession = $1",
        [prof.profession]
      );
      if (exists.rows.length === 0) {
        await client.query(`
          INSERT INTO profession_configurations (profession, display_name, configuration, features, is_active)
          VALUES ($1, $2, $3::jsonb, $4::jsonb, true)
        `, [prof.profession, prof.displayName, JSON.stringify(prof.config), JSON.stringify(prof.features)]);
        console.log(`✅ profession_configurations: ${prof.profession} inserted`);
      }
    }

    await client.query('COMMIT');
    console.log('\n🎉 Enterprise profession seeding complete!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));
