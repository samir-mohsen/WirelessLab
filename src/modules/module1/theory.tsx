import React from 'react';
import { TheoryView } from '../../ui/TheoryView';
import { MODULE1_THEORY } from './model';

export const Module1Theory: React.FC = () => (
  <TheoryView
    moduleTitle="Module 1: Wireless Propagation & Cellular Coverage Analysis"
    content={MODULE1_THEORY}
  />
);
