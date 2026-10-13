/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import ReactDOM from 'react-dom/client';
import { LivingApp } from './LivingApp';
import './living.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LivingApp />
  </React.StrictMode>
);
