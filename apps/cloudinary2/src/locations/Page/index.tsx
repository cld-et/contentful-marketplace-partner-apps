import { GlobalStyles, Header, Layout, Tabs } from '@contentful/f36-components';
import { useSDK } from '@contentful/react-apps-toolkit';
import { jwtDecode } from 'jwt-decode';
import { useEffect, useState } from 'react';
import { cldAuthenticationService } from '../../lib/cloudinary/CldAuthentication';
import { AssetLink } from './AssetLink';
import { AssetReferences } from './AssetReferences';

interface CloudinaryUserInfo {
  name?: string;
  email?: string;
  cloudName?: string;
}

const Page = () => {
  const sdk = useSDK();
  const [cloudinaryUser, setCloudinaryUser] = useState<CloudinaryUserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    const fetchCloudinaryUser = async () => {
      try {
        const token = await cldAuthenticationService.getStoredToken();
        if (token) {
          const decodedToken = jwtDecode<any>(token);
          setCloudinaryUser({
            name: decodedToken.name || decodedToken.userName || decodedToken.user_name,
            email: decodedToken.email || decodedToken.userEmail || decodedToken.user_email,
            cloudName: decodedToken.cloudName,
          });
        }
      } catch (error) {
        console.error('Failed to decode Cloudinary token:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCloudinaryUser();
  }, []);

  const contentfulUser = sdk.user;
  const contentfulName = `${contentfulUser.firstName || ''} ${contentfulUser.lastName || ''}`.trim() || 'N/A';
  const [currentTab, setCurrentTab] = useState('asset-link');

  return (
    <div style={{ height: 'calc(100% - 10px)', marginBottom: '10px' }}>
      <GlobalStyles />
      <Layout style={{ height: 'calc(100% - 10px)' }}>
        <Layout.Header style={{ borderBottom: '1px solid #e0e0e0', height: '60px' }}>
          <Header
            title="Cloudinary"
            withBackButton={true}
            onClick={() => {
              window.history.back();
            }}
          />
        </Layout.Header>
        <Layout.Body style={{ height: 'calc(100%-70px)', overflowY: 'hidden' }}>
          {/* <div style={{ maxWidth: '1532px', height: '100vh' }}> */}

          <Tabs currentTab={currentTab} onTabChange={setCurrentTab} style={{ height: '100%' }}>
            <Tabs.List>
              <Tabs.Tab panelId="asset-link">Asset Link</Tabs.Tab>
              <Tabs.Tab panelId="contentful-references">Contentful References</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel id="asset-link" style={{ height: '100%' }}>
              <AssetLink marginBottom={70} />
            </Tabs.Panel>
            <Tabs.Panel id="contentful-references">
              <AssetReferences />
            </Tabs.Panel>
            <Tabs.Panel id="third">Content for the third tab</Tabs.Panel>
          </Tabs>

          {/* </div> */}
        </Layout.Body>
      </Layout>
    </div>
  );
};

export default Page;
