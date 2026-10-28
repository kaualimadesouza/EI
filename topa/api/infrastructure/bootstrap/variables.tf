variable "region" {
  description = "Region the pipeline builds and deploys into."
  type        = string
  default     = "us-east-1"
}

# No default: the bucket name carries the account id, and this repository is public.
variable "state_bucket" {
  description = "Terraform state bucket, created by hand and shared with other projects under their own prefixes."
  type        = string
}
