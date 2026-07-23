import React from 'react';

const LoadingBar: React.FC<{ progress: number; visible: boolean }> = ({ progress, visible }) => (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: 4,
      background: 'rgba(0,0,0,0.05)',
      zIndex: 9999,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s'
    }}
  >
    <div
      style={{
        height: '100%',
        width: `${progress}%`,
        background: 'linear-gradient(90deg, #6495ED 0%, #FFB6C1 100%)',
        transition: 'width 0.5s cubic-bezier(.4,1.6,.6,1)'
      }}
    />
  </div>
);

export default LoadingBar; 