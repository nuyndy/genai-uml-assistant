// frontend/src/pages/Home/Home.tsx
import { useState } from 'react';
import InputArea from '../../components/InputArea/InputArea';
import './Home.css';

interface HomeProps {
  inputPrompt: string;
  setInputPrompt: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  onSendMessage: () => void;
  onTabChange?: (tab: string) => void;
}

const Home: React.FC<HomeProps> = ({
  inputPrompt,
  setInputPrompt,
  loading,
  onSendMessage,
  onTabChange
}) => {
  const [activeFeature, setActiveFeature] = useState('Use Case');

  const features = ['Use Case', 'Class Diagram', 'Sequence', 'Activity'];

  const handleSend = () => {
    if (inputPrompt.trim() && !loading) {
      // Chuyển sang tab Sinh UML TRƯỚC
      if (onTabChange) {
        onTabChange('Sinh UML');
      }
      
      // Sau đó gửi message
      onSendMessage();
    }
  };

  return (
    <div className="home-container">
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Generate UML Diagrams
            <br />
            <span className="hero-highlight">with AI Intelligence</span>
          </h1>
          
          <p className="hero-desc">
            Mô tả yêu cầu hệ thống bằng ngôn ngữ tự nhiên,
            <br />
            AI sẽ tự động sinh Use Case Specification và sơ đồ UML chính xác.
          </p>

          <div className="hero-input-area">
            {/* ✅ Sử dụng InputArea component */}
            <InputArea
              value={inputPrompt}
              onChange={setInputPrompt}
              onSend={handleSend}
              loading={loading}
              placeholder="Mô tả yêu cầu hệ thống của bạn..."
            />

            <div className="feature-tags">
              {features.map((feature) => (
                <button
                  key={feature}
                  className={`feature-tag ${activeFeature === feature ? 'active' : ''}`}
                  onClick={() => {
                    setActiveFeature(feature);
                    const prompts: Record<string, string> = {
                      'Use Case': 'Hệ thống quản lý ngân hàng với các chức năng: tạo tài khoản, gửi tiền, rút tiền, chuyển khoản',
                      'Class Diagram': 'Xây dựng Class Diagram cho hệ thống quản lý thư viện với các lớp: Sách, Thành viên, Mượn trả',
                      'Sequence': 'Mô tả Sequence Diagram cho quy trình đặt hàng trực tuyến',
                      'Activity': 'Mô tả Activity Diagram cho quy trình xử lý đơn hàng'
                    };
                    setInputPrompt(prompts[feature] || '');
                  }}
                >
                  + {feature}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;