# What the web build takes as VITE_API_URL; the routes sit at the root, so no trailing slash.
output "api_url" {
  value = trimsuffix(aws_apigatewayv2_stage.default.invoke_url, "/")
}
