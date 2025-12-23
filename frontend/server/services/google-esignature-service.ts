/**
 * Google E-Signature Service
 * Integrates with Google Docs API to create signable documents
 * Uses Google Drive API for document storage and sharing
 * Creates user-specific folders in their Google Drive
 * Supports multiple document types: split_sheet, quote, contract, invoice, wedding_timeline, photo_enhancement
 */

import { google } from 'googleapis';

// Use existing Google Drive service
// Note: This service uses user-specific OAuth tokens, so folders are created in each user's Drive
let GoogleDriveService: any = null;
try {
  const driveServiceModule = require('../../google-workspace/google-drive-service');
  GoogleDriveService = driveServiceModule.GoogleDriveService || driveServiceModule.default;
} catch (e) {
  console.warn('Google Drive service not available:', e);
}

export type DocumentType = 
  | 'split_sheet' 
  | 'quote' 
  | 'contract' 
  | 'invoice' 
  | 'wedding_timeline' 
  | 'photo_enhancement';

interface Signer {
  name: string;
  email: string;
  role?: string;
  percentage?: number;
  [key: string]: any; // Allow additional fields
}

interface GoogleESignatureOptions {
  documentType: DocumentType;
  documentId: string;
  documentTitle: string;
  signers: Signer[];
  userId: string;
  pdfBuffer: Buffer; // PDF buffer to convert to Google Doc
  folderName?: string; // Optional custom folder name (defaults based on documentType)
  emailMessage?: string; // Optional custom email message
}

// Legacy interface for backward compatibility
interface LegacyGoogleESignatureOptions {
  splitSheetId: string;
  splitSheetTitle: string;
  contributors: Array<{
    name: string;
    email: string;
    role: string;
    percentage: number;
  }>;
  userId: string;
}

interface GoogleESignatureResult {
  documentId: string;
  documentUrl: string;
  shareUrl: string;
  status: 'created' | 'shared' | 'signed';
}

/**
 * Get folder name based on document type
 */
function getFolderName(documentType: DocumentType, customFolderName?: string): string {
  if (customFolderName) {
    return customFolderName;
  }

  const folderNames: Record<DocumentType, string> = {
    split_sheet: 'Split Sheets',
    quote: 'Quotes & Proposals',
    contract: 'Contracts',
    invoice: 'Invoices',
    wedding_timeline: 'Wedding Contracts',
    photo_enhancement: 'Service Contracts',
  };

  return folderNames[documentType] || 'Documents';
}

/**
 * Get or create user-specific folder for document type
 * This creates a folder in the user's own Google Drive
 */
async function getOrCreateDocumentFolder(
  userId: string, 
  documentType: DocumentType,
  customFolderName?: string
): Promise<string> {
  if (!GoogleDriveService) {
    throw new Error('Google Drive service not available. Please ensure Google Drive integration is configured.');
  }

  const driveService = new GoogleDriveService();
  await driveService.initializeDriveAPI(userId);

  const folderName = getFolderName(documentType, customFolderName);
  
  // Find or create folder in user's root Drive
  // This will be in the user's own Google Drive, not a shared folder
  const folder = await driveService.findOrCreateFolder(folderName, null);
  return folder.id;
}

/**
 * Get Google Drive and Docs clients using user's authentication
 */
async function getGoogleClients(userId: string) {
  if (!GoogleDriveService) {
    throw new Error('Google Drive service not available');
  }

  const driveService = new GoogleDriveService();
  await driveService.initializeDriveAPI(userId);

  // Access drive client through the service (using type assertion to access private property)
  // This is necessary for Google Docs API operations
  const drive = (driveService as any).drive;
  if (!drive) {
    throw new Error('Google Drive client not initialized');
  }

  // Create docs client using the same auth
  const { google } = require('googleapis');
  const docs = google.docs({ version: 'v1', auth: drive.auth });
  
  return { drive, docs, driveService };
}

