const Parser = require('rss-parser'); const parser = new Parser(); async function test() { try { const feed = await parser.parseURL('https://www.thenation.com/feed/'); console.log(feed.title); console.log('Items:', feed.items.length); console.log('First item:', feed.items[0].title); } catch (e) { console.error('Error:', e); } } test();
