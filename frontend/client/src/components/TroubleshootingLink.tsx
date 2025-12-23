import { useTheming } from '../utils/theming-helper';
import React from 'react';
import { Button } from "@/components/material-ui"
import { Link } from 'wouter';
import { SettingsOutlined, TrendingUp } from "@mui/icons-material";

export function TroubleshootingLink() {
  // Theming system
  const theming = useTheming('photographer');
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Link href="/troubleshooting">
        <Button 
          variant="outline" 
          size="sm" 
          className="bg-gradient-to-br from-white/95 via-amber-50/20 to-white/95  backdrop-blur-lg hover: bg-gradient-to-br from-white/95 via-amber-50/20 to-white/95  border-amber-200/50 shadow-lg"
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          System Status
        </Button>
      </Link>
    </div>
  ) }

export default TroubleshootingLink;