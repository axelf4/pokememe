use std::process::Command;
use std::{env, error, str};

fn main() -> Result<(), Box<dyn error::Error>> {
    println!("Hello");

    let args: Vec<String> = env::args().skip(1).collect();

    let stdout = Command::new("gbsplay")
        .arg("-o")
        .arg("iodumper")
        .args(&args)
        .output()
        .expect("Failed to execute process")
        .stdout;
    let stdout = str::from_utf8(&stdout)?;

    println!("{}", stdout);

    Ok(())
}
