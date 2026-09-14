// frontend/src/components/Navigation/Navigation.tsx
import React from 'react';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const menuItems = [
    { id: 'Home', label: 'Trang chủ'},
    { id: 'Sinh UML', label: 'Sinh UML'},
    { id: 'Case Study', label: 'Case Study'},
    { id: 'Đánh Giá', label: 'Đánh Giá'},
    { id: 'Tài Liệu', label: 'Tài Liệu'},
    { id: 'Cài Đặt', label: 'Cài Đặt'}
  ];

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="logo">
          <span className="logo-text">GenAI UML Workspace</span>
        </div>
        <ul className="nav-menu">
          {menuItems.map((item) => (
            <li key={item.id} className="nav-item">
              <button
                className={`nav-link ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => onTabChange(item.id)}
              >
                <span className="nav-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="nav-status">
          <span className="status-dot"></span>
          <span className="status-text">Backend Connected</span>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;