/**
 * Drive Files Panel
 * Displays contract files from Google Drive with management options
 */

import React, { useState, useEffect } from 'react';
import type { SyncJob } from '../../services/contract-drive-sync';
import { contractDriveSync } from '../../services/contract-drive-sync';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink: string;
  webContentLink: string;
  size: string;
}

interface DriveFilesPanelProps {
  projectId: string;
  onFileShared?: (fileId: string) => void;
}

export const DriveFilesPanel: React.FC<DriveFilesPanelProps> = ({ projectId, onFileShared }) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [clientEmail, setClientEmail] = useState('');
  const [sharingInProgress, setSharingInProgress] = useState(false);

  // Subscribe to sync job updates
  useEffect(() => {
    const unsubscribe = contractDriveSync.subscribe((jobs) => {
      setSyncJobs(jobs);
      // Refresh file list when uploads complete
      const hasNewSuccess = jobs.some(
        (job) => job.status === 'success' && job.projectId === projectId
      );
      if (hasNewSuccess) {
        fetchFiles();
      }
    });

    return unsubscribe;
  }, [projectId]);

  // Fetch files on mount
  useEffect(() => {
    fetchFiles();
  }, [projectId]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/google/drive/contracts/${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch files');
      const data = await response.json();
      setFiles(data.contracts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedFileId || !clientEmail) return;

    try {
      setSharingInProgress(true);
      const response = await fetch(`/api/google/drive/contracts/${selectedFileId}/share`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ clientEmail }),
      });

      if (!response.ok) throw new Error('Failed to share file');

      onFileShared?.(selectedFileId);
      setShareDialogOpen(false);
      setClientEmail(', ');
      setSelectedFileId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to share file');
    } finally {
      setSharingInProgress(false);
    }
  };

  const openShareDialog = (fileId: string) => {
    setSelectedFileId(fileId);
    setShareDialogOpen(true);
  };

  const formatFileSize = (bytes: string | number): string => {
    const numBytes = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (isNaN(numBytes)) return 'Unknown';
    if (numBytes < 1024) return `${numBytes} B`;
    if (numBytes < 1024 * 1024) return `${(numBytes / 1024).toFixed(1)} KB`;
    return `${(numBytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit' });
  };

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('presentation')) return '📽️';
    return '📎';
  };

  const getSyncStatusBadge = (job: SyncJob) => {
    const badges: Record<string, React.ReactNode> = {
      idle: (
        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">⏸️ Idle</span>
      ),
      pending: (
        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">⏳ Pending</span>
      ),
      uploading: (
        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
          ⬆️ Uploading {job.progress}%
        </span>
      ),
      success: (
        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">✅ Uploaded</span>
      ),
      error: (
        <span
          className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded cursor-pointer"
          onClick={() => contractDriveSync.retryJob(job.id)}
        >
          ❌ Failed (Click to retry)
        </span>
      ),
    };
    return badges[job.status] || null;
  };

  if (loading && files.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="ml-3 text-gray-600">Loading files...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">📁 Google Drive Files</h3>
            <p className="text-sm text-gray-500 mt-1">Contracts & Documents for this project</p>
          </div>
          <button
            onClick={fetchFiles}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Sync Status Jobs */}
      {syncJobs.length > 0 && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="space-y-2">
            {syncJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200"
              >
                <div className="flex items-center space-x-3 flex-1">
                  <span className="text-2xl">{getFileIcon(job.file.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{job.file.name}</p>
                    {job.error && <p className="text-xs text-red-600 mt-1">{job.error}</p>}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getSyncStatusBadge(job)}
                  {job.status !== 'success' && (
                    <button
                      onClick={() => contractDriveSync.cancelJob(job.id)}
                      className="text-xs text-gray-500 hover:text-red-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => contractDriveSync.clearCompleted()}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear completed
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <p className="text-sm text-red-600">❌ {error}</p>
        </div>
      )}

      {/* Files List */}
      <div className="divide-y divide-gray-200">
        {files.length === 0 && !loading ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-lg mb-2">📂 No files yet</p>
            <p className="text-sm">
              Export a contract with "Upload to Drive" enabled to see files here
            </p>
          </div>
        ) : (
          files.map((file) => (
            <div key={file.id} className="p-4 hover:bg-gray-50 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0">{getFileIcon(file.mimeType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500">{formatDate(file.createdTime)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <a
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                  >
                    👁️ View
                  </a>
                  <button
                    onClick={() => openShareDialog(file.id)}
                    className="px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition"
                  >
                    📤 Share
                  </button>
                  {file.webContentLink && (
                    <a
                      href={file.webContentLink}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                    >
                      ⬇️ Download
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Share Dialog */}
      {shareDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Share Contract</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Email Address
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus: ring-2 focus:ring-blue-500, focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  The client will receive view access to this file in Google Drive
                </p>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShareDialogOpen(false);
                    setClientEmail('');
                    setSelectedFileId(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  disabled={sharingInProgress}
                >
                  Cancel
                </button>
                <button
                  onClick={handleShare}
                  disabled={!clientEmail || sharingInProgress}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover: bg-blue-700 disabled:opacity-50, disabled:cursor-not-allowed"
                >
                  {sharingInProgress ? 'Sharing...' : 'Share File'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
