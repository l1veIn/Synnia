//! Media metadata extraction for images, videos, and audio files.
//!
//! Supports:
//! - Images: dimensions, format, EXIF data (camera, GPS, exposure settings)
//! - Video/Audio: (placeholder for future implementation)

use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

/// Extracted metadata for an image file
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImageMetadata {
    pub width: u32,
    pub height: u32,
    pub format: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color_space: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bit_depth: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exif: Option<ExifData>,
}

/// EXIF metadata extracted from images
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExifData {
    // Camera info
    #[serde(skip_serializing_if = "Option::is_none")]
    pub make: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub software: Option<String>,
    
    // Capture settings
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date_time_original: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exposure_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub f_number: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iso: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub focal_length: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub focal_length_35mm: Option<u32>,
    
    // Image properties
    #[serde(skip_serializing_if = "Option::is_none")]
    pub orientation: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x_resolution: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y_resolution: Option<f64>,
    
    // GPS
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gps: Option<GpsData>,
}

/// GPS coordinates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpsData {
    pub latitude: f64,
    pub longitude: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub altitude: Option<f64>,
}

/// Extract metadata from an image file.
/// Returns None if the file cannot be read or is not a supported image format.
pub fn extract_image_metadata(path: &Path) -> Option<ImageMetadata> {
    // Get basic dimensions using the image crate
    let dimensions = image::image_dimensions(path).ok()?;
    
    // Determine format from extension
    let format = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_else(|| "unknown".to_string());
    
    let mut meta = ImageMetadata {
        width: dimensions.0,
        height: dimensions.1,
        format,
        ..Default::default()
    };
    
    // Try to extract EXIF data
    if let Ok(exif) = extract_exif(path) {
        meta.exif = Some(exif);
    }
    
    Some(meta)
}

/// Extract EXIF data from an image file.
fn extract_exif(path: &Path) -> Result<ExifData, Box<dyn std::error::Error>> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    
    let exif_reader = exif::Reader::new();
    let exif = exif_reader.read_from_container(&mut reader)?;
    
    let mut data = ExifData::default();
    
    // Helper to get string value
    macro_rules! get_str {
        ($tag:expr) => {
            exif.get_field($tag, exif::In::PRIMARY)
                .map(|f| f.display_value().to_string())
        };
    }
    
    // Helper to get rational as f64
    macro_rules! get_rational {
        ($tag:expr) => {
            exif.get_field($tag, exif::In::PRIMARY)
                .and_then(|f| {
                    if let exif::Value::Rational(ref v) = f.value {
                        v.first().map(|r| r.num as f64 / r.denom as f64)
                    } else {
                        None
                    }
                })
        };
    }
    
    // Helper to get u32
    macro_rules! get_u32 {
        ($tag:expr) => {
            exif.get_field($tag, exif::In::PRIMARY)
                .and_then(|f| f.value.get_uint(0))
        };
    }
    
    // Camera info
    data.make = get_str!(exif::Tag::Make);
    data.model = get_str!(exif::Tag::Model);
    data.software = get_str!(exif::Tag::Software);
    
    // Capture settings
    data.date_time_original = get_str!(exif::Tag::DateTimeOriginal);
    data.exposure_time = get_str!(exif::Tag::ExposureTime);
    data.f_number = get_rational!(exif::Tag::FNumber);
    data.iso = get_u32!(exif::Tag::PhotographicSensitivity);
    data.focal_length = get_rational!(exif::Tag::FocalLength);
    data.focal_length_35mm = get_u32!(exif::Tag::FocalLengthIn35mmFilm);
    
    // Image properties
    data.orientation = get_u32!(exif::Tag::Orientation);
    data.x_resolution = get_rational!(exif::Tag::XResolution);
    data.y_resolution = get_rational!(exif::Tag::YResolution);
    
    // GPS
    data.gps = extract_gps(&exif);
    
    Ok(data)
}

