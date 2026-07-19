// Font utility module to manage font loading for the 3D text
import { SourceType } from '../types';

/**
 * Get the font family based on source type
 */
export const getSourceTypeFont = (type?: SourceType): string => {
  switch (type) {
    case SourceType.Independent:
      return '"Times New Roman", Tinos, Georgia, serif'; // Newspaper serif for independent media
    case SourceType.Corporate:
      return "Helvetica, Arial, sans-serif"; // Clean sans-serif for corporate media
    case SourceType.State:
      return '"Archivo Black", "Arial Black", sans-serif'; // Wide fat bold for state media
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
      // Real Times New Roman (copied from macOS). Monotype font — not licensed
      // for web redistribution; swap back to Tinos-Regular.ttf before public launch.
      return '/fonts/TimesNewRoman.ttf';
    case SourceType.Corporate:
      return '/fonts/helvetica.ttf'; // Helvetica
    case SourceType.State:
      return '/fonts/ArchivoBlack-Regular.ttf'; // Wide fat bold
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
      
      /* Web fonts for source-type styling (same files troika uses in the cloud) */
      @font-face {
        font-family: 'Tinos';
        src: url('/fonts/TimesNewRoman.ttf') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'Archivo Black';
        src: url('/fonts/ArchivoBlack-Regular.ttf') format('truetype');
        font-display: swap;
      }

      /* Source type specific fonts */
      .source-type-independent {
        font-family: "Times New Roman", Tinos, Georgia, serif !important;
      }

      .source-type-corporate {
        font-family: Helvetica, Arial, sans-serif !important;
      }

      .source-type-state {
        font-family: "Archivo Black", "Arial Black", sans-serif !important;
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