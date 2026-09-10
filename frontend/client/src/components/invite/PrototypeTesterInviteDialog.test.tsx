import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/queryClient';
import { PrototypeTesterInviteDialog } from './RoleRoomTesterInviteDialog';

vi.mock('@/lib/queryClient', () => ({ apiRequest: vi.fn() }));

const preview = {
  subject: 'Du er invitert til CreatorHubs prototypeprogram',
  html: '<!doctype html><html><body>CreatorHub e-post</body></html>',
  text: 'CreatorHub e-post',
  fromLabel: 'CreatorHub Norge',
  fromAddress: 'hello@creatorhubn.com',
  replyToEmail: 'hello@creatorhubn.com',
  recipientEmail: 'tester@example.com',
  expiresAt: '2026-09-24T12:00:00.000Z',
  agreements: ['Programvilkår', 'NDA', 'Databehandleravtale', 'Intensjonsavtale'],
};

async function chooseProfession(label: string) {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Profesjon' }));
  fireEvent.click(await screen.findByRole('option', { name: label }));
}

describe('PrototypeTesterInviteDialog', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('requires an exact review and sends one direct invitation after confirmation', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path) => {
      if (String(path).endsWith('/preview')) return preview;
      return {
        id: 'invite-id',
        token: 'invite-token',
        inviteUrl: 'https://creatorhubn.com/prototype-tester/accept-invite?token=invite-token',
        emailDelivery: { sent: true, provider: 'resend', messageId: 'message-id' },
      };
    });

    render(<PrototypeTesterInviteDialog open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fortsett uten bedrift' }));

    expect(screen.getByTestId('invite-missing-requirements')).toHaveTextContent(
      'kontaktpersonens navn, gyldig e-postadresse, profesjon, minst ett testområde',
    );
    fireEvent.change(screen.getByLabelText('Kontaktpersonens navn'), { target: { value: 'Direkte Tester' } });
    fireEvent.change(screen.getByLabelText('E-post'), { target: { value: 'tester@example.com' } });
    await chooseProfession('Fotograf');
    fireEvent.click(screen.getByText('Story Arc Studio'));
    fireEvent.click(screen.getByRole('button', { name: 'Se e-post og kontroller' }));

    expect(await screen.findByText('Dette er den faktiske aktive Email Designer-malen. Ingen e-post er sendt ennå.')).toBeInTheDocument();
    expect(screen.getByText('Du er invitert til CreatorHubs prototypeprogram')).toBeInTheDocument();
    expect(screen.getByTitle('Forhåndsvisning av invitasjons-e-post')).toHaveAttribute('sandbox', '');
    expect(apiRequest).toHaveBeenCalledWith('/api/prototype-tester-invites/preview', {
      method: 'POST',
      body: {
        email: 'tester@example.com',
        name: 'Direkte Tester',
        profession: 'photographer',
        company: undefined,
        organizationNumber: undefined,
        testingAreas: ['Story Arc Studio'],
        personalMessage: undefined,
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send invitasjon' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/prototype-tester-invites', {
      method: 'POST',
      body: {
        email: 'tester@example.com',
        name: 'Direkte Tester',
        profession: 'photographer',
        company: undefined,
        organizationNumber: undefined,
        testingAreas: ['Story Arc Studio'],
        personalMessage: undefined,
      },
    }));
    expect(await screen.findByText('Invitasjon opprettet og e-post sendt til tester@example.com.')).toBeInTheDocument();
  });

  it('fills Estremo legal identity and profession, then offers explicit holder and area suggestions', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path) => {
      const url = String(path);
      if (url.includes('/brreg/search')) {
        return {
          companies: [{
            organizationNumber: '998989159',
            name: 'ESTREMO RECORDING STUDIOS JENS MICHAEL PETERS NIELSEN',
            organizationForm: 'Enkeltpersonforetak',
            organizationFormCode: 'ENK',
            primaryIndustryCode: '59.200',
            primaryIndustryDescription: 'Produksjon og utgivelse av musikk- og lydopptak',
            recommendedProfession: 'music_producer',
            professionRecommendation: {
              profession: 'music_producer',
              confidence: 'high',
              reason: 'Næringskode 59.200 gjelder produksjon eller utgivelse av musikk- og lydopptak.',
            },
            suggestedTestingAreas: ['CreatorHub-dashboard', 'Prosjekt og arbeidsflyt', 'Showcase og klient-godkjenning', 'Kontrakt og fakturering', 'Integrasjoner'],
            businessAddress: 'Styrilia 16, 2080 EIDSVOLL',
            operationalStatus: 'active',
          }],
        };
      }
      if (url.endsWith('/brreg/998989159/contact')) {
        return { contact: { name: 'Jens Michael Peters Nielsen', role: 'Innehaver', source: 'BRREG_ROLLER', requiresConfirmation: true } };
      }
      if (url.endsWith('/preview')) return { ...preview, recipientEmail: 'daniel@creatorhubn.com' };
      return {
        id: 'invite-id',
        token: 'invite-token',
        inviteUrl: 'https://creatorhubn.com/prototype-tester/accept-invite?token=invite-token',
        emailDelivery: { sent: true, provider: 'resend' },
        verifiedCompany: {
          organizationNumber: '998989159',
          name: 'ESTREMO RECORDING STUDIOS JENS MICHAEL PETERS NIELSEN',
          businessAddress: 'Styrilia 16, 2080 EIDSVOLL',
        },
      };
    });

    render(<PrototypeTesterInviteDialog open onClose={vi.fn()} />);
    const companySearch = screen.getByRole('combobox', { name: 'Søk bedrift i Brønnøysundregistrene' });
    fireEvent.focus(companySearch);
    fireEvent.change(companySearch, { target: { value: 'Estremo Records' } });
    expect(companySearch).toHaveValue('Estremo Records');
    await waitFor(
      () => expect(apiRequest).toHaveBeenCalledWith('/api/prototype-tester-invites/brreg/search?q=Estremo%20Records'),
      { timeout: 2_000 },
    );
    fireEvent.click(await screen.findByRole('option', { name: /ESTREMO RECORDING STUDIOS/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Fortsett med bedrift' }));

    expect(await screen.findByText(/BRREG foreslår Jens Michael Peters Nielsen/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bruk navnet' }));
    expect(screen.getByLabelText('Kontaktpersonens navn')).toHaveValue('Jens Michael Peters Nielsen');
    expect(screen.getByRole('combobox', { name: 'Profesjon' })).toHaveTextContent('Musikkprodusent');
    expect(screen.getByText(/Høy sikkerhet: Næringskode 59.200/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('E-post'), { target: { value: 'daniel@creatorhubn.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Bruk 5 forslag for Musikkprodusent/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Se e-post og kontroller' }));
    await screen.findByText('ESTREMO RECORDING STUDIOS JENS MICHAEL PETERS NIELSEN');
    fireEvent.click(screen.getByRole('button', { name: 'Send invitasjon' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/prototype-tester-invites', {
      method: 'POST',
      body: expect.objectContaining({
        email: 'daniel@creatorhubn.com',
        name: 'Jens Michael Peters Nielsen',
        profession: 'music_producer',
        company: 'ESTREMO RECORDING STUDIOS JENS MICHAEL PETERS NIELSEN',
        organizationNumber: '998989159',
        testingAreas: ['CreatorHub-dashboard', 'Prosjekt og arbeidsflyt', 'Showcase og klient-godkjenning', 'Kontrakt og fakturering', 'Integrasjoner'],
      }),
    }));
  });
});
