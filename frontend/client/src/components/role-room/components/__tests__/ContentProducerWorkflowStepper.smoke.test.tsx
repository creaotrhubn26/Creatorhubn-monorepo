// @ts-nocheck
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContentProducerWorkflowStepper } from '../ContentProducerWorkflowStepper';

describe('Sprint 3.1 — ContentProducerWorkflowStepper', () => {
  it('renders all 6 steps with labels', () => {
    render(
      <ContentProducerWorkflowStepper
        activeStep="brief"
        onSelectStep={() => {}}
      />,
    );
    ['Brief', 'Story', 'Storyboard', 'Klient', 'Levering', 'Økonomi'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('marks active step with aria-current="step"', () => {
    render(
      <ContentProducerWorkflowStepper
        activeStep="storyboard"
        onSelectStep={() => {}}
      />,
    );
    const activeBtn = screen.getByRole('button', { name: /3\. Storyboard \(nåværende\)/ });
    expect(activeBtn).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: /1\. Brief$/ })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('calls onSelectStep with the right step key when a step is clicked', () => {
    const onSelectStep = vi.fn();
    render(
      <ContentProducerWorkflowStepper
        activeStep="brief"
        onSelectStep={onSelectStep}
      />,
    );
    fireEvent.click(screen.getByText('Klient'));
    expect(onSelectStep).toHaveBeenCalledTimes(1);
    expect(onSelectStep).toHaveBeenCalledWith('approval');
  });

  it('renders approval-status badge on the Klient step when approvalStatus is provided', () => {
    render(
      <ContentProducerWorkflowStepper
        activeStep="approval"
        approvalStatus="awaiting_client"
        onSelectStep={() => {}}
      />,
    );
    expect(screen.getByText('Venter klient')).toBeInTheDocument();
  });

  it('renders no approval badge when approvalStatus is null', () => {
    render(
      <ContentProducerWorkflowStepper
        activeStep="brief"
        approvalStatus={null}
        onSelectStep={() => {}}
      />,
    );
    expect(screen.queryByText('Venter klient')).toBeNull();
    expect(screen.queryByText('Godkjent')).toBeNull();
  });

  it('marks completed steps with aria-label "(fullført)"', () => {
    render(
      <ContentProducerWorkflowStepper
        activeStep="approval"
        completedSteps={['brief', 'story', 'storyboard']}
        onSelectStep={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /1\. Brief \(fullført\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2\. Story \(fullført\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3\. Storyboard \(fullført\)/ })).toBeInTheDocument();
  });

  it('renders nothing when hidden=true', () => {
    const { container } = render(
      <ContentProducerWorkflowStepper
        activeStep="brief"
        onSelectStep={() => {}}
        hidden
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
