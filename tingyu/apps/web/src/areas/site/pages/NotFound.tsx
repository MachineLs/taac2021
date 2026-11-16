import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';

export default function NotFound() {
  useEffect(() => { document.title = '页面不存在 · 听屿心理'; }, []);
  return (
    <div className="site-wrap site-404">
      <b className="num">404</b>
      <h1>这个页面走丢了</h1>
      <p className="muted">链接可能已失效，或页面已被移动。</p>
      <div className="site-row-gap site-center">
        <Link className="btn btn-blue" to="/">返回首页</Link>
        <Link className="btn btn-line" to="/counselors">找咨询师</Link>
        <Link className="btn btn-line" to="/intake"><Icon name="mic" size={16} />和小屿聊聊</Link>
      </div>
    </div>
  );
}
