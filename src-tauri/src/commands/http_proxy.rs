use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use base64::Engine;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize)]
pub struct ProxyResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
}

/// Proxy an HTTP request to avoid CORS issues with local services
/// Supports Ollama, ComfyUI, and other local AI services
#[tauri::command]
pub async fn proxy_request(
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
) -> Result<ProxyResponse, AppError> {
    let client = reqwest::Client::new();
    
    // Build request
    let mut request_builder = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        _ => return Err(AppError::Unknown(format!("Unsupported HTTP method: {}", method))),
    };

    // Add headers
    for (key, value) in headers {
        request_builder = request_builder.header(&key, &value);
    }

    // Add body if present
    if let Some(body_content) = body {
        request_builder = request_builder.body(body_content);
    }

    // Execute request
    let response = request_builder
        .send()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;

    // Extract response data
    let status = response.status().as_u16();
    let response_headers: HashMap<String, String> = response
        .headers()
        .iter()
        .filter_map(|(k, v)| {
            v.to_str().ok().map(|val| (k.to_string(), val.to_string()))
        })
        .collect();

    let response_body = response
        .text()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;

    Ok(ProxyResponse {
        status,
        headers: response_headers,
        body: response_body,
    })
}

/// Fetch image response type
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchImageResponse {
    pub success: bool,
    pub data: Option<String>,  // base64 data URI
    pub error: Option<String>,
    pub content_type: Option<String>,
}

/// Fetch an image from a URL and return it as a base64 data URI.
/// This bypasses CORS restrictions for external image URLs (like Google's image servers).
#[tauri::command]
pub async fn fetch_image_as_base64(url: String) -> Result<FetchImageResponse, AppError> {
    let client = reqwest::Client::new();
    
    // Use browser-like headers to avoid 403/429 from image servers
    let response = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .header("Referer", "https://gemini.google.com/")
        .header("Accept", "image/webp,image/apng,image/*,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;
    
    if !response.status().is_success() {
        return Ok(FetchImageResponse {
            success: false,
            data: None,
            error: Some(format!("HTTP {}", response.status())),
            content_type: None,
        });
    }
    
    // Get content type
    let content_type = response.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/png")
        .to_string();
    
    // Get binary data
    let bytes = response.bytes().await
        .map_err(|e| AppError::Network(e.to_string()))?;
    
    // Convert to base64 data URI
    let base64_data = base64::engine::general_purpose::STANDARD.encode(&bytes);
    
    let data_uri = format!("data:{};base64,{}", content_type, base64_data);
    
    Ok(FetchImageResponse {
        success: true,
        data: Some(data_uri),
        error: None,
        content_type: Some(content_type),
    })
}
