variable "stage" {
  description = "Deployment stage (dev or prod)"
  type        = string

  validation {
    condition     = contains(["dev", "prod"], var.stage)
    error_message = "stage must be \"dev\" or \"prod\"."
  }
}

variable "image_uri" {
  description = "Pre-built ECR image URI (tagged with the commit SHA)"
  type        = string
}

variable "topa_database_url" {
  description = "Neon's pooled connection string: every Lambda instance opens its own connections."
  type        = string
  sensitive   = true
}
