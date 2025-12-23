// Client Communication Hook
import { useState, useEffect } from 'react';
import { clientCommunicationManager } from'../utils/clientCommunicationManager';

export const useClientCommunication = () => {
  const [communications, setCommunications] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
}, []);

  const loadData = async () => {
    setLoading(true);
    try {
      setCommunications(clientCommunicationManager.getCommunications());
      setTemplates(clientCommunicationManager.getTemplates());
      setSegments(clientCommunicationManager.getClientSegments());
  } catch (error) {
      console.error('Error loading communication data:', error);
  } finally {
      setLoading(false);
  }
};

  const createCommunication = (data: any) => {
    const communication = clientCommunicationManager.createCommunication(data);
    setCommunications(prev => [communication, ...prev]);
    return communication;
};

  const createTemplate = (data: any) => {
    const template = clientCommunicationManager.createTemplate(data);
    setTemplates(prev => [...prev, template]);
    return template;
};

  const createSegment = (data: any) => {
    const segment = clientCommunicationManager.createClientSegment(data);
    setSegments(prev => [...prev, segment]);
    return segment;
};

  const getAnalytics = () => {
    return clientCommunicationManager.getCommunicationAnalytics();
};

  return {
    communications,
    templates,
    segments,
    loading,
    createCommunication,
    createTemplate,
    createSegment,
    getAnalytics,
    loadData
};
};




