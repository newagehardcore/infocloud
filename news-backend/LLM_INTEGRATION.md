# LLM Integration for InfoCloud News Aggregator

This document describes the integration of a locally-hosted Large Language Model (LLM) to improve word quality and bias detection in the InfoCloud news aggregation app.

## Overview

The implementation uses Ollama, a lightweight framework for running optimized open-source language models locally. This approach provides:

- **Free**: Uses open-source models with no API costs
- **Fast**: Optimized local inference with minimal latency
- **High-quality**: Modern foundation models for accurate analysis
- **Privacy**: All processing happens locally, no data sent to external services

## Features

The LLM integration adds two primary capabilities:

1. **Enhanced keyword extraction**: Identifies key concepts, entities, and topics from news articles
2. **Political bias detection**: Analyzes article text to classify bias on the scale: Left, Liberal, Centrist, Conservative, Right, or Unknown

## Installation

### 1. Install Ollama

```bash
# macOS installation
curl -fsSL https://ollama.com/install.sh | sh

# Check Ollama is installed
ollama --version
```

### 2. Pull Required Models

Pull the Gemma 2B model (recommended for best balance of speed and quality):

```bash
ollama pull gemma:2b
```

Alternatively, you can use Llama 3:

```bash
ollama pull llama3:8b
```

### 3. Install Node.js Dependencies

In the news-backend directory:

```bash
npm install
```

## Configuration

The implementation includes:

1. **llmService.js**: Central point for LLM operations with caching to improve performance
2. **Enhanced wordProcessingService.js**: Integrates traditional NLP with LLM-powered analysis
3. **Queue-based processing**: Efficiently handles large numbers of articles in batches

## Starting the LLM Service

1. Start Ollama in a terminal:

```bash
# For better performance, increase concurrency
OLLAMA_CONCURRENCY=4 ollama serve
```

2. Start the News Backend in a separate terminal:

```bash
cd news-backend
npm run dev
```

## Monitoring

- Check console logs for LLM processing information
- Each batch of articles will be processed with status updates
- Processing speed is approximately 1-2 seconds per article

## Troubleshooting

If you encounter issues:

1. **Ollama not responding**: Ensure Ollama is running with `ollama serve`
2. **Slow processing**: Try a smaller model like `gemma:2b-instruct-q4_0`
3. **Out of memory**: Reduce batch size and concurrency in cron.js
4. **Poor quality results**: Try a larger model like `llama3:8b` (slower but more accurate)

## Implementation Details

The integration uses:

- **LRU Cache**: To avoid reprocessing the same articles
- **Batch Processing**: For efficient throughput
- **Fallback Mechanisms**: To handle errors gracefully
- **Efficient Prompting**: Optimized for keyword extraction and bias detection
