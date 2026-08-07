use std::fs::File;
use std::io;

pub(super) struct OpenFileIdentity {
    #[cfg(any(target_os = "macos", target_os = "linux", windows))]
    file: File,
}

impl OpenFileIdentity {
    pub(super) fn hold(file: File) -> Self {
        #[cfg(any(target_os = "macos", target_os = "linux", windows))]
        {
            Self { file }
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
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
        #[cfg(windows)]
        {
            if !crate::backup::windows_file_identity::same_file(&self.file, actual)? {
                return Err(io::Error::other("backup archive identity changed"));
            }
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
        {
            let _ = actual;
        }
        Ok(())
    }
}
