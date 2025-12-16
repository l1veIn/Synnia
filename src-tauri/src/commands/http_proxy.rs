use std::collections::HashMap;
use serde::{Deserialize, Serialize};
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
