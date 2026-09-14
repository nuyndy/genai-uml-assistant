// frontend/src/pages/CaiDat/CaiDat.tsx
import React, { useState } from 'react';

const CaiDat: React.FC = () => {
  const [language, setLanguage] = useState('vi');
  const [apiEndpoint, setApiEndpoint] = useState('http://localhost:8000');

  const handleSave = () => {
    alert('Đã lưu cài đặt!');
  };

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="page-icon">🔧</div>
        <h2 className="page-title">Cài Đặt</h2>
        <p className="page-desc">Cấu hình và tùy chỉnh hệ thống</p>
        <div className="settings-box">
          <div className="setting-item">
            <div className="setting-info">
              <p className="setting-label">Ngôn ngữ</p>
              <p className="setting-desc">Chọn ngôn ngữ hiển thị</p>
            </div>
            <select 
              className="setting-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </div>
          
          <div className="setting-item">
            <div className="setting-info">
              <p className="setting-label">Theme</p>
              <p className="setting-desc">Chọn giao diện</p>
            </div>
            <div className="theme-colors">
              <button className="theme-dot theme-dark active"></button>
              <button className="theme-dot theme-light"></button>
              <button className="theme-dot theme-blue"></button>
            </div>
          </div>
          
          <div className="setting-item">
            <div className="setting-info">
              <p className="setting-label">API Endpoint</p>
              <p className="setting-desc">Địa chỉ backend API</p>
            </div>
            <input 
              type="text" 
              className="setting-input"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
            />
          </div>
          
          <button className="btn-save" onClick={handleSave}>
            Lưu cài đặt
          </button>
        </div>
      </div>
    </div>
  );
};

export default CaiDat;