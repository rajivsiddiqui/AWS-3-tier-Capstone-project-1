// ============================================================
// Jenkinsfile — 3-Tier AWS Capstone CI/CD Pipeline
// Stages:
//   1. Checkout       → pull code from GitHub
//   2. Backend Test   → npm install + jest
//   3. Frontend Build → npm install + react build
//   4. Build Images   → docker build backend + frontend
//   5. Push to ECR    → tag + push both images
//   6. Deploy Dev     → SSH into Dev EC2, pull + restart containers
//   7. Deploy Prod    → same, with manual approval gate first
// ============================================================

pipeline {
  agent any

  environment {
    AWS_REGION       = 'us-east-2'
    AWS_ACCOUNT_ID   = credentials('aws-account-id')
    ECR_BACKEND      = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/capstone-backend"
    ECR_FRONTEND     = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/capstone-frontend"
    IMAGE_TAG        = "${BUILD_NUMBER}"
    DEV_EC2_IP       = credentials('dev-ec2-ip')
    PROD_EC2_IP      = credentials('prod-ec2-ip')
    EC2_SSH_KEY      = credentials('ec2-ssh-key')     // SSH private key credential
    RDS_ENDPOINT     = credentials('rds-endpoint')
    DB_PASSWORD      = credentials('db-password')
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
      // post {
      //   always {
      //     junit 'backend/coverage/**/*.xml'
      //   }
      // }
      // post {
      //   always {
      //     junit allowEmptyResults: true, testResults: '**/target/surefire-reports/*.xml'
      //   }
      // }
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

            docker tag capstone-backend:${IMAGE_TAG}  ${ECR_BACKEND}:${IMAGE_TAG}
            docker tag capstone-backend:${IMAGE_TAG}  ${ECR_BACKEND}:latest
            docker push ${ECR_BACKEND}:${IMAGE_TAG}
            docker push ${ECR_BACKEND}:latest

            docker tag capstone-frontend:${IMAGE_TAG}  ${ECR_FRONTEND}:${IMAGE_TAG}
            docker tag capstone-frontend:${IMAGE_TAG}  ${ECR_FRONTEND}:latest
            docker push ${ECR_FRONTEND}:${IMAGE_TAG}
            docker push ${ECR_FRONTEND}:latest
          """
        }
      }
    }

    // ----------------------------------------------------------
    stage('Deploy — Dev') {
      //when { branch 'main' }
      steps {
        sshagent(['ec2-ssh-key']) {
          sh """
            ssh -o StrictHostKeyChecking=no ec2-user@${DEV_EC2_IP} '
              aws ecr get-login-password --region ${AWS_REGION} | \
                docker login --username AWS --password-stdin \
                ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

              docker pull ${ECR_BACKEND}:${IMAGE_TAG}
              docker pull ${ECR_FRONTEND}:${IMAGE_TAG}

              docker stop capstone-backend  2>/dev/null || true
              docker stop capstone-frontend 2>/dev/null || true
              docker rm   capstone-backend  2>/dev/null || true
              docker rm   capstone-frontend 2>/dev/null || true

              docker run -d --name capstone-backend \
                -p 5000:5000 \
                -e DB_HOST=${RDS_ENDPOINT} \
                -e DB_USER=admin \
                -e DB_PASSWORD=${DB_PASSWORD} \
                -e DB_NAME=capstone \
                -e NODE_ENV=development \
                ${ECR_BACKEND}:${IMAGE_TAG}

              docker run -d --name capstone-frontend \
                -p 80:80 \
                ${ECR_FRONTEND}:${IMAGE_TAG}
            '
          """
        }
        echo "Deployed to Dev: http://${DEV_EC2_IP}"
      }
    }

    // ----------------------------------------------------------
    stage('Approval — Promote to Prod?') {
      //when { branch 'main' }
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
      //when { branch 'main' }
      steps {
        sshagent(['ec2-ssh-key']) {
          sh """
            ssh -o StrictHostKeyChecking=no ec2-user@${PROD_EC2_IP} '
              aws ecr get-login-password --region ${AWS_REGION} | \
                docker login --username AWS --password-stdin \
                ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

              docker pull ${ECR_BACKEND}:${IMAGE_TAG}
              docker pull ${ECR_FRONTEND}:${IMAGE_TAG}

              docker stop capstone-backend  2>/dev/null || true
              docker stop capstone-frontend 2>/dev/null || true
              docker rm   capstone-backend  2>/dev/null || true
              docker rm   capstone-frontend 2>/dev/null || true

              docker run -d --name capstone-backend \
                --restart always \
                -p 5000:5000 \
                -e DB_HOST=${RDS_ENDPOINT} \
                -e DB_USER=appuser \
                -e DB_PASSWORD=${DB_PASSWORD} \
                -e DB_NAME=capstone \
                -e NODE_ENV=production \
                ${ECR_BACKEND}:${IMAGE_TAG}

              docker run -d --name capstone-frontend \
                --restart always \
                -p 80:80 \
                ${ECR_FRONTEND}:${IMAGE_TAG}
            '
          """
        }
        echo "Deployed to Production: http://${PROD_EC2_IP}"
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
