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

// Resolves under the deploy path (PUBLIC_URL) so fonts load when the site is
// hosted on a subpath like username.github.io/infocloud
const FONT_BASE = `${process.env.PUBLIC_URL || ''}/fonts`;

// Local dev uses real Times New Roman (copied from macOS, gitignored — it's a
// Monotype font we can't redistribute). Public builds use Tinos, its
// open-license metric twin, so the deployed site and repo stay clean.
// REACT_APP_USE_TNR=true is set in .env.development.
const INDEPENDENT_FONT_FILE = process.env.REACT_APP_USE_TNR === 'true'
  ? 'TimesNewRoman.ttf'
  : 'Tinos-Regular.ttf';

/**
 * Get the preferred font path for tags
 * For drei's Text component, we need to return a path to the font file
 */
export const getTagFont = (type?: SourceType): string => {
  switch (type) {
    case SourceType.Independent:
      return `${FONT_BASE}/${INDEPENDENT_FONT_FILE}`;
    case SourceType.Corporate:
      return `${FONT_BASE}/helvetica.ttf`; // Helvetica
    case SourceType.State:
      return `${FONT_BASE}/ArchivoBlack-Regular.ttf`; // Wide fat bold
    case SourceType.Unknown:
    default:
      return `${FONT_BASE}/helvetica.ttf`; // Default
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
        src: url('${FONT_BASE}/${INDEPENDENT_FONT_FILE}') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'Archivo Black';
        src: url('${FONT_BASE}/ArchivoBlack-Regular.ttf') format('truetype');
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