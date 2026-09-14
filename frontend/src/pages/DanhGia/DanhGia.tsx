// frontend/src/pages/DanhGia/DanhGia.tsx
import React, { useState } from 'react';

const DanhGia: React.FC = () => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  const handleSubmit = () => {
    alert(`Cảm ơn bạn đã đánh giá ${rating} sao!`);
    setRating(0);
    setFeedback('');
  };

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="page-icon">⭐</div>
        <h2 className="page-title">Đánh Giá</h2>
        <p className="page-desc">Đánh giá và phản hồi về hệ thống</p>
        <div className="review-box">
          <div className="stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                className={`star ${star <= rating ? 'star-active' : ''}`}
                onClick={() => setRating(star)}
              >
                ★
              </button>
            ))}
          </div>
          <textarea 
            className="review-textarea"
            rows={3}
            placeholder="Chia sẻ cảm nhận của bạn về hệ thống..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <button className="btn-submit" onClick={handleSubmit}>
            Gửi đánh giá
          </button>
        </div>
      </div>
    </div>
  );
};

export default DanhGia;