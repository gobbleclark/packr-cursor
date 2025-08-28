'use client';

import { useState, useEffect } from 'react';
import { Bell, Mail, MessageSquare, UserPlus, Edit, Save } from 'lucide-react';
import { buildApiUrl } from '../../lib/api-config';
import { authService } from '../../lib/auth';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Select } from '../ui/select';

interface NotificationPreferences {
  id: string;
  emailOnMention: boolean;
  emailOnAssignment: boolean;
  emailOnComment: boolean;
  emailOnMessageUpdate: boolean;
  digestFrequency: 'IMMEDIATE' | 'DAILY' | 'WEEKLY' | 'NEVER';
}

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl('notifications/preferences'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences, value: boolean | string) => {
    if (!preferences) return;
    
    setPreferences({
      ...preferences,
      [key]: value
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!preferences || !hasChanges) return;

    setSaving(true);
    try {
      const token = authService.getToken();
      const response = await fetch(buildApiUrl('notifications/preferences'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailOnMention: preferences.emailOnMention,
          emailOnAssignment: preferences.emailOnAssignment,
          emailOnComment: preferences.emailOnComment,
          emailOnMessageUpdate: preferences.emailOnMessageUpdate,
          digestFrequency: preferences.digestFrequency,
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
        setHasChanges(false);
        alert('Notification preferences saved successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to save preferences: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!preferences) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">Failed to load notification preferences.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Bell className="h-5 w-5 mr-2" />
          Email Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Message Notifications */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Message Notifications</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <UserPlus className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Mentions</p>
                  <p className="text-xs text-gray-500">When someone mentions you in a message or comment</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.emailOnMention}
                  onChange={(e) => handleToggle('emailOnMention', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Edit className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Assignments</p>
                  <p className="text-xs text-gray-500">When a message is assigned to you</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.emailOnAssignment}
                  onChange={(e) => handleToggle('emailOnAssignment', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <MessageSquare className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Comments</p>
                  <p className="text-xs text-gray-500">When someone comments on messages you're involved with</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.emailOnComment}
                  onChange={(e) => handleToggle('emailOnComment', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Message Updates</p>
                  <p className="text-xs text-gray-500">When messages you created are updated or completed</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.emailOnMessageUpdate}
                  onChange={(e) => handleToggle('emailOnMessageUpdate', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Delivery Frequency */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Frequency</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Email Frequency</p>
              <p className="text-xs text-gray-500">How often you want to receive email notifications</p>
            </div>
            <div className="w-48">
              <Select
                value={preferences.digestFrequency}
                onChange={(e) => handleToggle('digestFrequency', e.target.value)}
              >
                <option value="IMMEDIATE">Immediate</option>
                <option value="DAILY">Daily Digest</option>
                <option value="WEEKLY">Weekly Digest</option>
                <option value="NEVER">Never</option>
              </Select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="pt-4 border-t border-gray-200">
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Preferences
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
