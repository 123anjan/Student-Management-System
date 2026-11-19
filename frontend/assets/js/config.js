// =============================================================================
// config.js - the ONE file you edit to switch between demo and live mode.
// =============================================================================
//
//  MODE = "demo"  -> No server needed. Data is stored in the visitor's browser
//                    (localStorage). This is what GitHub Pages can host, because
//                    GitHub Pages only serves static files (HTML/CSS/JS).
//
//  MODE = "live"  -> The front-end talks to the Django REST API over HTTP.
//                    Use this when the backend is running (locally or on Hostinger).
//
// Every other file is written so it does not care which mode is active.

export const CONFIG = {
  MODE: "demo",

  // Only used in "live" mode. Must end WITHOUT a trailing slash.
  // Local development:  http://127.0.0.1:8000/api
  // Production example: https://api.your-domain.com/api
  API_BASE_URL: "http://127.0.0.1:8000/api",

  APP_NAME: "EduTrack",
  PAGE_SIZE: 8, // rows per page in the students table
};
