import React from 'react';
import { TheoryView } from '../../ui/TheoryView';
import { MODULE6_THEORY } from './model';

export const Module6Theory: React.FC = () => (
  <TheoryView
    moduleTitle="Module 6: Cellular Frequency Reuse & Co-Channel Interference"
    content={MODULE6_THEORY}
  />
);
