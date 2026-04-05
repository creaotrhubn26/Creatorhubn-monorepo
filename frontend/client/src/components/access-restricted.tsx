import { useTheming } from '@/utils/theming-helper';
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card as ViewModule, CardContent } from '@mui/material';
import { Button } from "@/components/material-ui";
import {
  Security,
  Lock,
  Email,
  CheckCircle,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export default function AccessRestricted() {
const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Database connection for AccessRestricted
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component,', 'user-data'],
    queryFn: () => apiRequest('/api/component/user-data', ),
    retry: false
});

  // Mutation for updating component data
  const updateAccessRestricted = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/component/update', {
        headers: {
          "Content-Type" : "application/json"
    },
        
        method: 'POST',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/component']
  });
  }
});


  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <ViewModule className="w-full max-w-2xl">
        <CardContent className="pt-8" sx={theming.getThemedCardSx()}>
          <div className="flex flex-col items-center justify-center min-h-screen">
            {/* Icon */}
            <div className="flex flex-col items-center justify-center min-h-screen">
              <Security className="w-10 h-12 text-amber-600" />
            </div>

            {/* Heading */}
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Invitation Required
              </h1>
              <p className="text-lg text-gray-600">
                CreatorHub Norge is an exclusive platform for professional creators
              </p>
            </div>

            {/* Access Process */}
            <div className="flex flex-col items-center justify-center min-h-screen">
              <h2 className="text-lg font-semibold text-amber-900 mb-4">
                How to Get Access
              </h2>
              <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="flex flex-col items-center justify-center min-h-screen">
                  <Email className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                  <h3 className="font-medium text-amber-900">1. Request Invitation</h3>
                  <p className="text-sm text-amber-700">
                    Contact our administrator to request platform access
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center min-h-screen">
                  <CheckCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                  <h3 className="font-medium text-amber-900">2. Admin Review</h3>
                  <p className="text-sm text-amber-700">
                    Your request will be reviewed by our super administrator
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center min-h-screen">
                  <Lock className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                  <h3 className="font-medium text-amber-900">3. Approved Access</h3>
                  <p className="text-sm text-amber-700">
                    Once, approved, you'll receive invitation instructions
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col items-center justify-center min-h-screen">
              <Button
                onClick={ () => window.open('mailto:kontakt@creatorhubn.com?subject=CreatorHub Norge Access Request&body=Hello,%0D%0A%0D%0AI would like to request access to CreatorHub Norge.%0D%0A%0D%0AName: %0D%0AProfession: %0D%0ACompany/Studio: %0D%0AReason for access: %0D%0A%0D%0AThank you!', '_blank') }
                className="text-gray-800 dark: text-white, hover:opacity-90"
                style={ { backgroundColor: 'hsl(25, 25%, 25%)' } }
              >
                <Email className="w-5 h-5 mr-2" />
                Request Access
              </Button>
              <Button
                variant="outlined"
                onClick={() => window.location.href ='/login'}
              >
                <Security className="w-5 h-5 mr-2" />
                Sign In (Members)
              </Button>
            </div>

            {/* Information */}
            <div className="flex flex-col items-center justify-center min-h-screen">
              <p>
                <strong>For Existing Members: </strong> If you already have an invitation, 
                please check your email for access instructions.
              </p>
              <p>
                <strong>Platform Features: </strong> Professional tools for photographers, 
                videographers, music, producers, and creative businesses in Norway.
              </p>
            </div>

            {/* Footer */}
            <div className="flex flex-col items-center justify-center min-h-screen">
              <p className="text-sm text-gray-400">
                CreatorHub Norge • Secure Platform • Admin Controlled Access
              </p>
            </div>
          </div>
        </CardContent>
      </ViewModule>
    </div>
  );
}
