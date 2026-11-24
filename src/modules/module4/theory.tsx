import React from 'react';
import { TheoryView } from '../../ui/TheoryView';
import { MODULE4_THEORY } from './model';

export const Module4Theory: React.FC = () => (
  <TheoryView
    moduleTitle="Module 4: DSSS Performance under Interference"
    content={MODULE4_THEORY}
  />
);
