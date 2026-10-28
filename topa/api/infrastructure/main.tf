locals {
  name = "topa-api-${var.stage}"

  # Browser origins allowed to call the API: the site of this stage and the apps' webviews
  # (http://tauri.localhost on Android and Windows, tauri://localhost on macOS and Linux).
  app_origins = ["http://tauri.localhost", "tauri://localhost"]
  cors_origins = {
    prod = concat(["https://topa-totem.vercel.app"], local.app_origins)
    dev  = concat(["https://topa-totem-dev.vercel.app", "http://localhost:5173", "http://localhost:5180"], local.app_origins)
  }
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api" {
  name               = local.name
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "api_basic_execution" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# The ECR repository and the policy that lets Lambda pull from it live in bootstrap/.
resource "aws_lambda_function" "api" {
  function_name = local.name
  role          = aws_iam_role.api.arn

  package_type  = "Image"
  image_uri     = var.image_uri
  architectures = ["x86_64"]
  memory_size   = 512
  timeout       = 30

  environment {
    variables = {
      TOPA_DATABASE_URL = var.topa_database_url
      TOPA_CORS_ORIGINS = jsonencode(local.cors_origins[var.stage])
    }
  }
}

resource "aws_apigatewayv2_api" "api" {
  name          = local.name
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "api" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
