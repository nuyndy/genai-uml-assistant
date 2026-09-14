// frontend/src/components/PreviewPanel/PreviewPanel.tsx
import React from 'react';
import MermaidDiagram from '../MermaidDiagram/MermaidDiagram';
import './PreviewPanel.css';

interface PreviewPanelProps {
  umlCode: string;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ umlCode }) => {
  return (
    <div className="preview-panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <span className="panel-icon">📊</span>
          <span className="panel-title">Preview</span>
        </div>
        <span className="panel-badge">Live</span>
      </div>
      
      <div className="panel-body preview-content">
        <div className="diagram-section">
          <div className="diagram-container">
            <MermaidDiagram chart={umlCode} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreviewPanel;