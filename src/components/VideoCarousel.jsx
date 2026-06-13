import { Typography } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import VideoCard from './VideoCard';
import './VideoCarousel.css';

const { Title } = Typography;

function VideoCarousel({ title, videos }) {
  return (
    <section className="video-carousel">
      <div className="carousel-header">
        <Title level={3} className="carousel-title">{title}</Title>
        <a className="carousel-more" href="#">
          查看更多 <RightOutlined />
        </a>
      </div>
      <div className="carousel-track">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </section>
  );
}

export default VideoCarousel;
