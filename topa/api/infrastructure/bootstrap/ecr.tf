data "aws_caller_identity" "current" {}

resource "aws_ecr_repository" "api" {
  name                 = "topa-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

# Without this, Lambda cannot pull the image and CreateFunction fails with AccessDeniedException.
data "aws_iam_policy_document" "ecr_lambda_pull" {
  statement {
    sid     = "LambdaECRImageRetrievalPolicy"
    effect  = "Allow"
    actions = ["ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_ecr_repository_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy     = data.aws_iam_policy_document.ecr_lambda_pull.json
}
