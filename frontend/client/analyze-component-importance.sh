#!/bin/bash

echo "🔍 ANALYZING COMPONENT IMPORTANCE - CRITICAL vs NON-CRITICAL"
echo "============================================================"

# Function to check if a file has TypeScript errors
has_errors() {
    local file="$1"
    npm run check 2>&1 | grep -q "$file"
}

# Function to get error count for a file
get_error_count() {
    local file="$1"
    npm run check 2>&1 | grep "$file" | wc -l
}

echo ""
echo "📊 CRITICAL COMPONENTS (High Priority - Fix These First):"
echo "========================================================="

# Check critical files
critical_files=(
    "src/App.tsx"
    "src/components/universal/UniversalDashboard.tsx"
    "src/components/admin/AdminDashboard.tsx"
    "src/components/CompleteDeploymentManager.tsx"
    "src/components/universal/UniversalShowcase.tsx"
    "src/components/universal/UniversalOnboarding.tsx"
    "src/components/universal/UniversalFileUpload.tsx"
    "src/components/universal/UniversalDownload.tsx"
    "src/components/vendor/UniversalVendorDashboard.tsx"
    "src/components/worklog/UniversalWorklog.tsx"
    "src/components/chat/UniversalChatWidget.tsx"
    "src/components/settings/UniversalSettings.tsx"
    "src/components/project/ProjectCreationWithMemoryCards.tsx"
    "src/components/meet/GoogleMeetIntegration.tsx"
    "src/components/chat/FullscreenChatWidget.tsx"
    "src/components/admin/CreatorHubNotes.tsx"
    "src/components/email/EmailComposer.tsx"
    "src/components/admin/IntegrationsManagementPanel.tsx"
)

for file in "${critical_files[@]}"; do
    if [ -f "$file" ]; then
        error_count=$(get_error_count "$file")
        if [ "$error_count" -gt 0 ]; then
            echo "🔴 $file - $error_count errors - CRITICAL"
        else
            echo "🟢 $file - No errors - GOOD"
        fi
    else
        echo "❌ $file - File not found"
    fi
done

echo ""
echo "📊 MEDIUM PRIORITY COMPONENTS (Fix After Critical):"
echo "=================================================="

# Check medium priority files
medium_files=(
    "src/components/admin/AdminEmailCenter.tsx"
    "src/components/admin/AdminStats.tsx"
    "src/components/admin/APIEndpointMonitor.tsx"
    "src/components/admin/AutomationsPanel.tsx"
    "src/components/admin/UserManagementPanel.tsx"
    "src/components/email/ComprehensiveEmailCenter.tsx"
    "src/components/email/IntegratedEmailCenter.tsx"
    "src/components/enterprise/EnterpriseDashboard.tsx"
    "src/components/meet/SmartMeetingPreparation.tsx"
    "src/components/meetings/GoogleWorkspaceMeetingManager.tsx"
)

for file in "${medium_files[@]}"; do
    if [ -f "$file" ]; then
        error_count=$(get_error_count "$file")
        if [ "$error_count" -gt 0 ]; then
            echo "🟡 $file - $error_count errors - MEDIUM"
        else
            echo "🟢 $file - No errors - GOOD"
        fi
    else
        echo "❌ $file - File not found"
    fi
done

echo ""
echo "📊 LOW PRIORITY COMPONENTS (Fix Last or Consider Removing):"
echo "=========================================================="

# Check low priority files
low_files=(
    "src/components/MusicProducerDashboardWithIntegration.tsx"
    "src/components/MusicProducerUltimateIntegration.tsx"
    "src/components/partner-dashboard-with-customization.tsx"
    "src/components/performance-monitoring-mobile-interface.tsx"
    "src/components/photographer-functional-onboarding.tsx"
    "src/components/PhotographerDashboardWithIntegration.tsx"
    "src/components/plugins/PluginDetectionInterface.tsx"
    "src/components/vendor/VendorTypeManager.tsx"
    "src/components/vendor/image-upload.tsx"
    "src/components/vendor/VendorDashboard.tsx"
    "src/components/vendor/content-collaboration.tsx"
    "src/components/vendor/CreatorHubNorgeBadge.tsx"
    "src/components/vendor/VendorProductManager.tsx"
    "src/components/vendor/BlekkFilmVendorShowcase.tsx"
    "src/components/vendor/VendorShowcase.tsx"
    "src/components/vendor/UniversalVendorOnboarding.tsx"
    "src/components/vendor/PrintVendorDashboard.tsx"
    "src/components/vendor/journey-progress-widget.tsx"
    "src/components/vendor/SleekVendorDashboard.tsx"
    "src/components/vendor/NorthtoneVendorShowcase.tsx"
    "src/components/vendor/quote-manager.tsx"
    "src/components/vendor/portfolio-manager.tsx"
    "src/components/vendor/journey-dashboard.tsx"
    "src/components/vendor/profile-wizard.tsx"
    "src/components/vendor/qr-code-generator.tsx"
    "src/components/vendor/vendor-portfolio.tsx"
    "src/components/vendor/PowerfulVendorShowcase.tsx"
    "src/components/vendor/brreg-auto-populate.tsx"
    "src/components/vendor/NorthtoneVendorDashboard.tsx"
)

for file in "${low_files[@]}"; do
    if [ -f "$file" ]; then
        error_count=$(get_error_count "$file")
        if [ "$error_count" -gt 0 ]; then
            echo "🔵 $file - $error_count errors - LOW PRIORITY"
        else
            echo "🟢 $file - No errors - GOOD"
        fi
    else
        echo "❌ $file - File not found"
    fi
done

echo ""
echo "📊 SUMMARY:"
echo "==========="
total_errors=$(npm run check 2>&1 | grep "error TS" | wc -l)
echo "Total TypeScript errors: $total_errors"

critical_errors=0
for file in "${critical_files[@]}"; do
    if [ -f "$file" ]; then
        error_count=$(get_error_count "$file")
        critical_errors=$((critical_errors + error_count))
    fi
done

echo "Critical component errors: $critical_errors"
echo "Non-critical component errors: $((total_errors - critical_errors))"

echo ""
echo "🎯 RECOMMENDATION:"
echo "=================="
echo "1. Fix CRITICAL components first (red/yellow above)"
echo "2. Fix MEDIUM priority components second"
echo "3. Consider removing or fixing LOW priority components last"
echo "4. Focus on components that are actually used in your application"

