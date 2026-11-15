/* Prototype toolbar shown on every live screen: back to the overview + switch skins.
 * Hidden in automated screenshots (navigator.webdriver). */
(function () {
  if (navigator.webdriver) return;
  var NAMES = { clinic: '专业', mist: '晨雾', night: '夜航', palm: '掌心', pitch: '路演' };
  var bar = document.createElement('nav');
  bar.className = 'pbar';
  bar.setAttribute('aria-label', '原型工具条');
  bar.innerHTML = '<a class="pbar-home" href="../index.html">‹ 原型图总览</a><span class="pbar-sep"></span><span class="pbar-k">风格</span>' +
    Object.keys(NAMES).map(function (k) { return '<button type="button" data-skin="' + k + '">' + NAMES[k] + '</button>'; }).join('');
  var css = document.createElement('style');
  css.textContent = '.pbar{position:fixed;left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:2147483000;display:flex;align-items:center;gap:2px;padding:4px;border-radius:999px;background:rgba(17,22,24,.82);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 8px 24px -8px rgba(0,0,0,.5);font:500 12px/1 "Noto Sans SC","PingFang SC",system-ui,sans-serif;opacity:.8;transition:opacity .2s;max-width:calc(100vw - 24px);overflow-x:auto;scrollbar-width:none}' +
    '.pbar:hover,.pbar:focus-within{opacity:1}.pbar a,.pbar button{color:rgba(255,255,255,.85);background:none;border:0;padding:7px 9px;border-radius:999px;text-decoration:none;white-space:nowrap;font:inherit;cursor:pointer}' +
    '.pbar a:hover,.pbar button:hover{background:rgba(255,255,255,.12);color:#fff}.pbar button.on{background:#fff;color:#111}.pbar-k{color:rgba(255,255,255,.5);padding:0 4px 0 6px;white-space:nowrap}' +
    '.pbar-sep{width:1px;height:14px;background:rgba(255,255,255,.25);margin:0 3px;flex-shrink:0}.pbar :focus-visible{outline:2px solid #fff;outline-offset:1px}';
  function sync() {
    var cur = window.TingyuSkin ? window.TingyuSkin.get() : 'clinic';
    Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.getAttribute('data-skin') === cur); b.setAttribute('aria-pressed', String(b.getAttribute('data-skin') === cur)); });
  }
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-skin]');
    if (b && window.TingyuSkin) { window.TingyuSkin.set(b.getAttribute('data-skin')); sync(); }
  });
  function mount() { document.head.appendChild(css); document.body.appendChild(bar); sync(); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
