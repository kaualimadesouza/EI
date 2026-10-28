output "ecr_repository_url" {
  description = "Image URI the deploy workflow pushes to."
  value       = aws_ecr_repository.api.repository_url
}

output "deployer_user_arn" {
  description = "Identity GitHub Actions authenticates as."
  value       = aws_iam_user.deployer.arn
}
