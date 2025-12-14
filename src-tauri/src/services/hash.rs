//! Content hashing utilities for CAS (Content Addressable Storage).
//!
//! Uses SHA-256 for content hashing.

use sha2::{Sha256, Digest};

/// Compute SHA-256 hash of a string content.
/// Returns a lowercase hex string.
pub fn compute_content_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)
}

/// Compute SHA-256 hash of binary content.
pub fn compute_binary_hash(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    format!("{:x}", result)
}

/// Compute hash of a file at the given path.
pub fn compute_file_hash(path: &std::path::Path) -> std::io::Result<String> {
    use std::fs::File;
    use std::io::{BufReader, Read};
    
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    
    loop {
        let bytes_read = reader.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }
    
    let result = hasher.finalize();
    Ok(format!("{:x}", result))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_content_hash() {
        let content = r#"{"hello": "world"}"#;
        let hash = compute_content_hash(content);
        
        // Hash should be 64 hex characters (256 bits)
        assert_eq!(hash.len(), 64);
        
        // Same content = same hash
        let hash2 = compute_content_hash(content);
        assert_eq!(hash, hash2);
        
        // Different content = different hash
        let hash3 = compute_content_hash(r#"{"hello": "world!"}"#);
        assert_ne!(hash, hash3);
    }

    #[test]
    fn test_compute_binary_hash() {
        let data = b"Hello, World!";
        let hash = compute_binary_hash(data);
        
        assert_eq!(hash.len(), 64);
        
        // Known SHA-256 hash for "Hello, World!"
        assert_eq!(
            hash,
            "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f"
        );
    }
}
