// frontend/src/pages/SinhUML/SinhUML.tsx
import React, { useState } from 'react';
import CodePanel from '../../components/CodePanel/CodePanel';
import PreviewPanel from '../../components/PreviewPanel/PreviewPanel';
import './SinhUML.css';

const SinhUML: React.FC = () => {
  const [umlCode, setUmlCode] = useState(`---
config:
  layout: elk
---
sequenceDiagram
    participant NguoiDung
    participant App as App/Website
    participant GoogleAuth as Google Auth
    participant Server

    User->>App: Click "Login with Google"
    App->>GoogleAuth: Redirect to Google login
    GoogleAuth->>User: Show login page
    User->>GoogleAuth: Enter email & password
    GoogleAuth->>GoogleAuth: Verify credentials
    GoogleAuth->>User: Show consent screen
    User->>GoogleAuth: Approve permissions
    GoogleAuth->>App: Redirect with auth code
    App->>GoogleAuth: Exchange code for token
    GoogleAuth->>App: Return access token
    App->>Server: Send token & user info
    Server->>Server: Validate token
    Server->>Server: Create/update user session
    Server->>App: Return session
    App->>User: Redirect to dashboard
    User->>User: Logged in successfully`);

  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`sinhuml-container ${isCollapsed ? 'collapsed-mode' : ''}`}>
      <CodePanel 
        umlCode={umlCode} 
        setUmlCode={setUmlCode}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
        onDocsClick={() => {
          window.dispatchEvent(new CustomEvent('tabChange', { detail: 'Tài Liệu' }));
        }}
      />
      
      <PreviewPanel umlCode={umlCode} />
    </div>
  );
};

export default SinhUML;