/// Extract GPS coordinates from EXIF data.
fn extract_gps(exif: &exif::Exif) -> Option<GpsData> {
    let lat = exif.get_field(exif::Tag::GPSLatitude, exif::In::PRIMARY)?;
    let lat_ref = exif.get_field(exif::Tag::GPSLatitudeRef, exif::In::PRIMARY)?;
    let lng = exif.get_field(exif::Tag::GPSLongitude, exif::In::PRIMARY)?;
    let lng_ref = exif.get_field(exif::Tag::GPSLongitudeRef, exif::In::PRIMARY)?;
    
    let latitude = parse_gps_coordinate(&lat.value)?;
    let longitude = parse_gps_coordinate(&lng.value)?;
    
    // Apply sign based on reference
    let lat_sign = if lat_ref.display_value().to_string().contains('S') { -1.0 } else { 1.0 };
    let lng_sign = if lng_ref.display_value().to_string().contains('W') { -1.0 } else { 1.0 };
    
    // Try to get altitude
    let altitude = exif.get_field(exif::Tag::GPSAltitude, exif::In::PRIMARY)
        .and_then(|f| {
            if let exif::Value::Rational(ref v) = f.value {
                v.first().map(|r| r.num as f64 / r.denom as f64)
            } else {
                None
            }
        });
    
    Some(GpsData {
        latitude: latitude * lat_sign,
        longitude: longitude * lng_sign,
        altitude,
    })
}

/// Parse GPS coordinate from EXIF value (degrees, minutes, seconds).
fn parse_gps_coordinate(value: &exif::Value) -> Option<f64> {
    if let exif::Value::Rational(ref v) = value {
        if v.len() >= 3 {
            let degrees = v[0].num as f64 / v[0].denom as f64;
            let minutes = v[1].num as f64 / v[1].denom as f64;
            let seconds = v[2].num as f64 / v[2].denom as f64;
            return Some(degrees + minutes / 60.0 + seconds / 3600.0);
        }
    }
    None
}

/// Extracted metadata for a video file (placeholder)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VideoMetadata {
    pub width: u32,
    pub height: u32,
    pub duration_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub codec: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frame_rate: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bitrate: Option<u64>,
}

/// Extracted metadata for an audio file (placeholder)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AudioMetadata {
    pub duration_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sample_rate: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channels: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bitrate: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub codec: Option<String>,
}

/// Generic extracted metadata enum
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ExtractedMetadata {
    Image(ImageMetadata),
    Video(VideoMetadata),
    Audio(AudioMetadata),
    Text { char_count: usize, line_count: usize },
    Json { depth: usize, key_count: usize },
    Unknown,
}

/// Extract metadata from a file based on its type.
pub fn extract_metadata(path: &Path) -> ExtractedMetadata {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());
    
    match ext.as_deref() {
        // Images
        Some("jpg") | Some("jpeg") | Some("png") | Some("webp") | Some("gif") | Some("tiff") => {
            extract_image_metadata(path)
                .map(ExtractedMetadata::Image)
                .unwrap_or(ExtractedMetadata::Unknown)
        }
        // Videos (placeholder)
        Some("mp4") | Some("mov") | Some("webm") | Some("avi") => {
            ExtractedMetadata::Video(VideoMetadata::default())
        }
        // Audio (placeholder)
        Some("mp3") | Some("wav") | Some("flac") | Some("aac") | Some("ogg") => {
            ExtractedMetadata::Audio(AudioMetadata::default())
        }
        _ => ExtractedMetadata::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_image_metadata_struct() {
        let meta = ImageMetadata {
            width: 1920,
            height: 1080,
            format: "jpeg".to_string(),
            ..Default::default()
        };
        
        let json = serde_json::to_string(&meta).unwrap();
        assert!(json.contains("\"width\":1920"));
        assert!(json.contains("\"height\":1080"));
    }
}
