# 3-Tier AWS Capstone Project — 40-Day AWS Course Final Project

## Architecture

```
                     INTERNET
                        │
               ┌────────▼────────┐
               │   Jenkins EC2   │  (CI/CD Server)
               │   port 8080     │
               └────────┬────────┘
                        │ SSH deploy
          ┌─────────────┴─────────────┐
          │                           │
 ┌────────▼────────┐       ┌──────────▼───────┐
 │   Dev EC2       │       │   Prod EC2        │
 │   Tier 1+2      │       │   Tier 1+2        │
 │                 │       │                   │
 │ [React:80]      │       │ [React:80]        │
 │ [Node API:5000] │       │ [Node API:5000]   │
 └────────┬────────┘       └──────────┬────────┘
          │                           │
          └───────────┬───────────────┘
                      │ MySQL port 3306
               ┌──────▼──────┐
               │  RDS MySQL  │  (Tier 3 - Data)
               │  Private    │
               │  Subnet     │
               └─────────────┘

Supporting Services:
  - ECR  → stores Docker images (backend + frontend)
  - S3   → stores build artifacts
  - IAM  → EC2 roles for ECR pull access
```

## 3 Tiers Explained

| Tier | What | AWS Service |
|---|---|---|
| Tier 1 — Presentation | React app served by nginx | EC2 (Docker container) |
| Tier 2 — Application  | Node.js REST API (Express) | EC2 (Docker container) |
| Tier 3 — Data         | MySQL database | RDS (private subnet) |

---

## Prerequisites (install once)

```bash
# 1. AWS CLI
pip install awscli
aws configure   # enter your Access Key, Secret, region=us-east-1

# 2. Terraform
# Download from https://developer.hashicorp.com/terraform/downloads
terraform -version   # should show v1.6+

# 3. Node.js 18+
node -v

# 4. Docker (for local dev)
docker -v
```

---

## PHASE 1 — Run Locally (no AWS needed)

### Option A — Without Docker (fastest)

```bash
# Terminal 1: start MySQL locally (or skip if no MySQL, tests still pass)
# If you have MySQL installed:
mysql -u root -e "CREATE DATABASE IF NOT EXISTS capstone; CREATE USER IF NOT EXISTS 'appuser'@'localhost' IDENTIFIED BY 'apppassword'; GRANT ALL ON capstone.* TO 'appuser'@'localhost';"

# Terminal 1: start backend
cd backend
cp .env.example .env
npm install
npm start
# API running at http://localhost:5000

# Terminal 2: start frontend
cd frontend
npm install
npm start
# Website at http://localhost:3000
```

### Option B — With Docker Compose (recommended)

```bash
# From the project root (where docker-compose.yml is)
docker-compose up --build

# Website:  http://localhost:80
# API:      http://localhost:5000/api/health
# MySQL:    localhost:3306

# Stop everything
docker-compose down
```

### Run backend tests

```bash
cd backend
npm test
# Expect: 8 tests passing
```

---

## PHASE 2 — Provision AWS Infrastructure with Terraform

```bash
cd infra/terraform

# 1. Initialise Terraform
terraform init

# 2. Create a terraform.tfvars file with your values
cat > terraform.tfvars << EOF
aws_region    = "us-east-2"
project       = "capstone"
key_pair_name = "3245-ohio"   # must exist in your AWS account
your_ip       = "103.204.211.175/32"    # run: curl ifconfig.me
db_password   = "MySecurePass123!"
EOF

# 3. Preview what will be created
terraform plan

# 4. Create all resources (takes 8-12 minutes)
terraform apply -auto-approve

# 5. Save the outputs — you need these values for Jenkins
terraform output
```

Note all the output values:
- `jenkins_ip` → your Jenkins server
- `dev_ec2_ip` → Dev deployment target
- `prod_ec2_ip` → Prod deployment target
- `rds_endpoint` → DB connection string
- `ecr_backend_url` / `ecr_frontend_url` → image registries

---

## PHASE 3 — Configure Jenkins

### Step 1: Open Jenkins

```
http://<jenkins_ip>:8080
```

Wait 2-3 minutes after Terraform completes for Jenkins to fully start.

### Step 2: Unlock Jenkins

