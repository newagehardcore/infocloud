import os
import json
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request

# --- Configuration ---
# Load environment variables from .env file in the current directory
load_dotenv() 
MINIFLUX_URL = os.getenv("MINIFLUX_URL")
MINIFLUX_API_KEY = os.getenv("MINIFLUX_API_KEY")
BRIDGE_PORT = 5001 # The port this script will listen on

# --- Flask App Setup ---
app = Flask(__name__)

# --- Helper Function for Miniflux API Calls ---
def make_miniflux_request(method_name, http_method="GET", params=None, data=None):
    """Makes a request to the Miniflux REST API (v1)."""
    if not MINIFLUX_URL or not MINIFLUX_API_KEY:
        return {"error": "MINIFLUX_URL or MINIFLUX_API_KEY not found in .env file"}, 500

    # Construct the REST API endpoint URL
    api_endpoint = f"{MINIFLUX_URL.rstrip('/')}/v1/{method_name}"
    
    headers = {
        "X-Auth-Token": MINIFLUX_API_KEY
    }
    # Add Content-Type for methods with a body, otherwise leave it out
    if http_method in ["POST", "PUT", "PATCH"]:
        headers["Content-Type"] = "application/json"

    try:
        response = requests.request(
            method=http_method, 
            url=api_endpoint, 
            headers=headers, 
            params=params, # requests library handles query string encoding
            json=data,     # requests library handles JSON body encoding
            timeout=20
        )
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
        
        # Handle successful responses with no content (e.g., 204)
        if response.status_code == 204:
            return {}, 204

        # Try to parse JSON, handle potential errors
        try:
            result_data = response.json()
            # Miniflux v1 API errors are directly in the body
            if isinstance(result_data, dict) and "error_message" in result_data:
                return {"error": f"Miniflux API Error: {result_data['error_message']}"}, response.status_code
            return result_data, response.status_code
        except json.JSONDecodeError:
            # If response isn't JSON but status was ok (e.g., healthcheck returns "OK" text)
            if response.ok:
                return {"message": response.text}, response.status_code
            else:
                # If it failed and wasn't JSON, return generic error
                return {"error": f"Received non-JSON response with status {response.status_code}"}, response.status_code

    except requests.exceptions.RequestException as e:
        # Extract status code if available from the exception
        status_code = e.response.status_code if e.response is not None else 500
        return {"error": f"Failed to connect to Miniflux API: {e}"}, status_code
    except Exception as e:
        # Catch any other unexpected errors
        return {"error": f"An unexpected error occurred: {e}"}, 500


# --- API Endpoints for the Bridge ---

@app.route('/')
def index():
    """Basic check to see if the bridge is running."""
    return jsonify({"message": "Miniflux Bridge is running!"})

@app.route('/v1/me', methods=['GET'])
def get_me():
    """Get information about the current user."""
    result, status_code = make_miniflux_request("me")
    return jsonify(result), status_code

@app.route('/v1/feeds', methods=['GET'])
def get_feeds():
    """Get a list of all feeds."""
    result, status_code = make_miniflux_request("feeds")
    return jsonify(result), status_code
    
@app.route('/v1/feeds/<int:feed_id>', methods=['GET'])
def get_feed(feed_id):
    """Get details about a specific feed."""
    result, status_code = make_miniflux_request(f"feeds/{feed_id}")
    return jsonify(result), status_code

@app.route('/v1/feeds/<int:feed_id>/entries', methods=['GET'])
def get_feed_entries(feed_id):
    """Get entries for a specific feed (optional filters)."""
    # Corresponds to GET /v1/feeds/{feed_id}/entries
    # Pass request query parameters directly to the Miniflux API call
    # Example: /v1/feeds/123/entries?status=unread&limit=10
    params = request.args.to_dict()
    result, status_code = make_miniflux_request(f"feeds/{feed_id}/entries", params=params)
    return jsonify(result), status_code

@app.route('/v1/feeds', methods=['POST'])
def add_feed():
    """Add a new feed."""
    # Corresponds to POST /v1/feeds
    data = request.get_json()
    if not data or 'feed_url' not in data:
        return jsonify({"error": "Missing 'feed_url' in request body"}), 400
    
    # category_id is optional in newer Miniflux versions, pass along if provided
    # Other optional params (username, password, crawler, etc.) could be added here if needed
    required_data = {"feed_url": data['feed_url']}
    if 'category_id' in data:
        required_data['category_id'] = data['category_id']
    
    result, status_code = make_miniflux_request("feeds", http_method="POST", data=required_data)
    return jsonify(result), status_code

@app.route('/v1/feeds/<int:feed_id>', methods=['DELETE'])
def delete_feed(feed_id):
    """Delete a specific feed."""
    # Corresponds to DELETE /v1/feeds/{feed_id}
    result, status_code = make_miniflux_request(f"feeds/{feed_id}", http_method="DELETE")
    # Return the result (likely empty on success) and status code
    return jsonify(result), status_code

@app.route('/v1/categories', methods=['GET'])
def get_categories():
    """Get a list of all categories."""
    # Corresponds to GET /v1/categories
    result, status_code = make_miniflux_request("categories")
    return jsonify(result), status_code

# --- Main Execution ---
if __name__ == '__main__':
    print("--- Miniflux Bridge ---")
    if not MINIFLUX_URL or not MINIFLUX_API_KEY:
        print("ERROR: MINIFLUX_URL or MINIFLUX_API_KEY not found in .env file.")
        print("Please ensure a .env file exists in the same directory as this script")
        print("and contains the correct Miniflux URL and API Key.")
    else:
        print(f"Attempting to connect to Miniflux at: {MINIFLUX_URL}")
        print(f"Starting bridge server on http://127.0.0.1:{BRIDGE_PORT}")
        print("Press CTRL+C to stop the server.")
        # Run on localhost only, accessible only from your machine
        app.run(host='127.0.0.1', port=BRIDGE_PORT, debug=False) 