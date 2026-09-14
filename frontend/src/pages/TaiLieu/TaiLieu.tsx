// frontend/src/pages/TaiLieu/TaiLieu.tsx
import React from 'react';

const TaiLieu: React.FC = () => {
  const docs = [
    { id: 1, icon: '📘', title: 'Hướng dẫn sử dụng', desc: 'Cách sử dụng hệ thống GenAI UML' },
    { id: 2, icon: '📗', title: 'API Documentation', desc: 'Tài liệu API cho developers' },
    { id: 3, icon: '📕', title: 'Mermaid Guide', desc: 'Hướng dẫn viết Mermaid diagram' },
  ];

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="page-icon">📖</div>
        <h2 className="page-title">Tài Liệu</h2>
        <p className="page-desc">Hướng dẫn sử dụng và tài liệu tham khảo</p>
        <div className="docs-list">
          {docs.map((item) => (
            <div key={item.id} className="doc-item">
              <div className="doc-icon">{item.icon}</div>
              <div className="doc-info">
                <h3 className="doc-title">{item.title}</h3>
                <p className="doc-desc">{item.desc}</p>
              </div>
              <span className="doc-arrow">→</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TaiLieu;