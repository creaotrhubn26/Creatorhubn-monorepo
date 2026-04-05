import GoogleAnalyticsDashboardEnhanced from './GoogleAnalyticsDashboardEnhanced';

interface GoogleAnalyticsDashboardProps {
  hideHeader?: boolean;
}

export default function GoogleAnalyticsDashboard({
  hideHeader = false,
}: GoogleAnalyticsDashboardProps) {
  return <GoogleAnalyticsDashboardEnhanced hideHeader={hideHeader} />;
}
