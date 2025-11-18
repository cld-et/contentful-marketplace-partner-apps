import { locations } from '@contentful/app-sdk';
import { useSDK } from '@contentful/react-apps-toolkit';
import { useEffect, useMemo } from 'react';
import ConfigScreen from './locations/ConfigScreen';
import Dialog from './locations/Dialog';
import Field from './locations/Field';
import Page from './locations/Page';
import { CldErrorEvent } from './utils';

const ComponentLocationSettings = {
  [locations.LOCATION_APP_CONFIG]: ConfigScreen,
  [locations.LOCATION_ENTRY_FIELD]: Field,
  [locations.LOCATION_DIALOG]: Dialog,
  [locations.LOCATION_PAGE]: Page,
};

const App = () => {
  const sdk = useSDK();
  useEffect(() => {
    window.addEventListener('cld-error', (event: Event) => {
      sdk.notifier.error((event as CldErrorEvent).detail.message);
    });
  }, [sdk.notifier]);
  console.log(sdk);
  const Component = useMemo(() => {
    for (const [location, component] of Object.entries(ComponentLocationSettings)) {
      if (sdk.location.is(location)) {
        return component;
      }
    }
  }, [sdk.location]);

  return Component ? <Component /> : null;
};

export default App;