```bash
# SSH into Jenkins EC2
ssh -i your-key.pem ec2-user@<jenkins_ip>

# Get the initial admin password
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

Paste that password into the Jenkins unlock screen.

### Step 3: Install Jenkins plugins

In Jenkins → Manage Jenkins → Plugins → Available plugins, install:

- **Pipeline** (usually pre-installed)
- **Git**
- **SSH Agent**
- **AWS Steps** (Pipeline: AWS Steps)
- **Docker Pipeline**
- **Blue Ocean** (optional, nice UI)
- **GitHub Integration** (this for webhook-trigger when push code)

Click "Install without restart", then restart Jenkins.

### Step 4: Add credentials in Jenkins

Go to: **Manage Jenkins → Credentials → System → Global → Add Credential**

Add each of these (Kind = Secret text unless noted):

| ID | Kind | Value |
|---|---|---|
| `aws-account-id` | Secret text | Your 12-digit AWS account ID |
| `aws-credentials` | AWS Credentials | Your Access Key + Secret Key |
| `dev-ec2-ip` | Secret text | Dev EC2 public IP from terraform output |
| `prod-ec2-ip` | Secret text | Prod EC2 public IP from terraform output |
| `rds-endpoint` | Secret text | RDS endpoint (without port) from terraform output |
| `db-password` | Secret text | Same password you used in terraform.tfvars |
| `ec2-ssh-key` | SSH Username with private key | Username: `ec2-user`, Key: paste your .pem file content |

### Step 5: Create the Pipeline job

1. Jenkins Dashboard → **New Item**
2. Name: `capstone-cicd`
3. Type: **Pipeline**
4. Click OK

In the job config:
- **Definition**: Pipeline script from SCM
- **SCM**: Git
- **Repository URL**: your GitHub repo URL
- **Branch**: `*/main`
- **Script Path**: `Jenkinsfile`
- Save

### Step 6: Push code to GitHub

```bash
# In your capstone project folder
git init
git add .
git commit -m "Initial commit: 3-tier capstone project"
git remote add origin https://github.com/YOUR_USERNAME/capstone.git
git push -u origin main
```

### Step 7: Configure GitHub webhook (auto-trigger pipeline)

1. GitHub repo → **Settings → Webhooks → Add webhook**
2. Payload URL: `http://<jenkins_ip>:8080/github-webhook/`
3. Content type: `application/json`
4. Events: **Just the push event**
5. Save

### Configure Jenkins to get automaticaly trigger when push
 - Go to your pipeline job → Configure → scroll to Build Triggers:
 - ✅ Check: "GitHub hook trigger for GITScm polling"
 - Save

Now every `git push` to `main` automatically triggers the pipeline.

---
## Before run the build need to do some task
### Allow jnekins IP in dev-server SG
 - add jenknis ip in dev-sg security group
 - make sure you are able to ssh from jenkins server to dev and prod server
 
## PHASE 4 — Run the Pipeline

```bash
# Trigger manually first to verify
# Jenkins Dashboard → capstone-cicd → Build Now
```

Watch the stages in Blue Ocean or the classic view:

```
✅ Checkout          (10 sec)
✅ Backend Test      (30 sec)  — 8 tests pass
✅ Frontend Build    (2 min)   — React build
✅ Docker Build      (2 min)   — 2 images built
✅ ECR Push          (1 min)   — images in AWS registry
✅ Deploy Dev        (30 sec)  — containers running on Dev EC2
⏸  Approval         (waits)   — manual gate before prod
✅ Deploy Prod       (30 sec)  — containers running on Prod EC2
```

When it hits the Approval stage, go to Jenkins → the build → **Approve** to proceed to Prod.

---

## PHASE 5 — Verify Deployments

```bash
# Dev
curl http://<dev_ec2_ip>/api/health
# → {"status":"OK","timestamp":"..."}

# Prod
curl http://<prod_ec2_ip>/api/health
# → {"status":"OK","timestamp":"..."}

# Open the websites in your browser
open http://<dev_ec2_ip>
open http://<prod_ec2_ip>
```

You should see the Task Manager UI with the dark theme. Add a task — it saves to RDS MySQL in the private subnet.

---

## Day-to-day workflow after setup

```bash
# Make a code change
vi backend/src/routes/tasks.js

# Commit and push
git add .
git commit -m "feat: improve task listing"
git push origin main

# Jenkins auto-triggers → tests → build → deploy to dev
# Then you approve → deploys to prod
```

---

## PHASE 6 — Clean up (avoid AWS charges)

```bash
# Destroy all AWS resources
cd infra/terraform
terraform destroy -auto-approve

# Confirm in AWS console:
# - EC2 instances terminated
# - RDS deleted
# - ECR repos deleted
# - VPC deleted
```

---

## Project file structure

```
capstone/
├── backend/
│   ├── src/
│   │   ├── server.js        # Express entry point
│   │   ├── db.js            # MySQL connection pool
│   │   └── routes/
│   │       └── tasks.js     # CRUD endpoints
│   ├── tests/
│   │   └── api.test.js      # 8 Jest tests (mocked DB)
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.js           # React Task Manager UI
│   │   ├── App.css
│   │   └── index.js
│   ├── public/index.html
│   ├── Dockerfile
│   ├── nginx.conf           # proxies /api to backend
│   └── package.json
├── infra/terraform/
│   ├── main.tf              # VPC, EC2, RDS, ECR, S3, IAM
│   ├── variables.tf
│   ├── outputs.tf
│   ├── user_data_jenkins.sh # installs Jenkins+Docker on EC2
│   └── user_data_app.sh     # installs Docker on app EC2s
├── Jenkinsfile              # 7-stage CI/CD pipeline
├── docker-compose.yml       # local dev (mysql+backend+frontend)
└── README.md
```

---

## Jenkins credentials reference

```
aws-account-id   → 123456789012
aws-credentials  → IAM access key + secret
dev-ec2-ip       → 3.X.X.X
prod-ec2-ip      → 54.X.X.X
rds-endpoint     → capstone-mysql.xxxxxx.us-east-1.rds.amazonaws.com
db-password      → MySecurePass123!
ec2-ssh-key      → (paste contents of your .pem file)
```
