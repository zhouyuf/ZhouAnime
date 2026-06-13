import { Layout, Space, Typography } from 'antd';
import './Footer.css';

const { Footer: AntFooter } = Layout;
const { Text, Link } = Typography;

function Footer() {
  return (
    <AntFooter className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="logo-text">Zhou</span>
          <span className="logo-highlight">Anime</span>
          <p className="footer-desc">发现最好的电影、电视剧和动漫</p>
        </div>
        <div className="footer-links">
          <div className="footer-col">
            <h4>探索</h4>
            <a href="#">电影</a>
            <a href="#">电视剧</a>
            <a href="#">动漫</a>
            <a href="#">排行榜</a>
          </div>
          <div className="footer-col">
            <h4>关于</h4>
            <a href="#">关于我们</a>
            <a href="#">联系方式</a>
            <a href="#">使用条款</a>
            <a href="#">隐私政策</a>
          </div>
        </div>
        <div className="footer-bottom">
          <Text className="footer-copyright">
            © 2024 ZhouAnime. All rights reserved.
          </Text>
        </div>
      </div>
    </AntFooter>
  );
}

export default Footer;
