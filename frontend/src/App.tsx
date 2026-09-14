// frontend/src/App.tsx
import { useState, useEffect } from 'react';
import './App.css';
import Navigation from './components/Navigation/Navigation';
import Home from './pages/Home/Home';
import SinhUML from './pages/SinhUML/SinhUML';
import CaseStudy from './pages/CaseStudy/CaseStudy';
import DanhGia from './pages/DanhGia/DanhGia';
import TaiLieu from './pages/TaiLieu/TaiLieu';
import CaiDat from './pages/CaiDat/CaiDat';

// interface Message {
//   sender: 'user' | 'ai';
//   text: string;
// }

function App() {
  const [inputPrompt, setInputPrompt] = useState('');
  // const [umlCode, setUmlCode] = useState('');
  // const [useCaseSpec, setUseCaseSpec] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');

  // Lắng nghe sự kiện chuyển tab từ component khác
  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail);
      }
    };

    window.addEventListener('tabChange', handleTabChange as EventListener);

    return () => {
      window.removeEventListener('tabChange', handleTabChange as EventListener);
    };
  }, []);

  const handleSendMessage = async () => {
    if (!inputPrompt.trim() || loading) return;

    setLoading(true);

    const userMessage = inputPrompt.trim();
    // setMessages((prev) => [...prev, { sender: 'user', text: userMessage }]);
    setInputPrompt('');

    try {
      const language = 'vi';
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/uml/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: userMessage, language }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || err?.message || res.statusText);
      }

      // const data = await res.json();

      // setUseCaseSpec(data.use_case_spec || '');
      // setUmlCode((data.use_case_diagram || '') + '\n\n' + (data.class_diagram || ''));

      // setMessages((prev) => [
      //   ...prev,
      //   {
      //     sender: 'ai',
      //     text: '✅ Đã sinh UML thành công. Vui lòng xem phần Preview bên phải.',
      //   },
      // ]);
    // } catch (e: unknown) {
      // setMessages((prev) => [
      //   ...prev,
      //   {
      //     sender: 'ai',
      //     text: `❌ Lỗi: ${e instanceof Error ? e.message : 'Không xác định'}`,
      //   },
      // ]);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <div className="app-container">
      <Navigation activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="main-content">
        {activeTab === 'Home' && (
          <Home
            inputPrompt={inputPrompt}
            setInputPrompt={setInputPrompt}
            loading={loading}
            onSendMessage={() => {
              handleTabChange('Sinh UML');
              handleSendMessage();
            }}
            onTabChange={handleTabChange}
          />
        )}

        {activeTab === 'Sinh UML' && (
          <SinhUML />
        )}

        {activeTab === 'Case Study' && <CaseStudy />}
        {activeTab === 'Đánh Giá' && <DanhGia />}
        {activeTab === 'Tài Liệu' && <TaiLieu />}
        {activeTab === 'Cài Đặt' && <CaiDat />}
      </main>
    </div>
  );
}

export default App;