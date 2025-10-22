import { FieldAppSDK, SerializedJSONValue } from '@contentful/app-sdk';
import { AssetCard, Button, DateTime, DragHandle, Menu, MenuDivider, MenuItem } from '@contentful/f36-components';
import tokens from '@contentful/f36-tokens';
import { useSDK } from '@contentful/react-apps-toolkit';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { css } from '@emotion/react';
import { Cloudinary as cloudinaryCore } from 'cloudinary-core';
import fileSize from 'file-size';
import { useCallback, useEffect, useMemo, useState } from 'react';
import logo from '../../assets/logo.svg';
import { VALID_IMAGE_FORMATS } from '../../constants';
import { AppInstallationParameters, CloudinaryAsset, MediaLibraryResult } from '../../types';
import { extractAsset, mediaLibraryFilter, transformationTemplateBinding } from '../../utils';

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
  const [transformationBinding, setTransformationBinding] = useState<CloudinaryAsset | undefined>(undefined);
  const [cancelListeners, setCancelListeners] = useState<(() => void)[]>([]);
  const [boundUrl, setBoundUrl] = useState<string | undefined>(undefined);
  const sdk = useSDK<FieldAppSDK<AppInstallationParameters>>();

  const alt = [asset.public_id, ...(asset.tags ?? [])].join(', ');
  const url = useMemo(() => getUrlFromAsset(sdk.parameters.installation, asset), [asset, sdk.parameters.installation]);

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: asset.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleEdit = useCallback(async () => {
    const title = asset.resource_type === 'video' ? 'Trim Video' : 'Edit Image';
    const result: MediaLibraryResult | undefined = await sdk.dialogs.openCurrentApp({
      position: 'center',
      title: title,
      shouldCloseOnOverlayClick: true,
      shouldCloseOnEscapePress: true,
      width: 1400,

      parameters: {
        dialog: 'medial-editor',
        asset,
      },
    });

    if (!result) {
      return;
    }
    // assuming the user only selects one asset
    const newAsset = result.assets.map(extractAsset)[0];
    onReplace(asset, newAsset);
  }, [sdk.dialogs]);

  const handleReplace = useCallback(async () => {
    const title = asset.resource_type === 'video' ? 'Replace Video' : 'Replace Image';
    const parameters: SerializedJSONValue = {
      dialog: 'medial-library',
      filter: asset.resource_type,
      maxFiles: 1,
    };
    const expression = mediaLibraryFilter(asset.resource_type, sdk);
    if (expression) {
      parameters.expression = expression;
    }
    const result: MediaLibraryResult | undefined = await sdk.dialogs.openCurrentApp({
      position: 'center',
      title: title,
      shouldCloseOnOverlayClick: true,
      shouldCloseOnEscapePress: true,
      width: 1400,

      parameters,
    });

    if (!result) {
      return;
    }
    // assuming the user only selects one asset
    const newAsset = result.assets.map(extractAsset)[0];
    onReplace(asset, newAsset);
  }, [sdk.dialogs]);

  const onPreview = useCallback(() => {
    let url = asset.secure_url;
    if (asset.resource_type === 'video') {
      url = url.replace('f_auto', 'f_mp4');
    }
    window.open(url, '_blank');
  }, [asset.secure_url]);

  // rough implementation, for POC. should be revised if accepted.
  const onTransformBinding = useCallback(() => {
    setTransformationBinding(asset);
    const template = sdk.parameters.instance.transformationBinding;

    const updatedAsset = transformationTemplateBinding(template, asset, sdk);
    const cloudinary = new cloudinaryCore({
      cloud_name: sdk.parameters.installation.cloudName,
      api_key: sdk.parameters.installation.apiKey,
    });

    updateUrl(updatedAsset);

    function updateUrl(asset: CloudinaryAsset) {
      const transformations = updatedAsset.bound_transformation;

      // Create base options object
      const baseOptions = {
        type: asset.type,
        rawTransformation: transformations,
      };

      const options = {
        ...baseOptions,
        version: String(asset.version || 1),
      };

      const url = cloudinary.url(asset.public_id, options);
      setBoundUrl(url);
    }

    const cancelListeners = Object.entries(sdk.entry.fields).map(([name, field]) => {
      return field.onValueChanged((value) => {
        console.log(name, value);
        const updatedAsset = transformationTemplateBinding(template, asset, sdk);
        updateUrl(updatedAsset);
      });
    });
    setCancelListeners(cancelListeners);
  }, [asset]);

  useEffect(() => {
    if (transformationBinding) {
      console.log(sdk.entry.fields);
    }
  }, [transformationBinding, sdk.entry.fields]);

  const consoleUrl = `https://console.cloudinary.com/console/media_library/query_search?q=${encodeURIComponent(
    `{"userExpression":"(public_id = \\"${asset.public_id}\\")"}`,
  )}`;

  const handleOpenInCloudinary = useCallback(() => {
    window.open(consoleUrl, '_blank');
  }, [consoleUrl]);

  const pad = (n: number): string => {
    return n < 10 ? `0${n}` : `${n}`;
  };
  const playbackDuration = useCallback((asset: CloudinaryAsset) => {
    const originalDuration = asset.duration || 0;

    const rawTransformation = asset.raw_transformation;
    let duration = originalDuration;
    if (rawTransformation) {
      // Check if raw_transformation includes start (so_) or end (eo_) offsets and calculate duration accordingly
      // Regex to match so_ (start offset) and eo_ (end offset)
      const soMatch = rawTransformation.match(/so_([0-9.]+)/);
      const eoMatch = rawTransformation.match(/eo_([0-9.]+)/);

      if (soMatch || eoMatch) {
        const so = soMatch ? parseFloat(soMatch[1]) : 0;
        const eo = eoMatch ? parseFloat(eoMatch[1]) : originalDuration;
        if (!isNaN(so) && !isNaN(eo) && eo > so) {
          duration = eo - so;
        }
      }
    }
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);

    return `${pad(minutes)}:${pad(seconds)}`;
  }, []);
  if (transformationBinding) {
    return (
      <div>
        <div>Live Preview</div>
        <img src={boundUrl} alt={transformationBinding.public_id} />
        <div>{transformationBinding.bound_transformation}</div>

        <Button
          onClick={() => {
            setTransformationBinding(undefined);
            cancelListeners.forEach((cancelListener) => cancelListener());
            setCancelListeners([]);
          }}>
          Close
        </Button>
      </div>
    );
  }
  return (
    <div ref={setNodeRef}>
      <AssetCard
        style={style}
        dragHandleRender={() => <DragHandle as="button" css={styles.dragHandle} label="Move card" {...attributes} {...listeners} />}
        withDragHandle={!isDisabled}
        src={url}
        title={alt}
        type="image"
        onClick={handleEdit}
        icon={<img src={logo} alt="" width={18} height={18} />}
        size="small"
        actions={[
          <MenuItem key="edit" as="button" onClick={handleEdit}>
            Edit <span style={{ fontSize: '8px' }}>(Beta)</span>
          </MenuItem>,
          <MenuItem key="replace" onClick={handleReplace} isDisabled={isDisabled}>
            Replace
          </MenuItem>,
          <MenuItem key="remove" onClick={onDelete} isDisabled={isDisabled}>
            Remove
          </MenuItem>,
          <MenuDivider key="divider" />,
          <MenuItem key="open-in-cloudinary" as="button" onClick={handleOpenInCloudinary}>
            Open in Cloudinary
          </MenuItem>,

          <MenuItem key="preview" onClick={onPreview} isDisabled={isDisabled}>
            Preview
          </MenuItem>,
          <MenuItem key="preview" onClick={onTransformBinding} isDisabled={isDisabled}>
            Transformation Binding
          </MenuItem>,

          <MenuDivider key="divider2" />,
          <Menu.SectionTitle key="file-information-title">File information</Menu.SectionTitle>,
          <MenuItem key="file-information" css={styles.fileInformation.menuItem} isDisabled>
            <dl css={styles.fileInformation.dl}>
              <dt>Location:</dt>
              <dd>{asset.public_id?.split('/').slice(0, -1).join('/') || 'Home'}</dd>
              {asset.format && (
                <>
                  <dt>Format:</dt>
                  <dd>{asset.format}</dd>
                </>
              )}
              {asset.resource_type === 'image' && (
                <>
                  <dt>Size:</dt>
                  <dd>{fileSize(asset.bytes).human('jedec')}</dd>
                </>
              )}
              {asset.resource_type === 'video' && (
                <>
                  <dt>Playback Duration:</dt>
                  <dd>{playbackDuration(asset)}</dd>
                </>
              )}

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

  // Create base options object
  const baseOptions = {
    type: asset.type,
    rawTransformation: transformations,
  };

  const options = {
    ...baseOptions,
    version: String(asset.version || 1),
  };

  if (asset.resource_type === 'image' && VALID_IMAGE_FORMATS.includes(asset.format)) {
    return cloudinary.url(asset.public_id, options);
  }
  if (asset.resource_type === 'video') {
    const videoOptions =
      asset.version != null
        ? {
            type: asset.type,
            rawTransformation: `/h_149/f_avif,fl_animated,e_loop/${asset.raw_transformation}`,
            version: String(asset.version),
          }
        : {
            type: asset.type,
            rawTransformation: `/h_149/f_avif,fl_animated,e_loop/${asset.raw_transformation}`,
          };

    return cloudinary.video_url(asset.public_id, videoOptions);
  }
}
