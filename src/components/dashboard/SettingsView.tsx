import React from 'react';
import type { User } from '@/data/dashboard-types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '@/hooks/useAuth';
import { AlertCircle, ExternalLink } from 'lucide-react';
import LoginRequired from './LoginRequired';

interface SettingsViewProps {
  user: User;
}

const SettingsView: React.FC<SettingsViewProps> = ({ user }) => {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return (
      <LoginRequired
        message="Account Settings" 
        description="Please log in to manage your account settings and preferences." 
      />
    );
  }

  // Construct Keycloak account management URL based on hostname
  const authDomain =
    window.location.hostname === 'sonacove.com'
      ? 'auth.sonacove.com/auth'
      : 'staj.sonacove.com/auth';
  const manageAccountUrl = `https://${authDomain}/realms/jitsi/account`;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Work In Progress Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-base font-semibold text-blue-900">Account Management In Progress</h3>
          <p className="text-base text-blue-700 mt-1">
            Profile editing and preference settings are currently read-only. Check back soon for updates!
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Account Settings</h2>
          <p className="text-base text-muted-foreground">
            Manage your personal information and preferences.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.open(manageAccountUrl, '_blank', 'noopener,noreferrer')}
        >
          Manage Account
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {isLoggedIn && (
        <Card className="opacity-90">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Update your account details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" defaultValue={user.name} disabled className="cursor-not-allowed bg-muted" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" defaultValue={user.email} disabled className="cursor-not-allowed bg-muted" />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button disabled>Save Changes</Button>
          </CardFooter>
        </Card>
      )}

      <Card className="opacity-90">
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Customize your experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
             <Label htmlFor="language">Language</Label>
             <Select defaultValue="en" disabled>
              <SelectTrigger id="language" className="cursor-not-allowed bg-muted">
                <SelectValue placeholder="Select Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English (US)</SelectItem>
                <SelectItem value="tr">Türkçe</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
             <Label htmlFor="timezone">Timezone</Label>
             <Select defaultValue="utc-3" disabled>
              <SelectTrigger id="timezone" className="cursor-not-allowed bg-muted">
                <SelectValue placeholder="Select Timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utc">UTC (GMT+0)</SelectItem>
                <SelectItem value="utc-3">Istanbul (GMT+3)</SelectItem>
                <SelectItem value="est">Eastern Time (US)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
         <CardFooter className="justify-end">
          <Button variant="outline" disabled>Save Preferences</Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SettingsView;
