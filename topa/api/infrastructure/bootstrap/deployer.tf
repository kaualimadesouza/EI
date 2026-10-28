# The identity GitHub Actions authenticates as. Its access key is created by hand and
# pasted into the repository secrets: aws_iam_access_key would put it in state as plaintext.
resource "aws_iam_user" "deployer" {
  name = "topa-api-deployer"
}

locals {
  account_id = data.aws_caller_identity.current.account_id
  # exactly the names main.tf creates: a wildcard would let the key mint new roles
  function_arn = "arn:aws:lambda:${var.region}:${local.account_id}:function:topa-api"
  role_arn     = "arn:aws:iam::${local.account_id}:role/topa-api"
}

data "aws_iam_policy_document" "deployer" {
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
    ]
    resources = [aws_ecr_repository.api.arn]
  }

  # The bucket is shared with other projects, and this stack's own state sits next to the
  # main one: the deployer writes only under topa-api/app/.
  statement {
    sid       = "TerraformStateList"
    actions   = ["s3:ListBucket"]
    resources = ["arn:aws:s3:::${var.state_bucket}"]
  }

  statement {
    sid       = "TerraformState"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["arn:aws:s3:::${var.state_bucket}/topa-api/app/*"]
  }

  statement {
    sid = "LambdaManage"
    actions = [
      "lambda:CreateFunction",
      "lambda:DeleteFunction",
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
      "lambda:GetFunctionCodeSigningConfig",
      "lambda:UpdateFunctionCode",
      "lambda:UpdateFunctionConfiguration",
      "lambda:ListVersionsByFunction",
      "lambda:TagResource",
      "lambda:UntagResource",
      "lambda:ListTags",
      "lambda:AddPermission",
      "lambda:RemovePermission",
      "lambda:GetPolicy",
    ]
    resources = [local.function_arn]
  }

  statement {
    sid = "IamForLambdaRole"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:TagRole",
      "iam:ListAttachedRolePolicies",
      "iam:ListRolePolicies",
      "iam:ListInstanceProfilesForRole",
    ]
    resources = [local.role_arn]
  }

  # Only the basic execution policy: attaching AdministratorAccess to the function's role
  # would turn a leaked deployer key into admin of the whole account.
  statement {
    sid       = "LambdaRolePolicy"
    actions   = ["iam:AttachRolePolicy", "iam:DetachRolePolicy"]
    resources = [local.role_arn]

    condition {
      test     = "ArnEquals"
      variable = "iam:PolicyARN"
      values   = ["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]
    }
  }

  statement {
    sid       = "PassLambdaExecutionRole"
    actions   = ["iam:PassRole"]
    resources = [local.role_arn]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["lambda.amazonaws.com"]
    }
  }

  statement {
    sid       = "ApiGatewayManage"
    actions   = ["apigateway:GET", "apigateway:POST", "apigateway:PUT", "apigateway:PATCH", "apigateway:DELETE"]
    resources = ["arn:aws:apigateway:${var.region}::/apis", "arn:aws:apigateway:${var.region}::/apis/*"]
  }
}

resource "aws_iam_policy" "deployer" {
  name   = "topa-api-deployer-policy"
  policy = data.aws_iam_policy_document.deployer.json
}

resource "aws_iam_user_policy_attachment" "deployer" {
  user       = aws_iam_user.deployer.name
  policy_arn = aws_iam_policy.deployer.arn
}
