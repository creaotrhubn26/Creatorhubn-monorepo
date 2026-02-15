import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Box,
  TextField,
  Button,
  Autocomplete,
} from '@mui/material';
import { logger } from '@/core/services/logger';

const log = logger.module('ContactPicker');

interface Contact {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
}

interface ContactPickerProps {
  selectedContact: Contact | null;
  onContactSelect: (contact: Contact | null) => void;
  onContactAdd?: (contact: { name: string; email: string; phone: string }) => void;
  profession?: string;
  showErrorToast?: (message: string) => void;
  showInfoToast?: (message: string) => void;
  showSuccessToast?: (message: string) => void;
}

export const ContactPicker: React.FC<ContactPickerProps> = ({
  selectedContact,
  onContactSelect,
  onContactAdd,
  profession = '',
  showErrorToast,
  showInfoToast,
  showSuccessToast,
}) => {
  const [contactQuery, setContactQuery] = useState('');
  const [contactOptions, setContactOptions] = useState<Contact[]>([]);

  // Search contacts from Google Contacts API
  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      try {
        if (!contactQuery || contactQuery.length < 2) {
          setContactOptions([]);
          return;
        }
        const res = await fetch(
          `/api/google/people/search-contacts?q=${encodeURIComponent(contactQuery)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setContactOptions(data || []);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          // Ignore abort errors
        } else {
          log.warn('Failed to search contacts', error);
        }
      }
    };
    run();
    return () => controller.abort();
  }, [contactQuery]);

  const handleAddContact = useCallback(async () => {
    if (!selectedContact) return;
    
    const email = selectedContact.email || '';
    const name = selectedContact.displayName || 
                 `${selectedContact.firstName || ''} ${selectedContact.lastName || ''}`.trim() ||
                 email;
    
    if (!email) {
      showErrorToast?.('Mangler e-post for å legge til kontakt');
      return;
    }

    try {
      // Check if contact already exists
      const searchRes = await fetch(`/api/google/people/search-contacts?q=${encodeURIComponent(email)}`);
      let exists = false;
      if (searchRes.ok) {
        const contacts = await searchRes.json();
        const found = contacts.find((c: Contact) => 
          c.email?.toLowerCase() === email.toLowerCase()
        );
        exists = !!found;
      }

      if (exists) {
        showInfoToast?.('Kontakt finnes allerede i Google Kontakter');
        return;
      }

      // Create contact
      const [firstName, ...rest] = name.split(' ');
      const lastName = rest.join(' ');
      const phone = selectedContact.phone || '';

      const createRes = await fetch('/api/google/people/create-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName || '-',
          lastName: lastName || '-',
          email,
          phone,
          profession,
          companyName: selectedContact.companyName || '',
        }),
      });

      if (!createRes.ok) {
        throw new Error('Create contact failed');
      }

      showSuccessToast?.('Kontakt lagt til i Google Kontakter');
      onContactAdd?.({ name, email, phone });
    } catch (error) {
      log.error('Failed to add contact', error);
      showErrorToast?.('Kunne ikke legge til kontakt');
    }
  }, [selectedContact, profession, onContactAdd, showErrorToast, showInfoToast, showSuccessToast]);

  const selectedEmail = selectedContact?.email || '';

  return (
    <Card sx={{ mt: 2, mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle2" gutterBottom>
          Velg eksisterende kontakt (Google Kontakter)
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 50%' }, width: '100%' }}>
            <Autocomplete
              options={contactOptions}
              getOptionLabel={(o: Contact) => o?.displayName || o?.email || ''}
              onInputChange={(_, val) => setContactQuery(val)}
              onChange={(_, val) => onContactSelect(val)}
              slotProps={{
                popper: { sx: { zIndex: 1400 } }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Søk navn eller e-post"
                  placeholder="Søk i Google Kontakter"
                />
              )}
            />
          </Box>
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 25%' }, width: '100%' }}>
            <TextField
              label="Valgt e-post"
              value={selectedEmail}
              fullWidth
              slotProps={{ input: { readOnly: true } }}
            />
          </Box>
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 25%' }, width: '100%' }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleAddContact}
              disabled={!selectedEmail}
            >
              Legg til i Kontakter
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};












