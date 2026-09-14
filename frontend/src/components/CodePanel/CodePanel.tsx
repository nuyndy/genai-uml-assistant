// frontend/src/components/CodePanel/CodePanel.tsx
import * as React from 'react';
import { useRef, useEffect } from 'react';
import './CodePanel.css';

interface CodePanelProps {
  umlCode: string;
  setUmlCode: React.Dispatch<React.SetStateAction<string>>;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onDocsClick: () => void;
}

const CodePanel: React.FC<CodePanelProps> = ({
  umlCode,
  setUmlCode,
  isCollapsed,
  onToggleCollapse,
  onDocsClick
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  
  const lineCount = umlCode.split('\n').length;

  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    const lineNumbers = lineNumbersRef.current;
    
    if (textarea && lineNumbers) {
      const syncScroll = () => {
        lineNumbers.scrollTop = textarea.scrollTop;
      };
      textarea.addEventListener('scroll', syncScroll);
      return () => textarea.removeEventListener('scroll', syncScroll);
    }
  }, []);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUmlCode(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newCode = umlCode.substring(0, start) + '    ' + umlCode.substring(end);
      setUmlCode(newCode);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
  };

  const renderLineNumbers = () => {
    const numbers = [];
    for (let i = 1; i <= lineCount; i++) {
      numbers.push(
        <div key={i} className="line-number">
          {i}
        </div>
      );
    }
    return numbers;
  };

  return (
    <div className={`code-panel ${isCollapsed ? 'collapsed' : ''}`}>
      {isCollapsed ? (
        <button 
          className="collapse-btn"
          onClick={onToggleCollapse}
          title="Mở Code Editor"
        >
          <span className="collapse-text">Code</span>
          <span className="collapse-arrow">▶</span>
        </button>
      ) : (
        <>
          <div className="panel-navbar">
            <div className="navbar-left">
              <span className="navbar-title">Mermaid Code Editor</span>
            </div>
            <div className="navbar-right">
              <button className="navbar-btn" onClick={onDocsClick}>Docs</button>
              <button className="navbar-btn navbar-close" onClick={onToggleCollapse} title="Thu gọn">✕</button>
            </div>
          </div>

          <div className="panel-body code-editor-wrapper">
            <div className="code-editor-container">
              <div ref={lineNumbersRef} className="line-numbers">
                {renderLineNumbers()}
              </div>
              
              <textarea
                ref={textareaRef}
                className="textarea-code"
                value={umlCode}
                onChange={handleCodeChange}
                onKeyDown={handleKeyDown}
                onScroll={handleScroll}
                spellCheck={false}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CodePanel;