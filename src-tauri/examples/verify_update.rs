//! Offline verification of Tauri updater artifacts, without reading a private key.
use base64::{engine::general_purpose::STANDARD, Engine};
use client_desk_lib::error::{AppError, Result};
use minisign_verify::{PublicKey, Signature};
use std::{ffi::OsString, path::Path, process::ExitCode};

fn decode_envelope(value: &str, label: &str) -> Result<String> {
    let encoded = value.trim().trim_start_matches('\u{feff}');
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|_| AppError::new("invalidSignature", format!("{label}的外层 Base64 编码无效")))?;
    String::from_utf8(bytes)
        .map_err(|_| AppError::new("invalidSignature", format!("{label}不是有效的 UTF-8 文本")))
}

fn verify_content(installer: &[u8], signature_text: &str, public_key_text: &str) -> Result<()> {
    let public_key = PublicKey::decode(&decode_envelope(public_key_text, "更新公钥")?)
        .map_err(|_| AppError::new("invalidSignature", "无法解析更新公钥"))?;
    let signature = Signature::decode(&decode_envelope(signature_text, "更新签名")?)
        .map_err(|_| AppError::new("invalidSignature", "无法解析更新签名"))?;
    // Match tauri-plugin-updater: verify both the payload and the trusted comment,
    // while retaining compatibility with existing legacy Minisign signatures.
    public_key.verify(installer, &signature, true).map_err(|_| {
        AppError::new(
            "invalidSignature",
            "安装包签名验证失败：文件已被更改、签名无效或签名私钥与更新公钥不匹配",
        )
    })
}

fn verify_paths(installer: &Path, signature: &Path, public_key: &Path) -> Result<()> {
    let content = std::fs::read(installer)
        .map_err(|_| AppError::new("io", "无法读取安装包，请检查路径和访问权限"))?;
    let signature_text = std::fs::read_to_string(signature)
        .map_err(|_| AppError::new("io", "无法读取更新签名文件，请检查路径和访问权限"))?;
    let public_key_text = std::fs::read_to_string(public_key)
        .map_err(|_| AppError::new("io", "无法读取更新公钥文件，请检查路径和访问权限"))?;
    verify_content(&content, &signature_text, &public_key_text)
}

fn run(args: impl Iterator<Item = OsString>) -> Result<()> {
    let paths: Vec<OsString> = args.collect();
    if paths.len() != 3 {
        return Err(AppError::invalid(
            "用法：verify_update <安装包路径> <签名路径> <更新公钥路径>",
        ));
    }
    verify_paths(
        Path::new(&paths[0]),
        Path::new(&paths[1]),
        Path::new(&paths[2]),
    )
}

fn main() -> ExitCode {
    match run(std::env::args_os().skip(1)) {
        Ok(()) => {
            println!("安装包与更新公钥的完整签名验证通过。");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("更新发布验证失败：{error}");
            ExitCode::FAILURE
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Public test vectors from minisign-verify 0.3.0's official verify_prehashed
    // test (MIT): https://docs.rs/crate/minisign-verify/0.3.0/source/src/lib.rs
    // They authenticate b"test" and have no relationship to the user's keys.
    const PUBLIC_KEY: &str = "untrusted comment: minisign public key E7620F1842B4E81F\n\
        RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3";
    const SIGNATURE: &str = "untrusted comment: signature from minisign secret key\n\
        RUQf6LRCGA9i559r3g7V1qNyJDApGip8MfqcadIgT9CuhV3EMhHoN1mGTkUidF/\
        z7SrlQgXdy8ofjb7bNJJylDOocrCo8KLzZwo=\n\
        trusted comment: timestamp:1556193335\tfile:test\n\
        y/rUw2y8/hOUYjZU71eHp/Wo1KZ40fGy2VJEDl34XMJM+TX48Ss/17u3IvIfbVR1FkZZSNCisQbuQY+bHwhEBg==";

    fn encoded(value: &str) -> String {
        STANDARD.encode(value)
    }

    #[test]
    fn valid_official_fixture_verifies_from_tauri_files() {
        let dir = tempfile::tempdir().expect("create fixture directory");
        let installer = dir.path().join("公开测试安装包.exe");
        let signature = dir.path().join("test.sig");
        let public_key = dir.path().join("test.pub");
        std::fs::write(&installer, b"test").expect("write public payload");
        std::fs::write(&signature, encoded(SIGNATURE)).expect("write public signature");
        std::fs::write(&public_key, encoded(PUBLIC_KEY)).expect("write public key");
        assert!(verify_paths(&installer, &signature, &public_key).is_ok());
    }

    #[test]
    fn tampered_installer_is_rejected() {
        let error = verify_content(b"Test", &encoded(SIGNATURE), &encoded(PUBLIC_KEY))
            .expect_err("modified bytes must fail");
        assert_eq!(error.code, "invalidSignature");
    }

    #[test]
    fn wrong_public_key_with_the_same_key_id_is_rejected() {
        let mut key = STANDARD
            .decode(PUBLIC_KEY.lines().nth(1).expect("fixture public key"))
            .expect("decode public fixture");
        // Keep the algorithm and key ID intact: matching IDs alone must not pass.
        key[10] ^= 1;
        let wrong_key = format!(
            "untrusted comment: wrong public test key\n{}",
            STANDARD.encode(key)
        );
        assert!(verify_content(b"test", &encoded(SIGNATURE), &encoded(&wrong_key)).is_err());
    }

    #[test]
    fn tampered_trusted_comment_is_rejected() {
        let altered = SIGNATURE.replace("file:test", "file:changed");
        assert!(verify_content(b"test", &encoded(&altered), &encoded(PUBLIC_KEY)).is_err());
    }

    #[test]
    fn malformed_envelope_and_wrong_argument_count_are_rejected() {
        assert!(verify_content(b"test", "invalid!", &encoded(PUBLIC_KEY)).is_err());
        assert!(run(std::iter::empty()).is_err());
    }
}
