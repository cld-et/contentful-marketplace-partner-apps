import { EntryAPI, FieldAppSDK } from '@contentful/app-sdk';
import { CLOUDINARY_API_GATEWAY_BASE_URL } from '../../constants';
import { AppInstallationParameters, CloudinaryAsset } from '../../types';
import { evaluator } from '../../utils';

export interface TaggingContext extends Record<string, unknown> {
  entry: EntryAPI;
  audit: {
    userId?: string;
    entryId?: string;
    timestamp: number;
    action: 'add' | 'remove' | 'replace';
  };
}

export interface AssetAuditTrail {
  asset: CloudinaryAsset;
  // resource_type: 'image' | 'video' | 'raw';
  // public_ids: string[];
  // tag: string;
  action: 'add' | 'remove' | 'replace';
}

interface TaggingRequest {
  public_ids: string[];
  tag: string;
  command: 'add' | 'remove' | 'replace';
}
export interface TagManagementResponse {
  public_ids: string[];
}

export interface AuditTrailOptions {
  sdk: FieldAppSDK<AppInstallationParameters>;
  baseUrl?: string;
  accessToken: string;
}

/**
 * Proxy class for Cloudinary API operations
 * Handles authenticated requests to Cloudinary backend services
 */
export class AuditTrail {
  private baseUrl: string;

  private accessToken: string;
  sdk: FieldAppSDK<AppInstallationParameters>;
  cloudName: string;

  constructor(options: AuditTrailOptions) {
    this.baseUrl = options.baseUrl || CLOUDINARY_API_GATEWAY_BASE_URL;
    this.sdk = options.sdk;
    this.cloudName = this.sdk.parameters.installation.cloudName;
    this.accessToken = options.accessToken;
  }

  async manage(options: AssetAuditTrail): Promise<void> {
    let context = {
      entry: this.sdk.entry,
      audit: {
        userId: this.sdk.entry.getSys().createdBy?.sys.id,
        timestamp: Math.floor(Date.now() / 1000),
        action: options.action,
        entryId: this.sdk.entry.getSys().id,
      },
    };
    this.tagAsset(options, context);
    // this.logAuditTrail(options, context);
  }

  // async logAuditTrail(options: AssetAuditTrail, context: TaggingContext): Promise<void> {

  // }

  async tagAsset(options: AssetAuditTrail, context: TaggingContext): Promise<void> {
    const tagTemplate = this.sdk.parameters.installation.assetAuditTag;
    const tag = evaluator(tagTemplate, context);
    const resourceType = options.asset.resource_type;

    const request: TaggingRequest = {
      public_ids: [options.asset.public_id],
      tag: tag,
      command: options.action,
    };
    try {
      const url = `${this.baseUrl}/cloudinary/upload/${this.cloudName}/${resourceType}/tags`;

      // Make the API request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tag management failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`Failed to manage tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
