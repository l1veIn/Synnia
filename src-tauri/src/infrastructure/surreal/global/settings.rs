use serde::{de::DeserializeOwned, Deserialize, Serialize};

use crate::core::AppError;
use crate::infrastructure::surreal::global::{map_db_error, Db};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingRecord {
    key: String,
    value: Option<String>,
    json_value: Option<String>,
    updated_at: i64,
}

pub async fn get_setting(db: &Db, key: &str) -> Result<Option<String>, AppError> {
    let mut response = db
        .query("SELECT * FROM app_settings WHERE key = $key")
        .bind(("key", key.to_string()))
        .await
        .map_err(map_db_error)?;

    let record: Option<SettingRecord> = response.take(0).map_err(map_db_error)?;
    Ok(record.and_then(|r| r.value))
}

pub async fn set_setting(db: &Db, key: &str, value: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    let record = SettingRecord {
        key: key.to_string(),
        value: Some(value.to_string()),
        json_value: None,
        updated_at: now,
    };

    let _: Option<SettingRecord> = db
        .update(("app_settings", key))
        .content(record)
        .await
        .map_err(map_db_error)?;

    Ok(())
}

pub async fn get_json_setting<T: DeserializeOwned>(db: &Db, key: &str) -> Result<Option<T>, AppError> {
    let mut response = db
        .query("SELECT * FROM app_settings WHERE key = $key")
        .bind(("key", key.to_string()))
        .await
        .map_err(map_db_error)?;

    let record: Option<SettingRecord> = response.take(0).map_err(map_db_error)?;
    match record.and_then(|r| r.json_value) {
        Some(value) => {
            let decoded = serde_json::from_str(&value)
                .map_err(|e| AppError::Serialization(e.to_string()))?;
            Ok(Some(decoded))
        }
        None => Ok(None),
    }
}

pub async fn set_json_setting<T: Serialize>(db: &Db, key: &str, value: &T) -> Result<(), AppError> {
    let json_value = serde_json::to_string(value)
        .map_err(|e| AppError::Serialization(e.to_string()))?;
    let now = chrono::Utc::now().timestamp_millis();
    let record = SettingRecord {
        key: key.to_string(),
        value: None,
        json_value: Some(json_value),
        updated_at: now,
    };

    let _: Option<SettingRecord> = db
        .update(("app_settings", key))
        .content(record)
        .await
        .map_err(map_db_error)?;

    Ok(())
}

pub async fn delete_setting(db: &Db, key: &str) -> Result<bool, AppError> {
    let mut response = db
        .query("DELETE FROM app_settings WHERE key = $key")
        .bind(("key", key.to_string()))
        .await
        .map_err(map_db_error)?;

    let deleted: Vec<SettingRecord> = response.take(0).map_err(map_db_error)?;
    Ok(!deleted.is_empty())
}

pub async fn list_settings(db: &Db) -> Result<Vec<String>, AppError> {
    let mut response = db
        .query("SELECT * FROM app_settings ORDER BY key")
        .await
        .map_err(map_db_error)?;

    let records: Vec<SettingRecord> = response.take(0).map_err(map_db_error)?;
    Ok(records.into_iter().map(|r| r.key).collect())
}
