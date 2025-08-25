'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, AlertTriangle, User, Package } from 'lucide-react';
import { authService } from '../../lib/auth';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Select } from '../ui/select';
import { RichTextEditor } from './RichTextEditor';
import { UserMentions } from './UserMentions';
import { FileUpload } from './FileUpload';
import { TrackstarOrderSearch } from './TrackstarOrderSearch';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
}

interface Brand {
  id: string;
  name: string;
}

interface MessageStatus {
  id: string;
  name: string;
  color: string;
}

interface TrackstarOrder {
  id: string;
  orderNumber: string;
  customerName?: string;
  customerEmail?: string;
  status: string;
  total: number;
  createdAt: string;
}

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  uploading?: boolean;
  error?: string;
}

interface MessageFormProps {
  messageId?: string; // For editing existing messages
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function MessageForm({ messageId, onSuccess, onCancel }: MessageFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form data
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [isUrgent, setIsUrgent] = useState(false);
  const [brandId, setBrandId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [mentionedUsers, setMentionedUsers] = useState<User[]>([]);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [linkedOrder, setLinkedOrder] = useState<TrackstarOrder | null>(null);
  
  // Options data
  const [brands, setBrands] = useState<Brand[]>([]);
  const [statuses, setStatuses] = useState<MessageStatus[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchBrands(),
          fetchStatuses(),
          fetchUsers(),
        ]);
        
        if (messageId) {
          await fetchMessage();
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [messageId]);

  const fetchBrands = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch('http://localhost:4000/api/brands', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBrands(data.brands || []);
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  const fetchStatuses = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch('http://localhost:4000/api/messages/statuses/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatuses(data.statuses || []);
      }
    } catch (error) {
      console.error('Error fetching statuses:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch('http://localhost:4000/api/messages/users/search', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const usersList = data.users || [];
        setUsers(usersList);
        setAllUsers(usersList);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchMessage = async () => {
    if (!messageId) return;
    
    try {
      const token = authService.getToken();
      const response = await fetch(`http://localhost:4000/api/messages/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const message = data.message;
        
        setTitle(message.title);
        setBody(message.body);
        setPriority(message.priority);
        setIsUrgent(message.isUrgent);
        setBrandId(message.brandId || '');
        setStatusId(message.statusId || '');
        setAssignedTo(message.assignedTo || '');
        
        // Set mentioned users
        if (message.mentions) {
          setMentionedUsers(message.mentions.map((m: any) => m.user));
        }
        
        // Note: Existing attachments would need to be handled differently
        // as they're already uploaded and stored
      }
    } catch (error) {
      console.error('Error fetching message:', error);
    }
  };

  const uploadAttachments = async (messageId: string): Promise<void> => {
    if (attachments.length === 0) return;

    const formData = new FormData();
    attachments.forEach(attachment => {
      if (!attachment.error) {
        formData.append('files', attachment.file);
      }
    });

    if (formData.has('files')) {
      const token = authService.getToken();
      const response = await fetch(`http://localhost:4000/api/messages/${messageId}/attachments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload attachments');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !body.trim()) {
      alert('Please fill in both title and body');
      return;
    }

    setSaving(true);
    
    try {
      const token = authService.getToken();
      const messageData = {
        title: title.trim(),
        body: body.trim(),
        priority,
        isUrgent,
        brandId: brandId || undefined,
        statusId: statusId || undefined,
        assignedTo: assignedTo || undefined,
        orderId: linkedOrder?.id || undefined,
        mentions: mentionedUsers.map(user => user.id),
      };

      const url = messageId 
        ? `http://localhost:4000/api/messages/${messageId}`
        : 'http://localhost:4000/api/messages';
      
      const method = messageId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      });

      if (response.ok) {
        const data = await response.json();
        const createdMessageId = messageId || data.message.id;
        
        // Upload attachments if any
        await uploadAttachments(createdMessageId);
        
        if (onSuccess) {
          onSuccess();
        } else {
          router.push('/messages');
        }
      } else {
        const errorData = await response.json();
        alert(`Failed to ${messageId ? 'update' : 'create'} message: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Failed to ${messageId ? 'update' : 'create'} message:`, error);
      alert(`Failed to ${messageId ? 'update' : 'create'} message. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push('/messages');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Message Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter message title"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message Body *
            </label>
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Enter your message here..."
              minHeight="200px"
            />
          </div>
        </CardContent>
      </Card>

      {/* Priority and Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Priority & Assignment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </Select>
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                id="isUrgent"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <label htmlFor="isUrgent" className="flex items-center text-sm font-medium text-gray-700">
                <AlertTriangle className="h-4 w-4 mr-1 text-red-500" />
                Mark as Urgent
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand
              </label>
              <Select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
              >
                <option value="">Select Brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <Select
                value={statusId}
                onChange={(e) => setStatusId(e.target.value)}
              >
                <option value="">No Status</option>
                {statuses.map((status) => (
                  <option key={status.id} value={status.id}>{status.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign To
            </label>
            <Select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.role})
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Mentions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            Mention Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UserMentions
            users={allUsers}
            selectedUsers={mentionedUsers}
            onUsersChange={setMentionedUsers}
            placeholder="Type @ to mention users..."
          />
        </CardContent>
      </Card>

      {/* Trackstar Order Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Trackstar Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TrackstarOrderSearch
            selectedOrder={linkedOrder}
            onOrderSelect={setLinkedOrder}
            brandId={brandId}
          />
        </CardContent>
      </Card>

      {/* File Attachments */}
      <Card>
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
        </CardHeader>
        <CardContent>
          <FileUpload
            files={attachments}
            onFilesChange={setAttachments}
            maxFiles={10}
            maxFileSize={10}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end space-x-4 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {messageId ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {messageId ? 'Update Message' : 'Create Message'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
