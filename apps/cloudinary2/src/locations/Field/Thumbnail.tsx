import { FieldAppSDK } from '@contentful/app-sdk';
import { AssetCard, DateTime, DragHandle, Menu, MenuDivider, MenuItem } from '@contentful/f36-components';
import tokens from '@contentful/f36-tokens';
import { useSDK } from '@contentful/react-apps-toolkit';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { css } from '@emotion/react';
import { Cloudinary as cloudinaryCore } from 'cloudinary-core';
import fileSize from 'file-size';
import { useCallback, useMemo } from 'react';
import logo from '../../assets/logo.svg';
import { VALID_IMAGE_FORMATS } from '../../constants';
import { AppInstallationParameters, CloudinaryAsset, MediaLibraryResult } from '../../types';
import { extractAsset } from '../../utils';

const styles = {
  dragHandle: css({
    alignSelf: 'stretch',
  }),
  fileInformation: {
    menuItem: css({
      opacity: 1,
    }),
    dl: css({
      backgroundColor: tokens.gray100,
      borderRadius: tokens.borderRadiusMedium,
      padding: tokens.spacingXs,
      width: '200px',
      lineHeight: tokens.lineHeightS,
      fontSize: tokens.fontSizeS,

      dt: {
        color: tokens.gray700,
        marginRight: tokens.spacingXs,
        paddingTop: tokens.spacing2Xs,
        paddingBottom: tokens.spacing2Xs,
        float: 'left',
        clear: 'left',
      },
      dd: {
        marginLeft: 0,
        color: tokens.gray900,
        paddingTop: tokens.spacing2Xs,
        paddingBottom: tokens.spacing2Xs,
      },
    }),
  },
  menuItemIcon: css({
    fill: tokens.gray900,
  }),
};

interface Props {
  asset: CloudinaryAsset & { id: string };
  isDisabled: boolean;
  onDelete: () => void;
  onReplace: (oldAsset: CloudinaryAsset, newAsset: CloudinaryAsset) => void;
}

export function Thumbnail({ asset, isDisabled, onDelete, onReplace }: Props) {
  const sdk = useSDK<FieldAppSDK<AppInstallationParameters>>();

  const alt = [asset.public_id, ...(asset.tags ?? [])].join(', ');
  const url = useMemo(() => getUrlFromAsset(sdk.parameters.installation, asset), [asset, sdk.parameters.installation]);

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: asset.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleReplace = useCallback(async () => {
    const result: MediaLibraryResult | undefined = await sdk.dialogs.openCurrentApp({
      position: 'center',
      title: `Edit or replace ${asset.public_id}`,
      shouldCloseOnOverlayClick: true,
      shouldCloseOnEscapePress: true,
      width: 1400,

      parameters: {
        asset: {
          resource_type: asset.resource_type,
          type: asset.type,
          public_id: asset.public_id,
        },
        maxFiles: 1,
      },
    });

    if (!result) {
      return;
    }
    // assuming the user only selects one asset
    const newAsset = result.assets.map(extractAsset)[0];
    onReplace(asset, newAsset);
  }, [sdk.dialogs]);

  const consoleUrl = `https://console.cloudinary.com/console/media_library/query_search?q=${encodeURIComponent(
    `{"userExpression":"(public_id = \\"${asset.public_id}\\")"}`,
  )}`;

  return (
    <div ref={setNodeRef}>
      <AssetCard
        style={style}
        dragHandleRender={() => <DragHandle as="button" css={styles.dragHandle} label="Move card" {...attributes} {...listeners} />}
        withDragHandle={!isDisabled}
        src={url}
        title={alt}
        type="image"
        onClick={handleReplace}
        icon={<img src={logo} alt="" width={18} height={18} />}
        size="small"
        actions={[
          <MenuItem key="edit" as="a" href={consoleUrl} target="_blank" onClick={handleReplace}>
            Edit in Cloudinary
          </MenuItem>,
          <MenuItem key="remove" onClick={onDelete} isDisabled={isDisabled}>
            Remove
          </MenuItem>,
          <MenuDivider key="divider" />,
          <Menu.SectionTitle key="file-information-title">File information</Menu.SectionTitle>,
          <MenuItem key="file-information" css={styles.fileInformation.menuItem} isDisabled>
            <dl css={styles.fileInformation.dl}>
              <dt>Location:</dt>
              <dd>{asset.public_id.split('/').slice(0, -1).join('/') || 'Home'}</dd>
              {asset.format && (
                <>
                  <dt>Format:</dt>
                  <dd>{asset.format}</dd>
                </>
              )}
              <dt>Size:</dt>
              <dd>{fileSize(asset.bytes).human('jedec')}</dd>
              {asset.width && asset.height && (
                <>
                  <dt>Dimensions:</dt>
                  <dd>
                    {asset.width} x {asset.height} px
                  </dd>
                </>
              )}
              <dt>Created on:</dt>
              <dd>
                <DateTime date={asset.created_at} format="day" />
              </dd>
            </dl>
          </MenuItem>,
        ]}
      />
    </div>
  );
}

function getUrlFromAsset(installationParams: AppInstallationParameters, asset: CloudinaryAsset): string | undefined {
  const cloudinary = new cloudinaryCore({
    cloud_name: installationParams.cloudName,
    api_key: installationParams.apiKey,
  });

  const transformations = `${asset.raw_transformation ?? ''}/c_fill,g_auto,h_149,w_194`;
  if (asset.resource_type === 'image' && VALID_IMAGE_FORMATS.includes(asset.format)) {
    return cloudinary.url(asset.public_id, {
      type: asset.type,
      rawTransformation: transformations,
      version: String(asset.version),
    });
  }
  if (asset.resource_type === 'video') {
    return cloudinary.video_url(asset.public_id, {
      type: asset.type,
      rawTransformation: `/h_149/f_avif,fl_animated,e_loop/${asset.raw_transformation}`,
      version: String(asset.version),
    });
  }
}
