'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AuthenticatedLayout } from '../../../components/layout/AuthenticatedLayout';
import { authService } from '../../../lib/auth';
import { MessageForm } from '../../../components/messages/MessageForm';

export default function NewMessagePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authResponse = await authService.verifyToken();
        if (authResponse) {
          setUser(authResponse.user);
        } else {
          router.push('/');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = () => {
    authService.clearToken();
    router.push('/');
  };

  const handleSuccess = () => {
    router.push('/messages');
  };

  const handleCancel = () => {
    router.push('/messages');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AuthenticatedLayout user={user} onLogout={handleLogout}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => router.push('/messages')}
            className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">New Message</h1>
            <p className="text-gray-600">Create a new message with rich content, attachments, and integrations</p>
          </div>
        </div>

        {/* Enhanced Message Form */}
        <MessageForm 
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </AuthenticatedLayout>
  );
}