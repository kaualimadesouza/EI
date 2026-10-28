"""AWS Lambda entrypoint: HTTP API events reach the same FastAPI app uvicorn serves."""

from mangum import Mangum

from topa_api.entrypoints.rest_application import app

# no startup or shutdown hooks to run, and Lambda freezes the process between requests anyway
handler = Mangum(app, lifespan="off")
