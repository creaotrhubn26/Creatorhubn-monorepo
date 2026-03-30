// Client Communication Hook
import { useState, useEffect } from 'react';
import {
  clientCommunicationManager,
  type ClientCommunication,
  type ClientSegment,
  type CommunicationTemplate,
} from '../utils/clientCommunicationManager';

export const useClientCommunication = () => {
  const [communications, setCommunications] = useState<ClientCommunication[]>([]);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [segments, setSegments] = useState<ClientSegment[]>([]);
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

  const createCommunication = (data: Omit<ClientCommunication, 'id' | 'createdAt'>) => {
    const communication = clientCommunicationManager.createCommunication(data);
    setCommunications(prev => [communication, ...prev]);
    return communication;
};

  const deleteCommunication = (id: string) => {
    const deleted = clientCommunicationManager.deleteCommunication(id);
    if (deleted) {
      setCommunications(prev => prev.filter(communication => communication.id !== id));
    }
    return deleted;
  };

  const createTemplate = (data: Omit<CommunicationTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const template = clientCommunicationManager.createTemplate(data);
    setTemplates(prev => [...prev, template]);
    return template;
};

  const updateTemplate = (
    id: string,
    updates: Partial<Omit<CommunicationTemplate, 'id' | 'createdAt' | 'updatedAt'>>
  ) => {
    const template = clientCommunicationManager.updateTemplate(id, updates);
    if (template) {
      setTemplates(clientCommunicationManager.getTemplates());
    }
    return template;
  };

  const deleteTemplate = (id: string) => {
    const deleted = clientCommunicationManager.deleteTemplate(id);
    if (deleted) {
      setTemplates(clientCommunicationManager.getTemplates());
    }
    return deleted;
  };

  const createSegment = (data: Omit<ClientSegment, 'id' | 'createdAt' | 'updatedAt'>) => {
    const segment = clientCommunicationManager.createClientSegment(data);
    setSegments(prev => [...prev, segment]);
    return segment;
};

  const updateSegment = (
    id: string,
    updates: Partial<Omit<ClientSegment, 'id' | 'createdAt' | 'updatedAt'>>
  ) => {
    const segment = clientCommunicationManager.updateClientSegment(id, updates);
    if (segment) {
      setSegments(clientCommunicationManager.getClientSegments());
    }
    return segment;
  };

  const deleteSegment = (id: string) => {
    const deleted = clientCommunicationManager.deleteClientSegment(id);
    if (deleted) {
      setSegments(clientCommunicationManager.getClientSegments());
    }
    return deleted;
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
    deleteCommunication,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    createSegment,
    updateSegment,
    deleteSegment,
    getAnalytics,
    loadData
};
};



