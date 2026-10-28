variable "image_uri" {
  description = "Pre-built ECR image URI (tagged with the commit SHA)"
  type        = string
}

variable "topa_database_url" {
  description = "Neon's pooled connection string: every Lambda instance opens its own connections."
  type        = string
  sensitive   = true

  # an empty URL would deploy a function that fails every request at import
  validation {
    condition     = length(var.topa_database_url) > 0
    error_message = "topa_database_url is empty: set TOPA_DATABASE_URL in the prod environment."
  }
}
