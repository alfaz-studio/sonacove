import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Copy, Plus, Trash2, Key, Webhook, Code } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import LoginRequired from './LoginRequired';

interface ApiKey {
  id: string;
  key: string;
  name?: string;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: 'active' | 'test';
}

const DeveloperView: React.FC = () => {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return (
      <LoginRequired
        message="Developer Console" 
        description="Log in to manage API keys, webhooks, and integration settings." 
      />
    );
  }

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    { id: '1', key: 'sk_live_51M0...234x' },
  ]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([
    {
      id: '1',
      url: 'https://api.myschool.org/webhooks/sonacove',
      events: ['meeting.started', 'meeting.ended'],
      status: 'active',
    },
    {
      id: '2',
      url: 'https://api.myschool.org/webhooks/recording',
      events: ['recording.ready'],
      status: 'test',
    },
  ]);

  const [isAddWebhookOpen, setIsAddWebhookOpen] = useState(false);
  const [isAddApiKeyOpen, setIsAddApiKeyOpen] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);
  const [newApiKeyName, setNewApiKeyName] = useState('');

  const availableEvents = [
    'meeting.started',
    'meeting.ended',
    'meeting.participant.joined',
    'meeting.participant.left',
    'recording.ready',
    'recording.failed',
  ];

  const generateApiKey = () => {
    const prefix = 'sk_live_';
    const randomPart = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    return `${prefix}${randomPart}`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleAddWebhook = () => {
    if (newWebhookUrl && newWebhookEvents.length > 0) {
      const newWebhook: Webhook = {
        id: Date.now().toString(),
        url: newWebhookUrl,
        events: newWebhookEvents,
        status: 'active',
      };
      setWebhooks([...webhooks, newWebhook]);
      setNewWebhookUrl('');
      setNewWebhookEvents([]);
      setIsAddWebhookOpen(false);
    }
  };

  const handleDeleteWebhook = (id: string) => {
    setWebhooks(webhooks.filter((w) => w.id !== id));
  };

  const handleAddApiKey = () => {
    const newKey: ApiKey = {
      id: Date.now().toString(),
      key: generateApiKey(),
      name: newApiKeyName || undefined,
    };
    setApiKeys([...apiKeys, newKey]);
    setNewApiKeyName('');
    setIsAddApiKeyOpen(false);
  };

  const handleDeleteApiKey = (id: string) => {
    setApiKeys(apiKeys.filter((k) => k.id !== id));
  };

  const toggleWebhookEvent = (event: string) => {
    if (newWebhookEvents.includes(event)) {
      setNewWebhookEvents(newWebhookEvents.filter((e) => e !== event));
    } else {
      setNewWebhookEvents([...newWebhookEvents, event]);
    }
  };

  const embedCode = `<script src="https://cdn.sonacove.com/embed.js"></script>
<script>
  Sonacove.init({
    apiKey: 'K3y4B2x9P8qR7tW5mN9pQ0sT',
    roomId: 'your-room-id',
    onReady: () => {
      console.log('Sonacove is ready');
    }
  });
</script>`;

  return (
    <div className="space-y-12">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Developer Console</h2>
        <p className="text-sm text-muted-foreground">
          Manage API keys and Webhooks to integrate Sonacove into your applications.
        </p>
      </div>

      {/* Embed Section */}
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Code className="h-5 w-5" /> Embed in your application
          </h3>
          <p className="text-sm text-muted-foreground">
            Copy the code snippet below and paste it into your HTML to embed Sonacove meetings.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <textarea
                  readOnly
                  value={embedCode}
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-none"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                <Button
                  size="sm"
                  className="px-3"
                  onClick={() => handleCopy(embedCode)}
                >
                  <span className="sr-only">Copy</span>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="rounded-md border bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  The embed script will automatically handle meeting initialization and participant management.
                  You can customize the <code className="px-1 py-0.5 bg-background rounded">roomId</code> and add additional configuration options as needed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      {/* API Keys Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Key className="h-5 w-5" /> API Keys
            </h3>
            <p className="text-sm text-muted-foreground">
              Use these keys to authenticate your requests to the Sonacove API.
            </p>
          </div>
          <Button className="gap-2" onClick={() => setIsAddApiKeyOpen(true)}>
            <Plus className="h-4 w-4" /> Add API Key
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {apiKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No API keys yet. Create one to get started.
                </p>
              ) : (
                apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="flex items-center space-x-2">
                    <div className="grid flex-1 gap-2">
                      {apiKey.name && (
                        <Label className="text-xs text-muted-foreground">{apiKey.name}</Label>
                      )}
                      <Input
                        value={apiKey.key}
                        readOnly
                        className="font-mono text-xs"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="px-3"
                      onClick={() => handleCopy(apiKey.key)}
                    >
                      <span className="sr-only">Copy</span>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteApiKey(apiKey.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))
              )}
              <div className="rounded-md border bg-muted p-4">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Key className="h-4 w-4" /> Read the{' '}
                  <a href="/api/scalar" target="_blank" className="text-primary underline">
                    API Documentation
                  </a>{' '}
                  to get started.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      {/* Webhooks Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Webhook className="h-5 w-5" /> Webhooks
            </h3>
            <p className="text-sm text-muted-foreground">
              Events sent to your endpoints.
            </p>
          </div>
          <Button className="gap-2" onClick={() => setIsAddWebhookOpen(true)}>
            <Plus className="h-4 w-4" /> Add Webhook
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            {webhooks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No webhooks yet. Create one to receive events.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Endpoint URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-mono text-xs">
                        {webhook.url}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {webhook.events.map((event) => (
                            <Badge key={event} variant="secondary">
                              {event}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            webhook.status === 'active'
                              ? 'bg-green-100 text-green-800 hover:bg-green-100'
                              : ''
                          }
                          variant={webhook.status === 'test' ? 'outline' : 'default'}
                        >
                          {webhook.status === 'active' ? 'Active' : 'Test Mode'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteWebhook(webhook.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Webhook Dialog */}
      <Dialog open={isAddWebhookOpen} onOpenChange={setIsAddWebhookOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>
              Configure a new webhook endpoint to receive events from Sonacove.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://api.example.com/webhooks/sonacove"
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="space-y-2 border rounded-md p-4 max-h-48 overflow-y-auto">
                {availableEvents.map((event) => (
                  <div key={event} className="flex items-center space-x-2">
                    <Checkbox
                      id={`event-${event}`}
                      checked={newWebhookEvents.includes(event)}
                      onCheckedChange={() => toggleWebhookEvent(event)}
                    />
                    <label
                      htmlFor={`event-${event}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {event}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddWebhookOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddWebhook} disabled={!newWebhookUrl || newWebhookEvents.length === 0}>
              Add Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add API Key Dialog */}
      <Dialog open={isAddApiKeyOpen} onOpenChange={setIsAddApiKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add API Key</DialogTitle>
            <DialogDescription>
              Create a new API key to authenticate requests to the Sonacove API.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Name (optional)</Label>
              <Input
                id="api-key-name"
                placeholder="Production API Key"
                value={newApiKeyName}
                onChange={(e) => setNewApiKeyName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Give your API key a descriptive name to help you identify it later.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddApiKeyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddApiKey}>Create API Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeveloperView;

