use serde_derive::{Deserialize, Serialize};
use valico::json_schema;

pub type Config = Option<serde_json::Value>;

#[derive(Debug)]
pub enum Error {
    EnvironmentVariableNotFound(&'static str),
    JsonParsing(serde_json::Error),
    Validation(json_schema::ValidationState),
}

pub fn load_config() -> Result<Config, Error> {
    let config_text = match std::env::var("APP_CONFIG") {
        Ok(text) => text,
        Err(_) => {
            return Err(Error::EnvironmentVariableNotFound("APP_CONFIG"));
        }
    };

    let schema_text = match std::env::var("APP_CONFIG_SCHEMA") {
        Ok(text) => text,
        Err(_) => {
            return Err(Error::EnvironmentVariableNotFound("APP_CONFIG_SCHEMA"));
        }
    };

    let config = serde_json::from_str(&config_text).map_err(Error::JsonParsing)?;
    let schema = serde_json::from_str(&schema_text).map_err(Error::JsonParsing)?;

    let mut scope = json_schema::Scope::new();
    let schema = scope.compile_and_return(schema, false).unwrap();
    let result = schema.validate(&config);

    if !result.is_valid() {
        return Err(Error::Validation(result));
    }

    return serde_json::from_value(config).map_err(Error::JsonParsing);
}

impl std::error::Error for Error {}

impl std::fmt::Display for Error {
    fn fmt(&self, fmt: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error> {
        match self {
            Error::EnvironmentVariableNotFound(var) => {
                write!(fmt, "EnvironmentVariableNotFound({})", var)?;
            }
            Error::JsonParsing(error) => {
                write!(fmt, "JSON Parsing Error: {}", error)?;
            }
            Error::Validation(state) => {
                write!(fmt, "JSON Schema Validation Error: {:?}", state)?;
            }
        }

        Ok(())
    }
}
