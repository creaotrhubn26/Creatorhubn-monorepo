/**
 * CreatorHub Norge - Mock Google Pay API
 * Provides mock 200 OK responses for Google Pay status indicators
 */

// Mock Google Pay Configuration
export const mockGooglePayConfiguration = {
  merchantId: '7115-4985-8029',
  environment: 'production',
  walletIssuer: '7115-4985-8029',
  supportedPaymentMethods: ['google-pay','card','vipps'],
  supportedCardNetworks: ['VISA','MASTERCARD','AMEX'],
  supportedAuthMethods: ['PAN_ONLY','CRYPTOGRAM_3DS'],
  lastUpdated: new Date().toISOString(),
  status: 'active', 
};

// Mock Google Pay Products
export const mockGooglePayProducts = {
  products: [
    {
      id: 'basic-plan',
      name: 'Grunnplan',
      description: 'Grunnleggende funksjonalitet for kreative profesjonelle',
      price: 299,
      currency: 'NOK',
      interval: 'month',
      features: ['Google Drive integrasjon','Grunnleggende verktøy','E-post støtte']
  },
    {
      id: 'professional-plan',
      name: 'Profesjonell plan',
      description: 'Avansert funksjonalitet for profesjonelle kreative',
      price: 599,
      currency: 'NOK',
      interval: 'month',
      features: ['Alle grunnplan funksjoner','Avanserte verktøy','Prioritert støtte','Google Wallet medlemskort']
  },
    {
      id: 'enterprise-plan',
      name: 'Bedriftsplan',
      description: 'Komplett løsning for store bedrifter',
      price: 999,
      currency: 'NOK',
      interval: 'month',
      features: ['Alle profesjonell plan funksjoner','Tilpassede integrasjoner','Dedikert støtte','Avansert administrasjon']
  }
  ],
  totalCount: 3,
  lastUpdated: new Date().toISOString(), 
};

// Mock Payment Statistics
export const mockPaymentStatistics = {
  todayPayments: 12,
  weekPayments: 89,
  monthPayments: 342,
  successRate: 98.5,
  avgResponseTime: 85,
  totalRevenue: 204750,
  currency: 'NOK',
  activeSubscriptions: 156,
  membershipCardsCreated: 89,
  lastUpdated: new Date().toISOString(), 
};

// Mock Subscriber Statistics
export const mockSubscriberStats = {
  success: true,
  totalSubscribers: 156,
  activeSubscribers: 142,
  trialSubscribers: 8,
  cancelledSubscribers: 6,
  packageBreakdown: {
    'basic-plan': {
      name: 'Basic Plan',
      price: 99,
      currency: 'NOK',
      interval: 'month',
      subscribers: 45,
      revenue: 4455,
      growth: 12.5,
  },
    'pro-plan': {
      name: 'Professional Plan',
      price: 299,
      currency: 'NOK',
      interval: 'month',
      subscribers: 78,
      revenue: 23322,
      growth: 8.3,
  },
  'enterprise-plan': {
      name: 'Enterprise Plan',
      price: 999,
      currency: 'NOK',
      interval: 'month',
      subscribers: 19,
      revenue: 18981,
      growth: 15.2,
  },
},
  monthlyRecurringRevenue: 46758,
  averageRevenuePerUser: 299.73,
  churnRate: 2.1,
  conversionRate: 18.5,
  lastUpdated: new Date().toISOString(),
};

// Mock API Response Handler
export const handleMockApiRequest = async (endpoint: string, options: RequestInit = {}) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  
  // Check authentication header
  const headers = options.headers as Record<string, string> | undefined;
  const authHeader = headers?.['Authorization'] || headers?.['authorization'];
  if (!authHeader || !authHeader.includes('Bearer')) {
    return {
      status: 401,
      statusText: 'Unauthorized',
      ok: false,
      json: async () => ({ 
        error: 'Authentication required',
        message: 'Please log in to access this resource',
        status: 401
    })
  };
}
  
        // Route to appropriate mock data
        let mockData;
        switch (endpoint) {
          case '/api/google-pay/configuration':
            mockData = mockGooglePayConfiguration;
            break;
          case '/api/google-pay/products':
            mockData = mockGooglePayProducts;
            break;
          case '/api/google-pay/statistics':
            mockData = mockPaymentStatistics;
            break;
          case '/api/admin/subscriber-stats':
            mockData = mockSubscriberStats;
            break;
          default: return {
              status: 404,
              statusText: 'Not Found',
              ok: false,
              json: async () => ({ 
                error: 'Endpoint not found',
                message: `The endpoint ${endpoint} does not exist`,
                status: 404
            })
          };
      }
  
  return {
    status: 200,
    statusText: 'OK',
    ok: true,
    json: async () => mockData
};
};

// Mock fetch function for development
export const mockFetch = async (url: string, options: RequestInit = {}) => {
  if (url.startsWith('/api/google-pay/') || url.startsWith('/api/admin/subscriber-stats')) {
    return handleMockApiRequest(url, options);
}
  
  // For other endpoints, use real fetch
  return fetch(url, options);
};
