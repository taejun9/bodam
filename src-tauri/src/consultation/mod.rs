pub(crate) mod commands;
mod model;
mod repository;
mod validation;

pub(crate) use repository::ConsultationRepository;

#[cfg(test)]
mod commands_tests;
#[cfg(test)]
mod repository_tests;
#[cfg(test)]
mod validation_tests;
