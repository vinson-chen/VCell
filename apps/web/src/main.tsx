import React from 'react';
import ReactDOM from 'react-dom/client';
import dayjs from 'dayjs';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';
import { VcConfigProvider } from 'vc-design';
import 'vc-design/dist/index.css';
import 'vc-biz/dist/index.css';
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
