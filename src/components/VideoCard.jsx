import { Tag } from 'antd';
import { StarFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './VideoCard.css';

function VideoCard({ video }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (video.folderName) {
      navigate(`/play/${encodeURIComponent(video.folderName)}`);
    }
  };

  return (
    <div className="video-card" onClick={handleClick}>
      <div className="video-card-poster">
        <img src={video.poster} alt={video.title} loading="lazy" />
        <div className="video-card-overlay">
          <div className="video-card-rating">
            <StarFilled style={{ color: '#f5c518', fontSize: 14 }} />
            <span>{video.rating}</span>
          </div>
        </div>
      </div>
      <div className="video-card-info">
        <h4 className="video-card-title" title={video.title}>
          {video.title}
        </h4>
        <div className="video-card-meta">
          <span>{video.year}</span>
          {video.genre && <Tag color="default">{video.genre}</Tag>}
        </div>
      </div>
    </div>
  );
}

export default VideoCard;
