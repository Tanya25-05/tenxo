use anyhow::{anyhow, Context, Result};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, NewAead};
use base64::Engine;
use base64::engine::general_purpose;
use nats::Connection;
use reqwest::blocking::Client;
use serde::Deserialize;
use std::env;
use std::fs::{self, File};
use std::io::Write;
use std::process::Command;
use tempfile::tempdir;
use rand::RngCore;

#[derive(Deserialize)]
struct JobMsg {
    job_id: Option<String>,
    encrypted_job_url: String,
    result_upload_url: String,
    enc_key_b64: Option<String>,
}

fn main() -> Result<()> {
    let nats_url = env::var("NATS_URL").unwrap_or_else(|_| "nats://127.0.0.1:4222".into());
    let subject = env::var("JOBS_SUBJECT").unwrap_or_else(|_| "jobs".into());
    let result_subject = env::var("RESULT_SUBJECT").unwrap_or_else(|_| "jobs.results".into());
    let node_id = env::var("NODE_ID").unwrap_or_else(|_| hostname::get().map(|h| h.to_string_lossy().into_owned()).unwrap_or_else(|_| format!("node-{}", std::process::id())));
    let owner = env::var("OWNER").unwrap_or_else(|_| String::new());

    println!("Connecting to NATS at {}", nats_url);
    let nc = nats::connect(&nats_url).context("connect nats")?;
    let client = Client::builder().timeout(std::time::Duration::from_secs(300)).build()?;

    let sub = nc.subscribe(&subject).context("subscribe jobs")?;
    println!("Subscribed to {}", subject);

    // spawn heartbeat publisher
    let nc2 = nc.clone();
    let hb_node = node_id.clone();
    let hb_owner = owner.clone();
    std::thread::spawn(move || {
        loop {
            let hb = serde_json::json!({"node_id": hb_node, "status": "idle", "owner": hb_owner});
            let _ = nc2.publish(&format!("heartbeats.{}", hb_node), serde_json::to_vec(&hb).unwrap());
            std::thread::sleep(std::time::Duration::from_secs(20));
        }
    });

    for msg in sub.messages() {
        let data = msg.data.clone();
        let payload: JobMsg = match serde_json::from_slice(&data) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("invalid job message: {}", e);
                continue;
            }
        };

        println!("Received job: {:?}", payload.job_id);
        match handle_job(&client, &payload) {
            Ok(result_url) => {
                let reply = serde_json::json!({"job_id": payload.job_id, "status": "done", "result_url": result_url});
                let _ = nc.publish(&result_subject, serde_json::to_vec(&reply).unwrap());
                println!("Job {} completed", payload.job_id.unwrap_or_default());
            }
            Err(e) => {
                eprintln!("Job failed: {}", e);
                let reply = serde_json::json!({"job_id": payload.job_id, "status": "error", "error": format!("{}", e)});
                let _ = nc.publish(&result_subject, serde_json::to_vec(&reply).unwrap());
            }
        }
    }

    Ok(())
}

fn handle_job(client: &Client, job: &JobMsg) -> Result<String> {
    let enc_bytes = download_bytes(client, &job.encrypted_job_url).context("download encrypted job")?;

    let key_b64 = if let Some(k) = &job.enc_key_b64 { k.clone() } else {
        env::var("JOB_DECRYPT_KEY_B64").map_err(|_| anyhow!("no encryption key provided"))?
    };
    let key = general_purpose::STANDARD.decode(key_b64.as_bytes()).context("decode key")?;
    let plain = decrypt_aes_gcm(&key, &enc_bytes).context("decrypt payload")?;

    let td = tempdir().context("create tempdir")?;
    let workspace = td.path().join("job");
    fs::create_dir_all(&workspace)?;

    // 1. Write the decrypted ZIP and extract it securely
    let zip_path = td.path().join("payload.zip");
    fs::write(&zip_path, &plain)?;
    
    let mut archive = zip::ZipArchive::new(File::open(&zip_path)?).context("open zip")?;
    archive.extract(&workspace).context("extract zip")?;

    // 2. Execute Docker dynamically (auto-installs dependencies and runs the main script)
    let docker_cmd = vec![
        "run", "--gpus", "all", "--rm", 
        "-v", &format!("{}:/workspace", workspace.display()), 
        "-w", "/workspace",
        "python:3.9", 
        "bash", "-c", "if [ -f requirements.txt ]; then pip install -r requirements.txt 2>/dev/null; fi; python $(ls *.py | head -n 1) > stdout.log 2> stderr.log"
    ];
    println!("Running docker: docker {}", docker_cmd.join(" "));
    let _output = Command::new("docker").args(&docker_cmd).output().context("spawn docker")?;

    // 3. Zip the entire workspace (capturing the model.pt and the new logs)
    let result_zip_path = td.path().join("result.zip");
    Command::new("zip")
        .arg("-r")
        .arg(&result_zip_path)
        .arg(".")
        .current_dir(&workspace)
        .output()
        .context("zip result workspace")?;

    // 4. Encrypt the final zip and upload
    let result_blob = fs::read(&result_zip_path)?;
    let encrypted_result = encrypt_aes_gcm(&key, &result_blob).context("encrypt result")?;

    let res = client.put(&job.result_upload_url).body(encrypted_result).send().context("upload result")?;
    if !res.status().is_success() {
        return Err(anyhow!("upload failed: {}", res.status()));
    }

    Ok(job.result_upload_url.clone())
}


fn download_bytes(client: &Client, url: &str) -> Result<Vec<u8>> {
    let mut res = client.get(url).send().context("http get")?;
    if !res.status().is_success() {
        return Err(anyhow!("download failed: {}", res.status()));
    }
    let bytes = res.bytes().context("read body")?;
    Ok(bytes.to_vec())
}

fn decrypt_aes_gcm(key: &[u8], data: &[u8]) -> Result<Vec<u8>> {
    if data.len() < 12 { return Err(anyhow!("ciphertext too short")); }
    let (nonce_bytes, ct) = data.split_at(12);
    let key = Key::from_slice(key);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(nonce_bytes);
    let plain = cipher.decrypt(nonce, ct).context("aes decrypt")?;
    Ok(plain)
}

fn encrypt_aes_gcm(key: &[u8], plaintext: &[u8]) -> Result<Vec<u8>> {
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let key = Key::from_slice(key);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ct = cipher.encrypt(nonce, plaintext).context("aes encrypt")?;
    let mut out = Vec::with_capacity(12 + ct.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ct);
    Ok(out)
}
