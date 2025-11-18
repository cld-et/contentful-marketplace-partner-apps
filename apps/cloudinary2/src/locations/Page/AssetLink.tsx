import { PageAppSDK } from '@contentful/app-sdk';
import { useSDK } from '@contentful/react-apps-toolkit';
import { injectGlobal } from '@emotion/css';
import { useCallback } from 'react';
import { APP_ENV, APP_VERSION } from '../../constants';
import { AppInstallationParameters } from '../../types';
import { loadScript } from '../../utils';
import { ShowOptions } from '../types';

interface AssetLinkProps {
  marginBottom: number;
}
export function AssetLink(props: AssetLinkProps) {
  const { marginBottom } = props;
  const sdk = useSDK<PageAppSDK<AppInstallationParameters>>();

  /**
   * Initialization is triggered using the div's ref to ensure the container exists in the DOM
   */
  const init = useCallback(
    (container: HTMLDivElement) => {
      (async () => {
        await loadScript('https://media-library.cloudinary.com/global/all.js');
        // clear container
        container.innerHTML = '';
        // style `body`
        injectGlobal({
          'html, body, #root': {
            padding: 0,
            margin: 0,
            border: 0,
            height: '100%',
            overflow: 'hidden',
          },
        });

        const configurationParams = sdk.parameters.installation;
        // allow local instances of the dialog to override the configuration maxFiles parameter

        const transformations = [];

        // Handle format
        if (configurationParams.format !== 'none') {
          transformations.push({ fetch_format: configurationParams.format });
        }

        // Handle quality
        if (configurationParams.quality !== 'none') {
          transformations.push({ quality: configurationParams.quality });
        }

        const options = {
          max_files: 100,
          cloud_name: configurationParams.cloudName,
          api_key: configurationParams.apiKey,

          multiple: true,
          // if we pass `container` instead of the id, the media library would render without iframe
          inline_container: `#${container.id}`,
          remove_header: true,
          default_transformations: [transformations],
          insert_caption: 'Copy to Contentful',
          remove_upload_operation: true,
          integration: {
            platform: 'contentful',
            type: 'contentful',
            version: APP_VERSION,
            environment: APP_ENV,
          },
        };

        const instance = window.cloudinary.createMediaLibrary(options, {
          // In your insertHandler at line 70, you could do:
          insertHandler: async (data) => {
            // await Promise.all(data.assets.map(assetLinkToContentful));
            // For each Cloudinary asset, create a Contentful asset
            for (const cloudinaryAsset of data.assets) {
              try {
                // Step 1: Create the asset with metadata
                const asset = await sdk.cma.asset.createWithId(
                  { spaceId: sdk.ids.space, environmentId: sdk.ids.environment, assetId: cloudinaryAsset.id },

                  {
                    fields: {
                      title: {
                        'en-US': cloudinaryAsset.public_id,
                      },
                      description: {
                        'en-US': `Cloudinary asset: ${cloudinaryAsset.public_id}`,
                      },
                      file: {
                        'en-US': {
                          contentType: `${cloudinaryAsset.resource_type}/${cloudinaryAsset.format}`,
                          fileName: `${cloudinaryAsset.public_id}.${cloudinaryAsset.format}`,
                          upload: cloudinaryAsset.secure_url, // Contentful will download from this URL
                        },
                      },
                    },
                  },
                );

                // Step 2: Process the asset (required after upload)
                await sdk.cma.asset.processForAllLocales({ spaceId: sdk.ids.space, environmentId: sdk.ids.environment }, asset);

                console.log('Asset created:', asset.sys.id);
              } catch (error) {
                console.error('Failed to create asset:', error);
              }
            }
          },
        });

        const showOptions: ShowOptions = {
          remove_upload_operation: true,
        };

        instance.show(showOptions);
      })();
    },
    [sdk],
  );

  return <div ref={init} id="container" style={{ height: `calc(100% - ${marginBottom}px)` }} />;
}
