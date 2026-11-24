import React from 'react';
import { TheoryView } from '../../ui/TheoryView';
import { MODULE8_THEORY } from './model';

export const Module8Theory: React.FC = () => (
  <TheoryView
    moduleTitle="Module 8: TDMA vs OFDMA Resource Allocation & Multiuser Performance"
    content={MODULE8_THEORY}
  />
);
