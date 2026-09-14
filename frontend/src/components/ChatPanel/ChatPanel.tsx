// frontend/src/components/ChatPanel/ChatPanel.tsx
import React, { useRef, useEffect } from 'react';
import InputArea from '../InputArea/InputArea';
import './ChatPanel.css';

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

interface ChatPanelProps {
  messages: Message[];
  inputPrompt: string;
  setInputPrompt: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  onSendMessage: () => void;
  onFileUpload?: (file: File) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  inputPrompt,
  setInputPrompt,
  loading,
  onSendMessage,
  onFileUpload
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = (file: File) => {
    if (onFileUpload) {
      onFileUpload(file);
    }
  };

  return (
    <div className="chat-panel">
      {/* MESSAGES */}
      <div className="panel-body chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender === 'user' ? 'message-user' : 'message-ai'}`}>
            <div className={`message-bubble ${msg.sender === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
              <div className="message-text">{msg.text}</div>
            </div>
            <span className="message-time">
              {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {loading && (
          <div className="message message-ai">
            <div className="message-bubble bubble-ai">
              <div className="typing-indicator">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <InputArea
        value={inputPrompt}
        onChange={setInputPrompt}
        onSend={onSendMessage}
        loading={loading}
        placeholder="Hỏi bất cứ điều gì"
        onFileUpload={handleFileUpload}
      />
    </div>
  );
};

export default ChatPanel;