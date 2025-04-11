/**
 * Performance optimization utilities for the "Whats Going On" application
 */

// Throttle function to limit how often a function can be called
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => ReturnType<T> | undefined) => {
  let inThrottle: boolean = false;
  let lastResult: ReturnType<T>;
  
  return function(this: any, ...args: Parameters<T>): ReturnType<T> | undefined {
    if (!inThrottle) {
      lastResult = func.apply(this, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    
    return lastResult;
  };
};

// Debounce function to delay execution until after a period of inactivity
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return function(this: any, ...args: Parameters<T>): void {
    clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
};

// Memoize function to cache results of expensive calculations
export const memoize = <T extends (...args: any[]) => any>(
  func: T
): ((...args: Parameters<T>) => ReturnType<T>) => {
  const cache = new Map<string, ReturnType<T>>();
  
  return function(this: any, ...args: Parameters<T>): ReturnType<T> {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }
    
    const result = func.apply(this, args);
    cache.set(key, result);
    
    return result;
  };
};

// Detect device capabilities for adaptive rendering
export const detectDeviceCapabilities = () => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  
  const isLowPowerDevice = isMobile && 
    (navigator.hardwareConcurrency <= 4 || 
     /iPhone|iPad|iPod/.test(navigator.userAgent));
  
  const hasWebGL = (() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch (e) {
      return false;
    }
  })();
  
  return {
    isMobile,
    isLowPowerDevice,
    hasWebGL,
    pixelRatio: window.devicePixelRatio || 1,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight
  };
};

// Adaptive rendering settings based on device capabilities
export const getAdaptiveRenderingSettings = () => {
  const capabilities = detectDeviceCapabilities();
  
  return {
    maxWordCount: capabilities.isLowPowerDevice ? 50 : 100,
    useSimpleRendering: capabilities.isLowPowerDevice || !capabilities.hasWebGL,
    pixelRatio: capabilities.isLowPowerDevice ? Math.min(capabilities.pixelRatio, 1) : capabilities.pixelRatio,
    enableAutoRotate: !capabilities.isLowPowerDevice,
    enableShadows: !capabilities.isLowPowerDevice,
    enableBloom: !capabilities.isLowPowerDevice,
    animationSpeed: capabilities.isLowPowerDevice ? 0.5 : 1
  };
};

// Monitor frame rate and adjust rendering quality if needed
export class PerformanceMonitor {
  private frameCount: number = 0;
  private lastTime: number = 0;
  private fps: number = 60;
  private callback: (fps: number) => void;
  private isRunning: boolean = false;
  
  constructor(callback: (fps: number) => void) {
    this.callback = callback;
  }
  
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastTime = performance.now();
    this.frameCount = 0;
    
    this.update();
  }
  
  stop() {
    this.isRunning = false;
  }
  
  private update = () => {
    if (!this.isRunning) return;
    
    this.frameCount++;
    const currentTime = performance.now();
    const elapsed = currentTime - this.lastTime;
    
    if (elapsed >= 1000) {
      this.fps = (this.frameCount * 1000) / elapsed;
      this.lastTime = currentTime;
      this.frameCount = 0;
      
      this.callback(this.fps);
    }
    
    requestAnimationFrame(this.update);
  };
  
  getFPS() {
    return this.fps;
  }
}

// Adaptive quality settings based on frame rate
export const getAdaptiveQualitySettings = (fps: number) => {
  if (fps < 20) {
    return {
      particleCount: 0,
      wordCount: 30,
      disableEffects: true,
      disableAutoRotate: true
    };
  } else if (fps < 30) {
    return {
      particleCount: 100,
      wordCount: 50,
      disableEffects: true,
      disableAutoRotate: false
    };
  } else if (fps < 45) {
    return {
      particleCount: 200,
      wordCount: 75,
      disableEffects: false,
      disableAutoRotate: false
    };
  } else {
    return {
      particleCount: 300,
      wordCount: 100,
      disableEffects: false,
      disableAutoRotate: false
    };
  }
};
