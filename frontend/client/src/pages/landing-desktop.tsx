import React from 'react';
import { withVisualEditor } from '@/components/admin/visual-editor/withVisualEditor';
import CreatorHubInvestorLanding from '@/components/landing/CreatorHubInvestorLanding';

const LandingDesktop: React.FC = () => <CreatorHubInvestorLanding mode="desktop" />;

export default withVisualEditor(LandingDesktop, {
  componentId: 'landing-desktop',
  componentName: 'Landing Desktop',
  category: 'landing',
  editable: true,
  previewable: true,
  templateable: true,
  propsEditable: true,
});
