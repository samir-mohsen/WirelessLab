import React from 'react';
import { MODULE3_THEORY } from './model';
import { TheoryView } from '../../ui/TheoryView';

export const Module3Theory: React.FC = () => {
  return <TheoryView content={MODULE3_THEORY} moduleTitle="Module 3: OFDM over Multipath Channels" />;
};
