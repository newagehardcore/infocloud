const axios = require('axios');
require('dotenv').config();

const minifluxClient = axios.create({
    baseURL: process.env.MINIFLUX_URL,
    headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': process.env.MINIFLUX_API_KEY
    },
    timeout: 10000 // 10 second timeout
});

module.exports = minifluxClient; 