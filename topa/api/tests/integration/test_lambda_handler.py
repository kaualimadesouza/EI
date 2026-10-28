import json
from typing import Any

from topa_api.entrypoints.lambda_handler import handler

# the app never reads it: Mangum only passes it along in the request scope
LAMBDA_CONTEXT: Any = {}


def http_api_event(method: str, path: str) -> dict[str, Any]:
    """The payload API Gateway's HTTP API (format 2.0) hands the function for one request."""
    return {
        "version": "2.0",
        "routeKey": "ANY /{proxy+}",
        "rawPath": path,
        "rawQueryString": "",
        "headers": {"host": "api.example.com"},
        "requestContext": {
            "http": {
                "method": method,
                "path": path,
                "protocol": "HTTP/1.1",
                "sourceIp": "203.0.113.7",
                "userAgent": "test",
            },
            "stage": "$default",
        },
        "isBase64Encoded": False,
    }


def test_the_function_answers_an_http_api_request() -> None:
    response = handler(http_api_event("GET", "/health"), LAMBDA_CONTEXT)

    assert response["statusCode"] == 200
    assert json.loads(response["body"]) == {"status": "ok"}


def test_the_function_serves_the_menu_from_the_database() -> None:
    response = handler(http_api_event("GET", "/products"), LAMBDA_CONTEXT)

    assert response["statusCode"] == 200
    assert len(json.loads(response["body"])) > 0
