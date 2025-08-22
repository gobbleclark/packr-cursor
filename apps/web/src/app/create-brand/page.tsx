'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Upload, Users, ArrowLeft, Save } from 'lucide-react';

export default function CreateBrandPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    brandName: '',
    brandSlug: '',
    integrationType: '',
    integrationConfig: '',
    logo: null as File | null,
    invitedUsers: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, logo: file }));
    }
  };

  const addInvitedUser = () => {
    setFormData(prev => ({
      ...prev,
      invitedUsers: [...prev.invitedUsers, { email: '', role: 'BRAND_USER' }]
    }));
  };

  const removeInvitedUser = (index: number) => {
    setFormData(prev => ({
      ...prev,
      invitedUsers: prev.invitedUsers.filter((_, i) => i !== index)
    }));
  };

  const updateInvitedUser = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      invitedUsers: prev.invitedUsers.map((user, i) => 
        i === index ? { ...user, [field]: value } : user
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      // Get the authentication token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Authentication required. Please log in again.');
        router.push('/');
        return;
      }
      
      const response = await fetch('http://localhost:4000/api/brands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          // Only include invited users with valid emails
          invitedUsers: formData.invitedUsers.filter(user => user.email.trim() !== ''),
          // Convert logo to base64 if needed, or handle file upload separately
          logo: formData.logo ? await fileToBase64(formData.logo) : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create brand');
      }

      const result = await response.json();
      
      if (result.invitations.length > 0) {
        setSuccess(`Brand created successfully! Invitations sent to ${result.invitations.length} users.`);
      } else {
        setSuccess('Brand created successfully! You can invite users later from the brand management page.');
      }
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create brand. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <Building2 className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Create New Brand</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Brand Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Brand Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.brandName}
                  onChange={(e) => handleInputChange('brandName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter brand name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand URL Slug *
                </label>
                <input
                  type="text"
                  required
                  value={formData.brandSlug}
                  onChange={(e) => handleInputChange('brandSlug', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="brand-name"
                />
                <p className="text-xs text-gray-500 mt-1">This will be used in the URL: packr.co/brand-name</p>
              </div>
            </div>
          </div>

          {/* Integration Information (Optional) */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Integration Information (Optional)</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Integration Type
                </label>
                <select
                  value={formData.integrationType}
                  onChange={(e) => handleInputChange('integrationType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select integration type</option>
                  <option value="shopify">Shopify</option>
                  <option value="woocommerce">WooCommerce</option>
                  <option value="magento">Magento</option>
                  <option value="custom">Custom API</option>
                  <option value="none">No integration needed</option>
                </select>
              </div>
              {formData.integrationType && formData.integrationType !== 'none' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Integration Configuration
                  </label>
                  <textarea
                    value={formData.integrationConfig}
                    onChange={(e) => handleInputChange('integrationConfig', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter API keys, webhook URLs, or other configuration details..."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Brand Logo (Optional) */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Brand Logo (Optional)</h2>
            <div className="flex items-center space-x-6">
              <div className="flex-shrink-0">
                <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                  {formData.logo ? (
                    <img
                      src={URL.createObjectURL(formData.logo)}
                      alt="Brand logo preview"
                      className="w-20 h-20 object-contain rounded"
                    />
                  ) : (
                    <Upload className="h-8 w-8 text-gray-400" />
                  )}
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Logo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Recommended: 200x200px, PNG or JPG format
                </p>
              </div>
            </div>
          </div>

          {/* Invite Users (Optional) */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Invite Brand Users (Optional)</h2>
              <button
                type="button"
                onClick={addInvitedUser}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Users size={16} />
                <span>Add User</span>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              You can invite users now or add them later from the brand management page.
            </p>
            <div className="space-y-4">
              {formData.invitedUsers.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No users invited yet. Click "Add User" above to invite someone.</p>
              ) : (
                formData.invitedUsers.map((user, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <input
                        type="email"
                        value={user.email}
                        onChange={(e) => updateInvitedUser(index, 'email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="user@example.com"
                      />
                    </div>
                    <div className="w-32">
                      <select
                        value={user.role}
                        onChange={(e) => updateInvitedUser(index, 'role', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="BRAND_USER">Brand User</option>
                        <option value="BRAND_ADMIN">Brand Admin</option>
                      </select>
                    </div>
                    {formData.invitedUsers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => removeInvitedUser(index)}
                        className="p-2 text-red-600 hover:text-red-800 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Users will receive an email invitation to join the brand once it's created.
            </p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-green-800">{success}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={16} />
              <span>{isLoading ? 'Creating...' : 'Create Brand'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
