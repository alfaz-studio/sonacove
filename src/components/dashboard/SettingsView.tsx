import React from 'react';
import type { User } from '../../data/mock-dashboard';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '@/hooks/useAuth';
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Account Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your personal information and preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your account details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" defaultValue={user.name} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" defaultValue={user.email} disabled />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button>Save Changes</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Customize your experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
             <Label htmlFor="language">Language</Label>
             <Select defaultValue="en">
              <SelectTrigger id="language">
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
             <Select defaultValue="utc-3">
              <SelectTrigger id="timezone">
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
          <Button variant="outline">Save Preferences</Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SettingsView;