/**
 * Create a signable Google Doc from PDF (generalized for all document types)
 */
export async function createSignableGoogleDocFromPDF(
  options: GoogleESignatureOptions
): Promise<GoogleESignatureResult> {
  const { 
    documentType, 
    documentId, 
    documentTitle, 
    signers, 
    userId, 
    pdfBuffer,
    folderName,
    emailMessage 
  } = options;

  try {
    const { drive, docs, driveService } = await getGoogleClients(userId);
    
    // Get or create user-specific folder for document type
    const folderId = await getOrCreateDocumentFolder(userId, documentType, folderName);

    // Generate document name based on type
    const documentNameMap: Record<DocumentType, string> = {
      split_sheet: 'Split Sheet',
      quote: 'Quote',
      contract: 'Contract',
      invoice: 'Invoice',
      wedding_timeline: 'Wedding Contract',
      photo_enhancement: 'Service Contract',
    };
    const docTypeName = documentNameMap[documentType] || 'Document';

    // Upload PDF reference copy (optional)
    try {
      const fileMetadata = {
        name: `${documentTitle}_${docTypeName}.pdf`,
        mimeType: 'application/pdf',
        parents: [folderId],
      };

      await drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType: 'application/pdf',
          body: pdfBuffer,
        },
        fields: 'id',
      });
    } catch (uploadError) {
      console.warn('Could not upload PDF reference copy:', uploadError);
      // Continue with Google Doc creation even if PDF upload fails
    }

    // Convert PDF to Google Doc for signing (using Drive API import)
    const docMetadata = {
      name: `${documentTitle}_${docTypeName}_Signable`,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId],
    };

    // Import PDF as Google Doc
    const importedDoc = await drive.files.create({
      requestBody: docMetadata,
      media: {
        mimeType: 'application/pdf',
        body: pdfBuffer,
      },
      fields: 'id, name, webViewLink',
    });

    const docId = importedDoc.data.id!;
    const docUrl = importedDoc.data.webViewLink!;

    // Add signature fields to the document
    await addSignatureFieldsToDoc(docs, docId, signers, documentType);

    // Default email message if not provided
    const defaultEmailMessage = emailMessage || 
      `Hei,\n\nDu er invitert til å signere ${docTypeName.toLowerCase()}: ${documentTitle}\n\nKlikk på lenken for å se og signere dokumentet:\n${docUrl}\n\nMed vennlig hilsen,\nCreatorHub Norge`;

    // Share document with signers
    const sharePromises = signers.map(async (signer) => {
      if (signer.email) {
        try {
          await drive.permissions.create({
            fileId: docId,
            requestBody: {
              role: 'commenter', // Allow commenting (signing)
              type: 'user',
              emailAddress: signer.email,
            },
            sendNotificationEmail: true,
            emailMessage: defaultEmailMessage.replace('Hei,', `Hei ${signer.name},`),
          });
        } catch (shareError) {
          console.warn(`Could not share with ${signer.email}:`, shareError);
          // Continue with other signers even if one fails
        }
      }
    });

    await Promise.all(sharePromises);

    return {
      documentId: docId,
      documentUrl: docUrl,
      shareUrl: docUrl,
      status: 'shared',
    };
  } catch (error) {
    console.error('Error creating Google Doc for e-signature:', error);
    throw error;
  }
}

/**
 * Legacy function for backward compatibility with split sheets
 * @deprecated Use createSignableGoogleDocFromPDF instead
 */
export async function createGoogleDocFromSplitSheet(
  options: LegacyGoogleESignatureOptions
): Promise<GoogleESignatureResult> {
  // Import split sheet PDF service dynamically
  const { generateSplitSheetPDF } = await import('./split-sheet-pdf-service');
  
  // Generate PDF first
  const pdfBuffer = await generateSplitSheetPDF(options.splitSheetId, {
    includeSignatures: false,
    includeRevenue: false,
    template: 'standard',
  });

  // Convert to new format
  const newOptions: GoogleESignatureOptions = {
    documentType: 'split_sheet',
    documentId: options.splitSheetId,
    documentTitle: options.splitSheetTitle,
    signers: options.contributors.map(c => ({
      name: c.name,
      email: c.email,
      role: c.role,
      percentage: c.percentage,
    })),
    userId: options.userId,
    pdfBuffer,
  };

  return createSignableGoogleDocFromPDF(newOptions);
}

