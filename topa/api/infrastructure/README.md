# Deploy

The API runs on AWS Lambda as a container image (`../Dockerfile.lambda`), behind an API
Gateway HTTP API (`ANY /{proxy+}`), with Postgres on Neon. Two stages, `dev` and `prod`,
each with its own function, API, Neon branch and Terraform state. The pattern is the one
kbjmodas-api and argumenta-api already run in the same AWS account.

| Stack | What it holds | Applied by |
|---|---|---|
| `bootstrap/` | ECR repository `topa-api` with the Lambda pull policy, IAM user `topa-api-deployer` and its policy | the owner, by hand, rarely |
| `.` (main) | per stage: Lambda `topa-api-<stage>` and its role, HTTP API `topa-api-<stage>` | `.github/workflows/api-deploy.yml` |

Bootstrap is separate because it defines the deployer's own permissions: applied by the
deployer, it could grant itself anything.

## AWS profile

Every command uses `--profile argumenta-ai` (or `AWS_PROFILE=argumenta-ai`), the owner's
personal account. The machine's `default` profile is the work account: confirm with
`aws sts get-caller-identity --profile argumenta-ai` before anything else. Agents only read
AWS; nothing here is applied outside the workflow except bootstrap.

## One-time setup (owner)

1. **Neon**: a project in `aws-us-east-1` with a `dev` and a `prod` branch. For each, copy
   the pooled connection string (host with `-pooler`, for the running API) and the direct
   one (for migrations). Bare `postgresql://` URLs are fine: the API switches them to
   psycopg 3.
2. **Bootstrap**, with the state bucket kbjmodas-api and argumenta-api already share:

   ```bash
   cd topa/api/infrastructure/bootstrap
   export AWS_PROFILE=argumenta-ai TF_VAR_state_bucket=<state bucket>
   terraform init -backend-config="bucket=$TF_VAR_state_bucket" \
     -backend-config="key=topa-api/bootstrap/terraform.tfstate" -backend-config="region=us-east-1"
   terraform apply
   ```

3. **Deployer key**, by hand so it never lands in Terraform state:
   `aws iam create-access-key --user-name topa-api-deployer --profile argumenta-ai`.
4. **GitHub** (`gh secret set` / `gh variable set` on kaualimadesouza/EI):
   - repository secrets `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (the deployer key);
   - repository variable `TF_STATE_BUCKET`;
   - in the `dev` and `prod` environments, `TOPA_DATABASE_URL` (pooled) and
     `TOPA_DATABASE_URL_DIRECT` (direct).

Until the secrets and the variable exist, the deploy workflow runs its CI and skips the rest.

## How a deploy runs

A push to main that touches `topa/api` deploys `dev`; a release deploys `prod` (also by hand:
`gh workflow run api-deploy.yml -f environment=prod`). In order: the API's CI, the image
pushed to ECR tagged with the commit, `alembic upgrade head` on the direct URL, then
`terraform apply`. The run summary prints the API URL, which is what the web build takes as
`VITE_API_URL`.

A failed migration leaves the old image serving. A failed apply after a migration leaves the
new schema under the old image, so migrations must work with the code still running.

The function answers CORS for its stage's site and for the apps' webviews (`main.tf`).
A cold start (first request after a deploy or an idle spell) takes seconds, not milliseconds.
