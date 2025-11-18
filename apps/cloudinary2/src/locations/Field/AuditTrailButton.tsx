import { FieldAppSDK } from '@contentful/app-sdk';

import { useSDK } from '@contentful/react-apps-toolkit';

import { IconButton, Menu } from '@contentful/f36-components';
import { ReceiptIcon } from '@contentful/f36-icons';
import { AppInstallationParameters } from '../../types';

export function AuditTrailButton() {
  const sdk = useSDK<FieldAppSDK<AppInstallationParameters>>();
  const auditTrailEnabled = sdk.parameters.installation.assetAuditTrailEnabled === 'true';
  // const color = auditTrailEnabled ? 'var(--cds-color-fg-success)' : 'var(--cds-color-fg-muted)';

  return (
    <Menu>
      <Menu.Trigger>
        <IconButton variant="transparent" icon={<ReceiptIcon />} aria-label="toggle menu" />
      </Menu.Trigger>
      <Menu.List>
        <Menu.Item>Logged in as {sdk.parameters.installation.cloudName}</Menu.Item>
        <Menu.Item>Log out</Menu.Item>
      </Menu.List>
    </Menu>
  );
}
