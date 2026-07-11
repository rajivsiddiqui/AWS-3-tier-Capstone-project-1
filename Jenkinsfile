// ============================================================
// Jenkinsfile — 3-Tier AWS Capstone CI/CD Pipeline
// ============================================================

pipeline {
  agent any

  environment {
    AWS_REGION     = 'us-east-2'
    AWS_ACCOUNT_ID = credentials('aws-account-id')
    IMAGE_TAG      = "${BUILD_NUMBER}"
    DEV_EC2_IP     = credentials('dev-ec2-ip')
    PROD_EC2_IP    = credentials('prod-ec2-ip')
    RDS_ENDPOINT   = credentials('rds-endpoint')
    DB_PASSWORD    = credentials('db-password')
  }

  options {
    buildDiscarder(logRotator(numToKeepStr: '10'))
    timeout(time: 30, unit: 'MINUTES')
  }

  stages {

    // ----------------------------------------------------------
    stage('Checkout') {
      steps {
        checkout scm
        echo "Building branch: ${env.BRANCH_NAME} | Build: #${BUILD_NUMBER}"
      }
    }

    // ----------------------------------------------------------
    stage('Backend — Install & Test') {
      steps {
        dir('backend') {
          sh 'npm ci'
          sh 'npm test'
        }
      }
      post {
        always {
          junit allowEmptyResults: true,
                testResults: 'backend/coverage/**/*.xml'
        }
      }
    }

    // ----------------------------------------------------------
    stage('Frontend — Install & Build') {
      steps {
        dir('frontend') {
          sh 'npm ci'
          sh "REACT_APP_API_URL='' npm run build"
        }
      }
    }

    // ----------------------------------------------------------
    stage('Docker — Build Images') {
      steps {
        sh "docker build -t capstone-backend:${IMAGE_TAG}  ./backend"
        sh "docker build -t capstone-frontend:${IMAGE_TAG} ./frontend"
        echo "Docker images built: tag ${IMAGE_TAG}"
      }
    }

    // ----------------------------------------------------------
    stage('ECR — Push Images') {
      steps {
        withAWS(region: "${AWS_REGION}", credentials: 'aws-credentials') {
          sh """
            aws ecr get-login-password --region ${AWS_REGION} | \
              docker login --username AWS --password-stdin \
              ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

            docker tag capstone-backend:${IMAGE_TAG}  ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/capstone-backend:${IMAGE_TAG}
            docker tag capstone-backend:${IMAGE_TAG}  ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/capstone-backend:latest
            docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/capstone-backend:${IMAGE_TAG}
            docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/capstone-backend:latest

            docker tag capstone-frontend:${IMAGE_TAG}  ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/capstone-frontend:${IMAGE_TAG}
            docker tag capstone-frontend:${IMAGE_TAG}  ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/capstone-frontend:latest
            docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/capstone-frontend:${IMAGE_TAG}
            docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/capstone-frontend:latest
          """
        }
      }
    }

    // ----------------------------------------------------------
    stage('Deploy — Dev') {
      steps {
        withCredentials([
          string(credentialsId: 'aws-account-id', variable: 'AWS_ACC'),
          string(credentialsId: 'rds-endpoint',   variable: 'RDS_HOST'),
          string(credentialsId: 'db-password',    variable: 'DB_PASS'),
          string(credentialsId: 'dev-ec2-ip',     variable: 'DEV_IP')
        ]) {
          sshagent(['ec2-ssh-key']) {
            sh """
              ssh -o StrictHostKeyChecking=no -o BatchMode=yes ec2-user@\${DEV_IP} bash << 'ENDSSH'

export AWS_REGION=us-east-2
export AWS_ACC=${AWS_ACC}
export RDS_HOST=${RDS_HOST}
export DB_PASS=${DB_PASS}
export IMAGE_TAG=${BUILD_NUMBER}

echo "=== Logging into ECR ==="
aws ecr get-login-password --region \$AWS_REGION | \\
  docker login --username AWS --password-stdin \\
  \$AWS_ACC.dkr.ecr.\$AWS_REGION.amazonaws.com

echo "=== Pulling Images ==="
docker pull \$AWS_ACC.dkr.ecr.\$AWS_REGION.amazonaws.com/capstone-backend:\$IMAGE_TAG
docker pull \$AWS_ACC.dkr.ecr.\$AWS_REGION.amazonaws.com/capstone-frontend:\$IMAGE_TAG

echo "=== Stopping Old Containers ==="
docker stop capstone-backend  2>/dev/null || true
docker stop capstone-frontend 2>/dev/null || true
docker rm   capstone-backend  2>/dev/null || true
docker rm   capstone-frontend 2>/dev/null || true

echo "=== Starting Backend ==="
docker run -d --name capstone-backend \\
  --network host \\
  --restart always \\
  -e DB_HOST=\$RDS_HOST \\
  -e DB_PORT=3306 \\
  -e DB_USER=appuser \\
  -e DB_PASSWORD=\$DB_PASS \\
  -e DB_NAME=capstone \\
  -e NODE_ENV=development \\
  \$AWS_ACC.dkr.ecr.\$AWS_REGION.amazonaws.com/capstone-backend:\$IMAGE_TAG

echo "=== Starting Frontend ==="
docker run -d --name capstone-frontend \\
  --network host \\
  --restart always \\
  \$AWS_ACC.dkr.ecr.\$AWS_REGION.amazonaws.com/capstone-frontend:\$IMAGE_TAG

echo "=== Waiting for startup ==="
sleep 8

echo "=== Backend Logs ==="
docker logs capstone-backend

echo "=== Frontend Logs ==="
docker logs capstone-frontend

echo "=== Running Containers ==="
docker ps

echo "=== Port Check ==="
ss -tlnp | grep -E '80|5000'
ENDSSH
            """
          }
        }
      }
    }

    // ----------------------------------------------------------
    stage('Approval — Promote to Prod?') {
      steps {
        timeout(time: 30, unit: 'MINUTES') {
          input message: "Deploy build #${BUILD_NUMBER} to PRODUCTION?",
                ok: 'Yes, deploy to Prod',
                submitter: 'admin,devlead'
        }
      }
    }

    // ----------------------------------------------------------
    stage('Deploy — Prod') {
      steps {
        withCredentials([
          string(credentialsId: 'aws-account-id', variable: 'AWS_ACC'),
          string(credentialsId: 'rds-endpoint',   variable: 'RDS_HOST'),
          string(credentialsId: 'db-password',    variable: 'DB_PASS'),
          string(credentialsId: 'prod-ec2-ip',    variable: 'PROD_IP')
        ]) {
          sshagent(['ec2-ssh-key']) {
            sh """
              ssh -o StrictHostKeyChecking=no -o BatchMode=yes ec2-user@\${PROD_IP} bash << 'ENDSSH'

export AWS_REGION=us-east-2
export AWS_ACC=${AWS_ACC}
export RDS_HOST=${RDS_HOST}
export DB_PASS=${DB_PASS}
export IMAGE_TAG=${BUILD_NUMBER}

echo "=== Logging into ECR ==="
aws ecr get-login-password --region \$AWS_REGION | \\
  docker login --username AWS --password-stdin \\
  \$AWS_ACC.dkr.ecr.\$AWS_REGION.amazonaws.com

echo "=== Pulling Images ==="
docker pull \$AWS_ACC.dkr.ecr.\$AWS_REGION.amazonaws.com/capstone-backend:\$IMAGE_TAG
docker pull \$AWS_ACC.dkr.ecr.\$AWS_REGION.amazonaws.com/capstone-frontend:\$IMAGE_TAG

echo "=== Stopping Old Containers ==="
docker stop capstone-backend  2>/dev/null || true
docker stop capstone-frontend 2>/dev/null || true
docker rm   capstone-backend  2>/dev/null || true
docker rm   capstone-frontend 2>/dev/null || true

echo "=== Starting Backend ==="
docker run -d --name capstone-backend \\
  --network host \\
  --restart always \\
  -e DB_HOST=\$RDS_HOST \\
  -e DB_PORT=3306 \\
  -e DB_USER=appuser \\
  -e DB_PASSWORD=\$DB_PASS \\
  -e DB_NAME=capstone \\
  -e NODE_ENV=production \\
  \$AWS_ACC.dkr.ecr.\$AWS_REGION.amazonaws.com/capstone-backend:\$IMAGE_TAG

echo "=== Starting Frontend ==="
docker run -d --name capstone-frontend \\
  --network host \\
  --restart always \\
  \$AWS_ACC.dkr.ecr.\$AWS_REGION.amazonaws.com/capstone-frontend:\$IMAGE_TAG

echo "=== Waiting for startup ==="
sleep 8

echo "=== Backend Logs ==="
docker logs capstone-backend

echo "=== Frontend Logs ==="
docker logs capstone-frontend

echo "=== Running Containers ==="
docker ps

echo "=== Port Check ==="
ss -tlnp | grep -E '80|5000'
ENDSSH
            """
          }
        }
        echo "Deployed to Production"
      }
    }
  }

  // ----------------------------------------------------------
  post {
    success {
      echo "Pipeline PASSED — Build #${BUILD_NUMBER}"
    }
    failure {
      echo "Pipeline FAILED — Build #${BUILD_NUMBER} — check logs above"
    }
    always {
      sh 'docker image prune -f || true'
    }
  }
}
