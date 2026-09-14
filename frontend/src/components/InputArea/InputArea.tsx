// frontend/src/components/InputArea/InputArea.tsx
import React, { useRef, useEffect, useState } from 'react';
import './InputArea.css';

interface InputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  loading: boolean;
  placeholder?: string;
  onFileUpload?: (file: File) => void;
}

const InputArea: React.FC<InputAreaProps> = ({
  value,
  onChange,
  onSend,
  loading,
  placeholder = 'Hỏi bất cứ điều gì',
  onFileUpload
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (loading) return;
    
    // BẮT BUỘC: Phải có text mới được gửi
    if (!value.trim()) return;

    // Nếu có file, gọi callback upload
    if (uploadedFile && onFileUpload) {
      onFileUpload(uploadedFile);
    }

    // Gửi tin nhắn
    onSend();

    // Reset sau khi gửi
    onChange('');
    setUploadedFile(null);
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
    e.target.value = '';
  };

  const removeFile = () => {
    setUploadedFile(null);
  };

  return (
    <div className="input-area">
      <div className="input-container">
        {/* File preview */}
        {uploadedFile && (
          <div className="file-preview-wrapper">
            <div className="file-preview">
              <span className="file-icon">📄</span>
              <span className="file-name">{uploadedFile.name}</span>
              <span className="file-size">
                ({(uploadedFile.size / 1024).toFixed(1)} KB)
              </span>
              <button className="file-remove" onClick={removeFile}>✕</button>
            </div>
          </div>
        )}

        <div className="input-row">
          {/* File upload button */}
          <button 
            className="btn-attach"
            onClick={handleFileClick}
            disabled={loading}
            title="Đính kèm file"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept=".txt,.pdf,.doc,.docx,.png,.jpg,.jpeg,.json,.xml,.yaml,.yml"
          />

          {/* Text input */}
          <textarea
            ref={textareaRef}
            className={`input-text ${uploadedFile ? 'has-file' : ''}`}
            placeholder={uploadedFile ? 'Nhập tin nhắn kèm file...' : placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
          />
          
          {/* Send button - Chỉ active khi có text */}
          <button 
            onClick={handleSend}
            disabled={!value.trim() || loading}
            className={`btn-send ${value.trim() ? 'active' : ''}`}
          >
            {loading ? (
              <span className="send-loading">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InputArea;