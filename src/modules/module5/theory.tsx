import React from 'react';
import { TheoryView } from '../../ui/TheoryView';
import { MODULE5_THEORY } from './model';

export const Module5Theory: React.FC = () => (
  <TheoryView
    moduleTitle="Module 5: CDMA Near-Far Problem & Power Control"
    content={MODULE5_THEORY}
  />
);
