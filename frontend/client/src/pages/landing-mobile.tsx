import React from 'react';
import { withVisualEditor } from '@/components/admin/visual-editor/withVisualEditor';
import CreatorHubInvestorLanding from '@/components/landing/CreatorHubInvestorLanding';

const LandingMobile: React.FC = () => <CreatorHubInvestorLanding mode="mobile" />;

export default withVisualEditor(LandingMobile, {
  componentId: 'landing-mobile',
  componentName: 'Landing Mobile',
  category: 'landing',
  editable: true,
  previewable: true,
  templateable: true,
  propsEditable: true,
});
