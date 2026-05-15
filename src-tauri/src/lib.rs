use encoding_rs::{SHIFT_JIS, UTF_16BE, UTF_16LE};
use serde::Serialize;
use std::{fs, path::Path};

#[derive(Serialize)]
struct TextFilePayload {
    path: String,
    name: String,
    contents: String,
    encoding: String,
}

fn file_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("untitled")
        .to_string()
}

fn decode_text(bytes: &[u8]) -> (String, String) {
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return (
            String::from_utf8_lossy(&bytes[3..]).into_owned(),
            "utf-8-bom".to_string(),
        );
    }

    if bytes.starts_with(&[0xFF, 0xFE]) {
        let (contents, _, _) = UTF_16LE.decode(&bytes[2..]);
        return (contents.into_owned(), "utf-16le-bom".to_string());
    }

    if bytes.starts_with(&[0xFE, 0xFF]) {
        let (contents, _, _) = UTF_16BE.decode(&bytes[2..]);
        return (contents.into_owned(), "utf-16be-bom".to_string());
    }

    if let Ok(contents) = std::str::from_utf8(bytes) {
        return (contents.to_string(), "utf-8".to_string());
    }

    let (contents, _, had_errors) = SHIFT_JIS.decode(bytes);
    let encoding = if had_errors {
        "shift-jis-lossy"
    } else {
        "shift-jis"
    };
    (contents.into_owned(), encoding.to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<TextFilePayload, String> {
    let bytes = fs::read(&path).map_err(|error| error.to_string())?;
    let (contents, encoding) = decode_text(&bytes);

    Ok(TextFilePayload {
        name: file_name(&path),
        path,
        contents,
        encoding,
    })
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(path, contents).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![read_text_file, write_text_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
