// frontend/src/pages/CaseStudy/CaseStudy.tsx
import React from 'react';

const CaseStudy: React.FC = () => {
  const cases = [
    { id: 1, icon: '🏦', title: 'Banking System', desc: 'Hệ thống ngân hàng' },
    { id: 2, icon: '🛒', title: 'E-Commerce', desc: 'Hệ thống bán hàng' },
    { id: 3, icon: '🏥', title: 'Hospital Management', desc: 'Quản lý bệnh viện' },
    { id: 4, icon: '🎓', title: 'School System', desc: 'Quản lý trường học' },
  ];

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="page-icon">📚</div>
        <h2 className="page-title">Case Study</h2>
        <p className="page-desc">Thư viện các case study mẫu</p>
        <div className="case-grid">
          {cases.map((item) => (
            <div key={item.id} className="case-card">
              <div className="case-icon">{item.icon}</div>
              <h3 className="case-title">{item.title}</h3>
              <p className="case-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CaseStudy;