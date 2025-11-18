import { FieldAppSDK, SerializedJSONValue } from '@contentful/app-sdk';
import { Button, ButtonGroup, IconButton, Menu } from '@contentful/f36-components';
import { CaretDownIcon, ImageSquareIcon, VideoIcon } from '@contentful/f36-icons';
import { useSDK } from '@contentful/react-apps-toolkit';
import { css } from '@emotion/react';
import { useCallback } from 'react';
import logo from '../../assets/logo.svg';
import { AuditTrail } from '../../lib/cloudinary/AuditTrailApi';
import { cldAuthenticationService } from '../../lib/cloudinary/CldAuthentication';
import { AppInstallationParameters, CloudinaryAsset, MediaLibraryResult, ResourceTypeFilter } from '../../types';
import { extractAsset, mediaLibraryFilter } from '../../utils';
import { AuditTrailButton } from './AuditTrailButton';
const styles = {
  logo: css({
    display: 'block',
    width: '16px',
    height: '16px',
  }),
};

interface Props {
  onNewAssetsAdded: (assets: CloudinaryAsset[]) => void;
  isDisabled: boolean;
}

export function AssetPickerButton({ onNewAssetsAdded, isDisabled }: Props) {
  const sdk = useSDK<FieldAppSDK<AppInstallationParameters>>();
  const resourceType = sdk.parameters.instance.resourceType as ResourceTypeFilter;

  const action = sdk.parameters.installation.showUploadButton === 'true' ? `Select or upload an Asset` : `Select an Asset`;
  const handleDialogOpenClick = useCallback(
    async (type?: string) => {
      if (sdk.parameters.installation.assetAuditTrailEnabled === 'true') {
        let token = await cldAuthenticationService.getStoredToken();
        if (!token) {
          await cldAuthenticationService.login();
        }
        const installCloud = sdk.parameters.installation.cloudName;

        const authenticatedCloud = await cldAuthenticationService.getCloudName();
        if (installCloud !== authenticatedCloud) {
          await cldAuthenticationService.logout();
          sdk.notifier.error(
            `you tried to log in with [${authenticatedCloud}] but the installation is configured to use [${installCloud}]. please login to [${installCloud}] instead to continue`,
          );
          return;
        }
      }

      const expression = mediaLibraryFilter(type || '', sdk);
      const parameters: SerializedJSONValue = {};
      if (expression) {
        parameters.expression = expression;
      }
      const result: MediaLibraryResult | undefined = await sdk.dialogs.openCurrentApp({
        position: 'center',
        title: `${action} on Cloudinary`,
        shouldCloseOnOverlayClick: true,
        shouldCloseOnEscapePress: true,
        width: 1400,
        parameters,
      });

      if (!result) {
        return;
      }

      const assetsToPersist = result.assets.map(extractAsset);
      if (sdk.parameters.installation.assetAuditTrailEnabled === 'true') {
        const accessToken = await cldAuthenticationService.getStoredToken();
        if (accessToken) {
          const auditTrailApi = new AuditTrail({
            sdk,
            accessToken,
          });

          assetsToPersist.forEach((asset) => {
            auditTrailApi.manage({
              asset,
              action: 'add',
            });
          });
        }
      }
      onNewAssetsAdded(assetsToPersist);
    },
    [onNewAssetsAdded, sdk.dialogs],
  );
  if (resourceType === 'image') {
    return (
      <>
        <Button
          startIcon={<img src={logo} alt="Logo" css={styles.logo} />}
          variant="secondary"
          size="small"
          onClick={() => handleDialogOpenClick('image')}
          isDisabled={isDisabled}>
          Select an Image
        </Button>
        <AuditTrailButton />
      </>
    );
  } else if (resourceType === 'video') {
    return (
      <>
        <Button
          startIcon={<img src={logo} alt="Logo" css={styles.logo} />}
          variant="secondary"
          size="small"
          onClick={() => handleDialogOpenClick('video')}
          isDisabled={isDisabled}>
          Select a Video
        </Button>
        <AuditTrailButton />
      </>
    );
  } else if (resourceType === 'all') {
    return (
      <>
        <ButtonGroup withDivider>
          <Button
            startIcon={<img src={logo} alt="Logo" css={styles.logo} />}
            variant="secondary"
            size="small"
            onClick={() => handleDialogOpenClick()}
            isDisabled={isDisabled}
            style={{ border: '1px solid rgb(207, 217, 224)' }}>
            Select an Asset
          </Button>
          <Menu placement="bottom-end">
            <Menu.Trigger>
              <IconButton
                variant="secondary"
                icon={<CaretDownIcon />}
                aria-label="toggle menu"
                size="small"
                style={{ borderTopLeftRadius: '0px', borderBottomLeftRadius: 0 }}
              />
            </Menu.Trigger>
            <Menu.List>
              <Menu.Item icon={<ImageSquareIcon />} onClick={() => handleDialogOpenClick('image')}>
                Select an Image
              </Menu.Item>
              <Menu.Item icon={<VideoIcon />} onClick={() => handleDialogOpenClick('video')}>
                Select a Video
              </Menu.Item>
            </Menu.List>
          </Menu>
        </ButtonGroup>
        <AuditTrailButton />
      </>
    );
  }
}
