/**
 * Utility functions for working with RSS feeds
 */

/**
 * Simple XML to JSON parser for RSS feeds when standard parsers fail
 * @param xmlString Raw XML string from RSS feed
 * @returns Parsed RSS feed object with items array
 */
export const parseRawRssXml = (xmlString: string): any => {
  try {
    // Check if browser DOMParser is available
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
      
      // Basic RSS feed structure
      const feedResult: any = {
        title: getXmlElementText(xmlDoc, 'channel > title') || 'Untitled Feed',
        description: getXmlElementText(xmlDoc, 'channel > description') || '',
        link: getXmlElementText(xmlDoc, 'channel > link') || '',
        items: []
      };
      
      // Get all items
      const items = xmlDoc.querySelectorAll('item');
      
      items.forEach((item) => {
        feedResult.items.push({
          title: getXmlElementText(item, 'title') || 'Untitled',
          description: getXmlElementText(item, 'description') || getXmlElementText(item, 'content\\:encoded') || '',
          link: getXmlElementText(item, 'link') || '',
          pubDate: getXmlElementText(item, 'pubDate') || getXmlElementTextByTagName(item, 'dc:date') || new Date().toISOString(),
          guid: getXmlElementText(item, 'guid') || '',
          author: getXmlElementText(item, 'author') || getXmlElementTextByTagName(item, 'dc:creator') || '',
          categories: getXmlElementArray(item, 'category')
        });
      });
      
      return feedResult;
    } else {
      console.error('DOMParser not available for XML parsing');
      return { items: [] };
    }
  } catch (error) {
    console.error('Error parsing raw XML:', error);
    return { items: [] };
  }
};

/**
 * Helper function to get text content of an XML element by selector
 */
const getXmlElementText = (parent: Document | Element, selector: string): string | null => {
  try {
    const element = parent.querySelector(selector);
    return element ? element.textContent : null;
  } catch (error) {
    console.warn(`Error selecting "${selector}":`, error);
    return null;
  }
};

/**
 * Helper function to get text content of an XML element by tag name with namespace
 */
const getXmlElementTextByTagName = (parent: Document | Element, fullTagName: string): string | null => {
  try {
    // Handle namespaced elements like dc:creator
    const parts = fullTagName.split(':');
    const namespace = parts.length > 1 ? parts[0] : '';
    const localName = parts.length > 1 ? parts[1] : parts[0];
    
    // Try getElementsByTagNameNS first (more precise)
    let elements: HTMLCollectionOf<Element> | NodeListOf<Element>;
    if (namespace && parent.getElementsByTagNameNS) {
      // Use getElementsByTagNameNS if namespace is specified
      elements = parent.getElementsByTagNameNS('*', localName);
    } else {
      // Fallback to getElementsByTagName
      elements = parent.getElementsByTagName(fullTagName);
    }
    
    return elements.length > 0 ? elements[0].textContent : null;
  } catch (error) {
    console.warn(`Error selecting tag "${fullTagName}":`, error);
    return null;
  }
};

/**
 * Helper function to get an array of text content from multiple elements matching a selector
 */
const getXmlElementArray = (parent: Document | Element, selector: string): string[] => {
  try {
    const elements = parent.querySelectorAll(selector);
    return Array.from(elements).map(el => el.textContent || '').filter(Boolean);
  } catch (error) {
    console.warn(`Error selecting array "${selector}":`, error);
    return [];
  }
}; 