/**
 * Add signature fields to Google Doc (generalized for all document types)
 */
async function addSignatureFieldsToDoc(
  docs: any,
  documentId: string,
  signers: Signer[],
  documentType: DocumentType = 'split_sheet'
): Promise<void> {
  try {
    // Get document content to find end of document
    const document = await docs.documents.get({
      documentId,
    });

    // Find the end of the document
    const endIndex = document.data.body?.content?.[document.data.body.content.length - 1]?.endIndex || 1;

    // Add signature section at the end
    const requests: any[] = [];

    // Insert signature section header
    requests.push({
      insertText: {
        location: {
          index: endIndex - 1,
        },
        text: '\n\n\n--- SIGNATURES ---\n\n',
      },
    });

    // Add signature fields for each signer
    signers.forEach((signer, index) => {
      let signatureText = '';
      
      // Format signature based on document type
      if (documentType === 'split_sheet' && signer.role && signer.percentage !== undefined) {
        signatureText = `
${signer.name} (${signer.role}) - ${signer.percentage}%
Signature: _________________________
Date: _________________________
Email: ${signer.email}

`;
      } else if (signer.role) {
        signatureText = `
${signer.name} (${signer.role})
Signature: _________________________
Date: _________________________
Email: ${signer.email}

`;
      } else {
        signatureText = `
${signer.name}
Signature: _________________________
Date: _________________________
Email: ${signer.email}

`;
      }

      requests.push({
        insertText: {
          location: {
            index: endIndex - 1,
          },
          text: signatureText,
        },
      });
    });

    // Apply requests
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests,
        },
      });
    }
  } catch (error) {
    console.error('Error adding signature fields to Google Doc:', error);
    // Continue even if signature fields fail
  }
}

/**
 * Check if document has been signed (by checking comments or document updates)
 */
export async function checkGoogleDocSignatureStatus(
  documentId: string,
  userId: string
): Promise<{
  signed: boolean;
  signatures: Array<{ name: string; signedAt: string }>;
}> {
  try {
    const { drive } = await getGoogleClients(userId);

    // Get document revisions to check for updates
    const revisions = await drive.revisions.list({
      fileId: documentId,
      pageSize: 10,
    });

    // Get document comments (signatures might be in comments)
    const comments = await drive.comments.list({
      fileId: documentId,
      fields: 'comments(author,content,createdTime)',
    });

    const signatures: Array<{ name: string; signedAt: string }> = [];

    // Parse comments for signatures
    if (comments.data.comments) {
      comments.data.comments.forEach((comment: any) => {
        if (comment.content && comment.content.includes('Signed')) {
          signatures.push({
            name: comment.author?.displayName || 'Unknown',
            signedAt: comment.createdTime || new Date().toISOString(),
          });
        }
      });
    }

    return {
      signed: signatures.length > 0,
      signatures,
    };
  } catch (error) {
    console.error('Error checking Google Doc signature status:', error);
    return {
      signed: false,
      signatures: [],
    };
  }
}

/**
 * Create Google Doc and return shareable link (generalized)
 */
export async function createSignableGoogleDoc(
  options: GoogleESignatureOptions
): Promise<string> {
  const result = await createSignableGoogleDocFromPDF(options);
  return result.shareUrl;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use createSignableGoogleDoc with new options format
 */
export async function createSignableGoogleDocLegacy(
  options: LegacyGoogleESignatureOptions
): Promise<string> {
  const result = await createGoogleDocFromSplitSheet(options);
  return result.shareUrl;
}























