# Deploy

The API runs on AWS Lambda as a container image (`../Dockerfile.lambda`), behind an API
Gateway HTTP API (`ANY /{proxy+}`), with Postgres on Neon. There is one stage, prod: a push to
main that touches the API deploys it. The pattern is the one kbjmodas-api and argumenta-api
already run in the same AWS account.

| Stack | What it holds | Applied by |
|---|---|---|
| `bootstrap/` | ECR repository `topa-api` (Lambda pull policy, keeps the ten newest images), IAM user `topa-api-deployer` and its policy | the owner, by hand, rarely |
| `.` (main) | Lambda `topa-api` and its role, HTTP API `topa-api` (throttled, no auth yet) | `.github/workflows/api-deploy.yml` |

Bootstrap is separate because it defines the deployer's own permissions: applied by the
deployer, it could grant itself anything. Those permissions name exactly the function and role
above and allow only the basic Lambda policy on that role, so a leaked key cannot become admin.

## AWS profile

Every command uses `--profile argumenta-ai` (or `AWS_PROFILE=argumenta-ai`), the owner's
personal account. The machine's `default` profile is the work account: confirm with
`aws sts get-caller-identity --profile argumenta-ai` before anything else. Agents only read
AWS; nothing here is applied outside the workflow except bootstrap.

## One-time setup (owner)

1. **Neon**: a project in `aws-us-east-1`. Copy the pooled connection string (host with
   `-pooler`, for the running API) and the direct one (the same without `-pooler`, for
   migrations). Bare `postgresql://` URLs are fine: the API switches them to psycopg 3.
2. **Bootstrap**, with the state bucket kbjmodas-api and argumenta-api already share (again
   whenever `bootstrap/` changes):

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
   - in the `prod` environment, `TOPA_DATABASE_URL` (pooled) and `TOPA_DATABASE_URL_DIRECT`
     (direct).

Until the AWS secrets and the variable exist, the deploy workflow runs the API's CI and skips
the rest with a warning.

## How a deploy runs

In order: the API's CI, the image pushed to ECR tagged with the commit (a rerun reuses it),
`alembic upgrade head` on the direct URL, then `terraform apply` with state under
`topa-api/app/`. The run summary prints the API URL, which `topa/web/.env.production` holds as
`VITE_API_URL`: if it ever changes, update that file. `gh workflow run api-deploy.yml` deploys
main again by hand.

A failed migration leaves the old image serving. A failed apply after a migration leaves the
new schema under the old image, so migrations must work with the code still running.

The function answers CORS for every URL of the site's Vercel project, previews included, and
for the apps' webviews (`main.tf`). Another Vercel project whose name starts with `topa-totem`
would pass the pattern too; that is harmless only while the API has no auth and uses no
cookies.

A cold start (first request after a deploy or an idle spell) takes seconds, not milliseconds.
