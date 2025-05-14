// Font utility module to manage font loading for the 3D text
import { SourceType } from '../types';

/**
 * Get the font family based on source type
 */
export const getSourceTypeFont = (type?: SourceType): string => {
  switch (type) {
    case SourceType.Independent:
      return "Georgia, serif"; // Serif font for independent sources
    case SourceType.Corporate:
      return "Helvetica, Arial, sans-serif"; // Sans-serif for corporate sources
    case SourceType.State:
      return "Courier New, monospace"; // Monospace for state-controlled media
    case SourceType.Unknown:
    default:
      return "Helvetica, Arial, sans-serif"; // Default
  }
};

/**
 * Get the preferred font path for tags
 * For drei's Text component, we need to return a path to the font file
 */
export const getTagFont = (type?: SourceType): string => {
  switch (type) {
    case SourceType.Independent:
      return '/fonts/georgia.ttf'; // Path to Georgia font
    case SourceType.Corporate:
      return '/fonts/helvetica.ttf'; // Path to Helvetica font
    case SourceType.State:
      return '/fonts/courier.ttf'; // Path to Courier font
    case SourceType.Unknown:
    default:
      return '/fonts/helvetica.ttf'; // Default
  }
};

/**
 * Preload the fonts to make sure they're available when Text components need them
 * This helps avoid font loading errors by injecting CSS styles
 */
export const preloadFonts = (): void => {
  try {
    // Add CSS styles for all font families we'll use
    const style = document.createElement('style');
    style.textContent = `      
      /* Default font for the app */
      body, canvas {
        font-family: Helvetica, Arial, sans-serif !important;
        letter-spacing: -0.05em;
        font-weight: 600;
      }
      
      /* Source type specific fonts */
      .source-type-independent {
        font-family: Georgia, serif !important;
      }
      
      .source-type-corporate {
        font-family: Helvetica, Arial, sans-serif !important;
      }
      
      .source-type-state {
        font-family: "Courier New", monospace !important;
      }
      
      .source-type-unknown {
        font-family: Helvetica, Arial, sans-serif !important;
      }
    `;
    document.head.appendChild(style);
    
    console.log('Font styles added successfully');
  } catch (e) {
    console.warn('Error setting up fonts:', e);
  }
};

/**
 * Font family stack for use in regular CSS/styles
 */
export const tagFontFamily = "Helvetica, Arial, sans-serif"; // Default font family 