import { Carousel, Button, Rate, Tag } from 'antd';
import { PlayCircleOutlined, StarFilled } from '@ant-design/icons';
import './HeroBanner.css';

function HeroBanner({ slides }) {
  return (
    <section className="hero-banner">
      <Carousel autoplay autoplaySpeed={5000} effect="fade">
        {slides.map((slide) => (
          <div key={slide.id}>
            <div
              className="hero-slide"
              style={{ backgroundImage: `url(${slide.backdrop})` }}
            >
              <div className="hero-gradient" />
              <div className="hero-content">
                <Tag color="gold" className="hero-genre">{slide.genre}</Tag>
                <h1 className="hero-title">{slide.title}</h1>
                <p className="hero-original-title">{slide.originalTitle}</p>
                <div className="hero-meta">
                  <span className="hero-year">{slide.year}</span>
                  <span className="hero-rating">
                    <StarFilled style={{ color: '#f5c518' }} />
                    {slide.rating}
                  </span>
                </div>
                <p className="hero-desc">{slide.description}</p>
                <Button type="primary" size="large" icon={<PlayCircleOutlined />}>
                  立即播放
                </Button>
              </div>
            </div>
          </div>
        ))}
      </Carousel>
    </section>
  );
}

export default HeroBanner;
