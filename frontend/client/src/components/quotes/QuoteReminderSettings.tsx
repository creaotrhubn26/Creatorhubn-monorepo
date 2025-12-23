/**
 * Quote Reminder Settings Component
 * UI for configuring automated quote reminders and follow-ups
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Clock, Mail, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReminderConfig {
  expiryReminders: {
    enabled: boolean;
    daysBeforeExpiry: number[];
  };
  followUpReminders: {
    enabled: boolean;
    daysAfterSent: number[];
  };
  emailSubjectPrefix: string;
  defaultEmailFrom: string;
}

interface QuoteReminderSettingsProps {
  open: boolean;
  onClose: () => void;
  userId?: string;
}

const QuoteReminderSettings: React.FC<QuoteReminderSettingsProps> = ({
  open,
  onClose,
  userId = 'user-1',
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<unknown>(null);

  const [config, setConfig] = useState<ReminderConfig>({
    expiryReminders: {
      enabled: true,
      daysBeforeExpiry: [7, 3, 1],
    },
    followUpReminders: {
      enabled: true,
      daysAfterSent: [3, 7, 14],
    },
    emailSubjectPrefix: '[Påminnelse]',
    defaultEmailFrom: 'noreply@creatorhub.no',
  });

  // Fetch current configuration
  useEffect(() => {
    if (open) {
      fetchConfig();
      fetchServiceStatus();
    }
  }, [open]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/quotes/reminders/config?userId=${userId}`);
      const data = await response.json();

      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Failed to fetch reminder config: ', error);
      toast({
        title: 'Error,',
        description: 'Failed to load reminder settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchServiceStatus = async () => {
    try {
      const response = await fetch('/api/quotes/reminders/status, ');
      const data = await response.json();

      if (data.success) {
        setServiceStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch service status: ', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/quotes/reminders/config', {
        method: 'PUT',
        headers: {
          'Content-Type' : 'application/json',
        },
        body: JSON.stringify({
          userId,
          config,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Settings saved',
          description: 'Quote reminder settings updated successfully',
        });
        onClose();
      } else {
        throw new Error(data.error || 'Failed to save settings');
      }
    } catch (error: unknown) {
      console.error('Failed to save reminder config:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestReminders = async () => {
    try {
      const response = await fetch('/api/quotes/reminders/trigger', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Test triggered',
          description: 'Reminder check executed. Check your email for any reminders.',
        });
      }
    } catch (error) {
      console.error('Failed to trigger test:', error);
      toast({
        title: 'Error',
        description: 'Failed to trigger test reminders',
        variant: 'destructive',
      });
    }
  };

  const updateExpiryDays = (index: number, value: string) => {
    const newDays = [...config.expiryReminders.daysBeforeExpiry];
    newDays[index] = parseInt(value) || 0;
    setConfig({
      ...config,
      expiryReminders: {
        ...config.expiryReminders,
        daysBeforeExpiry: newDays,
      },
    });
  };

  const updateFollowUpDays = (index: number, value: string) => {
    const newDays = [...config.followUpReminders.daysAfterSent];
    newDays[index] = parseInt(value) || 0;
    setConfig({
      ...config,
      followUpReminders: {
        ...config.followUpReminders,
        daysAfterSent: newDays,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Quote Reminder Settings
          </DialogTitle>
          <DialogDescription>
            Configure automated reminders for expiring quotes and follow-ups on pending quotes
          </DialogDescription>
        </DialogHeader>

        {serviceStatus && (
          <Alert className={serviceStatus.isRunning ? 'border-green-500' : 'border-yellow-500'}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Service Status: {serviceStatus.isRunning ? 'Running' : 'Stopped'}</span>
              {serviceStatus.lastCheck && (
                <span className="text-xs text-muted-foreground">
                  Last check: {new Date(serviceStatus.lastCheck).toLocaleString()}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="expiry" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="expiry">Expiry Reminders</TabsTrigger>
            <TabsTrigger value="followup">Follow-ups</TabsTrigger>
            <TabsTrigger value="email">Email Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="expiry" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Expiry Reminders
                </CardTitle>
                <CardDescription>Send reminder emails before quotes expire</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="expiry-enabled" className="flex flex-col gap-1">
                    <span>Enable expiry reminders</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      Automatically remind clients before quote expiration
                    </span>
                  </Label>
                  <Switch
                    id="expiry-enabled"
                    checked={config.expiryReminders.enabled}
                    onCheckedChange={(checked) =>
                      setConfig({
                        ...config,
                        expiryReminders: {
                          ...config.expiryReminders,
                          enabled: checked,
                        },
                      })
                    }
                  />
                </div>

                {config.expiryReminders.enabled && (
                  <div className="space-y-3">
                    <Label>Days before expiry to send reminders</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {config.expiryReminders.daysBeforeExpiry.map((days, index) => (
                        <div key={index} className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Reminder {index + 1}
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            value={days}
                            onChange={(e) => updateExpiryDays(index, e.target.value)}
                            className="w-full"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <Info className="inline h-3 w-3 mr-1" />
                      Reminders will be sent {config.expiryReminders.daysBeforeExpiry.join(
                        '',
                      )}{', '}
                      days before expiration
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="followup" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Follow-up Reminders
                </CardTitle>
                <CardDescription>Send follow-up emails for pending quotes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="followup-enabled" className="flex flex-col gap-1">
                    <span>Enable follow-up reminders</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      Follow up with clients who haven't responded
                    </span>
                  </Label>
                  <Switch
                    id="followup-enabled"
                    checked={config.followUpReminders.enabled}
                    onCheckedChange={(checked) =>
                      setConfig({
                        ...config,
                        followUpReminders: {
                          ...config.followUpReminders,
                          enabled: checked,
                        },
                      })
                    }
                  />
                </div>

                {config.followUpReminders.enabled && (
                  <div className="space-y-3">
                    <Label>Days after sending to follow up</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {config.followUpReminders.daysAfterSent.map((days, index) => (
                        <div key={index} className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Follow-up {index + 1}
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            value={days}
                            onChange={(e) => updateFollowUpDays(index, e.target.value)}
                            className="w-full"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <Info className="inline h-3 w-3 mr-1" />
                      Follow-ups will be sent {config.followUpReminders.daysAfterSent.join(
                        '',
                      )}{''}
                      days after quote sent
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Configuration</CardTitle>
                <CardDescription>Customize email settings for reminders</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject-prefix">Email Subject Prefix</Label>
                  <Input
                    id="subject-prefix"
                    value={config.emailSubjectPrefix}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        emailSubjectPrefix: e.target.value,
                      })
                    }
                    placeholder="[Reminder]"
                  />
                  <p className="text-xs text-muted-foreground">
                    This prefix will be added to all reminder email subjects
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email-from">Default"From" Email</Label>
                  <Input
                    id="email-from"
                    type="email"
                    value={config.defaultEmailFrom}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        defaultEmailFrom: e.target.value,
                      })
                    }
                    placeholder="noreply@creatorhub.no"
                  />
                  <p className="text-xs text-muted-foreground">
                    Sender email address for reminder emails
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleTestReminders} disabled={saving}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Test Now
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? 'Saving...': 'Save Settings'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteReminderSettings;
