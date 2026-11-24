import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathBlockProps {
  latex: string;
  display?: boolean;
  className?: string;
}

export const MathBlock: React.FC<MathBlockProps> = ({
  latex,
  display = true,
  className = '',
}) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: display,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return latex;
    }
  }, [latex, display]);

  if (display) {
    return (
      <div
        className={`overflow-x-auto py-1 ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

export function renderLatexToHtml(latex: string, display = true): string {
  try {
    return katex.renderToString(latex, {
      displayMode: display,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return latex;
  }
}
