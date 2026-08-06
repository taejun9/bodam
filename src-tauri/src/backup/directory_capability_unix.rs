#![cfg(any(target_os = "macos", target_os = "linux"))]

use std::path::{Component, Path};

use rustix::fd::OwnedFd;
use rustix::fs::{openat, Mode, OFlags, CWD};

pub(super) fn open_absolute_directory(path: &Path) -> rustix::io::Result<OwnedFd> {
    let flags = OFlags::RDONLY | OFlags::DIRECTORY | OFlags::CLOEXEC | OFlags::NOFOLLOW;
    let mut current = openat(CWD, Path::new("/"), flags, Mode::empty())?;
    for component in path.components() {
        match component {
            Component::RootDir => {}
            Component::Normal(name) => {
                current = openat(&current, name, flags, Mode::empty())?;
            }
            _ => return Err(rustix::io::Errno::INVAL),
        }
    }
    Ok(current)
}
