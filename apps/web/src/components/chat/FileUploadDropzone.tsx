'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, Image, AlertCircle } from 'lucide-react';

interface FileUploadDropzoneProps {
  onUpload: (files: File[]) => Promise<void>;
  onClose: () => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
}

export function FileUploadDropzone({ 
  onUpload, 
  onClose, 
  maxFiles = 5, 
  maxSize = 50 * 1024 * 1024 // 50MB
}: FileUploadDropzoneProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [errors, setErrors] = useState<string[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    const newErrors: string[] = [];
    rejectedFiles.forEach(({ file, errors }) => {
      errors.forEach((error: any) => {
        if (error.code === 'file-too-large') {
          newErrors.push(`${file.name} is too large (max ${Math.round(maxSize / 1024 / 1024)}MB)`);
        } else if (error.code === 'file-invalid-type') {
          newErrors.push(`${file.name} is not a supported file type`);
        } else {
          newErrors.push(`${file.name}: ${error.message}`);
        }
      });
    });
    setErrors(newErrors);

    if (acceptedFiles.length === 0) return;

    setUploading(true);
    
    try {
      // Simulate upload progress (in real implementation, you'd track actual progress)
      acceptedFiles.forEach((file, index) => {
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        
        const interval = setInterval(() => {
          setUploadProgress(prev => {
            const currentProgress = prev[file.name] || 0;
            if (currentProgress >= 100) {
              clearInterval(interval);
              return prev;
            }
            return { ...prev, [file.name]: Math.min(currentProgress + 10, 100) };
          });
        }, 100);
      });

      await onUpload(acceptedFiles);
      onClose();
    } catch (error) {
      console.error('Upload failed:', error);
      setErrors(prev => [...prev, 'Upload failed. Please try again.']);
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  }, [onUpload, onClose, maxSize]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles,
    maxSize,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/zip': ['.zip'],
      'application/x-rar-compressed': ['.rar'],
    }
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="h-8 w-8 text-blue-500" />;
    }
    return <File className="h-8 w-8 text-gray-500" />;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Upload Files</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
            disabled={uploading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Upload Area */}
        <div className="p-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
          >
            <input {...getInputProps()} />
            
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            
            {isDragActive ? (
              <p className="text-blue-600">Drop the files here...</p>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">
                  Drag & drop files here, or click to select
                </p>
                <p className="text-sm text-gray-500">
                  Max {maxFiles} files, up to {Math.round(maxSize / 1024 / 1024)}MB each
                </p>
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {Object.keys(uploadProgress).length > 0 && (
            <div className="mt-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Uploading...</h4>
              {Object.entries(uploadProgress).map(([filename, progress]) => (
                <div key={filename} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate">{filename}</span>
                    <span className="text-gray-500">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {errors.map((error, index) => (
                    <p key={index} className="text-sm text-red-700">{error}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Supported File Types */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Supported file types:</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Images:</strong> PNG, JPG, GIF, WebP</p>
              <p><strong>Documents:</strong> PDF, Word, Excel, PowerPoint</p>
              <p><strong>Other:</strong> Text files, CSV, ZIP, RAR</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={uploading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

