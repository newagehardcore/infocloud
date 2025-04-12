// Font utility module to manage font loading for the 3D text

/**
 * Get the preferred font for tags
 * For drei's Text component, we need to use an empty string
 * to make it use the default font without trying to load any font files
 */
export const getTagFont = (): string => {
  // Empty string makes three.js use its built-in font
  return '';
};

/**
 * Preload the font to make sure it's available when Text components need it
 * This helps avoid font loading errors by injecting CSS styles
 */
export const preloadFonts = (): void => {
  try {
    // Add CSS styles for Helvetica with more specific targeting
    const style = document.createElement('style');
    style.textContent = `      
      /* Force Helvetica throughout the app */
      body, canvas, .tag-cloud-word {
        font-family: Helvetica, Arial, sans-serif !important;
        letter-spacing: -0.05em;
        font-weight: 600;
      }
      
      /* Ensure Helvetica is forced in Three.js context */
      canvas text {
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
export const tagFontFamily = "Helvetica, Arial, sans-serif"; 