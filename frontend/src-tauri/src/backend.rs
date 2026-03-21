use std::path::PathBuf;
use std::process::{Child, Command, Stdio};

fn backend_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../backend")
}

fn candidate_commands(backend_path: &PathBuf) -> Vec<(String, Vec<String>)> {
    let mut candidates: Vec<(String, Vec<String>)> = Vec::new();

    #[cfg(target_os = "windows")]
    let venv_python = backend_path.join(".venv").join("Scripts").join("python.exe");
    #[cfg(not(target_os = "windows"))]
    let venv_python = backend_path.join(".venv").join("bin").join("python");

    if venv_python.exists() {
        candidates.push((
            venv_python.to_string_lossy().to_string(),
            vec!["main.py".to_string()],
        ));
    }

    candidates.push(("python3".to_string(), vec!["main.py".to_string()]));
    candidates.push(("python".to_string(), vec!["main.py".to_string()]));
    candidates
}

pub fn spawn_backend_sidecar() -> Option<Child> {
    let backend_path = backend_dir();
    if !backend_path.exists() {
        eprintln!(
            "[dubflow-sidecar] backend path not found: {}",
            backend_path.to_string_lossy()
        );
        return None;
    }

    for (bin, args) in candidate_commands(&backend_path) {
        let child = Command::new(&bin)
            .args(args)
            .current_dir(&backend_path)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();

        if let Ok(process) = child {
            println!("[dubflow-sidecar] backend started by {}", bin);
            return Some(process);
        }
    }

    eprintln!("[dubflow-sidecar] failed to spawn backend sidecar");
    None
}
