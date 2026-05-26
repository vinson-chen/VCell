import React from 'react';
import ReactDOM from 'react-dom/client';
import dayjs from 'dayjs';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';
import { VcConfigProvider } from '@vinson.hx/vc-design';
import '/Users/chenhui/Desktop/vc-design/dist/index.css';
import '/Users/chenhui/Desktop/vc-design/packages/vc-biz/dist/index.css';
import App from './App';
import './index.css';

dayjs.extend(weekday);
dayjs.extend(localeData);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VcConfigProvider>
      <App />
    </VcConfigProvider>
  </React.StrictMode>
);
