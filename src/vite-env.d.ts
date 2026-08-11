/// <reference types="vite/client" />

// 兼容大写扩展名的静态资源（项目内 FAVICON.PNG 等）
declare module '*.PNG' {
  const src: string;
  export default src;
}
