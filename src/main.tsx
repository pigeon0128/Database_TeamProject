// 앱 시작점. index.html의 #root에 App을 붙이고 전역 스타일(index.css)을 불러온다.
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
