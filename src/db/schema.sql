-- MySQL schema for the GoDaddy Node.js hosting build of INFOCLOUD.
-- Replaces the MongoDB/Mongoose models (src/models/NewsItem.js, Source.js) for
-- environments where only "GoDaddy managed MySQL" is reachable outbound.
--
-- Run once against the provisioned database, e.g.:
--   mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < src/db/schema.sql

CREATE TABLE IF NOT EXISTS sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  url VARCHAR(1000) NOT NULL,
  alternate_url VARCHAR(1000) NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  bias VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'UNKNOWN',
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  last_polled_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_sources_url (url(255)),
  KEY idx_sources_name (name),
  KEY idx_sources_category (category),
  KEY idx_sources_bias (bias),
  KEY idx_sources_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS news_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(1000) NOT NULL,
  title VARCHAR(1000) NOT NULL,
  content_snippet TEXT NULL,
  published_at DATETIME NOT NULL,
  source_id INT NOT NULL,
  keywords JSON NOT NULL,
  bias VARCHAR(50) NOT NULL DEFAULT 'Unknown',
  llm_bias VARCHAR(50) NULL,
  category VARCHAR(50) NULL,
  llm_processed TINYINT(1) NOT NULL DEFAULT 0,
  llm_processing_error TEXT NULL,
  llm_processing_attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_news_items_url (url(500)),
  KEY idx_news_items_published_at (published_at),
  KEY idx_news_items_category (category),
  KEY idx_news_items_llm_processed (llm_processed),
  KEY idx_news_items_created_at (created_at),
  KEY idx_news_items_source_id (source_id),
  CONSTRAINT fk_news_items_source FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
