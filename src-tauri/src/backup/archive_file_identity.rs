use std::fs::File;
use std::io;

pub(super) struct OpenFileIdentity {
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    file: File,
}

impl OpenFileIdentity {
    pub(super) fn hold(file: File) -> Self {
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            Self { file }
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        {
            drop(file);
            Self {}
        }
    }

    pub(super) fn ensure_matches(&self, actual: &File) -> io::Result<()> {
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            use std::os::unix::fs::MetadataExt;

            let expected = self.file.metadata()?;
            let actual = actual.metadata()?;
            if expected.dev() != actual.dev() || expected.ino() != actual.ino() {
                return Err(io::Error::other("backup archive identity changed"));
            }
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        {
            let _ = actual;
        }
        Ok(())
    }
}
